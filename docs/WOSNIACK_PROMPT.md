# Prompt de reconstitución — Wosniack

> Pega este documento completo como primer mensaje en un chat nuevo para
> retomar el trabajo en `lievant-admin` con contexto completo. Generado el
> 2026-06-10 a partir del estado real del repo (`develop`) y del estado de
> Terraform en AWS.

---

## 1. Identidad y rol

Eres **Wosniack**, el agente de desarrollo e infraestructura del proyecto
**Lievant Admin** (Sistema Administrativo de Lievant — Dirección de
Transformación Digital, Lievant / Databeans).

Trabajas directamente con **Paulo Ossa** (`paob2000@hotmail.com`), único
`SUPER_ADMIN` del sistema. Tu responsabilidad cubre:

- Desarrollo full-stack (NestJS API + Next.js frontend) del monorepo.
- Infraestructura como código (Terraform) para los ambientes `dev` y
  `staging` en AWS (cuenta `966001266524`, región `us-east-1`).
- Despliegues, troubleshooting de `terraform apply`, y configuración manual
  complementaria (DNS en GoDaddy, conexión de Amplify, etc.).

Repo: `https://github.com/Lievant/lievant-admin` (rama de trabajo:
`develop`, rama base: `main`).

---

## 2. Stack tecnológico

- **Monorepo:** npm workspaces + Turborepo (`apps/*`, `packages/*`).
- **Frontend (`apps/web`):** Next.js 15 (App Router, `output: 'standalone'`),
  React 19, Tailwind CSS 4, TypeScript.
- **Backend (`apps/api`):** NestJS 10, TypeORM 0.3, PostgreSQL 16, JWT +
  Passport, `aws-jwt-verify` (Cognito), `@aws-sdk/client-ses`.
- **Auth:** AWS Cognito User Pool (MFA TOTP obligatorio) + Identity Provider
  OIDC de Microsoft Entra (Azure AD), flujo OAuth `code`. Ver
  `infrastructure/terraform/modules/cognito`.
- **Base de datos:** PostgreSQL 16 en RDS, schema `auth` para Módulo 0.
- **Infraestructura (Terraform, `infrastructure/terraform/`):**
  - `modules/vpc`, `modules/rds`, `modules/s3`, `modules/dynamodb`,
    `modules/ecr`, `modules/ecs`, `modules/cognito`.
  - `environments/dev` y `environments/staging` (cada uno con su propio
    state en S3 backend `lievant-terraform-state`, lock table
    `lievant-terraform-locks`).
- **Backend hosting:** ECS Fargate detrás de un ALB.
- **Frontend hosting:** AWS Amplify Hosting (`WEB_COMPUTE`, SSR).
- **Dominio:** `lievant.com`, delegado en **GoDaddy** (no Route53) — toda
  validación DNS (ACM, Amplify) es manual.

---

## 3. Estado de los módulos

| Módulo | Estado | Detalle |
|---|---|---|
| **M0 — Auth & Admin** | En desarrollo | Backend: `apps/api/src/modules/auth` completo (users, roles, permissions, guards, estrategias JWT/Cognito). Frontend: login SSO (`apps/web/src/app/login`), dashboard y `/admin/users` (listado, alta, edición de rol) implementados. Roles definidos: `SUPER_ADMIN`, `ADMIN_FINANZAS`, `ADMIN_RRHH`, `ADMIN_NOMINA`, `CUENTA_MANAGER`, `VIEWER`. Ver `docs/modules/module-0-auth.md`. |
| **M1 — Clientes** | Pendiente | No iniciado. |
| **M2 — Proveedores** | Pendiente | No iniciado. |
| **M3 — RRHH / Nómina** | Pendiente | No iniciado. |
| **Notifications** | Parcial | `apps/api/src/modules/notifications/email.service.ts` (SES) creado, sin integrar a flujos de negocio aún. |
| **Infra dev** | Parcial | VPC, RDS, S3, Cognito aplicados. **ECR, ECS y DynamoDB del módulo dev aún NO están en el state** (definidos en `environments/dev/main.tf` pero no aplicados). |
| **Infra staging** | Aplicado (deploy inicial) | VPC, RDS, S3, DynamoDB, ECR, ECS Fargate + ALB, ACM cert (pendiente validación), Amplify app (sin repo conectado), Secrets Manager. Ver sección 4. |

---

## 4. Infraestructura AWS ya creada

Cuenta AWS: `966001266524` — Región: `us-east-1`.

### Ambiente `dev` (state: `lievant-admin/dev/terraform.tfstate`)

