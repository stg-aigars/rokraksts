import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { getCharset, requiredChars } from '../../core/charsets'

// 3. posms: variantu ievade, aplis "Uzraksti vēlreiz" un blāvais paraugs. Raksta ar pirkstu,
// tāpēc tikai telefona projektā.

const lv = getCharset('lv')
const sample = lv.sampleText
const letters = [...sample].filter((c) => c !== ' ')

const pad = (page: Page) => page.getByTestId('drawpad')
const preview = (page: Page) => page.getByTestId('preview')
const variants = (page: Page) => page.getByTestId('variants')
const heading = (page: Page, name: string) => page.getByRole('heading', { level: 1, name, exact: true })
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true })
const saved = (page: Page) => expect(page.getByTestId('save-state')).toHaveAttribute('data-state', 'saved')

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
  for (let i = 1; i <= 6; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [at(i / 6)] })
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await cdp.detach()
  await expect(pad(page)).toHaveAttribute('data-strokes', String(before + 1))
}

type Stored = { glyphs: Record<string, number[]>; current: string; variant: number; lap: boolean }

/** No IndexedDB: katrai rakstzīmei vilcienu skaits pa variantiem un atvērtā vieta. */
async function stored(page: Page): Promise<Stored> {
  return page.evaluate(
    () =>
      new Promise<Stored>((resolve, reject) => {
        const open = indexedDB.open('rokraksts')
        open.onerror = () => reject(open.error)
        open.onsuccess = () => {
          const get = open.result.transaction('session').objectStore('session').get('current')
          get.onerror = () => reject(get.error)
          get.onsuccess = () => {
            const session = get.result
            const glyphs: Record<string, number[]> = {}
            for (const [char, glyph] of Object.entries<{ variants: { strokes: unknown[] }[] }>(session.project.glyphs)) {
              glyphs[char] = glyph.variants.map((v) => v.strokes.length)
            }
            resolve({ glyphs, current: session.current, variant: session.variant, lap: session.lap })
            open.result.close()
          }
        }
      }),
  )
}

/** Priekšskatījuma glifi teksta secībā: kuru kontūru katrs lieto un ar kādu novietojumu. */
const uses = (page: Page) =>
  preview(page)
    .locator('use')
    .evaluateAll((list) => list.map((u) => ({ href: u.getAttribute('href')!, transform: u.getAttribute('transform') })))

const definedPaths = (page: Page) => preview(page).locator('defs path')

/** Vietas priekšskatījumā (starp glifiem), kur stāv dotais burts; derīgs, kad viss alfabēts uzrakstīts. */
const positionsOf = (char: string) => letters.flatMap((c, i) => (c === char ? [i] : []))

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'telefons', 'variantu plūsma tikai telefona projektā')
  await page.goto('/raksti')
  await expect(pad(page)).toBeVisible()
})

test('variantu pievieno, pārzīmē un dzēš turpat rakstīšanas plūsmā', async ({ page }) => {
  // Kamēr burts nav uzrakstīts, ir tikai viens tukšs variants un nav ko pievienot vai dzēst.
  await expect(variants(page)).toHaveAttribute('data-count', '0')
  await expect(button(page, 'Pievienot variantu')).toHaveCount(0)
  await expect(button(page, 'Dzēst variantu')).toBeDisabled()

  await touchStroke(page, [0.35, 0.45], [0.6, 0.65])
  await expect(variants(page)).toHaveAttribute('data-count', '1')
  await expect(button(page, '1. variants')).toHaveAttribute('aria-pressed', 'true')
  await expect(definedPaths(page)).toHaveCount(1)

  // Pievienot: laukums ir tukšs; variants parādās ar pirmo vilcienu.
  await button(page, 'Pievienot variantu').click()
  await expect(pad(page)).toHaveAttribute('data-strokes', '0')
  await expect(button(page, '2. variants (jauns)')).toHaveAttribute('aria-pressed', 'true')
  await expect(variants(page)).toHaveAttribute('data-count', '1')
  await touchStroke(page, [0.3, 0.6], [0.7, 0.4])
  await touchStroke(page, [0.7, 0.4], [0.7, 0.65])
  await expect(variants(page)).toHaveAttribute('data-count', '2')
  await expect(page.getByTestId('progress')).toHaveText('1 no 99')

  // Priekšskatījumā burts "a" tagad izmanto abas kontūras pamīšus.
  await expect(definedPaths(page)).toHaveCount(2)
  const refs = (await uses(page)).map((u) => u.href)
  expect(refs.length).toBe(letters.filter((c) => c === 'a').length)
  for (let i = 1; i < refs.length; i++) expect(refs[i]).not.toBe(refs[i - 1])

  // Trešais variants, un tad vairāk pievienot nevar.
  await button(page, 'Pievienot variantu').click()
  await touchStroke(page, [0.4, 0.4], [0.4, 0.65])
  await expect(variants(page)).toHaveAttribute('data-count', '3')
  await expect(button(page, 'Pievienot variantu')).toHaveCount(0)
  await saved(page)
  expect((await stored(page)).glyphs['a']).toEqual([1, 2, 1])

  // Pārzīmēt otro: atver to, notīra un raksta no jauna; tas paliek otrajā vietā.
  await button(page, '2. variants').click()
  await expect(pad(page)).toHaveAttribute('data-strokes', '2')
  await button(page, 'Notīrīt').click()
  await expect(variants(page)).toHaveAttribute('data-count', '2')
  await expect(button(page, '2. variants (jauns)')).toHaveAttribute('aria-pressed', 'true')
  for (let i = 0; i < 3; i++) await touchStroke(page, [0.3 + i * 0.1, 0.4], [0.4 + i * 0.1, 0.65])
  await saved(page)
  expect((await stored(page)).glyphs['a']).toEqual([1, 3, 1])

  // Dzēst otro: paliek pirmais un bijušais trešais.
  await button(page, 'Dzēst variantu').click()
  await expect(variants(page)).toHaveAttribute('data-count', '2')
  await expect(definedPaths(page)).toHaveCount(2)
  await saved(page)
  expect((await stored(page)).glyphs['a']).toEqual([1, 1])

  // Pēc pārlādes varianti un atvērtā vieta ir tie paši.
  const before = await preview(page).innerHTML()
  await page.reload()
  await expect(variants(page)).toHaveAttribute('data-count', '2')
  await expect(button(page, '2. variants')).toHaveAttribute('aria-pressed', 'true')
  expect(await preview(page).innerHTML()).toBe(before)

  // Vienīgo variantu dzēst nevar.
  await button(page, 'Dzēst variantu').click()
  await expect(variants(page)).toHaveAttribute('data-count', '1')
  await expect(button(page, 'Dzēst variantu')).toBeDisabled()
})

