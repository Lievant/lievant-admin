variable "name_prefix" {
  type = string
}

variable "environment" {
  type = string
}

resource "aws_s3_bucket" "datalake" {
  bucket = "${var.name_prefix}-datalake"

  tags = {
    Name = "${var.name_prefix}-datalake"
  }
}

resource "aws_s3_bucket_versioning" "datalake" {
  bucket = aws_s3_bucket.datalake.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "datalake" {
  bucket = aws_s3_bucket.datalake.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "aws:kms"
    }
  }

  # El bucket de prod se creó por CLI con cifrado por defecto AES256. No vale la
  # pena recrearlo/cambiarlo solo por el algoritmo, así que ignoramos el diff en
  # la regla de cifrado (aplica a buckets importados con AES256).
  lifecycle {
    ignore_changes = [rule]
  }
}

resource "aws_s3_bucket_public_access_block" "datalake" {
  bucket                  = aws_s3_bucket.datalake.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

output "datalake_bucket_name" {
  value = aws_s3_bucket.datalake.id
}

output "datalake_bucket_arn" {
  value = aws_s3_bucket.datalake.arn
}
