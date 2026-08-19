variable "name_prefix" {
  type = string
}

variable "environment" {
  type = string
}

# Orígenes desde los que el navegador puede hacer PUT a las URLs prefirmadas.
# Debe incluir el dominio de la app del ambiente y localhost para desarrollo.
variable "upload_allowed_origins" {
  type        = list(string)
  description = "Orígenes permitidos para el upload directo a S3 (CORS)."
  default     = ["http://localhost:3000"]
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

# El navegador sube los documentos directo a S3 con una URL prefirmada (PUT), sin
# pasar por la compute de Amplify, que es la capa que corta los requests grandes.
# Sin esta configuración el preflight OPTIONS falla y el PUT nunca sale: es
# requisito para que funcione el upload de documentos, no una optimización.
#
# Solo PUT y GET, y solo desde los orígenes de la app: una allowlist con "*"
# permitiría que cualquier página use las URLs prefirmadas de un usuario logueado.
resource "aws_s3_bucket_cors_configuration" "datalake" {
  bucket = aws_s3_bucket.datalake.id

  cors_rule {
    allowed_methods = ["PUT", "GET"]
    allowed_origins = var.upload_allowed_origins
    allowed_headers = ["content-type"]
    # El navegador necesita leer ETag para confirmar la subida.
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
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
