# BankFlow Frontend

React, TypeScript, and Vite frontend for BankFlow case-flow authoring and operational case work.

## Current Role

- flow list, builder, template application, validation, and publishing
- case queue, case detail, document upload, notes, closure, and cancellation
- My Tasks workbench for assigned, claimable, completed, and overdue work
- Approvals Inbox for pending and historical approval decisions
- dashboard and admin surfaces for local MVP operation

## Run Locally

```bash
npm install
npm run dev
```

The Vite dev server runs on `http://localhost:5173` by default.

## Verification

```bash
npm run test
npm run lint
npm run build
npm run test:e2e
npm run test:e2e:ui
```

The frontend expects the backend API URL from `VITE_API_BASE_URL`; local defaults point to `http://localhost:3000/api`.

## Active Product Direction

- keep the builder palette aligned with backend publish validation
- move operator workflows away from raw JSON and toward schema-driven forms
- continue expanding dedicated operational work surfaces for teams, tasks, approvals, escalations, and audit review
