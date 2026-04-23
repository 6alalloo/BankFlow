# BankFlow Product Requirements Document

## 1. Document Purpose

This document defines the product requirements for BankFlow, a configurable banking case orchestration platform derived from the reusable platform core of HRFlow.

This is the high-level product document. It focuses on:

- product vision
- problem definition
- target users
- MVP scope
- business and user requirements
- success criteria
- functional and non-functional requirements
- delivery priorities

Implementation details live in `BANKFLOW_TDD.md`.

## 2. Product Summary

BankFlow is a web-based internal case orchestration platform for banking operations. It allows authorized users to design case flows visually using a drag-and-drop builder, create and process live cases through those flows, route work between teams, enforce approvals and SLA deadlines, monitor progress, and maintain a full audit trail of actions and decisions.

Every operational item is treated as a case that progresses through a controlled lifecycle such as:

- intake
- review
- enrichment
- decision
- assignment
- approval
- escalation
- resolution
- closure

The MVP will demonstrate the platform using two use cases:

- AML alert review
- payment exception handling

## 3. Problem Statement

Internal banking operations often rely on disconnected tools such as email, spreadsheets, chat, shared drives, and fragmented internal systems. This creates recurring operational problems:

- cases are handed off manually
- ownership becomes unclear
- status visibility is poor
- escalations happen late or inconsistently
- approvals are hard to track
- document evidence is scattered
- audit reconstruction is painful
- supervisors lack live workload and bottleneck visibility

Existing point solutions often handle only one narrow function and do not provide a reusable orchestration model across case types.

BankFlow addresses this by giving banks a configurable case orchestration layer with a reusable builder, controlled execution model, and strong operational governance.

## 4. Product Vision

BankFlow should become a reusable internal orchestration platform for structured operational work in banks.

The long-term vision is:

- one platform for defining multiple case types
- one consistent operating model for assignments, approvals, deadlines, and audit
- one oversight view for active work, delays, and outcomes
- one configurable node library that can be extended to new banking processes without rewriting the application

## 5. Product Goals

### 5.1 Primary Goals

BankFlow must:

1. Allow authorized users to design banking case flows using a visual builder.
2. Allow operators to create and process live cases through those flows.
3. Support routing, approvals, escalation, and resolution as first-class concepts.
4. Provide supervisors with live visibility into case state, workload, and overdue work.
5. Record a full, retrievable audit history of significant user and system actions.

### 5.2 MVP Goals

The MVP specifically must:

1. Support end-to-end case orchestration for AML alert review.
2. Support end-to-end case orchestration for payment exception handling.
3. Deliver a configurable node library covering all MVP process primitives.
4. Demonstrate secure internal access, role-based permissions, and auditability.
5. Be runnable locally in a containerized environment for demonstration.

## 6. Non-Goals For MVP

The MVP will not aim to solve every enterprise banking requirement.

Out of scope for MVP unless explicitly added later:

- customer-facing portals
- mobile apps
- advanced OCR or document intelligence as a core requirement
- full enterprise identity provider integration
- full-fledged BPMN engine replacement
- multi-tenant bank hosting model
- externalized rules engine
- real production banking core integrations across many systems
- analytics warehouse or BI platform integration
- multi-language UI

## 7. Target Users

### 7.1 Workflow Designer

Typical role:

- operations analyst
- process owner
- business systems analyst
- implementation lead

Needs:

- define case flows visually
- configure node behavior without code changes
- publish and update flow definitions safely

### 7.2 Case Operator

Typical role:

- AML analyst
- operations officer
- payment operations specialist
- compliance reviewer

Needs:

- view assigned work
- act on tasks
- update case data
- upload documents
- record decisions
- move work forward without ambiguity

### 7.3 Approver / Supervisor

Typical role:

- team lead
- operations manager
- compliance manager
- escalation authority

Needs:

- approve or reject work
- see pending approvals
- monitor queue health
- intervene in escalated or overdue cases

### 7.4 Auditor / Oversight User

Typical role:

- internal audit
- risk
- compliance oversight

Needs:

- inspect case history
- review decisions and timestamps
- verify who did what and when
- trace final outcomes back through the lifecycle

### 7.5 Platform Administrator

Needs:

- manage users, roles, and permissions
- maintain reference data and templates
- manage environment-level settings
- support operational continuity

## 8. Core Product Concepts

### 8.1 Case Flow

A case flow is the reusable process definition created in the builder.

Examples:

