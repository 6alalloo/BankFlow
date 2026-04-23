"""
BankFlow — Class Diagram (matplotlib)
Strict 5-column layout:
  Col 1: API Layer (Controllers)
  Col 2: Service Layer
  Col 3: Orchestration
  Col 4: Domain (Identity+Flow / Case Runtime)
  Col 5: Enumerations
"""
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import FancyBboxPatch
import warnings
warnings.filterwarnings("ignore")

# ── canvas ─────────────────────────────────────────────────────────────
FIG_W, FIG_H = 34, 26
fig, ax = plt.subplots(figsize=(FIG_W, FIG_H))
ax.set_xlim(0, FIG_W)
ax.set_ylim(0, FIG_H)
ax.axis("off")
fig.patch.set_facecolor("white")

# ── palette ─────────────────────────────────────────────────────────────
C_CLASS_BG   = "#EBF8FF"
C_CLASS_ED   = "#2B6CB0"
C_HEAD_BG    = "#BEE3F8"
C_IFACE_BG   = "#FFFDE7"
C_IFACE_ED   = "#B7791F"
C_ENUM_BG    = "#E6FFFA"
C_ENUM_ED    = "#2C7A7B"
C_PKG_BG     = "#FAFAFA"
C_ARROW      = "#4A5568"
C_INHERIT    = "#2B6CB0"
C_TITLE      = "#1A365D"
C_SEP        = "#90CDF4"
C_TEXT       = "#1A202C"
C_STEREO     = "#4A5568"

# ── helpers ─────────────────────────────────────────────────────────────
LINE_H   = 0.28   # height per attribute/method line
HEAD_H   = 0.42   # header height
PAD      = 0.12   # internal x padding

def class_box(ax, cx, top_y, name, stereotype, members,
              bg=C_CLASS_BG, ed=C_CLASS_ED, hbg=C_HEAD_BG,
              width=2.9):
    """Draw a UML class box; returns (cx, top_y, bottom_y)."""
    n_lines = len(members)
    h = HEAD_H + n_lines * LINE_H + PAD
    x = cx - width / 2
    y = top_y - h

    # main box
    rect = FancyBboxPatch((x, y), width, h,
                          boxstyle="square,pad=0",
                          facecolor=bg, edgecolor=ed,
                          linewidth=1.2, zorder=3)
    ax.add_patch(rect)

    # header fill
    head = FancyBboxPatch((x, y + h - HEAD_H), width, HEAD_H,
                          boxstyle="square,pad=0",
                          facecolor=hbg, edgecolor=ed,
                          linewidth=1.2, zorder=4)
    ax.add_patch(head)

    # separator line between header and members
    ax.plot([x, x + width], [y + h - HEAD_H, y + h - HEAD_H],
            color=ed, lw=0.8, zorder=5)

    # stereotype text (small, italic, grey)
    if stereotype:
        ax.text(cx, y + h - HEAD_H * 0.28, f"«{stereotype}»",
                ha="center", va="center", fontsize=6.5,
                color=C_STEREO, style="italic", zorder=6)
        ax.text(cx, y + h - HEAD_H * 0.68, name,
                ha="center", va="center", fontsize=8,
                fontweight="bold", color=C_TEXT, zorder=6)
    else:
        ax.text(cx, y + h - HEAD_H / 2, name,
                ha="center", va="center", fontsize=8,
                fontweight="bold", color=C_TEXT, zorder=6)

    # members
    for i, m in enumerate(members):
        my = y + h - HEAD_H - (i + 0.6) * LINE_H
        ax.text(x + PAD, my, m,
                ha="left", va="center", fontsize=6.5,
                color=C_TEXT, zorder=6, family="monospace")

    # mid-member separator line (after attrs before methods)
    # find the first method line (starts with +/- followed by lowercase and '(')
    sep_idx = None
    for i, m in enumerate(members):
        stripped = m.lstrip("+- ")
        if "(" in stripped:
            sep_idx = i
            break
    if sep_idx and sep_idx > 0:
        sy = y + h - HEAD_H - sep_idx * LINE_H
        ax.plot([x, x + width], [sy, sy],
                color=C_SEP, lw=0.6, zorder=5)

    # connector points
    top_mid   = (cx, top_y)
    bot_mid   = (cx, y)
    left_mid  = (x, (top_y + y) / 2)
    right_mid = (x + width, (top_y + y) / 2)
    return {"top": top_mid, "bot": bot_mid,
            "left": left_mid, "right": right_mid,
            "cx": cx, "cy": (top_y + y) / 2,
            "y_top": top_y, "y_bot": y, "w": width}


