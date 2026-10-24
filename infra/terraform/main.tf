data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_caller_identity" "current" {}

data "aws_rds_engine_version" "postgres" {
  engine  = "postgres"
  version = "16"
  latest  = true
}

data "tls_certificate" "github_actions" {
  url = "https://token.actions.githubusercontent.com"
}

data "aws_ec2_managed_prefix_list" "cloudfront_origin" {
  name = "com.amazonaws.global.cloudfront.origin-facing"
}

locals {
  name              = "orbit-${var.environment}"
  azs               = slice(data.aws_availability_zones.available.names, 0, 2)
  tags              = { Project = "orbit-workspace", Environment = var.environment }
  github_thumbprint = tolist(data.tls_certificate.github_actions.certificates)[length(data.tls_certificate.github_actions.certificates) - 1].sha1_fingerprint
}

module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "6.7.3"

  name = local.name
  cidr = var.vpc_cidr
  azs  = local.azs

  public_subnets  = [for index, _ in local.azs : cidrsubnet(var.vpc_cidr, 8, index)]
  private_subnets = [for index, _ in local.azs : cidrsubnet(var.vpc_cidr, 8, index + 16)]

  enable_nat_gateway     = true
  single_nat_gateway     = true
  one_nat_gateway_per_az = false

  enable_flow_log                                 = true
  create_flow_log_cloudwatch_log_group            = true
  create_flow_log_cloudwatch_iam_role             = true
  flow_log_cloudwatch_log_group_retention_in_days = 30

  public_subnet_tags = {
    "kubernetes.io/role/elb" = "1"
  }
  private_subnet_tags = {
    "kubernetes.io/role/internal-elb" = "1"
    "karpenter.sh/discovery"          = local.name
  }

  tags = local.tags
}

module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "21.29.0"

  name               = local.name
  kubernetes_version = var.kubernetes_version
  vpc_id             = module.vpc.vpc_id
  subnet_ids         = module.vpc.private_subnets

  authentication_mode                      = "API"
  enable_cluster_creator_admin_permissions = true
  enable_irsa                              = true
  endpoint_private_access                  = true
  endpoint_public_access                   = true
  endpoint_public_access_cidrs             = var.cluster_admin_cidrs
  enabled_log_types                        = ["api", "audit", "authenticator", "controllerManager", "scheduler"]
  cloudwatch_log_group_retention_in_days   = 30
  deletion_protection                      = true
  create_kms_key                           = true

  addons = {
    coredns      = { most_recent = true }
    "kube-proxy" = { most_recent = true }
    "vpc-cni"    = { most_recent = true }
  }

  eks_managed_node_groups = {
    primary = {
      name           = "${local.name}-workers"
      ami_type       = "AL2023_x86_64_STANDARD"
      instance_types = [var.node_instance_type]
      capacity_type  = "ON_DEMAND"
      min_size       = var.node_min_size
      max_size       = var.node_max_size
      desired_size   = var.node_min_size

      update_config = {
        max_unavailable = 1
      }

      tags = {
        "k8s.io/cluster-autoscaler/enabled"       = "true"
        "k8s.io/cluster-autoscaler/${local.name}" = "owned"
      }

      autoscaling_group_tags = {
        "k8s.io/cluster-autoscaler/enabled"       = "true"
        "k8s.io/cluster-autoscaler/${local.name}" = "owned"
      }
    }
  }

  tags = local.tags
}

resource "aws_ecr_repository" "app" {
  name                 = "orbit-workspace"
  image_tag_mutability = "IMMUTABLE"
  force_delete         = false
  image_scanning_configuration { scan_on_push = true }
  encryption_configuration { encryption_type = "AES256" }
  tags = local.tags
}

resource "aws_ecr_lifecycle_policy" "app" {
  repository = aws_ecr_repository.app.name
  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Expire untagged build layers after one week"
      selection = {
        tagStatus   = "untagged"
        countType   = "sinceImagePushed"
        countUnit   = "days"
        countNumber = 7
      }
      action = { type = "expire" }
    }]
  })
}

