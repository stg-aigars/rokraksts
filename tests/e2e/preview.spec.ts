import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { getCharset } from '../../core/charsets'

// Dzīvais priekšskatījums zem zīmēšanas laukuma (2. posms). Raksta ar pirkstu, tāpēc tikai
// telefona projektā.

const sample = getCharset('lv').sampleText
const letters = [...sample].filter((c) => c !== ' ')
const count = (char: string) => letters.filter((c) => c === char).length

const pad = (page: Page) => page.getByTestId('drawpad')
const preview = (page: Page) => page.getByTestId('preview')
const heading = (page: Page, name: string) => page.getByRole('heading', { level: 1, name, exact: true })
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true })

/** Novelk vienu vilcienu ar pirkstu (CDP skāriena notikumi); koordinātas ir laukuma daļas (0..1). */
async function touchStroke(page: Page, from: [number, number], to: [number, number]) {
  const box = (await pad(page).boundingBox())!
  const at = (f: number) => ({
    x: Math.round(box.x + box.width * (from[0] + (to[0] - from[0]) * f)),
    y: Math.round(box.y + box.height * (from[1] + (to[1] - from[1]) * f)),
  })
  const before = Number(await pad(page).getAttribute('data-strokes'))
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [at(0)] })
  for (let i = 1; i <= 10; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [at(i / 10)] })
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await cdp.detach()
  await expect(pad(page)).toHaveAttribute('data-strokes', String(before + 1))
}

/** Priekšskatījumā ir tik glifu un tik tukšu rāmīšu. */
async function expectPreview(page: Page, glyphs: number) {
  await expect(preview(page)).toHaveAttribute('data-glyphs', String(glyphs))
  await expect(preview(page).locator('use')).toHaveCount(glyphs)
  await expect(preview(page).locator('rect')).toHaveCount(letters.length - glyphs)
}

const outlines = (page: Page) => preview(page).locator('defs path').evaluateAll((paths) => paths.map((p) => p.getAttribute('d')))

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'telefons', 'priekšskatījuma plūsma tikai telefona projektā')
  await page.goto('/raksti')
  await expect(pad(page)).toBeVisible()
})

test('priekšskatījums ir zem laukuma, un sākumā visas rakstzīmes ir tukši rāmīši', async ({ page }) => {
  await expect(preview(page)).toBeVisible()
  await expect(preview(page).locator('svg')).toHaveAttribute('aria-label', sample)
  await expectPreview(page, 0)

  const padBox = (await pad(page).boundingBox())!
  const previewBox = (await preview(page).boundingBox())!
  expect(previewBox.y).toBeGreaterThanOrEqual(padBox.y + padBox.height)
  // Laukums joprojām ir pietiekami liels rakstīšanai ar pirkstu, un lapa neritinās.
  expect(padBox.width).toBeGreaterThan(250)
  const overflow = await page.evaluate(() => document.documentElement.scrollHeight - document.documentElement.clientHeight)
  expect(overflow).toBeLessThanOrEqual(0)
})

test('priekšskatījums atjaunojas pēc katra vilciena, Atsaukt un Notīrīt', async ({ page }) => {
  await touchStroke(page, [0.35, 0.45], [0.6, 0.65])
  await expectPreview(page, count('a'))
  const [afterFirst] = await outlines(page)
  expect(afterFirst).toMatch(/^M-?\d+ -?\d+[LC]/)

  // Otrs vilciens maina tā paša burta kontūru; glifu skaits paliek.
  await touchStroke(page, [0.6, 0.45], [0.6, 0.65])
  await expectPreview(page, count('a'))
  const [afterSecond] = await outlines(page)
  expect(afterSecond).not.toBe(afterFirst)

  await button(page, 'Atsaukt').click()
  expect(await outlines(page)).toEqual([afterFirst])

  await button(page, 'Notīrīt').click()
  await expectPreview(page, 0)
})

test('neuzrakstīts ā netiek aizstāts ar a; katrs burts parādās tikai pēc uzrakstīšanas', async ({ page }) => {
  await touchStroke(page, [0.35, 0.45], [0.6, 0.65])
  await button(page, 'Tālāk').click()
  await expect(heading(page, 'Raksti mazo ā')).toBeVisible()

  // "a" ir uzrakstīts, "ā" vēl nav: priekšskatījumā ir tikai "a", "ā" vietā rāmīši.
  expect(count('ā')).toBeGreaterThan(0)
  await expectPreview(page, count('a'))
  expect(await outlines(page)).toHaveLength(1)

  await touchStroke(page, [0.3, 0.3], [0.7, 0.3])
  await expectPreview(page, count('a') + count('ā'))
  const [a, macron] = await outlines(page)
  expect(macron).not.toBe(a)
})

test('pēc pārlādes priekšskatījums ir tāds pats', async ({ page }) => {
  await touchStroke(page, [0.35, 0.45], [0.6, 0.65])
  await touchStroke(page, [0.6, 0.45], [0.6, 0.65])
  await expect(page.getByTestId('save-state')).toHaveAttribute('data-state', 'saved')
  const before = await preview(page).innerHTML()

  await page.reload()

  await expectPreview(page, count('a'))
  expect(await preview(page).innerHTML()).toBe(before)
})
