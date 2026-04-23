# BankFlow Transformation Map

## Purpose

This document translates the current HRFlow codebase into a practical transformation plan for BankFlow, a banking case orchestration platform.

It answers three questions:

1. What parts of HRFlow should be kept because they are reusable platform assets?
2. What parts should be removed because they are HR-specific, misleading, insecure, or out of scope for BankFlow?
3. What parts should be repurposed, meaning the existing structure is useful but the behavior, schema, or UI will need major changes?

This document should be used together with:

- `HRFLOW_PROJECT_WRITEUP.md`
- `BANKFLOW_PRD.md`
- `BANKFLOW_TDD.md`

## Executive View

The current repository is not a bad starting point for BankFlow. It already contains the right class of building blocks:

- a visual workflow builder
- workflow graph persistence
- auth and roles
- admin pages
- audit logging foundation
- execution timeline UX
- Dockerized local environment
- a workflow compilation boundary

However, HRFlow is currently optimized around HR automation flows and treats n8n as the primary execution engine for almost everything. BankFlow needs a different center of gravity:

- BankFlow must own the case lifecycle, human tasks, approvals, assignments, SLA tracking, escalation logic, and audit-grade state.
- n8n should be retained only as an automation worker for system-action nodes, not as the authoritative owner of case state.

That distinction drives most of the keep/remove/repurpose decisions below.

## 1. Keep

These parts are worth preserving with only moderate cleanup or renaming.

### 1.1 Core Frontend Platform Shell

Keep:

- React + TypeScript + Vite frontend stack
- route shell and protected route structure
- layout and navigation scaffolding
- dashboard component scaffolding
- admin section scaffolding

Why keep it:

- It already supports a secure internal operations product shape.
- It gives BankFlow a fast path to a usable internal web app.
- The layout patterns fit case operations software well.

Files of interest:

- `frontend/src/App.tsx`
- `frontend/src/layout/`
- `frontend/src/pages/Admin/`
- `frontend/src/pages/Dashboard/`

### 1.2 Visual Builder Foundation

Keep:

- ReactFlow-based builder canvas
- dagre auto-layout approach
- node picker
- config panel architecture
- node and edge persistence flow
- ghost node insertion pattern
- split layout/full-screen builder approach

Why keep it:

- This is the most valuable reusable core in the repo.
- The builder is already the right interaction model for designing case flows.
- The canvas, auto-layout, and node config patterns are general-purpose.

Files of interest:

- `frontend/src/pages/Workflows/workflowBuilderPage.tsx`
- `frontend/src/components/builder/`
- `frontend/src/components/HRFlowNode.tsx`

### 1.3 Workflow Graph Persistence Pattern

Keep:

- storing definitions as workflows + nodes + edges
- node config JSON per node
- edge condition JSON per edge
- backend graph CRUD routes and services

Why keep it:

- BankFlow still needs a configurable graph model.
- The current storage pattern is simple and flexible.

What changes later:

- rename workflows to flows or case flows
- introduce versioning discipline
- enrich nodes and edges with banking-specific semantics

Files of interest:

- `backend/src/services/workflowService.ts`
- `backend/src/routes/workflowRoutes.ts`
- `backend/prisma/schema.prisma`

### 1.4 Auth And Role Foundation

Keep:

- JWT-based authentication flow
- bcrypt password hashing
- auth middleware shape
- admin-only route protection pattern
- user and role management pages and backend services

Why keep it:

- BankFlow needs internal-user auth, roles, and admin control.
- The current implementation is a valid foundation.

What changes later:

- stronger route protection coverage
- richer roles and team/queue semantics
- possibly session hardening and token lifecycle improvements

Files of interest:

- `backend/src/services/authService.ts`
- `backend/src/middleware/authMiddleware.ts`
- `backend/src/services/userService.ts`
- `backend/src/services/roleService.ts`
- `frontend/src/contexts/AuthContext.tsx`

### 1.5 Audit Logging Foundation

Keep:

- audit log table and service pattern
- audit log admin screens
- event logging hooks for important actions

Why keep it:

- Auditability is central to BankFlow.
- The current repo already treats audit as a first-class concern.

What changes later:

- make audit events richer and more domain-specific
- distinguish immutable case events from administrative audit logs
- improve actor, subject, before/after, and trace metadata

Files of interest:

