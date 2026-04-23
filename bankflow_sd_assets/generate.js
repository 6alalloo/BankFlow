// BankFlow Software Design Document generator
const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, ImageRun,
  AlignmentType, LevelFormat, TabStopType, TabStopPosition,
  HeadingLevel, BorderStyle, WidthType, ShadingType, PageBreak,
  TableOfContents, PageOrientation, PageNumber, Footer, Header,
  VerticalAlign
} = require("docx");

// ---------- image helpers ----------
function pngSize(file) {
  const b = fs.readFileSync(file);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), data: b };
}

// Max content width in pixels at 96 DPI for US Letter portrait, 1" margins
const MAX_W = 600;
const MAX_H_PORTRAIT = 820; // keeps image on one page

function scaledImg(file, opts = {}) {
  const { w, h, data } = pngSize(file);
  const maxW = opts.maxW || MAX_W;
  const maxH = opts.maxH || MAX_H_PORTRAIT;
  const rW = maxW / w;
  const rH = maxH / h;
  const r = Math.min(rW, rH, 1);
  return new ImageRun({
    type: "png",
    data,
    transformation: { width: Math.round(w * r), height: Math.round(h * r) },
    altText: { title: opts.alt || path.basename(file), description: opts.alt || path.basename(file), name: path.basename(file) },
  });
}

function imgPara(file, opts = {}) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 120, after: 60 },
    children: [scaledImg(file, opts)],
  });
}

function caption(text) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 180 },
    children: [new TextRun({ text, italics: true, size: 20, color: "4A5568" })],
  });
}

// ---------- paragraph helpers ----------
function H1(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(text)] });
}
function H2(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(text)] });
}
function H3(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(text)] });
}
function P(text, opts = {}) {
  const spacing = { before: 60, after: 60, ...(opts.spacing || {}) };
  const children = Array.isArray(text) ? text : [new TextRun({ text, ...(opts.run || {}) })];
  return new Paragraph({ spacing, alignment: opts.align, children });
}
function bullet(text, level = 0) {
  return new Paragraph({
    numbering: { reference: "bullets", level },
    children: [new TextRun(text)],
  });
}
function codeBlock(text) {
  const lines = text.split("\n");
  return lines.map(line => new Paragraph({
    spacing: { before: 0, after: 0 },
    shading: { type: ShadingType.CLEAR, fill: "F7FAFC" },
    children: [new TextRun({ text: line || " ", font: "Consolas", size: 18 })],
  }));
}

// ---------- table helpers ----------
const thinBorder = { style: BorderStyle.SINGLE, size: 4, color: "CBD5E0" };
const allBorders = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };

function tcell(text, opts = {}) {
  const runs = Array.isArray(text)
    ? text
    : [new TextRun({ text: String(text), bold: opts.bold, size: opts.size || 20, color: opts.color })];
  const paras = runs.map(r => new Paragraph({ spacing: { before: 40, after: 40 }, children: [r] }));
  return new TableCell({
    borders: allBorders,
    width: { size: opts.width || 0, type: WidthType.DXA },
    shading: opts.fill ? { type: ShadingType.CLEAR, fill: opts.fill } : undefined,
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
    verticalAlign: VerticalAlign.CENTER,
    children: paras,
  });
}

function tcellMulti(lines, opts = {}) {
  const paras = lines.map(l => new Paragraph({
    spacing: { before: 20, after: 20 },
    children: [new TextRun({ text: l, size: opts.size || 18 })],
  }));
  return new TableCell({
    borders: allBorders,
    width: { size: opts.width || 0, type: WidthType.DXA },
    shading: opts.fill ? { type: ShadingType.CLEAR, fill: opts.fill } : undefined,
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
    verticalAlign: VerticalAlign.TOP,
    children: paras,
  });
}

// Per-table attribute table (Column / Type / Null / Default / Key / Notes)
function attributeTable(rows) {
  const widths = [1600, 1500, 700, 1300, 900, 3360]; // sum = 9360
  const header = new TableRow({
    tableHeader: true,
    children: [
      tcell("Column", { bold: true, fill: "BEE3F8", width: widths[0] }),
      tcell("Type", { bold: true, fill: "BEE3F8", width: widths[1] }),
      tcell("Null", { bold: true, fill: "BEE3F8", width: widths[2] }),
      tcell("Default", { bold: true, fill: "BEE3F8", width: widths[3] }),
      tcell("Key", { bold: true, fill: "BEE3F8", width: widths[4] }),
      tcell("Notes", { bold: true, fill: "BEE3F8", width: widths[5] }),
    ],
  });
  const body = rows.map(r => new TableRow({
    children: r.map((v, i) => tcell(v || "", { size: 18, width: widths[i] })),
  }));
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: widths,
    rows: [header, ...body],
  });
}

// Info table used for Purpose / When it's written / etc.
function infoTable(entries) {
  const widths = [2400, 6960];
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: widths,
    rows: entries.map(([k, v]) => new TableRow({
      children: [
        tcell(k, { bold: true, fill: "F7FAFC", width: widths[0] }),
        tcell(v, { width: widths[1] }),
      ],
    })),
  });
}

// Write a full per-table spec block
function tableSpec({ name, purpose, when, columns, constraints = [], indexes = [], relationships = [] }) {
  const out = [];
  out.push(H3(`Table: ${name}`));
  out.push(infoTable([
    ["Purpose", purpose],
    ["When it's written", when],
  ]));
  out.push(P(" "));
  out.push(new Paragraph({ spacing: { before: 60, after: 40 }, children: [new TextRun({ text: "Columns", bold: true })] }));
  out.push(attributeTable(columns));
  if (constraints.length) {
    out.push(P(" "));
    out.push(new Paragraph({ spacing: { before: 60, after: 40 }, children: [new TextRun({ text: "Constraints", bold: true })] }));
    constraints.forEach(c => out.push(bullet(c)));
  }
  if (indexes.length) {
    out.push(new Paragraph({ spacing: { before: 60, after: 40 }, children: [new TextRun({ text: "Indexes", bold: true })] }));
    indexes.forEach(i => out.push(bullet(i)));
  }
  if (relationships.length) {
    out.push(new Paragraph({ spacing: { before: 60, after: 40 }, children: [new TextRun({ text: "Relationships", bold: true })] }));
    relationships.forEach(r => out.push(bullet(r)));
  }
  out.push(P(" "));
  return out;
}

// ---------- content ----------
const ASSETS = "C:/Users/DELL/Desktop/HRFlow/bankflow_sd_assets";
const img = name => path.join(ASSETS, name);

const children = [];

// ===== Title page =====
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { before: 2400, after: 120 },
  children: [new TextRun({ text: "BankFlow", bold: true, size: 72, color: "2B6CB0" })],
}));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { before: 0, after: 240 },
  children: [new TextRun({ text: "Software Design Document", bold: true, size: 48 })],
}));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { before: 0, after: 120 },
  children: [new TextRun({ text: "Version 1.0", size: 28, color: "4A5568" })],
}));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { before: 0, after: 0 },
  children: [new TextRun({ text: "April 2026", size: 24, color: "4A5568" })],
}));
children.push(new Paragraph({ children: [new PageBreak()] }));

// ===== Table of Contents =====
children.push(H1("Table of Contents"));
children.push(new Paragraph({
  children: [new TableOfContents("Table of Contents", { hyperlink: true, headingStyleRange: "1-3" })],
}));
children.push(new Paragraph({ children: [new PageBreak()] }));