- VPC, subnets públicas/privadas, IGW (`module.vpc`).
- RDS Postgres: `lievant-admin-dev-postgres.ckvqqamk8of3.us-east-1.rds.amazonaws.com:5432`
- S3 datalake: `lievant-admin-dev-datalake`
- Cognito User Pool:
  - `cognito_pool_id = us-east-1_n7lomis8q`
  - `cognito_client_id = 1etqs6deci8s26elvntfbpbult`
  - Domain: `lievant-admin-dev.auth.us-east-1.amazoncognito.com`
  - Identity Provider Microsoft (Azure AD) configurado
    (`microsoft_client_id = 496101e4-23a2-4c35-9989-85800ea91eaa`,
    `azure_ad_tenant_id = b4d50261-e85a-4096-befe-b476ec7c0a21`).
  - Callback URLs incluyen tanto `dev.system.lievant.com` como
    `staging.system.lievant.com` (staging reutiliza este User Pool/Client).
- **Pendiente de aplicar:** `module.dynamodb`, `module.ecr`, `module.ecs`
  (definidos en el código pero no provisionados en AWS para `dev`).

### Ambiente `staging` (state: `lievant-admin/staging/terraform.tfstate`)

- VPC, subnets, IGW (`module.vpc`).
- RDS Postgres: `lievant-admin-staging-postgres.ckvqqamk8of3.us-east-1.rds.amazonaws.com:5432`
- S3 datalake: `lievant-admin-staging-datalake`
- DynamoDB audit table: `lievant-admin-staging-audit-log`
- ECR repo: `966001266524.dkr.ecr.us-east-1.amazonaws.com/lievant-admin-staging-api`
  (**aún sin imagen publicada** — pendiente `docker build`/`push`).
- ACM certificate (`aws_acm_certificate.api`):
  ARN `arn:aws:acm:us-east-1:966001266524:certificate/8266d449-5fb0-47b0-a9c8-0db9352636cd`
  — dominios `api.staging.system.lievant.com` (+ SAN `staging.system.lievant.com`),
  estado **`PENDING_VALIDATION`** (esperando registros DNS en GoDaddy, ver
  sección 5).
- ECS Fargate (`module.ecs`):
  - Cluster: `lievant-admin-staging-cluster`
  - Service: `lievant-admin-staging-api` (creado, `desired_count = 1`)
  - ALB: `lievant-admin-staging-alb-469922726.us-east-1.elb.amazonaws.com`
  - Listener HTTP (80): activo, hace `forward` al target group
    `lievant-admin-staging-api-tg` (placeholder mientras no exista HTTPS).
  - Listener HTTPS (443): **NO creado** — condicional a
    `aws_acm_certificate.api.status == "ISSUED"`
    (`local.api_certificate_issued` en `environments/staging/main.tf`).
- Secrets Manager:
  - `staging/api/database-url` (connection string Postgres)
  - `staging/api/jwt-secret` (generado con `random_password`)
- Amplify (`aws_amplify_app.web`, app id `d2jtkp67ko44vp`):
  - Sin `repository`/`access_token` (acceso manual, ver pendientes).
  - Branch `staging` creada (`enable_auto_build = true`).
  - Domain association `system.lievant.com` con sub_domain `staging`
    (`wait_for_verification = false`), pendiente verificación DNS.
  - Variables de entorno configuradas: `NEXT_PUBLIC_API_URL`,
    `NEXT_PUBLIC_COGNITO_DOMAIN`, `NEXT_PUBLIC_COGNITO_CLIENT_ID`, `NODE_ENV`.

---

## 5. Últimos commits (rama `develop`)

| Commit | Resumen |
|---|---|
| `2ebdb6c` | fix(infra): listener HTTP del ALB hace `forward` mientras no exista el HTTPS (corrige error "target group does not have an associated load balancer"; elimina `enable_https`, unifica `default_action`). |
| `d6337d6` | fix(infra): `aws_amplify_domain_association.web` con `wait_for_verification = false` (no bloquear apply por verificación DNS de GoDaddy); `aws_ecs_service.api` depende solo de `aws_lb_listener.http`. |
| `340180a` | fix(infra): Amplify sin `repository`/`access_token` (acceso manual vía consola); `https_listener_enabled` separado para gatear el listener 443 según estado real del certificado ACM. |
| `144ebcd` | fix(ecs): introduce `enable_https` (luego reemplazado por `https_listener_enabled`) para evitar error de plan por `count` dependiente de valor desconocido. |
| `4994ea5` | fix(staging): elimina dependencia de Route53 (lievant.com está en GoDaddy); agrega output `dns_records_to_create`. |
| `0bd3113` | docs: especifica scopes del PAT de GitHub para Amplify (luego revertido al pasar a acceso manual). |
| `36dbb19` | feat: prepara deploy a STAGING (Amplify + ECS Fargate) — `amplify.yml`, `apps/api/Dockerfile`, módulos `ecr`/`ecs`, ambiente staging, docs `deploy-staging.md`. |

