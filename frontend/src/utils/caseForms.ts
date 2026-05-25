export type CaseFormField = {
  key: string;
  label: string;
  placeholder?: string;
  type?: "text" | "number";
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

export const caseFieldsByType: Record<string, CaseFormField[]> = {
  aml_alert: [
    { key: "customer", label: "Customer", placeholder: "Customer or account name" },
    { key: "risk.score", label: "Risk Score", placeholder: "92", type: "number" },
    { key: "alertType", label: "Alert Type", placeholder: "Unusual transaction pattern" },
  ],
  payment_exception: [
    { key: "paymentId", label: "Payment ID", placeholder: "PAY-1001" },
    { key: "amount", label: "Amount", placeholder: "12850", type: "number" },
    { key: "currency", label: "Currency", placeholder: "BHD" },
  ],
  high_value_payment: [
    { key: "paymentId", label: "Payment ID", placeholder: "HV-2201" },
    { key: "beneficiary", label: "Beneficiary", placeholder: "Alba Industrial Services" },
    { key: "amountBhd", label: "Amount BHD", placeholder: "250000", type: "number" },
    { key: "currency", label: "Currency", placeholder: "BHD" },
  ],
  general_case: [
    { key: "summary", label: "Summary", placeholder: "Short case summary" },
    { key: "source", label: "Source", placeholder: "Manual intake" },
  ],
};

export const taskOutputFieldsByType: Record<string, CaseFormField[]> = {
  review: [
    { key: "finding", label: "Finding", placeholder: "clear" },
    { key: "notes", label: "Review Notes", placeholder: "Disposition basis" },
  ],
  data_capture: [
    { key: "capturedValue", label: "Captured Value", placeholder: "Updated case value" },
    { key: "notes", label: "Notes", placeholder: "Data capture notes" },
  ],
  document_collection: [
    { key: "documents", label: "Document Status", placeholder: "received" },
    { key: "notes", label: "Notes", placeholder: "Evidence notes" },
  ],
  approval_support: [
    { key: "packageStatus", label: "Package Status", placeholder: "ready" },
    { key: "notes", label: "Notes", placeholder: "Approval package notes" },
  ],
  decision_followup: [
    { key: "followup", label: "Follow-up", placeholder: "Action completed" },
    { key: "notes", label: "Notes", placeholder: "Decision follow-up notes" },
  ],
  escalation_followup: [
    { key: "resolution", label: "Resolution", placeholder: "Escalation resolved" },
    { key: "notes", label: "Notes", placeholder: "Escalation notes" },
  ],
};

export const getCaseFields = (caseType?: string | null) =>
  caseFieldsByType[caseType || ""] ?? caseFieldsByType.general_case;

export const getTaskOutputFields = (taskType?: string | null) =>
  taskOutputFieldsByType[taskType || ""] ?? taskOutputFieldsByType.review;

const coerceValue = (value: string, field: CaseFormField): unknown => {
  if (field.type !== "number") return value.trim();
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : value.trim();
};

export function setNestedValue(target: Record<string, unknown>, path: string, value: unknown) {
  const parts = path.split(".");
  let current = target;
  parts.forEach((part, index) => {
    if (index === parts.length - 1) {
      current[part] = value;
      return;
    }
    if (!current[part] || typeof current[part] !== "object" || Array.isArray(current[part])) {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  });
}

export function buildObjectFromFields(fields: CaseFormField[], values: Record<string, string>) {
  const output: Record<string, unknown> = {};
  fields.forEach((field) => {
    const value = values[field.key];
    if (value === undefined || value.trim() === "") return;
    setNestedValue(output, field.key, coerceValue(value, field));
  });
  return output;
}

export function formatDocumentType(documentType: string) {
  return documentType
    .replace(/[_\-.]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export function getRequiredDocumentTypes(taskInput: unknown): string[] {
  const input = asRecord(taskInput);
  const nodeConfig = asRecord(input.nodeConfig);
  const required = nodeConfig.requiredDocuments ?? nodeConfig.required_documents;
  if (!Array.isArray(required)) return [];
  return required.filter((documentType): documentType is string => typeof documentType === "string" && documentType.trim().length > 0);
}
