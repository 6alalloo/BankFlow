# BankFlow Implementation Backlog

## Purpose

This document converts the BankFlow strategy, PRD, and TDD into an execution backlog for the actual fork.

It is designed to be practical for implementation, not just planning. It organizes the work into phases, epics, concrete tasks, dependencies, acceptance criteria, and repo impact areas.

Use this alongside:

- `BANKFLOW_KEEP_REMOVE_REPURPOSE.md`
- `BANKFLOW_PRD.md`
- `BANKFLOW_TDD.md`
- `HRFLOW_PROJECT_WRITEUP.md`

## Backlog Principles

This backlog assumes the following:

1. The BankFlow fork starts from the current HRFlow codebase.
2. The builder and platform shell are preserved where possible.
3. BankFlow, not n8n, becomes the source of truth for case state.
4. The MVP is limited to two end-to-end banking flows:
   - AML alert review
   - payment exception handling
5. The first milestone should produce a safe, coherent platform foundation before heavy feature work continues.

## Delivery Model

Recommended execution model:

- Phase-driven delivery
- GitHub Projects for tracking
- one milestone per phase
- epics broken into independently shippable tasks
- avoid mixing domain refactor and feature implementation in the same PR where possible

Recommended board columns:

- Backlog
- Ready
- In Progress
- Review
- Testing
- Done
- Blocked

Recommended labels:

- `phase:0` through `phase:6`
- `area:frontend`
- `area:backend`
- `area:database`
- `area:builder`
- `area:runtime`
- `area:security`
- `area:docs`
- `area:infra`
- `priority:p0`
- `priority:p1`
- `priority:p2`

## Phase Summary

| Phase | Name | Goal | Exit Condition |
| --- | --- | --- | --- |
| 0 | Fork Hardening | Make the fork safe, clean, and bank-ready as a starting point | no public data exposure, no committed secrets/runtime artifacts, repo naming reset started |
| 1 | Domain Reset | Remove HR-specific assumptions and establish BankFlow naming and schema direction | core banking domain language and schema plan in place |
| 2 | Flow Definition Layer | Refactor the builder and definition model into real BankFlow case flow authoring | designers can create BankFlow case flow definitions coherently |
| 3 | Runtime Orchestrator | Introduce BankFlow-owned case orchestration and task/approval runtime | cases can move through human and automation steps under BankFlow control |
| 4 | Operations UX | Build case inboxes, work views, timelines, and supervisor dashboards | operators and supervisors can actually run the MVP |
| 5 | MVP Use Cases | Implement AML and payment exception templates end to end | both core demo flows work reliably |
| 6 | Hardening And Demo | Test, polish, document, and stabilize the MVP | demonstration-ready MVP with docs and known-risk handling |

## Critical Path

The strict execution dependency chain is:

1. secure and sanitize fork
2. remove HR domain assumptions
3. define new schema and case runtime model
4. adapt builder to BankFlow nodes and contracts
5. implement BankFlow orchestration runtime
6. implement case/task/approval UI
7. build AML and payment exception flows
8. test and stabilize

If time is tight, preserve this order. Delaying runtime ownership or schema redesign will cause churn everywhere else.

## Phase 0: Fork Hardening

### Objective

Start from a safe, clean, non-embarrassing fork before any product repurposing begins.

### Epic BF-0.1: Repository Sanitization

Tasks:

- remove committed runtime files from `backend/uploads/`
- delete `n8n-database.sql` if it contains sensitive or environment-specific state
- delete `n8n-backup.tar.gz` from source control
- replace `.env.example` values with placeholders only
- audit docs for live-looking credentials and internal URLs

Repo impact:

- `backend/uploads/`
- `.env.example`
- `n8n-database.sql`
- `n8n-backup.tar.gz`
- `README.md`
- `SETUP.md`

Acceptance criteria:

- no committed runtime uploads remain
- no example file contains reusable credentials or tokens
- repo can be shared without obvious data leakage concerns

### Epic BF-0.2: Route Security Closure

Tasks:

- add authentication to dashboard routes
- add authentication to execution routes
- add authentication to file routes
- review all remaining route groups for implicit public access
- add regression checks for unauthorized access paths

Repo impact:

