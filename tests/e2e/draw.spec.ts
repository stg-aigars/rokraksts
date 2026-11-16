import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const pad = (page: Page) => page.getByTestId('drawpad')
const heading = (page: Page, name: string) => page.getByRole('heading', { level: 1, name, exact: true })
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true })

async function open(page: Page) {
  await page.goto('/raksti')
  await expect(pad(page)).toBeVisible()
}

/** Novelk vienu vilcienu; koordinātas ir laukuma daļas (0..1). */
async function draw(page: Page, from: [number, number], to: [number, number]) {
  const box = (await pad(page).boundingBox())!
  const at = ([fx, fy]: [number, number]) => [box.x + box.width * fx, box.y + box.height * fy] as const
  const before = Number(await pad(page).getAttribute('data-strokes'))
  await page.mouse.move(...at(from))
  await page.mouse.down()
  await page.mouse.move(...at(to), { steps: 8 })
  await page.mouse.up()
  await expect(pad(page)).toHaveAttribute('data-strokes', String(before + 1))
}

async function saved(page: Page) {
  await expect(page.getByTestId('save-state')).toHaveAttribute('data-state', 'saved')
}

type StoredPoint = { x: number; y: number; t: number; p?: number }

/** Nolasa saglabātos atvērtā burta vilcienus tieši no IndexedDB. */
async function storedStrokes(page: Page, char: string): Promise<StoredPoint[][]> {
  return page.evaluate(
    (c) =>
      new Promise<StoredPoint[][]>((resolve, reject) => {
        const open = indexedDB.open('rokraksts')
        open.onerror = () => reject(open.error)
        open.onsuccess = () => {
          const get = open.result.transaction('session').objectStore('session').get('current')
          get.onerror = () => reject(get.error)
          get.onsuccess = () => {
            const variants = get.result?.project?.glyphs?.[c]?.variants ?? []
            resolve((variants[0]?.strokes ?? []).map((s: { points: StoredPoint[] }) => s.points))
            open.result.close()
          }
        }
      }),
    char,
  )
}

test('laukumā ir četras līnijas un divi palīgpunkti uz pamatlīnijas', async ({ page }) => {
  await open(page)
  await expect(pad(page).locator('[data-line]')).toHaveCount(4)
  await expect(pad(page).locator('[data-guide]')).toHaveCount(2)

  const baselineY = await pad(page).locator('[data-line="baseline"]').getAttribute('y1')
  for (const guide of await pad(page).locator('[data-guide]').all()) {
    await expect(guide).toHaveAttribute('cy', baselineY!)
  }
  await expect(pad(page)).toHaveCSS('touch-action', 'none')
})

test('burtus raksta pēc kārtas; Tālāk kļūst pieejams tikai pēc vilciena', async ({ page }) => {
  await open(page)
  await expect(heading(page, 'Raksti mazo a')).toBeVisible()
  await expect(page.getByTestId('progress')).toHaveText('0 no 99')
  await expect(button(page, 'Tālāk')).toBeDisabled()
  await expect(button(page, 'Atpakaļ')).toBeDisabled()

  await draw(page, [0.3, 0.4], [0.6, 0.6])
  await expect(page.getByTestId('progress')).toHaveText('1 no 99')
  await button(page, 'Tālāk').click()

  await expect(heading(page, 'Raksti mazo ā')).toBeVisible()
  await expect(pad(page)).toHaveAttribute('data-strokes', '0')

  await button(page, 'Atpakaļ').click()
  await expect(heading(page, 'Raksti mazo a')).toBeVisible()
  await expect(pad(page)).toHaveAttribute('data-strokes', '1')
})

test('Atsaukt noņem pēdējo vilcienu, Notīrīt visus', async ({ page }) => {
  await open(page)
  await draw(page, [0.2, 0.4], [0.4, 0.6])
  await draw(page, [0.5, 0.4], [0.7, 0.6])
  await draw(page, [0.3, 0.3], [0.6, 0.3])
  await expect(pad(page).locator('[data-stroke]')).toHaveCount(3)

  await button(page, 'Atsaukt').click()
  await expect(pad(page).locator('[data-stroke]')).toHaveCount(2)

  await button(page, 'Notīrīt').click()
  await expect(pad(page).locator('[data-stroke]')).toHaveCount(0)
  await expect(button(page, 'Atsaukt')).toBeDisabled()
  await expect(button(page, 'Notīrīt')).toBeDisabled()
  await expect(button(page, 'Tālāk')).toBeDisabled()
  await expect(page.getByTestId('progress')).toHaveText('0 no 99')
})

