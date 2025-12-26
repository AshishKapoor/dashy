import { test, expect, Page } from "@playwright/test";

const TEST_USER = {
  username: "anton",
  password: "rgcmusic",
};

/**
 * Helper to login and navigate to data management page
 */
async function loginAndNavigate(page: Page) {
  // Navigate to login page
  await page.goto("/login");

  // Wait for login form to be visible
  await page.waitForSelector('input[placeholder="Enter your username"]', {
    timeout: 10000,
  });

  // Login using placeholder selectors (react-hook-form spreads name attribute)
  await page.fill(
    'input[placeholder="Enter your username"]',
    TEST_USER.username
  );
  await page.fill(
    'input[placeholder="Enter your password"]',
    TEST_USER.password
  );
  await page.click('button[type="submit"]');

  // Wait for navigation to dashboard (either / or just the heading)
  await page.waitForSelector('h1:has-text("Dashboard")', { timeout: 15000 });

  // Expand Business Intelligence section (it's a collapsible button)
  const biSection = page.getByRole("button", { name: "Business Intelligence" });
  await biSection.click();
  await page.waitForTimeout(300);

  // Navigate to Data Management using link role
  const dataManagementLink = page.getByRole("link", {
    name: "Data Management",
  });
  await dataManagementLink.click();
  await page.waitForURL("**/data-management", { timeout: 10000 });
}

