import { expect, test } from '@playwright/test'

test('sākumlapā ir viena poga, kas ved uz burtu rakstīšanu', async ({ page }) => {
  await page.goto('/')

  await expect(page.locator('html')).toHaveAttribute('lang', 'lv')
  await expect(page.getByRole('heading', { level: 1, name: 'Rokraksts' })).toBeVisible()

  await page.getByRole('link', { name: 'Sākt rakstīt' }).click()

  await expect(page).toHaveURL(/\/raksti$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Raksti mazo a' })).toBeVisible()
})

test('sākumlapa neritinās horizontāli', async ({ page }) => {
  await page.goto('/')
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(0)
})
