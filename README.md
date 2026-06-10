# Lievant Admin — Sistema Administrativo

[![PR Check](https://github.com/Lievant/lievant-admin/actions/workflows/pr-check.yml/badge.svg)](https://github.com/Lievant/lievant-admin/actions/workflows/pr-check.yml)

Sistema administrativo centralizado de Lievant — gestión de clientes, proveedores, RRHH y nómina.

**URL:** https://system.lievant.com  
**Stack:** Next.js 15 · NestJS 10 · PostgreSQL 16 · AWS · Terraform  
**Equipo:** Dirección de Transformación Digital · Lievant / Databeans

## Estructura del proyecto

```
lievant-admin/
├── apps/
│   ├── web/          → Frontend (Next.js 15 + TypeScript)
│   └── api/          → Backend (NestJS 10 + TypeScript)
├── packages/
│   ├── ui/           → Design system compartido
│   ├── types/        → Tipos TypeScript compartidos
│   └── utils/        → Utilidades compartidas
├── infrastructure/
│   └── terraform/    → Infraestructura AWS (IaC)
└── docs/             → Documentación técnica
```

## Inicio rápido (desarrollo local)

```bash
# 1. Clonar el repo
git clone https://github.com/Lievant/lievant-admin.git
cd lievant-admin

# 2. Instalar dependencias
npm install

# 3. Variables de entorno
cp .env.example .env.local
# Edita .env.local con los valores de desarrollo

# 4. Levantar todo
npm run dev
```

## Documentación

- [Arquitectura técnica](./docs/architecture.md)
- [Módulo 0 — Auth & Admin](./docs/modules/module-0-auth.md)
- [Cómo agregar un nuevo módulo](./docs/architecture.md#11-cómo-agregar-un-nuevo-módulo)
- [Infrastructure (Terraform)](./infrastructure/terraform/)

## Ramas

| Rama | Ambiente | URL |
|---|---|---|
| `develop` | Development | dev.system.lievant.com |
| `staging` | Staging | staging.system.lievant.com |
| `main` | Production | system.lievant.com |

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | Next.js 15 + TypeScript + Tailwind + shadcn/ui |
| Backend | NestJS 10 + TypeScript + PostgreSQL |
| Auth | AWS Cognito + Azure AD (SAML 2.0) + MFA obligatorio |
| Infra | AWS (Amplify, ECS, RDS, S3, Cognito, DynamoDB) + Terraform |
| CI/CD | GitHub Actions |

---
*Lievant · Dirección de Transformación Digital · Junio 2026*
