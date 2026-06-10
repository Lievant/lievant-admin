# Deploy a STAGING — Guía de primer despliegue

URL objetivo: **https://staging.system.lievant.com** (frontend) / **https://api.staging.system.lievant.com** (API)

Esta guía cubre el primer deploy del ambiente `staging` en AWS: frontend en
Amplify Hosting, backend NestJS en ECS Fargate detrás de un ALB, y la
infraestructura base (VPC, RDS, S3, DynamoDB) provisionada con Terraform.

## 0. Prerrequisitos

- Acceso a la cuenta AWS con permisos para Amplify, ECS, ECR, ACM, Route53,
  Secrets Manager, RDS, VPC, S3, DynamoDB.
- Terraform >= 1.7 y AWS CLI configurados localmente (`aws configure`).
- Un Personal Access Token de GitHub con permisos `repo` para que Amplify
  pueda clonar el repositorio (`github_access_token`).
- Rama `staging` creada en el repositorio de GitHub.
- Zona Route53 pública para `lievant.com` ya existente (usada para validar el
  certificado ACM de `api.staging.system.lievant.com`).
- El User Pool ID de Cognito de `dev` (output `cognito_pool_id` del ambiente
  `dev`), ya que `staging` reutiliza el User Pool/Client de `dev`.

## 1. Variables de Terraform

En `infrastructure/terraform/environments/staging/`, crea un archivo
`terraform.tfvars` (no se versiona) con:

```hcl
db_password              = "<password-seguro-de-rds>"
github_repository        = "https://github.com/<org>/lievant-admin"
github_access_token      = "<personal-access-token-de-github>"
dev_cognito_user_pool_id = "<output cognito_pool_id de dev>"
```

> No commitear `terraform.tfvars` ni tokens. Para CI/CD usa variables de
> entorno `TF_VAR_*` o un secret store.

## 2. Provisionar infraestructura base (VPC, RDS, S3, DynamoDB, ECR, ACM)

```bash
cd infrastructure/terraform/environments/staging
terraform init
terraform plan -target=module.vpc -target=module.rds -target=module.s3 \
  -target=module.dynamodb -target=module.ecr -target=aws_acm_certificate.api \
  -target=aws_route53_record.api_cert_validation \
  -target=aws_acm_certificate_validation.api
terraform apply -target=module.vpc -target=module.rds -target=module.s3 \
  -target=module.dynamodb -target=module.ecr -target=aws_acm_certificate.api \
  -target=aws_route53_record.api_cert_validation \
  -target=aws_acm_certificate_validation.api
```

Espera a que el certificado ACM quede `ISSUED` (la validación DNS via
Route53 suele tardar unos minutos) antes de continuar.

## 3. Build y push de la imagen Docker del backend

Toma el `repository_url` del output `ecr_repo_url`:

```bash
ECR_REPO=$(terraform output -raw ecr_repo_url)
aws ecr get-login-password --region us-east-1 \
  | docker login --username AWS --password-stdin "${ECR_REPO%/*}"

# Build desde la raíz del repo (el Dockerfile usa el contexto del monorepo)
docker build -f apps/api/Dockerfile -t "$ECR_REPO:latest" .
docker push "$ECR_REPO:latest"
```

## 4. Provisionar ECS (cluster, ALB, servicio) y Secrets Manager

```bash
terraform apply -target=aws_secretsmanager_secret.database_url \
  -target=aws_secretsmanager_secret_version.database_url \
  -target=aws_secretsmanager_secret.jwt_secret \
  -target=aws_secretsmanager_secret_version.jwt_secret \
  -target=module.ecs
```

Esto crea el cluster ECS, el ALB (escuchando en HTTP→HTTPS con el
certificado de `api.staging.system.lievant.com`), el Target Group, la Task
Definition (con `DATABASE_URL` y `JWT_SECRET` inyectados desde Secrets
Manager) y el Service con `desired_count = 1`.

Verifica que las tasks pasen el health check (`/api/v1`) en el Target Group
antes de continuar.

