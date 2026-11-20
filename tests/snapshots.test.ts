import { describe, expect, it } from 'vitest'
import { createCard, DEFAULT_CARD_SETTINGS, renderCardSvg } from '@/core/card'
import type { CardSettings } from '@/core/card'
import { getCharset } from '@/core/charsets'
import { compileFont } from '@/core/font'
import { layoutText } from '@/core/layout'
import { buildOutline, outlineToPath, pointCount } from '@/core/outline'
import { renderSvg } from '@/core/render-svg'
import { fixtureAll, fixtureCases, fixtureGlyphs, fixtureMore, fixtureProject, fixtureVariants } from './fixtures/strokes'

// Momentuzņēmumi no etalona vilcieniem (PRD 11. sadaļa, 2. posms). Faili ir skatāmi SVG;
// ja izmaiņa ir apzināta, tos atjauno ar `npm test -- -u` un pārskata acīm.

const lv = getCharset('lv')
const snapshot = (name: string) => `./fixtures/snapshots/${name}`

describe('etalona momentuzņēmumi', () => {
  it('katra etalona glifa kontūra ir stabila', async () => {
    // Papildu varianti ir ar nosaukumu "a/2", "a/3".
    const extra = Object.entries(fixtureVariants).flatMap(([char, list]) =>
      list.map((strokes, i) => [`${char}/${i + 2}`, strokes] as const),
    )
    // Pārējās 66 zīmes (4. posms) ir beigās, lai 3. posma rindas paliktu tās pašas.
    const lines = [...Object.entries(fixtureGlyphs), ...extra, ...Object.entries(fixtureCases), ...fixtureMore].map(([name, strokes]) => {
      const outline = buildOutline(strokes)
      return `${name}\t${pointCount(outline)}\t${outlineToPath(outline)}`
    })
    await expect(lines.join('\n') + '\n').toMatchFileSnapshot(snapshot('konturas.txt'))
  })

  it('parauga teksts (pangramma mazajiem burtiem) ar pilnu alfabētu, variantiem un trici', async () => {
    const font = compileFont(fixtureProject())
    const layout = layoutText(lv.sampleText, font, lv, { maxWidth: 9000, seed: 2026 })
    expect(layout.missingChars).toEqual([])
    await expect(renderSvg(layout, font)).toMatchFileSnapshot(snapshot('pangramma.svg'))
  })

  it('tā pati pangramma ar citu sēklu: cits variantu izkārtojums un trice', async () => {
    const font = compileFont(fixtureProject())
    const layout = layoutText(lv.sampleText, font, lv, { maxWidth: 9000, seed: 7 })
    await expect(renderSvg(layout, font)).toMatchFileSnapshot(snapshot('pangramma-seed-7.svg'))
  })

  it('pangramma bez trices un ar vienu variantu katram burtam (2. posma izskats)', async () => {
    const font = compileFont(fixtureProject(undefined, { variants: false }))
    const layout = layoutText(lv.sampleText, font, lv, { maxWidth: 9000, trice: false })
    await expect(renderSvg(layout, font)).toMatchFileSnapshot(snapshot('pangramma-bez-trices.svg'))
  })

  it('centrēts teksts vairākās rindās ar aizstāšanām un trūkstošām zīmēm', async () => {
    const font = compileFont(fixtureProject([...'aābdeēiklmnoprsštuvz']))
    const layout = layoutText('daudz laimes\ndzimšanas dienā…\nmīļā omīt', font, lv, { maxWidth: 6000, align: 'center', seed: 2026 })
    expect(layout.missingChars).toEqual(['.', 'ī', 'ļ'])
    await expect(renderSvg(layout, font, { ink: '#b4402c' })).toMatchFileSnapshot(snapshot('apsveikums.svg'))
  })

  it('nepilns alfabēts: uzrakstīti tikai pirmie burti', async () => {
    const font = compileFont(fixtureProject(['a', 'ā', 'b']))
    const layout = layoutText(lv.sampleText, font, lv, { maxWidth: 9000, seed: 2026 })
    await expect(renderSvg(layout, font)).toMatchFileSnapshot(snapshot('pirmie-burti.svg'))
  })

  it('PRD 12. sadaļas etalona teksti ar visu kopu: pangramma, lielie burti, apsveikums', async () => {
    const font = compileFont(fixtureProject(fixtureAll))
    const text = [
      'Glāžšķūņa rūķīši dzērumā čiepj Baha koncertflīģeļu vākus.',
      'ĀBOLU ČIEKURS ĒNA ĢIMENE ĪSS ĶERRA ĻOTI ŅEM ŠŪPOĻU ŪDENS ŽOGS',
      'Daudz laimes 30. dzimšanas dienā, Mārīt! ♥',
    ].join('\n')
    const layout = layoutText(text, font, lv, { maxWidth: 12000, seed: 2026 })
    expect(layout.missingChars).toEqual([])
    await expect(renderSvg(layout, font)).toMatchFileSnapshot(snapshot('etalona-teksti.svg'))
  })

  it('apsveikums ar pielāgotu stilu: biezāks, slīpāks, lielāks, ar plašākām atstarpēm', async () => {
    const project = fixtureProject(fixtureAll)
    const font = compileFont({ ...project, style: { strokeWidth: 1.4, spacing: 0.09, slant: 0.2, scale: 1.1 } })
    const layout = layoutText('Daudz laimes 30. dzimšanas dienā, Mārīt! ♥', font, lv, { maxWidth: 9000, seed: 2026 })
    expect(layout.missingChars).toEqual([])
    await expect(renderSvg(layout, font, { ink: '#b4402c' })).toMatchFileSnapshot(snapshot('stils.svg'))
  })

  it('kartītes trīs formātos (5. posms): fons, rotājumi, tinte, līdzinājums', async () => {
    const font = compileFont(fixtureProject(fixtureAll))
    const cards: [string, string, Partial<CardSettings>][] = [
      ['kartite-kvadrats.svg', 'Daudz laimes 30. dzimšanas dienā, Mārīt! ♥', {}],
      ['kartite-portrets.svg', 'Priecīgus Ziemassvētkus,\nomīt!', { format: 'portrait', templateId: 'egle', ink: '#f6e7b0' }],
      ['kartite-stasts.svg', 'Līgo! Lai saulains vasaras vidus.', { format: 'story', templateId: 'ligo', ink: '#2f5d1e', align: 'left' }],
    ]
    for (const [name, text, settings] of cards) {
      const card = createCard({ id: name, text, settings: { ...DEFAULT_CARD_SETTINGS, seed: 2026, ...settings }, font, charset: lv })
      await expect(renderCardSvg(card, lv)).toMatchFileSnapshot(snapshot(name))
    }
  })
})
