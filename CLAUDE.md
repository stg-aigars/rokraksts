# Rokraksts

Mobile-first tīmekļa lietotne: cilvēks ar pirkstu uzraksta burtus, iegūst fontu savā rokrakstā ar
pilnu latviešu alfabētu un nosūta apsveikumu.

**Patiesības avots ir [`docs/PRD.md`](docs/PRD.md).** Ja kods vai šis fails ar to nesaskan, vispirms
jāsaskaņo ar PRD (un PRD jālabo apzināti, nevis klusi jāapiet).

## Komandas

```bash
npm run dev        # izstrādes serveris
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
npm test           # Vitest: core un tests/
npm run build      # Next.js būve
npm run e2e        # Playwright (telefona un galddatora projekts)
```

Pirms katra commit jāiziet tīri: `lint`, `typecheck`, `test`, `build`. CI papildus palaiž `e2e`.

## Darba kārtība

- Viens posms (PRD 11. sadaļa) vienā sesijā; posmu sāk ar plānu un beidz ar zaļiem testiem.
- 2. un 3. posms: testi pa priekšu. Etalona vilcieni dzīvo `tests/fixtures/strokes.json`.
- Saskarnes teksti, testu nosaukumi un komentāri ir latviski; identifikatori kodā angliski.
- Viss glabājas GitHub; lokālu kopiju nav, tāpēc darbs ir pabeigts tikai tad, kad tas ir nosūtīts.

**Stāvoklis:** 0. posms (pamats) un 1. posms (zīmēšanas laukums) pabeigti. Nākamais ir 2. posms, kodols.

## Struktūra un robežas

```
core/         tīrs TypeScript bez DOM; testi blakus failiem (*.test.ts)
app/          Next.js App Router: (create)/, vēlāk (card)/, k/[id]/, api/cards/
components/   React komponentes (DrawPad, WriteFlow; vēlāk GlyphGrid, Preview, CardCanvas)
lib/          pārlūka puses palīgkods, kas nav komponente (project-store: IndexedDB caur idb)
tests/        e2e/ (Playwright), spikes/ (bibliotēku pārbaudes), fixtures/
types/        tipu deklarācijas bibliotēkām bez saviem tipiem
```

- `core` nezina par React, Next.js, pārlūku vai Supabase. To sargā ESLint (`eslint.config.mjs`).
- Tas pats `layout` un `render-svg` kods darbosies klientā un serverī; tāpēc `core` nedrīkst lietot
  neko, kas dod atšķirīgu rezultātu dažādās vidēs.

## Lēmumi no PRD, kas jāpatur prātā

- **Vilcieni ir patiesības avots**, nevis kontūras. Kontūras un fontu vienmēr pārrēķina no jauna.
- **Katrs burts ir patstāvīgs glifs.** "ā" ir atsevišķs zīmējums (U+0101), nekad "a" plus zīme.
  Neuzrakstīts "ā" nekad netiek aizstāts ar "a"; trūkstoša zīme bloķē kopīgošanu.
- **Komats, nevis sedija** burtiem ķ ļ ņ ģ; mazajam ģ zīme ir augšā.
- **Teksts vienmēr NFC** pirms attēlošanas; aizstāšanas ir `core/charsets/lv.ts`.
- **Rakstzīmju kopa ir dati** (`core/charsets/<valoda>.ts`): 99 rakstzīmes, līdz 3 variantiem katrai.
  Jauna valoda nedrīkst prasīt koda pārrakstīšanu.
- **Kartītes zīmējam paši** (SVG/canvas caur savu izkārtotāju), nevis ar fontu. Fonta fails ir tikai
  eksporta formāts.
- **Determinisms:** teksts + glifi + sēkla dod bait-identisku SVG visur. Koordinātas noapaļo līdz
  veseliem skaitļiem pirms izvades; nejaušība tikai no ģeneratora ar kartītes sēklu.
