# ShiftManagementPro Scaffold Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the deployable AWS serverless scaffold for ShiftManagementPro — monorepo, CDK infra (Auth/Data/Storage/Api/Frontend stacks x dev+prod), a custom Lambda authorizer, and a minimal React shell that proves the whole chain (Cognito → API Gateway → Lambda) works end to end. No feature code (shift notes, incidents, compliance engine, PDF generation).

**Architecture:** npm-workspaces monorepo (`frontend/`, `backend/`, `infra/`). CDK (TypeScript) instantiates five stacks per environment from one `infra/bin/app.ts`. Backend Lambdas are plain TS files bundled directly by CDK's `NodejsFunction` (esbuild) — no separate backend build step. Frontend talks to Cognito directly (no Amplify) and to a `/me` API route protected by a custom Lambda authorizer, to smoke-test auth end to end.

**Tech Stack:** AWS CDK v2 (TypeScript), DynamoDB, Cognito, API Gateway (REST), Lambda (Node.js), S3, CloudFront, React + Vite + TypeScript, Tailwind CSS, shadcn/ui, `amazon-cognito-identity-js`, `aws-jwt-verify`, Jest, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-13-project-scaffold-design.md`

## Global Constraints

- Region: `ap-southeast-2`. Single AWS account for both environments; environments differentiated by stack naming (`ShiftManagementPro-<Concern>-<env>`) and tags, not separate accounts.
- Every stack tagged: `Project=ShiftManagementPro`, `Environment=dev|prod`, `ManagedBy=CDK`.
- DynamoDB single table, name `ShiftManagementPro-{env}`, on-demand billing, partition key `PK` (string) / sort key `SK` (string), GSI1–GSI4 as defined in the spec.
- Cognito: two groups, `SupportWorker` and `TeamLeaderAdmin`. No third-party IdP, no Amplify.
- API authorization via a **custom Lambda authorizer** (`apigateway.TokenAuthorizer`), never the built-in Cognito authorizer type.
- Frontend: React + Vite + Tailwind + shadcn/ui only — no additional UI component library.
- No feature code in this plan: shift notes, incident reports, compliance engine, PDF generation are out of scope.

---

## File Structure

```
ShiftManagementPro/
  package.json                          # workspace root
  CLAUDE.md
  backend/
    package.json
    tsconfig.json
    jest.config.js
    src/
      authorizer/handler.ts             # custom Lambda authorizer
      authorizer/handler.test.ts
      health/handler.ts                 # public health check
      health/handler.test.ts
      me/handler.ts                     # protected, echoes authorizer context
      me/handler.test.ts
  infra/
    package.json
    tsconfig.json
    cdk.json
    jest.config.js
    bin/app.ts                          # instantiates all stacks x dev/prod
    lib/
      config.ts                         # EnvName type, getEnvConfig()
      tags.ts                           # applyProjectTags()
      data-stack.ts
      auth-stack.ts
      storage-stack.ts
      api-stack.ts
      frontend-stack.ts
    test/
      tags.test.ts
      data-stack.test.ts
      auth-stack.test.ts
      storage-stack.test.ts
      api-stack.test.ts
      frontend-stack.test.ts
      app-synth.test.ts
  frontend/
    package.json
    tsconfig.json
    vite.config.ts
    tailwind.config.js
    postcss.config.js
    components.json
    index.html
    .env.example
    src/
      main.tsx
      App.tsx
      App.test.tsx
      index.css
      lib/utils.ts                      # shadcn cn() helper
      lib/auth.ts                       # cognito-identity-js wrapper
      components/ui/button.tsx          # shadcn Button
      pages/Login.tsx
      pages/Home.tsx
  .github/workflows/
    deploy-dev.yml
    deploy-prod.yml
