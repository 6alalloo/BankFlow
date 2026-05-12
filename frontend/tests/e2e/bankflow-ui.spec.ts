import { expect, test } from "@playwright/test";

const apiBaseUrl = process.env.BANKFLOW_API_URL ?? "http://localhost:3000/api";

test("operator can create and open a BankFlow case from the UI", async ({ page, request }) => {
  const loginResponse = await request.post(`${apiBaseUrl}/auth/login`, {
    data: { email: "admin@bankflow.local", password: "admin123" },
  });
  expect(loginResponse.ok()).toBeTruthy();
  const login = await loginResponse.json();

  const flowsResponse = await request.get(`${apiBaseUrl}/flows`, {
    headers: { Authorization: `Bearer ${login.token}` },
  });
  expect(flowsResponse.ok()).toBeTruthy();
  const flows = await flowsResponse.json();
  const publishedFlow = flows.data.find(
    (flow: { status: string; current_published_version_id: number | null }) =>
      flow.status === "published" && flow.current_published_version_id
  );
  expect(publishedFlow).toBeTruthy();

  await page.goto("/login");
  await page.getByLabel("Email Address").fill("admin@bankflow.local");
  await page.getByLabel("Password").fill("admin123");
  await page.getByRole("button", { name: "Sign In" }).click();

  await expect(page).toHaveURL(/\/$/);
  await page.goto("/cases");
  await expect(page.getByRole("heading", { name: "Cases" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Overdue Work" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pending Approvals" })).toBeVisible();

  await page.getByRole("button", { name: "New Case" }).click();
  await expect(page.getByRole("heading", { name: "New Case" })).toBeVisible();
  await page.locator("select").first().selectOption(String(publishedFlow.id));
  await page.getByPlaceholder("Optional case title").fill(`Playwright Case ${Date.now()}`);
  await page.getByRole("button", { name: "Create Case" }).click();

  await expect(page).toHaveURL(/\/cases\/\d+$/);
  await expect(page.getByRole("heading", { name: "Tasks" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Timeline" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Documents" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Case Controls" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add Note" })).toBeVisible();
});
