import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import {
  STARTER_TITLE,
  boardSelectButton,
  openApp,
  openBoardSwitcher,
  waitForAutosave,
} from './helpers';

test('backs up and restores every board with the active board intact', async ({ page }) => {
  const boardA = '工作区备份画布 A';
  const boardB = '工作区备份画布 B';
  const noteA = 'A 画布独有内容';
  const noteB = 'B 画布独有内容';
  const damagedTitle = '已被破坏的画布';
  const damagedNote = '备份后的临时内容';

  await openApp(page);
  await createBoardWithNote(page, boardA, noteA);
  await createBoardWithNote(page, boardB, noteB);

  await openBoardSwitcher(page);
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: `删除画布 ${STARTER_TITLE}` }).click();

  const downloadPromise = page.waitForEvent('download');
  await page.getByLabel('文件菜单').click();
  await page.getByRole('button', { name: '备份全部画布' }).click();
  const download = await downloadPromise;
  await expect(
    page.getByRole('status').filter({ hasText: '已备份 2 个画布' }),
  ).toBeVisible();
  await expectBackupTime(page);
  expect(download.suggestedFilename()).toMatch(/^nodefield-workspace-\d{4}-\d{2}-\d{2}\.json$/);

  const downloadedPath = await download.path();
  expect(downloadedPath).not.toBeNull();
  const archiveBuffer = await readFile(downloadedPath!);
  const archive = JSON.parse(archiveBuffer.toString('utf8')) as {
    schemaVersion: number;
    activeBoardId: string;
    boards: Array<{ id: string; title: string }>;
  };
  expect(archive.schemaVersion).toBe(1);
  expect(archive.boards.map((board) => board.title).sort()).toEqual([boardA, boardB]);
  expect(archive.boards.find((board) => board.id === archive.activeBoardId)?.title).toBe(boardB);

  await openBoardSwitcher(page);
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: `删除画布 ${boardB}` }).click();
  await expect(page.getByLabel(new RegExp(`^切换画布，当前为${boardA}`))).toBeVisible();

  await openBoardSwitcher(page);
  await page.getByLabel('当前画布名称').fill(damagedTitle);
  await waitForAutosave(page);
  await page.getByRole('button', { name: '添加笔记' }).click();
  await page.getByLabel('节点检查器').getByLabel('标题').fill(damagedNote);
  await waitForAutosave(page);

  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.getByLabel('文件菜单').click();
  await page.getByRole('button', { name: '恢复工作区' }).click();
  const fileChooser = await fileChooserPromise;
  const dialogPromise = page.waitForEvent('dialog');
  const uploadPromise = fileChooser.setFiles({
    name: 'nodefield-workspace-backup.json',
    mimeType: 'application/json',
    buffer: archiveBuffer,
  });
  const dialog = await dialogPromise;
  expect(dialog.message()).toContain('中的 2 个画布');
  expect(dialog.message()).toContain('当前工作区将被替换');
  await dialog.accept();
  await uploadPromise;

  await expect(
    page.getByRole('status').filter({ hasText: '已恢复 2 个画布' }),
  ).toBeVisible();
  await expectBackupTime(page);
  await expect(page.getByLabel(new RegExp(`^切换画布，当前为${boardB}`))).toBeVisible();
  await expect(page.getByLabel(`笔记：${noteB}`)).toBeVisible();
  await expect(page.getByLabel(`笔记：${damagedNote}`)).toHaveCount(0);

  await openBoardSwitcher(page);
  await expect(boardSelectButton(page, boardA)).toBeVisible();
  await expect(boardSelectButton(page, boardB)).toBeVisible();
  await expect(boardSelectButton(page, damagedTitle)).toHaveCount(0);
  await boardSelectButton(page, boardA).click();
  await expect(page.getByLabel(`笔记：${noteA}`)).toBeVisible();
  await expect(page.getByLabel(`笔记：${noteB}`)).toHaveCount(0);

  await openBoardSwitcher(page);
  await boardSelectButton(page, boardB).click();
  await expect(page.getByLabel(`笔记：${noteB}`)).toBeVisible();

  await page.reload();
  await expect(page.getByLabel(new RegExp(`^切换画布，当前为${boardB}`))).toBeVisible();
  await expect(page.getByLabel(`笔记：${noteB}`)).toBeVisible();
  await expectBackupTime(page);
  await openBoardSwitcher(page);
  await expect(boardSelectButton(page, boardA)).toBeVisible();
  await expect(boardSelectButton(page, boardB)).toBeVisible();
  await expect(boardSelectButton(page, damagedTitle)).toHaveCount(0);
});

