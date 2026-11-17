import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { allChars, getCharset } from '../../core/charsets'
import { variantStart } from '../../core/variants'

// 4. posms: trūkstošās zīmes no lietotāja teksta, stils (biezums, atstarpes, izmērs, slīpums),
// pārskats pār visu kopu un pārzīmēšana ar vienu pieskārienu. Raksta ar pirkstu, tāpēc tikai
// telefona projektā.

const lv = getCharset('lv')

const pad = (page: Page) => page.getByTestId('drawpad')
const preview = (page: Page) => page.getByTestId('preview')
const heading = (page: Page, name: string) => page.getByRole('heading', { level: 1, name, exact: true })
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true })
const saved = (page: Page) => expect(page.getByTestId('save-state')).toHaveAttribute('data-state', 'saved')
const textInput = (page: Page) => page.getByTestId('text-input')
const cell = (page: Page, char: string) => page.locator(`[data-testid="glyph-cell"][data-char="${char}"]`)

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

/** No IndexedDB: uzrakstītās rakstzīmes, lietotāja teksts un stils. */
async function stored(page: Page) {
  return page.evaluate(
    () =>
      new Promise<{ chars: string[]; text: string; style: Record<string, number> }>((resolve, reject) => {
        const open = indexedDB.open('rokraksts')
        open.onerror = () => reject(open.error)
        open.onsuccess = () => {
          const get = open.result.transaction('session').objectStore('session').get('current')
          get.onerror = () => reject(get.error)
          get.onsuccess = () => {
            const session = get.result
            resolve({ chars: Object.keys(session.project.glyphs), text: session.text, style: session.project.style })
            open.result.close()
          }
        }
      }),
  )
}

const outlines = (page: Page) => preview(page).locator('defs path').evaluateAll((paths) => paths.map((p) => p.getAttribute('d')))
const placements = (page: Page) => preview(page).locator('use').evaluateAll((list) => list.map((u) => u.getAttribute('transform')))

/** Vai katrs glifs priekšskatījumā pilnībā ietilpst SVG attēlā (viewBox) ekrāna koordinātās. */
async function everyGlyphInside(page: Page) {
  return preview(page)
    .locator('svg')
    .evaluate((svg: SVGSVGElement) => {
      const [, , w, h] = svg.getAttribute('viewBox')!.split(' ').map(Number)
      const m = svg.getScreenCTM()!
      const frame = { left: m.e, top: m.f, right: m.a * w! + m.e, bottom: m.d * h! + m.f }
      return [...svg.querySelectorAll('use')].every((use) => {
        const box = use.getBoundingClientRect()
        return (
          box.left >= frame.left - 0.5 &&
          box.top >= frame.top - 0.5 &&
          box.right <= frame.right + 0.5 &&
          box.bottom <= frame.bottom + 0.5
        )
      })
    })
}

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'telefons', '4. posma plūsmas tikai telefona projektā')
  await page.goto('/raksti')
  await expect(pad(page)).toBeVisible()
})

test('trūkstošās zīmes: teksts atver rakstīšanu tieši tām; Ā netiek aizstāts ne ar A, ne ar ā', async ({ page }) => {
  await touchStroke(page, [0.35, 0.45], [0.6, 0.65])
  await button(page, 'Teksts un stils').click()

  await textInput(page).fill('Aā a!')
  const missing = page.getByTestId('missing')
  await expect(missing).toHaveAttribute('data-count', '3')
  await expect(missing).toContainText('Trūkst 3 zīmes: A ā !')
  await expect(preview(page)).toHaveAttribute('data-glyphs', '1')
  await expect(preview(page)).toHaveAttribute('data-missing', '3')

  // "Uzrakstīt" atver rakstīšanu tieši trūkstošajām zīmēm teksta secībā.
  await button(page, 'Uzrakstīt').click()
  const queue = page.getByTestId('queue')
  await expect(heading(page, 'Raksti lielo A')).toBeVisible()
  await expect(queue).toContainText('Trūkstošās zīmes: 1 no 3')
  await touchStroke(page, [0.3, 0.7], [0.5, 0.2])
  await button(page, 'Tālāk').click()

  await expect(heading(page, 'Raksti mazo ā')).toBeVisible()
  await expect(queue).toContainText('2 no 3')
  await expect(page.getByTestId('ghost')).toBeVisible()
  await touchStroke(page, [0.35, 0.45], [0.6, 0.65])
  await touchStroke(page, [0.3, 0.3], [0.7, 0.3])
  await button(page, 'Tālāk').click()

  await expect(heading(page, 'Raksti izsaukuma zīmi')).toBeVisible()
  await expect(button(page, 'Izlaist')).toBeVisible()
  await touchStroke(page, [0.5, 0.2], [0.5, 0.6])
  // Pēdējā zīme: poga pabeidz rindu un atgriežas pie teksta, kas tagad ir pilns.
  await button(page, 'Gatavs').click()
  await expect(textInput(page)).toHaveValue('Aā a!')
  await expect(missing).toHaveCount(0)
  await expect(preview(page)).toHaveAttribute('data-missing', '0')
  await expect(preview(page).locator('rect')).toHaveCount(0)
  await expect(page.getByTestId('progress')).toHaveText('4 no 99')

  // "Ā" nav uzrakstīts: tas paliek tukšs rāmītis, lai arī ir gan "A", gan "ā".
  await textInput(page).fill('ĀAā')
  await expect(missing).toContainText('Trūkst 1 zīme: Ā')
  await expect(preview(page)).toHaveAttribute('data-glyphs', '2')
  await expect(preview(page)).toHaveAttribute('data-missing', '1')
  await saved(page)
  expect((await stored(page)).chars).toEqual(['a', 'A', 'ā', '!'])

  // Zīmes ārpus kopas uzrakstīt nevar, un tās nosauc atsevišķi.
  await textInput(page).fill('a@')
  await expect(missing).toHaveCount(0)
  await expect(page.getByTestId('unsupported')).toContainText('@')

  // Teksts paliek ierīcē arī pēc pārlādes.
  await textInput(page).fill('Ā!')
  await saved(page)
  await page.reload()
  await button(page, 'Teksts un stils').click()
  await expect(textInput(page)).toHaveValue('Ā!')
  await expect(missing).toContainText('Trūkst 1 zīme: Ā')

  // Rindu var arī pārtraukt: atgriežas pie teksta, zīme paliek neuzrakstīta.
  await button(page, 'Uzrakstīt').click()
  await expect(heading(page, 'Raksti lielo Ā')).toBeVisible()
  await button(page, 'Beigt').click()
  await expect(missing).toContainText('Ā')
})