// ===== 1. Introduction =====
children.push(H1("1. Introduction"));
children.push(P("This document specifies the software design of BankFlow, a configurable banking case orchestration platform. BankFlow enables authorized users to design banking case flows visually, create live cases against those flows, route work between operators and teams, enforce approvals and SLA deadlines, and maintain a full audit trail of every significant action. It is intended for developers, database administrators, reviewers, and anyone responsible for extending or maintaining the system."));
children.push(P("The design described here is the low-level companion to the BankFlow Product Requirements Document. It covers the target architecture, the relational data model, the runtime orchestration model, the reusable node library, the use cases that exercise the platform end to end, and the graphical user interface that operators, approvers, supervisors, and administrators use day to day."));
children.push(P("BankFlow owns the case lifecycle. The platform is the source of truth for cases, human tasks, approvals, escalations, SLA deadlines, and audit events. An n8n automation worker is used only for automation and integration nodes (for example notifications, external API calls, and data enrichment). This separation is the most important architectural decision in the system and is reflected throughout this document."));

children.push(H2("1.1 Scope"));
children.push(P("The MVP described in this document supports end-to-end case orchestration for five banking use cases: AML alert review, payment exception handling, KYC refresh, dormant account flagging, and regulatory report generation. The platform is designed so that additional case types can be added by authoring new case flows in the visual builder, without modifying application code."));

children.push(H2("1.2 References"));
children.push(bullet("BankFlow Product Requirements Document (BANKFLOW_PRD.md)"));
children.push(bullet("BankFlow Technical Design Document (BANKFLOW_TDD.md)"));
children.push(bullet("BankFlow Transformation Map (BANKFLOW_KEEP_REMOVE_REPURPOSE.md)"));
children.push(bullet("BankFlow Implementation Backlog (BANKFLOW_IMPLEMENTATION_BACKLOG.md)"));
children.push(new Paragraph({ children: [new PageBreak()] }));

// ===== 2. System Architecture =====
children.push(H1("2. System Architecture"));
children.push(P("BankFlow is deployed as a small set of cooperating services. A React frontend communicates with an Express backend over REST. The backend persists state to PostgreSQL through Prisma, invokes an n8n automation worker for system-level actions, and stores supporting documents on a shared file volume. Two lightweight scheduler services run inside the backend: an SLA scheduler that detects overdue tasks and triggers escalations, and an intake scheduler that evaluates case flow schedules and creates scheduled cases at their configured cadence."));

children.push(H2("2.1 High-Level Architecture"));
children.push(P("The high-level architecture diagram summarizes how users reach the system, which services are involved, and how case state flows between them. BankFlow always owns case state; n8n is called only when a node requires automation support."));
children.push(imgPara(img("02_architecture.png"), { alt: "BankFlow high-level architecture" }));
children.push(caption("Figure 1 — BankFlow High-Level System Architecture"));

children.push(H2("2.2 Backend Component Structure"));
children.push(P("Inside the backend, responsibilities are split across three layers. The API layer exposes HTTP routes organized by resource (flows, cases, tasks, approvals, documents, dashboard, admin). The service layer contains domain services that own reads and writes for each resource and delegate to the runtime when case state must advance. The runtime layer contains the case orchestrator, per-node executors, the SLA and intake schedulers, and the automation client that calls n8n with correlation identifiers."));
children.push(imgPara(img("03_components.png"), { alt: "BankFlow backend component structure", maxW: 600 }));
children.push(caption("Figure 2 — Backend Component Structure"));

children.push(H2("2.3 Correlation Between BankFlow and n8n"));
children.push(P("Every call from BankFlow to n8n carries a correlation object containing the case identifier, the case flow version, the node key, the case event identifier, and (when relevant) the task identifier. When n8n completes an automation action, it posts the result back to a BankFlow callback endpoint along with the same correlation identifiers. The backend writes the result to the exact case event that triggered it. This avoids the common mistake of looking up the most recent execution and attributing an unrelated result to the current case."));
children.push(new Paragraph({ children: [new PageBreak()] }));

// ===== 3. Database Design =====
children.push(H1("3. Database Design"));
children.push(P("The BankFlow database is organized into four logical groupings: Identity and Access, Case Flow Definition, Case Runtime, and Audit. All tables live in a single Postgres schema managed by Prisma. The diagram below shows the entity model, including all primary keys, foreign key relationships, and the grouping of entities by concern."));

children.push(H2("3.1 Enhanced Entity Relationship Diagram"));
children.push(imgPara(img("01_erd.png"), { alt: "BankFlow ERD" }));
children.push(caption("Figure 3 — BankFlow Enhanced Entity Relationship Diagram"));

children.push(H2("3.2 Tables and Views Structure"));
children.push(P("The sections below document each table in the order they appear in the ERD. Views defined on top of these tables are documented at the end of the section."));

children.push(H3("Inventory"));
children.push(bullet("Identity & Access: roles, users, teams, team_memberships"));
children.push(bullet("Case Flow Definition: case_flows, case_flow_versions, case_flow_nodes, case_flow_edges, case_flow_schedules"));
children.push(bullet("Case Runtime: cases, case_tasks, case_approvals, case_escalations, case_events, case_documents"));
children.push(bullet("Audit: audit_logs"));
children.push(bullet("Views: v_active_cases_by_queue, v_overdue_tasks, v_pending_approvals, v_case_timeline"));
children.push(P(" "));

// --- roles ---
tableSpec({
  name: "roles",
  purpose: "Defines the named roles that can be assigned to users (for example Admin, Designer, Operator, Approver, Supervisor, Auditor).",
  when: "Seeded on installation; occasionally extended by administrators to model new banking-operations personas.",
  columns: [
    ["id", "serial", "NO", "", "PK", ""],
    ["name", "varchar", "NO", "", "UNQ", "Role display name"],
    ["created_at", "timestamptz", "NO", "now()", "", ""],
  ],
  constraints: ["UNIQUE (name)"],
  indexes: ["— (unique constraint covers lookups)"],
  relationships: ["Parent of: users.role_id, case_approvals.requested_from_role_id"],
}).forEach(x => children.push(x));

// --- users ---
tableSpec({
  name: "users",
  purpose: "Internal user accounts that authenticate to BankFlow and perform operational work. Each user holds a single role.",
  when: "Created by administrators; activation status toggled when a user joins or leaves.",
  columns: [
    ["id", "serial", "NO", "", "PK", ""],
    ["email", "varchar", "NO", "", "UNQ", "Case-sensitive unique"],
    ["password_hash", "varchar", "NO", "", "", "bcrypt hash"],
    ["full_name", "varchar", "NO", "", "", ""],
    ["is_active", "boolean", "NO", "true", "", ""],
    ["role_id", "int", "NO", "", "FK → roles.id", ""],
    ["created_at", "timestamptz", "NO", "now()", "", ""],
  ],
  constraints: ["UNIQUE (email)", "FK (role_id) → roles.id ON DELETE RESTRICT"],
  indexes: ["idx_users_role_id on (role_id)"],
  relationships: [
    "Parent of: case_flows.owner_user_id, cases.assignee_user_id / created_by, case_tasks.assigned_user_id, case_approvals.decided_by / requested_from_user_id, case_escalations.from_user_id / to_user_id, case_events.actor_user_id, case_documents.uploaded_by, audit_logs.actor_user_id, team_memberships.user_id, case_flow_versions.published_by",
  ],
}).forEach(x => children.push(x));

// --- teams ---
tableSpec({
  name: "teams",
  purpose: "Operational groupings such as AML analyst teams, payment operations teams, compliance teams, and approval authorities. Cases and tasks can be routed to a team rather than a named user.",
  when: "Created and maintained by administrators as the operations organization evolves.",
  columns: [
    ["id", "serial", "NO", "", "PK", ""],
    ["name", "varchar", "NO", "", "UNQ", ""],
    ["description", "varchar", "YES", "", "", ""],
    ["is_active", "boolean", "NO", "true", "", ""],
    ["created_at", "timestamptz", "NO", "now()", "", ""],
  ],
  constraints: ["UNIQUE (name)"],
  relationships: ["Parent of: team_memberships.team_id, cases.assignee_team_id, case_tasks.assigned_team_id, case_escalations.to_team_id"],
}).forEach(x => children.push(x));

