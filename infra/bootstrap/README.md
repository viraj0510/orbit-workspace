# Terraform state bucket

Create the encrypted, versioned S3 bucket used by the platform Terraform state:

```sh
cd infra/bootstrap
terraform init
terraform apply -var='state_bucket_name=orbit-tfstate-REPLACE_WITH_UNIQUE_SUFFIX' -var='aws_region=ap-south-1'
```

Record the bucket name from the output. The bootstrap state is local; keep `terraform.tfstate` private and back it up securely. The bucket blocks public access, enables versioning, and expires noncurrent state versions after 90 days.