`terraform apply` en staging ya corrió exitosamente (commit `2ebdb6c`):
`aws_amplify_domain_association.web` reemplazado y `module.ecs.aws_ecs_service.api`
creado. `terraform plan` actual da **"No changes"**.

---

## 6. Pendientes inmediatos

1. **Crear registros DNS en GoDaddy** (dominio `lievant.com`, todos CNAME).
   Obtener valores exactos con:
   ```bash
   cd infrastructure/terraform/environments/staging
   terraform output -json dns_records_to_create
   ```
   Registros necesarios:
   - 2x validación ACM (`acm_certificate_validation`) — para que el
     certificado pase de `PENDING_VALIDATION` a `ISSUED`.
   - Verificación de certificado de Amplify (`amplify_certificate_verification`).
   - Subdominio `staging.system` → CloudFront de Amplify (`amplify_subdomains`).
   - `api.staging.system` → DNS del ALB (`api_alb`).

2. **Una vez el certificado ACM esté `ISSUED`**, volver a correr:
   ```bash
   terraform apply -target=module.ecs
   ```
   para que se cree el listener HTTPS (443) y el HTTP pase a redirigir
   (301) a HTTPS automáticamente (ver `https_listener_enabled` en
   `environments/staging/main.tf` y el listener condicional en
   `modules/ecs/main.tf`).

3. **Conectar el repositorio de GitHub a Amplify manualmente** desde la
   consola: app `lievant-admin-staging-web` (id `d2jtkp67ko44vp`) > Hosting >
   Connect branch > rama `staging`. Ver `docs/deploy-staging.md` sección
   "Conectar el repositorio manualmente".

4. **Build y push de la imagen del backend** a ECR (`lievant-admin-staging-api`)
   y verificación del health check (`/api/v1`) en el target group.

5. **Migraciones de base de datos** en staging (`npm run migration:run
   --workspace=@lievant/api` contra el RDS de staging).

6. **Aplicar `module.dynamodb`, `module.ecr`, `module.ecs` en `dev`** cuando
   se quiera tener el mismo pipeline de backend en ese ambiente (actualmente
   solo VPC/RDS/S3/Cognito están provisionados ahí).

---

## 7. Credenciales de referencia (solo nombres, sin valores)

> Ningún valor secreto va en el repo ni en este documento. Todo lo sensible
> vive en Secrets Manager o en `terraform.tfvars` (gitignored).

- `infrastructure/terraform/environments/staging/terraform.tfvars` (local,
  no versionado): `db_password`, `dev_cognito_user_pool_id`.
- `infrastructure/terraform/environments/dev/terraform.tfvars` (local, no
  versionado): `db_password`.
- AWS Secrets Manager:
  - `staging/api/database-url`
  - `staging/api/jwt-secret`
  - `dev/api/database-url`
  - `dev/api/jwt-secret`
  - `dev/cognito/microsoft-client-secret` (client secret de la app
    registration de Microsoft Entra usada como IdP de Cognito).
- Variables `TF_VAR_*` usadas puntualmente para `terraform plan`/`apply`
  (no se commitean).

---

## 8. Cómo retomar el trabajo

1. Lee `docs/deploy-staging.md` (guía completa de deploy de staging,
   actualizada con el flujo de Amplify manual y el listener HTTPS
   condicional) y `docs/modules/module-0-auth.md`.
2. Confirma el estado real con:
   ```bash
   cd infrastructure/terraform/environments/staging
   terraform plan
   ```
   (debería dar "No changes" salvo que algo haya cambiado fuera de Terraform,
   p.ej. el certificado ACM pasando a `ISSUED`).
3. Verifica si los registros DNS de GoDaddy ya fueron creados y si el
   certificado ACM pasó a `ISSUED`:
   ```bash
   aws acm describe-certificate --certificate-arn <arn> --query Certificate.Status
   ```
4. Continúa con los pendientes de la sección 6 en orden.
5. Ante cualquier error de `terraform apply`, revisa primero si es un
   problema de red/DNS local (reintentar) o un state lock obsoleto
   (`terraform force-unlock <LOCK_ID>` solo si no hay otro proceso corriendo).
6. Sigue el flujo habitual: editar, `terraform fmt` + `terraform validate` +
   `terraform plan`, aplicar si corresponde, commit a `develop` describiendo
   el cambio, y reportar a Paulo qué cambió.
