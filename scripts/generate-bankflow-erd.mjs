import fs from "node:fs";

const out = "docs/assets/bankflow-current-erd.svg";
const W = 2600;
const H = 1700;

const tableW = 360;
const headerH = 34;
const rowH = 25;
const pad = 10;

const tables = [
  {
    id: "roles",
    name: "roles",
    x: 80,
    y: 80,
    cols: [
      ["PK", "id", "integer"],
      ["UQ", "name", "varchar"],
      ["", "created_at", "timestamptz"],
    ],
  },
  {
    id: "users",
    name: "users",
    x: 80,
    y: 245,
    cols: [
      ["PK", "id", "integer"],
      ["UQ", "email", "varchar"],
      ["", "password_hash", "varchar"],
      ["", "full_name", "varchar"],
      ["", "is_active", "boolean"],
      ["FK", "role_id", "integer"],
      ["", "created_at", "timestamptz"],
    ],
  },
  {
    id: "teams",
    name: "teams",
    x: 80,
    y: 500,
    cols: [
      ["PK", "id", "integer"],
      ["UQ", "key", "varchar(100)"],
      ["", "name", "varchar"],
      ["", "description", "varchar"],
      ["", "is_active", "boolean"],
      ["", "created_at", "timestamptz"],
      ["", "updated_at", "timestamptz"],
    ],
  },
  {
    id: "team_memberships",
    name: "team_memberships",
    x: 80,
    y: 760,
    cols: [
      ["PK", "id", "integer"],
      ["FK", "team_id", "integer"],
      ["FK", "user_id", "integer"],
      ["", "membership_role", "varchar"],
      ["", "is_primary", "boolean"],
      ["", "created_at", "timestamptz"],
    ],
  },
  {
    id: "http_allow_list_domains",
    name: "http_allow_list_domains",
    x: 80,
    y: 1015,
    cols: [
      ["PK", "id", "integer"],
      ["UQ", "domain", "varchar(255)"],
      ["FK", "created_by", "integer"],
      ["", "created_at", "timestamptz"],
    ],
  },
  {
    id: "audit_logs",
    name: "audit_logs",
    x: 80,
    y: 1210,
    cols: [
      ["PK", "id", "integer"],
      ["FK", "actor_user_id", "integer"],
      ["", "action", "varchar"],
      ["", "entity_type", "varchar"],
      ["", "entity_id", "integer"],
      ["", "data_json", "varchar"],
      ["", "created_at", "timestamptz"],
    ],
  },
  {
    id: "case_flows",
    name: "case_flows",
    x: 615,
    y: 120,
    cols: [
      ["PK", "id", "integer"],
      ["UQ", "key", "varchar(100)"],
      ["", "name", "varchar"],
      ["", "description", "varchar"],
      ["", "case_type", "varchar"],
      ["", "status", "case_flow_status"],
      ["FK", "owner_user_id", "integer"],
      ["FK", "current_published_version_id", "integer"],
      ["", "draft_data_schema_json", "jsonb"],
      ["", "created_at", "timestamptz"],
      ["", "updated_at", "timestamptz"],
      ["", "archived_at", "timestamptz"],
    ],
  },
  {
    id: "case_flow_draft_nodes",
    name: "case_flow_draft_nodes",
    x: 615,
    y: 510,
    cols: [
      ["PK", "id", "integer"],
      ["FK", "case_flow_id", "integer"],
      ["UQ", "node_key", "varchar(100)"],
      ["", "kind", "varchar(50)"],
      ["", "name", "varchar"],
      ["", "config_json", "jsonb"],
      ["", "pos_x", "integer"],
      ["", "pos_y", "integer"],
      ["", "created_at", "timestamptz"],
      ["", "updated_at", "timestamptz"],
    ],
  },
  {
    id: "case_flow_draft_edges",
    name: "case_flow_draft_edges",
    x: 615,
    y: 860,
    cols: [
      ["PK", "id", "integer"],
      ["FK", "case_flow_id", "integer"],
      ["UQ", "edge_key", "varchar(100)"],
      ["", "from_node_key", "varchar(100)"],
      ["", "to_node_key", "varchar(100)"],
      ["", "condition_json", "jsonb"],
      ["", "label", "varchar"],
      ["", "priority", "integer"],
      ["", "created_at", "timestamptz"],
      ["", "updated_at", "timestamptz"],
    ],
  },
  {
    id: "case_flow_versions",
    name: "case_flow_versions",
    x: 615,
    y: 1210,
    cols: [
      ["PK", "id", "integer"],
      ["FK", "case_flow_id", "integer"],
      ["UQ", "version_number", "integer"],
      ["", "status", "case_flow_version_status"],
      ["", "graph_json", "jsonb"],
      ["", "data_schema_json", "jsonb"],
      ["", "change_summary", "varchar"],
      ["FK", "published_by_user_id", "integer"],
      ["", "published_at", "timestamptz"],
      ["", "retired_at", "timestamptz"],
    ],
  },
  {
    id: "cases",
    name: "cases",
    x: 1160,
    y: 185,
    cols: [
      ["PK", "id", "integer"],
      ["FK", "case_flow_id", "integer"],
      ["FK", "case_flow_version_id", "integer"],
      ["UQ", "case_reference", "varchar(100)"],
      ["", "case_type", "varchar"],
      ["", "title", "varchar"],
      ["", "status", "case_status"],
      ["", "priority", "case_priority"],
      ["", "current_node_key", "varchar(100)"],
      ["", "current_task_id", "integer"],
      ["FK", "assignee_user_id", "integer"],
      ["FK", "assignee_team_id", "integer"],
      ["", "intake_source", "varchar"],
      ["", "case_data_json", "jsonb"],
      ["", "flow_snapshot_json", "jsonb"],
      ["", "outcome_json", "jsonb"],
      ["", "opened_at", "timestamptz"],
      ["", "resolved_at", "timestamptz"],
      ["", "closed_at", "timestamptz"],
      ["FK", "created_by_user_id", "integer"],
    ],
  },
  {
    id: "case_tasks",
    name: "case_tasks",
    x: 1160,
    y: 875,
    cols: [
      ["PK", "id", "integer"],
      ["FK", "case_id", "integer"],
      ["", "flow_node_key", "varchar(100)"],
      ["", "task_type", "case_task_type"],
      ["", "title", "varchar"],
      ["", "status", "case_task_status"],
      ["FK", "assigned_user_id", "integer"],
      ["FK", "assigned_team_id", "integer"],
      ["", "claim_policy", "claim_policy"],
      ["", "claimed_at", "timestamptz"],
      ["", "due_at", "timestamptz"],
      ["", "completed_at", "timestamptz"],
      ["", "decision", "varchar"],
      ["", "input_json", "jsonb"],
      ["", "output_json", "jsonb"],
      ["FK", "completed_by_user_id", "integer"],
    ],
  },
  {
    id: "case_approvals",
    name: "case_approvals",
    x: 2040,
    y: 120,
    cols: [
      ["PK", "id", "integer"],
      ["FK", "case_id", "integer"],
      ["FK", "task_id", "integer"],
      ["", "flow_node_key", "varchar(100)"],
      ["", "approval_label", "varchar"],
      ["", "status", "case_approval_status"],
      ["FK", "requested_from_user_id", "integer"],
      ["FK", "requested_from_role_id", "integer"],
      ["FK", "requested_from_team_id", "integer"],
      ["", "requested_at", "timestamptz"],
      ["", "due_at", "timestamptz"],
      ["", "decided_at", "timestamptz"],
      ["FK", "decided_by_user_id", "integer"],
      ["", "required_comment", "boolean"],
      ["", "decision_reason", "varchar"],
    ],
  },
  {
    id: "case_documents",
    name: "case_documents",
    x: 2040,
    y: 620,
    cols: [
      ["PK", "id", "integer"],
      ["FK", "case_id", "integer"],
      ["FK", "task_id", "integer"],
      ["", "flow_node_key", "varchar(100)"],
      ["", "filename", "varchar"],
      ["", "mime_type", "varchar"],
      ["", "storage_path", "varchar"],
      ["", "document_type", "varchar"],
      ["", "metadata_json", "jsonb"],
      ["FK", "uploaded_by_user_id", "integer"],
      ["", "uploaded_at", "timestamptz"],
    ],
  },
  {
    id: "case_escalations",
    name: "case_escalations",
    x: 2040,
    y: 995,
    cols: [
      ["PK", "id", "integer"],
      ["FK", "case_id", "integer"],
      ["FK", "source_task_id", "integer"],
      ["", "flow_node_key", "varchar(100)"],
      ["", "escalation_type", "varchar"],
      ["", "status", "case_escalation_status"],
      ["", "reason", "varchar"],
      ["FK", "from_user_id", "integer"],
      ["FK", "to_user_id", "integer"],
      ["FK", "to_team_id", "integer"],
      ["", "triggered_at", "timestamptz"],
      ["", "resolved_at", "timestamptz"],
      ["FK", "resolved_by_user_id", "integer"],
    ],
  },
  {
    id: "case_events",
    name: "case_events",
    x: 1590,
    y: 875,
    cols: [
      ["PK", "id", "integer"],
      ["FK", "case_id", "integer"],
      ["", "flow_node_key", "varchar(100)"],
      ["FK", "task_id", "integer"],
      ["FK", "actor_user_id", "integer"],
      ["", "event_type", "case_event_type"],
      ["", "summary", "varchar"],
      ["", "data_json", "jsonb"],
      ["", "created_at", "timestamptz"],
    ],
  },
];

