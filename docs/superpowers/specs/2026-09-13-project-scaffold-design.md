# ShiftManagementPro — Project Scaffold Design

Status: Approved
Date: 2026-09-13
Scope: infrastructure/repo scaffolding only — no feature code (shift notes, incident
reports, compliance engine, PDF generation) yet. Those are separate sub-projects
with their own spec once this scaffold exists. Source requirements: `PRD_ShiftNotes_Platform_1.docx`.

## Context

PRD calls for a shift-note and compliance-tracking web app for a single NDIS
disability support organisation (no multi-tenancy). The PRD's own "suggested
architecture" section (Next.js/Django + Postgres) is superseded by an explicit
user decision to build on AWS serverless instead. This spec captures that
architecture decision and the scaffold needed before feature work starts.

## Repo layout

Monorepo, npm workspaces, single GitHub repo (to be provided later), branches
`main` (prod) and `develop` (dev):

```
ShiftManagementPro/
  frontend/        # React + Vite + Tailwind CSS + shadcn/ui
  backend/         # Lambda handlers, grouped by domain (auth, shifts, notes, incidents, compliance)
  infra/           # AWS CDK (TypeScript), one app instantiating stacks per environment
  package.json     # workspace root
```

## Environments

Two environments, **dev** and **prod**, in a single AWS account (region
`ap-southeast-2`), differentiated by stack naming and tags rather than
separate accounts — proportionate for a single-org internal tool. Every stack
and the CDK App itself is tagged via a CDK Aspect: `Project=ShiftManagementPro`,
`Environment=dev|prod`, `ManagedBy=CDK`.

## CDK stack split

One monolithic stack risks CloudFormation's 500-resources-per-stack ceiling as
Lambdas/routes grow, and couples unrelated deploys. Instead, split by concern,
each instantiated once per environment from a single `infra/bin/app.ts`:

1. `AuthStack` — Cognito User Pool, groups `SupportWorker` and `TeamLeaderAdmin`
2. `DataStack` — DynamoDB single table
3. `StorageStack` — S3 bucket for generated PDFs/photos (Year/Month/Date prefix convention)
4. `ApiStack` — API Gateway, custom Lambda authorizer, domain Lambdas
5. `FrontendStack` — S3 (static site) + CloudFront

## Auth

- **Identity provider**: Cognito User Pool with two groups: `SupportWorker`,
  `TeamLeaderAdmin`. No third-party IdP.
- **Frontend**: React talks to Cognito directly via `amazon-cognito-identity-js`
  (or `@aws-sdk/client-cognito-identity-provider`) for sign-in/refresh — no
  Amplify library.
- **API authorization**: a **custom Lambda authorizer** on API Gateway (not the
  built-in `COGNITO_USER_POOLS` authorizer type). It verifies the incoming JWT
  against the User Pool's JWKS using `aws-jwt-verify`, extracts the Cognito
  group, and returns an IAM policy plus the caller's role as request context
  for downstream Lambdas. Centralizes role logic in one place for future
  changes.

## Data model — DynamoDB single table

Table name: `ShiftManagementPro-{env}`. On-demand billing (usage is small,
internal-org scale; avoids provisioned-capacity tuning at this size).

Primary key items:
| PK | SK | Represents |
|---|---|---|
| `USER#<id>` | `METADATA` | user profile (role, name) |
| `CLIENT#<id>` | `METADATA` | NDIS client profile |
| `SHIFT#<id>` | `METADATA` | shift record (worker, client, start/end, status) |
| `SHIFT#<id>` | `NOTE` | shift note — edited in place, never duplicated (PRD requirement) |
| `SHIFT#<id>` | `INCIDENT#<id>` | incident report(s) tied to the shift |
| `SHIFT#<id>` | `FLAG#<id>` | compliance flag(s) tied to the shift |

GSIs:
| Index | PK | SK | Access pattern |
|---|---|---|---|
| GSI1 | `WORKER#<id>` | `<date>#SHIFT#<id>` | a worker's own shifts/notes |
| GSI2 | `CLIENT#<id>` | `<date>#SHIFT#<id>` | a client's shift history |
| GSI3 | `DATE#<yyyy-mm-dd>` | `SHIFT#<id>` | Year/Month/Date dashboard browsing (direct PRD requirement) |
| GSI4 (sparse) | `STATUS#PENDING` | `<date>#SHIFT#<id>` | team leader's "needs review" queue — item only carries this attribute while a flag/incident is unresolved |

## Frontend

React + Vite + Tailwind CSS + shadcn/ui (Radix-based, copy-in components, no
extra runtime dependency). No Amplify.

## CI/CD

GitHub Actions workflows scaffolded now, inert until the GitHub repo exists
and secrets/OIDC are wired: push to `develop` deploys `infra`/`backend`/`frontend`
to the dev environment; push to `main` deploys to prod.

## Testing

- Backend: Jest, one unit test per Lambda handler skeleton.
- Infra: CDK assertions (`aws-cdk-lib/assertions`) — snapshot/resource-presence
  tests per stack.
- Frontend: Vitest, one smoke test.

Not full coverage — this is scaffold, not feature implementation.

## AWS account setup (manual, by user, outside this repo)

- Dedicated IAM deploy identity (not root), region `ap-southeast-2`.
- Either `AdministratorAccess` (if the AWS account is dedicated to this
  project) or a scoped custom policy covering CloudFormation, IAM role
  management (prefixed `ShiftManagementPro-*`), Lambda, DynamoDB, S3,
  CloudFront, Cognito, API Gateway, CloudWatch Logs.
- One-time `cdk bootstrap aws://<ACCOUNT_ID>/ap-southeast-2`.

## Explicitly out of scope for this sub-project

Shift note / incident report / compliance engine / PDF generation feature
code — separate spec(s) once this scaffold is in place and deployable.
