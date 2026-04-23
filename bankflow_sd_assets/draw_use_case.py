"""
BankFlow — Use Case Diagram
Draws actors on strict left/right sides with use-case packages in the centre.
"""
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch
import matplotlib.patheffects as pe
import numpy as np

# ── canvas ──────────────────────────────────────────────────────────────────
FIG_W, FIG_H = 22, 17
fig, ax = plt.subplots(figsize=(FIG_W, FIG_H))
ax.set_xlim(0, FIG_W)
ax.set_ylim(0, FIG_H)
ax.axis("off")
fig.patch.set_facecolor("white")

# ── colour palette ───────────────────────────────────────────────────────────
C_PKG_BG   = "#FAFAFA"
C_PKG_ED   = "#718096"
C_UC_BG    = "#EBF8FF"
C_UC_ED    = "#2B6CB0"
C_ACTOR_BG = "#EDF2F7"
C_ACTOR_ED = "#2B6CB0"
C_ARROW    = "#4A5568"
C_DASH     = "#718096"
C_TITLE    = "#2B6CB0"
C_PKG_TXT  = "#2D3748"

# ── helpers ───────────────────────────────────────────────────────────────────
def ellipse(ax, cx, cy, rx, ry, label, fs=9):
    e = mpatches.Ellipse((cx, cy), 2*rx, 2*ry,
                         facecolor=C_UC_BG, edgecolor=C_UC_ED, linewidth=1.2, zorder=3)
    ax.add_patch(e)
    ax.text(cx, cy, label, ha="center", va="center",
            fontsize=fs, fontname="Arial", zorder=4,
            multialignment="center")
    return (cx, cy)


def actor(ax, cx, cy, label):
    """Stick-figure actor."""
    head_r = 0.22
    # head
    head = plt.Circle((cx, cy + 0.55), head_r, color=C_ACTOR_ED, fill=False, linewidth=1.5, zorder=3)
    ax.add_patch(head)
    # body
    ax.plot([cx, cx], [cy + 0.33, cy - 0.12], color=C_ACTOR_ED, lw=1.5, zorder=3)
    # arms
    ax.plot([cx - 0.28, cx + 0.28], [cy + 0.12, cy + 0.12], color=C_ACTOR_ED, lw=1.5, zorder=3)
    # legs
    ax.plot([cx, cx - 0.25], [cy - 0.12, cy - 0.55], color=C_ACTOR_ED, lw=1.5, zorder=3)
    ax.plot([cx, cx + 0.25], [cy - 0.12, cy - 0.55], color=C_ACTOR_ED, lw=1.5, zorder=3)
    # label
    ax.text(cx, cy - 0.75, label, ha="center", va="top",
            fontsize=9.5, fontname="Arial", fontweight="bold",
            color="#1A202C", zorder=4, multialignment="center")
    return (cx, cy)  # connection point = centre of head area


def pkg_box(ax, x, y, w, h, title):
    r = FancyBboxPatch((x, y), w, h,
                       boxstyle="round,pad=0.05",
                       facecolor=C_PKG_BG, edgecolor=C_PKG_ED,
                       linewidth=1.6, zorder=1)
    ax.add_patch(r)
    ax.text(x + w/2, y + h - 0.18, title, ha="center", va="top",
            fontsize=12, fontname="Arial", fontweight="bold",
            color=C_PKG_TXT, zorder=2)


def line(ax, x0, y0, x1, y1, style="-", color=C_ARROW, lw=1.0, label=None):
    ls = "--" if style == "dash" else "-"
    ax.annotate("", xy=(x1, y1), xytext=(x0, y0),
                arrowprops=dict(arrowstyle="-", color=color,
                                lw=lw, linestyle=ls),
                zorder=2)
    if label:
        mx, my = (x0+x1)/2, (y0+y1)/2
        ax.text(mx + 0.05, my, label, fontsize=7.5, color=C_DASH,
                fontname="Arial", fontstyle="italic", va="center", zorder=5)


def arrow_dash(ax, x0, y0, x1, y1, label=""):
    ax.annotate("", xy=(x1, y1), xytext=(x0, y0),
                arrowprops=dict(arrowstyle="->", color=C_DASH,
                                lw=1.0, linestyle="dashed"),
                zorder=2)
    if label:
        mx, my = (x0+x1)/2, (y0+y1)/2
        ax.text(mx+0.05, my+0.05, label, fontsize=7.5, color=C_DASH,
                fontname="Arial", fontstyle="italic", zorder=5)


# ── title ────────────────────────────────────────────────────────────────────
ax.text(FIG_W/2, FIG_H - 0.35, "BankFlow — Use Case Diagram",
        ha="center", va="top", fontsize=16, fontname="Arial",
        fontweight="bold", color=C_TITLE, zorder=5)