- AML alert review
- payment exception handling
- sanctions escalation
- account closure review

### 8.2 Case

A case is a live instance of work created from a case flow.

Examples:

- one specific AML alert under investigation
- one specific failed payment requiring manual intervention

### 8.3 Node

A node is a process building block used in the visual builder.

For MVP, the platform should support nodes such as:

- case intake trigger
- data capture
- approval
- decision
- routing / assignment
- notification
- document upload
- logger / case event
- integration / data action
- timer / SLA
- status update
- escalation

### 8.4 Task

A task is a human action required for a case to progress.

Examples:

- review alert
- validate payment details
- approve exception handling
- add supporting documents

### 8.5 Audit Event

An audit event is a significant user or system action that must be recorded for traceability.

## 9. MVP Use Cases

### 9.1 AML Alert Review

Example flow:

1. Case created from alert intake.
2. Data enrichment is performed.
3. Case is routed to AML analyst.
4. Analyst records findings and supporting evidence.
5. High-risk or suspicious outcome routes to supervisor approval or escalation.
6. Final decision is logged.
7. Case is resolved and closed.

Outcome demonstrated by MVP:

- clear assignment ownership
- review traceability
- approval control
- audit-grade case timeline

### 9.2 Payment Exception Handling

Example flow:

1. Case created for a payment exception.
2. Relevant payment data is captured or enriched.
3. Case is routed to payment operations.
4. Decision node evaluates exception type or amount threshold.
5. Some cases require approval or escalation.
6. Resolution action is recorded.
7. Case is closed with full trace history.

Outcome demonstrated by MVP:

- structured routing and approval control
- faster visibility into blocked or overdue items

## 10. User Stories

### 10.1 Designer Stories

- As a workflow designer, I want to create a case flow using reusable nodes so that I can define banking processes without code changes.
- As a workflow designer, I want to edit and version a case flow so that process changes can be managed safely.
- As a workflow designer, I want to preview flow logic and validate node configuration so that invalid flows are caught before use.

### 10.2 Operator Stories

- As an operator, I want to see cases assigned to me so that I can work my queue efficiently.
- As an operator, I want to open a case and see its current step, history, documents, and required actions so that I can complete work confidently.
- As an operator, I want to upload supporting documents and record decisions so that the case file remains complete.

### 10.3 Approver Stories

- As an approver, I want to see pending approvals and approve or reject them so that controlled decisions are enforced.
- As a supervisor, I want to see escalated and overdue cases so that I can intervene quickly.

### 10.4 Auditor Stories

- As an auditor, I want to inspect a complete case timeline with timestamps, assignees, approvals, and outcome so that I can verify process adherence.

### 10.5 Admin Stories

- As an administrator, I want to manage users and roles so that access to sensitive actions is controlled.
- As an administrator, I want to manage platform settings and templates so that the product remains operational and governed.

## 11. Functional Requirements

The following requirements refine the proposal into product-ready MVP requirements.

### 11.1 Platform Access And Governance

1. The system shall provide a secure web interface for authorized internal users.
2. The system shall authenticate users and enforce role-based access control.
3. The system shall restrict access to case flows, case records, approvals, and administrative functions according to user role and responsibility.

### 11.2 Case Flow Builder

4. The system shall provide a visual drag-and-drop case flow builder.
5. The system shall allow authorized users to create, view, edit, duplicate, archive, and manage case flow definitions.
6. The system shall provide a configurable node library for at least the MVP node types.
7. The system shall validate flow configuration and surface configuration issues clearly.

### 11.3 Case Creation And Processing

8. The system shall allow authorized users to initiate cases against a selected case flow.
9. The system shall progress cases through their configured flow from intake to resolution.
10. The system shall support case data capture during case processing.
11. The system shall support document association with case records.

### 11.4 Assignment, Approval, And Escalation

12. The system shall support assignment and routing to specific users, roles, or teams.
13. The system shall support approval steps with approve and reject outcomes.
14. The system shall support escalation logic based on configured conditions or SLA breaches.
15. The system shall support manual and automatic escalation paths.

### 11.5 Status, Visibility, And Monitoring

16. The system shall track case lifecycle status and expose it to authorized users.
17. The system shall display case details including current step, completed steps, timestamps, assignments, decisions, and outcome.
18. The system shall provide supervisor oversight views for active cases, overdue cases, and case history.

### 11.6 Audit And Persistence

19. The system shall maintain an audit log of significant user and system actions.
20. The system shall store case flow definitions, users, roles, cases, tasks, documents, execution history, and audit events in a persistent database.

