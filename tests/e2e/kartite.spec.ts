import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { createProject, createSession } from '../../core/project'
import type { Session } from '../../core/project'
import type { FontProject, Stroke } from '../../core/types'

// 5. posms: kartītes redaktors, foni, formāti, tinte, līdzinājums, "Sajaukt", PNG un nosūtīšana.
// Fontu ieliek IndexedDB no etalona vilcieniem; trūkstošās zīmes raksta ar pirkstu, tāpēc viss
// tikai telefona projektā.

const GREETING = 'Daudz laimes 30. dzimšanas dienā, Mārīt! ♥'

// Etalona vilcieni (tests/fixtures/strokes.json) ar visiem variantiem; tāpat kā fixtureProject.
const data = JSON.parse(readFileSync(new URL('../fixtures/strokes.json', import.meta.url), 'utf8')) as {
  glyphs: Record<string, Stroke[]>
  variants: Record<string, Stroke[][]>
  more: [string, Stroke[]][]
}
const lowercase = Object.keys(data.glyphs)
const fixtureAll = [...lowercase, ...data.more.map(([char]) => char)]
const strokesOf = (char: string) => data.glyphs[char] ?? data.more.find(([c]) => c === char)![1]

function fixtureProject(chars: readonly string[]): FontProject {
  const project = createProject('etalons', '2026-11-16T00:00:00.000Z')
  for (const char of chars) {
    project.glyphs[char] = { char, variants: [strokesOf(char), ...(data.variants[char] ?? [])].map((strokes) => ({ strokes })) }
  }
  return project
}

const card = (page: Page) => page.getByTestId('card')
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true })
const saved = (page: Page) => expect(page.getByTestId('save-state')).toHaveAttribute('data-state', 'saved')

/** Sesija ar etalona glifiem un tekstu tieši IndexedDB (tā pati datubāze, ko lieto lietotne). */
async function seed(page: Page, chars: readonly string[], text: string) {
  const session: Session = { ...createSession('e2e', '2026-11-20T00:00:00.000Z'), project: fixtureProject(chars), text }
  await page.goto('/')
  await page.evaluate(
    (value) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('rokraksts', 1)
        open.onupgradeneeded = () => open.result.createObjectStore('session')
        open.onerror = () => reject(open.error)
        open.onsuccess = () => {
          const tx = open.result.transaction('session', 'readwrite')
          tx.objectStore('session').put(value, 'current')
          tx.oncomplete = () => {
            open.result.close()
            resolve()
          }
          tx.onerror = () => reject(tx.error)
        }
      }),
    JSON.parse(JSON.stringify(session)),
  )
  await page.goto('/kartite')
  await expect(card(page)).toBeVisible()
}

