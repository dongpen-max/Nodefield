import { expect, test } from '@playwright/test';
import {
  QUESTION_TITLE,
  STARTER_TITLE,
  boardSelectButton,
  openApp,
  openBoardSwitcher,
  waitForAutosave,
} from './helpers';

test('keeps the workspace and inspector within every target viewport', async (
  { page },
  testInfo,
) => {
  const mobile = testInfo.project.name === 'mobile-chromium';

  await openApp(page);
  await expect(page.getByRole('navigation', { name: '画布工具' })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.getByRole('textbox', { name: '搜索节点' }).fill(QUESTION_TITLE);
  await page.getByRole('option', { name: new RegExp(QUESTION_TITLE) }).click();

  const inspector = page.getByLabel('节点检查器');
  await expect(inspector).toBeVisible();
  await inspector.evaluate(async (element) => {
    await Promise.all(
      element.getAnimations().map((animation) => animation.finished.catch(() => undefined)),
    );
  });
  const inspectorBox = await inspector.boundingBox();
  expect(inspectorBox).not.toBeNull();
  const selectedCardBox = await page.getByLabel(`笔记：${QUESTION_TITLE}`).boundingBox();
  expect(selectedCardBox).not.toBeNull();

  if (mobile) {
    expect(inspectorBox!.width).toBeGreaterThanOrEqual(389);
    expect(inspectorBox!.x).toBeLessThanOrEqual(1);
    expect(inspectorBox!.y).toBeGreaterThan(400);
    expect(inspectorBox!.y + inspectorBox!.height).toBeLessThanOrEqual(845);
    expect(selectedCardBox!.y + selectedCardBox!.height).toBeLessThanOrEqual(
      inspectorBox!.y + 1,
    );
    await expect(page.getByRole('navigation', { name: '画布工具' })).toBeHidden();
    await testInfo.attach('nodefield-390x844-inspector.png', {
      body: await page.screenshot({ animations: 'disabled' }),
      contentType: 'image/png',
    });

    await inspector.getByRole('button', { name: '关闭检查器' }).click();
    await page.getByRole('button', { name: '添加笔记' }).click();
    await page
      .getByLabel('节点检查器')
      .getByRole('button', { name: '关闭检查器' })
      .click();
    await page.getByLabel('文件菜单').click();
    const mobileUndo = page.getByRole('button', { name: '撤销' });
    await expect(mobileUndo).toBeEnabled();
    await mobileUndo.click();
    await expect(page.getByLabel('笔记：未命名笔记')).toHaveCount(0);

    await openBoardSwitcher(page);
    await page.getByRole('button', { name: '新建画布' }).click();
    await openBoardSwitcher(page);
    await page.getByLabel('当前画布名称').fill('手机 E2E 画布');
    await waitForAutosave(page);

    await openBoardSwitcher(page);
    await boardSelectButton(page, STARTER_TITLE).click();
    await expect(page.getByLabel(new RegExp(`^切换画布，当前为${STARTER_TITLE}`))).toBeVisible();

    await openBoardSwitcher(page);
    await boardSelectButton(page, '手机 E2E 画布').click();
    await expect(page.getByLabel(/^切换画布，当前为手机 E2E 画布/)).toBeVisible();
  } else {
    const viewport = page.viewportSize();
    expect(viewport).not.toBeNull();
    expect(inspectorBox!.width).toBeGreaterThanOrEqual(319);
    expect(inspectorBox!.width).toBeLessThanOrEqual(321);
    expect(inspectorBox!.x + inspectorBox!.width).toBeGreaterThanOrEqual(
      viewport!.width - 1,
    );
    expect(selectedCardBox!.x + selectedCardBox!.width).toBeLessThanOrEqual(
      inspectorBox!.x + 1,
    );
    expect(inspectorBox!.y).toBe(56);
  }

  await expectNoHorizontalOverflow(page);
  await testInfo.attach(`nodefield-${testInfo.project.name}.png`, {
    body: await page.screenshot({ animations: 'disabled' }),
    contentType: 'image/png',
  });
});

async function expectNoHorizontalOverflow(page: import('@playwright/test').Page): Promise<void> {
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    return Math.max(0, root.scrollWidth - root.clientWidth);
  });
  expect(overflow).toBeLessThanOrEqual(1);
}