### 11.7 MVP Templates

21. The system shall include a working AML alert review case flow template.
22. The system shall include a working payment exception handling case flow template.

## 12. Non-Functional Requirements

1. The system shall provide a clear, usable interface that supports operation with minimal training.
2. The system shall be modular in design to support maintainability and extension to new case types and node types.
3. The system shall be deployable in a local containerized environment for development, testing, and demonstration.
4. The system shall provide reliable end-to-end case execution for the MVP scope.
5. The system shall protect credentials and sensitive configuration using secure, environment-based configuration practices.
6. The system shall record audit events consistently and make them retrievable for review.
7. The system shall present validation and error messages clearly without exposing sensitive internals.
8. The system shall be designed to support future scaling in case types, queues, teams, and node types.

## 13. MVP Scope

### In Scope

- internal authenticated web application
- visual case flow builder
- reusable node library for MVP nodes
- case creation and case detail views
- assignment and routing
- approval steps
- escalation steps
- timer/SLA behavior for overdue detection
- document upload and association to cases
- audit logging
- supervisor monitoring views
- AML alert review template
- payment exception handling template
- local Dockerized deployment

### Out Of Scope

- external customer portals
- public intake forms
- complex OCR/document intelligence pipeline
- broad third-party integration catalog
- enterprise SSO integration for MVP
- advanced analytics warehouse and reporting
- mobile-first workflow experience

## 14. Product Metrics And Success Criteria

For MVP demonstration success, the product should show that it can:

1. Create and process cases through the full lifecycle for both target case types.
2. Enforce assignment, approval, and escalation rules in at least one end-to-end scenario per case type.
3. Display a complete case history including steps, timestamps, actors, and decisions.
4. Surface overdue or escalated work in supervisor views.
5. Allow designers to modify a flow in the visual builder without code changes.

Suggested operational metrics for future evaluation:

- average case turnaround time
- average time spent in approval
- number of overdue cases
- number of escalations
- case volume by type and status
- queue workload distribution

## 15. UX Principles

BankFlow should feel like an internal operations platform, not a generic automation toy.

UX principles:

- clarity over novelty
- case state always visible
- current owner always visible
- required actions always visible
- approval and escalation intent always explicit
- timeline and audit trace easy to inspect
- builder configuration language should match banking operations vocabulary

## 16. Risks And Product Constraints

### 16.1 Existing Repo Constraints

The current codebase has known issues that affect BankFlow planning:

- some builder nodes do not have real runtime support
- security coverage is incomplete on some routes
- some config shapes are inconsistent between UI and compiler
- the current execution model is too n8n-centric for human case orchestration

### 16.2 MVP Timeline Constraint

Because the project is intended as an internship prototype, the MVP must prioritize demonstrable end-to-end value over full enterprise breadth.

That means the design should favor:

- a limited but real node library
- two strong templates
- clear case lifecycle handling
- demonstrable auditability

## 17. Product Decisions

### 17.1 Decision: Keep Visual Builder As A Core Product Capability

Rationale:

- It is central to the proposal.
- It is the strongest reusable asset from the current repo.

### 17.2 Decision: BankFlow Owns Case State

Rationale:

- Banking case orchestration depends on human tasks, approvals, and governance.
- Those concepts must remain visible and queryable inside BankFlow.

### 17.3 Decision: Use n8n As Automation Support, Not As The Sole System Of Record

Rationale:

- n8n is still useful for automation actions.
- BankFlow should remain the source of truth for cases and tasks.

### 17.4 Decision: Keep MVP Focused On Two Banking Flows

Rationale:

- AML alert review and payment exception handling are concrete, demonstrable, and aligned with the proposal.

## 18. Release Framing

### Release 0: Platform Refactor Foundation

- remove HR-specific content
- secure route coverage
- rename domain language
- establish new schema direction

### Release 1: Core BankFlow MVP

- case flow builder
- case domain model
- assignments and approvals
- case timeline and audit history
- AML and payment exception templates

### Release 2: Operational Hardening

- SLA improvements
- richer dashboards
- better versioning and publishing
- more integrations and case types

## 19. Final Product Statement

BankFlow is a configurable internal banking case orchestration platform that combines a visual process builder with governed case execution, assignment, approvals, escalation, and auditability. The MVP will prove this value through AML alert review and payment exception handling while laying a reusable platform foundation for broader banking operations use cases.
