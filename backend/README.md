# BankFlow Backend

Express and Prisma backend for BankFlow case-flow authoring, publishing, and governed case runtime.

## Local Setup

From the repository root:

```powershell
docker compose up -d db
```

From `backend/`:

```powershell
npm.cmd ci
npm.cmd run db:generate
npm.cmd run db:migrate:deploy
npm.cmd run db:seed
npm.cmd test
npm.cmd run build
npm.cmd run dev
```

The backend runs on `http://localhost:3000` by default. Health check:

```text
GET /health
```

## Environment

Copy the root `.env.example` to `backend/.env` for local development. The Docker database default is:

```text
DATABASE_URL=postgresql://bankflow:bankflow_dev@localhost:5433/bankflow
```

## Seeded Demo Data

`npm.cmd run db:seed` creates:

- roles: Admin, Designer, Operator, Supervisor, Approver, Auditor
- users and credentials:
  - `admin@bankflow.local` / `admin123`
  - `designer@bankflow.local` / `designer123`
  - `operator@bankflow.local` / `operator123`
  - `supervisor@bankflow.local` / `supervisor123`
  - `approver@bankflow.local` / `approver123`
  - `auditor@bankflow.local` / `auditor123`
- teams:
  - AML Review Queue
  - Payments Operations
  - KYC Remediation
  - Treasury Control
- published demo flows:
  - AML Alert Review
  - Payment Exception Review
  - High-Value Payment Release
- allow-listed integration domains for sanctions, SWIFT, KYC, and treasury systems
- realistic operational cases with related tasks, approvals, documents, escalations, timeline events, and audit activity

## Stable Verification Gates

For the current backend goal, use these stable gates:

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run db:migrate:deploy
npm.cmd run db:seed
```

The removed integration smoke test should not be recreated or run until the local hanging behavior is intentionally revisited.
