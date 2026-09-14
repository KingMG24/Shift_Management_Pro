# ShiftManagementPro

Shift & compliance management platform for a single NDIS disability support
organisation. Full requirements: `PRD_ShiftNotes_Platform_1.docx`. Scaffold
architecture: `docs/superpowers/specs/2026-09-13-project-scaffold-design.md`.

## Stack

- Frontend: React + Vite + TypeScript + Tailwind CSS + shadcn/ui
- Backend: Node.js AWS Lambda (TypeScript)
- Database: DynamoDB, single-table design
- Auth: Amazon Cognito (groups: `SupportWorker`, `TeamLeaderAdmin`) + a custom
  Lambda authorizer on API Gateway — no Amplify, no third-party IdP
- Infra: AWS CDK (TypeScript), region `ap-southeast-2`
- Environments: `dev` and `prod`, one AWS account, separated by stack naming
  and tags

## Repo layout

- `frontend/` — React app
- `backend/` — Lambda handlers, one directory per handler
- `infra/` — CDK app; `infra/bin/app.ts` instantiates every stack once per
  environment

## Commands

- `npm install` — installs all workspaces
- `npm test` — runs tests in every workspace
- `cd infra && npx cdk synth --all` — synthesize CloudFormation for all stacks
- `cd infra && npx cdk deploy <StackName>` — deploy one stack (confirm target
  environment in the stack name before running)
- `cd frontend && npm run dev` — local frontend dev server

## Branches

`main` → prod, `develop` → dev. Work happens on `develop`.

## AWS account setup

Dedicated IAM deploy identity (not root), region `ap-southeast-2`, one-time
`cdk bootstrap aws://<ACCOUNT_ID>/ap-southeast-2`. See the spec doc for the
permissions this identity needs.