- `backend/src/services/auditService.ts`
- `backend/src/routes/auditRoutes.ts`
- `frontend/src/pages/Admin/AuditLogPage.tsx`

### 1.6 Execution Detail UX Pattern

Keep:

- split timeline/detail execution page pattern
- step-by-step status display
- per-step input/output JSON rendering
- run status and error surfacing

Why keep it:

- BankFlow will need a case timeline and execution trace.
- The current UI pattern translates well to case progress, task events, approvals, and escalations.

What changes later:

- rename execution to case instance or case run
- add assignee, due date, queue, SLA, comments, approvals, and attachments

Files of interest:

- `frontend/src/pages/Executions/executionDetailPage.tsx`
- `frontend/src/pages/Executions/executionListPage.tsx`

### 1.7 Prisma + Express Service Layer Organization

Keep:

- route/controller/service layering
- Prisma as ORM and schema owner
- centralized app config and service config modules

Why keep it:

- The repo is already structured like a maintainable product, not a throwaway prototype.
- The service split is good enough to evolve into BankFlow.

### 1.8 Dockerized Local Development Model

Keep:

- Docker Compose-based local environment
- PostgreSQL container
- backend/frontend split

Why keep it:

- BankFlow still needs easy local development and demo deployment.

What changes later:

- remove baked-in secrets and backups
- simplify services that are no longer needed
- make environment setup safer

## 2. Remove

These parts should be removed from the BankFlow fork because they are domain-specific baggage, unsafe defaults, or out of scope.

### 2.1 HR Branding, Copy, And Naming

Remove:

- `HRFlow` name from UI, code comments, docs, route labels, and seeded data
- HR-specific copy in pages and components
- employee onboarding language throughout the builder and templates

Why remove it:

- It will confuse the product direction immediately.
- BankFlow needs its own domain language from day one.

### 2.2 HR-Specific Templates And Sample Flows

Remove:

- onboarding templates
- IT access provisioning templates
- interview scheduling templates
- any seed workflow that models HR processes

Why remove it:

- They encode the wrong business semantics.
- They make the builder appear more complete than it is.

Replace with:

- AML alert review template
- payment exception handling template

### 2.3 HR Domain Data Model

Remove from the primary schema:

- `employees`
- `jobs`
- `candidates`
- `applications`
- `resumes`
- `email_templates` if not needed immediately
- `webhooks` and `data_stores` if not needed for MVP

Why remove it:

- These are HR-domain tables, not banking case orchestration tables.
- Keeping them will create schema noise and wrong assumptions.

### 2.4 CV Parser As A Core First-Class Feature

Remove from core MVP scope:

- resume/CV parsing as a default workflow feature
- CV-specific trigger variables and labels
- CV-specific node language in the builder

Why remove it:

- It is not aligned to the proposed banking MVP.
- Document handling is needed, but resume parsing is not the right primitive.

Possible later outcome:

- reintroduce a generalized document extraction service only if a banking use case truly needs it

### 2.5 Google Form Integration

Remove from initial BankFlow MVP:

- Google Form trigger mode
- prefilled form URL generation
- Google Form webhook normalization logic

Why remove it:

- Banking operations require controlled internal intake, not public form-driven intake as a core mechanism.
- It adds integration complexity without contributing to AML review or payment exception handling MVP goals.

Possible later outcome:

- replace with internal case intake forms or an authenticated portal

### 2.6 n8n Backup Artifacts And Embedded Credentials

Remove:

- `n8n-database.sql`
- `n8n-backup.tar.gz`
- any setup flow that depends on committed credentials or a pre-restored n8n instance
- real-looking keys and credential IDs from `.env.example`

Why remove it:

- These are operationally risky and poor hygiene.
- BankFlow should not depend on checked-in secrets or hidden n8n state.

### 2.7 Runtime Upload Artifacts

Remove:

- committed files under `backend/uploads`

Why remove it:

- They are runtime artifacts, not source.
- In a banking-context fork, storing stray uploaded files in the repo is unacceptable.

### 2.8 HR-Specific Variable Labels And Demo Inputs

Remove:

- employee-focused trigger variable labels
- manager email, department, role defaults
- workflow run modals centered on employee onboarding input

Why remove it:

- BankFlow should model case attributes, not employee onboarding fields.

## 3. Repurpose And Change Significantly

These are the most important parts of the transformation. The structure is useful, but the behavior needs to change materially.