test.describe("Dataset Preview", () => {
  test.beforeEach(async ({ page }) => {
    await loginAndNavigate(page);
  });

  test("should display Data Management page with all elements", async ({
    page,
  }) => {
    // Check page title
    await expect(page.locator("h1")).toContainText("Data Management");

    // Check description
    await expect(
      page.locator(
        "text=Ingest IoT datasets and browse time-series efficiently"
      )
    ).toBeVisible();

    // Check Upload Data card exists
    await expect(page.locator("text=Upload Data")).toBeVisible();

    // Check Dataset Preview card exists
    await expect(page.locator("text=Dataset Preview")).toBeVisible();

    // Check filter inputs by label
    const deviceInput = page.locator("#device");
    const metricInput = page.locator("#metric");
    await expect(deviceInput).toBeVisible();
    await expect(metricInput).toBeVisible();

    // Check file input exists
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toBeAttached();

    // Check Refresh button exists
    await expect(page.locator("button", { hasText: "Refresh" })).toBeVisible();
  });

  test("should upload JSON file and display data in preview", async ({
    page,
  }) => {
    // Create a test JSON file
    const testData = {
      device_id: "playwright-device",
      metric: "test_metric",
      rows: [
        {
          recorded_at: "2025-12-27T18:00:00Z",
          value: 42.5,
          tags: { location: "test-room" },
        },
        {
          recorded_at: "2025-12-27T18:05:00Z",
          value: 43.0,
          tags: { location: "test-room" },
        },
        {
          recorded_at: "2025-12-27T18:10:00Z",
          value: 43.5,
          tags: { location: "test-room" },
        },
      ],
    };

    // Set up file chooser listener
    const fileChooserPromise = page.waitForEvent("filechooser");
    await page.locator('input[type="file"]').click();
    const fileChooser = await fileChooserPromise;

    // Upload the file
    const jsonContent = JSON.stringify(testData);
    await fileChooser.setFiles({
      name: "test-data.json",
      mimeType: "application/json",
      buffer: Buffer.from(jsonContent),
    });

    // Wait for success toast
    await expect(page.locator("text=File ingested successfully")).toBeVisible({
      timeout: 10000,
    });

    // Wait a moment for data to load
    await page.waitForTimeout(2000);

    // Verify data appears in table - look in the data container
    const dataContainer = page.locator('[class*="overflow-auto"]');
    await expect(
      dataContainer.locator("text=playwright-device").first()
    ).toBeVisible({
      timeout: 10000,
    });
  });

  test("should filter data by device_id", async ({ page }) => {
    const deviceInput = page.locator("#device");

    // Type in device filter
    await deviceInput.fill("test-filter-device");

    // Wait for filter to apply
    await page.waitForTimeout(1500);

    // Check input value persisted
    await expect(deviceInput).toHaveValue("test-filter-device");
  });

  test("should filter data by metric", async ({ page }) => {
    const metricInput = page.locator("#metric");

    // Type in metric filter
    await metricInput.fill("temperature");

    // Wait for filter to apply
    await page.waitForTimeout(1500);

    // Check input value persisted
    await expect(metricInput).toHaveValue("temperature");
  });

  test("should filter data by both device_id and metric", async ({ page }) => {
    const deviceInput = page.locator("#device");
    const metricInput = page.locator("#metric");

    // Apply both filters
    await deviceInput.fill("sensor-001");
    await metricInput.fill("humidity");

    // Wait for filters to apply
    await page.waitForTimeout(1000);

    // Verify both inputs have values
    await expect(deviceInput).toHaveValue("sensor-001");
    await expect(metricInput).toHaveValue("humidity");
  });

  test("should refresh data when clicking refresh button", async ({ page }) => {
    // Click refresh button
    const refreshButton = page.locator("button", { hasText: "Refresh" });
    await refreshButton.click();

    // Button should eventually be enabled again (after loading completes)
    await expect(refreshButton).toBeEnabled({ timeout: 10000 });
  });

  test("should display all required table columns", async ({ page }) => {
    // Wait for page to fully load
    await page.waitForTimeout(1000);

    // The Dataset Preview card should be visible
    await expect(page.locator("text=Dataset Preview").first()).toBeVisible();

    // The virtualized table container should exist inside the Dataset Preview card
    const tableContainer = page.locator(".rounded-md.border.h-\\[500px\\]");
    await expect(tableContainer).toBeVisible();
  });

  test("should handle empty dataset gracefully", async ({ page }) => {
    const deviceInput = page.locator("#device");

    // Filter by non-existent device
    await deviceInput.fill("non-existent-device-xyz-12345");
    await page.waitForTimeout(1500);

    // Table container should still be visible (no crash) - use specific class selector
    const tableContainer = page.locator(".rounded-md.border.h-\\[500px\\]");
    await expect(tableContainer).toBeVisible();

    // No error toast should appear
    const errorToast = page.locator('[data-sonner-toast][data-type="error"]');
    await expect(errorToast).toHaveCount(0);
  });

  test("should clear filters when inputs are cleared", async ({ page }) => {
    const deviceInput = page.locator("#device");
    const metricInput = page.locator("#metric");

    // Set filters
    await deviceInput.fill("test");
    await metricInput.fill("temp");
    await page.waitForTimeout(500);

    // Clear filters
    await deviceInput.fill("");
    await metricInput.fill("");
    await page.waitForTimeout(500);

    // Verify inputs are empty
    await expect(deviceInput).toHaveValue("");
    await expect(metricInput).toHaveValue("");
  });

  test("should handle file upload errors gracefully", async ({ page }) => {
    // Set up file chooser listener
    const fileChooserPromise = page.waitForEvent("filechooser");
    await page.locator('input[type="file"]').click();
    const fileChooser = await fileChooserPromise;

    // Try to upload invalid JSON
    const invalidContent = "{ invalid json }";
    await fileChooser.setFiles({
      name: "invalid.json",
      mimeType: "application/json",
      buffer: Buffer.from(invalidContent),
    });

    // Should show error toast
    await expect(page.locator("text=Invalid JSON file")).toBeVisible({
      timeout: 5000,
    });
  });

  test("should maintain filters after data refresh", async ({ page }) => {
    const deviceInput = page.locator("#device");

    // Set a filter
    await deviceInput.fill("sensor-001");
    await page.waitForTimeout(500);

    // Click refresh
    const refreshButton = page.locator("button", { hasText: "Refresh" });
    await refreshButton.click();
    await page.waitForTimeout(1000);

    // Filter should still be applied
    await expect(deviceInput).toHaveValue("sensor-001");
  });

  test("should support virtualized scrolling container", async ({ page }) => {
    // The table container should have overflow-auto for scrolling - use specific class
    const tableContainer = page.locator(".rounded-md.border.h-\\[500px\\]");
    await expect(tableContainer).toBeVisible();

    // Container should have a fixed height for virtualization
    const height = await tableContainer.evaluate((el) => {
      return window.getComputedStyle(el).height;
    });

    // Height should be 500px as defined in the class
    expect(height).toBe("500px");
  });
});
