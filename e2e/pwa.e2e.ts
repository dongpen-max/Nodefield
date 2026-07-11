import { expect, test } from '@playwright/test';
import { openApp, waitForAutosave } from './helpers';

test('loads from the service worker offline and persists edits in IndexedDB', async ({
  context,
  page,
}) => {
  const noteTitle = '离线新增笔记';
  const noteBody = '断网后仍可编辑并保存';

  await openApp(page);
  const manifest = await page.evaluate(async () => {
    const response = await fetch('/manifest.webmanifest');
    return response.json();
  });
  expect(manifest).toMatchObject({
    name: 'Nodefield',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#4f6f52',
    icons: [
      {
        src: 'favicon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
    ],
  });
  await page.waitForFunction(() => navigator.serviceWorker?.controller !== null);

  const serviceWorker = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    return {
      controlled: navigator.serviceWorker.controller !== null,
      scope: registration.scope,
      scriptUrl: registration.active?.scriptURL,
    };
  });
  expect(serviceWorker).toEqual({
    controlled: true,
    scope: 'http://127.0.0.1:4173/',
    scriptUrl: 'http://127.0.0.1:4173/sw.js',
  });

  await context.setOffline(true);
  try {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByLabel(/^切换画布，当前为/)).toBeVisible();

    await page.getByRole('button', { name: '添加笔记' }).click();
    const inspector = page.getByLabel('节点检查器');
    await inspector.getByLabel('标题').fill(noteTitle);
    await inspector.getByLabel('内容').fill(noteBody);
    await waitForAutosave(page);
    await expect(page.getByLabel(`笔记：${noteTitle}`)).toBeVisible();

    const storedNode = await page.evaluate(async (title) => {
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('nodefield');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const transaction = database.transaction(['boards', 'meta'], 'readonly');
      const activeBoardId = await new Promise<string>((resolve, reject) => {
        const request = transaction.objectStore('meta').get('activeBoardId');
        request.onsuccess = () => resolve(request.result.value);
        request.onerror = () => reject(request.error);
      });
      const board = await new Promise<{
        nodes: Array<{ data: { title: string; body: string } }>;
      }>((resolve, reject) => {
        const request = transaction.objectStore('boards').get(activeBoardId);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      database.close();
      return board.nodes.find((node) => node.data.title === title)?.data;
    }, noteTitle);

    expect(storedNode).toMatchObject({ title: noteTitle, body: noteBody });
  } finally {
    await context.setOffline(false);
  }
});