test('pēc pārlādes turpina no tās pašas vietas ar tiem pašiem vilcieniem', async ({ page }) => {
  await open(page)
  for (const letter of ['a', 'ā', 'b']) {
    await expect(heading(page, `Raksti mazo ${letter}`)).toBeVisible()
    await draw(page, [0.3, 0.4], [0.6, 0.6])
    await button(page, 'Tālāk').click()
  }
  await expect(heading(page, 'Raksti mazo c')).toBeVisible()
  await draw(page, [0.2, 0.4], [0.4, 0.6])
  await draw(page, [0.5, 0.4], [0.7, 0.6])
  await button(page, 'Atsaukt').click()
  await saved(page)

  await page.reload()

  await expect(heading(page, 'Raksti mazo c')).toBeVisible()
  await expect(pad(page)).toHaveAttribute('data-strokes', '1')
  await expect(page.getByTestId('progress')).toHaveText('4 no 99')

  await button(page, 'Atpakaļ').click()
  await expect(heading(page, 'Raksti mazo b')).toBeVisible()
  await expect(pad(page)).toHaveAttribute('data-strokes', '1')
})

test('punkti glabājas fonta vienībās: pamatlīnija ir y = 0, y aug uz augšu', async ({ page }) => {
  await open(page)
  const baselineY = Number(await pad(page).locator('[data-line="baseline"]').getAttribute('y1'))
  const viewBoxHeight = Number((await pad(page).getAttribute('viewBox'))!.split(' ')[3])
  const baseline = baselineY / viewBoxHeight

  // Vilciens no pamatlīnijas kreisajā pusē uz augšu pa labi.
  await draw(page, [0.25, baseline], [0.75, baseline - 0.25])
  await saved(page)

  const [points] = await storedStrokes(page, 'a')
  const first = points![0]!
  const last = points!.at(-1)!
  expect(points!.length).toBeGreaterThan(2)
  expect(Math.abs(first.y)).toBeLessThanOrEqual(4)
  expect(Math.abs(first.x - 275)).toBeLessThanOrEqual(4)
  expect(Math.abs(last.x - 825)).toBeLessThanOrEqual(4)
  expect(Math.abs(last.y - 350)).toBeLessThanOrEqual(4)
  for (const p of points!) {
    expect(Number.isInteger(p.x) && Number.isInteger(p.y) && Number.isInteger(p.t)).toBe(true)
  }
  expect(first.t).toBe(0)
  expect(last.t).toBeGreaterThanOrEqual(first.t)
})

test('bojāts ieraksts glabātuvē nesalauž lapu: sākas jauns projekts', async ({ page }) => {
  await open(page)
  await draw(page, [0.3, 0.4], [0.6, 0.6])
  await saved(page)
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('rokraksts')
        open.onsuccess = () => {
          const tx = open.result.transaction('session', 'readwrite')
          tx.objectStore('session').put({ project: 'nav projekts' }, 'current')
          tx.oncomplete = () => {
            open.result.close()
            resolve()
          }
          tx.onerror = () => reject(tx.error)
        }
      }),
  )

  await page.reload()
  await expect(heading(page, 'Raksti mazo a')).toBeVisible()
  await expect(pad(page)).toHaveAttribute('data-strokes', '0')
})

test('lapa ietilpst ekrānā un visas pogas ir redzamas', async ({ page }) => {
  await open(page)
  const viewport = page.viewportSize()!
  const doc = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    height: document.documentElement.scrollHeight,
  }))
  expect(doc.width).toBeLessThanOrEqual(viewport.width)
  expect(doc.height).toBeLessThanOrEqual(viewport.height)
  for (const name of ['Atpakaļ', 'Atsaukt', 'Notīrīt', 'Tālāk']) {
    await expect(button(page, name)).toBeInViewport({ ratio: 1 })
  }
  const box = (await pad(page).boundingBox())!
  // Galddatorā saturs ir ierobežots līdz telefona platumam (448 px).
  expect(box.width).toBeGreaterThan(Math.min(viewport.width, 448) * 0.6)
  expect(box.width / box.height).toBeCloseTo(1100 / 1400, 1)
})

test('zīmējot ar pirkstu, lapa neritinās un vilciens tiek pierakstīts', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'telefons', 'skāriena pārbaude tikai telefona projektā')
  await open(page)
  const box = (await pad(page).boundingBox())!
  const x = Math.round(box.x + box.width / 2)
  const top = Math.round(box.y + box.height * 0.15)
  const bottom = Math.round(box.y + box.height * 0.85)

  // Īsts skāriena žests caur CDP: garš vertikāls vilciens, kas parastā lapā ritinātu.
  const cdp = await page.context().newCDPSession(page)
  const touch = (type: string, y?: number) =>
    cdp.send('Input.dispatchTouchEvent', {
      type: type as 'touchStart',
      touchPoints: y === undefined ? [] : [{ x, y }],
    })
  await touch('touchStart', bottom)
  for (let i = 1; i <= 12; i++) await touch('touchMove', bottom + ((top - bottom) * i) / 12)
  await touch('touchEnd')

  await expect(pad(page)).toHaveAttribute('data-strokes', '1')
  const scroll = await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }))
  expect(scroll).toEqual({ x: 0, y: 0 })

  await saved(page)
  const [points] = await storedStrokes(page, 'a')
  expect(points!.length).toBeGreaterThan(5)
  expect(points!.at(-1)!.y - points![0]!.y).toBeGreaterThan(800)
})
