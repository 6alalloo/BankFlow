import type React from "react";
import {
  LuBriefcase,
  LuBuilding,
  LuCalendar,
  LuFileText,
  LuHash,
  LuMail,
  LuPhone,
  LuUser,
} from "react-icons/lu";

export interface TriggerVariable {
  label: string;
  value: string;
  icon: React.ReactNode;
  group: "case" | "routing" | "meta";
}

export const TRIGGER_VARIABLES: TriggerVariable[] = [
  { label: "Case Name", value: "{{trigger.name}}", icon: <LuUser className="size-3" />, group: "case" },
  { label: "Contact Email", value: "{{trigger.email}}", icon: <LuMail className="size-3" />, group: "case" },
  { label: "Phone Number", value: "{{trigger.phone}}", icon: <LuPhone className="size-3" />, group: "case" },
  { label: "Document URL", value: "{{trigger.resume_url}}", icon: <LuFileText className="size-3" />, group: "case" },
  { label: "Queue", value: "{{trigger.department}}", icon: <LuBuilding className="size-3" />, group: "routing" },
  { label: "Custom Queue", value: "{{trigger.customDepartment}}", icon: <LuBuilding className="size-3" />, group: "routing" },
  { label: "Case Type", value: "{{trigger.role}}", icon: <LuBriefcase className="size-3" />, group: "routing" },
  { label: "Requested Date", value: "{{trigger.startDate}}", icon: <LuCalendar className="size-3" />, group: "routing" },
  { label: "Reference ID", value: "{{trigger.formId}}", icon: <LuHash className="size-3" />, group: "meta" },
];