// --- team_memberships ---
tableSpec({
  name: "team_memberships",
  purpose: "Associates users with teams. A user can belong to multiple teams and hold a team-scoped membership role (for example member, lead, approver).",
  when: "Modified when users join, leave, or change team responsibilities.",
  columns: [
    ["id", "serial", "NO", "", "PK", ""],
    ["user_id", "int", "NO", "", "FK → users.id", ""],
    ["team_id", "int", "NO", "", "FK → teams.id", ""],
    ["membership_role", "varchar", "NO", "'member'", "", "member / lead / approver"],
    ["joined_at", "timestamptz", "NO", "now()", "", ""],
  ],
  constraints: ["UNIQUE (user_id, team_id)"],
  indexes: ["idx_tm_user on (user_id)", "idx_tm_team on (team_id)"],
  relationships: ["Child of: users, teams"],
}).forEach(x => children.push(x));

// --- case_flows ---
tableSpec({
  name: "case_flows",
  purpose: "A reusable case flow definition (for example AML Alert Review). Each case flow can have multiple versions; only one is active at a time. The active version is the one that new cases start on.",
  when: "Created by designers and updated as processes change; archived when retired.",
  columns: [
    ["id", "serial", "NO", "", "PK", ""],
    ["name", "varchar", "NO", "", "", ""],
    ["description", "varchar", "YES", "", "", ""],
    ["case_type", "varchar", "NO", "", "", "aml_alert, payment_exception, kyc_refresh, dormant_account, regulatory_report, ..."],
    ["status", "varchar", "NO", "'draft'", "", "draft / published / archived"],
    ["owner_user_id", "int", "YES", "", "FK → users.id", ""],
    ["active_version_id", "int", "YES", "", "FK → case_flow_versions.id", "Deferred FK to resolve circular reference"],
    ["archived_at", "timestamptz", "YES", "", "", ""],
    ["created_at", "timestamptz", "NO", "now()", "", ""],
    ["updated_at", "timestamptz", "NO", "now()", "", ""],
  ],
  indexes: ["idx_case_flows_owner on (owner_user_id)", "idx_case_flows_status on (status)"],
  relationships: ["Parent of: case_flow_versions, case_flow_schedules"],
}).forEach(x => children.push(x));

// --- case_flow_versions ---
tableSpec({
  name: "case_flow_versions",
  purpose: "An immutable snapshot of a case flow's graph at publish time. New cases reference a specific version, so edits to a flow do not disturb in-flight cases.",
  when: "Inserted when a designer publishes a flow; existing versions are never modified.",
  columns: [
    ["id", "serial", "NO", "", "PK", ""],
    ["case_flow_id", "int", "NO", "", "FK → case_flows.id", ""],
    ["version_number", "int", "NO", "", "", "Monotonic per case_flow_id"],
    ["status", "varchar", "NO", "'draft'", "", "draft / published / retired"],
    ["graph_snapshot_json", "jsonb", "NO", "'{}'", "", "Materialized graph for fast load"],
    ["published_at", "timestamptz", "YES", "", "", ""],
    ["published_by", "int", "YES", "", "FK → users.id", ""],
    ["created_at", "timestamptz", "NO", "now()", "", ""],
  ],
  constraints: ["UNIQUE (case_flow_id, version_number)"],
  indexes: ["idx_cfv_flow on (case_flow_id)", "idx_cfv_status on (status)"],
  relationships: ["Parent of: case_flow_nodes, case_flow_edges, cases"],
}).forEach(x => children.push(x));

// --- case_flow_nodes ---
tableSpec({
  name: "case_flow_nodes",
  purpose: "Nodes of a flow version's graph. Each node has a kind (for example case_intake, decision, approval, routing, notification, timer_sla) and a kind-specific configuration payload.",
  when: "Written when a flow version is published or when the version snapshot is materialized.",
  columns: [
    ["id", "serial", "NO", "", "PK", ""],
    ["case_flow_version_id", "int", "NO", "", "FK → case_flow_versions.id", ""],
    ["node_key", "varchar", "NO", "", "", "Stable identifier used by edges and runtime"],
    ["kind", "varchar", "NO", "", "", "case_intake, data_capture, approval, decision, routing, notification, document_upload, logger, integration, timer_sla, status_update, escalation"],
    ["name", "varchar", "YES", "", "", ""],
    ["config_json", "jsonb", "NO", "'{}'", "", "Kind-specific config; validated on save"],
    ["pos_x", "int", "NO", "0", "", ""],
    ["pos_y", "int", "NO", "0", "", ""],
  ],
  constraints: ["UNIQUE (case_flow_version_id, node_key)"],
  indexes: ["idx_cfn_version on (case_flow_version_id)"],
  relationships: ["Parent of: case_flow_edges.from_node_id / to_node_id, case_tasks.node_id, case_events.node_id, cases.current_node_id"],
}).forEach(x => children.push(x));

// --- case_flow_edges ---
tableSpec({
  name: "case_flow_edges",
  purpose: "Directed edges between nodes. An edge may carry a condition used by the orchestrator to choose between branches (for example at a decision node).",
  when: "Written when a flow version is published.",
  columns: [
    ["id", "serial", "NO", "", "PK", ""],
    ["case_flow_version_id", "int", "NO", "", "FK → case_flow_versions.id", ""],
    ["from_node_id", "int", "NO", "", "FK → case_flow_nodes.id", ""],
    ["to_node_id", "int", "NO", "", "FK → case_flow_nodes.id", ""],
    ["condition_json", "jsonb", "NO", "'{}'", "", "Evaluated by decision node executor"],
    ["label", "varchar", "YES", "", "", "For example 'approve' / 'reject'"],
    ["priority", "int", "NO", "0", "", "Order of evaluation when multiple edges match"],
  ],
  constraints: ["CHECK (from_node_id <> to_node_id)"],
  indexes: ["idx_cfe_version on (case_flow_version_id)", "idx_cfe_from on (from_node_id)", "idx_cfe_to on (to_node_id)"],
  relationships: ["Child of: case_flow_versions, case_flow_nodes (as from / to)"],
}).forEach(x => children.push(x));

// --- case_flow_schedules ---
tableSpec({
  name: "case_flow_schedules",
  purpose: "Cron schedules attached to case flows that support scheduled intake (for example KYC refresh cycles, dormant account scans, regulatory report deadlines). The intake scheduler service evaluates these on a recurring loop.",
  when: "Created by designers when they enable scheduled intake on a flow; disabled when the schedule should pause.",
  columns: [
    ["id", "serial", "NO", "", "PK", ""],
    ["case_flow_id", "int", "NO", "", "FK → case_flows.id", ""],
    ["cron_expression", "varchar", "NO", "", "", "Standard five-field cron"],
    ["timezone", "varchar", "NO", "'UTC'", "", "IANA timezone identifier"],
    ["is_active", "boolean", "NO", "true", "", ""],
    ["last_run_at", "timestamptz", "YES", "", "", ""],
    ["next_run_at", "timestamptz", "YES", "", "", "Recomputed each tick"],
    ["created_at", "timestamptz", "NO", "now()", "", ""],
  ],
  indexes: ["idx_cfs_active_next on (is_active, next_run_at)"],
  relationships: ["Child of: case_flows"],
}).forEach(x => children.push(x));

