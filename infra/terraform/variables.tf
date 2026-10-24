variable "aws_region" {
  description = "AWS region for the EKS platform."
  type        = string
  default     = "ap-south-1"
}

variable "environment" {
  description = "Deployment environment name."
  type        = string
  default     = "production"
  validation {
    condition     = can(regex("^[a-z0-9-]{2,20}$", var.environment))
    error_message = "Environment must be 2-20 lowercase letters, numbers, or hyphens."
  }
}

variable "github_repository" {
  description = "GitHub repository allowed to deploy, in owner/name format."
  type        = string
  validation {
    condition     = can(regex("^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$", var.github_repository))
    error_message = "Set github_repository to the GitHub owner/repository name."
  }
}

variable "cluster_admin_cidrs" {
  description = "Public IPv4 CIDR ranges allowed to reach the EKS Kubernetes API. Use your current IP with /32."
  type        = list(string)
  validation {
    condition     = length(var.cluster_admin_cidrs) > 0 && alltrue([for cidr in var.cluster_admin_cidrs : can(cidrhost(cidr, 0))])
    error_message = "Provide at least one valid, narrow CIDR; do not use 0.0.0.0/0."
  }
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC."
  type        = string
  default     = "10.40.0.0/16"
}

variable "kubernetes_version" {
  description = "EKS Kubernetes control plane version."
  type        = string
  default     = "1.34"
}

variable "node_instance_type" {
  description = "EC2 instance type for the EKS managed node group."
  type        = string
  default     = "t3.large"
}

variable "node_min_size" {
  description = "Minimum worker node count."
  type        = number
  default     = 2
}

variable "node_max_size" {
  description = "Maximum worker node count."
  type        = number
  default     = 4
}

variable "postgres_instance_class" {
  description = "RDS PostgreSQL instance class."
  type        = string
  default     = "db.t4g.micro"
}

variable "postgres_multi_az" {
  description = "Enable a standby database in a second Availability Zone."
  type        = bool
  default     = false
}

variable "app_origin" {
  description = "Browser-facing HTTPS origin. Set to the CloudFront URL after the edge distribution is created."
  type        = string
  default     = "https://localhost"
  validation {
    condition     = can(regex("^https://[^/]+$", var.app_origin))
    error_message = "app_origin must be an HTTPS origin without a path."
  }
}

variable "google_client_id" {
  description = "Google OAuth web client ID. Google sign-in requires a verified domain you control."
  type        = string
  default     = ""
}

variable "cloudfront_alb_dns_name" {
  description = "ALB DNS name from the app Ingress. Leave empty on the first apply; set after the Ingress exists."
  type        = string
  default     = ""
}
