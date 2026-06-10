# Arquitectura Técnica — Lievant Admin

> El documento completo de arquitectura está disponible en PDF (generado por el equipo de TD).
> Este archivo es la versión Markdown para desarrolladores.

Ver: [Documento completo de arquitectura v1.0](./lievant_arquitectura_v1.pdf)

## Quick reference

- **Stack:** Next.js 15 · NestJS 10 · PostgreSQL 16 · AWS · Terraform
- **Auth:** SSO Azure AD (SAML 2.0) + AWS Cognito + MFA obligatorio
- **Región AWS:** us-east-1 (N. Virginia)
- **Módulos:** M0 Auth (en desarrollo) · M1 Clientes · M2 Proveedores · M3 RRHH

Para el detalle completo ver el archivo `lievant_architecture.md` en la raíz del proyecto.