// --- cases ---
tableSpec({
  name: "cases",
  purpose: "Live instances of a case flow. A case has a lifecycle status, a current node, a current task, an assignee (user or team), and a payload that accumulates as the case progresses.",
  when: "Created when a case is initiated through manual intake, API intake, or the intake scheduler; updated throughout the case lifecycle.",
  columns: [
    ["id", "serial", "NO", "", "PK", ""],
    ["case_reference", "varchar", "NO", "", "UNQ", "Human-friendly reference, for example AML-2026-000123"],
    ["case_flow_version_id", "int", "NO", "", "FK → case_flow_versions.id", ""],
    ["case_type", "varchar", "NO", "", "", "Denormalized from flow for fast filtering"],
    ["status", "varchar", "NO", "'intake'", "", "intake / in_review / pending_action / pending_approval / escalated / resolved / closed / cancelled"],
    ["priority", "varchar", "NO", "'normal'", "", "low / normal / high / urgent"],
    ["current_node_id", "int", "YES", "", "FK → case_flow_nodes.id", "Denormalized pointer"],
    ["current_task_id", "int", "YES", "", "FK → case_tasks.id", "Denormalized pointer"],
    ["assignee_user_id", "int", "YES", "", "FK → users.id", ""],
    ["assignee_team_id", "int", "YES", "", "FK → teams.id", ""],
    ["intake_source", "varchar", "NO", "", "", "manual / api / scheduled"],
    ["payload_json", "jsonb", "NO", "'{}'", "", "Case data accumulated during processing"],
    ["outcome_json", "jsonb", "YES", "", "", "Final decision and outcome details"],
    ["opened_at", "timestamptz", "NO", "now()", "", ""],
    ["resolved_at", "timestamptz", "YES", "", "", ""],
    ["closed_at", "timestamptz", "YES", "", "", ""],
    ["created_by", "int", "YES", "", "FK → users.id", ""],
  ],
  constraints: ["UNIQUE (case_reference)", "CHECK (assignee_user_id IS NULL OR assignee_team_id IS NULL OR assignee_user_id IS NOT NULL AND assignee_team_id IS NOT NULL)"],
  indexes: ["idx_cases_status on (status)", "idx_cases_assignee_user on (assignee_user_id)", "idx_cases_assignee_team on (assignee_team_id)", "idx_cases_type_status on (case_type, status)", "idx_cases_opened_at on (opened_at)"],
  relationships: ["Parent of: case_tasks, case_events, case_approvals, case_escalations, case_documents"],
}).forEach(x => children.push(x));

// --- case_tasks ---
tableSpec({
  name: "case_tasks",
  purpose: "A unit of human or automated work required for a case to progress. Human tasks have claim / complete / reassign semantics; automation tasks are created and resolved by the orchestrator.",
  when: "Created by the orchestrator when a node demands work; updated as the task is claimed, completed, or escalated.",
  columns: [
    ["id", "serial", "NO", "", "PK", ""],
    ["case_id", "int", "NO", "", "FK → cases.id", ""],
    ["node_id", "int", "NO", "", "FK → case_flow_nodes.id", ""],
    ["task_type", "varchar", "NO", "", "", "human_review / approval / data_capture / document_upload / automation"],
    ["status", "varchar", "NO", "'pending'", "", "pending / assigned / claimed / completed / rejected / cancelled / overdue"],
    ["assigned_user_id", "int", "YES", "", "FK → users.id", ""],
    ["assigned_team_id", "int", "YES", "", "FK → teams.id", ""],
    ["claimed_at", "timestamptz", "YES", "", "", ""],
    ["due_at", "timestamptz", "YES", "", "", "Populated by timer / SLA nodes"],
    ["completed_at", "timestamptz", "YES", "", "", ""],
    ["decision", "varchar", "YES", "", "", "Captured from approval and decision outcomes"],
    ["input_json", "jsonb", "NO", "'{}'", "", "Input snapshot at task creation"],
    ["output_json", "jsonb", "YES", "", "", "User-supplied or automation-supplied output"],
    ["created_at", "timestamptz", "NO", "now()", "", ""],
  ],
  indexes: ["idx_tasks_case on (case_id)", "idx_tasks_status on (status)", "idx_tasks_assigned_user on (assigned_user_id)", "idx_tasks_assigned_team on (assigned_team_id)", "idx_tasks_due on (due_at) WHERE status IN ('pending','assigned','claimed')"],
  relationships: ["Child of: cases, case_flow_nodes, users, teams"],
}).forEach(x => children.push(x));

// --- case_approvals ---
tableSpec({
  name: "case_approvals",
  purpose: "Records the request and outcome of a supervisor or approver decision. Each approval is tied to a single approval task on a case.",
  when: "Created when the orchestrator enters an approval node; resolved when the approver approves or rejects.",
  columns: [
    ["id", "serial", "NO", "", "PK", ""],
    ["case_id", "int", "NO", "", "FK → cases.id", ""],
    ["task_id", "int", "NO", "", "FK → case_tasks.id", ""],
    ["approval_type", "varchar", "NO", "", "", "For example sar_filing, payment_action, override"],
    ["status", "varchar", "NO", "'requested'", "", "requested / approved / rejected / expired"],
    ["requested_from_user_id", "int", "YES", "", "FK → users.id", ""],
    ["requested_from_role_id", "int", "YES", "", "FK → roles.id", ""],
    ["requested_at", "timestamptz", "NO", "now()", "", ""],
    ["decided_at", "timestamptz", "YES", "", "", ""],
    ["decided_by", "int", "YES", "", "FK → users.id", ""],
    ["decision_reason", "varchar", "YES", "", "", ""],
  ],
  indexes: ["idx_approvals_case on (case_id)", "idx_approvals_status on (status)", "idx_approvals_requested_user on (requested_from_user_id)"],
  relationships: ["Child of: cases, case_tasks, users, roles"],
}).forEach(x => children.push(x));

// --- case_escalations ---
tableSpec({
  name: "case_escalations",
  purpose: "Record of an escalation event on a case, whether triggered automatically by SLA breach or manually by an operator or supervisor.",
  when: "Created by the SLA scheduler or by a manual escalation action; resolved when the escalation target takes ownership and works the case.",
  columns: [
    ["id", "serial", "NO", "", "PK", ""],
    ["case_id", "int", "NO", "", "FK → cases.id", ""],
    ["source_task_id", "int", "YES", "", "FK → case_tasks.id", ""],
    ["escalation_type", "varchar", "NO", "", "", "sla_breach / manual / risk_change"],
    ["reason", "varchar", "NO", "", "", ""],
    ["from_user_id", "int", "YES", "", "FK → users.id", ""],
    ["to_user_id", "int", "YES", "", "FK → users.id", ""],
    ["to_team_id", "int", "YES", "", "FK → teams.id", ""],
    ["triggered_at", "timestamptz", "NO", "now()", "", ""],
    ["resolved_at", "timestamptz", "YES", "", "", ""],
  ],
  indexes: ["idx_esc_case on (case_id)", "idx_esc_to_user on (to_user_id)", "idx_esc_to_team on (to_team_id)", "idx_esc_triggered on (triggered_at)"],
  relationships: ["Child of: cases, case_tasks, users, teams"],
}).forEach(x => children.push(x));

// --- case_events ---
tableSpec({
  name: "case_events",
  purpose: "Immutable business events that make up the case timeline. Every state change, task transition, approval decision, escalation, and automation result produces one or more case events.",
  when: "Appended by the orchestrator, node executors, and automation callbacks. Never updated or deleted.",
  columns: [
    ["id", "serial", "NO", "", "PK", ""],
    ["case_id", "int", "NO", "", "FK → cases.id", ""],
    ["event_type", "varchar", "NO", "", "", "case_opened, task_created, task_claimed, task_completed, approval_requested, approval_approved, approval_rejected, case_escalated, automation_started, automation_completed, status_changed, case_resolved, case_closed"],
    ["node_id", "int", "YES", "", "FK → case_flow_nodes.id", ""],
    ["task_id", "int", "YES", "", "FK → case_tasks.id", ""],
    ["actor_user_id", "int", "YES", "", "FK → users.id", "Null for system-generated events"],
    ["data_json", "jsonb", "NO", "'{}'", "", "Event payload including correlation ids"],
    ["created_at", "timestamptz", "NO", "now()", "", ""],
  ],
  indexes: ["idx_events_case_created on (case_id, created_at)", "idx_events_type on (event_type)"],
  relationships: ["Child of: cases, case_tasks, case_flow_nodes, users"],
}).forEach(x => children.push(x));

