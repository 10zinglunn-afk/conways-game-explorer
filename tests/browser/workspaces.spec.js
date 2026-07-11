import { expect, test } from '@playwright/test';

async function enterPlayground(page) {
  await page.goto('/');
  await expect(page).toHaveTitle(/Conway/i);
  await expect(page.locator('#intro-start')).toBeEnabled();
  await page.locator('#intro-start').click();
  await expect(page.locator('#intro-layer')).toBeHidden({ timeout: 3_000 });
  await expect(page.locator('#playground-tutorial')).toBeVisible();
  await page.locator('#playground-tutorial-skip').click();
  await expect(page.locator('#playground-tutorial')).toBeHidden();
}

async function clickBoard(page, xRatio = 0.5, yRatio = 0.44) {
  const viewport = page.viewportSize();
  await page.mouse.click(
    Math.round(viewport.width * xRatio),
    Math.round(viewport.height * yRatio),
  );
}

test.beforeEach(async ({ page }) => {
  page.runtimeProblems = [];
  page.on('pageerror', (error) => page.runtimeProblems.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') page.runtimeProblems.push(message.text());
  });
});

test.afterEach(async ({ page }) => {
  expect(page.runtimeProblems, 'browser runtime errors').toEqual([]);
});

test('playground draws, stamps repeatedly, transforms a stamp, and clears stamp mode on workspace change', async ({ page }) => {
  await enterPlayground(page);

  const canvas = page.locator('#world');
  await expect(canvas).toBeVisible();
  await clickBoard(page);
  await expect(page.locator('#population')).toHaveText('1');

  await page.locator('[data-pattern-tab="motion"]').click();
  await page.locator('[data-preset-id="glider"]').click();
  await expect(page.locator('[data-tool="stamp"]')).toHaveAttribute('aria-checked', 'true');
  await page.locator('#stamp-rotate-right').click();
  await expect(page.locator('#stamp-transform-label')).toContainText('90°');
  await clickBoard(page, 0.45, 0.38);
  const firstStampPopulation = Number(await page.locator('#population').textContent());
  await clickBoard(page, 0.58, 0.48);
  await expect.poll(async () => Number(await page.locator('#population').textContent())).toBeGreaterThan(firstStampPopulation);

  await page.locator('#mode-community').click();
  await expect(page.locator('.app-shell')).toHaveClass(/community-mode/);
  await expect(page.locator('[data-tool="stamp"]')).toHaveAttribute('aria-checked', 'false');
  await expect(page.locator('#world')).toHaveCSS('opacity', '0');
  await expect(page.locator('#world')).toHaveCSS('pointer-events', 'none');
});

test('Dev Studio launches a project without losing the current board and exposes save state', async ({ page }) => {
  await enterPlayground(page);
  await clickBoard(page);
  await expect(page.locator('#population')).toHaveText('1');

  await page.locator('#mode-dev').click();
  await expect(page.locator('.app-shell')).toHaveClass(/dev-start-mode/);
  await expect(page.locator('#dev-create-design')).toBeVisible();
  await page.locator('#dev-create-design').click();

  await expect(page.locator('.app-shell')).toHaveClass(/dev-active-mode/);
  await expect(page.locator('#world')).toBeVisible();
  await expect(page.locator('#dev-design-title')).toHaveValue('Untitled Design');
  await expect(page.locator('#dev-dirty-state')).toHaveText('Saved');

  await page.locator('#tool-drawer-toggle').click();
  await expect(page.locator('#dev-design-title')).toBeVisible();
  await page.locator('#dev-design-title').fill('Browser smoke design');
  await expect(page.locator('#dev-dirty-state')).toHaveText('Unsaved');
  await page.locator('#mode-playground').click();
  await expect(page.locator('#dev-design-title')).toHaveValue('Browser smoke design');
  await page.locator('#mode-dev').click();
  await expect(page.locator('.app-shell')).toHaveClass(/dev-active-mode/);
  await expect(page.locator('#dev-design-title')).toHaveValue('Browser smoke design');
});

test('Community renders discovery controls and explicitly gates shared actions', async ({ page }) => {
  await enterPlayground(page);
  await page.locator('#mode-community').click();

  await expect(page.locator('#community-search')).toBeVisible();
  await page.locator('#community-filter-button').click();
  await expect(page.locator('#community-filter-menu')).toHaveClass(/open/);
  await page.locator('[data-community-filter-value="famous"]').click();
  await expect(page.locator('#community-filter-label')).toHaveText('Famous');

  await page.locator('#community-filter-button').focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('[data-community-filter-value="all"]')).toBeFocused();
  await page.keyboard.press('End');
  await expect(page.locator('[data-community-filter-value="remixes"]')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#community-filter-button')).toBeFocused();

  const firstCard = page.locator('#community-famous-list .community-card').first();
  await expect(firstCard).toBeVisible();
  await firstCard.getByRole('button', { name: 'Star' }).click();
  await expect(page.locator('#community-output')).toContainText('starred locally for this session');
});

test('mobile workspace navigation and tool drawer remain usable without horizontal overflow', async ({ page }) => {
  await enterPlayground(page);
  const viewportWidth = await page.evaluate(() => document.documentElement.clientWidth);
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(viewportWidth);

  await page.locator('#tool-drawer-close').click();
  await expect(page.locator('#tool-drawer-toggle')).toBeVisible();
  await page.locator('#tool-drawer-toggle').click();
  await expect(page.locator('#tool-panel')).toBeVisible();

  await page.locator('#mode-dev').click();
  await expect(page.locator('#dev-create-design')).toBeVisible();
  await page.locator('#mode-community').click();
  await expect(page.locator('#community-search')).toBeVisible();
});