- `backend/src/routes/dashboardRoutes.ts`
- `backend/src/routes/executionRoutes.ts`
- `backend/src/routes/fileRoutes.ts`
- `backend/src/middleware/authMiddleware.ts`

Acceptance criteria:

- all non-auth operational routes require authentication
- admin-only routes remain restricted
- unauthorized requests return correct status codes

### Epic BF-0.3: Documentation Reset

Tasks:

- replace HR-oriented top-level docs with BankFlow-oriented fork notes
- clarify actual env loading behavior
- remove stale frontend Vite boilerplate README or replace it
- document the fork intent clearly in the root docs

Repo impact:

- `README.md`
- `SETUP.md`
- `frontend/README.md`

Acceptance criteria:

- docs no longer misrepresent the product as HR-focused
- docs no longer instruct unsafe setup practices

### Epic BF-0.4: Naming Baseline

Tasks:

- choose canonical naming: `flow`, `case flow`, `case`, `task`, `approval`, `queue`, `team`
- create a controlled terminology list in docs
- stop introducing new `workflow/execution` language in new changes unless needed during migration

Acceptance criteria:

- team has one agreed naming set for new code and docs

## Phase 1: Domain Reset

### Objective

Strip the product back to a reusable platform core and define the new banking domain.

### Epic BF-1.1: Remove HR Product Artifacts

Tasks:

- remove HR-specific templates and demo flows
- remove employee onboarding copy from pages and builder
- remove HR sample inputs from workflow run UI
- remove HR-specific variable labels and previews

Repo impact:

- `frontend/src/data/templates.ts`
- `frontend/src/utils/expressionLabels.ts`
- `frontend/src/pages/Workflows/workflowListPage.tsx`
- `frontend/src/components/builder/ConfigPanel.tsx`
- `backend/prisma/seed.ts`

Acceptance criteria:

- UI no longer presents employee/onboarding terminology as first-class behavior
- seed data no longer creates HR examples

### Epic BF-1.2: Remove Non-MVP HR Features

Tasks:

- remove Google Form trigger support from the active BankFlow scope
- remove CV parser node from the default BankFlow node palette
- remove CV parser-specific labels and helpers from frontend config UX
- disable or isolate CV parser backend routes and services unless explicitly retained for later

Repo impact:

- `frontend/src/components/builder/NodePicker.tsx`
- `frontend/src/components/builder/ConfigPanel.tsx`
- `frontend/src/utils/expressionLabels.ts`
- `backend/src/controllers/googleFormController.ts`
- `backend/src/routes/webhookRoutes.ts`
- `backend/src/services/cvParserService.ts`
- `cv-parser/`

Acceptance criteria:

- BankFlow MVP node library does not expose CV/Google Form concepts by default
- fork scope is aligned to banking use cases

### Epic BF-1.3: Schema Redesign Planning

Tasks:

- define the BankFlow runtime entity model in Prisma
- map current `workflows` model to `case_flows`
- map current `executions` model to `cases`, `case_tasks`, and `case_events`
- define `teams`, `team_memberships`, `case_approvals`, `case_escalations`, and `case_documents`
- identify which old tables are dropped versus retained temporarily for migration convenience

Repo impact:

- `backend/prisma/schema.prisma`
- `BANKFLOW_TDD.md`

Acceptance criteria:

- target Prisma model approved
- migration strategy chosen: rename, replace, or parallel tables

### Epic BF-1.4: Versioning Strategy Decision

Tasks:

- decide between explicit flow version tables and case-level graph snapshots
- define how existing cases remain stable after flow edits
- document publish semantics for MVP

Acceptance criteria:

- flow publishing/version behavior is decided before runtime implementation starts

## Phase 2: Flow Definition Layer

### Objective

Turn the existing builder into a coherent BankFlow case flow authoring tool.

### Epic BF-2.1: Builder Rebrand And Route Refactor

Tasks:

- rename workflow routes, pages, and labels to flow/case-flow terminology
- rename visible execution-related navigation to cases where appropriate
- update builder headers, tooltips, and empty states

Repo impact:

- `frontend/src/App.tsx`
- `frontend/src/pages/Workflows/`
- `frontend/src/components/builder/`
- `frontend/src/layout/`

