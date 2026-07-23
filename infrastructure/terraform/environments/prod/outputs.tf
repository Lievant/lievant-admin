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

# Registros DNS a crear manualmente en el registrador de lievant-admin.com.
# Ejecutar `terraform output -json dns_records_to_create` tras el apply.
output "dns_records_to_create" {
  description = "Registros DNS para lievant-admin.com / api.lievant-admin.com"
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
    # Los registros de Amplify (verificación de dominio + CNAMEs de subdominios)
    # se obtienen de la consola de Amplify, ya que el frontend no se gestiona por
    # Terraform.
  }
}
