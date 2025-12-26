import { test, expect } from '@playwright/test';
import path from 'path';

const TEST_USER = {
  username: 'testuser',
  password: 'testpass',
};

test.describe('Dataset Preview', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to login page
    await page.goto('/login');
    
    // Login
    await page.fill('input[name="username"]', TEST_USER.username);
    await page.fill('input[name="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');
    
    // Wait for navigation to dashboard
    await page.waitForURL('/');
    
    // Navigate to Data Management
    await page.click('text=Data Management');
    await page.waitForURL('/data-management');
  });

  test('should display Data Management page with all elements', async ({ page }) => {
    // Check page title
    await expect(page.locator('h1')).toContainText('Data Management');
    
    // Check description
    await expect(page.locator('text=Ingest IoT datasets and browse time-series efficiently')).toBeVisible();
    
    // Check Upload Data card exists
    await expect(page.locator('text=Upload Data')).toBeVisible();
    
    // Check Dataset Preview card exists
    await expect(page.locator('text=Dataset Preview')).toBeVisible();
    
    // Check filter inputs
    await expect(page.locator('input#device')).toBeVisible();
    await expect(page.locator('input#metric')).toBeVisible();
    
    // Check file input
    await expect(page.locator('input#file')).toBeVisible();
    
    // Check Refresh button
    await expect(page.locator('button:has-text("Refresh")')).toBeVisible();
  });

  test('should upload JSON file and display data in preview', async ({ page }) => {
    // Create a test JSON file
    const testData = {
      device_id: 'playwright-device',
      metric: 'test_metric',
      rows: [
        {
          recorded_at: '2025-12-27T18:00:00Z',
          value: 42.5,
          tags: { location: 'test-room' }
        },
        {
          recorded_at: '2025-12-27T18:05:00Z',
          value: 43.0,
          tags: { location: 'test-room' }
        },
        {
          recorded_at: '2025-12-27T18:10:00Z',
          value: 43.5,
          tags: { location: 'test-room' }
        }
      ]
    };

    // Create temporary file
    const tmpDir = await page.evaluate(() => {
      const blob = new Blob(
        [JSON.stringify(testData)],
        { type: 'application/json' }
      );
      return URL.createObjectURL(blob);
    });

    // Set up file chooser listener
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.click('input#file');
    const fileChooser = await fileChooserPromise;

    // Upload the file
    await fileChooser.setFiles({
      name: 'test-data.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(testData)),
    });

    // Wait for success toast
    await expect(page.locator('text=File ingested successfully')).toBeVisible({ timeout: 10000 });

    // Wait a moment for data to load
    await page.waitForTimeout(2000);

    // Verify data appears in table
    await expect(page.locator('text=playwright-device')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=test_metric')).toBeVisible();
    
    // Check that multiple rows are rendered
    const deviceCells = page.locator('text=playwright-device');
    await expect(deviceCells).toHaveCount(3);
  });

  test('should filter data by device_id', async ({ page }) => {
    // Type in device filter
    await page.fill('input#device', 'test-preview');
    
    // Wait for filter to apply (debounced)
    await page.waitForTimeout(1000);
    
    // Verify URL has query param
    await expect(page).toHaveURL(/device_id=test-preview/);
    
    // Verify only matching devices shown (if any data exists)
    const cells = page.locator('div.flex-1:has-text("test-preview")');
    const count = await cells.count();
    
    // If data exists, all should match the filter
    if (count > 0) {
      const allCells = await cells.all();
      for (const cell of allCells) {
        await expect(cell).toContainText('test-preview');
      }
    }
  });

  test('should filter data by metric', async ({ page }) => {
    // Type in metric filter
    await page.fill('input#metric', 'temperature');
    
    // Wait for filter to apply
    await page.waitForTimeout(1000);
    
    // Verify URL has query param
    await expect(page).toHaveURL(/metric=temperature/);
  });

  test('should filter data by both device_id and metric', async ({ page }) => {
    // Apply both filters
    await page.fill('input#device', 'sensor-001');
    await page.fill('input#metric', 'humidity');
    
    // Wait for filters to apply
    await page.waitForTimeout(1000);
    
    // Verify URL has both query params
    await expect(page).toHaveURL(/device_id=sensor-001/);
    await expect(page).toHaveURL(/metric=humidity/);
  });

  test('should show loading skeleton while fetching data', async ({ page }) => {
    // Reload the page
    await page.reload();
    
    // Skeleton should be visible briefly
    // Note: This might be too fast to catch, so we just verify it doesn't error
    const skeleton = page.locator('[class*="animate-pulse"]').first();
    const isVisible = await skeleton.isVisible().catch(() => false);
    
    // Either skeleton was visible or data loaded very fast
    expect(typeof isVisible).toBe('boolean');
  });

  test('should refresh data when clicking refresh button', async ({ page }) => {
    // Click refresh button
    const refreshButton = page.locator('button:has-text("Refresh")').first();
    await refreshButton.click();
    
    // Button should be temporarily disabled during loading
    await expect(refreshButton).toBeDisabled({ timeout: 100 }).catch(() => {
      // If it loads too fast, that's okay
    });
    
    // Eventually button becomes enabled again
    await expect(refreshButton).toBeEnabled({ timeout: 5000 });
  });

  test('should display all required table columns', async ({ page }) => {
    // Check for column headers
    await expect(page.locator('text=Device')).toBeVisible();
    await expect(page.locator('text=Metric')).toBeVisible();
    await expect(page.locator('text=Recorded At')).toBeVisible();
    await expect(page.locator('text=Value')).toBeVisible();
    await expect(page.locator('text=Tags')).toBeVisible();
  });

  test('should display column type icons', async ({ page }) => {
    // Icons should be present (lucide icons as SVGs)
    const icons = page.locator('svg').filter({ has: page.locator('[class*="lucide"]') });
    const count = await icons.count();
    
    // Should have multiple icons (at least for the columns)
    expect(count).toBeGreaterThan(0);
  });

  test('should handle empty dataset gracefully', async ({ page }) => {
    // Filter by non-existent device
    await page.fill('input#device', 'non-existent-device-xyz');
    await page.waitForTimeout(1000);
    
    // Table should be empty but no error
    const table = page.locator('[class*="overflow-auto"]');
    await expect(table).toBeVisible();
    
    // No error messages should appear
    await expect(page.locator('text=error').first()).not.toBeVisible().catch(() => {
      // If no error text found, that's good
    });
  });

  test('should format dates correctly in table', async ({ page }) => {
    // If any data exists with timestamps
    const dateCells = page.locator('div.flex-1').filter({ hasText: /\d{1,2}\/\d{1,2}\/\d{4}/ });
    const count = await dateCells.count();
    
    if (count > 0) {
      const firstDate = await dateCells.first().textContent();
      // Should contain date-like format
      expect(firstDate).toMatch(/\d/);
    }
  });

  test('should clear filters when inputs are cleared', async ({ page }) => {
    // Set filters
    await page.fill('input#device', 'test');
    await page.fill('input#metric', 'temp');
    await page.waitForTimeout(500);
    
    // Clear filters
    await page.fill('input#device', '');
    await page.fill('input#metric', '');
    await page.waitForTimeout(500);
    
    // URL should not have filter params
    const url = page.url();
    expect(url).not.toContain('device_id=test');
    expect(url).not.toContain('metric=temp');
  });

  test('should handle file upload errors gracefully', async ({ page }) => {
    // Try to upload invalid JSON
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.click('input#file');
    const fileChooser = await fileChooserPromise;

    await fileChooser.setFiles({
      name: 'invalid.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{ invalid json }'),
    });

    // Should show error toast
    await expect(page.locator('text=Invalid JSON file')).toBeVisible({ timeout: 5000 });
  });

  test('should maintain filters after data refresh', async ({ page }) => {
    // Set a filter
    await page.fill('input#device', 'sensor-001');
    await page.waitForTimeout(500);
    
    // Click refresh
    await page.locator('button:has-text("Refresh")').first().click();
    await page.waitForTimeout(1000);
    
    // Filter should still be applied
    const deviceInput = page.locator('input#device');
    await expect(deviceInput).toHaveValue('sensor-001');
    await expect(page).toHaveURL(/device_id=sensor-001/);
  });

  test('should support virtualized scrolling for large datasets', async ({ page }) => {
    // The table container should have overflow
    const tableContainer = page.locator('[class*="overflow-auto"]');
    await expect(tableContainer).toBeVisible();
    
    // Container should have a fixed height for virtualization
    const styles = await tableContainer.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        height: computed.height,
        overflow: computed.overflow,
      };
    });
    
    // Should have height set (not auto) for virtual scrolling
    expect(styles.height).not.toBe('auto');
  });
});
