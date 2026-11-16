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

**Stāvoklis:** 0. posms (pamats), 1. posms (zīmēšanas laukums) un 2. posms (kodols) pabeigti.
Nākamais ir 3. posms, latviešu burti (blāvais paraugs, variantu ievade un maiņa, "trice").

## Struktūra un robežas

```
core/         tīrs TypeScript bez DOM; testi blakus failiem (*.test.ts)
app/          Next.js App Router: (create)/, vēlāk (card)/, k/[id]/, api/cards/
components/   React komponentes (DrawPad, WriteFlow, Preview; vēlāk GlyphGrid, CardCanvas)
lib/          pārlūka puses palīgkods, kas nav komponente (project-store: IndexedDB caur idb)
tests/        e2e/ (Playwright), spikes/ (bibliotēku pārbaudes), fixtures/ (etalona vilcieni un
              momentuzņēmumi), snapshots.test.ts
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

## Kodols (2. posms)

Ceļš: vilcieni → `outline` → `metrics` → `font` (sakompilēti glifi) → `layout` → `render-svg`.

- **`core/outline.ts`.** Katrs vilciens kļūst par poligonu ar `perfect-freehand` (pildspalva
  `PEN_SIZE` = 44 vienības × `style.strokeWidth`). Spiedienu lieto tikai tad, ja `p` ir visiem vilciena
  punktiem; citādi platumu rēķinām paši no ātruma pēc `t` (lēni = biezāk), nevis ar bibliotēkas
  `simulatePressure`, kas skatās tikai uz punktu attālumu un tāpēc ir atkarīga no ierīces paraugu
  biežuma. Punkti ar vienādu `t` platumu nemaina.
- **Apvienošana.** Visus burta vilcienus apvieno ar vienu `polygon-clipping` `union`. Bibliotēka viena
  poligona paškrustojumus šķeļ pēc pāra-nepāra likuma, tāpēc vieta, kur vilciens pārklāj pats sevi, var
  iznākt caura: caurumus, ap kuriem apvijas kāds vilciens (apvijumu skaits nav 0), aizpilda un tad
  apvieno vēlreiz; īstie caurumi (o, cilpas iekšpuse) paliek. Ārējās kontūras iet pret
  pulksteņrādītāja virzienu (y uz augšu), caurumi pa to. Ja bibliotēka met kļūdu, vilcieni paliek
  neapvienoti ar vienādu virzienu (aizpildījums pareizs, tikai ar pārklājumiem).
- **Vienkāršošana.** Poligonu pārvērš kubiskās Bezjē līknēs: stūri (pagrieziens virs 50°) ir obligāti
  mezgli, starp tiem līkni dala, kamēr kļūda pārsniedz pielaidi. Pielaides 1,5 → 2,5 → 4 → 6 vienības
  izmēģina pēc kārtas, līdz glifs ietilpst 60 punktos. **"Punkts" šeit ir mezgls (segmenta
  galapunkts); vadības punktus neskaita.** Visi 33 etalona burti ietilpst (10–59 mezgli).
- **`core/metrics.ts`.** Platums = robežkaste + `style.spacing` × 1000 katrā pusē (60 vienības); vieta
  laukumā platumu neietekmē. Augšējā un apakšējā robeža ir uzzīmētā galējie punkti, bet nekad nav
  šaurāka par laukuma līnijām (700 un −250), lai rindas augstums nelēkātu, kamēr uzrakstīti tikai zemi
  burti. `project.metrics` projektā netiek pārrakstīts; metriku vienmēr rēķina `compileFont`.
- **`core/font.ts`.** `compileFont(project, cache)` dod `CompiledFont`: katram variantam SVG ceļš
  (y uz leju, pamatlīnija 0, kreisā atstarpe no x = 0), platums un robežkaste. Kešs ir `WeakMap` pēc
  varianta objekta; tas strādā, jo `core/project.ts` jaunu objektu izveido tikai mainītajam burtam.
  Kontūras nekur neglabājam.
- **`core/layout.ts`.** NFC → aizstāšanas no kopas → atstarpju virknes saplūst → laušana pa vārdiem
  (pārāk garu vārdu pa burtiem). Atstarpe 300, neuzrakstīta zīme 420 vienības, rindstarpa 1,15 ×
  (augša − apakša). Vienmēr pirmais variants; variantu maiņa un sēkla nāk 3. posmā. Neuzrakstīta
  rakstzīme nonāk `layout.missing` ar rezervētu vietu un nekad netiek aizstāta ar citu glifu.
- **`core/render-svg.ts`.** Katrs izmantotais glifs vienreiz `<defs>`, tekstā `<use x y>`; neuzrakstītās
  zīmes ir blāvi rāmīši (`showMissing`). Ja vienā lapā ir vairāki SVG, katram vajag savu `idPrefix`.
- **Determinisms.** `layout` un `render-svg` lieto tikai veselu skaitļu aritmētiku un virkņu salikšanu,
  tāpēc tie ir bait-identiski visur. `outline` lieto peldošā punkta matemātiku (`Math.hypot`, `exp`,
  `acos`) un tiek rēķināts tikai autora ierīcē; kartītē ceļo jau noapaļoti ceļi (`Card.outlines`).
  Serverī kontūras no vilcieniem nedrīkst pārrēķināt.
- **Priekšskatījums.** `components/Preview.tsx` zem laukuma rāda `charset.sampleText` (pangramma ar
  mazajiem burtiem, bez punkta) un pārrēķinās pēc katras sesijas izmaiņas. E2E:
  `tests/e2e/preview.spec.ts`, tikai telefona projektā, raksta ar CDP skārieniem.
- **Etalons.** `tests/fixtures/strokes.json` ģenerē `node tests/fixtures/generate-strokes.mjs` (33 mazie
  burti un gadījumi `cilpa`, `spiediens`, `punkts`, `svikajums`); testi lasa tikai JSON caur
  `tests/fixtures/strokes.ts`. Momentuzņēmumi ir `tests/fixtures/snapshots/` (skatāmi SVG un
  `konturas.txt`); apzinātu izmaiņu pēc tos atjauno ar `npm test -- -u` un pārskata acīm.
- **Ātrums.** Etalona glifs uz izstrādes mašīnas pārrēķinās vidēji ap 2 ms, lēnākais (švīkājums) ap
  5 ms; tests prasa zem 25 ms (PRD slieksnis telefonam ir 50 ms). Īstā telefonā vēl nav mērīts.

## Bibliotēku pārbaude (0. posms, 2026-11-16)

Pārbaudīts ar testiem `tests/spikes/font-libs.test.ts`; tie paliek kā sargs pret atjauninājumiem.

| Bibliotēka | Versija | Secinājums |
| --- | --- | --- |
| `opentype.js` | 2.0.0 | Ieraksta OTF ar visiem 99 kodpunktiem. GSUB: `liga` un `salt`/`aalt` strādā. **`calt` augstā līmeņa API klusi ignorē** (nekas netiek ierakstīts, kļūdas nav). Bibliotēkā ir zema līmeņa 5. un 6. tipa tabulu rakstītāji, bet tie nav pārbaudīti. MVP to nevajag. |
| `wawoff2` | 2.0.1 | Node vidē saspiež un atspiež WOFF2. Pārlūkā (WASM ielāde caur Next.js) vēl nav pārbaudīts; jāpārbauda 7. posmā. |
| `perfect-freehand` | 1.2.3 | Lietojam `core/outline.ts` ar pašu aprēķinātu spiedienu (`simulatePressure: false`). |
| `polygon-clipping` | 0.15.7 | Lietojam kontūru apvienošanai (mazāks par `paper.js`, strādā bez DOM). Paškrustojumiem pāra-nepāra likums; skat. "Kodols". |
| `zod` 4, `idb` 8 | | Instalēti, lietosim 1. un 6. posmā. |

Piezīmes:

- `opentype.js` ESM versijai nav noklusējuma eksporta: jāraksta `import * as opentype from 'opentype.js'`.
- `opentype.js` un `wawoff2` nav savu tipu; pagaidu deklarācijas ir `types/vendor.d.ts`.
- TypeScript ir 6.x, jo `typescript-eslint` vēl neatbalsta 7.x.
- `@playwright/test` versija ir piesieta (1.63.0), lai sakristu ar Claude Code mākoņa vidē
  iepriekš instalēto pārlūku. Atjauninot jāpārbauda, vai e2e joprojām iet šajā vidē.
- Supabase, Sentry un PWA vēl nav pieslēgti; tie nāk 6. un 7. posmā.
