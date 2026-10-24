terraform {
  required_version = ">= 1.10.0"

  backend "s3" {
    key          = "orbit-workspace/platform/terraform.tfstate"
    encrypt      = true
    use_lockfile = true
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 6.69, < 7.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
  default_tags {
    tags = {
      Project     = "orbit-workspace"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

provider "tls" {}
