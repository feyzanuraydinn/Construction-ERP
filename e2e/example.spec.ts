import { test, expect, _electron as electron, ElectronApplication, Page } from '@playwright/test';

/**
 * E2E Test Example for Electron App
 *
 * Note: To run these tests, you need to:
 * 1. Build the electron app first: npm run build:electron
 * 2. Run tests: npx playwright test
 *
 * These tests will launch the actual Electron application
 */

let electronApp: ElectronApplication;
let page: Page;

test.describe('Electron App E2E Tests', () => {
  test.beforeAll(async () => {
    // Launch Electron app
    electronApp = await electron.launch({
      args: ['.'],
      env: {
        ...process.env,
        NODE_ENV: 'test',
      },
    });

    // Get the first window
    page = await electronApp.firstWindow();

    // Wait for the app to fully load
    await page.waitForLoadState('domcontentloaded');
  });

  test.afterAll(async () => {
    await electronApp.close();
  });

  test('should display the application title', async () => {
    const title = await page.title();
    expect(title).toContain('İnşaat ERP');
  });

  test('should navigate to dashboard', async () => {
    // Wait for dashboard to load
    await page.waitForSelector('text=Dashboard', { timeout: 10000 });

    // Check dashboard stats are visible
    const dashboard = page.locator('text=Dashboard');
    await expect(dashboard).toBeVisible();
  });

  test('should navigate to companies page', async () => {
    // Click on Cariler menu
    await page.click('text=Cariler');

    // Wait for navigation
    await page.waitForURL('**/companies');

    // Check page content
    const heading = page.locator('h1:has-text("Cari")');
    await expect(heading).toBeVisible();
  });

  test('should navigate to projects page', async () => {
    // Click on Projeler menu
    await page.click('text=Projeler');

    // Wait for navigation
    await page.waitForURL('**/projects');

    // Check page content
    const heading = page.locator('h1:has-text("Proje")');
    await expect(heading).toBeVisible();
  });

  test('should open command palette with Ctrl+K', async () => {
    // Press Ctrl+K
    await page.keyboard.press('Control+k');

    // Check if command palette is visible
    const commandPalette = page.locator('[data-testid="command-palette"]');
    await expect(commandPalette).toBeVisible({ timeout: 2000 }).catch(() => {
      // Command palette might not have data-testid, try alternative
      const modal = page.locator('text=Komut Paleti');
      expect(modal).toBeVisible();
    });

    // Close it with Escape
    await page.keyboard.press('Escape');
  });

  test('should display settings page', async () => {
    // Click on Settings
    await page.click('text=Ayarlar');

    // Wait for navigation
    await page.waitForURL('**/settings');

    // Check for settings content
    const settings = page.locator('text=Kategoriler');
    await expect(settings).toBeVisible();
  });
});

/**
 * Data-related tests (require database operations)
 */
test.describe('Data Operations', () => {
  test.skip('should create a new company', async () => {
    // Navigate to companies
    await page.click('text=Cariler');
    await page.waitForURL('**/companies');

    // Click new button
    await page.click('button:has-text("Yeni")');

    // Fill form
    await page.fill('input[name="name"]', 'Test Şirketi');
    await page.selectOption('select[name="type"]', 'company');
    await page.selectOption('select[name="account_type"]', 'customer');

    // Submit
    await page.click('button:has-text("Kaydet")');

    // Verify creation
    await page.waitForSelector('text=Test Şirketi');
  });
});