def pkg_box(ax, x, y, w, h, title, color="#FAFAFA", border="#718096"):
    rect = FancyBboxPatch((x, y), w, h,
                          boxstyle="round,pad=0.05",
                          facecolor=color, edgecolor=border,
                          linewidth=1.8, zorder=1, alpha=0.55)
    ax.add_patch(rect)
    ax.text(x + w / 2, y + h - 0.18, title,
            ha="center", va="top", fontsize=11,
            fontweight="bold", color="#2D3748", zorder=2)


def arrow(ax, x0, y0, x1, y1, style="dep", color=C_ARROW):
    """style: dep=dashed uses, inh=solid inheritance, comp=solid composition"""
    ls = "--" if style == "dep" else "-"
    hs = "->" if style in ("dep", "comp") else "-|>"
    ax.annotate("", xy=(x1, y1), xytext=(x0, y0),
                arrowprops=dict(arrowstyle=hs, color=color,
                                lw=1.0, linestyle=ls),
                zorder=2)


def arrow_label(ax, x0, y0, x1, y1, label, color=C_ARROW):
    ls = "--"
    ax.annotate("", xy=(x1, y1), xytext=(x0, y0),
                arrowprops=dict(arrowstyle="->", color=color,
                                lw=0.9, linestyle=ls),
                zorder=2)
    mx, my = (x0 + x1) / 2, (y0 + y1) / 2
    ax.text(mx + 0.05, my + 0.08, label, fontsize=6.5,
            color=color, style="italic", zorder=7)


def comp_line(ax, x0, y0, x1, y1, label="", color="#4A5568"):
    ax.plot([x0, x1], [y0, y1], color=color, lw=0.85, zorder=2)
    if label:
        mx, my = (x0 + x1) / 2, (y0 + y1) / 2
        ax.text(mx + 0.05, my + 0.06, label, fontsize=6,
                color=color, zorder=7)


# ── title ───────────────────────────────────────────────────────────────
ax.text(FIG_W / 2, FIG_H - 0.3, "BankFlow — Class Diagram",
        ha="center", va="top", fontsize=18, fontweight="bold",
        color=C_TITLE, zorder=10)

# ═══════════════════════════════════════════════════════════════════════
# COLUMN X CENTRES
# ═══════════════════════════════════════════════════════════════════════
C1 = 2.2     # API / Controllers
C2 = 6.4     # Service Layer
C3 = 11.0    # Orchestration
C4A = 16.2   # Identity & Access
C4B = 20.8   # Flow Definition
C5A = 25.5   # Case Runtime
C5B = 30.8   # Enumerations

CW_CTRL  = 2.7
CW_SVC   = 3.0
CW_ORCH  = 3.0
CW_DOM   = 3.1
CW_ENUM  = 2.5

# ── package backgrounds ─────────────────────────────────────────────────
pkg_box(ax, 0.2,  0.3, 4.3,  FIG_H - 1.1, "API Layer · Controllers", "#EFF6FF", "#3182CE")
pkg_box(ax, 4.7,  0.3, 4.8,  FIG_H - 1.1, "Service Layer",           "#F0FFF4", "#38A169")
pkg_box(ax, 9.6,  0.3, 4.7,  FIG_H - 1.1, "Orchestration",           "#FFFBF0", "#D69E2E")
pkg_box(ax, 14.4, 0.3, 8.0,  FIG_H - 1.1, "Domain Model",            "#FFF5F5", "#E53E3E")
pkg_box(ax, 22.7, 0.3, 6.5,  FIG_H - 1.1, "Case Runtime",            "#F0F8FF", "#3182CE")
pkg_box(ax, 29.4, 0.3, 4.3,  FIG_H - 1.1, "Enumerations",            "#F5F5F5", "#718096")

# ═══════════════════════════════════════════════════════════════════════
# COL 1 — CONTROLLERS
# ═══════════════════════════════════════════════════════════════════════
TOP = FIG_H - 1.4
GAP = 0.22