### Apuntar `api.staging.system.lievant.com` al ALB

Crea un registro Route53 tipo `A` (alias) o `CNAME` apuntando a
`module.ecs.alb_dns_name` (output del módulo ECS):

```bash
terraform output -raw alb_dns_name
```

## 5. Migraciones de base de datos

Desde un entorno con acceso a la VPC (bastion, ECS task one-off, o túnel
SSM), ejecuta:

```bash
DATABASE_URL="postgresql://lievant_admin:<db_password>@<db_endpoint>/<db_name>" \
  npm run migration:run --workspace=@lievant/api
```

(`<db_endpoint>` y `<db_name>` provienen de `terraform output db_endpoint` /
del módulo `rds`).

## 6. Provisionar Amplify (frontend)

```bash
terraform apply -target=aws_amplify_app.web -target=aws_amplify_branch.staging \
  -target=aws_amplify_domain_association.web
```

Esto crea la app de Amplify conectada a la rama `staging` del repo, con
`amplify.yml` (en la raíz del repo) como build spec y las siguientes
variables de entorno (configuradas vía `aws_amplify_app.environment_variables`):

| Variable | Valor |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | `https://api.staging.system.lievant.com/api/v1` |
| `NEXT_PUBLIC_COGNITO_DOMAIN` | `lievant-admin-dev.auth.us-east-1.amazoncognito.com` |
| `NEXT_PUBLIC_COGNITO_CLIENT_ID` | `1etqs6deci8s26elvntfbpbult` |
| `NODE_ENV` | `production` |

La asociación de dominio (`aws_amplify_domain_association.web`) deja
`staging.system.lievant.com` apuntando a la rama `staging`. Amplify provisiona
y valida automáticamente su propio certificado ACM para ese dominio
(`type = AMPLIFY_MANAGED`); revisa en la consola de Amplify > Domain
management que el estado sea `Available` y, si pide registros DNS de
verificación adicionales, agrégalos en Route53.

## 7. Disparar el primer build

Con la app y la rama creadas, push a `staging` (o usa "Run build" en la
consola de Amplify) para disparar el primer deploy del frontend. Amplify
ejecuta `amplify.yml`:

1. `npm ci` en la raíz del monorepo.
2. `npm run build --workspace=@lievant/web` (Next.js con `output: 'standalone'`).
3. Copia `public/` y `.next/static/` dentro de `.next/standalone/apps/web/`.
4. Publica `apps/web/.next/standalone/apps/web` como artefacto.

## 8. Verificación post-deploy

- `https://staging.system.lievant.com` carga la pantalla de login.
- `https://api.staging.system.lievant.com/api/v1/...` responde (verifica con
  un endpoint autenticado o el healthcheck del ALB).
- Login con SSO (Microsoft/Cognito) funciona end-to-end: el callback
  `https://staging.system.lievant.com/api/auth/callback` ya está habilitado en
  el User Pool Client de `dev` (ver
  `infrastructure/terraform/environments/dev/main.tf`,
  `module.cognito.additional_callback_urls`).
- Logs de la API en CloudWatch: log group `/ecs/lievant-admin-staging-api`.

## 9. Despliegues posteriores

- **Backend:** build + push de una nueva imagen a ECR, luego
  `aws ecs update-service --cluster lievant-admin-staging-cluster --service lievant-admin-staging-api --force-new-deployment`.
- **Frontend:** push a la rama `staging` dispara el build automático en
  Amplify (`enable_auto_build = true`).

## Outputs relevantes de Terraform

| Output | Descripción |
| --- | --- |
| `amplify_url` | URL del frontend (`https://staging.system.lievant.com`) |
| `ecr_repo_url` | URL del repositorio ECR para la imagen del backend |
| `alb_dns_name` | DNS del ALB — usar para el registro de `api.staging.system.lievant.com` |
| `db_endpoint` | Endpoint de RDS Postgres |
| `datalake_bucket` | Bucket S3 del datalake |
| `audit_table` | Tabla DynamoDB de auditoría |
