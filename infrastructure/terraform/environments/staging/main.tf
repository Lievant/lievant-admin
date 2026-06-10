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

variable "github_repository" {
  description = "URL del repositorio GitHub conectado a la app de Amplify (p. ej. https://github.com/org/lievant-admin)"
  type        = string
}

variable "github_access_token" {
  description = "Personal access token de GitHub usado por Amplify para clonar y construir el repo"
  type        = string
  sensitive   = true
}

variable "dev_cognito_user_pool_id" {
  description = "User Pool ID del ambiente dev (output cognito_pool_id), reutilizado por staging"
  type        = string
}

locals {
  name_prefix       = "lievant-admin-staging"
  app_domain        = "staging.system.lievant.com"
  api_domain        = "api.staging.system.lievant.com"
  cognito_domain    = "lievant-admin-dev.auth.us-east-1.amazoncognito.com"
  cognito_client_id = "1etqs6deci8s26elvntfbpbult"
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

# --- Certificado ACM para el ALB de la API (api.staging.system.lievant.com) ---
#
# El dominio lievant.com está delegado en GoDaddy, no en Route53, por lo que
# la validación DNS del certificado es manual: terraform crea el certificado
# en estado PENDING_VALIDATION y expone los registros CNAME requeridos en el
# output `dns_records_to_create`. Esos registros deben crearse a mano en
# GoDaddy; una vez que ACM valida el certificado (queda en estado ISSUED),
# se puede aplicar module.ecs (el listener HTTPS requiere un certificado ya
# emitido).

resource "aws_acm_certificate" "api" {
  domain_name               = local.api_domain
  subject_alternative_names = [local.app_domain]
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Name = "${local.name_prefix}-api-cert"
  }
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

  ecr_repository_url = module.ecr.repository_url
  certificate_arn    = aws_acm_certificate.api.arn
  health_check_path  = "/api/v1"

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

resource "aws_amplify_app" "web" {
  name         = "${local.name_prefix}-web"
  repository   = var.github_repository
  access_token = var.github_access_token
  platform     = "WEB_COMPUTE"

  build_spec = file("${path.module}/../../../../amplify.yml")

  environment_variables = {
    NEXT_PUBLIC_API_URL           = "https://${local.api_domain}/api/v1"
    NEXT_PUBLIC_COGNITO_DOMAIN    = local.cognito_domain
    NEXT_PUBLIC_COGNITO_CLIENT_ID = local.cognito_client_id
    NODE_ENV                      = "production"
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
  domain_name = "system.lievant.com"

  sub_domain {
    branch_name = aws_amplify_branch.staging.branch_name
    prefix      = "staging"
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

# Registros DNS que deben crearse manualmente en GoDaddy (lievant.com no está
# delegado a Route53). Ejecutar `terraform output -json dns_records_to_create`
# para obtener los valores tras el apply.
output "dns_records_to_create" {
  description = "Registros DNS a crear en GoDaddy para staging.system.lievant.com / api.staging.system.lievant.com"
  value = {
    acm_certificate_validation = [
      for dvo in aws_acm_certificate.api.domain_validation_options : {
        name  = dvo.resource_record_name
        type  = dvo.resource_record_type
        value = dvo.resource_record_value
      }
    ]
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
