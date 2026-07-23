variable "name_prefix" {
  type = string
}

variable "environment" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "private_subnet_ids" {
  type = list(string)
}

variable "db_password" {
  type      = string
  sensitive = true
}

# Overrides opcionales. Si se dejan en null, se mantiene el comportamiento
# original por-entorno (retrocompatible con staging/dev, que no los pasan).
variable "instance_class" {
  type    = string
  default = null
}

variable "multi_az" {
  type    = bool
  default = null
}

variable "allocated_storage" {
  type    = number
  default = null
}

variable "deletion_protection" {
  type    = bool
  default = null
}

variable "backup_retention_period" {
  type    = number
  default = null
}

variable "skip_final_snapshot" {
  type    = bool
  default = null
}

locals {
  instance_class          = var.instance_class != null ? var.instance_class : (var.environment == "prod" ? "db.r6g.large" : "db.t3.micro")
  multi_az                = var.multi_az != null ? var.multi_az : (var.environment == "prod")
  allocated_storage       = var.allocated_storage != null ? var.allocated_storage : (var.environment == "prod" ? 100 : 20)
  deletion_protection     = var.deletion_protection != null ? var.deletion_protection : (var.environment == "prod")
  skip_final_snapshot     = var.skip_final_snapshot != null ? var.skip_final_snapshot : (var.environment != "prod")
  backup_retention_period = var.backup_retention_period != null ? var.backup_retention_period : (var.environment == "prod" ? 7 : 1)
}

resource "aws_db_subnet_group" "main" {
  name       = "${var.name_prefix}-db-subnet"
  subnet_ids = var.private_subnet_ids
}

resource "aws_security_group" "rds" {
  name   = "${var.name_prefix}-rds-sg"
  vpc_id = var.vpc_id

  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/16"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_db_instance" "main" {
  identifier        = "${var.name_prefix}-postgres"
  engine            = "postgres"
  engine_version    = "16"
  instance_class    = local.instance_class
  allocated_storage = local.allocated_storage
  storage_encrypted = true

  db_name  = "lievant_dev"
  username = "lievant_admin"
  password = var.db_password

  db_subnet_group_name    = aws_db_subnet_group.main.name
  vpc_security_group_ids  = [aws_security_group.rds.id]
  multi_az                = local.multi_az
  publicly_accessible     = false
  deletion_protection     = local.deletion_protection
  skip_final_snapshot     = local.skip_final_snapshot
  backup_retention_period = local.backup_retention_period

  tags = {
    Name = "${var.name_prefix}-postgres"
  }
}

output "db_endpoint" {
  value = aws_db_instance.main.endpoint
}

output "db_name" {
  value = aws_db_instance.main.db_name
}