/** PNG platums un augstums no IHDR galvenes. */
function pngSize(bytes: Uint8Array) {
  expect([...bytes.slice(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
  const view = new DataView(bytes.buffer, bytes.byteOffset)
  return { width: view.getUint32(16), height: view.getUint32(20) }
}

const uses = (page: Page) => card(page).locator('use').evaluateAll((list) => list.map((u) => u.getAttribute('transform')))

test.beforeEach(async ({}, testInfo) => {
  test.skip(testInfo.project.name !== 'telefons', '5. posma plūsmas tikai telefona projektā')
})

test('kartīte no sava teksta: formāts, fons, tinte, līdzinājums un "Sajaukt"; iestatījumi saglabājas', async ({ page }) => {
  await seed(page, fixtureAll, GREETING)
  const glyphCount = String([...GREETING].filter((c) => c !== ' ').length)
  await expect(card(page)).toHaveAttribute('data-glyphs', glyphCount)
  await expect(card(page)).toHaveAttribute('data-missing', '0')
  await expect(page.getByTestId('card-status')).toHaveAttribute('data-problem', '')
  await expect(button(page, 'Sūtīt kā attēlu')).toBeEnabled()
  await expect(page.getByTestId('alt-text')).toHaveText(GREETING)
  await expect(card(page).locator('svg')).toHaveAttribute('aria-label', GREETING)
  await expect(card(page).locator('svg')).toHaveAttribute('viewBox', '0 0 1080 1080')
  // Burtu izmērs nekad nav mazāks par 28 px pie 1080 px platuma.
  expect(Number(await card(page).getAttribute('data-em'))).toBeGreaterThanOrEqual(28)

  // Formāts.
  await button(page, 'Stāsts').click()
  await expect(card(page)).toHaveAttribute('data-format', 'story')
  await expect(card(page).locator('svg')).toHaveAttribute('viewBox', '0 0 1080 1920')

  // Tumšs fons: tumšā tinte vairs nav salasāma, tāpēc tā nomainās un nav piedāvāta.
  await page.locator('[data-testid="template"][data-template="nakts"]').click()
  await expect(card(page)).toHaveAttribute('data-template', 'nakts')
  await expect(card(page)).toHaveAttribute('data-ink', '#ffffff')
  await expect(page.locator('[data-testid="ink"][data-ink="#1d2433"]')).toHaveCount(0)
  await page.getByRole('button', { name: 'Zelta' }).click()
  await expect(card(page)).toHaveAttribute('data-ink', '#f6e7b0')
  await expect(card(page).locator('svg g[fill="#f6e7b0"]')).toHaveCount(1)

  // Līdzinājums.
  await button(page, 'Pa kreisi').click()
  await expect(card(page)).toHaveAttribute('data-align', 'left')

  // "Sajaukt" maina sēklu un līdz ar to trici; teksts paliek tas pats.
  const before = await uses(page)
  const seedBefore = await card(page).getAttribute('data-seed')
  await button(page, 'Sajaukt').click()
  await expect(card(page)).not.toHaveAttribute('data-seed', seedBefore!)
  await expect.poll(() => uses(page)).not.toEqual(before)
  await expect(card(page)).toHaveAttribute('data-glyphs', glyphCount)

  // Pārlādējot viss saglabājies un kartīte ir tā pati (deterministiski).
  const svg = await card(page).innerHTML()
  await saved(page)
  await page.reload()
  await expect(card(page)).toHaveAttribute('data-format', 'story')
  await expect(card(page)).toHaveAttribute('data-ink', '#f6e7b0')
  await expect(card(page)).toHaveAttribute('data-align', 'left')
  expect(await card(page).innerHTML()).toBe(svg)
})

test('PNG: formāta izmērs, zem 1 MB, un tas pats attēls kā priekšskatījums', async ({ page }) => {
  await seed(page, fixtureAll, `${GREETING}\nTavs draugs`)
  await button(page, 'Stāsts').click()
  await page.locator('[data-testid="template"][data-template="egle"]').click()
  await expect(card(page)).toHaveAttribute('data-template', 'egle')

  const downloading = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Lejupielādēt attēlu' }).click()
  const file = await downloading
  expect(file.suggestedFilename()).toBe('apsveikums.png')
  const bytes = new Uint8Array(await readFile((await file.path())!))
  expect(pngSize(bytes)).toEqual({ width: 1080, height: 1920 })
  expect(bytes.length).toBeLessThan(1024 * 1024)
  await expect(page.getByTestId('notice')).toContainText('lejupielādēts')

  // Canvas attēls sakrīt ar SVG priekšskatījumu (tas pats izkārtojums un matricas); atšķiras
  // tikai malu nogludināšana.
  await expect(card(page)).not.toHaveAttribute('data-png', '')
  const diff = await page.evaluate(async (png: number[]) => {
    const svg = document.querySelector('[data-testid="card"] svg')!.outerHTML
    const load = (src: string) =>
      new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image()
        img.onload = () => resolve(img)
        img.onerror = reject
        img.src = src
      })
    const pixels = (img: HTMLImageElement) => {
      const canvas = document.createElement('canvas')
      canvas.width = 1080
      canvas.height = 1920
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, 1080, 1920)
      return ctx.getImageData(0, 0, 1080, 1920).data
    }
    const a = pixels(await load(URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))))
    const b = pixels(await load(URL.createObjectURL(new Blob([new Uint8Array(png)], { type: 'image/png' }))))
    let total = 0
    let differing = 0
    for (let i = 0; i < a.length; i += 4) {
      const d = Math.abs(a[i]! - b[i]!) + Math.abs(a[i + 1]! - b[i + 1]!) + Math.abs(a[i + 2]! - b[i + 2]!)
      total += d
      if (d > 96) differing++
    }
    return { mean: total / (a.length / 4), differing: differing / (a.length / 4) }
  }, [...bytes])
  expect(diff.mean).toBeLessThan(2)
  expect(diff.differing).toBeLessThan(0.005)
})