```

---

### Task 1: Monorepo root + CLAUDE.md

**Files:**
- Create: `package.json`
- Create: `CLAUDE.md`

**Interfaces:**
- Produces: npm workspaces `frontend`, `backend`, `infra` — every later task's `npm install`/`npm test` runs through this root.

- [ ] **Step 1: Write root `package.json`**

```json
{
  "name": "shiftmanagementpro",
  "private": true,
  "workspaces": ["frontend", "backend", "infra"],
  "scripts": {
    "test": "npm run test --workspaces --if-present"
  }
}
```

- [ ] **Step 2: Write `CLAUDE.md`**

```markdown
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
```

- [ ] **Step 3: Verify workspaces resolve**

Run: `npm install`
Expected: completes without error; `node_modules/.package-lock.json` (or root `package-lock.json`) is created and lists no workspace errors.

- [ ] **Step 4: Commit**

```bash
git add package.json CLAUDE.md package-lock.json
git commit -m "chore: init npm workspaces monorepo and CLAUDE.md"
```

---

### Task 2: Backend workspace + custom Lambda authorizer

**Files:**
- Create: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `backend/jest.config.js`
- Create: `backend/src/authorizer/handler.ts`
- Test: `backend/src/authorizer/handler.test.ts`

**Interfaces:**
- Produces: `handler(event: APIGatewayTokenAuthorizerEvent): Promise<APIGatewayAuthorizerResult>` exported from `backend/src/authorizer/handler.ts`. On a valid token returns `{ principalId: <sub>, policyDocument: <Allow policy for event.methodArn>, context: { role: <cognito:groups[0]>, sub: <sub> } }`. On an invalid/missing token it throws `Error('Unauthorized')` (API Gateway TOKEN authorizers must throw exactly `'Unauthorized'` to produce a 401). Reads `USER_POOL_ID` and `USER_POOL_CLIENT_ID` from environment variables.
- Consumed by: Task 8 (`ApiStack`), which deploys this handler behind a `TokenAuthorizer` and supplies those two env vars.

- [ ] **Step 1: Write `backend/package.json`**

```json
{
  "name": "backend",
  "private": true,
  "version": "0.0.0",
  "scripts": {
    "test": "jest"
  },
  "devDependencies": {
    "@types/aws-lambda": "^8.10.145",
    "@types/jest": "^29.5.0",
    "@types/node": "^20.14.0",
    "jest": "^29.7.0",
    "ts-jest": "^29.2.0",
    "typescript": "^5.5.0"
  },
  "dependencies": {
    "aws-jwt-verify": "^4.0.1"
  }
}
```

- [ ] **Step 2: Write `backend/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "moduleResolution": "node",
    "lib": ["ES2020"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "outDir": "dist"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Write `backend/jest.config.js`**

```js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
};
```

- [ ] **Step 4: Write the failing test**

```typescript
// backend/src/authorizer/handler.test.ts
import type { APIGatewayTokenAuthorizerEvent } from 'aws-lambda';

jest.mock('aws-jwt-verify', () => ({
  CognitoJwtVerifier: {
    create: jest.fn(),
  },
}));

import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { handler } from './handler';

const mockCreate = CognitoJwtVerifier.create as jest.Mock;

function baseEvent(token: string): APIGatewayTokenAuthorizerEvent {
  return {
    type: 'TOKEN',
    authorizationToken: token,
    methodArn: 'arn:aws:execute-api:ap-southeast-2:123456789012:abc123/dev/GET/me',
  };
}

beforeEach(() => {
  process.env.USER_POOL_ID = 'ap-southeast-2_TESTPOOL';
  process.env.USER_POOL_CLIENT_ID = 'test-client-id';
});

test('returns an Allow policy with role/sub context for a valid token', async () => {
  mockCreate.mockReturnValue({
    verify: jest.fn().mockResolvedValue({
      sub: 'user-123',
      'cognito:groups': ['TeamLeaderAdmin'],
    }),
  });

  const result = await handler(baseEvent('valid-token'));

  expect(result.principalId).toBe('user-123');
  expect(result.policyDocument.Statement[0].Effect).toBe('Allow');
  expect(result.policyDocument.Statement[0].Resource).toBe(
    'arn:aws:execute-api:ap-southeast-2:123456789012:abc123/dev/GET/me'
  );
  expect(result.context).toEqual({ role: 'TeamLeaderAdmin', sub: 'user-123' });
});

test('throws Unauthorized for an invalid token', async () => {
  mockCreate.mockReturnValue({
    verify: jest.fn().mockRejectedValue(new Error('token expired')),
  });

  await expect(handler(baseEvent('bad-token'))).rejects.toThrow('Unauthorized');
});
```

- [ ] **Step 5: Install workspace dependencies**

Run (from repo root): `npm install`
Expected: completes without error; installs `backend`'s new dependencies (`jest`, `ts-jest`, `aws-jwt-verify`, etc.) into the workspace. Note: `npm install` may print a `workspaces` warning about `frontend`/`infra` not existing yet if those workspaces haven't been created — that is expected at this point in the plan and not a failure.

- [ ] **Step 6: Run test to verify it fails**

Run: `cd backend && npx jest src/authorizer/handler.test.ts`
Expected: FAIL — `Cannot find module './handler'`

- [ ] **Step 7: Write minimal implementation**

```typescript
// backend/src/authorizer/handler.ts
import type {
  APIGatewayAuthorizerResult,
  APIGatewayTokenAuthorizerEvent,
} from 'aws-lambda';
import { CognitoJwtVerifier } from 'aws-jwt-verify';

const verifier = CognitoJwtVerifier.create({
  userPoolId: process.env.USER_POOL_ID as string,
  clientId: process.env.USER_POOL_CLIENT_ID as string,
  tokenUse: 'access',
});

export async function handler(
  event: APIGatewayTokenAuthorizerEvent
): Promise<APIGatewayAuthorizerResult> {
  try {
    const payload = await verifier.verify(event.authorizationToken);
    const role = (payload['cognito:groups'] as string[] | undefined)?.[0] ?? 'Unknown';

    return {
      principalId: payload.sub,
      policyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Action: 'execute-api:Invoke',
            Effect: 'Allow',
            Resource: event.methodArn,
          },
        ],
      },
      context: { role, sub: payload.sub },
    };
  } catch {
    throw new Error('Unauthorized');
  }
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `cd backend && npx jest src/authorizer/handler.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 9: Commit**

```bash
git add backend/package.json backend/tsconfig.json backend/jest.config.js backend/src/authorizer package-lock.json
git commit -m "feat(backend): add custom Cognito Lambda authorizer"
```

---

### Task 3: Backend health + me handlers

**Files:**
- Create: `backend/src/health/handler.ts`
- Test: `backend/src/health/handler.test.ts`
- Create: `backend/src/me/handler.ts`
- Test: `backend/src/me/handler.test.ts`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `handler(): Promise<APIGatewayProxyResult>` in `backend/src/health/handler.ts` — always returns `{ statusCode: 200, body: JSON.stringify({ status: 'ok' }) }`.
- Produces: `handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult>` in `backend/src/me/handler.ts` — reads `event.requestContext.authorizer` (the `{ role, sub }` context produced by Task 2's authorizer) and returns `{ statusCode: 200, body: JSON.stringify({ sub, role }) }`.
- Consumed by: Task 8 (`ApiStack`) wires both behind `/health` (no auth) and `/me` (custom authorizer).

- [ ] **Step 1: Write the failing tests**

```typescript
// backend/src/health/handler.test.ts
import { handler } from './handler';

test('returns 200 with status ok', async () => {
  const result = await handler();
  expect(result.statusCode).toBe(200);
  expect(JSON.parse(result.body)).toEqual({ status: 'ok' });
});
```

```typescript
// backend/src/me/handler.test.ts
import type { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from './handler';

function eventWithAuthorizerContext(context: Record<string, string>): APIGatewayProxyEvent {
  return {
    requestContext: { authorizer: context },
  } as unknown as APIGatewayProxyEvent;
}

test('echoes the role and sub set by the authorizer', async () => {
  const result = await handler(
    eventWithAuthorizerContext({ role: 'SupportWorker', sub: 'user-456' })
  );

  expect(result.statusCode).toBe(200);
  expect(JSON.parse(result.body)).toEqual({ sub: 'user-456', role: 'SupportWorker' });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npx jest src/health src/me`
Expected: FAIL — both `Cannot find module './handler'`

- [ ] **Step 3: Write minimal implementations**

```typescript
// backend/src/health/handler.ts
import type { APIGatewayProxyResult } from 'aws-lambda';

export async function handler(): Promise<APIGatewayProxyResult> {
  return { statusCode: 200, body: JSON.stringify({ status: 'ok' }) };
}
```

```typescript
// backend/src/me/handler.ts
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const { sub, role } = event.requestContext.authorizer as { sub: string; role: string };
  return { statusCode: 200, body: JSON.stringify({ sub, role }) };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npx jest src/health src/me`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/src/health backend/src/me
git commit -m "feat(backend): add health and me Lambda handlers"
```

---

### Task 4: Infra workspace + config + tagging aspect

**Files:**
- Create: `infra/package.json`
- Create: `infra/tsconfig.json`
- Create: `infra/cdk.json`
- Create: `infra/jest.config.js`
- Create: `infra/lib/config.ts`
- Create: `infra/lib/tags.ts`
- Test: `infra/test/tags.test.ts`

**Interfaces:**
- Produces: `EnvName = 'dev' | 'prod'` and `getEnvConfig(envName: EnvName): { envName: EnvName; stackName: (concern: string) => string }` in `infra/lib/config.ts`. `stackName('Data')` returns `ShiftManagementPro-Data-{envName}`.
- Produces: `applyProjectTags(scope: IConstruct, envName: EnvName): void` in `infra/lib/tags.ts` — applies `Project=ShiftManagementPro`, `Environment=<envName>`, `ManagedBy=CDK`.
- Consumed by: every stack task (5–9) imports the `EnvName` type and calls `applyProjectTags` on itself; only Task 10 (`bin/app.ts`) calls `getEnvConfig` directly, to compute each stack's name before construction.

- [ ] **Step 1: Write `infra/package.json`**

```json
{
  "name": "infra",
  "private": true,
  "version": "0.0.0",
  "scripts": {
    "test": "jest",
    "synth": "cdk synth --all"
  },
  "devDependencies": {
    "@types/jest": "^29.5.0",
    "@types/node": "^20.14.0",
    "aws-cdk": "^2.160.0",
    "esbuild": "^0.23.0",
    "jest": "^29.7.0",
    "ts-jest": "^29.2.0",
    "ts-node": "^10.9.0",
    "typescript": "^5.5.0"
  },
  "dependencies": {
    "aws-cdk-lib": "^2.160.0",
    "constructs": "^10.3.0"
  }
}
```

- [ ] **Step 2: Write `infra/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "moduleResolution": "node",
    "lib": ["ES2020"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "declaration": false,
    "outDir": "dist"
  },
  "include": ["bin", "lib", "test"]
}
```

- [ ] **Step 3: Write `infra/cdk.json`**

```json
{
  "app": "npx ts-node --prefer-ts-exts bin/app.ts"
}
```

- [ ] **Step 4: Write `infra/jest.config.js`**

```js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
};
```

- [ ] **Step 5: Write `infra/lib/config.ts`**

```typescript
export type EnvName = 'dev' | 'prod';

