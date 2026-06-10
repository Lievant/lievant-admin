# ═══════════════════════════════════════════════════════════════
# LIEVANT ADMIN — Terraform Root
# Region: us-east-1 (N. Virginia)
# Owner: Paulo Ossa (root AWS)
# ═══════════════════════════════════════════════════════════════

terraform {
  required_version = ">= 1.7.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  # Estado remoto — crear bucket lievant-terraform-state manualmente primero
  backend "s3" {
    bucket         = "lievant-terraform-state"
    key            = "lievant-admin/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "lievant-terraform-locks"
  }
}

provider "aws" {
  region = var.aws_region
  default_tags {
    tags = {
      Project     = "lievant-admin"
      Environment = var.environment
      ManagedBy   = "terraform"
      Owner       = "transformacion-digital"
    }
  }
}

variable "aws_region"   { type = string; default = "us-east-1" }
variable "environment"  { type = string }
variable "domain_name"  { type = string; default = "lievant.com" }
variable "db_password"  { type = string; sensitive = true }

locals {
  app_name    = "lievant-admin"
  app_domain  = var.environment == "prod" ? "system.${var.domain_name}" : "${var.environment}.system.${var.domain_name}"
  name_prefix = "${local.app_name}-${var.environment}"
}

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}
