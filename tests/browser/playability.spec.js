import { test, expect } from '@playwright/test';

test('Studio entry stays below navigation and presets remain honest and playable', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#population')).toHaveText('5');
  await page.locator('#mode-dev').click();
  const header = await page.locator('.arcade-rail').boundingBox();
  const studio = await page.locator('.dev-start-screen').boundingBox();
  expect(studio.y).toBeGreaterThanOrEqual(header.y + header.height);
  const runtime = await page.locator('#life-runtime-config').textContent();
  if (JSON.parse(runtime).backend === 'postgres') {
    await expect(page.locator('#profile-name')).toBeHidden();
    await page.locator('#save-profile').click();
    await expect(page.locator('#account-dialog')).toBeVisible();
    await expect(page.locator('#account-name')).toBeVisible();
    await page.locator('#account-close').click();
  }
  await page.locator('#mode-community').click();
  const glider = page.locator('.community-card[data-creation-id="famous-glider"]');
  await expect(glider).toContainText('Library preset');
  await expect(glider.locator('.community-stats')).not.toContainText(/stars|remixes/);
  await glider.getByRole('button', {name:'View Glider', exact:true}).click();
  await expect(page.locator('.comment-box')).toBeHidden();
  await expect(page.locator('#community-detail')).toContainText('Remix this preset');
  await expect(page.locator('.detail-preview')).toHaveCSS('background-image', 'none');
  const geometry = await glider.locator('.preview-grid').evaluate(grid => {
    const cells = [...grid.children].map(cell => cell.getBoundingClientRect());
    return { count: cells.length, square: cells.every(cell => Math.abs(cell.width-cell.height) < 1),
      bottomSpan: Math.max(...cells.slice(-3).map(cell=>cell.x))-Math.min(...cells.slice(-3).map(cell=>cell.x)),
      cellWidth: cells[0].width };
  });
  expect(geometry.count).toBe(5);
  expect(geometry.square).toBe(true);
  expect(geometry.bottomSpan).toBeCloseTo(2 * geometry.cellWidth, 0);
  await glider.getByRole('button', { name: 'Remix', exact: true }).click();
  await expect(page.locator('#dev-design-title')).toHaveValue('Glider Remix');
  await expect(page.locator('#account-dialog')).not.toBeVisible();
  await expect(page.locator('#population')).toHaveText('5');
  await page.locator('#step').click();
  await expect(page.locator('#generation')).toHaveText('1');
  await page.locator('#reset-start').click();
  await expect(page.locator('#generation')).toHaveText('0');
  await page.reload();
  await expect(page.locator('#dev-design-title')).toHaveValue('Glider Remix');
});

test('phone controls leave room to play and desktop pattern labels fit', async ({page}, testInfo) => {
  await page.goto('/');
  await expect(page.locator('#population')).toHaveText('5');
  if(testInfo.project.name.startsWith('mobile')) {
    const controls = await page.locator('.transport-block').boundingBox();
    expect(controls.height).toBeLessThan(160);
  }
  // Inspect whichever showcase cards are rendered; names and metadata must fit.
  const clipped = await page.locator('#presets .preset-topline').evaluateAll(nodes => nodes.filter(node => node.scrollWidth > node.clientWidth + 1).length);
  expect(clipped).toBe(0);
});
