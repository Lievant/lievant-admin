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
    key            = "lievant-admin/prod/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "lievant-terraform-locks"
  }
}

provider "aws" {
  region = "us-east-1"
}

locals {
  name_prefix = "lievant-admin-prod"

  # Dominio de producción: lievant-admin.com (distinto de staging, que usa
  # system.lievant.com). No hay colisión de Amplify domain association.
  app_domain = "lievant-admin.com"
  api_domain = "api.lievant-admin.com"

  # Cognito reutilizado (mismo User Pool que dev/staging). Ver data source abajo.
  cognito_domain    = "lievant-admin-dev.auth.us-east-1.amazoncognito.com"
  cognito_client_id = "1etqs6deci8s26elvntfbpbult"
}

# --- Cognito existente (reutilizado, NO se crea) ---
data "aws_cognito_user_pool" "main" {
  user_pool_id = var.cognito_user_pool_id
}

# --- Secrets externos ya creados por CLI (no se gestionan aquí, solo se referencian) ---
# Sus VALORES no viven en Terraform; solo se inyectan por ARN al task definition.
data "aws_secretsmanager_secret" "microsoft_client_secret" {
  name = "prod/api/microsoft-client-secret"
}

data "aws_secretsmanager_secret" "openai_api_key" {
  name = "prod/api/openai-api-key"
}

data "aws_secretsmanager_secret" "anthropic_api_key" {
  name = "prod/api/anthropic-api-key"
}

module "vpc" {
  source      = "../../modules/vpc"
  name_prefix = local.name_prefix
  environment = "prod"
}

module "rds" {
  source             = "../../modules/rds"
  name_prefix        = local.name_prefix
  environment        = "prod"
  vpc_id             = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnet_ids
  db_password        = var.db_password

  # Override de sizing (decisión: mínimo de costo), manteniendo protecciones de prod.
  instance_class          = "db.t3.micro"
  multi_az                = false
  allocated_storage       = 20
  deletion_protection     = true
  backup_retention_period = 7
  skip_final_snapshot     = false
}

module "s3" {
  source      = "../../modules/s3"
  name_prefix = local.name_prefix
  environment = "prod"

  # Requisito del upload directo a S3 vía URL prefirmada.
  upload_allowed_origins = ["https://${local.app_domain}"]
}

module "dynamodb" {
  source      = "../../modules/dynamodb"
  name_prefix = local.name_prefix
  environment = "prod"
}

module "ecr" {
  source      = "../../modules/ecr"
  name_prefix = local.name_prefix
  environment = "prod"
}

# --- Certificado ACM para el ALB de la API (api.lievant-admin.com) ---
# lievant-admin.com no está en Route53 → validación DNS manual (ver output
# dns_records_to_create). El listener HTTPS se habilita con var.api_https_enabled
# = true una vez que el certificado quede en estado ISSUED.
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
  name = "prod/api/database-url"
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
  name = "prod/api/jwt-secret"
}

resource "aws_secretsmanager_secret_version" "jwt_secret" {
  secret_id     = aws_secretsmanager_secret.jwt_secret.id
  secret_string = random_password.jwt_secret.result
}

# --- ECS Fargate: API NestJS ---
module "ecs" {
  source = "../../modules/ecs"

  name_prefix       = local.name_prefix
  environment       = "prod"
  vpc_id            = module.vpc.vpc_id
  public_subnet_ids = module.vpc.public_subnet_ids

  ecr_repository_url = module.ecr.repository_url

  # Subido desde 256/512 tras el diagnóstico de Reserva de Salas: con ~118
  # usuarios activos el proceso Node se serializaba en picos (85% de CPU sobre
  # 0.25 vCPU) aunque las queries corrían en menos de 1 ms.
  cpu    = 512
  memory = 1024

  # Dos tasks detrás del ALB. El pool va fijado a 5 conexiones por task
  # (app.module.ts), así que el techo son 10 de las 81 del db.t3.micro.
  desired_count = 2

  # HTTPS en dos fases: false en el primer apply (cert PENDING_VALIDATION),
  # true tras validar DNS y que ACM quede ISSUED.
  https_listener_enabled = var.api_https_enabled
  certificate_arn        = aws_acm_certificate.api.arn
  health_check_path      = "/api/v1"

  environment_variables = {
    NODE_ENV             = "production"
    PORT                 = "3001"
    DATABASE_SCHEMA      = "auth"
    NEXT_PUBLIC_APP_URL  = "https://${local.app_domain}"
    AWS_REGION           = "us-east-1"
    COGNITO_USER_POOL_ID = data.aws_cognito_user_pool.main.id
    COGNITO_CLIENT_ID    = local.cognito_client_id
    COGNITO_DOMAIN       = local.cognito_domain
    S3_BUCKET            = module.s3.datalake_bucket_name

    # Config no-secreta requerida por el API (auth M365 / Graph). En staging
    # estaban añadidas a mano al task def; aquí las dejamos declaradas en IaC.
    JWT_EXPIRY          = "1h"
    AZURE_AD_TENANT_ID  = "b4d50261-e85a-4096-befe-b476ec7c0a21"
    MICROSOFT_CLIENT_ID = "496101e4-23a2-4c35-9989-85800ea91eaa"
  }

  secrets = {
    DATABASE_URL            = aws_secretsmanager_secret_version.database_url.arn
    JWT_SECRET              = aws_secretsmanager_secret_version.jwt_secret.arn
    MICROSOFT_CLIENT_SECRET = data.aws_secretsmanager_secret.microsoft_client_secret.arn
    OPENAI_API_KEY          = data.aws_secretsmanager_secret.openai_api_key.arn
    ANTHROPIC_API_KEY       = data.aws_secretsmanager_secret.anthropic_api_key.arn
  }
}

# NOTA: la app de AWS Amplify (frontend) se gestiona MANUALMENTE por consola
# (Hosting > Connect repository con la GitHub App), NO por Terraform. Por eso no
# hay recursos aws_amplify_* aquí. Ver app prod creada en la consola de Amplify.
