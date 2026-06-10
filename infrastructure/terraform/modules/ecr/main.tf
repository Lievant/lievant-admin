variable "name_prefix" {
  type = string
}

variable "environment" {
  type = string
}

resource "aws_ecr_repository" "api" {
  name                 = "${var.name_prefix}-api"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Name = "${var.name_prefix}-api"
  }
}

resource "aws_ecr_lifecycle_policy" "api" {
  repository = aws_ecr_repository.api.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Conservar solo las últimas 10 imágenes"
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = 10
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}

output "repository_url" {
  value = aws_ecr_repository.api.repository_url
}

output "repository_name" {
  value = aws_ecr_repository.api.name
}

output "repository_arn" {
  value = aws_ecr_repository.api.arn
}