test('stils: biezums, atstarpes, izmērs un slīpums uzreiz redzami; nekas netiek nogriezts; saglabājas', async ({ page }) => {
  // Uzraksta a, ā un ķ (zīme apakšā), tad tekstā liek tos vairākkārt.
  await touchStroke(page, [0.35, 0.45], [0.6, 0.65])
  await button(page, 'Tālāk').click()
  await touchStroke(page, [0.35, 0.45], [0.6, 0.65])
  await touchStroke(page, [0.3, 0.2], [0.7, 0.2])
  await button(page, 'Visas zīmes').click()
  await cell(page, 'ķ').click()
  await touchStroke(page, [0.35, 0.15], [0.35, 0.65])
  await touchStroke(page, [0.5, 0.75], [0.45, 0.9])
  await button(page, 'Teksts un stils').click()
  await textInput(page).fill('aāķ ķāa aāķ ķāa aāķ')
  await expect(preview(page)).toHaveAttribute('data-missing', '0')
  expect(await everyGlyphInside(page)).toBe(true)

  const changes: [string, string][] = [
    ['strokeWidth', '1.8'],
    ['spacing', '0.04'],
    ['scale', '1.25'],
    ['slant', '0.35'],
  ]
  for (const [key, value] of changes) {
    const before = { paths: await outlines(page), places: await placements(page) }
    await page.getByTestId(`style-${key}`).fill(value)
    // Stila maiņa uzreiz pārrēķina priekšskatījumu.
    await expect.poll(async () => JSON.stringify({ paths: await outlines(page), places: await placements(page) })).not.toBe(
      JSON.stringify(before),
    )
    expect(await everyGlyphInside(page), key).toBe(true)
  }
  // Slīpumu rāda aptuvenos grādos.
  await expect(page.getByText('19°')).toBeVisible()
  // Atpakaļ uz otru galu: slīpums pa kreisi, mazs un plāns.
  for (const [key, value] of [
    ['slant', '-0.2'],
    ['scale', '0.8'],
    ['strokeWidth', '0.5'],
  ] as const) {
    await page.getByTestId(`style-${key}`).fill(value)
    await expect(page.getByTestId(`style-${key}`)).toHaveValue(value)
  }
  await expect.poll(() => everyGlyphInside(page)).toBe(true)

  await saved(page)
  expect((await stored(page)).style).toEqual({ strokeWidth: 0.5, spacing: 0.04, slant: -0.2, scale: 0.8 })
  const html = await preview(page).innerHTML()
  await page.reload()
  await button(page, 'Teksts un stils').click()
  await expect(page.getByTestId('style-slant')).toHaveValue('-0.2')
  await expect.poll(() => preview(page).innerHTML()).toBe(html)
})