export function getEnvConfig(envName: EnvName) {
  return {
    envName,
    stackName: (concern: string) => `ShiftManagementPro-${concern}-${envName}`,
  };
}
```

- [ ] **Step 6: Write the failing test for tags**

```typescript
// infra/test/tags.test.ts
import { App, Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { applyProjectTags } from '../lib/tags';

test('applies Project/Environment/ManagedBy tags to every resource in the stack', () => {
  const app = new App();
  const stack = new Stack(app, 'TestTagsStack');
  new Bucket(stack, 'DummyBucket');

  applyProjectTags(stack, 'dev');

  const template = Template.fromStack(stack);
  template.hasResourceProperties('AWS::S3::Bucket', {
    Tags: [
      { Key: 'Environment', Value: 'dev' },
      { Key: 'ManagedBy', Value: 'CDK' },
      { Key: 'Project', Value: 'ShiftManagementPro' },
    ],
  });
});
```

- [ ] **Step 7: Install workspace dependencies**

Run (from repo root): `npm install`
Expected: completes without error; installs `infra`'s new dependencies (`aws-cdk-lib`, `constructs`, `aws-cdk`, `esbuild`, `jest`, `ts-jest`, `ts-node`, etc.).

- [ ] **Step 8: Run test to verify it fails**

Run: `cd infra && npx jest test/tags.test.ts`
Expected: FAIL — `Cannot find module '../lib/tags'`

- [ ] **Step 9: Write minimal implementation**

```typescript
// infra/lib/tags.ts
import { Tags } from 'aws-cdk-lib';
import type { IConstruct } from 'constructs';
import type { EnvName } from './config';

export function applyProjectTags(scope: IConstruct, envName: EnvName): void {
  Tags.of(scope).add('Project', 'ShiftManagementPro');
  Tags.of(scope).add('Environment', envName);
  Tags.of(scope).add('ManagedBy', 'CDK');
}
```

- [ ] **Step 10: Run test to verify it passes**

Run: `cd infra && npx jest test/tags.test.ts`
Expected: PASS. Note: CDK applies stack-level tags alphabetically by key in synthesized output, matching the order asserted above.

- [ ] **Step 11: Commit**

```bash
git add infra/package.json infra/tsconfig.json infra/cdk.json infra/jest.config.js infra/lib/config.ts infra/lib/tags.ts infra/test/tags.test.ts package-lock.json
git commit -m "chore(infra): init CDK workspace, env config, and tagging aspect"
```

---

### Task 5: DataStack (DynamoDB single table)

**Files:**
- Create: `infra/lib/data-stack.ts`
- Test: `infra/test/data-stack.test.ts`

**Interfaces:**
- Consumes: `EnvName` type from `infra/lib/config.ts` (Task 4); `applyProjectTags` from `infra/lib/tags.ts` (Task 4). Does NOT call `getEnvConfig` — the table name is built directly from `envName`, not via `stackName()` (that helper is for CDK stack ids, not resource names).
- Produces: `class DataStack extends Stack` with constructor `(scope, id, props: StackProps & { envName: EnvName })` and public field `table: dynamodb.Table`. Consumed by Task 10 (wiring) and available for future feature stacks.

- [ ] **Step 1: Write the failing test**

```typescript
// infra/test/data-stack.test.ts
import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { DataStack } from '../lib/data-stack';

test('creates a single table with PK/SK and GSI1-GSI4', () => {
  const app = new App();
  const stack = new DataStack(app, 'TestDataStack', { envName: 'dev' });
  const template = Template.fromStack(stack);
  const json = template.toJSON();

  const tableResource = Object.values(json.Resources).find(
    (r: any) => r.Type === 'AWS::DynamoDB::Table'
  ) as any;

  expect(tableResource).toBeDefined();
  expect(tableResource.Properties.KeySchema).toEqual([
    { AttributeName: 'PK', KeyType: 'HASH' },
    { AttributeName: 'SK', KeyType: 'RANGE' },
  ]);
  expect(tableResource.Properties.BillingMode).toBe('PAY_PER_REQUEST');

  const gsiNames = tableResource.Properties.GlobalSecondaryIndexes.map(
    (g: any) => g.IndexName
  );
  expect(gsiNames.sort()).toEqual(['GSI1', 'GSI2', 'GSI3', 'GSI4']);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd infra && npx jest test/data-stack.test.ts`
Expected: FAIL — `Cannot find module '../lib/data-stack'`

- [ ] **Step 3: Write minimal implementation**

```typescript
// infra/lib/data-stack.ts
import { Stack, StackProps } from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import type { Construct } from 'constructs';
import type { EnvName } from './config';
import { applyProjectTags } from './tags';

export interface DataStackProps extends StackProps {
  envName: EnvName;
}

export class DataStack extends Stack {
  public readonly table: dynamodb.Table;

  constructor(scope: Construct, id: string, props: DataStackProps) {
    super(scope, id, props);
    const { envName } = props;

    this.table = new dynamodb.Table(this, 'Table', {
      tableName: `ShiftManagementPro-${envName}`,
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    });

    this.table.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI1SK', type: dynamodb.AttributeType.STRING },
    });
    this.table.addGlobalSecondaryIndex({
      indexName: 'GSI2',
      partitionKey: { name: 'GSI2PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI2SK', type: dynamodb.AttributeType.STRING },
    });
    this.table.addGlobalSecondaryIndex({
      indexName: 'GSI3',
      partitionKey: { name: 'GSI3PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI3SK', type: dynamodb.AttributeType.STRING },
    });
    this.table.addGlobalSecondaryIndex({
      indexName: 'GSI4',
      partitionKey: { name: 'GSI4PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI4SK', type: dynamodb.AttributeType.STRING },
    });

    applyProjectTags(this, envName);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd infra && npx jest test/data-stack.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add infra/lib/data-stack.ts infra/test/data-stack.test.ts
git commit -m "feat(infra): add DataStack with single-table DynamoDB design"
```

---

### Task 6: AuthStack (Cognito)

**Files:**
- Create: `infra/lib/auth-stack.ts`
- Test: `infra/test/auth-stack.test.ts`

**Interfaces:**
- Consumes: `EnvName`, `applyProjectTags` from Task 4.
- Produces: `class AuthStack extends Stack` with constructor `(scope, id, props: StackProps & { envName: EnvName })`, public fields `userPool: cognito.UserPool` and `userPoolClient: cognito.UserPoolClient`. Consumed by Task 8 (`ApiStack`) and Task 10 (wiring), and by the frontend (via CDK outputs, read manually at deploy time).

- [ ] **Step 1: Write the failing test**

```typescript
// infra/test/auth-stack.test.ts
import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { AuthStack } from '../lib/auth-stack';

test('creates a user pool with SupportWorker and TeamLeaderAdmin groups and a public client', () => {
  const app = new App();
  const stack = new AuthStack(app, 'TestAuthStack', { envName: 'dev' });
  const template = Template.fromStack(stack);

  template.resourceCountIs('AWS::Cognito::UserPool', 1);
  template.resourceCountIs('AWS::Cognito::UserPoolGroup', 2);
  template.hasResourceProperties('AWS::Cognito::UserPoolGroup', { GroupName: 'SupportWorker' });
  template.hasResourceProperties('AWS::Cognito::UserPoolGroup', { GroupName: 'TeamLeaderAdmin' });
  template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
    GenerateSecret: false,
    ExplicitAuthFlows: ['ALLOW_USER_SRP_AUTH', 'ALLOW_REFRESH_TOKEN_AUTH'],
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd infra && npx jest test/auth-stack.test.ts`
Expected: FAIL — `Cannot find module '../lib/auth-stack'`

- [ ] **Step 3: Write minimal implementation**

```typescript
// infra/lib/auth-stack.ts
import { Stack, StackProps } from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import type { Construct } from 'constructs';
import type { EnvName } from './config';
import { applyProjectTags } from './tags';

export interface AuthStackProps extends StackProps {
  envName: EnvName;
}

export class AuthStack extends Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;

  constructor(scope: Construct, id: string, props: AuthStackProps) {
    super(scope, id, props);
    const { envName } = props;

    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `ShiftManagementPro-${envName}`,
      selfSignUpEnabled: false,
      signInAliases: { email: true },
    });

    new cognito.CfnUserPoolGroup(this, 'SupportWorkerGroup', {
      userPoolId: this.userPool.userPoolId,
      groupName: 'SupportWorker',
    });
    new cognito.CfnUserPoolGroup(this, 'TeamLeaderAdminGroup', {
      userPoolId: this.userPool.userPoolId,
      groupName: 'TeamLeaderAdmin',
    });

    this.userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
      userPool: this.userPool,
      generateSecret: false,
      authFlows: { userSrp: true },
    });

    applyProjectTags(this, envName);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd infra && npx jest test/auth-stack.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add infra/lib/auth-stack.ts infra/test/auth-stack.test.ts
git commit -m "feat(infra): add AuthStack with Cognito user pool and role groups"
```

---

### Task 7: StorageStack (S3 for documents)

**Files:**
- Create: `infra/lib/storage-stack.ts`
- Test: `infra/test/storage-stack.test.ts`

**Interfaces:**
- Consumes: `EnvName`, `applyProjectTags` from Task 4.
- Produces: `class StorageStack extends Stack` with constructor `(scope, id, props: StackProps & { envName: EnvName })`, public field `documentsBucket: s3.Bucket`. Reserved for the future PDF-generation sub-project; not consumed by any other task in this plan.

- [ ] **Step 1: Write the failing test**

```typescript
// infra/test/storage-stack.test.ts
import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { StorageStack } from '../lib/storage-stack';

test('creates a private, encrypted documents bucket', () => {
  const app = new App();
  const stack = new StorageStack(app, 'TestStorageStack', { envName: 'dev' });
  const template = Template.fromStack(stack);

  template.hasResourceProperties('AWS::S3::Bucket', {
    PublicAccessBlockConfiguration: {
      BlockPublicAcls: true,
      BlockPublicPolicy: true,
      IgnorePublicAcls: true,
      RestrictPublicBuckets: true,
    },
    BucketEncryption: {
      ServerSideEncryptionConfiguration: [
        { ServerSideEncryptionByDefault: { SSEAlgorithm: 'AES256' } },
      ],
    },
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd infra && npx jest test/storage-stack.test.ts`
Expected: FAIL — `Cannot find module '../lib/storage-stack'`

- [ ] **Step 3: Write minimal implementation**

```typescript
// infra/lib/storage-stack.ts
import { Stack, StackProps, Aws } from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import type { Construct } from 'constructs';
import type { EnvName } from './config';
import { applyProjectTags } from './tags';

export interface StorageStackProps extends StackProps {
  envName: EnvName;
}

export class StorageStack extends Stack {
  public readonly documentsBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: StorageStackProps) {
    super(scope, id, props);
    const { envName } = props;

    this.documentsBucket = new s3.Bucket(this, 'DocumentsBucket', {
      bucketName: `shiftmanagementpro-documents-${envName}-${Aws.ACCOUNT_ID}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
    });

    applyProjectTags(this, envName);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd infra && npx jest test/storage-stack.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add infra/lib/storage-stack.ts infra/test/storage-stack.test.ts
git commit -m "feat(infra): add StorageStack for document PDFs/photos"
```

---

### Task 8: ApiStack (API Gateway + custom authorizer + health/me)

**Files:**
- Create: `infra/lib/api-stack.ts`
- Test: `infra/test/api-stack.test.ts`

**Interfaces:**
- Consumes: `EnvName`, `applyProjectTags` from Task 4; `cognito.UserPool`/`cognito.UserPoolClient` (Task 6, passed in as props); `backend/src/authorizer/handler.ts`, `backend/src/health/handler.ts`, `backend/src/me/handler.ts` (Tasks 2–3, referenced by file path — no import, `NodejsFunction` bundles them directly).
- Produces: `class ApiStack extends Stack` with constructor `(scope, id, props: StackProps & { envName: EnvName; userPool: cognito.UserPool; userPoolClient: cognito.UserPoolClient })`, public field `apiUrl: string`. Consumed by Task 10 (wiring).

- [ ] **Step 1: Write the failing test**

```typescript
// infra/test/api-stack.test.ts
import { App, Stack } from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { ApiStack } from '../lib/api-stack';

test('creates a REST API with a public /health and an authorizer-protected /me', () => {
  const app = new App();
  const authHost = new Stack(app, 'AuthHostStack');
  const userPool = new cognito.UserPool(authHost, 'UP');
  const userPoolClient = new cognito.UserPoolClient(authHost, 'UPC', { userPool });

  const stack = new ApiStack(app, 'TestApiStack', {
    envName: 'dev',
    userPool,
    userPoolClient,
  });
  const template = Template.fromStack(stack);

  template.resourceCountIs('AWS::ApiGateway::RestApi', 1);
  template.hasResourceProperties('AWS::ApiGateway::Method', {
    HttpMethod: 'GET',
    AuthorizationType: 'NONE',
  });
  template.hasResourceProperties('AWS::ApiGateway::Method', {
    HttpMethod: 'GET',
    AuthorizationType: 'CUSTOM',
  });
  template.hasResourceProperties('AWS::ApiGateway::Authorizer', {
    Type: 'TOKEN',
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd infra && npx jest test/api-stack.test.ts`
Expected: FAIL — `Cannot find module '../lib/api-stack'`

- [ ] **Step 3: Write minimal implementation**

```typescript
// infra/lib/api-stack.ts
import * as path from 'path';
import { Stack, StackProps, Duration } from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import type { Construct } from 'constructs';
import type { EnvName } from './config';
import { applyProjectTags } from './tags';

export interface ApiStackProps extends StackProps {
  envName: EnvName;
  userPool: cognito.UserPool;
  userPoolClient: cognito.UserPoolClient;
}

export class ApiStack extends Stack {
  public readonly apiUrl: string;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);
    const { envName, userPool, userPoolClient } = props;

    const authorizerFn = new NodejsFunction(this, 'AuthorizerFunction', {
      entry: path.join(__dirname, '../../backend/src/authorizer/handler.ts'),
      handler: 'handler',
      environment: {
        USER_POOL_ID: userPool.userPoolId,
        USER_POOL_CLIENT_ID: userPoolClient.userPoolClientId,
      },
    });

    const tokenAuthorizer = new apigateway.TokenAuthorizer(this, 'Authorizer', {
      handler: authorizerFn,
      resultsCacheTtl: Duration.minutes(5),
    });

    const healthFn = new NodejsFunction(this, 'HealthFunction', {
      entry: path.join(__dirname, '../../backend/src/health/handler.ts'),
      handler: 'handler',
    });

    const meFn = new NodejsFunction(this, 'MeFunction', {
      entry: path.join(__dirname, '../../backend/src/me/handler.ts'),
      handler: 'handler',
    });

    const api = new apigateway.RestApi(this, 'Api', {
      restApiName: `ShiftManagementPro-Api-${envName}`,
    });

    api.root
      .addResource('health')
      .addMethod('GET', new apigateway.LambdaIntegration(healthFn));

    api.root.addResource('me').addMethod('GET', new apigateway.LambdaIntegration(meFn), {
      authorizer: tokenAuthorizer,
      authorizationType: apigateway.AuthorizationType.CUSTOM,
    });

    this.apiUrl = api.url;
    applyProjectTags(this, envName);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd infra && npx jest test/api-stack.test.ts`
Expected: PASS. Note: this requires `esbuild` to be resolvable (installed in Task 4's `infra/package.json` devDependencies) so `NodejsFunction` can bundle the backend handlers.

- [ ] **Step 5: Commit**

```bash
git add infra/lib/api-stack.ts infra/test/api-stack.test.ts
git commit -m "feat(infra): add ApiStack with custom authorizer, health and me routes"
```

---

### Task 9: FrontendStack (S3 + CloudFront)

**Files:**
- Create: `infra/lib/frontend-stack.ts`
- Test: `infra/test/frontend-stack.test.ts`

**Interfaces:**
- Consumes: `EnvName`, `applyProjectTags` from Task 4.
- Produces: `class FrontendStack extends Stack` with constructor `(scope, id, props: StackProps & { envName: EnvName })`, public field `distributionDomainName: string`. Not consumed by other tasks in this plan (the frontend is uploaded to this bucket manually/by CI once built — out of scope here).

- [ ] **Step 1: Write the failing test**

```typescript
// infra/test/frontend-stack.test.ts
import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { FrontendStack } from '../lib/frontend-stack';

test('creates a private site bucket and a CloudFront distribution', () => {
  const app = new App();
  const stack = new FrontendStack(app, 'TestFrontendStack', { envName: 'dev' });
  const template = Template.fromStack(stack);

  template.resourceCountIs('AWS::S3::Bucket', 1);
  template.resourceCountIs('AWS::CloudFront::Distribution', 1);
  template.hasResourceProperties('AWS::S3::Bucket', {
    PublicAccessBlockConfiguration: {
      BlockPublicAcls: true,
      BlockPublicPolicy: true,
      IgnorePublicAcls: true,
      RestrictPublicBuckets: true,
    },
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd infra && npx jest test/frontend-stack.test.ts`
Expected: FAIL — `Cannot find module '../lib/frontend-stack'`

- [ ] **Step 3: Write minimal implementation**

```typescript
// infra/lib/frontend-stack.ts
import { Stack, StackProps, Aws } from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import type { Construct } from 'constructs';
import type { EnvName } from './config';
import { applyProjectTags } from './tags';

export interface FrontendStackProps extends StackProps {
  envName: EnvName;
}

export class FrontendStack extends Stack {
  public readonly distributionDomainName: string;

  constructor(scope: Construct, id: string, props: FrontendStackProps) {
    super(scope, id, props);
    const { envName } = props;

    const siteBucket = new s3.Bucket(this, 'SiteBucket', {
      bucketName: `shiftmanagementpro-frontend-${envName}-${Aws.ACCOUNT_ID}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
    });

    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(siteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      defaultRootObject: 'index.html',
    });

    this.distributionDomainName = distribution.distributionDomainName;
    applyProjectTags(this, envName);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd infra && npx jest test/frontend-stack.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add infra/lib/frontend-stack.ts infra/test/frontend-stack.test.ts
git commit -m "feat(infra): add FrontendStack with S3 + CloudFront static hosting"
```

---

### Task 10: Wire all stacks per environment in `bin/app.ts`

**Files:**
- Create: `infra/bin/app.ts`
- Test: `infra/test/app-synth.test.ts`

**Interfaces:**
- Consumes: `getEnvConfig` (Task 4), `AuthStack` (Task 6), `DataStack` (Task 5), `StorageStack` (Task 7), `ApiStack` (Task 8), `FrontendStack` (Task 9).
- Produces: a working CDK app with 10 stacks (5 concerns x 2 environments), each named via `getEnvConfig(envName).stackName('<Concern>')`.

- [ ] **Step 1: Write `infra/bin/app.ts`**

```typescript
#!/usr/bin/env node
import { App } from 'aws-cdk-lib';
import { getEnvConfig, type EnvName } from '../lib/config';
import { AuthStack } from '../lib/auth-stack';
import { DataStack } from '../lib/data-stack';
import { StorageStack } from '../lib/storage-stack';
import { ApiStack } from '../lib/api-stack';
import { FrontendStack } from '../lib/frontend-stack';

const app = new App();

const envNames: EnvName[] = ['dev', 'prod'];

for (const envName of envNames) {
  const { stackName } = getEnvConfig(envName);

  const authStack = new AuthStack(app, stackName('Auth'), { envName });
  new DataStack(app, stackName('Data'), { envName });
  new StorageStack(app, stackName('Storage'), { envName });
  new ApiStack(app, stackName('Api'), {
    envName,
    userPool: authStack.userPool,
    userPoolClient: authStack.userPoolClient,
  });
  new FrontendStack(app, stackName('Frontend'), { envName });
}
```

- [ ] **Step 2: Write a synth smoke test**

```typescript
// infra/test/app-synth.test.ts
import { execSync } from 'child_process';
import * as path from 'path';

test('cdk synth --all succeeds for every stack', () => {
  const infraDir = path.join(__dirname, '..');
  expect(() =>
    execSync('npx cdk synth --all --quiet', { cwd: infraDir, stdio: 'pipe' })
  ).not.toThrow();
});
```

- [ ] **Step 3: Run the synth test**

Run: `cd infra && npx jest test/app-synth.test.ts`
Expected: PASS — confirms all 10 stacks (`ShiftManagementPro-Auth-dev` … `ShiftManagementPro-Frontend-prod`) synthesize without needing live AWS credentials (no context lookups are used anywhere in this plan).

- [ ] **Step 4: Commit**

```bash
git add infra/bin/app.ts infra/test/app-synth.test.ts
git commit -m "feat(infra): wire all stacks per environment in CDK app entrypoint"
```

---

### Task 11: Frontend scaffold (React + Vite + Tailwind + shadcn/ui + Cognito)

**Files:**
- Create: `frontend/package.json`, `frontend/tsconfig.json`, `frontend/vite.config.ts`
- Create: `frontend/tailwind.config.js`, `frontend/postcss.config.js`, `frontend/components.json`
- Create: `frontend/index.html`, `frontend/.env.example`
- Create: `frontend/src/main.tsx`, `frontend/src/App.tsx`, `frontend/src/index.css`
- Create: `frontend/src/lib/utils.ts`, `frontend/src/lib/auth.ts`
- Create: `frontend/src/components/ui/button.tsx`
- Create: `frontend/src/pages/Login.tsx`, `frontend/src/pages/Home.tsx`
- Test: `frontend/src/App.test.tsx`

**Interfaces:**
- Consumes: `/me` route and its JSON shape `{ sub: string; role: string }` (Task 3); `VITE_USER_POOL_ID`, `VITE_USER_POOL_CLIENT_ID`, `VITE_API_URL` env vars (values come from the deployed `AuthStack`/`ApiStack` outputs — filled in by whoever deploys, not by this task).
- Produces: `signIn(username: string, password: string): Promise<string>` in `frontend/src/lib/auth.ts`, resolving to the Cognito access token. Consumed by `Login.tsx`.

- [ ] **Step 1: Write `frontend/package.json`**

```json
{
  "name": "frontend",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "test": "vitest run"
  },
  "dependencies": {
    "amazon-cognito-identity-js": "^6.3.12",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.1",
    "lucide-react": "^0.436.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "tailwind-merge": "^2.5.0"
  },
  "devDependencies": {
    "@radix-ui/react-slot": "^1.1.0",
    "@testing-library/jest-dom": "^6.4.0",
    "@testing-library/react": "^16.0.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.20",
    "jsdom": "^24.1.0",
    "postcss": "^8.4.41",
    "tailwindcss": "^3.4.10",
    "typescript": "^5.5.0",
    "vite": "^5.4.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Write `frontend/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "noEmit": true,
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Write `frontend/vite.config.ts`**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [],
  },
});
```

- [ ] **Step 4: Write `frontend/tailwind.config.js` and `frontend/postcss.config.js`**

```javascript
// frontend/tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
};
```

```javascript
// frontend/postcss.config.js
module.exports = {
  plugins: { tailwindcss: {}, autoprefixer: {} },
};
```

- [ ] **Step 5: Write `frontend/components.json`** (shadcn/ui config)

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.js",
    "css": "src/index.css",
    "baseColor": "slate",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils"
  }
}
```

- [ ] **Step 6: Write `frontend/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ShiftManagementPro</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 7: Write `frontend/.env.example`**

```
VITE_USER_POOL_ID=
VITE_USER_POOL_CLIENT_ID=
VITE_API_URL=
```

- [ ] **Step 8: Write `frontend/src/index.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 9: Write `frontend/src/lib/utils.ts`** (shadcn's standard `cn` helper)

```typescript
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 10: Write `frontend/src/components/ui/button.tsx`** (shadcn's standard Button)

```typescript
import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-slate-900 text-slate-50 hover:bg-slate-900/90',
        outline: 'border border-slate-200 bg-white hover:bg-slate-100',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
```

- [ ] **Step 11: Write `frontend/src/lib/auth.ts`**

```typescript
import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
} from 'amazon-cognito-identity-js';

const userPool = new CognitoUserPool({
  UserPoolId: import.meta.env.VITE_USER_POOL_ID,
  ClientId: import.meta.env.VITE_USER_POOL_CLIENT_ID,
});

export function signIn(username: string, password: string): Promise<string> {
  const user = new CognitoUser({ Username: username, Pool: userPool });
  const authDetails = new AuthenticationDetails({ Username: username, Password: password });

  return new Promise((resolve, reject) => {
    user.authenticateUser(authDetails, {
      onSuccess: (session) => resolve(session.getAccessToken().getJwtToken()),
      onFailure: (err) => reject(err),
    });
  });
}
```

- [ ] **Step 12: Write `frontend/src/pages/Login.tsx`**

```typescript
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { signIn } from '@/lib/auth';

export function Login({ onSignedIn }: { onSignedIn: (token: string) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const token = await signIn(username, password);
      onSignedIn(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 max-w-sm p-6">
      <h1 className="text-lg font-semibold">Sign in</h1>
      <input
        className="border rounded px-3 py-2"
        placeholder="Email"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />
      <input
        className="border rounded px-3 py-2"
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit">Sign in</Button>
    </form>
  );
}
```

- [ ] **Step 13: Write `frontend/src/pages/Home.tsx`**

```typescript
import { useEffect, useState } from 'react';

export function Home({ token }: { token: string }) {
  const [me, setMe] = useState<{ sub: string; role: string } | null>(null);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}me`, {
      headers: { Authorization: token },
    })
      .then((res) => res.json())
      .then(setMe);
  }, [token]);

  return (
    <div className="p-6">
      <h1 className="text-lg font-semibold">ShiftManagementPro</h1>
      {me ? <p>Signed in as {me.sub} ({me.role})</p> : <p>Loading...</p>}
    </div>
  );
}
```

- [ ] **Step 14: Write `frontend/src/App.tsx`**

```typescript
import { useState } from 'react';
import { Login } from '@/pages/Login';
import { Home } from '@/pages/Home';

export default function App() {
  const [token, setToken] = useState<string | null>(null);
  return token ? <Home token={token} /> : <Login onSignedIn={setToken} />;
}
```

- [ ] **Step 15: Write `frontend/src/main.tsx`**

```typescript
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

- [ ] **Step 16: Write the smoke test**

```typescript
// frontend/src/App.test.tsx
import { render, screen } from '@testing-library/react';
import { test, expect } from 'vitest';
import App from './App';

test('renders the login form when no session exists', () => {
  render(<App />);
  expect(screen.getByText('Sign in')).toBeDefined();
});
```

- [ ] **Step 17: Run the test to verify it passes**

Run: `cd frontend && npm install && npx vitest run src/App.test.tsx`
Expected: PASS

- [ ] **Step 18: Commit**

```bash
git add frontend
git commit -m "feat(frontend): scaffold React + Tailwind + shadcn/ui app with Cognito login"
```

---

### Task 12: CI/CD workflow skeleton

**Files:**
- Create: `.github/workflows/deploy-dev.yml`
- Create: `.github/workflows/deploy-prod.yml`

**Interfaces:**
- Consumes: nothing executable yet — no GitHub remote exists. This task produces files only; no test run is possible until the repo is pushed and secrets/OIDC role are configured (tracked as a follow-up once the user provides the repo).

- [ ] **Step 1: Write `.github/workflows/deploy-dev.yml`**

```yaml
name: Deploy dev

on:
  push:
    branches: [develop]

permissions:
  id-token: write
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm test
      # TODO once repo + AWS OIDC role exist:
      # - uses: aws-actions/configure-aws-credentials@v4
      #   with:
      #     role-to-assume: <arn:aws:iam::ACCOUNT_ID:role/github-deploy-role>
      #     aws-region: ap-southeast-2
      # - run: cd infra && npx cdk deploy --all --context env=dev --require-approval never
```

- [ ] **Step 2: Write `.github/workflows/deploy-prod.yml`**

```yaml
name: Deploy prod

on:
  push:
    branches: [main]

permissions:
  id-token: write
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm test
      # TODO once repo + AWS OIDC role exist:
      # - uses: aws-actions/configure-aws-credentials@v4
      #   with:
      #     role-to-assume: <arn:aws:iam::ACCOUNT_ID:role/github-deploy-role>
      #     aws-region: ap-southeast-2
      # - run: cd infra && npx cdk deploy --all --context env=prod --require-approval never
```

- [ ] **Step 3: Verify the files by reading them back**

Read both files and confirm each parses as a single YAML document with a top-level `on`, `permissions`, and `jobs` key (no automated linter is installed in this repo yet — this is a manual read-back, not an executable test, since the workflows themselves can't run without a GitHub remote).

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/deploy-dev.yml .github/workflows/deploy-prod.yml
git commit -m "chore(ci): scaffold GitHub Actions deploy workflows for dev/prod"
```

---

## Self-Review Notes

- **Spec coverage:** repo layout (Task 1), CDK stack split + tagging (Tasks 4–10), single-table design (Task 5), Cognito + groups (Task 6), custom Lambda authorizer (Task 2, wired in Task 8), S3 storage (Task 7), frontend stack (Task 9), React/Tailwind/shadcn frontend with direct-Cognito auth (Task 11), CI/CD skeleton (Task 12), testing per layer (Jest in 2/3/4-10, Vitest in 11) — all covered. AWS account setup is documented in `CLAUDE.md` (Task 1) and the spec, not re-implemented here since it's a manual, one-time action outside the repo.
- **Placeholder scan:** no TBD/TODO in implementation code; the only `# TODO` lines are in the CI workflows (Task 12), which are intentionally inert until a GitHub repo and AWS OIDC role exist — flagged explicitly in that task's interface note, not a gap.
- **Type consistency:** `EnvName` used identically across config.ts/tags.ts/all stacks; `DataStack.table`, `AuthStack.userPool`/`userPoolClient`, `ApiStack.apiUrl`, `FrontendStack.distributionDomainName` names match between producing and consuming tasks; authorizer context shape `{ role, sub }` matches between Task 2 (produces) and Task 3's `me` handler (consumes).

---

**Plan complete and saved to `docs/superpowers/plans/2026-09-13-project-scaffold.md`. Two execution options:**

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration
2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
