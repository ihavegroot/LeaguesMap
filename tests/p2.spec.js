const { test, expect } = require('@playwright/test');

async function clearAppStorage(page) {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.removeItem('league_tasks_completed');
    localStorage.removeItem('league_planner_v1');
  });
}

async function gotoApp(page) {
  await page.goto('/');
  await expect(page.locator('#task-panel')).toBeVisible();
  await expect(page.locator('#task-list .task-card').first()).toBeVisible({ timeout: 30000 });
}

async function openPlannerTab(page) {
  await page.locator('.task-tab[data-tab="planner"]').click();
  await expect(page.locator('#planner-container')).toBeVisible();
  await expect(page.locator('#planner-list')).toBeVisible();
}

async function seedPlannerWithFirstTasks(page, count) {
  await page.waitForFunction((n) => Array.isArray(window._allTasksRef) && window._allTasksRef.length >= n, count);
  const names = await page.evaluate((n) => window._allTasksRef.slice(0, n).map((t) => t.name), count);
  for (const taskName of names) {
    await page.evaluate((name) => window._plannerAddTask(name), taskName);
  }
  return names;
}

test.describe('P2 comprehensive feature coverage', () => {
  test.beforeEach(async ({ page }) => {
    await clearAppStorage(page);
  });

  test('active/completed tabs and reset all flow', async ({ page }) => {
    await gotoApp(page);

    const firstCard = page.locator('#task-list .task-card').first();
    const taskName = (await firstCard.locator('.task-card-name').innerText()).trim();
    await firstCard.locator('.task-card-checkbox').click({ force: true });

    const completedTab = page.locator('.task-tab[data-tab="completed"]');
    await expect(completedTab).toContainText('Completed (1)');
    await completedTab.click();

    await expect(page.locator('#task-list .task-card .task-card-name', { hasText: taskName }).first()).toBeVisible();

    page.once('dialog', (dialog) => dialog.accept());
    await page.locator('.task-reset-btn').click();

    await expect(completedTab).toHaveText('Completed');
    await expect(page.locator('#task-list .task-panel-empty')).toContainText('No completed tasks yet.');
  });

  test('show general tasks toggle affects visible task list', async ({ page }) => {
    await gotoApp(page);

    await expect(page.locator('#task-list .task-card-area', { hasText: 'General' })).toHaveCount(0);
    await page.locator('#task-show-general').check();
    await expect(page.locator('#task-list .task-card-area', { hasText: 'General' }).first()).toBeVisible();

    await page.locator('#task-show-general').uncheck();
    await expect(page.locator('#task-list .task-card-area', { hasText: 'General' })).toHaveCount(0);
  });

  test('planner group rename persists after reload', async ({ page }) => {
    await gotoApp(page);
    await seedPlannerWithFirstTasks(page, 1);
    await openPlannerTab(page);

    const groupName = page.locator('.planner-group').first().locator('.planner-group-name');
    await groupName.fill('Boss Route');
    await groupName.blur();

    await expect(page.locator('.planner-group').first().locator('.planner-group-name')).toHaveValue('Boss Route');

    await page.reload();
    await openPlannerTab(page);
    await expect(page.locator('.planner-group').first().locator('.planner-group-name')).toHaveValue('Boss Route');
  });

  test('planner group collapse state persists after reload', async ({ page }) => {
    await gotoApp(page);
    await seedPlannerWithFirstTasks(page, 2);
    await openPlannerTab(page);

    const firstGroup = page.locator('.planner-group').first();
    await expect(firstGroup.locator('.planner-group-body')).toBeVisible();

    await firstGroup.locator('.planner-group-toggle').click();
    await expect(firstGroup.locator('.planner-group-body')).toHaveCount(0);

    await page.reload();
    await openPlannerTab(page);
    await expect(page.locator('.planner-group').first().locator('.planner-group-body')).toHaveCount(0);
  });

  test('planner pin set persists and clear persists', async ({ page }) => {
    await gotoApp(page);
    await seedPlannerWithFirstTasks(page, 1);
    await openPlannerTab(page);

    const card = page.locator('.planner-card').first();
    await card.locator('.planner-pin-btn').click();
    await page.locator('#map').click({ position: { x: 130, y: 130 } });

    const pinnedText = await card.locator('.planner-pin-btn').innerText();
    expect(pinnedText).toMatch(/📍\s*\d+\s*,\s*\d+/);

    await page.reload();
    await openPlannerTab(page);

    const reloadedCard = page.locator('.planner-card').first();
    await expect(reloadedCard.locator('.planner-pin-clear-btn')).toBeVisible();

    await reloadedCard.locator('.planner-pin-clear-btn').click();
    await expect(reloadedCard.locator('.planner-pin-clear-btn')).toHaveCount(0);

    await page.reload();
    await openPlannerTab(page);
    await expect(page.locator('.planner-card').first().locator('.planner-pin-btn')).toHaveText('📍 Set pin');
  });

  test('planner line mode and pins visibility controls update state', async ({ page }) => {
    await gotoApp(page);
    await seedPlannerWithFirstTasks(page, 2);
    await openPlannerTab(page);

    const noneBtn = page.locator('.planner-line-btn[data-mode="none"]');
    const nearbyBtn = page.locator('.planner-line-btn[data-mode="nearby"]');
    const allBtn = page.locator('.planner-line-btn[data-mode="all"]');

    await noneBtn.click();
    await expect(noneBtn).toHaveClass(/planner-line-btn-active/);

    await nearbyBtn.click();
    await expect(nearbyBtn).toHaveClass(/planner-line-btn-active/);

    await allBtn.click();
    await expect(allBtn).toHaveClass(/planner-line-btn-active/);

    const pinsBtn = page.locator('#planner-pins-toggle');
    await expect(pinsBtn).toHaveClass(/planner-line-btn-active/);
    await pinsBtn.click();
    await expect(pinsBtn).not.toHaveClass(/planner-line-btn-active/);
    await pinsBtn.click();
    await expect(pinsBtn).toHaveClass(/planner-line-btn-active/);
  });

  test('planner import legacy flat array format works', async ({ page }) => {
    await gotoApp(page);
    await openPlannerTab(page);

    const legacyImport = JSON.stringify([
      { id: 'legacy-1', taskName: 'Achieve Your First Level 10', pinCoords: null, comments: [] }
    ]);

    await page.locator('#planner-import-input').setInputFiles({
      name: 'legacy-planner.json',
      mimeType: 'application/json',
      buffer: Buffer.from(legacyImport, 'utf8')
    });

    await expect(page.locator('.planner-card')).toHaveCount(1);
    await expect(page.locator('.planner-card .planner-card-name', { hasText: 'Achieve Your First Level 10' }).first()).toBeVisible();
  });

  test('planner import unknown format shows alert and keeps current state', async ({ page }) => {
    await gotoApp(page);
    await seedPlannerWithFirstTasks(page, 1);
    await openPlannerTab(page);

    await expect(page.locator('.planner-card')).toHaveCount(1);

    const dialogPromise = page.waitForEvent('dialog');
    await page.locator('#planner-import-input').setInputFiles({
      name: 'unknown-format.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{"version":2,"foo":[]}', 'utf8')
    });

    const dialog = await dialogPromise;
    expect(dialog.message()).toContain('Unrecognised planner file format.');
    await dialog.accept();

    await expect(page.locator('.planner-card')).toHaveCount(1);
  });
});
