import { expect, type Page } from '@playwright/test';

/** Rola até o formulário e espera o astro-island que o contém terminar de hidratar. */
export async function aguardarHidratacao(page: Page, formSelector: string): Promise<void> {
  await page.locator(formSelector).scrollIntoViewIfNeeded();
  await expect(page.locator(`astro-island:has(${formSelector})`)).not.toHaveAttribute('ssr', /.*/);
}
