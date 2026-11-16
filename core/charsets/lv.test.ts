import { describe, expect, it } from 'vitest'
import { allChars, getCharset, requiredChars } from './index'

const lv = getCharset('lv')
const chars = allChars(lv)
const group = (id: string) => lv.groups.find((g) => g.id === id)!.chars

describe('latviešu rakstzīmju kopa', () => {
  it('satur 99 rakstzīmes pa grupām 33 + 4 + 37 + 10 + 15', () => {
    expect(lv.groups.map((g) => g.chars.length)).toEqual([33, 4, 37, 10, 15])
    expect(chars).toHaveLength(99)
  })

  it('nesatur dublikātus', () => {
    expect(new Set(chars).size).toBe(chars.length)
  })

  it('katra rakstzīme ir viens NFC kodpunkts', () => {
    for (const c of chars) {
      expect([...c], c).toHaveLength(1)
      expect(c.normalize('NFC'), c).toBe(c)
    }
  })

  it('mazie burti ir alfabēta secībā: burts ar zīmi uzreiz pēc pamatburta', () => {
    expect(group('lower').join('')).toBe('aābcčdeēfgģhiījkķlļmnņoprsštuūvzž')
    expect(requiredChars(lv)).toEqual([...group('lower')])
  })

  it('lielie burti atbilst mazajiem, ieskaitot Q W X Y', () => {
    expect(group('upper').join('')).toBe('AĀBCČDEĒFGĢHIĪJKĶLĻMNŅOPRSŠTUŪVZŽQWXY')
  })

  it('burtiem ar zīmēm ir savi kodpunkti (ā = U+0101, ķ = U+0137, Ģ = U+0122)', () => {
    expect('ā'.codePointAt(0)).toBe(0x0101)
    expect(chars).toContain('ā')
    expect(chars).toContain('ķ')
    expect(chars).toContain('Ģ')
  })

  it('aizstāšanas mērķi ir kopā', () => {
    for (const target of Object.values(lv.substitutions)) {
      for (const c of target) expect(chars, target).toContain(c)
    }
  })

  it('biežākie burti ir no obligātās grupas', () => {
    for (const c of lv.frequentChars) expect(group('lower')).toContain(c)
  })

  it('uzvednes atšķir mazos, lielos, ciparus un pieturzīmes', () => {
    expect(lv.prompt('ā')).toBe('Raksti mazo ā')
    expect(lv.prompt('Ķ')).toBe('Raksti lielo Ķ')
    expect(lv.prompt('7')).toBe('Raksti ciparu 7')
    expect(lv.prompt('!')).toBe('Raksti izsaukuma zīmi')
  })

  it('PRD etalona teksti pēc aizstāšanas sastāv tikai no kopas rakstzīmēm', () => {
    const texts = [
      'Glāžšķūņa rūķīši dzērumā čiepj Baha koncertflīģeļu vākus.',
      'ĀBOLU ČIEKURS ĒNA ĢIMENE ĪSS ĶERRA ĻOTI ŅEM ŠŪPOĻU ŪDENS ŽOGS',
      'Daudz laimes 30. dzimšanas dienā, Mārīt! ♥',
    ]
    for (const text of texts) {
      const missing = [...text.normalize('NFC')].filter((c) => c !== ' ' && !chars.includes(c))
      expect(missing, text).toEqual([])
    }
  })

  it('parauga teksts sastāv tikai no obligātajiem burtiem un satur visus 11 burtus ar zīmēm', () => {
    const letters = [...lv.sampleText].filter((c) => c !== ' ')
    for (const c of letters) expect(requiredChars(lv), c).toContain(c)
    for (const c of 'āčēģīķļņšūž') expect(letters, c).toContain(c)
    expect(lv.sampleText.normalize('NFC')).toBe(lv.sampleText)
  })

  it('pamatburti blāvajam paraugam: katram burtam ar zīmi savs pamatburts no kopas', () => {
    expect(Object.keys(lv.baseChars).filter((c) => group('lower').includes(c)).join('')).toBe('āčēģīķļņšūž')
    expect([...'āčēģīķļņšūž'].map((c) => lv.baseChars[c]).join('')).toBe('acegiklnsuz')
    expect(lv.baseChars['Ķ']).toBe('K')
    for (const [char, base] of Object.entries(lv.baseChars)) {
      expect(chars).toContain(char)
      expect(chars).toContain(base)
      // Alfabēta secībā pamatburts ir tieši pirms burta ar zīmi: tas ir "tikko uzrakstīts".
      expect(chars.indexOf(base)).toBe(chars.indexOf(char) - 1)
    }
    expect(lv.baseChars['a']).toBeUndefined()
  })
})
