variable "name_prefix" {
  type = string
}

variable "environment" {
  type = string
}

variable "callback_url" {
  type = string
}

variable "additional_callback_urls" {
  description = "Callback URLs adicionales para el cliente web (p. ej. ambientes que reutilizan este User Pool)"
  type        = list(string)
  default     = []
}

variable "additional_logout_urls" {
  description = "Logout URLs adicionales para el cliente web (p. ej. ambientes que reutilizan este User Pool)"
  type        = list(string)
  default     = []
}

variable "microsoft_idp_enabled" {
  description = "Habilita el Identity Provider OIDC de Microsoft Entra (Azure AD) en el User Pool"
  type        = bool
  default     = false
}

variable "microsoft_client_id" {
  description = "Application (client) ID de la app registration en Microsoft Entra usada como IdP"
  type        = string
  default     = ""
}

variable "azure_ad_tenant_id" {
  description = "Directory (tenant) ID de Microsoft Entra usado para construir el OIDC issuer"
  type        = string
  default     = ""
}

variable "microsoft_client_secret_name" {
  description = "Nombre del secreto en Secrets Manager con el client secret de la app registration de Microsoft"
  type        = string
  default     = ""
}

resource "aws_cognito_user_pool" "main" {
  name = "${var.name_prefix}-users"

  mfa_configuration = "ON"

  software_token_mfa_configuration {
    enabled = true
  }

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  tags = {
    Name = "${var.name_prefix}-user-pool"
  }
}

data "aws_secretsmanager_secret_version" "microsoft_client_secret" {
  count     = var.microsoft_idp_enabled ? 1 : 0
  secret_id = var.microsoft_client_secret_name
}

resource "aws_cognito_identity_provider" "microsoft" {
  count = var.microsoft_idp_enabled ? 1 : 0

  user_pool_id  = aws_cognito_user_pool.main.id
  provider_name = "Microsoft"
  provider_type = "OIDC"

  provider_details = {
    client_id                     = var.microsoft_client_id
    client_secret                 = data.aws_secretsmanager_secret_version.microsoft_client_secret[0].secret_string
    authorize_scopes              = "openid email profile"
    oidc_issuer                   = "https://login.microsoftonline.com/${var.azure_ad_tenant_id}/v2.0"
    attributes_request_method     = "GET"
    attributes_url_add_attributes = "false"
  }

  attribute_mapping = {
    email    = "email"
    name     = "name"
    username = "sub"
  }
}

resource "aws_cognito_user_pool_client" "web" {
  name         = "${var.name_prefix}-web-client"
  user_pool_id = aws_cognito_user_pool.main.id

  allowed_oauth_flows                  = ["code"]
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_scopes                 = ["openid", "email", "profile"]
  callback_urls                        = concat([var.callback_url, "http://localhost:3000/api/auth/callback"], var.additional_callback_urls)
  logout_urls                          = concat(["http://localhost:3000"], var.additional_logout_urls)
  supported_identity_providers         = var.microsoft_idp_enabled ? ["COGNITO", "Microsoft"] : ["COGNITO"]
  prevent_user_existence_errors        = "ENABLED"

  depends_on = [aws_cognito_identity_provider.microsoft]
}

resource "aws_cognito_user_pool_domain" "main" {
  domain       = var.name_prefix
  user_pool_id = aws_cognito_user_pool.main.id
}

output "user_pool_id" {
  value = aws_cognito_user_pool.main.id
}

output "client_id" {
  value = aws_cognito_user_pool_client.web.id
}

output "cognito_domain" {
  value = "${var.name_prefix}.auth.us-east-1.amazoncognito.com"
}
