variable "name_prefix" { type = string }
variable "environment" { type = string }

resource "aws_dynamodb_table" "audit_log" {
  name         = "${var.name_prefix}-audit-log"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "pk"
  range_key    = "sk"
  attribute { name = "pk";          type = "S" }
  attribute { name = "sk";          type = "S" }
  attribute { name = "entity_type"; type = "S" }
  global_secondary_index {
    name            = "EntityTypeIndex"
    hash_key        = "entity_type"
    range_key       = "sk"
    projection_type = "ALL"
  }
  point_in_time_recovery { enabled = true }
  server_side_encryption  { enabled = true }
  tags = { Name = "${var.name_prefix}-audit-log" }
}

output "audit_table_name" { value = aws_dynamodb_table.audit_log.name }
output "audit_table_arn"  { value = aws_dynamodb_table.audit_log.arn }