const table = new Map(tables.map((t) => [t.id, t]));
const h = (t) => headerH + t.cols.length * rowH + 8;
const p = (id, side, offset = 0) => {
  const t = table.get(id);
  if (side === "right") return [t.x + tableW, t.y + h(t) / 2 + offset];
  if (side === "left") return [t.x, t.y + h(t) / 2 + offset];
  if (side === "top") return [t.x + tableW / 2 + offset, t.y];
  return [t.x + tableW / 2 + offset, t.y + h(t)];
};

const rels = [
  ["roles", "right", "users", "left", 0, -50],
  ["users", "right", "team_memberships", "left", -20, -5],
  ["teams", "right", "team_memberships", "left", 0, 25],
  ["users", "right", "http_allow_list_domains", "left", 60, -20],
  ["users", "right", "audit_logs", "left", 75, -20],
  ["users", "right", "case_flows", "left", 5, -60],
  ["users", "right", "case_flow_versions", "left", 25, 40],
  ["case_flows", "bottom", "case_flow_draft_nodes", "top", -70, -70],
  ["case_flows", "bottom", "case_flow_draft_edges", "top", 0, 0],
  ["case_flows", "bottom", "case_flow_versions", "top", 70, 70],
  ["case_flows", "right", "cases", "left", -50, -100],
  ["case_flow_versions", "right", "cases", "left", -20, 0],
  ["users", "right", "cases", "left", 0, 80],
  ["teams", "right", "cases", "left", 60, 130],
  ["cases", "bottom", "case_tasks", "top", -90, -90],
  ["cases", "right", "case_approvals", "left", -110, -70],
  ["cases", "right", "case_documents", "left", -10, -55],
  ["cases", "right", "case_events", "left", 80, -60],
  ["cases", "right", "case_escalations", "left", 120, -25],
  ["case_tasks", "right", "case_approvals", "left", -80, 70],
  ["case_tasks", "right", "case_documents", "left", -10, 45],
  ["case_tasks", "right", "case_events", "left", 55, 25],
  ["case_tasks", "right", "case_escalations", "left", 85, 45],
  ["users", "right", "case_tasks", "left", 35, 90],
  ["teams", "right", "case_tasks", "left", 80, 120],
  ["users", "right", "case_approvals", "left", 45, 125],
  ["roles", "right", "case_approvals", "left", 35, 145],
  ["teams", "right", "case_approvals", "left", 30, 165],
  ["users", "right", "case_documents", "left", 55, 110],
  ["users", "right", "case_events", "left", 75, 90],
  ["users", "right", "case_escalations", "left", 90, 95],
  ["teams", "right", "case_escalations", "left", 110, 125],
];

