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
    key            = "lievant-admin/staging/terraform.tfstate"
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

variable "dev_cognito_user_pool_id" {
  description = "User Pool ID del ambiente dev (output cognito_pool_id), reutilizado por staging"
  type        = string
}

locals {
  name_prefix       = "lievant-admin-staging"
  app_domain        = "lievant-admin-staging.siocore.ai"
  api_domain        = "api.lievant-admin-staging.siocore.ai"
  cognito_domain    = "lievant-admin-dev.auth.us-east-1.amazoncognito.com"
  cognito_client_id = "1etqs6deci8s26elvntfbpbult"

  # Certificado ACM solicitado manualmente (fuera de Terraform, vía AWS CLI)
  # para el dominio temporal siocore.ai. Ya está ISSUED, por lo que el
  # listener HTTPS del ALB se habilita directamente sin esperar validación.
  api_certificate_arn    = "arn:aws:acm:us-east-1:966001266524:certificate/7117a66f-5e6c-46ef-999d-63278b9209d8"
  api_certificate_issued = true
}

module "vpc" {
  source      = "../../modules/vpc"
  name_prefix = local.name_prefix
  environment = "staging"
}

module "rds" {
  source             = "../../modules/rds"
  name_prefix        = local.name_prefix
  environment        = "staging"
  vpc_id             = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnet_ids
  db_password        = var.db_password
}

module "s3" {
  source      = "../../modules/s3"
  name_prefix = local.name_prefix
  environment = "staging"
}

module "dynamodb" {
  source      = "../../modules/dynamodb"
  name_prefix = local.name_prefix
  environment = "staging"
}

module "ecr" {
  source      = "../../modules/ecr"
  name_prefix = local.name_prefix
  environment = "staging"
}

# --- Secrets Manager: credenciales de la API en ECS ---

resource "aws_secretsmanager_secret" "database_url" {
  name = "staging/api/database-url"
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
  name = "staging/api/jwt-secret"
}

resource "aws_secretsmanager_secret_version" "jwt_secret" {
  secret_id     = aws_secretsmanager_secret.jwt_secret.id
  secret_string = random_password.jwt_secret.result
}

# --- ECS Fargate: API NestJS ---

module "ecs" {
  source = "../../modules/ecs"

  name_prefix       = local.name_prefix
  environment       = "staging"
  vpc_id            = module.vpc.vpc_id
  public_subnet_ids = module.vpc.public_subnet_ids

  ecr_repository_url     = module.ecr.repository_url
  https_listener_enabled = local.api_certificate_issued
  certificate_arn        = local.api_certificate_arn
  health_check_path      = "/api/v1"

  environment_variables = {
    NODE_ENV             = "production"
    PORT                 = "3001"
    DATABASE_SCHEMA      = "auth"
    NEXT_PUBLIC_APP_URL  = "https://${local.app_domain}"
    AWS_REGION           = "us-east-1"
    COGNITO_USER_POOL_ID = var.dev_cognito_user_pool_id
    COGNITO_CLIENT_ID    = local.cognito_client_id
    COGNITO_DOMAIN       = local.cognito_domain
  }

  secrets = {
    DATABASE_URL = aws_secretsmanager_secret_version.database_url.arn
    JWT_SECRET   = aws_secretsmanager_secret_version.jwt_secret.arn
  }
}

# --- AWS Amplify: Frontend Next.js (apps/web) ---

data "aws_secretsmanager_secret_version" "github_token" {
  secret_id = "staging/github/amplify-token"
}

resource "aws_amplify_app" "web" {
  name     = "${local.name_prefix}-web"
  platform = "WEB_COMPUTE"

  repository   = "https://github.com/Lievant/lievant-admin"
  access_token = data.aws_secretsmanager_secret_version.github_token.secret_string

  build_spec = file("${path.module}/../../../../amplify.yml")

  environment_variables = {
    NEXT_PUBLIC_API_URL           = "https://${local.api_domain}/api/v1"
    NEXT_PUBLIC_COGNITO_DOMAIN    = local.cognito_domain
    NEXT_PUBLIC_COGNITO_CLIENT_ID = local.cognito_client_id
    NODE_ENV                      = "production"
    AMPLIFY_MONOREPO_APP_ROOT     = "apps/web"
  }

  tags = {
    Name = "${local.name_prefix}-web"
  }
}

resource "aws_amplify_branch" "staging" {
  app_id      = aws_amplify_app.web.id
  branch_name = "staging"
  framework   = "Next.js - SSR"
  stage       = "DEVELOPMENT"

  enable_auto_build = true
}

resource "aws_amplify_domain_association" "web" {
  app_id      = aws_amplify_app.web.id
  domain_name = "siocore.ai"

  # siocore.ai (dominio temporal de staging): la verificacion DNS del dominio
  # se hace a mano (ver dns_records_to_create). No bloquear el apply esperando
  # a que Amplify la detecte.
  wait_for_verification = false

  sub_domain {
    branch_name = aws_amplify_branch.staging.branch_name
    prefix      = "lievant-admin-staging"
  }
}

# --- Outputs ---

output "amplify_url" {
  value = "https://${local.app_domain}"
}

output "ecr_repo_url" {
  value = module.ecr.repository_url
}

output "alb_dns_name" {
  value = module.ecs.alb_dns_name
}

output "db_endpoint" {
  value = module.rds.db_endpoint
}

output "datalake_bucket" {
  value = module.s3.datalake_bucket_name
}

output "audit_table" {
  value = module.dynamodb.audit_table_name
}

# Registros DNS que deben crearse manualmente donde esté delegado siocore.ai.
# El certificado ACM del ALB ya fue solicitado y validado manualmente (ver
# local.api_certificate_arn), por lo que aquí solo quedan los registros de
# Amplify. Ejecutar `terraform output -json dns_records_to_create` para
# obtener los valores tras el apply.
output "dns_records_to_create" {
  description = "Registros DNS a crear para lievant-admin-staging.siocore.ai / api.lievant-admin-staging.siocore.ai"
  value = {
    api_alb = {
      name  = local.api_domain
      type  = "CNAME"
      value = module.ecs.alb_dns_name
    }
    amplify_certificate_verification = aws_amplify_domain_association.web.certificate_verification_dns_record
    amplify_subdomains = [
      for sd in aws_amplify_domain_association.web.sub_domain : sd.dns_record
    ]
  }
}
