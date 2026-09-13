import { expect, test } from '@playwright/test';

async function enterPlayground(page) {
  await page.goto('/');
  await expect(page).toHaveTitle(/Conway/i);
  await expect(page.locator('#intro-layer')).toBeHidden();
}

async function clickBoard(page, xRatio = 0.5, yRatio = 0.44) {
  const point = await page.evaluate(({ xRatio, yRatio }) => {
    const candidates = [];
    for (let y = 20; y < innerHeight - 20; y += 12) {
      for (let x = 20; x < innerWidth - 20; x += 12) {
        if (document.elementFromPoint(x, y)?.id === 'world') candidates.push({ x, y });
      }
    }
    return candidates.sort((a, b) => Math.hypot(a.x - innerWidth * xRatio, a.y - innerHeight * yRatio)
      - Math.hypot(b.x - innerWidth * xRatio, b.y - innerHeight * yRatio))[0];
  }, { xRatio, yRatio });
  expect(point, 'an unobstructed part of the board must be touchable').toBeTruthy();
  if ((page.viewportSize()?.width || 0) < 600) await page.touchscreen.tap(point.x, point.y);
  else await page.mouse.click(point.x, point.y);
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
  await expect(page.locator('#population')).toHaveText('5');
  const populationBeforeDraw = Number(await page.locator('#population').textContent());
  await clickBoard(page);
  await expect.poll(async () => Number(await page.locator('#population').textContent())).not.toBe(populationBeforeDraw);

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
  await expect(page.locator('#population')).toHaveText('5');
  const populationBeforeDraw = Number(await page.locator('#population').textContent());
  await clickBoard(page);
  await expect.poll(async () => Number(await page.locator('#population').textContent())).not.toBe(populationBeforeDraw);

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

test('Dev Studio saves immutable versions and restores history as a new version', async ({ page }) => {
  await enterPlayground(page);
  await page.locator('#mode-dev').click();
  await page.locator('#profile-name').fill('Version Builder');
  await page.locator('#profile-email').fill('versions@example.com');
  await page.locator('#save-profile').click();
  await expect(page.locator('#dev-profile-name')).toHaveText('Version Builder');

  await page.locator('#dev-create-design').click();
  await page.locator('#tool-drawer-toggle').click();
  await page.locator('#dev-design-title').fill('Versioned browser design');
  await page.locator('#dev-design-description').fill('A browser-tested version history.');
  await page.locator('#dev-design-tags').fill('browser, history');
  await clickBoard(page, 0.46, 0.4);
  await page.locator('#save-design').click();
  await expect(page.locator('#dev-version-count')).toHaveText('1');
  await expect(page.locator('#dev-dirty-state')).toHaveText('Saved');

  await clickBoard(page, 0.56, 0.46);
  await page.locator('#save-design').click();
  await expect(page.locator('#dev-version-count')).toHaveText('2');
  await expect(page.locator('.version-row.current')).toContainText('Version 2');

  await page.locator('.version-row').filter({ hasText: 'Version 1' }).getByRole('button', { name: 'Restore' }).click();
  await expect(page.locator('#dev-version-count')).toHaveText('3');
  await expect(page.locator('.version-row.current')).toContainText('Version 3');
});

test('Dev Studio validates publish readiness and exposes the publish state', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Publish state is covered once in Chromium.');
  await enterPlayground(page);
  await page.locator('#mode-dev').click();
  await page.locator('#profile-name').fill('Publish Builder');
  await page.locator('#profile-email').fill('publish@example.com');
  await page.locator('#save-profile').click();
  await page.locator('#dev-create-design').click();
  await page.locator('#tool-drawer-toggle').click();
  await page.locator('#dev-design-title').fill('Validated browser design');
  await page.locator('#dev-design-description').fill('Too short');
  await page.locator('#dev-design-tags').fill('browser, publish');
  await clickBoard(page, 0.46, 0.4);
  await page.locator('#preview-use-view').click();
  await expect(page.locator('#dev-preview-mode')).toHaveText('Current view');
  await expect(page.locator('#preview-use-view')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#dev-preview')).toHaveAttribute('aria-label', /1 live cell/);
  await expect(page.locator('#dev-preview .preview-grid span')).toHaveCount(1);

  await page.locator('#publish-design').click();
  await expect(page.locator('#publish-design')).toHaveText('Retry Publish');
  await expect(page.locator('#dev-output')).toContainText('at least 20 characters');

  await page.locator('#dev-design-description').fill('A complete browser-tested publishing workflow.');
  await page.locator('#publish-design').click();
  await expect(page.locator('#account-dialog')).toBeVisible();
  await expect(page.locator('#account-context')).toContainText('Sign in to publish');
  await expect(page.locator('#dev-design-title')).toHaveValue('Validated browser design');
  await page.locator('#account-close').click();
});

test('Dev Studio recovers a debounced unsaved draft after reload', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Recovery is storage behavior covered once in Chromium.');
  await enterPlayground(page);
  await page.locator('#mode-dev').click();
  await page.locator('#dev-create-design').click();
  await page.locator('#tool-drawer-toggle').click();
  await page.locator('#dev-design-title').fill('Recovered browser draft');
  await clickBoard(page, 0.48, 0.42);
  await page.waitForTimeout(700);

  await page.reload();
  await expect(page.locator('#intro-layer')).toBeHidden({ timeout: 3_000 });
  await expect(page.locator('.app-shell')).toHaveClass(/dev-active-mode/);
  await expect(page.locator('#dev-design-title')).toHaveValue('Recovered browser draft');
  await expect(page.locator('#dev-dirty-state')).toHaveText('Unsaved');
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
  await expect(page.locator('[data-community-filter-value="favorites"]')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#community-filter-button')).toBeFocused();

  const firstCard = page.locator('#community-famous-list .community-card').first();
  await expect(firstCard).toBeVisible();
  await firstCard.getByRole('button', { name: 'Star' }).click();
  await expect(page.locator('#account-dialog')).toBeVisible();
  await expect(page.locator('#account-context')).toContainText('Favorites');
});

test('account dialog is contextual in every workspace and exposes honest local availability', async ({ page }) => {
  await enterPlayground(page);
  for (const workspace of ['#mode-playground', '#mode-dev', '#mode-community']) {
    await page.locator(workspace).click();
    await page.locator('#account-entry').click();
    await expect(page.locator('#account-dialog')).toBeVisible();
    await expect(page.locator('#account-context')).toContainText('unavailable in this local build');
    await expect(page.locator('#account-submit')).toBeDisabled();
    await page.locator('#account-close').click();
  }
});

test('public preset URL reloads directly and guest remix opens a private attributed Studio project', async ({ page }) => {
  await page.goto('/c/famous-glider');
  await expect(page.locator('#intro-layer')).toBeHidden();
  await expect(page.locator('.app-shell')).toHaveClass(/community-mode/);
  await expect(page.locator('#community-detail')).toContainText('Glider');
  await page.locator('#community-detail').getByRole('button', { name: 'Remix' }).click();
  await expect(page.locator('.app-shell')).toHaveClass(/dev-active-mode/);
  await expect(page.locator('#dev-design-title')).toHaveValue('Glider Remix');
  await expect(page.locator('#dev-design-attribution')).toHaveValue('Remixed from Glider by LifeWiki.');
  await page.reload();
  await expect(page.locator('#dev-design-title')).toHaveValue('Glider Remix');
});

test('Studio exposes only verified circuit experiments with editable input ports', async ({ page }) => {
  await enterPlayground(page);
  await page.locator('#mode-dev').click();
  await page.locator('#dev-create-design').click();
  await page.locator('#tool-drawer-toggle').click();
  await page.locator('.dev-command-strip > summary').click();

  await expect(page.locator('#circuit-experiments')).toContainText('AND gate');
  await expect(page.locator('#circuit-experiments')).toContainText('Binary half-adder');
  await expect(page.locator('#circuit-experiments')).not.toContainText('XOR');
  const andCard = page.locator('[data-circuit-id="and"]');
  await andCard.locator('[data-circuit-input="a"]').check();
  await expect(andCard.locator('[data-circuit-input="a"]')).toBeChecked();
  await expect(andCard.locator('[data-circuit-output="and"]')).toContainText('Output settles at generation 600');
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