// --- case_documents ---
tableSpec({
  name: "case_documents",
  purpose: "Metadata for documents attached to a case. Files live on a shared volume or object store; this table records who uploaded the document, its type, and the case or task it belongs to.",
  when: "Created on document upload; never mutated (documents are versioned by new rows).",
  columns: [
    ["id", "serial", "NO", "", "PK", ""],
    ["case_id", "int", "NO", "", "FK → cases.id", ""],
    ["task_id", "int", "YES", "", "FK → case_tasks.id", ""],
    ["filename", "varchar", "NO", "", "", ""],
    ["mime_type", "varchar", "NO", "", "", ""],
    ["storage_path", "varchar", "NO", "", "", "Relative to the configured document root"],
    ["file_size_bytes", "bigint", "NO", "", "", ""],
    ["document_type", "varchar", "YES", "", "", "For example id_document, transaction_proof, regulatory_evidence"],
    ["uploaded_by", "int", "NO", "", "FK → users.id", ""],
    ["uploaded_at", "timestamptz", "NO", "now()", "", ""],
  ],
  indexes: ["idx_docs_case on (case_id)", "idx_docs_task on (task_id)"],
  relationships: ["Child of: cases, case_tasks, users"],
}).forEach(x => children.push(x));

// --- audit_logs ---
tableSpec({
  name: "audit_logs",
  purpose: "Administrative and security audit trail for actions that do not map to a specific case (for example user creation, role changes, flow publication, configuration edits).",
  when: "Written on authentication events and on administrative CRUD operations. Case-level activity is captured in case_events, not here.",
  columns: [
    ["id", "serial", "NO", "", "PK", ""],
    ["actor_user_id", "int", "YES", "", "FK → users.id", "Null for system actions"],
    ["action", "varchar", "NO", "", "", "For example USER_CREATED, FLOW_PUBLISHED, LOGIN_FAILED"],
    ["entity_type", "varchar", "YES", "", "", ""],
    ["entity_id", "int", "YES", "", "", ""],
    ["data_json", "jsonb", "YES", "", "", ""],
    ["created_at", "timestamptz", "NO", "now()", "", ""],
  ],
  indexes: ["idx_audit_actor on (actor_user_id)", "idx_audit_entity on (entity_type, entity_id)", "idx_audit_created on (created_at)"],
  relationships: ["Child of: users"],
}).forEach(x => children.push(x));

// Views
children.push(H3("Views"));
children.push(P("The following views are defined on top of the core tables to support dashboard queries and reduce client-side aggregation."));

children.push(new Paragraph({ spacing: { before: 80, after: 40 }, children: [new TextRun({ text: "View: v_active_cases_by_queue", bold: true })] }));
children.push(P("Counts active (non-closed, non-cancelled) cases grouped by team assignment and case status. Powers the supervisor dashboard."));
codeBlock(`CREATE OR REPLACE VIEW v_active_cases_by_queue AS
SELECT
  t.id              AS team_id,
  t.name            AS team_name,
  c.case_type,
  c.status,
  COUNT(*)          AS case_count
FROM cases c
LEFT JOIN teams t ON t.id = c.assignee_team_id
WHERE c.status NOT IN ('closed', 'cancelled')
GROUP BY t.id, t.name, c.case_type, c.status;`).forEach(x => children.push(x));

children.push(new Paragraph({ spacing: { before: 80, after: 40 }, children: [new TextRun({ text: "View: v_overdue_tasks", bold: true })] }));
children.push(P("Surfaces tasks past their due date, with the owning case and assignee details."));
codeBlock(`CREATE OR REPLACE VIEW v_overdue_tasks AS
SELECT
  ct.id              AS task_id,
  ct.case_id,
  c.case_reference,
  c.case_type,
  ct.task_type,
  ct.due_at,
  ct.status,
  ct.assigned_user_id,
  ct.assigned_team_id,
  now() - ct.due_at  AS overdue_by
FROM case_tasks ct
JOIN cases c ON c.id = ct.case_id
WHERE ct.due_at IS NOT NULL
  AND ct.due_at < now()
  AND ct.status IN ('pending', 'assigned', 'claimed', 'overdue');`).forEach(x => children.push(x));

children.push(new Paragraph({ spacing: { before: 80, after: 40 }, children: [new TextRun({ text: "View: v_pending_approvals", bold: true })] }));
children.push(P("Lists approvals currently awaiting a decision, ordered by request time."));
codeBlock(`CREATE OR REPLACE VIEW v_pending_approvals AS
SELECT
  a.id               AS approval_id,
  a.case_id,
  c.case_reference,
  c.case_type,
  a.approval_type,
  a.requested_from_user_id,
  a.requested_from_role_id,
  a.requested_at
FROM case_approvals a
JOIN cases c ON c.id = a.case_id
WHERE a.status = 'requested'
ORDER BY a.requested_at ASC;`).forEach(x => children.push(x));

children.push(new Paragraph({ spacing: { before: 80, after: 40 }, children: [new TextRun({ text: "View: v_case_timeline", bold: true })] }));
children.push(P("Joins case events to actor details for rendering the case detail timeline."));
codeBlock(`CREATE OR REPLACE VIEW v_case_timeline AS
SELECT
  e.case_id,
  e.id               AS event_id,
  e.event_type,
  e.node_id,
  e.task_id,
  e.actor_user_id,
  u.full_name        AS actor_name,
  e.data_json,
  e.created_at
FROM case_events e
LEFT JOIN users u ON u.id = e.actor_user_id
ORDER BY e.case_id, e.created_at ASC;`).forEach(x => children.push(x));

