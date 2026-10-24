output "aws_region" {
  value = var.aws_region
}

output "instance_id" {
  value = aws_instance.app.id
}

output "instance_type" {
  value = aws_instance.app.instance_type
}

output "cloudfront_url" {
  value = "https://${aws_cloudfront_distribution.app.domain_name}"
}

output "cloudfront_domain_name" {
  value = aws_cloudfront_distribution.app.domain_name
}

output "ecr_repository_url" {
  value = aws_ecr_repository.app.repository_url
}

output "github_deploy_role_arn" {
  value = aws_iam_role.github_deploy.arn
}

output "ssm_runtime_parameter_name" {
  value = aws_ssm_parameter.runtime.name
}