function esc(s) {
  return String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function pathD([a, aside, b, bside, ao = 0, bo = 0]) {
  const [x1, y1] = p(a, aside, ao);
  const [x2, y2] = p(b, bside, bo);
  const mx = Math.round((x1 + x2) / 2);
  if (aside === "bottom" || bside === "top") {
    const my = Math.round((y1 + y2) / 2);
    return `M ${x1} ${y1} L ${x1} ${my} L ${x2} ${my} L ${x2} ${y2}`;
  }
  return `M ${x1} ${y1} L ${mx} ${y1} L ${mx} ${y2} L ${x2} ${y2}`;
}

function endpoint([x, y], kind, dir = 1) {
  if (kind === "one") {
    return `<path d="M ${x + dir * 7} ${y - 7} L ${x + dir * 7} ${y + 7}" class="card"/>`;
  }
  return `
    <path d="M ${x + dir * 8} ${y} L ${x + dir * 18} ${y - 9}" class="card"/>
    <path d="M ${x + dir * 8} ${y} L ${x + dir * 18} ${y}" class="card"/>
    <path d="M ${x + dir * 8} ${y} L ${x + dir * 18} ${y + 9}" class="card"/>`;
}

function relSvg(r) {
  const [x1, y1] = p(r[0], r[1], r[4] ?? 0);
  const [x2, y2] = p(r[2], r[3], r[5] ?? 0);
  const dir1 = r[1] === "left" ? -1 : 1;
  const dir2 = r[3] === "left" ? -1 : 1;
  return `
    <g class="rel">
      <path d="${pathD(r)}"/>
      ${endpoint([x1, y1], "one", dir1)}
      ${endpoint([x2, y2], "many", dir2)}
    </g>`;
}

function badge(kind, x, y) {
  if (kind === "PK") return `<rect x="${x}" y="${y - 13}" width="25" height="16" rx="3" class="pk"/><text x="${x + 12.5}" y="${y - 1}" class="badge">PK</text>`;
  if (kind === "FK") return `<rect x="${x}" y="${y - 13}" width="25" height="16" rx="3" class="fk"/><text x="${x + 12.5}" y="${y - 1}" class="badge">FK</text>`;
  if (kind === "UQ") return `<rect x="${x}" y="${y - 13}" width="25" height="16" rx="3" class="uq"/><text x="${x + 12.5}" y="${y - 1}" class="badge">UQ</text>`;
  return `<circle cx="${x + 12}" cy="${y - 6}" r="4" class="col-dot"/>`;
}

function tableSvg(t) {
  const rows = t.cols
    .map(([kind, name, type], i) => {
      const y = t.y + headerH + 22 + i * rowH;
      const rowY = t.y + headerH + i * rowH;
      return `
        <rect x="${t.x + 1}" y="${rowY}" width="${tableW - 2}" height="${rowH}" class="${i % 2 ? "row alt" : "row"}"/>
        ${badge(kind, t.x + 10, y)}
        <text x="${t.x + 44}" y="${y}" class="${kind === "PK" ? "col pk-text" : kind === "FK" ? "col fk-text" : "col"}">${esc(name)}</text>
        <text x="${t.x + 235}" y="${y}" class="type">${esc(type)}</text>`;
    })
    .join("");
  return `
    <g class="table" id="${t.id}">
      <rect x="${t.x}" y="${t.y}" width="${tableW}" height="${h(t)}" class="table-box"/>
      <rect x="${t.x}" y="${t.y}" width="${tableW}" height="${headerH}" class="table-head"/>
      <g transform="translate(${t.x + 12} ${t.y + 9})">
        <rect x="0" y="0" width="16" height="16" rx="2" class="table-icon"/>
        <path d="M 3 5 H 13 M 3 9 H 13 M 3 13 H 13" class="table-icon-line"/>
      </g>
      <text x="${t.x + 36}" y="${t.y + 23}" class="table-title">${esc(t.name)}</text>
      ${rows}
    </g>`;
}

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
      <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#d9e1e8" stroke-width="1"/>
    </pattern>
    <filter id="paneShadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="1" dy="2" stdDeviation="2" flood-color="#5f6b75" flood-opacity="0.18"/>
    </filter>
    <style>
      .workspace { fill: #eef3f7; }
      .grid { fill: url(#grid); opacity: 0.75; }
      .table-box { fill: #ffffff; stroke: #9aa9b8; stroke-width: 1.2; filter: url(#paneShadow); }
      .table-head { fill: #dce8f5; stroke: #8fa6bd; stroke-width: 1.2; }
      .table-title { font: 700 16px "Segoe UI", Arial, sans-serif; fill: #1e3448; }
      .row { fill: #ffffff; }
      .row.alt { fill: #f7fafc; }
      .col { font: 14px "Segoe UI", Arial, sans-serif; fill: #1f2933; }
      .type { font: 13px "Segoe UI", Arial, sans-serif; fill: #607080; }
      .pk-text { font-weight: 700; fill: #111827; }
      .fk-text { fill: #075985; }
      .pk { fill: #f6c54d; stroke: #a77100; stroke-width: 0.7; }
      .fk { fill: #b7d8ff; stroke: #4f83bd; stroke-width: 0.7; }
      .uq { fill: #dadde3; stroke: #8a94a3; stroke-width: 0.7; }
      .badge { font: 700 8px "Segoe UI", Arial, sans-serif; fill: #1f2933; text-anchor: middle; }
      .col-dot { fill: #c2cbd3; stroke: #8d99a5; stroke-width: 0.6; }
      .table-icon { fill: #7fa6cf; stroke: #37638c; stroke-width: 0.8; }
      .table-icon-line { stroke: #ffffff; stroke-width: 1; }
      .rel path:first-child { fill: none; stroke: #4f6275; stroke-width: 1.6; }
      .card { fill: none; stroke: #4f6275; stroke-width: 1.6; stroke-linecap: square; }
    </style>
  </defs>
  <rect width="${W}" height="${H}" class="workspace"/>
  <rect width="${W}" height="${H}" class="grid"/>
  <g class="relationships">${rels.map(relSvg).join("\n")}</g>
  <g class="tables">${tables.map(tableSvg).join("\n")}</g>
</svg>`;

fs.mkdirSync("docs/assets", { recursive: true });
fs.writeFileSync(out, svg, "utf8");
console.log(out);