ctrl_data = [
    ("CaseController",      "ctrl",  ["+listCases(req,res)","+createCase(req,res)","+getCase(req,res)","+updateStatus(req,res)","+getCaseEvents(req,res)"]),
    ("TaskController",      "ctrl",  ["+listMyTasks(req,res)","+claimTask(req,res)","+completeTask(req,res)","+reassignTask(req,res)"]),
    ("ApprovalController",  "ctrl",  ["+listApprovals(req,res)","+approve(req,res)","+reject(req,res)"]),
    ("FlowController",      "ctrl",  ["+listFlows(req,res)","+createFlow(req,res)","+publishFlow(req,res)","+saveGraph(req,res)"]),
    ("DashboardController", "ctrl",  ["+getOverview(req,res)","+getQueues(req,res)","+getOverdue(req,res)"]),
    ("AdminController",     "ctrl",  ["+listUsers(req,res)","+createUser(req,res)","+listTeams(req,res)","+getAuditLogs(req,res)"]),
]

ctrl_boxes = {}
y = TOP
for name, st, members in ctrl_data:
    b = class_box(ax, C1, y, name, st, members, width=CW_CTRL)
    ctrl_boxes[name] = b
    y = b["y_bot"] - GAP

# ═══════════════════════════════════════════════════════════════════════
# COL 2 — SERVICES
# ═══════════════════════════════════════════════════════════════════════
svc_data = [
    ("CaseService",      "svc", ["+getCases(filters):Case[]","+createCase(flowId,payload):Case","+getCaseById(id):Case","+updateStatus(id,status):Case"]),
    ("TaskService",      "svc", ["+getMyTasks(userId):CaseTask[]","+claimTask(taskId,userId):CaseTask","+completeTask(taskId,output):CaseTask","+reassignTask(taskId,target):CaseTask"]),
    ("ApprovalService",  "svc", ["+getPending(userId):CaseApproval[]","+approve(id,userId,reason):CaseApproval","+reject(id,userId,reason):CaseApproval"]),
    ("FlowService",      "svc", ["+getFlows():CaseFlow[]","+createFlow(data):CaseFlow","+publishFlow(id,uid):CaseFlowVersion","+saveGraph(id,nodes,edges):void"]),
    ("CaseEventService", "svc", ["+record(caseId,type,actorId,data):CaseEvent","+getTimeline(caseId):CaseEvent[]"]),
    ("EscalationService","svc", ["+createEscalation(caseId,taskId,reason,target):CaseEscalation"]),
    ("DashboardService", "svc", ["+getOverview():DashboardStats","+getQueueWorkload():QueueStats[]","+getOverdueTasks():CaseTask[]"]),
    ("AuthService",      "svc", ["+validateCredentials(email,pwd):User","+generateToken(user):string","+verifyToken(token):Payload"]),
    ("AuditService",     "svc", ["+log(actorId,action,entity,id):AuditLog","+getAuditLogs(filters):AuditLog[]"]),
]

svc_boxes = {}
y = TOP
for name, st, members in svc_data:
    b = class_box(ax, C2, y, name, st, members, width=CW_SVC)
    svc_boxes[name] = b
    y = b["y_bot"] - GAP

# ═══════════════════════════════════════════════════════════════════════
# COL 3 — ORCHESTRATION
# ═══════════════════════════════════════════════════════════════════════
orch_data_top = [
    ("CaseOrchestrator", "svc",
     ["+start(caseId):void","+advance(caseId):void","+handleSlaBreach(taskId):void","-loadGraph(caseId):GraphSnapshot","-identifyNextNode(nodeId):CaseFlowNode"]),
    ("NodeExecutor",     "interface",
     ["+execute(node,context):NodeResult"],
     C_IFACE_BG, C_IFACE_ED, C_IFACE_BG),
    ("DecisionExecutor", "exec",
     ["-evaluateCondition(expr,payload):bool","+execute(node,context):NodeResult"]),
    ("ApprovalNodeExecutor","exec",
     ["+execute(node,context):NodeResult"]),
    ("RoutingExecutor",  "exec",
     ["+execute(node,context):NodeResult"]),
    ("AutomationNodeExecutor","exec",
     ["+execute(node,context):NodeResult"]),
]