### 3.1 Workflow Definition Model -> Case Flow Definition Model

Repurpose:

- `workflows` -> `case_flows`
- `workflow_nodes` -> `case_flow_nodes`
- `workflow_edges` -> `case_flow_edges`

Key change:

- A workflow is no longer just an automation chain.
- A case flow becomes a governed operational process definition that can create, route, pause, approve, escalate, and resolve cases.

What must change:

- naming
- metadata fields
- versioning model
- archive/publish model
- template strategy

### 3.2 Execution Model -> Case Orchestration Model

Repurpose:

- `executions` -> `cases` or `case_instances`
- `execution_steps` -> `case_events`, `case_tasks`, or both

Key change:

- HRFlow treats execution as a mostly automated runtime event.
- BankFlow needs long-lived case instances with human steps, assignments, approvals, due dates, and state transitions.

What must change:

- execution lifecycle becomes case lifecycle
- completed/failed becomes richer status model
- step records become a mix of tasks, events, and automation outcomes

### 3.3 n8n Integration -> Automation Worker Integration

Repurpose:

- the n8n compiler/service boundary

Key change:

- In HRFlow, n8n is effectively the execution engine for the full flow.
- In BankFlow, n8n should execute automation nodes only, while BankFlow owns orchestration state.

What must change:

- BankFlow should decide which node is next, not n8n alone.
- human nodes should create pending tasks in BankFlow, not get flattened into n8n no-ops or awkward webhooks.
- timers and SLA deadlines should be tracked in BankFlow data, even if an external worker helps trigger them.

Recommended target model:

- BankFlow runtime engine drives the case graph.
- n8n is called only for automation/integration nodes such as notifications, external API calls, enrichment, or database actions.

### 3.4 Trigger Node -> Case Intake Node

Repurpose:

- `trigger`

Key change:

- replace employee-centric trigger input with case intake schema

New behavior:

- select case type
- capture core case metadata
- declare intake source
- initialize case status and priority

### 3.5 Email Node -> Notification Node

Repurpose:

- `email`

Key change:

- expand from email-only semantics to notification semantics

New behavior:

- email for MVP
- future support for internal alerts, queue notifications, maybe SMS or chat integration

### 3.6 Database Node -> Integration / Data Action Node

Repurpose:

- `database`

Key change:

- move away from HR table assumptions and ambiguous pseudo-CRUD UX

New behavior:

- explicit internal case data updates
- optional external integration actions
- controlled query/write actions with whitelisted destinations and clear contracts

### 3.7 Wait Node -> Timer / SLA Node

Repurpose:

- `wait`

Key change:

- turn an unsupported delay placeholder into a real banking operations primitive

New behavior:

- due dates
- SLA countdowns
- breach actions
- escalations
- overdue flags

### 3.8 Condition Node -> Decision Node

Repurpose:

- `condition`

Key change:

- implement it for real

New behavior:

- evaluate case data, task outcomes, amounts, risk scores, queue ownership, or prior approvals
- route to true/false or multi-path branches

### 3.9 Variable Node -> Case Data / Derived Data Node

Repurpose:

- `variable`

Key change:

- make it operate on case data fields instead of ad hoc strings

New behavior:

- set case fields
- derive values
- normalize inputs
- compute helper values for later decisions

### 3.10 Logger Node -> Audit / Event Note Node

Repurpose:

- `logger`

Key change:

- logging in BankFlow should usually become visible event history, not just technical debug state

New behavior:

- append structured case events
- store operator-visible notes where appropriate
- keep technical logs separate from business events

### 3.11 Dashboard -> Oversight And Operations Monitoring

Repurpose:

- dashboard stats and charts

Key change:

- shift from workflow execution metrics to operational case metrics

New views should include:

- active cases by queue
- overdue cases
- cases by state
- average turnaround time
- pending approvals
- escalations by type
- analyst/team workload distribution

### 3.12 Security Model -> Banking-Grade Internal Governance Model

Repurpose:

- existing auth, role, and settings foundation

Key change:

- BankFlow requires much tighter route protection, access control, audit, and data handling discipline

New requirements:

- all operational APIs authenticated
- queue/team-based access boundaries
- stricter audit event modeling
- environment-driven secrets only
- sanitized seed data and fixtures

### 3.13 File Upload Service -> Case Document Service