children.push(P(" "));
children.push(H2("3.3 Database Code"));
children.push(P("The full DDL for BankFlow is reproduced below. It matches the entities documented in section 3.2 and is the starting point for the Prisma schema."));
codeBlock(`CREATE TABLE roles (
  id          serial PRIMARY KEY,
  name        varchar NOT NULL UNIQUE,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id             serial PRIMARY KEY,
  email          varchar NOT NULL UNIQUE,
  password_hash  varchar NOT NULL,
  full_name      varchar NOT NULL,
  is_active      boolean NOT NULL DEFAULT true,
  role_id        int NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_users_role_id ON users(role_id);

CREATE TABLE teams (
  id          serial PRIMARY KEY,
  name        varchar NOT NULL UNIQUE,
  description varchar,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE team_memberships (
  id               serial PRIMARY KEY,
  user_id          int NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_id          int NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  membership_role  varchar NOT NULL DEFAULT 'member',
  joined_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, team_id)
);
CREATE INDEX idx_tm_user ON team_memberships(user_id);
CREATE INDEX idx_tm_team ON team_memberships(team_id);

CREATE TABLE case_flows (
  id                 serial PRIMARY KEY,
  name               varchar NOT NULL,
  description        varchar,
  case_type          varchar NOT NULL,
  status             varchar NOT NULL DEFAULT 'draft',
  owner_user_id      int REFERENCES users(id) ON DELETE SET NULL,
  active_version_id  int,
  archived_at        timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_case_flows_owner ON case_flows(owner_user_id);
CREATE INDEX idx_case_flows_status ON case_flows(status);

CREATE TABLE case_flow_versions (
  id                    serial PRIMARY KEY,
  case_flow_id          int NOT NULL REFERENCES case_flows(id) ON DELETE CASCADE,
  version_number        int NOT NULL,
  status                varchar NOT NULL DEFAULT 'draft',
  graph_snapshot_json   jsonb NOT NULL DEFAULT '{}',
  published_at          timestamptz,
  published_by          int REFERENCES users(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (case_flow_id, version_number)
);
CREATE INDEX idx_cfv_flow ON case_flow_versions(case_flow_id);
CREATE INDEX idx_cfv_status ON case_flow_versions(status);

ALTER TABLE case_flows
  ADD CONSTRAINT fk_case_flows_active_version
  FOREIGN KEY (active_version_id) REFERENCES case_flow_versions(id) ON DELETE SET NULL;

CREATE TABLE case_flow_nodes (
  id                      serial PRIMARY KEY,
  case_flow_version_id    int NOT NULL REFERENCES case_flow_versions(id) ON DELETE CASCADE,
  node_key                varchar NOT NULL,
  kind                    varchar NOT NULL,
  name                    varchar,
  config_json             jsonb NOT NULL DEFAULT '{}',
  pos_x                   int NOT NULL DEFAULT 0,
  pos_y                   int NOT NULL DEFAULT 0,
  UNIQUE (case_flow_version_id, node_key)
);
CREATE INDEX idx_cfn_version ON case_flow_nodes(case_flow_version_id);

CREATE TABLE case_flow_edges (
  id                      serial PRIMARY KEY,
  case_flow_version_id    int NOT NULL REFERENCES case_flow_versions(id) ON DELETE CASCADE,
  from_node_id            int NOT NULL REFERENCES case_flow_nodes(id) ON DELETE CASCADE,
  to_node_id              int NOT NULL REFERENCES case_flow_nodes(id) ON DELETE CASCADE,
  condition_json          jsonb NOT NULL DEFAULT '{}',
  label                   varchar,
  priority                int NOT NULL DEFAULT 0,
  CHECK (from_node_id <> to_node_id)
);
CREATE INDEX idx_cfe_version ON case_flow_edges(case_flow_version_id);
CREATE INDEX idx_cfe_from ON case_flow_edges(from_node_id);
CREATE INDEX idx_cfe_to ON case_flow_edges(to_node_id);

CREATE TABLE case_flow_schedules (
  id               serial PRIMARY KEY,
  case_flow_id     int NOT NULL REFERENCES case_flows(id) ON DELETE CASCADE,
  cron_expression  varchar NOT NULL,
  timezone         varchar NOT NULL DEFAULT 'UTC',
  is_active        boolean NOT NULL DEFAULT true,
  last_run_at      timestamptz,
  next_run_at      timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_cfs_active_next ON case_flow_schedules(is_active, next_run_at);

CREATE TABLE cases (
  id                    serial PRIMARY KEY,
  case_reference        varchar NOT NULL UNIQUE,
  case_flow_version_id  int NOT NULL REFERENCES case_flow_versions(id) ON DELETE RESTRICT,
  case_type             varchar NOT NULL,
  status                varchar NOT NULL DEFAULT 'intake',
  priority              varchar NOT NULL DEFAULT 'normal',
  current_node_id       int REFERENCES case_flow_nodes(id) ON DELETE SET NULL,
  current_task_id       int,
  assignee_user_id      int REFERENCES users(id) ON DELETE SET NULL,
  assignee_team_id      int REFERENCES teams(id) ON DELETE SET NULL,
  intake_source         varchar NOT NULL,
  payload_json          jsonb NOT NULL DEFAULT '{}',
  outcome_json          jsonb,
  opened_at             timestamptz NOT NULL DEFAULT now(),
  resolved_at           timestamptz,
  closed_at             timestamptz,
  created_by            int REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX idx_cases_status ON cases(status);
CREATE INDEX idx_cases_assignee_user ON cases(assignee_user_id);
CREATE INDEX idx_cases_assignee_team ON cases(assignee_team_id);
CREATE INDEX idx_cases_type_status ON cases(case_type, status);
CREATE INDEX idx_cases_opened_at ON cases(opened_at);

CREATE TABLE case_tasks (
  id                 serial PRIMARY KEY,
  case_id            int NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  node_id            int NOT NULL REFERENCES case_flow_nodes(id) ON DELETE RESTRICT,
  task_type          varchar NOT NULL,
  status             varchar NOT NULL DEFAULT 'pending',
  assigned_user_id   int REFERENCES users(id) ON DELETE SET NULL,
  assigned_team_id   int REFERENCES teams(id) ON DELETE SET NULL,
  claimed_at         timestamptz,
  due_at             timestamptz,
  completed_at       timestamptz,
  decision           varchar,
  input_json         jsonb NOT NULL DEFAULT '{}',
  output_json        jsonb,
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_tasks_case ON case_tasks(case_id);
CREATE INDEX idx_tasks_status ON case_tasks(status);
CREATE INDEX idx_tasks_assigned_user ON case_tasks(assigned_user_id);
CREATE INDEX idx_tasks_assigned_team ON case_tasks(assigned_team_id);
CREATE INDEX idx_tasks_due ON case_tasks(due_at)
  WHERE status IN ('pending','assigned','claimed');

ALTER TABLE cases
  ADD CONSTRAINT fk_cases_current_task
  FOREIGN KEY (current_task_id) REFERENCES case_tasks(id) ON DELETE SET NULL;

CREATE TABLE case_approvals (
  id                        serial PRIMARY KEY,
  case_id                   int NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  task_id                   int NOT NULL REFERENCES case_tasks(id) ON DELETE CASCADE,
  approval_type             varchar NOT NULL,
  status                    varchar NOT NULL DEFAULT 'requested',
  requested_from_user_id    int REFERENCES users(id) ON DELETE SET NULL,
  requested_from_role_id    int REFERENCES roles(id) ON DELETE SET NULL,
  requested_at              timestamptz NOT NULL DEFAULT now(),
  decided_at                timestamptz,
  decided_by                int REFERENCES users(id) ON DELETE SET NULL,
  decision_reason           varchar
);
CREATE INDEX idx_approvals_case ON case_approvals(case_id);
CREATE INDEX idx_approvals_status ON case_approvals(status);
CREATE INDEX idx_approvals_requested_user ON case_approvals(requested_from_user_id);

CREATE TABLE case_escalations (
  id                 serial PRIMARY KEY,
  case_id            int NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  source_task_id     int REFERENCES case_tasks(id) ON DELETE SET NULL,
  escalation_type    varchar NOT NULL,
  reason             varchar NOT NULL,
  from_user_id       int REFERENCES users(id) ON DELETE SET NULL,
  to_user_id         int REFERENCES users(id) ON DELETE SET NULL,
  to_team_id         int REFERENCES teams(id) ON DELETE SET NULL,
  triggered_at       timestamptz NOT NULL DEFAULT now(),
  resolved_at        timestamptz
);
CREATE INDEX idx_esc_case ON case_escalations(case_id);
CREATE INDEX idx_esc_to_user ON case_escalations(to_user_id);
CREATE INDEX idx_esc_to_team ON case_escalations(to_team_id);
CREATE INDEX idx_esc_triggered ON case_escalations(triggered_at);

CREATE TABLE case_events (
  id              serial PRIMARY KEY,
  case_id         int NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  event_type      varchar NOT NULL,
  node_id         int REFERENCES case_flow_nodes(id) ON DELETE SET NULL,
  task_id         int REFERENCES case_tasks(id) ON DELETE SET NULL,
  actor_user_id   int REFERENCES users(id) ON DELETE SET NULL,
  data_json       jsonb NOT NULL DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_events_case_created ON case_events(case_id, created_at);
CREATE INDEX idx_events_type ON case_events(event_type);

CREATE TABLE case_documents (
  id                serial PRIMARY KEY,
  case_id           int NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  task_id           int REFERENCES case_tasks(id) ON DELETE SET NULL,
  filename          varchar NOT NULL,
  mime_type         varchar NOT NULL,
  storage_path      varchar NOT NULL,
  file_size_bytes   bigint NOT NULL,
  document_type     varchar,
  uploaded_by       int NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  uploaded_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_docs_case ON case_documents(case_id);
CREATE INDEX idx_docs_task ON case_documents(task_id);

CREATE TABLE audit_logs (
  id              serial PRIMARY KEY,
  actor_user_id   int REFERENCES users(id) ON DELETE SET NULL,
  action          varchar NOT NULL,
  entity_type     varchar,
  entity_id       int,
  data_json       jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_actor ON audit_logs(actor_user_id);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at);`).forEach(x => children.push(x));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ===== 4. Software Design =====
