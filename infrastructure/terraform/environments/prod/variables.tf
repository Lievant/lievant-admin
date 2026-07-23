variable "db_password" {
  description = "Password del usuario maestro del RDS de producción."
  type        = string
  sensitive   = true
}

variable "cognito_user_pool_id" {
  description = "User Pool ID de Cognito reutilizado en prod (mismo pool que dev/staging)."
  type        = string
}

variable "api_https_enabled" {
  description = <<-EOT
    Habilita el listener HTTPS (443) del ALB de la API. Debe ponerse en true
    SOLO después de que el certificado ACM (aws_acm_certificate.api) quede en
    estado ISSUED (tras crear los registros de validación DNS en el registrador
    de lievant-admin.com). En el primer apply se deja en false.
  EOT
  type        = bool
  default     = false
}