test('blāvais paraugs: rakstot ā, fonā var ieslēgt tikko uzrakstīto a; glifā nonāk tikai jaunie vilcieni', async ({ page }) => {
  // Burtam bez pamatburta parauga pogas nav.
  await expect(page.getByRole('button', { name: /^Paraugs/ })).toHaveCount(0)
  await touchStroke(page, [0.35, 0.45], [0.6, 0.65])
  await touchStroke(page, [0.6, 0.45], [0.6, 0.65])
  await button(page, 'Tālāk').click()
  await expect(heading(page, 'Raksti mazo ā')).toBeVisible()

  // Pēc noklusējuma izslēgts.
  const toggle = button(page, 'Paraugs: a')
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByTestId('ghost')).toHaveCount(0)

  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('ghost').locator('path')).toHaveCount(2)
  await expect(page.getByTestId('ghost')).toHaveAttribute('stroke-opacity', '0.16')
  // Paraugs nav vilciens: laukums joprojām ir tukšs un Tālāk nav pieejams.
  await expect(pad(page)).toHaveAttribute('data-strokes', '0')
  await expect(button(page, 'Tālāk')).toBeDisabled()
  const aOnly = await definedPaths(page).evaluateAll((paths) => paths.map((p) => p.getAttribute('d')))
  expect(aOnly).toHaveLength(1)

  // Raksta tikai garumzīmi: glifā "ā" ir viens vilciens, "a" nav mainījies.
  await touchStroke(page, [0.3, 0.3], [0.7, 0.3])
  await saved(page)
  const state = await stored(page)
  expect(state.glyphs).toEqual({ a: [2], ā: [1] })
  const both = await definedPaths(page).evaluateAll((paths) => paths.map((p) => p.getAttribute('d')))
  expect(both).toHaveLength(2)
  // Kontūras ir pirmās parādīšanās secībā tekstā; "a" kontūra ir tā pati, kas pirms tam.
  expect(both).toContain(aOnly[0])

  // Izvēle saglabājas pēc pārlādes un nākamajam burtam ar zīmi; burtam bez pamatburta pogas nav.
  await page.reload()
  await expect(button(page, 'Paraugs: a')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('ghost').locator('path')).toHaveCount(2)
  await button(page, 'Tālāk').click()
  await expect(heading(page, 'Raksti mazo b')).toBeVisible()
  await expect(page.getByRole('button', { name: /^Paraugs/ })).toHaveCount(0)
  await expect(page.getByTestId('ghost')).toHaveCount(0)

  // č: pamatburts c vēl nav uzrakstīts, kamēr neesam tam tikuši cauri.
  await touchStroke(page, [0.4, 0.3], [0.4, 0.65])
  await button(page, 'Tālāk').click()
  await touchStroke(page, [0.6, 0.4], [0.4, 0.6])
  await button(page, 'Tālāk').click()
  await expect(heading(page, 'Raksti mazo č')).toBeVisible()
  await expect(page.getByTestId('ghost').locator('path')).toHaveCount(1)
  await button(page, 'Paraugs: c').click()
  await expect(page.getByTestId('ghost')).toHaveCount(0)
})