test('"Sūtīt kā attēlu" nodod PNG failu sistēmas Share', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { shared: { name: string; type: string; size: number; title?: string }[] }
    w.shared = []
    navigator.canShare = (data?: ShareData) => Boolean(data?.files?.length)
    navigator.share = async (data?: ShareData) => {
      for (const file of data?.files ?? []) w.shared.push({ name: file.name, type: file.type, size: file.size, title: data?.title })
    }
  })
  await seed(page, fixtureAll, GREETING)
  await button(page, 'Portrets').click()
  await expect(card(page)).toHaveAttribute('data-format', 'portrait')
  await button(page, 'Sūtīt kā attēlu').click()
  await expect.poll(() => page.evaluate(() => (window as unknown as { shared: unknown[] }).shared.length)).toBe(1)
  const [shared] = await page.evaluate(() => (window as unknown as { shared: { name: string; type: string; size: number }[] }).shared)
  expect(shared).toMatchObject({ name: 'apsveikums.png', type: 'image/png' })
  expect(shared!.size).toBeGreaterThan(1000)
  expect(shared!.size).toBeLessThan(1024 * 1024)
  // Share izdevās: lejupielādes paziņojuma nav.
  await expect(page.getByTestId('notice')).toHaveCount(0)
})

/** Novelk vienu vilcienu ar pirkstu (CDP skāriena notikumi); koordinātas ir laukuma daļas (0..1). */
async function touchStroke(page: Page, from: [number, number], to: [number, number]) {
  const pad = page.getByTestId('drawpad')
  const box = (await pad.boundingBox())!
  const at = (f: number) => ({
    x: Math.round(box.x + box.width * (from[0] + (to[0] - from[0]) * f)),
    y: Math.round(box.y + box.height * (from[1] + (to[1] - from[1]) * f)),
  })
  const before = Number(await pad.getAttribute('data-strokes'))
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [at(0)] })
  for (let i = 1; i <= 6; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [at(i / 6)] })
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await cdp.detach()
  await expect(pad).toHaveAttribute('data-strokes', String(before + 1))
}

test('neuzrakstīta zīme bloķē sūtīšanu; "Uzrakstīt" atver tieši tās un atgriežas kartītē', async ({ page }) => {
  // Tikai 33 mazie burti: "S", "A" un "!" nav uzrakstīti.
  await seed(page, lowercase, 'Sveiki, Anna!')
  const status = page.getByTestId('card-status')
  await expect(status).toHaveAttribute('data-problem', 'missing')
  await expect(status).toContainText('Trūkst 4 zīmes: S , A !')
  await expect(button(page, 'Sūtīt kā attēlu')).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Lejupielādēt attēlu' })).toBeDisabled()
  // Neuzrakstītās zīmes ir tukši rāmīši, nevis citi burti ("A" netiek aizstāts ar "a").
  await expect(card(page)).toHaveAttribute('data-missing', '4')
  await expect(card(page)).toHaveAttribute('data-glyphs', '8')

  await button(page, 'Uzrakstīt').click()
  await expect(page).toHaveURL(/\/raksti$/)
  for (const [prompt, from, to, next] of [
    ['Raksti lielo S', [0.6, 0.2], [0.4, 0.7], 'Tālāk'],
    ['Raksti komatu', [0.5, 0.6], [0.45, 0.75], 'Tālāk'],
    ['Raksti lielo A', [0.3, 0.7], [0.5, 0.2], 'Tālāk'],
    ['Raksti izsaukuma zīmi', [0.5, 0.2], [0.5, 0.6], 'Gatavs'],
  ] as const) {
    await expect(page.getByRole('heading', { level: 1, name: prompt, exact: true })).toBeVisible()
    await touchStroke(page, [...from], [...to])
    await button(page, next).click()
  }

  // Pēc pēdējās zīmes atpakaļ kartītē, un tagad to var sūtīt.
  await expect(page).toHaveURL(/\/kartite$/)
  await expect(card(page)).toHaveAttribute('data-missing', '0')
  await expect(status).toHaveAttribute('data-problem', '')
  await expect(button(page, 'Sūtīt kā attēlu')).toBeEnabled()
})

test('tukšs teksts un zīmes ārpus kopas bloķē sūtīšanu', async ({ page }) => {
  await seed(page, fixtureAll, '')
  await expect(page.getByTestId('card-status')).toHaveAttribute('data-problem', 'empty')
  await expect(button(page, 'Sūtīt kā attēlu')).toBeDisabled()
  await page.getByTestId('card-text').fill('Sveiki @ draugi')
  await expect(page.getByTestId('card-status')).toContainText('izņem tās no teksta: @')
  await expect(button(page, 'Sūtīt kā attēlu')).toBeDisabled()
  await page.getByTestId('card-text').fill('Sveiki, draugi!')
  await expect(button(page, 'Sūtīt kā attēlu')).toBeEnabled()
})

test('no rakstīšanas uz kartīti un atpakaļ', async ({ page }) => {
  await seed(page, fixtureAll, GREETING)
  await page.getByRole('link', { name: 'Burti' }).click()
  await expect(page.getByTestId('drawpad')).toBeVisible()
  await page.getByRole('link', { name: 'Kartīte' }).click()
  await expect(card(page)).toBeVisible()
})
