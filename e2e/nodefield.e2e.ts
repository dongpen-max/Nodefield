import { expect, test } from '@playwright/test';
import {
  QUESTION_TITLE,
  SOURCE_TITLE,
  boardSelectButton,
  openApp,
  openBoardSwitcher,
  waitForAutosave,
} from './helpers';

test('manages isolated boards and persists the active board in IndexedDB', async ({ page }) => {
  const boardA = 'E2E 研究画布 A';
  const boardB = 'E2E 研究画布 B';
  const noteA = 'A 画布独有笔记';
  const noteB = 'B 画布独有笔记';

  await openApp(page);
  await openBoardSwitcher(page);
  await page.getByLabel('当前画布名称').fill(boardA);
  await waitForAutosave(page);

  await page.getByRole('button', { name: '添加笔记' }).click();
  await page.getByLabel('节点检查器').getByLabel('标题').fill(noteA);
  await waitForAutosave(page);

  await openBoardSwitcher(page);
  await page.getByRole('button', { name: '新建画布' }).click();
  await expect(page.getByLabel(/^切换画布，当前为未命名画布/)).toBeVisible();

  await openBoardSwitcher(page);
  await page.getByLabel('当前画布名称').fill(boardB);
  await waitForAutosave(page);
  await page.getByRole('button', { name: '添加笔记' }).click();
  await page.getByLabel('节点检查器').getByLabel('标题').fill(noteB);
  await waitForAutosave(page);

  await openBoardSwitcher(page);
  await boardSelectButton(page, boardA).click();
  await expect(page.getByLabel(`笔记：${noteA}`)).toBeVisible();
  await expect(page.getByLabel(`笔记：${noteB}`)).toHaveCount(0);

  await openBoardSwitcher(page);
  await boardSelectButton(page, boardB).click();
  await expect(page.getByLabel(`笔记：${noteB}`)).toBeVisible();
  await expect(page.getByLabel(`笔记：${noteA}`)).toHaveCount(0);

  await page.reload();
  await expect(page.getByLabel(`笔记：${noteB}`)).toBeVisible();
  await expect(page.getByLabel(new RegExp(`^切换画布，当前为${boardB}`))).toBeVisible();

  await openBoardSwitcher(page);
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: `删除画布 ${boardB}` }).click();
  await expect(page.getByLabel(new RegExp(`^切换画布，当前为${boardA}`))).toBeVisible();

  await page.reload();
  await openBoardSwitcher(page);
  await expect(boardSelectButton(page, boardA)).toBeVisible();
  await expect(boardSelectButton(page, boardB)).toHaveCount(0);
});

test('migrates a localStorage v1 board into versioned IndexedDB', async ({ page }) => {
  const legacyTitle = '旧版迁移画布';
  const legacyNodeTitle = '迁移后仍然存在';
  const legacyBoard = {
    schemaVersion: 1,
    id: 'legacy-e2e-board',
    title: legacyTitle,
    nodes: [
      {
        id: 'legacy-e2e-node',
        type: 'card',
        position: { x: 80, y: 120 },
        data: {
          kind: 'note',
          title: legacyNodeTitle,
          body: '由 V0.1 localStorage 迁移',
          tags: ['迁移'],
        },
      },
    ],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    updatedAt: '2026-07-11T00:00:00.000Z',
  };

  await page.addInitScript((board) => {
    if (sessionStorage.getItem('nodefield-e2e-legacy-seeded')) return;
    localStorage.setItem('nodefield.board.v1', JSON.stringify(board));
    sessionStorage.setItem('nodefield-e2e-legacy-seeded', 'true');
  }, legacyBoard);

  await openApp(page);
  await expect(page.getByLabel(new RegExp(`^切换画布，当前为${legacyTitle}`))).toBeVisible();
  await expect(page.getByLabel(`笔记：${legacyNodeTitle}`)).toBeVisible();

  const storageState = await page.evaluate(async () => ({
    legacy: localStorage.getItem('nodefield.board.v1'),
    databases: await indexedDB.databases(),
  }));
  expect(storageState.legacy).toBeNull();
  expect(storageState.databases).toContainEqual(
    expect.objectContaining({ name: 'nodefield', version: 1 }),
  );

  await page.reload();
  await expect(page.getByLabel(`笔记：${legacyNodeTitle}`)).toBeVisible();
});

test('keeps volatile fallback storage visible after the startup warning closes', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      value: undefined,
    });
  });

  await page.goto('/');
  await expect(page.getByLabel(/^切换画布，当前为/)).toBeVisible();
  const status = page.getByTestId('save-status');
  await expect(status).toHaveAttribute('data-state', 'volatile');
  await expect(status).toHaveAttribute('aria-label', '仅此页面，刷新会丢失');

  await page.waitForTimeout(3_000);
  await expect(status).toHaveAttribute('data-state', 'volatile');
});

test('edits an edge label and path with undo, redo, and reload persistence', async ({ page }) => {
  const edgeLabel = 'E2E 证据支撑';

  await openApp(page);
  await page.getByRole('group', { name: '关系：需要证据' }).click();
  const inspector = page.getByLabel('边检查器');
  await expect(inspector).toBeVisible();

  await inspector.getByLabel('关系标签').fill(edgeLabel);
  await inspector.getByLabel('关系路径').selectOption('straight');
  await waitForAutosave(page);
  await expect(page.getByRole('group', { name: `关系：${edgeLabel}` })).toBeVisible();
  await expect(inspector.getByLabel('关系路径')).toHaveValue('straight');

  await page.getByRole('button', { name: '撤销' }).click();
  await expect(inspector.getByLabel('关系路径')).toHaveValue('smoothstep');
  await page.getByRole('button', { name: '重做' }).click();
  await expect(inspector.getByLabel('关系路径')).toHaveValue('straight');
  await waitForAutosave(page);

  await page.reload();
  await page.getByRole('group', { name: `关系：${edgeLabel}` }).click();
  await expect(page.getByLabel('边检查器').getByLabel('关系标签')).toHaveValue(edgeLabel);
  await expect(page.getByLabel('边检查器').getByLabel('关系路径')).toHaveValue('straight');
});

test('applies a batch type change and restores a multi-delete with one undo', async ({ page }) => {
  await openApp(page);

  await page.getByLabel(`笔记：${QUESTION_TITLE}`).click();
  await page.getByLabel(`来源：${SOURCE_TITLE}`).click({ modifiers: ['Shift'] });

  const inspector = page.getByLabel('批量检查器');
  await expect(inspector).toBeVisible();
  await expect(inspector.getByRole('heading', { name: '已选择 2 项' })).toBeVisible();

  await inspector.getByRole('button', { name: '将所选节点设为行动' }).click();
  await expect(page.getByLabel(`行动：${QUESTION_TITLE}`)).toBeVisible();
  await expect(page.getByLabel(`行动：${SOURCE_TITLE}`)).toBeVisible();

  await inspector.getByRole('button', { name: '删除所选' }).click();
  await expect(page.getByLabel(`行动：${QUESTION_TITLE}`)).toHaveCount(0);
  await expect(page.getByLabel(`行动：${SOURCE_TITLE}`)).toHaveCount(0);

  await page.getByRole('button', { name: '撤销' }).click();
  await expect(page.getByLabel(`行动：${QUESTION_TITLE}`)).toBeVisible();
  await expect(page.getByLabel(`行动：${SOURCE_TITLE}`)).toBeVisible();
});