test('pēc 33 burtiem piedāvā apli "Uzraksti vēlreiz"; pangramma attēlojas pilnībā ar dažādiem variantiem', async ({ page }) => {
  test.slow()
  const alphabet = requiredChars(lv)
  await expect(page.getByTestId('lap')).toHaveCount(0)

  for (const [i, char] of alphabet.entries()) {
    await expect(heading(page, `Raksti mazo ${char}`)).toBeVisible()
    // Katram burtam cits vilciens, lai kontūras atšķirtos.
    await touchStroke(page, [0.25 + (i % 5) * 0.05, 0.4], [0.5 + (i % 7) * 0.04, 0.55 + (i % 3) * 0.05])
    if (i < alphabet.length - 1) {
      await expect(page.getByTestId('lap')).toHaveCount(0)
      await button(page, 'Tālāk').click()
    }
  }

  // Pangramma attēlojas pilnībā: neviena tukša rāmīša.
  await expect(page.getByTestId('progress')).toHaveText('33 no 99')
  await expect(preview(page)).toHaveAttribute('data-missing', '0')
  await expect(preview(page).locator('rect')).toHaveCount(0)
  await expect(preview(page).locator('use')).toHaveCount(letters.length)
  const single = await uses(page)
  // Trice: glifi novietoti ar matricu, un ne visi vienādi pagriezti.
  for (const u of single) expect(u.transform).toMatch(/^matrix\((-?\d(\.\d{1,3})? ){4}-?\d+ -?\d+\)$/)
  expect(new Set(single.map((u) => u.transform!.split(' ').slice(0, 2).join(' '))).size).toBeGreaterThan(10)

  // Aplis sākas ar biežākajiem burtiem un katram atver jaunu variantu.
  await expect(page.getByTestId('lap')).toHaveAttribute('data-active', 'false')
  await button(page, 'Uzraksti vēlreiz').click()
  await expect(page.getByTestId('lap')).toHaveAttribute('data-active', 'true')
  for (const char of lv.frequentChars.slice(0, 3)) {
    await expect(heading(page, `Raksti mazo ${char}`)).toBeVisible()
    await expect(pad(page)).toHaveAttribute('data-strokes', '0')
    await expect(button(page, '2. variants (jauns)')).toHaveAttribute('aria-pressed', 'true')
    await touchStroke(page, [0.7, 0.35], [0.3, 0.6])
    await touchStroke(page, [0.3, 0.6], [0.7, 0.65])
    await button(page, 'Tālāk').click()
  }
  // Ceturto burtu izlaiž, tad atgriežas labot trešo un apli pārtrauc.
  const [, , third, fourth, fifth] = lv.frequentChars
  await expect(heading(page, `Raksti mazo ${fourth}`)).toBeVisible()
  await button(page, 'Tālāk').click()
  await expect(heading(page, `Raksti mazo ${fifth}`)).toBeVisible()
  await button(page, 'Atpakaļ').click()
  await button(page, 'Atpakaļ').click()
  await expect(heading(page, `Raksti mazo ${third}`)).toBeVisible()
  await expect(button(page, '2. variants')).toHaveAttribute('aria-pressed', 'true')
  await expect(pad(page)).toHaveAttribute('data-strokes', '2')

  // Atkārtoti burti priekšskatījumā vairs nav vienādi: secīgi "a" un "i" lieto dažādas kontūras.
  // "a" un "i" tekstā atkārtojas un lieto abus variantus; "s" ir tikai vienreiz.
  await expect(definedPaths(page)).toHaveCount(alphabet.length + 2)
  const mixed = (await uses(page)).map((u) => u.href)
  for (const char of ['a', 'i']) {
    const refs = positionsOf(char).map((i) => mixed[i])
    expect(refs.length).toBeGreaterThan(1)
    for (let i = 1; i < refs.length; i++) expect(refs[i], char).not.toBe(refs[i - 1])
  }
  // Burtiem, kam variantu nav vairāk, kontūra un trice (rotācija, mērogs) paliek tā pati;
  // mainās tikai vieta rindā, jo jaunie varianti ir cita platuma. Priekšskatījums nelēkā.
  const after = await uses(page)
  const shake = (u: { transform: string | null }) => u.transform!.split(' ').slice(0, 4).join(' ')
  for (const i of positionsOf('ū')) {
    expect(after[i]!.href).toBe(single[i]!.href)
    expect(shake(after[i]!)).toBe(shake(single[i]!))
  }

  await button(page, 'Beigt apli').click()
  await expect(heading(page, 'Raksti mazo q')).toBeVisible()
  await expect(page.getByTestId('lap')).toHaveAttribute('data-active', 'false')
  await saved(page)
  const state = await stored(page)
  expect(state.lap).toBe(false)
  expect(state.glyphs['a']).toEqual([1, 2])
  expect(state.glyphs['i']).toEqual([1, 2])
  expect(state.glyphs['s']).toEqual([1, 2])
  expect(state.glyphs['e']).toEqual([1])

  // Lapa joprojām ietilpst ekrānā arī ar apļa joslu.
  const overflow = await page.evaluate(() => document.documentElement.scrollHeight - document.documentElement.clientHeight)
  expect(overflow).toBeLessThanOrEqual(0)
  expect((await pad(page).boundingBox())!.width).toBeGreaterThan(250)
})
