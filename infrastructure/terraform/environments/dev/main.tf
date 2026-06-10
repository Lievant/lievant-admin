terraform {
  required_version = ">= 1.7.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
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

  # Staging reutiliza este User Pool/Client, por lo que necesita poder
  # completar el flujo OAuth contra su propio dominio.
  additional_callback_urls = ["https://staging.system.lievant.com/api/auth/callback"]
  additional_logout_urls   = ["https://staging.system.lievant.com"]

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

module "ecr" {
  source      = "../../modules/ecr"
  name_prefix = "lievant-admin-dev"
  environment = "dev"
}

# --- Secrets Manager: credenciales de la API en ECS ---

resource "aws_secretsmanager_secret" "database_url" {
  name = "dev/api/database-url"
}

resource "aws_secretsmanager_secret_version" "database_url" {
  secret_id     = aws_secretsmanager_secret.database_url.id
  secret_string = "postgresql://lievant_admin:${var.db_password}@${module.rds.db_endpoint}/${module.rds.db_name}"
}

resource "random_password" "jwt_secret" {
  length  = 64
  special = false
}

resource "aws_secretsmanager_secret" "jwt_secret" {
  name = "dev/api/jwt-secret"
}

resource "aws_secretsmanager_secret_version" "jwt_secret" {
  secret_id     = aws_secretsmanager_secret.jwt_secret.id
  secret_string = random_password.jwt_secret.result
}

# --- ECS Fargate: API NestJS (sin certificado -> ALB solo HTTP) ---

module "ecs" {
  source = "../../modules/ecs"

  name_prefix       = "lievant-admin-dev"
  environment       = "dev"
  vpc_id            = module.vpc.vpc_id
  public_subnet_ids = module.vpc.public_subnet_ids

  ecr_repository_url = module.ecr.repository_url
  certificate_arn    = ""
  health_check_path  = "/api/v1"

  environment_variables = {
    NODE_ENV             = "production"
    PORT                 = "3001"
    DATABASE_SCHEMA      = "auth"
    NEXT_PUBLIC_APP_URL  = "https://dev.system.lievant.com"
    AWS_REGION           = "us-east-1"
    COGNITO_USER_POOL_ID = module.cognito.user_pool_id
    COGNITO_CLIENT_ID    = module.cognito.client_id
    COGNITO_DOMAIN       = module.cognito.cognito_domain
  }

  secrets = {
    DATABASE_URL = aws_secretsmanager_secret_version.database_url.arn
    JWT_SECRET   = aws_secretsmanager_secret_version.jwt_secret.arn
  }
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

output "ecr_repo_url" {
  value = module.ecr.repository_url
}

output "alb_dns_name" {
  value = module.ecs.alb_dns_name
}