Acceptance criteria:

- designers experience the UI as BankFlow, not HRFlow with renamed docs

### Epic BF-2.2: Node Library Redesign

Tasks:

- replace current node palette with BankFlow MVP nodes
- add node metadata for banking-friendly descriptions and icons
- remove or hide unsupported nodes until runtime support exists
- define node grouping categories such as Intake, Human Work, Decisions, Automation, Governance

Target node set for MVP:

- case intake
- data capture
- approval
- decision
- routing / assignment
- notification
- document upload
- logger / event note
- integration / data action
- timer / SLA
- status update
- escalation

Repo impact:

- `frontend/src/components/builder/NodePicker.tsx`
- `frontend/src/types/nodeConfigs.ts`
- `frontend/src/components/builder/ConfigPanel.tsx`

Acceptance criteria:

- builder palette matches the actual BankFlow MVP node set
- no node in the picker is a known non-functional placeholder

### Epic BF-2.3: Typed Node Config Contracts

Tasks:

- define stable config interfaces for all BankFlow node kinds
- align frontend config names with backend expectations
- add backend validation for node config payloads
- remove current config mismatches inherited from HRFlow

Repo impact:

- `frontend/src/types/nodeConfigs.ts`
- `frontend/src/components/builder/ConfigPanel.tsx`
- `backend/src/services/workflowService.ts`
- new backend validation module for node configs

Acceptance criteria:

- each node kind has a documented config contract
- invalid configs are rejected consistently

### Epic BF-2.4: Flow Definition API Refactor

Tasks:

- rename `workflow` API layer to `flows`
- rename backend routes from `/api/workflows` to `/api/flows` in the fork
- keep temporary compatibility only if needed during migration, otherwise go clean
- align frontend API wrappers and type names

Repo impact:

- `frontend/src/api/workflows.ts`
- `backend/src/routes/workflowRoutes.ts`
- `backend/src/controllers/workflowController.ts`
- `backend/src/services/workflowService.ts`

Acceptance criteria:

- flow definitions are managed through BankFlow-native names across frontend and backend

### Epic BF-2.5: Flow Publishing And Template Support

Tasks:

- implement draft/published status model
- add publish action in builder or flow list
- add template metadata for AML and payment flow templates

Acceptance criteria:

- only published flows can be used for new cases
- templates can be duplicated into editable drafts

## Phase 3: Runtime Orchestrator

### Objective

Replace the HRFlow execution-centered runtime with a BankFlow-owned case orchestration engine.

### Epic BF-3.1: New Runtime Schema Implementation

Tasks:

- implement `cases` table
- implement `case_tasks` table
- implement `case_events` table
- implement `case_approvals` table
- implement `case_escalations` table
- implement `case_documents` table
- implement `teams` and `team_memberships`
- add migrations and safe seed data

Repo impact:

- `backend/prisma/schema.prisma`
- `backend/prisma/seed.ts`

Acceptance criteria:

- schema supports case lifecycle, tasks, approvals, escalations, and documents
- seed data includes safe BankFlow demo roles/users/teams

### Epic BF-3.2: Orchestrator Service Skeleton

Tasks:

- create `caseOrchestratorService`
- load flow graph and determine entry node
- maintain current case state and current node
- define runtime interfaces for node execution
- add event recording hooks

Suggested new modules:

- `backend/src/services/caseOrchestratorService.ts`
- `backend/src/services/nodeExecution/`
- `backend/src/services/caseEventService.ts`

Acceptance criteria:

- backend can create a case instance and evaluate the first runtime step without relying on the old execution service

### Epic BF-3.3: Human Task Runtime

Tasks:

- implement routing/assignment node execution behavior
- create task records for human action nodes
- add task claim, complete, and reassign operations
- update case assignee and status when tasks change state

Acceptance criteria:

- at least one manual task can be created, claimed, completed, and reflected in the case timeline

### Epic BF-3.4: Approval Runtime

Tasks:

- implement approval node behavior
- create approval records and approval tasks
- allow approve and reject outcomes
- route to the correct next edge based on decision

Acceptance criteria:

- approval nodes create pending approvals and block progression until resolved

### Epic BF-3.5: Decision Engine

Tasks:

- implement decision node evaluation in backend
- support core operators for MVP
- map decision outcomes to named or indexed edges
- add tests for routing correctness

Acceptance criteria:

- decision nodes are real runtime features, not UI-only placeholders

### Epic BF-3.6: Timer / SLA Runtime

Tasks:

- implement due date computation for tasks or cases
- implement overdue detection mechanism
- trigger escalation or status changes on breach
- record SLA-related case events

Implementation note:

- MVP can use a simple periodic backend job if a separate queue is too heavy initially

Acceptance criteria:

- at least one SLA node can mark work overdue and trigger configured escalation behavior

### Epic BF-3.7: Automation Node Boundary

Tasks:

- define which nodes call n8n versus execute in backend
- implement correlation IDs for automation calls
- map automation result payloads back into case events and data updates
- stop relying on “latest n8n execution” lookup behavior inherited from HRFlow

Repo impact:

- `backend/src/services/n8nService.ts`
- `backend/src/services/n8nCompiler.ts` or replacement automation translator
- old `executionService.ts` to be retired or repurposed

Acceptance criteria:

- automation results are correlated to the exact case event that triggered them

### Epic BF-3.8: Case Lifecycle API

Tasks:

- add case create/list/detail APIs
- add task list/claim/complete APIs
- add approval approve/reject APIs
- add case event retrieval APIs
- add document association APIs

Acceptance criteria:

- frontend can drive the new runtime fully through explicit BankFlow APIs

## Phase 4: Operations UX

### Objective

Build the screens that operators, approvers, and supervisors actually need.

### Epic BF-4.1: Cases List And Case Detail

Tasks:

- replace or repurpose execution list into case list
- replace execution detail into case detail timeline
- add case header with status, priority, assignee, queue, and current step
- add tabs for overview, tasks, documents, events, audit

Repo impact:

- `frontend/src/pages/Executions/executionListPage.tsx`
- `frontend/src/pages/Executions/executionDetailPage.tsx`
- likely rename page folder to `Cases`

Acceptance criteria:

- operator can open a case and understand its current state and history immediately

### Epic BF-4.2: My Tasks Workbench

Tasks:

- add a “My Tasks” page
- show assigned and claimable tasks
- support claim, complete, and reassign actions
- show due dates and overdue status

Acceptance criteria:

- users can process assigned work without needing admin or builder screens

### Epic BF-4.3: Approvals Inbox

Tasks:

- add approvals list for pending approvals
- support approve and reject actions
- require comments where configured

Acceptance criteria:

- approvers have a dedicated work surface for pending decisions

### Epic BF-4.4: Supervisor Dashboard

Tasks:

- redesign dashboard metrics around cases, queues, overdue items, and escalations
- add widgets for pending approvals, overdue work, active cases by status, and workload distribution

Repo impact:

- `frontend/src/pages/Dashboard/DashboardPage.tsx`
- `frontend/src/api/dashboard.ts`
- `backend/src/services/dashboardService.ts`

Acceptance criteria:

- dashboard answers who owns work, what is overdue, and where bottlenecks are

### Epic BF-4.5: Admin Team And Queue Management

Tasks:

- add team management backend and UI
- support user-to-team membership
- support assignment target selection in builder based on teams/roles

Acceptance criteria:

- routing nodes can target real teams/queues configured in the system

## Phase 5: MVP Use Cases

### Objective

Build the two core templates and prove the platform works end to end.

### Epic BF-5.1: AML Alert Review Flow

Tasks:

- define the AML flow with intake, routing, review, approval/escalation, and closure
- implement the required case data schema for the flow
- seed demo scenarios and realistic test data
- validate happy path and escalation path

Acceptance criteria:

- AML analysts and supervisors can demonstrate a full case from intake to closure

### Epic BF-5.2: Payment Exception Handling Flow

Tasks:

- define the payment exception flow with intake, routing, decision, approval/escalation, and resolution
- implement any amount- or type-based decision logic needed in the template
- seed demo exception cases

Acceptance criteria:

- payment operations users can demonstrate a full case from intake to resolution/closure

### Epic BF-5.3: Demo Data And Narratives

Tasks:

- prepare seeded users, teams, roles, flows, and cases for demo
- create clean demo narratives for both use cases
- ensure all demo screens show coherent BankFlow language and data

Acceptance criteria:

- demo can be run repeatedly from a clean local setup

## Phase 6: Hardening And Demo Readiness

### Objective

Make the MVP reliable, explainable, and demo-ready.

### Epic BF-6.1: Automated Test Coverage

Tasks:

- add backend tests for auth, task lifecycle, decision routing, approval outcomes, SLA escalation, and case events
- add frontend tests for builder config flows, case detail rendering, task actions, and approvals inbox
- add end-to-end tests for AML and payment exception scenarios

Acceptance criteria:

- core runtime behavior has automated regression coverage

### Epic BF-6.2: Validation And Error UX

Tasks:

- improve builder validation messages
- improve case action error handling
- ensure errors are understandable without leaking internals

Acceptance criteria:

- invalid flow configs and failed case actions are visible and understandable

### Epic BF-6.3: Performance And Reliability Pass

Tasks:

- inspect expensive dashboard queries
- review case list pagination and filtering
- review task/approval inbox query patterns
- verify no race-prone “latest result” logic remains

Acceptance criteria:

- no known critical correctness issue remains in the MVP demo path

### Epic BF-6.4: Final Documentation Set

Tasks:

- update root README for BankFlow
- add deployment guide
- add user guide for designers/operators/supervisors
- add architecture summary diagrams
- document known limitations

Acceptance criteria:

- a new contributor can start and understand the MVP without old HRFlow assumptions

## Parallel Workstreams

These can run partially in parallel after Phase 1 decisions are stable:

### Workstream A: Builder And Frontend Refactor

- Phase 2 epics
- parts of Phase 4

### Workstream B: Schema And Runtime

- Phase 3 epics
- backend portions of Phase 5

### Workstream C: Security And Documentation

- Phase 0 epics
- Phase 6 docs/test hardening

### Workstream D: Templates And Demo Assets

- can start in draft form during late Phase 2
- final implementation should wait for Phase 3 runtime stability

## Suggested Issue Breakdown

To make this backlog immediately actionable, use issue sizes like this:

- `S`: 0.5-1 day
- `M`: 1-2 days
- `L`: 2-4 days
- `XL`: 4+ days, should usually be split further

Examples:

- BF-0.2 secure dashboard/execution/file routes: `M`
- BF-1.3 Prisma schema redesign: `L`
- BF-2.2 node library redesign: `L`
- BF-3.2 orchestrator service skeleton: `L`
- BF-3.6 timer/SLA runtime: `L` or `XL`
- BF-4.2 My Tasks workbench: `L`
- BF-5.1 AML template: `M`

## Definition Of Done Per Phase

### Phase 0 Done

- repo is safe to share and work from
- obvious security gaps are closed

### Phase 1 Done

- HR assumptions are removed from the product direction
- target BankFlow domain model is locked

### Phase 2 Done

- builder creates real BankFlow flow definitions with supported nodes only

### Phase 3 Done

- cases, tasks, approvals, decisions, escalations, and automation can execute under BankFlow control

### Phase 4 Done

- operators, approvers, and supervisors can all use the system through dedicated screens

### Phase 5 Done

- AML and payment exception use cases work end to end

### Phase 6 Done

- demo is stable, documented, and test-backed

## Recommended First 10 Issues

If implementation starts immediately, create these first:

1. Remove secrets, backups, and runtime artifacts from the repo.
2. Secure dashboard, execution, and file routes.
3. Replace HR templates and seed data with neutral placeholders.
4. Decide and document BankFlow naming conventions.
5. Draft final Prisma schema for case flows, cases, tasks, approvals, teams, documents, and events.
6. Decide flow versioning approach.
7. Redesign builder node palette for BankFlow MVP nodes.
8. Define typed node config contracts shared by frontend and backend.
9. Scaffold `caseOrchestratorService` and new runtime modules.
10. Create `cases` and `tasks` APIs with initial list/detail endpoints.

## Final Note

The fastest way to fail this fork is to keep treating it like “HRFlow with different labels.” The fastest way to succeed is to use the existing builder and platform structure while decisively replacing the runtime and domain model with BankFlow-native case orchestration concepts.