test('visas zīmes: režģis rāda 99 zīmes pa grupām; viens pieskāriens atver zīmi pārzīmēšanai', async ({ page }) => {
  await touchStroke(page, [0.35, 0.45], [0.6, 0.65])
  await button(page, 'Pievienot variantu').click()
  await touchStroke(page, [0.3, 0.6], [0.7, 0.4])
  await touchStroke(page, [0.7, 0.4], [0.7, 0.65])

  await button(page, 'Visas zīmes').click()
  await expect(page.getByTestId('glyph-cell')).toHaveCount(99)
  await expect(page.getByTestId('group-progress-lower')).toHaveText('1 no 33')
  await expect(page.getByTestId('group-progress-upper')).toHaveText('0 no 37')
  await expect(cell(page, 'a')).toHaveAttribute('data-variants', '2')
  await expect(cell(page, 'a').locator('svg path')).toHaveCount(1)
  await expect(cell(page, 'Ķ')).toHaveAttribute('data-variants', '0')

  // Lielais Ķ: blāvais paraugs ar komatu zem pamatlīnijas.
  await cell(page, 'Ķ').click()
  await expect(heading(page, 'Raksti lielo Ķ')).toBeVisible()
  const guide = page.getByTestId('ghost').locator('path')
  await expect(guide).toHaveCount(lv.guides['Ķ']!.length)
  const baseline = (await pad(page).locator('[data-line="baseline"]').boundingBox())!.y
  expect((await guide.last().boundingBox())!.y).toBeGreaterThan(baseline)
  await touchStroke(page, [0.35, 0.15], [0.35, 0.65])
  await expect(page.getByTestId('progress')).toHaveText('2 no 99')

  // Lielais Ā: garumzīme ir brīvajā joslā virs augšējās līnijas.
  await button(page, 'Visas zīmes').click()
  await expect(page.getByTestId('group-progress-upper')).toHaveText('1 no 37')
  await cell(page, 'Ā').click()
  const ascender = (await pad(page).locator('[data-line="ascender"]').boundingBox())!.y
  const mark = (await page.getByTestId('ghost').locator('path').last().boundingBox())!
  expect(mark.y + mark.height).toBeLessThan(ascender)

  // Pieskāriens uzrakstītai zīmei režģī atver to ar vilcieniem, gatavu pārzīmēšanai.
  await button(page, 'Visas zīmes').click()
  await cell(page, 'a').click()
  await expect(heading(page, 'Raksti mazo a')).toBeVisible()
  await expect(button(page, '1. variants')).toHaveAttribute('aria-pressed', 'true')
  await expect(pad(page)).toHaveAttribute('data-strokes', '1')

  // Pieskāriens tukšam rāmītim priekšskatījumā atver tieši šo zīmi (parauga teksts sākas ar "g").
  const frame = (await preview(page).locator('rect').first().boundingBox())!
  await page.mouse.click(frame.x + frame.width / 2, frame.y + frame.height / 2)
  await expect(heading(page, 'Raksti mazo g')).toBeVisible()

  // Pieskāriens glifam priekšskatījumā atver tieši to variantu, kas tur stāv.
  const first = (await preview(page).locator('use').first().boundingBox())!
  await page.mouse.click(first.x + first.width / 2, first.y + first.height * 0.6)
  await expect(heading(page, 'Raksti mazo a')).toBeVisible()
  const expected = variantStart(1, 'a') % 2
  await expect(button(page, `${expected + 1}. variants`)).toHaveAttribute('aria-pressed', 'true')
  await expect(pad(page)).toHaveAttribute('data-strokes', expected === 0 ? '1' : '2')
  // Pārzīmē: notīra un uzraksta no jauna; variantu skaits paliek.
  await button(page, 'Notīrīt').click()
  await touchStroke(page, [0.4, 0.3], [0.5, 0.65])
  await expect(page.getByTestId('variants')).toHaveAttribute('data-count', '2')
  expect(allChars(lv)).toHaveLength(99)
})

test('rakstot lielos burtus, ciparus un pieturzīmes, priekšskatījums rāda tās grupas paraugu', async ({ page }) => {
  const label = preview(page).locator('svg')
  const count = (text: string, char: string) => [...text].filter((c) => c === char).length

  // Mazajiem burtiem: mazo burtu pangramma.
  await expect(label).toHaveAttribute('aria-label', lv.sampleText)

  await button(page, 'Visas zīmes').click()
  await cell(page, 'Ķ').click()
  await expect(label).toHaveAttribute('aria-label', lv.groupSamples.upper)
  await touchStroke(page, [0.35, 0.15], [0.35, 0.65])
  await expect(preview(page)).toHaveAttribute('data-glyphs', String(count(lv.groupSamples.upper, 'Ķ')))

  await button(page, 'Visas zīmes').click()
  await cell(page, '3').click()
  await expect(label).toHaveAttribute('aria-label', lv.groupSamples.digits)
  await touchStroke(page, [0.35, 0.2], [0.6, 0.6])
  await expect(preview(page)).toHaveAttribute('data-glyphs', '1')

  await button(page, 'Visas zīmes').click()
  await cell(page, '♥').click()
  await expect(label).toHaveAttribute('aria-label', lv.groupSamples.punctuation)
  await touchStroke(page, [0.35, 0.2], [0.6, 0.6])
  await expect(preview(page)).toHaveAttribute('data-glyphs', '1')

  // Savs teksts ar šo zīmi: priekšskatījums rāda to.
  await button(page, 'Teksts un stils').click()
  await textInput(page).fill('Ķ ♥')
  await button(page, 'Rakstīt burtus').click()
  await expect(label).toHaveAttribute('aria-label', 'Ķ ♥')
  await expect(preview(page)).toHaveAttribute('data-missing', '0')
})
