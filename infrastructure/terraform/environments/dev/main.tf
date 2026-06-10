terraform {
  required_version = ">= 1.7.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket         = "lievant-terraform-state"
    key            = "lievant-admin/dev/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "lievant-terraform-locks"
  }
}

provider "aws" {
  region = "us-east-1"
}

variable "db_password" {
  type      = string
  sensitive = true
}

module "vpc" {
  source      = "../../modules/vpc"
  name_prefix = "lievant-admin-dev"
  environment = "dev"
}

module "rds" {
  source             = "../../modules/rds"
  name_prefix        = "lievant-admin-dev"
  environment        = "dev"
  vpc_id             = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnet_ids
  db_password        = var.db_password
}

module "s3" {
  source      = "../../modules/s3"
  name_prefix = "lievant-admin-dev"
  environment = "dev"
}

module "cognito" {
  source       = "../../modules/cognito"
  name_prefix  = "lievant-admin-dev"
  environment  = "dev"
  callback_url = "https://dev.system.lievant.com/api/auth/callback"

  microsoft_idp_enabled        = true
  microsoft_client_id          = "496101e4-23a2-4c35-9989-85800ea91eaa"
  azure_ad_tenant_id           = "b4d50261-e85a-4096-befe-b476ec7c0a21"
  microsoft_client_secret_name = "dev/cognito/microsoft-client-secret"
}

module "dynamodb" {
  source      = "../../modules/dynamodb"
  name_prefix = "lievant-admin-dev"
  environment = "dev"
}

output "db_endpoint" {
  value = module.rds.db_endpoint
}

output "cognito_pool_id" {
  value = module.cognito.user_pool_id
}

output "cognito_client_id" {
  value = module.cognito.client_id
}

output "datalake_bucket" {
  value = module.s3.datalake_bucket_name
}

output "audit_table" {
  value = module.dynamodb.audit_table_name
}
