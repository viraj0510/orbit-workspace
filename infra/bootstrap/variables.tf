variable "aws_region" {
  description = "AWS region where the Terraform state bucket will be stored."
  type        = string
  default     = "ap-south-1"
}

variable "state_bucket_name" {
  description = "Globally unique S3 bucket name for encrypted, versioned Terraform state."
  type        = string
  validation {
    condition     = can(regex("^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$", var.state_bucket_name))
    error_message = "Use a 3-63 character lowercase S3 bucket name."
  }
}

variable "tags" {
  description = "Tags applied to the Terraform state bucket."
  type        = map(string)
  default     = { Project = "orbit-workspace", ManagedBy = "terraform" }
}
