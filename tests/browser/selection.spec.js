import { expect, test } from '@playwright/test';

test('selection controls preserve edits through touch, transforms, history and Step', async ({ page, context, isMobile }, testInfo) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const WorkerClass = window.Worker;
    window.Worker = class extends WorkerClass {
      postMessage(data, ...args) {
        if (data.type === 'load') window.editedCells = Array.from(data.board.cells).flatMap((v, i) => v ? [[i % data.board.width, Math.floor(i / data.board.width)]] : []);
        return super.postMessage(data, ...args);
      }
    };
    const stroke = CanvasRenderingContext2D.prototype.strokeRect;
    CanvasRenderingContext2D.prototype.strokeRect = function (...args) {
      if (this.canvas.id === 'world' && this.getLineDash().length) window.selectionOutline = args;
      return stroke.apply(this, args);
    };
  });
  await page.goto('/studio');
  await page.locator('#dev-create-design').click();
  await page.locator('#clear').click();
  const tap = async (point) => isMobile ? page.touchscreen.tap(point.x, point.y) : page.mouse.click(point.x, point.y);
  const openTools = async () => {
    if (await page.locator('#tool-drawer-toggle').getAttribute('aria-expanded') !== 'true') await page.locator('#tool-drawer-toggle').click();
  };
  const closeTools = async () => {
    if (await page.locator('#tool-drawer-close').isVisible()) await page.locator('#tool-drawer-close').click();
  };
  await openTools();
  await closeTools();
  const point = await page.evaluate(() => {
    for (let y = innerHeight * 0.45; y < innerHeight - 100; y += 10) {
      for (let x = innerWidth * 0.5; x < innerWidth - 60; x += 10) {
        if ([[-25,-25],[25,25],[0,0]].every(([dx,dy]) => document.elementFromPoint(x+dx,y+dy)?.id === 'world')) return { x, y };
      }
    }
  });
  expect(point).toBeTruthy();
  await tap(point);
  await tap({ x: point.x + 10, y: point.y - 10 });
  await expect(page.locator('#population')).toHaveText('2');
  const initial = await page.evaluate(() => window.editedCells);
  await openTools();
  await page.locator('[data-tool="select"]').click();
  await closeTools();
  const start = { x: point.x - 20, y: point.y - 20 };
  const end = { x: point.x + 20, y: point.y + 20 };
  if (isMobile) {
    const cdp = await context.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [end] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await cdp.detach();
  } else {
    await page.mouse.move(start.x, start.y); await page.mouse.down();
    await page.mouse.move(end.x, end.y); await page.mouse.up();
  }
  await expect.poll(() => page.evaluate(() => window.selectionOutline)).toBeTruthy();
  await page.screenshot({ path: `/private/tmp/life-selection-${testInfo.project.name}.png` });
  await openTools();
  const command = (name) => page.locator(`[data-selection-command="${name}"]`).click();
  await command('right');
  await expect.poll(() => page.evaluate(() => window.editedCells)).toEqual(initial.map(([x,y]) => [x+1,y]));
  await command('copy');
  await command('right'); await command('right');
  await closeTools();
  await tap({ x: point.x + 60, y: point.y + 40 });
  await openTools();
  await command('paste');
  await expect(page.locator('#population')).toHaveText('4');
  const beforeRotation = await page.evaluate(() => window.editedCells);
  await command('rotate');
  await expect.poll(() => page.evaluate(() => window.editedCells)).not.toEqual(beforeRotation);
  const beforeReflection = await page.evaluate(() => window.editedCells);
  await command('reflect');
  await expect.poll(() => page.evaluate(() => window.editedCells)).not.toEqual(beforeReflection);
  await expect(page.locator('#population')).toHaveText('4');
  const transformed = await page.evaluate(() => window.editedCells);
  await page.locator('#undo').click();
  await page.locator('#redo').click();
  await expect.poll(() => page.evaluate(() => window.editedCells)).toEqual(transformed);
  await page.locator('#step').click();
  await expect(page.locator('#generation')).toHaveText('1');
  await expect(page.locator('#population')).toHaveText('0');
  expect(errors).toEqual([]);
});