orch_data_bot = [
    ("SlaScheduler",   "sched", ["-intervalMs:number","+start():void","-detectOverdueTasks():CaseTask[]"]),
    ("IntakeScheduler","sched", ["-intervalMs:number","+start():void","-getDueSchedules():CaseFlowSchedule[]"]),
    ("AutomationClient","client",["-n8nBaseUrl:string","+call(path,payload,correlation):void","+handleCallback(correlationId,result):void"]),
]

orch_boxes = {}
y = TOP
for row in orch_data_top:
    name, st, members = row[0], row[1], row[2]
    kw = {}
    if len(row) > 3:
        kw = {"bg": row[3], "ed": row[4], "hbg": row[5]}
    b = class_box(ax, C3, y, name, st, members, width=CW_ORCH, **kw)
    orch_boxes[name] = b
    y = b["y_bot"] - GAP

y -= 0.3  # extra gap before schedulers
for name, st, members in orch_data_bot:
    b = class_box(ax, C3, y, name, st, members, width=CW_ORCH)
    orch_boxes[name] = b
    y = b["y_bot"] - GAP

# ═══════════════════════════════════════════════════════════════════════
# COL 4A — IDENTITY & ACCESS
# ═══════════════════════════════════════════════════════════════════════
ia_data = [
    ("Role",           "entity", ["+id:int","+name:string"]),
    ("User",           "entity", ["+id:int","+email:string","+fullName:string","+isActive:boolean","+roleId:int"]),
    ("Team",           "entity", ["+id:int","+name:string","+isActive:boolean"]),
    ("TeamMembership", "entity", ["+id:int","+userId:int","+teamId:int","+membershipRole:string"]),
]

ia_boxes = {}
y = TOP
for name, st, members in ia_data:
    b = class_box(ax, C4A, y, name, st, members, width=CW_DOM)
    ia_boxes[name] = b
    y = b["y_bot"] - GAP

# ═══════════════════════════════════════════════════════════════════════
# COL 4B — FLOW DEFINITION
# ═══════════════════════════════════════════════════════════════════════
fd_data = [
    ("CaseFlow",         "entity", ["+id:int","+name:string","+caseType:string","+status:string","+ownerUserId:int","+activeVersionId:int"]),
    ("CaseFlowVersion",  "entity", ["+id:int","+caseFlowId:int","+versionNumber:int","+status:string","+graphSnapshotJson:object","+publishedAt:Date"]),
    ("CaseFlowNode",     "entity", ["+id:int","+caseFlowVersionId:int","+nodeKey:string","+kind:NodeKind","+configJson:object"]),
    ("CaseFlowEdge",     "entity", ["+id:int","+fromNodeId:int","+toNodeId:int","+conditionJson:object","+label:string"]),
    ("CaseFlowSchedule", "entity", ["+id:int","+caseFlowId:int","+cronExpression:string","+isActive:boolean","+nextRunAt:Date"]),
]

fd_boxes = {}
y = TOP
for name, st, members in fd_data:
    b = class_box(ax, C4B, y, name, st, members, width=CW_DOM)
    fd_boxes[name] = b
    y = b["y_bot"] - GAP

# ═══════════════════════════════════════════════════════════════════════
# COL 5A — CASE RUNTIME
# ═══════════════════════════════════════════════════════════════════════
rt_data = [
    ("Case",          "entity", ["+id:int","+caseReference:string","+caseFlowVersionId:int","+caseType:string","+status:CaseStatus","+priority:string","+currentNodeId:int","+assigneeUserId:int","+payloadJson:object","+openedAt:Date"]),
    ("CaseTask",      "entity", ["+id:int","+caseId:int","+nodeId:int","+taskType:string","+status:TaskStatus","+assignedUserId:int","+dueAt:Date","+decision:string","+outputJson:object"]),
    ("CaseApproval",  "entity", ["+id:int","+caseId:int","+taskId:int","+approvalType:string","+status:ApprovalStatus","+requestedFromUserId:int","+decidedBy:int","+decisionReason:string"]),
    ("CaseEscalation","entity", ["+id:int","+caseId:int","+escalationType:string","+reason:string","+toUserId:int","+triggeredAt:Date"]),
    ("CaseEvent",     "entity", ["+id:int","+caseId:int","+eventType:string","+actorUserId:int","+dataJson:object","+createdAt:Date"]),
    ("CaseDocument",  "entity", ["+id:int","+caseId:int","+taskId:int","+filename:string","+mimeType:string","+storagePath:string","+documentType:string"]),
    ("AuditLog",      "entity", ["+id:int","+actorUserId:int","+action:string","+entityType:string","+entityId:int","+createdAt:Date"]),
]

