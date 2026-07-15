import { expect, test, type Page } from '@playwright/test';
import { openApp } from './helpers';

const LARGE_NODE_COUNT = 600;

test('keeps a large canvas responsive while autosave settles', async ({ page }, testInfo) => {
  await openApp(page);
  await seedLargeBoard(page);
  await page.reload();
  await expect(page.getByLabel(/^切换画布，当前为大画布性能基准/)).toBeVisible();
  await expect(page.getByTestId('save-status')).toHaveAttribute('data-state', 'saved');
  await page.waitForTimeout(350);

  const renderedNodeCount = await page.locator('.react-flow__node').count();
  await installCloneProbe(page);

  await page.getByLabel('笔记：性能节点 0').click();
  await page.waitForTimeout(50);
  const immediateCloneStats = await readCloneStats(page);
  await page.waitForTimeout(350);
  const settledCloneStats = await readCloneStats(page);

  await testInfo.attach('large-canvas-metrics.json', {
    body: JSON.stringify({
      modelNodeCount: LARGE_NODE_COUNT,
      renderedNodeCount,
      immediateCloneStats,
      settledCloneStats,
    }),
    contentType: 'application/json',
  });
  if (process.env.NODEFIELD_PERF_LOG === '1') {
    console.log(
      JSON.stringify({ renderedNodeCount, immediateCloneStats, settledCloneStats }),
    );
  }

  expect(renderedNodeCount).toBeGreaterThan(0);
  expect(renderedNodeCount).toBeLessThan(50);
  expect(immediateCloneStats.calls).toBe(0);
  expect(settledCloneStats.calls).toBeGreaterThan(0);
  expect(settledCloneStats.getAllCalls).toBe(0);

  await page.getByRole('textbox', { name: '搜索节点' }).fill('性能节点 599');
  await page.getByRole('option', { name: /性能节点 599/ }).click();
  await expect(page.getByLabel('笔记：性能节点 599')).toBeVisible();
});

async function seedLargeBoard(page: Page) {
  const board = {
    schemaVersion: 1,
    id: 'large-canvas-performance-board',
    title: '大画布性能基准',
    nodes: Array.from({ length: LARGE_NODE_COUNT }, (_, index) => ({
      id: `performance-node-${index}`,
      type: 'card',
      position: {
        x: 48 + (index % 20) * 320,
        y: 72 + Math.floor(index / 20) * 190,
      },
      data: {
        kind: 'note',
        title: `性能节点 ${index}`,
        body: `用于验证大画布运行时表现的节点 ${index}`,
        tags: ['性能'],
      },
    })),
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    updatedAt: '2026-07-15T00:00:00.000Z',
  };

  await page.evaluate(async (document) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('nodefield');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction(['boards', 'meta'], 'readwrite');
    transaction.objectStore('boards').put(document);
    transaction
      .objectStore('meta')
      .put({ key: 'activeBoardId', value: document.id });
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    database.close();
  }, board);
}

async function installCloneProbe(page: Page) {
  await page.evaluate((minimumSize) => {
    const original = globalThis.structuredClone;
    const stats = { calls: 0, duration: 0, getAllCalls: 0 };
    Object.assign(globalThis, { __nodefieldCloneStats: stats });
    globalThis.structuredClone = ((value: unknown, options?: StructuredSerializeOptions) => {
      const tracked = Array.isArray(value) && value.length >= minimumSize;
      const startedAt = performance.now();
      const cloned = original(value, options);
      if (tracked) {
        stats.calls += 1;
        stats.duration += performance.now() - startedAt;
      }
      return cloned;
    }) as typeof structuredClone;

    const originalGetAll = IDBObjectStore.prototype.getAll;
    IDBObjectStore.prototype.getAll = function (...args) {
      stats.getAllCalls += 1;
      return originalGetAll.apply(this, args as Parameters<IDBObjectStore['getAll']>);
    } as IDBObjectStore['getAll'];
  }, LARGE_NODE_COUNT);
}

async function readCloneStats(page: Page) {
  return page.evaluate(() => {
    const stats = (
      globalThis as typeof globalThis & {
        __nodefieldCloneStats: { calls: number; duration: number; getAllCalls: number };
      }
    ).__nodefieldCloneStats;
    return { ...stats };
  });
}