test('rejects an invalid workspace archive without changing stored boards', async ({ page }) => {
  const boardTitle = '非法归档保护画布';
  const noteTitle = '不可丢失的内容';
  const dialogs: string[] = [];

  await openApp(page);
  await openBoardSwitcher(page);
  await page.getByLabel('当前画布名称').fill(boardTitle);
  await waitForAutosave(page);
  await page.getByRole('button', { name: '添加笔记' }).click();
  await page.getByLabel('节点检查器').getByLabel('标题').fill(noteTitle);
  await waitForAutosave(page);
  const before = await readStoredWorkspace(page);

  page.on('dialog', async (dialog) => {
    dialogs.push(dialog.message());
    await dialog.dismiss();
  });
  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.getByLabel('文件菜单').click();
  await page.getByRole('button', { name: '恢复工作区' }).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles({
    name: 'invalid-workspace.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        schemaVersion: 999,
        exportedAt: '2026-07-11T00:00:00.000Z',
        activeBoardId: 'missing-board',
        boards: [],
      }),
    ),
  });

  await expect(
    page
      .getByRole('status')
      .filter({ hasText: '工作区备份文件无效，未修改当前工作区' }),
  ).toBeVisible();
  expect(dialogs).toEqual([]);
  expect(await readStoredWorkspace(page)).toEqual(before);
  await expect(page.getByLabel(new RegExp(`^切换画布，当前为${boardTitle}`))).toBeVisible();
  await expect(page.getByLabel(`笔记：${noteTitle}`)).toBeVisible();

  await page.reload();
  await expect(page.getByLabel(new RegExp(`^切换画布，当前为${boardTitle}`))).toBeVisible();
  await expect(page.getByLabel(`笔记：${noteTitle}`)).toBeVisible();
  expect(await readStoredWorkspace(page)).toEqual(before);
});

test('keeps only one writable tab for the same local workspace', async ({ context, page }) => {
  await openApp(page);

  const waitingPage = await context.newPage();
  await waitingPage.goto('/');
  await expect(waitingPage.getByRole('status')).toContainText(
    'Nodefield 已在另一个标签页运行',
  );
  await expect(waitingPage.getByLabel(/^切换画布，当前为/)).toHaveCount(0);

  await page.close();
  await expect(waitingPage.getByLabel(/^切换画布，当前为/)).toBeVisible();
  await waitingPage.getByRole('button', { name: '添加笔记' }).click();
  await waitForAutosave(waitingPage);
});

test('blocks persistence when Web Locks are unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: undefined,
    });
  });

  await page.goto('/');
  await expectUnsupportedBrowser(page);
});

test('blocks persistence when the Web Locks request is denied', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: {
        request: () => Promise.reject(new Error('Web Locks denied')),
      },
    });
  });

  await page.goto('/');
  await expectUnsupportedBrowser(page);
});

async function createBoardWithNote(page: Page, boardTitle: string, noteTitle: string) {
  await openBoardSwitcher(page);
  await page.getByRole('button', { name: '新建画布' }).click();
  await openBoardSwitcher(page);
  await page.getByLabel('当前画布名称').fill(boardTitle);
  await waitForAutosave(page);
  await page.getByRole('button', { name: '添加笔记' }).click();
  await page.getByLabel('节点检查器').getByLabel('标题').fill(noteTitle);
  await waitForAutosave(page);
}

async function expectBackupTime(page: Page) {
  await page.getByLabel('文件菜单').click();
  await expect(page.getByLabel('本地存储状态')).not.toContainText('尚未备份');
  await page.getByLabel('文件菜单').click();
}

async function expectUnsupportedBrowser(page: Page) {
  await expect(page.getByRole('alert')).toContainText(
    '当前浏览器无法安全打开 Nodefield',
  );
  await expect(page.getByRole('alert')).toContainText('请使用支持 Web Locks 的现代浏览器');
  await expect(page.getByLabel(/^切换画布，当前为/)).toHaveCount(0);
}

async function readStoredWorkspace(page: Page) {
  return page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('nodefield');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction(['boards', 'meta'], 'readonly');
    const boardsRequest = transaction.objectStore('boards').getAll();
    const activeRequest = transaction.objectStore('meta').get('activeBoardId');
    const [boards, active] = await Promise.all([
      new Promise<unknown[]>((resolve, reject) => {
        boardsRequest.onsuccess = () => resolve(boardsRequest.result);
        boardsRequest.onerror = () => reject(boardsRequest.error);
      }),
      new Promise<{ value?: unknown } | undefined>((resolve, reject) => {
        activeRequest.onsuccess = () => resolve(activeRequest.result);
        activeRequest.onerror = () => reject(activeRequest.error);
      }),
    ]);
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    database.close();
    return { activeBoardId: active?.value, boards };
  });
}