- **Local-first un privātums:** pilns rokraksts neatstāj ierīci. Serverī nonāk tikai kopīgota kartīte
  ar tekstā izmantoto glifu kontūrām. Nav kontu, nav sīkdatņu, analītikā un Sentry nav vilcienu vai
  teksta satura.
- **Metrika:** 1000 vienības uz em, pamatlīnija y = 0; vertikālo metriku rēķina no faktiski uzzīmētā
  augstākā un zemākā punkta, lai zīmes netiktu nogrieztas.

## Zīmēšanas laukums (1. posms)

- Ģeometrija ir `core/pad.ts`: laukums 1100 × 1400 vienības (y no +950 līdz −450); līnijas 700
  (augšējā), 450 (mazo burtu augstums), 0 (pamatlīnija), −250 (apakšējā); palīgpunkti x = 150 un 950.
  Brīvās joslas zīmēm: 250 vienības augšā, 200 apakšā.
- Punktus glabā kā veselus skaitļus fonta vienībās; `t` ir ms no burta pirmā vilciena sākuma; `p`
  ieraksta tikai tad, ja ierīce spiedienu tiešām mēra (ne pele, ne 0 vai 0.5).
- Sesija (`core/project.ts`) ir `FontProject` plus atvērtā rakstzīme; `FontProject` paliek kā PRD
  10. sadaļā. IndexedDB: datubāze `rokraksts`, krātuve `session`, atslēga `current`. Ielādējot
  validē ar zod (`core/schema.ts`); nederīgs ieraksts nozīmē jaunu projektu.
- "Tālāk" ir aktīva tikai tad, kad atvērtais burts ir uzrakstīts. Burtu izlaišana un "trūkst zīmes"
  plūsma nāk 4. posmā.
- E2E gaida `data-state="saved"` uz `save-state` elementa pirms pārlādes; skāriena tests (CDP
  `Input.dispatchTouchEvent`) iet tikai telefona projektā.

## Bibliotēku pārbaude (0. posms, 2026-11-16)

Pārbaudīts ar testiem `tests/spikes/font-libs.test.ts`; tie paliek kā sargs pret atjauninājumiem.

| Bibliotēka | Versija | Secinājums |
| --- | --- | --- |
| `opentype.js` | 2.0.0 | Ieraksta OTF ar visiem 99 kodpunktiem. GSUB: `liga` un `salt`/`aalt` strādā. **`calt` augstā līmeņa API klusi ignorē** (nekas netiek ierakstīts, kļūdas nav). Bibliotēkā ir zema līmeņa 5. un 6. tipa tabulu rakstītāji, bet tie nav pārbaudīti. MVP to nevajag. |
| `wawoff2` | 2.0.1 | Node vidē saspiež un atspiež WOFF2. Pārlūkā (WASM ielāde caur Next.js) vēl nav pārbaudīts; jāpārbauda 7. posmā. |
| `perfect-freehand` | 1.2.3 | Instalēts, lietosim 2. posmā. |
| `polygon-clipping` | 0.15.7 | Instalēts kā pirmā izvēle kontūru apvienošanai (mazāks par `paper.js`, strādā bez DOM). |
| `zod` 4, `idb` 8 | | Instalēti, lietosim 1. un 6. posmā. |

Piezīmes:

- `opentype.js` ESM versijai nav noklusējuma eksporta: jāraksta `import * as opentype from 'opentype.js'`.
- `opentype.js` un `wawoff2` nav savu tipu; pagaidu deklarācijas ir `types/vendor.d.ts`.
- TypeScript ir 6.x, jo `typescript-eslint` vēl neatbalsta 7.x.
- `@playwright/test` versija ir piesieta (1.63.0), lai sakristu ar Claude Code mākoņa vidē
  iepriekš instalēto pārlūku. Atjauninot jāpārbauda, vai e2e joprojām iet šajā vidē.
- Supabase, Sentry un PWA vēl nav pieslēgti; tie nāk 6. un 7. posmā.
