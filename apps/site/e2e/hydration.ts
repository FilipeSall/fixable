import { expect, type Page } from '@playwright/test';

/** Rola até o formulário e espera o astro-island que o contém terminar de hidratar. */
export async function aguardarHidratacao(page: Page, formSelector: string): Promise<void> {
  await page.locator(formSelector).scrollIntoViewIfNeeded();
  await expect(page.locator(`astro-island:has(${formSelector})`)).not.toHaveAttribute('ssr', /.*/);
}

/** Segura os módulos cujo caminho casa com o padrão até a função devolvida ser chamada, atrasando a hidratação da ilha. */
export async function segurarIlha(page: Page, pattern: RegExp): Promise<() => void> {
  let liberar: () => void = () => undefined;
  const portao = new Promise<void>((resolve) => {
    liberar = resolve;
  });
  await page.route(pattern, async (route) => {
    await portao;
    await route.continue();
  });
  return liberar;
}
