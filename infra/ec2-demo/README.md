# Orbit single-instance AWS demo

This path runs Orbit on one small EC2 instance with SQLite persisted on an encrypted EBS volume. GitHub Actions uses OIDC to publish immutable images to ECR and deploy through AWS Systems Manager. CloudFront provides the default HTTPS hostname and is the only network path to the app port. Runtime secrets are held in a standard SSM SecureString parameter.

This is a low-cost portfolio/demo shape, not a highly available production platform. It has one instance and one local database; it has no EKS, RDS, NAT Gateway, load balancer, Prometheus, or Grafana. AWS Free Tier eligibility depends on your account plan, account age, region, and usage. ECR, CloudFront, public IPv4, EBS, data transfer, and other resources can still incur charges if they are outside your account's included offers. Review Billing and the Terraform plan before applying.

The CloudFront hostname encrypts visitor-to-edge traffic; the origin connection from CloudFront to EC2 uses HTTP because this demo has no owned domain or origin certificate. Use only dedicated demo accounts and non-sensitive data. Add an owned domain and HTTPS origin before using this architecture for real users.

## 1. Check the account and install tools

In AWS Billing, check the account plan, remaining credits/Free Tier usage, and any budget alerts. The defaults use `t3.micro` and 16 GiB `gp3`, but those resource sizes are not a guarantee of $0 cost for every account.

On macOS:

```sh
brew install awscli terraform
aws configure sso
aws sso login
aws sts get-caller-identity
terraform version
```

## 2. Push the code to GitHub

Create a GitHub repository, add its remote, and push the `main` branch. The repository URL is required because the AWS OIDC trust policy allows only that exact repository and branch.

## 3. Configure Terraform

From the repository root:

```sh
cp infra/ec2-demo/terraform.tfvars.example infra/ec2-demo/terraform.tfvars
```

Edit `infra/ec2-demo/terraform.tfvars`:

- Set `github_repository` to `OWNER/REPOSITORY`.
- Set `seed_admin_email` and a unique `seed_admin_password`.
- Set `google_client_id` if you want Google sign-in; email/password sign-in works without it.
- Confirm `aws_region` and `instance_type` are included in your account's offer.

The ignored `terraform.tfvars` file and Terraform state contain sensitive values. Do not commit them or share the state file.

Initialize, inspect, and apply only after reviewing the plan:

```sh
terraform -chdir=infra/ec2-demo init
terraform -chdir=infra/ec2-demo fmt -check
terraform -chdir=infra/ec2-demo validate
terraform -chdir=infra/ec2-demo plan
terraform -chdir=infra/ec2-demo apply
```

Terraform creates one VPC/subnet/Internet Gateway, one EC2 instance, one ECR repository, IAM roles, one SSM parameter, and one CloudFront distribution. CloudFront may take several minutes to finish provisioning.

## 4. Configure GitHub Actions

After Terraform applies, copy these outputs into GitHub repository **Variables** under Settings → Secrets and variables → Actions:

| Repository variable | Terraform output |
| --- | --- |
| `AWS_REGION` | `aws_region` |
| `AWS_ROLE_TO_ASSUME` | `github_deploy_role_arn` |
| `EC2_INSTANCE_ID` | `instance_id` |
| `ECR_REPOSITORY` | `ecr_repository_url` |
| `VITE_GOOGLE_CLIENT_ID` | The same OAuth client ID as `google_client_id`, or leave unset for email/password only |

The image repository uses immutable `sha-...` tags and keeps the latest five. The deploy job stays skipped until `AWS_ROLE_TO_ASSUME` is configured. Once Terraform is applied and all repository variables are set, manually run the workflow once from Actions to publish the first image; later pushes to `main` deploy automatically. The workflow blocks deployment on fixable critical/high vulnerability findings.

The Terraform stack creates a GitHub Actions OIDC provider by default. If your AWS account already has a provider for `https://token.actions.githubusercontent.com`, set `create_github_oidc_provider = false` in `terraform.tfvars`; Terraform will reference the existing account-level provider instead of creating a duplicate.

If Google sign-in is enabled, add the Terraform `cloudfront_url` as an authorized JavaScript origin in the Google OAuth client. Use the same client ID in Terraform's `google_client_id` and the GitHub variable `VITE_GOOGLE_CLIENT_ID`; if you change it after applying, update the SSM parameter and GitHub variable, then deploy again. Google's production OAuth review may require a domain you control and verify; email/password sign-in works with the CloudFront hostname.

## 5. Open the demo and monitor it

Use the `cloudfront_url` output. Sign in with the administrator email/password configured in Terraform; the password is not printed by Terraform output. The health endpoint is available at `/api/health`.

Use Session Manager rather than opening SSH to inspect the instance:

```sh
aws ssm start-session --target INSTANCE_ID --region AWS_REGION
sudo docker ps
sudo docker logs --tail 100 orbit-workspace
```

## 6. Remove demo resources when finished

Terraform protects the local SQLite data only while the instance exists. Destroying this stack deletes the instance and database, ECR images, SSM parameter, CloudFront distribution, VPC, and IAM resources:

```sh
terraform -chdir=infra/ec2-demo destroy
```

Keep the Terraform state until destroy succeeds. Check AWS Billing after cleanup for any remaining resources or usage.

If you stop and start the EC2 instance to reduce usage, its public DNS can change and CloudFront may keep the old origin hostname. Run Terraform plan/apply to refresh the origin after restarting the instance.
