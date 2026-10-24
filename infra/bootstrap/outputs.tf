output "state_bucket_name" {
  description = "Use this bucket in infra/terraform/backend.hcl."
  value       = aws_s3_bucket.terraform_state.bucket
}

output "state_bucket_region" {
  value = var.aws_region
}