# ═══════════════════════════════════════════════════════════════════════════
# LAYOUT CONSTANTS
# ═══════════════════════════════════════════════════════════════════════════
ACT_L_X  = 1.1          # left actor centre x
ACT_R_X  = FIG_W - 1.1  # right actor centre x

PKG_OP_X = 3.3          # Operational package left edge
PKG_OP_W = 7.2
PKG_PL_X = 11.3         # Platform package left edge
PKG_PL_W = 7.4
PKG_Y    = 0.8          # package bottom y
PKG_H    = FIG_H - 1.8  # package height

UC_RX = 1.08            # ellipse x-radius
UC_RY = 0.37            # ellipse y-radius

# Operational UCs — x centre inside that package
OP_CX = PKG_OP_X + PKG_OP_W / 2
# Platform UCs — x centre inside that package
PL_CX = PKG_PL_X + PKG_PL_W / 2

# ── package boxes ─────────────────────────────────────────────────────────
pkg_box(ax, PKG_OP_X, PKG_Y, PKG_OP_W, PKG_H, "Operational")
pkg_box(ax, PKG_PL_X, PKG_Y, PKG_PL_W, PKG_H, "Platform")

# ═══════════════════════════════════════════════════════════════════════════
# OPERATIONAL USE CASES   (12 items)
# ═══════════════════════════════════════════════════════════════════════════
op_labels = [
    "Submit Manual\nCase Intake",
    "Browse &\nFilter Cases",
    "View Case Detail\n& Timeline",
    "Claim &\nComplete Task",
    "Upload\nDocument",
    "Manually\nEscalate Case",
    "Review Approval\nRequest",
    "Approve\nDecision",
    "Reject\nDecision",
    "Monitor Supervisor\nDashboard",
    "Monitor SLA &\nOverdue Work",
    "View Escalated\nCases",
]
n_op = len(op_labels)
op_top    = PKG_Y + PKG_H - 0.65
op_bottom = PKG_Y + 0.55
op_ys = np.linspace(op_top, op_bottom, n_op)
uc_op = {}
for i, lbl in enumerate(op_labels):
    key = f"UC{i+1:02d}"
    uc_op[key] = ellipse(ax, OP_CX, op_ys[i], UC_RX, UC_RY, lbl)

# ═══════════════════════════════════════════════════════════════════════════
# PLATFORM USE CASES   (11 items)
# ═══════════════════════════════════════════════════════════════════════════
pl_labels = [
    "Create &\nEdit Flow",
    "Publish Flow\nVersion",
    "Manage Flow\nSchedules",
    "Apply Flow\nTemplate",
    "Manage Users\n& Roles",
    "Manage Teams\n& Queues",
    "View\nAudit Logs",
    "Configure Platform\nSettings",
    "Run KYC\nRefresh Cycle",
    "Run Dormant\nAccount Scan",
    "Generate Regulatory\nReport",
]
n_pl = len(pl_labels)
pl_top    = PKG_Y + PKG_H - 0.65
pl_bottom = PKG_Y + 0.55
# centre vertically among 11 items in same height as 12
pl_ys = np.linspace(pl_top, pl_bottom + (op_ys[-1] - pl_bottom) * 0, n_pl)
pl_ys = np.linspace(op_ys[0], op_ys[-1], n_pl)
uc_pl = {}
for i, lbl in enumerate(pl_labels):
    key = f"UC{i+13:02d}"
    uc_pl[key] = ellipse(ax, PL_CX, pl_ys[i], UC_RX, UC_RY, lbl)

# ═══════════════════════════════════════════════════════════════════════════
# ACTORS
# ═══════════════════════════════════════════════════════════════════════════
# Left actors — spaced evenly over vertical range that matches UCs
left_actor_ys  = [op_ys[1], op_ys[5], op_ys[9]]   # Operator, Approver, Supervisor
right_actor_ys = [pl_ys[1], pl_ys[4], pl_ys[7], pl_ys[10]]  # Designer, Admin, Auditor, Scheduler

actor(ax, ACT_L_X, left_actor_ys[0], "Operator")
actor(ax, ACT_L_X, left_actor_ys[1], "Approver")
actor(ax, ACT_L_X, left_actor_ys[2], "Supervisor")

actor(ax, ACT_R_X, right_actor_ys[0], "Designer")
actor(ax, ACT_R_X, right_actor_ys[1], "Admin")
actor(ax, ACT_R_X, right_actor_ys[2], "Auditor")
actor(ax, ACT_R_X, right_actor_ys[3], "Intake\nScheduler\n(System)")