resource "aws_security_group" "alb_from_cloudfront" {
  name        = "${local.name}-alb-cloudfront-only"
  description = "Allow the Orbit ALB origin traffic only from CloudFront edge locations."
  vpc_id      = module.vpc.vpc_id

  ingress {
    description     = "CloudFront origin-facing managed prefix list"
    from_port       = 80
    to_port         = 80
    protocol        = "tcp"
    prefix_list_ids = [data.aws_ec2_managed_prefix_list.cloudfront_origin.id]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = local.tags
}

resource "aws_vpc_security_group_ingress_rule" "alb_to_app_pods" {
  security_group_id            = module.eks.node_security_group_id
  referenced_security_group_id = aws_security_group.alb_from_cloudfront.id
  description                  = "ALB application traffic to Orbit pods"
  ip_protocol                  = "tcp"
  from_port                    = 4000
  to_port                      = 4000
}

resource "aws_security_group" "rds" {
  name        = "${local.name}-postgres"
  description = "PostgreSQL is reachable only from EKS worker and pod networking."
  vpc_id      = module.vpc.vpc_id
  ingress {
    description     = "PostgreSQL from EKS worker security group"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [module.eks.node_security_group_id]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = local.tags
}

resource "aws_db_subnet_group" "postgres" {
  name       = "${local.name}-postgres"
  subnet_ids = module.vpc.private_subnets
  tags       = local.tags
}

resource "random_password" "postgres" {
  length  = 40
  special = false
}

resource "random_password" "jwt" {
  length  = 64
  special = false
}

resource "random_password" "grafana" {
  length  = 32
  special = false
}

resource "aws_db_instance" "postgres" {
  identifier                      = "${local.name}-postgres"
  engine                          = "postgres"
  engine_version                  = data.aws_rds_engine_version.postgres.version_actual
  instance_class                  = var.postgres_instance_class
  allocated_storage               = 20
  max_allocated_storage           = 100
  storage_type                    = "gp3"
  storage_encrypted               = true
  db_name                         = "orbit"
  username                        = "orbit_app"
  password                        = random_password.postgres.result
  port                            = 5432
  db_subnet_group_name            = aws_db_subnet_group.postgres.name
  vpc_security_group_ids          = [aws_security_group.rds.id]
  publicly_accessible             = false
  multi_az                        = var.postgres_multi_az
  backup_retention_period         = 7
  backup_window                   = "18:00-19:00"
  maintenance_window              = "sun:19:00-sun:20:00"
  auto_minor_version_upgrade      = true
  deletion_protection             = true
  copy_tags_to_snapshot           = true
  skip_final_snapshot             = false
  final_snapshot_identifier       = "${local.name}-postgres-final"
  performance_insights_enabled    = true
  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]
  apply_immediately               = false
  tags                            = local.tags
}

resource "aws_secretsmanager_secret" "app_runtime" {
  name                    = "${local.name}/runtime"
  description             = "Orbit app runtime configuration and database URL."
  recovery_window_in_days = 7
  tags                    = local.tags
}

resource "aws_secretsmanager_secret_version" "app_runtime" {
  secret_id = aws_secretsmanager_secret.app_runtime.id
  secret_string = jsonencode({
    DATABASE_URL        = "postgresql://orbit_app:${random_password.postgres.result}@${aws_db_instance.postgres.endpoint}/${aws_db_instance.postgres.db_name}?schema=public&sslmode=require"
    JWT_SECRET          = random_password.jwt.result
    APP_ORIGIN          = var.app_origin
    ORIGIN_VERIFY_TOKEN = random_password.origin_header.result
    GOOGLE_CLIENT_ID    = var.google_client_id
  })
}

resource "aws_secretsmanager_secret" "grafana" {
  name                    = "${local.name}/grafana"
  description             = "Private Grafana local administrator credentials."
  recovery_window_in_days = 7
  tags                    = local.tags
}

resource "aws_secretsmanager_secret_version" "grafana" {
  secret_id = aws_secretsmanager_secret.grafana.id
  secret_string = jsonencode({
    admin-user     = "orbit-admin"
    admin-password = random_password.grafana.result
  })
}

resource "aws_iam_openid_connect_provider" "github_actions" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = [local.github_thumbprint]
  tags            = local.tags
}

data "aws_iam_policy_document" "github_actions_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github_actions.arn]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.github_repository}:ref:refs/heads/main"]
    }
  }
}

resource "aws_iam_role" "github_deploy" {
  name               = "${local.name}-github-deploy"
  assume_role_policy = data.aws_iam_policy_document.github_actions_assume.json
  tags               = local.tags
}

data "aws_iam_policy_document" "github_ecr" {
  statement {
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }
  statement {
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:BatchGetImage",
      "ecr:CompleteLayerUpload",
      "ecr:DescribeImages",
      "ecr:InitiateLayerUpload",
      "ecr:PutImage",
      "ecr:UploadLayerPart"
    ]
    resources = [aws_ecr_repository.app.arn]
  }
}

resource "aws_iam_role_policy" "github_ecr" {
  name   = "push-orbit-ecr-image"
  role   = aws_iam_role.github_deploy.id
  policy = data.aws_iam_policy_document.github_ecr.json
}

