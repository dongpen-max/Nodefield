import { expect, type Page } from '@playwright/test';

export const STARTER_TITLE = '无限画布融合研究';
export const QUESTION_TITLE = '什么让画布值得信任？';
export const SOURCE_TITLE = 'JSON Canvas 1.0';

export async function openApp(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByLabel(/^切换画布，当前为/)).toBeVisible();
  await expect(page.getByTestId('save-status')).toHaveAttribute('data-state', 'saved');
}

export async function openBoardSwitcher(page: Page): Promise<void> {
  const boardList = page.getByRole('navigation', { name: '画布列表' });
  if (!(await boardList.isVisible())) {
    await page.getByLabel(/^切换画布，当前为/).click();
  }
  await expect(boardList).toBeVisible();
}

export async function waitForAutosave(page: Page): Promise<void> {
  const status = page.getByTestId('save-status');
  await expect(status).toHaveAttribute('data-state', 'saving');
  await expect(status).toHaveAttribute('data-state', 'saved');
}

export function boardSelectButton(page: Page, title: string) {
  return page
    .getByRole('navigation', { name: '画布列表' })
    .getByRole('button', { name: new RegExp(`^${escapeRegExp(title)}`) });
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
