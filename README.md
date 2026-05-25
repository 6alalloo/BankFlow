# BankFlow

BankFlow is a local full-stack case-flow platform with an Express/Prisma backend and a React/Vite frontend.

## Verification

Use these checks before opening a pull request:

```powershell
cd backend
npm.cmd test
npm.cmd run build

cd ../frontend
npm.cmd run lint
npm.cmd test
npm.cmd run build
```

For end-to-end smoke coverage, start the Postgres database, apply migrations, seed demo data, run the backend and frontend, then run:

```powershell
cd frontend
npm.cmd run test:e2e
```

GitHub Actions mirrors these gates in `.github/workflows/ci.yml`, including an E2E smoke job backed by a temporary Postgres service.