rt_boxes = {}
y = TOP
for name, st, members in rt_data:
    b = class_box(ax, C5A, y, name, st, members, width=CW_DOM)
    rt_boxes[name] = b
    y = b["y_bot"] - GAP

# ═══════════════════════════════════════════════════════════════════════
# COL 5B — ENUMERATIONS
# ═══════════════════════════════════════════════════════════════════════
enum_data = [
    ("CaseStatus",    ["INTAKE","IN_REVIEW","PENDING_ACTION","PENDING_APPROVAL","ESCALATED","RESOLVED","CLOSED","CANCELLED"]),
    ("TaskStatus",    ["PENDING","ASSIGNED","CLAIMED","COMPLETED","REJECTED","OVERDUE","CANCELLED"]),
    ("ApprovalStatus",["REQUESTED","APPROVED","REJECTED","EXPIRED"]),
    ("NodeKind",      ["CASE_INTAKE","DATA_CAPTURE","APPROVAL","DECISION","ROUTING","NOTIFICATION","DOCUMENT_UPLOAD","TIMER_SLA","INTEGRATION","STATUS_UPDATE","ESCALATION"]),
]

en_boxes = {}
y = TOP
for name, members in enum_data:
    b = class_box(ax, C5B, y, name, "enum", members,
                  bg=C_ENUM_BG, ed=C_ENUM_ED, hbg="#B2F5EA",
                  width=CW_ENUM)
    en_boxes[name] = b
    y = b["y_bot"] - GAP

# ═══════════════════════════════════════════════════════════════════════
# RELATIONSHIPS
# ═══════════════════════════════════════════════════════════════════════

def dep(from_box, to_box, side_from="right", side_to="left", label="", color=C_ARROW):
    """Dashed dependency arrow."""
    p0 = from_box[side_from]
    p1 = to_box[side_to]
    if label:
        arrow_label(ax, p0[0], p0[1], p1[0], p1[1], label, color)
    else:
        arrow(ax, p0[0], p0[1], p1[0], p1[1], "dep", color)


def inh(from_box, to_box):
    """Solid inheritance/realisation arrow (open triangle head)."""
    p0 = from_box["top"]
    p1 = to_box["bot"]
    ax.annotate("", xy=(p1[0], p1[1]), xytext=(p0[0], p0[1]),
                arrowprops=dict(arrowstyle="-|>", color=C_INHERIT,
                                lw=1.1, linestyle="--"),
                zorder=2)


def assoc(from_box, to_box, label="", side0="right", side1="left"):
    p0 = from_box[side0]
    p1 = to_box[side1]
    comp_line(ax, p0[0], p0[1], p1[0], p1[1], label)


# ── NodeExecutor implementations (dashed realisation) ──────────────────
for exec_name in ["DecisionExecutor","ApprovalNodeExecutor","RoutingExecutor","AutomationNodeExecutor"]:
    inh(orch_boxes[exec_name], orch_boxes["NodeExecutor"])

# ── CaseOrchestrator uses NodeExecutor ──────────────────────────────────
dep(orch_boxes["CaseOrchestrator"], orch_boxes["NodeExecutor"],
    side_from="bot", side_to="top", label="delegates")

# ── CaseOrchestrator → AutomationClient ─────────────────────────────────
dep(orch_boxes["CaseOrchestrator"], orch_boxes["AutomationClient"],
    side_from="bot", side_to="top")

# ── AutomationNodeExecutor → AutomationClient ───────────────────────────
dep(orch_boxes["AutomationNodeExecutor"], orch_boxes["AutomationClient"],
    side_from="right", side_to="left")

# ── SlaScheduler / IntakeScheduler → CaseOrchestrator ───────────────────
dep(orch_boxes["SlaScheduler"], orch_boxes["CaseOrchestrator"],
    side_from="top", side_to="bot")
