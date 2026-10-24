output "aws_region" { value = var.aws_region }
output "cluster_name" { value = module.eks.cluster_name }
output "cluster_endpoint" { value = module.eks.cluster_endpoint }
output "vpc_id" { value = module.vpc.vpc_id }
output "ecr_repository_url" { value = aws_ecr_repository.app.repository_url }
output "github_deploy_role_arn" { value = aws_iam_role.github_deploy.arn }
output "load_balancer_security_group_id" { value = aws_security_group.alb_from_cloudfront.id }
output "load_balancer_controller_role_arn" { value = aws_iam_role.service_account["load_balancer"].arn }
output "external_secrets_role_arn" { value = aws_iam_role.service_account["secrets"].arn }
output "cluster_autoscaler_role_arn" { value = aws_iam_role.service_account["autoscaler"].arn }
output "ebs_csi_driver_role_arn" { value = aws_iam_role.service_account["ebs_csi"].arn }
output "app_runtime_secret_arn" { value = aws_secretsmanager_secret.app_runtime.arn }
output "grafana_secret_arn" { value = aws_secretsmanager_secret.grafana.arn }
output "postgres_endpoint" { value = aws_db_instance.postgres.endpoint }
output "cloudfront_domain_name" {
  value = try(aws_cloudfront_distribution.app[0].domain_name, null)
}
output "kubeconfig_command" {
  value = "aws eks update-kubeconfig --region ${var.aws_region} --name ${module.eks.cluster_name}"
}