Repurpose:

- file upload route and service pattern

Key change:

- documents are supporting case records, not ad hoc workflow attachments only

New behavior:

- documents linked to cases and maybe specific steps or tasks
- metadata stored durably in DB
- access controls enforced
- retention model defined

## 4. What BankFlow Needs That HRFlow Does Not Yet Have

These are not just repurposes. They are material additions.

### 4.1 Case Domain Model

BankFlow needs first-class concepts for:

- case
- case type
- case status
- case priority
- case assignee
- case queue or team
- task
- approval request
- escalation
- SLA deadline
- document attachment
- case comment or note

### 4.2 Human Task Engine

BankFlow needs a runtime model for:

- assign task to user
- assign task to role or team
- claim task
- complete task
- reject task
- send for rework
- create approval task

This does not exist in HRFlow today.

### 4.3 Case Lifecycle Management

BankFlow needs explicit statuses such as:

- intake
- in_review
- pending_approval
- escalated
- resolved
- closed

The current execution model is too narrow for this.

### 4.4 SLA And Escalation Engine

BankFlow needs:

- due dates per task or node
- timer-based breach detection
- automatic escalation actions
- overdue views for supervisors

### 4.5 Queue And Team Model

BankFlow needs organization structures beyond plain roles:

- teams
- queues
- supervisors
- approver groups

### 4.6 Domain Templates

BankFlow MVP needs at least two real templates:

- AML alert review
- payment exception handling

## 5. Recommended Transformation Sequence

### Phase 1: Strip The Repo Back To A Safe Platform Core

Do first:

- remove HR branding and docs
- remove HR templates and HR sample data
- remove CV parser from default product scope
- remove Google Form flow from MVP scope
- remove committed secrets and runtime artifacts
- secure public routes

### Phase 2: Rename And Reframe The Domain

Then:

- rename workflow concepts to case flow concepts
- rename execution concepts to case and task concepts
- replace HR language in node labels and builder copy

### Phase 3: Introduce The BankFlow Domain Model

Then:

- redesign Prisma schema around cases, tasks, approvals, queues, documents, and SLA events
- update dashboard aggregation logic
- update seed data and roles

### Phase 4: Rebuild The Node Library For Banking Operations

Then:

- implement real decision node support
- implement timer/SLA node support
- implement approval and routing nodes
- implement status update and escalation nodes

### Phase 5: Shift Runtime Ownership Into BankFlow

Then:

- move orchestration ownership into BankFlow backend
- retain n8n only for automation nodes
- make case state persistent and authoritative in BankFlow

### Phase 6: Deliver MVP Templates And Oversight Views

Finally:

- AML alert review flow
- payment exception handling flow
- supervisor oversight dashboard
- case detail timeline and task workbench

## 6. Summary Table

| Area | Decision | Notes |
| --- | --- | --- |
| Frontend app shell | Keep | Good internal-product foundation |
| Builder canvas | Keep | Most valuable reusable asset |
| Workflow graph storage | Keep and rename | Becomes case flow model |
| Auth and admin | Keep and harden | Expand to team/queue-aware governance |
| Audit logging | Keep and deepen | Add immutable case event model |
| Execution timeline UX | Keep and repurpose | Becomes case timeline and task history |
| n8n integration | Keep but reduce role | Use for automation nodes only |
| HR schema tables | Remove | Replace with banking case model |
| CV parser | Remove from MVP core | Optional later as document extraction |
| Google Form intake | Remove from MVP | Replace with internal intake forms |
| HR templates | Remove | Replace with AML and payment templates |
| Wait node | Repurpose heavily | Real timer/SLA node |
| Condition node | Repurpose heavily | Real decision node |
| Database node | Repurpose heavily | Internal data action and integrations |
| Email node | Repurpose | Notification node |
| Variable node | Repurpose | Case data and derived fields |
| Dashboard | Repurpose | Oversight, workload, SLA, case metrics |

## 7. Final Recommendation

The right way to fork this repository into BankFlow is not to “rename HRFlow and keep building.” The right move is:

1. preserve the builder, auth/admin shell, graph persistence model, and general product structure
2. remove the HR-specific domain and unsafe setup shortcuts
3. redesign the runtime so BankFlow owns case orchestration and n8n becomes an automation helper

That approach preserves the strongest existing assets while aligning the new product with what banking case orchestration actually requires.