# ═══════════════════════════════════════════════════════════════════════════
# CONNECTION HELPERS
# ═══════════════════════════════════════════════════════════════════════════
def connect_left(actor_y, uc_key):
    """Left actor → Operational UC."""
    ax_pt = (ACT_L_X + 0.3, actor_y)
    uc    = uc_op[uc_key]
    uc_pt = (uc[0] - UC_RX, uc[1])
    line(ax, ax_pt[0], ax_pt[1], uc_pt[0], uc_pt[1], lw=1.0)

def connect_right_pl(actor_y, uc_key):
    """Right actor → Platform UC."""
    ax_pt = (ACT_R_X - 0.3, actor_y)
    uc    = uc_pl[uc_key]
    uc_pt = (uc[0] + UC_RX, uc[1])
    line(ax, ax_pt[0], ax_pt[1], uc_pt[0], uc_pt[1], lw=1.0)

def connect_right_op(actor_y, uc_key):
    """Right actor → Operational UC (Auditor reads cases)."""
    ax_pt = (ACT_R_X - 0.3, actor_y)
    uc    = uc_op[uc_key]
    uc_pt = (uc[0] + UC_RX, uc[1])
    line(ax, ax_pt[0], ax_pt[1], uc_pt[0], uc_pt[1], lw=0.85, color="#90CDF4")

# ═══════════════════════════════════════════════════════════════════════════
# OPERATOR connections
# ═══════════════════════════════════════════════════════════════════════════
op_y = left_actor_ys[0]
for k in ["UC01","UC02","UC03","UC04","UC05","UC06"]:
    connect_left(op_y, k)

# APPROVER connections
ap_y = left_actor_ys[1]
for k in ["UC02","UC07","UC08","UC09"]:
    connect_left(ap_y, k)

# SUPERVISOR connections
su_y = left_actor_ys[2]
for k in ["UC08","UC09","UC10","UC11","UC12"]:
    connect_left(su_y, k)

# ═══════════════════════════════════════════════════════════════════════════
# DESIGNER connections
# ═══════════════════════════════════════════════════════════════════════════
de_y = right_actor_ys[0]
for k in ["UC13","UC14","UC15","UC16"]:
    connect_right_pl(de_y, k)

# ADMIN connections
ad_y = right_actor_ys[1]
for k in ["UC17","UC18","UC19","UC20"]:
    connect_right_pl(ad_y, k)

# AUDITOR connections (right actor → right package + light lines to op)
au_y = right_actor_ys[2]
connect_right_pl(au_y, "UC19")          # View Audit Logs (right pkg)
connect_right_op(au_y, "UC02")          # Browse Cases   (op pkg, faint)
connect_right_op(au_y, "UC03")          # View Case Detail (op pkg, faint)

# INTAKE SCHEDULER connections
sc_y = right_actor_ys[3]
for k in ["UC21","UC22","UC23"]:
    connect_right_pl(sc_y, k)

# ═══════════════════════════════════════════════════════════════════════════
# INCLUDE / EXTEND arrows  (within Operational package)
# ═══════════════════════════════════════════════════════════════════════════
def include_arrow(from_key, to_key, lbl, pkg="op"):
    src_dict = uc_op if pkg == "op" else uc_pl
    f = src_dict[from_key]
    t = src_dict[to_key]
    # offset slightly to avoid overlap
    fx = f[0] + UC_RX * 0.5
    tx = t[0] + UC_RX * 0.5
    arrow_dash(ax, fx, f[1], tx, t[1], lbl)

include_arrow("UC08", "UC07", "«include»")
include_arrow("UC09", "UC07", "«include»")
include_arrow("UC14", "UC13", "«include»", pkg="pl")
include_arrow("UC04", "UC03", "«extend»")
include_arrow("UC05", "UC03", "«extend»")

# ═══════════════════════════════════════════════════════════════════════════
# LEGEND for Auditor faint lines
# ═══════════════════════════════════════════════════════════════════════════
ax.plot([PKG_PL_X + PKG_PL_W + 0.1, PKG_PL_X + PKG_PL_W + 0.6],
        [PKG_Y + 1.2, PKG_Y + 1.2], color="#90CDF4", lw=1.5)
ax.text(PKG_PL_X + PKG_PL_W + 0.65, PKG_Y + 1.2,
        "Read-only\naccess", fontsize=7.5, va="center",
        fontname="Arial", color="#4A5568")

# ── save ─────────────────────────────────────────────────────────────────────
out = "/sessions/wizardly-nice-allen/mnt/HRFlow/bankflow_sd_assets/18_use_case_v2.png"
plt.tight_layout(pad=0.2)
plt.savefig(out, dpi=150, bbox_inches="tight", facecolor="white")
print("Saved", out)