children.push(H1("4. Software Design"));
children.push(P("This section describes how BankFlow orchestrates work at runtime. It begins with a consolidated table of use cases, then covers the case lifecycle, illustrates each use case with an activity diagram, shows the key backend interactions as sequence diagrams, and finally describes the deployment model."));

children.push(H2("4.1 Use Case Narratives"));
children.push(P("The table below lists the MVP use cases that exercise every significant feature of BankFlow. Each row identifies the actors, preconditions, postconditions, main scenario, and the entities touched. Use cases with an asterisk are scheduler-driven: a person becomes involved only when the automated path hits an exception."));

// Use case table
const ucWidths = [1700, 1200, 2400, 1400, 1200, 1460]; // sum 9360
const ucHeader = new TableRow({
  tableHeader: true,
  children: [
    tcell("Use Case", { bold: true, fill: "BEE3F8", width: ucWidths[0] }),
    tcell("Actors", { bold: true, fill: "BEE3F8", width: ucWidths[1] }),
    tcell("Description / Goal", { bold: true, fill: "BEE3F8", width: ucWidths[2] }),
    tcell("Preconditions", { bold: true, fill: "BEE3F8", width: ucWidths[3] }),
    tcell("Postconditions", { bold: true, fill: "BEE3F8", width: ucWidths[4] }),
    tcell("Referenced Entities", { bold: true, fill: "BEE3F8", width: ucWidths[5] }),
  ],
});

function ucRow(cells) {
  return new TableRow({
    children: cells.map((v, i) => tcellMulti(Array.isArray(v) ? v : [v], { size: 16, width: ucWidths[i] })),
  });
}

const ucTable = new Table({
  width: { size: 9360, type: WidthType.DXA },
  columnWidths: ucWidths,
  rows: [
    ucHeader,
    ucRow([
      "UC-1: AML Alert Review",
      ["AML Analyst", "Supervisor"],
      "Review an AML alert, record findings, and either close as false positive or escalate for supervisor approval of further action.",
      ["Alert payload received from AML source.", "Analyst team queue exists."],
      ["Case closed with recorded decision.", "Case events capture full timeline."],
      ["cases, case_tasks", "case_approvals", "case_events", "case_documents"],
    ]),
    ucRow([
      "UC-2: Payment Exception Handling",
      ["Payment Operator", "Approver"],
      "Review a failed or exceptional payment, decide a resolution (retry, reverse, correct, reject), and obtain approval when above threshold.",
      ["Exception payload received from payments system."],
      ["Resolution executed and recorded.", "Case closed."],
      ["cases, case_tasks", "case_approvals", "case_events"],
    ]),
    ucRow([
      "UC-3: KYC Refresh *",
      ["Intake Scheduler (automated)", "KYC Analyst (exception only)"],
      "Identify customers due for KYC re-verification, contact them, ingest documents, run checks, and close clean cases automatically. Humans handle non-response or risk-profile changes.",
      ["Case flow has an active schedule.", "Customer directory available."],
      ["Customer KYC record updated or escalated.", "Case closed."],
      ["case_flow_schedules", "cases, case_tasks", "case_events", "case_documents"],
    ]),
    ucRow([
      "UC-4: Dormant Account Flagging *",
      ["Intake Scheduler (automated)", "Compliance Officer (reporting path only)"],
      "Scan accounts for inactivity, notify customers, reset the flag on response, or restrict and queue for regulatory reporting on silence.",
      ["Case flow has an active schedule.", "Core banking access configured."],
      ["Account reset, or restricted with regulator report submitted.", "Case closed."],
      ["case_flow_schedules", "cases, case_tasks", "case_escalations", "case_events"],
    ]),
    ucRow([
      "UC-5: Regulatory Report Generation *",
      ["Intake Scheduler (automated)", "Compliance Analyst (error path only)"],
      "On a reporting deadline, pull the data, validate it, compile the report, and submit. Humans are engaged only when validation fails.",
      ["Reporting deadline reached (cron)."],
      ["Report submitted and receipt recorded.", "Case closed."],
      ["case_flow_schedules", "cases, case_tasks", "case_events", "case_documents"],
    ]),
  ],
});
children.push(ucTable);
children.push(P(" "));

children.push(H2("4.2 Case Lifecycle"));
children.push(P("Every case in BankFlow moves through a shared lifecycle regardless of case type. The state diagram below shows the legal transitions between statuses. Statuses that appear in filters and dashboards map directly to the column shown for each state."));
children.push(imgPara(img("04_state_case_lifecycle.png"), { alt: "BankFlow case lifecycle state diagram" }));
children.push(caption("Figure 4 — Case Lifecycle State Diagram"));

children.push(H2("4.3 Activity Diagrams"));
children.push(P("Each MVP use case is described below as an activity diagram. Swimlanes separate the actors responsible for each step, making it clear where automation runs, where a human is needed, and where the exception paths join back into the main flow."));

children.push(H3("4.3.1 UC-1: AML Alert Review"));
children.push(imgPara(img("05_activity_aml.png"), { alt: "UC-1 activity diagram" }));
children.push(caption("Figure 5 — AML Alert Review Activity Diagram"));

children.push(H3("4.3.2 UC-2: Payment Exception Handling"));
children.push(imgPara(img("06_activity_payment.png"), { alt: "UC-2 activity diagram" }));
children.push(caption("Figure 6 — Payment Exception Handling Activity Diagram"));

children.push(H3("4.3.3 UC-3: KYC Refresh"));
children.push(imgPara(img("07_activity_kyc.png"), { alt: "UC-3 activity diagram" }));
children.push(caption("Figure 7 — KYC Refresh Activity Diagram"));

children.push(H3("4.3.4 UC-4: Dormant Account Flagging"));
children.push(imgPara(img("08_activity_dormant.png"), { alt: "UC-4 activity diagram" }));
children.push(caption("Figure 8 — Dormant Account Flagging Activity Diagram"));

children.push(H3("4.3.5 UC-5: Regulatory Report Generation"));
children.push(imgPara(img("09_activity_regreport.png"), { alt: "UC-5 activity diagram" }));
children.push(caption("Figure 9 — Regulatory Report Generation Activity Diagram"));

children.push(H2("4.4 Sequence Diagrams"));
children.push(P("The sequence diagrams below show the backend collaborations that implement the activity diagrams. They focus on the interactions between the case orchestrator, the service layer, the database, and the n8n automation worker."));

children.push(H3("4.4.1 Case Intake and Orchestration Start"));
children.push(P("This sequence covers the end-to-end flow from the moment an intake request is accepted to the point where the orchestrator is either waiting on a human task or continuing to the next automation node."));
children.push(imgPara(img("10_seq_case_intake.png"), { alt: "Case intake sequence" }));
children.push(caption("Figure 10 — Case Intake and Orchestration Start"));

children.push(H3("4.4.2 Human Task Claim, Completion, and Approval"));
children.push(P("Shows how a task is claimed, how completion drives the orchestrator to the next node, and how the orchestrator creates an approval task that blocks progression until a decision is recorded."));
children.push(imgPara(img("11_seq_task_approval.png"), { alt: "Task and approval sequence" }));
children.push(caption("Figure 11 — Human Task Claim, Completion, and Approval"));

children.push(H3("4.4.3 SLA Breach and Escalation"));
children.push(P("Shows the periodic SLA scheduler detecting overdue tasks, recording an escalation, updating case status, and notifying the escalation target through an automation call."));
children.push(imgPara(img("12_seq_sla_escalation.png"), { alt: "SLA escalation sequence" }));
children.push(caption("Figure 12 — SLA Breach and Escalation"));