data "aws_iam_policy_document" "service_account_assume" {
  for_each = {
    load_balancer = { namespace = "kube-system", service_account = "aws-load-balancer-controller" }
    secrets       = { namespace = "external-secrets", service_account = "external-secrets" }
    autoscaler    = { namespace = "kube-system", service_account = "cluster-autoscaler" }
    ebs_csi       = { namespace = "kube-system", service_account = "ebs-csi-controller-sa" }
  }

  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [module.eks.oidc_provider_arn]
    }
    condition {
      test     = "StringEquals"
      variable = "${module.eks.oidc_provider}:aud"
      values   = ["sts.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "${module.eks.oidc_provider}:sub"
      values   = ["system:serviceaccount:${each.value.namespace}:${each.value.service_account}"]
    }
  }
}

resource "aws_iam_role" "service_account" {
  for_each           = data.aws_iam_policy_document.service_account_assume
  name               = "${local.name}-${each.key}"
  assume_role_policy = each.value.json
  tags               = local.tags
}

resource "aws_iam_role_policy" "load_balancer_controller" {
  name   = "aws-load-balancer-controller"
  role   = aws_iam_role.service_account["load_balancer"].id
  policy = file("${path.module}/policies/aws-load-balancer-controller-v3.6.1.json")
}

data "aws_iam_policy_document" "external_secrets" {
  statement {
    actions = ["secretsmanager:DescribeSecret", "secretsmanager:GetSecretValue"]
    resources = [
      aws_secretsmanager_secret.app_runtime.arn,
      aws_secretsmanager_secret.grafana.arn
    ]
  }
}

resource "aws_iam_role_policy" "external_secrets" {
  name   = "read-orbit-runtime-secrets"
  role   = aws_iam_role.service_account["secrets"].id
  policy = data.aws_iam_policy_document.external_secrets.json
}

data "aws_iam_policy_document" "cluster_autoscaler" {
  statement {
    actions = [
      "autoscaling:DescribeAutoScalingGroups", "autoscaling:DescribeAutoScalingInstances",
      "autoscaling:DescribeLaunchConfigurations", "autoscaling:DescribeScalingActivities",
      "autoscaling:DescribeTags", "ec2:DescribeLaunchTemplateVersions"
    ]
    resources = ["*"]
  }
  statement {
    actions   = ["autoscaling:SetDesiredCapacity", "autoscaling:TerminateInstanceInAutoScalingGroup"]
    resources = ["arn:aws:autoscaling:${var.aws_region}:${data.aws_caller_identity.current.account_id}:autoScalingGroup:*:autoScalingGroupName/*"]
    condition {
      test     = "StringEquals"
      variable = "aws:ResourceTag/k8s.io/cluster-autoscaler/${local.name}"
      values   = ["owned"]
    }
  }
}

resource "aws_iam_role_policy" "cluster_autoscaler" {
  name   = "scale-orbit-managed-node-group"
  role   = aws_iam_role.service_account["autoscaler"].id
  policy = data.aws_iam_policy_document.cluster_autoscaler.json
}

resource "aws_iam_role_policy_attachment" "ebs_csi_driver" {
  role       = aws_iam_role.service_account["ebs_csi"].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonEBSCSIDriverPolicy"
}

data "aws_eks_addon_version" "ebs_csi_driver" {
  addon_name         = "aws-ebs-csi-driver"
  kubernetes_version = var.kubernetes_version
  most_recent        = true
}

resource "aws_eks_addon" "ebs_csi_driver" {
  cluster_name                = module.eks.cluster_name
  addon_name                  = "aws-ebs-csi-driver"
  addon_version               = data.aws_eks_addon_version.ebs_csi_driver.version
  service_account_role_arn    = aws_iam_role.service_account["ebs_csi"].arn
  resolve_conflicts_on_create = "OVERWRITE"
  resolve_conflicts_on_update = "PRESERVE"

  depends_on = [aws_iam_role_policy_attachment.ebs_csi_driver]
}

resource "aws_cloudfront_distribution" "app" {
  count = var.cloudfront_alb_dns_name == "" ? 0 : 1

  enabled             = true
  comment             = "Orbit Workspace HTTPS edge"
  default_root_object = "index.html"
  price_class         = "PriceClass_100"
  http_version        = "http2and3"

  origin {
    domain_name = var.cloudfront_alb_dns_name
    origin_id   = "orbit-eks-alb"
    custom_header {
      name  = "X-Origin-Verify"
      value = random_password.origin_header.result
    }
    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "http-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    target_origin_id         = "orbit-eks-alb"
    viewer_protocol_policy   = "redirect-to-https"
    allowed_methods          = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods           = ["GET", "HEAD"]
    cache_policy_id          = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad"
    origin_request_policy_id = "b689b0a8-53d0-40ab-baf2-68738e2966ac"
    compress                 = true
  }

  restrictions {
    geo_restriction { restriction_type = "none" }
  }

  viewer_certificate { cloudfront_default_certificate = true }

  tags = local.tags
}

resource "random_password" "origin_header" {
  length  = 48
  special = false
}
