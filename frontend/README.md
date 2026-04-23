# Frontend

This frontend is the visual authoring surface inherited from HRFlow and currently being repurposed for the BankFlow fork.

## Current Role

- provide the workflow and builder shell that will evolve into case-flow authoring
- host transitional UI while HR-specific copy and templates are removed
- support local development against the backend API

## Run Locally

```bash
npm install
npm run dev
```

The Vite dev server runs on `http://localhost:5173` by default.

## Near-Term Direction

- remove HR-specific labels, templates, and onboarding copy
- narrow the node palette to the BankFlow MVP scope
- evolve the builder from generic workflow definitions to banking case-flow definitions
