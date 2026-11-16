import { describe, expect, it } from 'vitest'
import { getCharset } from '@/core/charsets'
import { compileFont } from '@/core/font'
import { layoutText } from '@/core/layout'
import { buildOutline, outlineToPath, pointCount } from '@/core/outline'
import { renderSvg } from '@/core/render-svg'
import { fixtureCases, fixtureGlyphs, fixtureProject } from './fixtures/strokes'

// Momentuzņēmumi no etalona vilcieniem (PRD 11. sadaļa, 2. posms). Faili ir skatāmi SVG;
// ja izmaiņa ir apzināta, tos atjauno ar `npm test -- -u` un pārskata acīm.

const lv = getCharset('lv')
const snapshot = (name: string) => `./fixtures/snapshots/${name}`

describe('etalona momentuzņēmumi', () => {
  it('katra etalona glifa kontūra ir stabila', async () => {
    const lines = Object.entries({ ...fixtureGlyphs, ...fixtureCases }).map(([name, strokes]) => {
      const outline = buildOutline(strokes)
      return `${name}\t${pointCount(outline)}\t${outlineToPath(outline)}`
    })
    await expect(lines.join('\n') + '\n').toMatchFileSnapshot(snapshot('konturas.txt'))
  })

  it('parauga teksts (pangramma mazajiem burtiem) ar pilnu alfabētu', async () => {
    const font = compileFont(fixtureProject())
    const layout = layoutText(lv.sampleText, font, lv, { maxWidth: 9000 })
    expect(layout.missingChars).toEqual([])
    await expect(renderSvg(layout, font)).toMatchFileSnapshot(snapshot('pangramma.svg'))
  })

  it('centrēts teksts vairākās rindās ar aizstāšanām un trūkstošām zīmēm', async () => {
    const font = compileFont(fixtureProject([...'aābdeēiklmnoprsštuvz']))
    const layout = layoutText('daudz laimes\ndzimšanas dienā…\nmīļā omīt', font, lv, { maxWidth: 6000, align: 'center' })
    expect(layout.missingChars).toEqual(['.', 'ī', 'ļ'])
    await expect(renderSvg(layout, font, { ink: '#b4402c' })).toMatchFileSnapshot(snapshot('apsveikums.svg'))
  })

  it('nepilns alfabēts: uzrakstīti tikai pirmie burti', async () => {
    const font = compileFont(fixtureProject(['a', 'ā', 'b']))
    const layout = layoutText(lv.sampleText, font, lv, { maxWidth: 9000 })
    await expect(renderSvg(layout, font)).toMatchFileSnapshot(snapshot('pirmie-burti.svg'))
  })
})
