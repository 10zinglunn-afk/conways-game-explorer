import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  page.runtimeErrors = [];
  page.on('pageerror', (error) => page.runtimeErrors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') page.runtimeErrors.push(message.text()); });
  await page.goto('/');
});

test.afterEach(async ({ page }) => expect(page.runtimeErrors).toEqual([]));

test('account dialog traps focus, closes with Escape, and restores its trigger', async ({ page }, testInfo) => {
  await page.locator('#account-entry').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#account-dialog')).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.querySelector('#account-dialog').contains(document.activeElement))).toBe(true);
  for (let index = 0; index < 12; index += 1) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.querySelector('#account-dialog').contains(document.activeElement))).toBe(true);
  }
  await page.screenshot({ path: `/private/tmp/life-t7-account-${testInfo.project.name}.png` });
  await page.keyboard.press('Escape');
  await expect(page.locator('#account-dialog')).toBeHidden();
  await expect(page.locator('#account-entry')).toBeFocused();
});

test('clearing a large running board cancels stale Worker results', async ({ page }) => {
  test.setTimeout(60_000);
  await page.evaluate(async () => {
    const { writeRecovery } = await import('/src/local-database.js');
    const cells = new Uint8Array(1200 * 1200);
    for (let index = 0; index < cells.length; index += 2) cells[index] = 1;
    await writeRecovery('life-logic-dev-recovery-v1', {
      format: 'life-board-binary-v1', title: 'Cancellation board', width: 1200, height: 1200,
      cells, generation: 0,
      settings: { gridPreset: 'custom', width: 1200, height: 1200, wrapping: true, speed: 40 },
    });
  });
  await page.reload();
  await expect(page.locator('#population')).toHaveText('720,000');
  await page.locator('#play-toggle').click();
  await expect(page.locator('#play-toggle')).toContainText('Pause');
  await page.locator('#clear').click();
  await expect(page.locator('#population')).toHaveText('0');
  await page.waitForTimeout(750);
  await expect(page.locator('#population')).toHaveText('0');
  await expect(page.locator('#generation')).toHaveText('0');
  await expect(page.locator('#play-toggle')).toContainText('Play');
});
