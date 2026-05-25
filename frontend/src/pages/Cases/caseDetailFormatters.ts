import type { BadgeVariant } from "../../components/ui/Badge";

export const formatDate = (value?: string | null) => {
  if (!value) return "Not set";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Invalid date";
  return parsed.toLocaleString();
};

export function formatLabel(raw: string): string {
  if (!raw) return "";
  const spaced = raw.replace(/[_\-.]+/g, " ");
  const camelSpaced = spaced.replace(/([a-z])([A-Z])/g, "$1 $2");
  return camelSpaced
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export const formatJson = (value: unknown) => {
  if (value === null || value === undefined) return "{}";
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
};

export const statusBadgeVariant = (status: string): BadgeVariant => {
  if (["resolved", "closed", "completed", "approved"].includes(status)) return "success";
  if (["critical", "rejected", "cancelled", "overdue", "escalated"].includes(status)) return "danger";
  if (["pending_action", "pending_approval", "requested", "claimed", "assigned"].includes(status)) return "future";
  return "secondary";
};
