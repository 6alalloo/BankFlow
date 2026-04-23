# Frontend UI Fixes — Implementation Plan

This plan addresses the requested UI fixes across the HRFlow frontend. No code is changed yet.

---

## 0. Auto-Populate Trigger Node on Workflow Creation

**Goal**: When creating a new workflow, auto-add a trigger node + ghost.

#### [MODIFY] DashboardPage.tsx

Lines: 149-156 (`handleCreateWorkflow`) and 163-207 (`handleUseTemplate`)

- Use `createWorkflowNode(newWorkflow.id, { kind: 'trigger', posX: 200, posY: 200 })` immediately after creating the workflow.

---

## 1. Home Page Cleanup

**Goal**: Remove "Command Center Online", role/ID display, and card underlines.

#### [MODIFY] DashboardPage.tsx

- **Lines 297-300**: Delete the "Command Center Online" `<div>`.
- **Lines 304-306**: Delete/simplify the role/ID line (e.g., `System Administrator // ID: #123`).
- **Lines 374 (Audit Logs card) and 534 (All Workflows link)**: If underlined, check for `<Link>` styling or add `className="no-underline"`.

---

## 2. Remove Webhook URL Display in Builder

**Goal**: Hide the webhook URL card in the top-right corner.

#### [MODIFY] workflowBuilderPage.tsx

- **Lines 1049-1078**: Delete or comment out the entire `{webhookUrl && (...)}` block.

---

## 3. Trigger Node: "Other" Department → Shows Text Field

**Goal**: Show a text input when "Other" is selected in the Department dropdown.

#### [MODIFY] ConfigPanel.tsx

- **Lines 702-717**: After the `<Select>` for department, add conditional logic:

```tsx
{
  getString(localConfig, "department") === "Other" && (
    <FormField label="Custom Department">
      <TextInput
        value={getString(localConfig, "customDepartment")}
        onChange={(val) => handleChange("customDepartment", val)}
        placeholder="Enter department name"
      />
    </FormField>
  );
}
```

---

## 4. Trigger Node: Date Picker Off-By-One Fix

**Goal**: Date picker is selecting the day _before_ the clicked date.

#### [MODIFY] ConfigPanel.tsx

- **Lines 727-742** (in the `DatePicker` `onChange`): The current logic uses `toISOString().split('T')[0]`, which converts to UTC and can shift the date. Change to:

```tsx
onChange={(date: Date | null) => {
    if (date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        handleChange('startDate', `${year}-${month}-${day}`);
    } else {
        handleChange('startDate', '');
    }
}}
```

---

## 5. Trigger Node: Remove Manager Email Field

#### [MODIFY] ConfigPanel.tsx

- **Lines 744-751**: Delete the `<FormField label="Manager Email">...</FormField>` block.

---

## 6. Template Selection: Reset Zoom to Show All Nodes

**Goal**: After applying a template, center the viewport.

#### [MODIFY] workflowBuilderPage.tsx

- **Line 706** (inside `handleApplyTemplate`): After `refreshRef.current(...)`, add:

```tsx
setTimeout(() => {
  fitView({ padding: 0.4, duration: 500 });
}, 150);
```

---

## 7. Email Node Fixes

**7a. Visual Display**: Change "trigger email" / "To: undef" to "Click to configure".

#### [MODIFY] expressionLabels.ts

- **Lines 86-91**: Update the `email` case in `getConfigPreview` to return `'Click to configure'` if `config.to` is empty, a variable like `{{trigger.email}}`, or undefined.

**7b. Config Panel**: Replace SmartField subject/body with simple TextInput/TextArea.

#### [MODIFY] ConfigPanel.tsx

- **Lines 822-837**: Change `<SmartField>` for subject/body to `<TextInput>` and `<TextArea>`.
- Add suggestions below the body field, similar to the logger node (lines 1360-1376).

**7c. Remove Manager Recipient Option**.

- **Lines 790-799**: Delete the "The Manager" `QuickActionButton`.

---

## 8. Logger Node: Remove `{{}}` from Placeholder

#### [MODIFY] ConfigPanel.tsx

- **Lines 1348-1355**: The placeholder for the logger message is on line 1353. Ensure it's simple, non-JSON text like: `"e.g. Employee onboarding started for new hire"`.

---

## 9. Execution Page: Simplify Output Data

**Goal**: Remove technical/raw fields, present user-friendly info.

#### [MODIFY] executionDetailPage.tsx

- **Lines 463-496** (Generic Output Card): Expand the `excludeKeys` list to hide technical fields like `raw_text`, `experience_years`, `source`, `filename`, `success`, etc.
- For remaining keys, format them more readably (e.g., `started_at` → "Started At: December 30, 2025").

---

## Verification Plan

### Manual Verification

1.  **Home Page**: Load the dashboard and verify no underlines on cards, no "Command Center Online", and no role/ID text.
2.  **Builder Page**: Create a blank workflow and verify a trigger node appears. Confirm the webhook URL card is gone.
3.  **Trigger Node Config**: Click department "Other" and verify a text field appears. Select a date and confirm the correct date is saved.
4.  **Template Selection**: Apply a template and confirm the view zooms to show all nodes.
5.  **Email Node**: Add an email node and verify its preview says "Click to configure". Open config and confirm simple text fields for subject/body with suggestions.
6.  **Logger Node**: Add a logger node, open config, and verify the placeholder is plain text.
7.  **Execution Page**: Run a workflow and view the execution detail. Confirm only user-friendly data is shown.