children.push(H3("4.4.4 Scheduled Intake with n8n Automation"));
children.push(P("Shows the intake scheduler evaluating due schedules, creating cases from the resulting target set, and using correlation identifiers to match n8n automation results back to the exact case event that triggered them."));
children.push(imgPara(img("13_seq_scheduled_intake.png"), { alt: "Scheduled intake sequence" }));
children.push(caption("Figure 13 — Scheduled Intake with n8n Automation"));

children.push(H2("4.5 Deployment Diagram"));
children.push(P("BankFlow is deployed as a Docker Compose stack for development and demonstration. The stack contains the frontend (nginx serving the Vite bundle), the backend (Express with embedded orchestrator and schedulers), PostgreSQL, n8n, and a shared volume for uploaded documents. No credentials are committed to source control; all configuration is provided through environment variables."));
children.push(imgPara(img("14_deployment.png"), { alt: "Deployment diagram" }));
children.push(caption("Figure 14 — BankFlow Deployment Diagram"));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ===== 5. GUI Design =====
children.push(H1("5. Graphical User Interface Design"));
children.push(P("The BankFlow interface is organized around four primary sections that match the way operations teams actually use the platform: a Dashboard for supervisors and oversight, an Operations section for operators and approvers doing daily work, a Flow Design section for designers authoring and publishing flows, and an Administration section for platform administrators."));

children.push(H2("5.1 GUI Hierarchy"));
children.push(P("The hierarchy below shows the top-level navigation and the screens reachable from each section. It is designed so that an operator processing tasks and a designer authoring a flow never need to compete for screen real estate."));
children.push(imgPara(img("15_gui_hierarchy.png"), { alt: "GUI hierarchy", maxW: 600 }));
children.push(caption("Figure 15 — BankFlow GUI Hierarchy"));

children.push(H3("Top-Level Navigation"));
children.push(P("Dashboard", { run: { bold: true } }));
children.push(bullet("Supervisor overview: active cases, state distribution, SLA heatmap"));
children.push(bullet("Overdue and SLA breach view"));
children.push(bullet("Pending approvals summary"));
children.push(bullet("Queue workload distribution"));

children.push(P("Operations", { run: { bold: true } }));
children.push(bullet("Cases list — filter by type, status, queue, assignee, priority"));
children.push(bullet("Case detail — Overview, Tasks, Documents, Events, Audit tabs"));
children.push(bullet("My Tasks — personal inbox of assigned and claimable work"));
children.push(bullet("Approvals Inbox — pending approvals for the signed-in user or their role"));
children.push(bullet("Escalations — cases that have been escalated to the user or their team"));

children.push(P("Flow Design", { run: { bold: true } }));
children.push(bullet("Flows list — all case flows with status and owner"));
children.push(bullet("Flow Builder — canvas plus node configuration panel"));
children.push(bullet("Flow Versions and Publish — version history and publish controls"));
children.push(bullet("Schedules — manage cron schedules for scheduled-intake flows"));
children.push(bullet("Templates — seeded templates for AML, payment exceptions, KYC refresh, dormant accounts, and regulatory reports"));

children.push(P("Administration", { run: { bold: true } }));
children.push(bullet("Users"));
children.push(bullet("Roles"));
children.push(bullet("Teams and Queues"));
children.push(bullet("Audit Logs"));
children.push(bullet("Platform Settings"));

children.push(H2("5.2 Output Interfaces"));
children.push(P("Output interfaces are the screens and components through which BankFlow presents information to users. They are organized around the operational mental model of cases, tasks, and timelines."));

children.push(P("Case-Centric Views", { run: { bold: true } }));
children.push(bullet("Case list with live status and ownership columns"));
children.push(bullet("Case detail header showing status, priority, assignee, team, current step, and SLA state"));
children.push(bullet("Case timeline with event types, actors, and timestamps"));
children.push(bullet("Task detail panels for human work, including input data and required output fields"));
children.push(bullet("Approval decision view with supporting context and required comment fields"));
children.push(bullet("Document listing per case with type, uploader, and upload time"));

children.push(P("Supervisor and Oversight Views", { run: { bold: true } }));
children.push(bullet("Dashboard widgets for active cases by queue, overdue work, pending approvals, and escalations"));
children.push(bullet("Queue workload view broken down by assignee and status"));
children.push(bullet("SLA heatmap highlighting case types or queues running hot"));

children.push(P("Design-Time Views", { run: { bold: true } }));
children.push(bullet("Flow canvas with nodes, edges, and execution branching visible at a glance"));
children.push(bullet("Node configuration preview showing the typed configuration surface for each node kind"));
children.push(bullet("Flow validation messages rendered inline on the canvas"));

children.push(P("Cross-Cutting Output", { run: { bold: true } }));
children.push(bullet("Status badges for case and task state (intake, in review, pending approval, escalated, resolved, closed, cancelled)"));
children.push(bullet("Confirmation and error toasts that summarize the action without leaking internals"));
children.push(bullet("Audit log rendering for administrators with filter by actor, entity type, and action"));

children.push(H2("5.3 Input Interfaces"));
children.push(P("Input interfaces are where users submit information to BankFlow. They prioritize validation, explicit confirmation for high-impact actions, and minimal friction for routine operational work."));

children.push(P("Case Operator Inputs", { run: { bold: true } }));
children.push(bullet("Claim, complete, and reassign task actions"));
children.push(bullet("Data capture forms driven by case flow node configuration"));
children.push(bullet("Document upload with file type and size validation"));
children.push(bullet("Decision and comment fields on human review tasks"));

children.push(P("Approver Inputs", { run: { bold: true } }));
children.push(bullet("Approve and reject actions with required reason fields where configured"));
children.push(bullet("Escalation trigger when a supervisor must intervene manually"));

children.push(P("Designer Inputs", { run: { bold: true } }));
children.push(bullet("Drag-and-drop node placement on the builder canvas"));
children.push(bullet("Node configuration forms typed per node kind"));
children.push(bullet("Edge configuration with labels and condition expressions"));
children.push(bullet("Publish action that creates a new immutable flow version"));
children.push(bullet("Schedule editor for cron expressions and timezone"));

children.push(P("Administrator Inputs", { run: { bold: true } }));
children.push(bullet("User create, update, and deactivate forms"));
children.push(bullet("Role and team assignment UI"));
children.push(bullet("Platform settings including document storage path and n8n connection details"));

children.push(P("Cross-Cutting Input Controls", { run: { bold: true } }));
children.push(bullet("Search and filter bars on all list pages"));
children.push(bullet("Date pickers on SLA due dates, schedules, and reporting deadlines"));
children.push(bullet("Toggle switches for activating or pausing flows, schedules, and users"));

// ---------- build document ----------
const doc = new Document({
  creator: "BankFlow",
  title: "BankFlow Software Design Document",
  description: "BankFlow Software Design Document",
  styles: {
    default: {
      document: { run: { font: "Arial", size: 22 } },
    },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 36, bold: true, font: "Arial", color: "2B6CB0" },
        paragraph: { spacing: { before: 360, after: 200 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 28, bold: true, font: "Arial", color: "2C5282" },
        paragraph: { spacing: { before: 260, after: 160 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 24, bold: true, font: "Arial", color: "2A4365" },
        paragraph: { spacing: { before: 180, after: 100 }, outlineLevel: 2 } },
    ],
  },
  numbering: {
    config: [
      {
        reference: "bullets",
        levels: [
          { level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
          { level: 1, format: LevelFormat.BULLET, text: "\u25E6", alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 1440, hanging: 360 } } } },
        ],
      },
    ],
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
      },
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: "BankFlow — Software Design Document   |   Page ", size: 18, color: "718096" }),
            new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "718096" }),
          ],
        })],
      }),
    },
    children,
  }],
});

Packer.toBuffer(doc).then(buf => {
  const out = "C:/Users/DELL/Desktop/HRFlow/BankFlow_SoftwareDesign.docx";
  fs.writeFileSync(out, buf);
  console.log("Wrote", out, "size", buf.length);
});
