variable "aws_region" {
  description = "AWS region for the single-instance demo. Confirm Free Tier eligibility in this region first."
  type        = string
  default     = "ap-south-1"
}

variable "environment" {
  description = "Short name used for the demo resources."
  type        = string
  default     = "demo"
  validation {
    condition     = can(regex("^[a-z0-9-]{2,20}$", var.environment))
    error_message = "Environment must be 2-20 lowercase letters, numbers, or hyphens."
  }
}

variable "github_repository" {
  description = "GitHub repository allowed to publish and deploy, in owner/name format."
  type        = string
  validation {
    condition     = can(regex("^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$", var.github_repository)) && !startswith(lower(var.github_repository), "your_")
    error_message = "Set github_repository to the GitHub owner/repository name."
  }
}

variable "create_github_oidc_provider" {
  description = "Create the GitHub Actions OIDC provider if one is not already present in the AWS account."
  type        = bool
  default     = true
}

variable "instance_type" {
  description = "Small EC2 instance type. Free Tier eligibility depends on account age, plan, region, and usage."
  type        = string
  default     = "t3.micro"
}

variable "google_client_id" {
  description = "Google OAuth web client ID. Leave blank to run email/password sign-in only."
  type        = string
  default     = ""
}

variable "seed_admin_email" {
  description = "Initial administrator email address."
  type        = string
  sensitive   = true
  validation {
    condition     = can(regex("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$", var.seed_admin_email)) && var.seed_admin_email != "your-email@example.com"
    error_message = "Provide a valid administrator email address."
  }
}

variable "seed_admin_password" {
  description = "Initial administrator password; use at least 16 random characters."
  type        = string
  sensitive   = true
  validation {
    condition     = length(var.seed_admin_password) >= 16 && !can(regex("\\s", var.seed_admin_password)) && !startswith(var.seed_admin_password, "REPLACE_")
    error_message = "Use a password of at least 16 characters with no whitespace."
  }
}