dep(orch_boxes["IntakeScheduler"], orch_boxes["CaseOrchestrator"],
    side_from="top", side_to="bot")

# ── Controllers → Services ───────────────────────────────────────────────
ctrl_svc_map = [
    ("CaseController",       "CaseService"),
    ("CaseController",       "CaseEventService"),
    ("TaskController",       "TaskService"),
    ("ApprovalController",   "ApprovalService"),
    ("FlowController",       "FlowService"),
    ("DashboardController",  "DashboardService"),
    ("AdminController",      "AuditService"),
]
for cname, sname in ctrl_svc_map:
    dep(ctrl_boxes[cname], svc_boxes[sname])

# ── Services → Orchestrator ──────────────────────────────────────────────
for sname in ["CaseService","TaskService","ApprovalService"]:
    dep(svc_boxes[sname], orch_boxes["CaseOrchestrator"])

# ── Services → CaseEventService ─────────────────────────────────────────
for sname in ["TaskService","ApprovalService","EscalationService"]:
    dep(svc_boxes[sname], svc_boxes["CaseEventService"])

# ── Services → Domain entities ───────────────────────────────────────────
svc_dom_map = [
    ("CaseService",      rt_boxes, "Case"),
    ("TaskService",      rt_boxes, "CaseTask"),
    ("ApprovalService",  rt_boxes, "CaseApproval"),
    ("EscalationService",rt_boxes,"CaseEscalation"),
    ("FlowService",      fd_boxes, "CaseFlow"),
]
for sname, dom_dict, dname in svc_dom_map:
    dep(svc_boxes[sname], dom_dict[dname])

# ── Identity & Access associations ───────────────────────────────────────
assoc(ia_boxes["Role"], ia_boxes["User"], "1..*", "right","left")
assoc(ia_boxes["User"], ia_boxes["TeamMembership"], "", "right","left")
assoc(ia_boxes["Team"], ia_boxes["TeamMembership"], "", "bot","top")

# ── Flow Definition associations ─────────────────────────────────────────
assoc(fd_boxes["CaseFlow"],        fd_boxes["CaseFlowVersion"],  "versions")
assoc(fd_boxes["CaseFlowVersion"], fd_boxes["CaseFlowNode"],     "nodes")
assoc(fd_boxes["CaseFlowVersion"], fd_boxes["CaseFlowEdge"],     "edges")
assoc(fd_boxes["CaseFlow"],        fd_boxes["CaseFlowSchedule"], "schedules")

# ── Case Runtime associations ────────────────────────────────────────────
for child in ["CaseTask","CaseApproval","CaseEscalation","CaseEvent","CaseDocument"]:
    assoc(rt_boxes["Case"], rt_boxes[child], "1..*")

# ── Enum usage ───────────────────────────────────────────────────────────
dep(rt_boxes["Case"],         en_boxes["CaseStatus"],    label="")
dep(rt_boxes["CaseTask"],     en_boxes["TaskStatus"],    label="")
dep(rt_boxes["CaseApproval"], en_boxes["ApprovalStatus"],label="")
dep(fd_boxes["CaseFlowNode"], en_boxes["NodeKind"],      label="")

# ── Cross-domain: FlowVersion instantiates Case ──────────────────────────
dep(fd_boxes["CaseFlowVersion"], rt_boxes["Case"], label="instantiates")

# ── Cross-domain: User/Team assigns Cases ────────────────────────────────
dep(ia_boxes["User"], rt_boxes["Case"], label="assignee")

# ═══════════════════════════════════════════════════════════════════════
# COLUMN HEADER LABELS (below package title)
# ═══════════════════════════════════════════════════════════════════════
col_labels = [
    (C1,  "Controllers"),
    (C2,  "Services"),
    (C3,  "Orchestration"),
    (C4A, "Identity\n& Access"),
    (C4B, "Flow\nDefinition"),
    (C5A, "Case\nRuntime"),
    (C5B, "Enums"),
]

# ── save ─────────────────────────────────────────────────────────────────
out = "/sessions/wizardly-nice-allen/mnt/HRFlow/bankflow_sd_assets/19_class_diagram.png"
plt.tight_layout(pad=0.1)
plt.savefig(out, dpi=150, bbox_inches="tight", facecolor="white")
print("Saved", out)
