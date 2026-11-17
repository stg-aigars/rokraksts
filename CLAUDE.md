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

**Stāvoklis:** 0.–4. posms pabeigti: pamats, zīmēšanas laukums, kodols, latviešu burti (varianti,
trice, blāvais paraugs) un 4. posms (visas 99 zīmes, stils, "trūkst zīmes" plūsma, glifu režģis).
Nākamais ir 5. posms: kartītes redaktors, foni, 3 formāti, PNG, `navigator.share`, poga "Sajaukt".

## Struktūra un robežas

```
core/         tīrs TypeScript bez DOM; testi blakus failiem (*.test.ts)
app/          Next.js App Router: (create)/, vēlāk (card)/, k/[id]/, api/cards/
components/   React komponentes (DrawPad, WriteFlow, Preview, GlyphGrid, TextStyle; vēlāk CardCanvas)
lib/          pārlūka puses palīgkods, kas nav komponente (project-store: IndexedDB caur idb)
scripts/      ģeneratori: letter-shapes.mjs (burtu formas), generate-guides.mjs (blāvie paraugi)
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
- Sesija (`core/project.ts`) ir `FontProject` plus atvērtā rakstzīme un 3. posma lauki (`variant`,
  `fresh`, `lap`, `ghost`); `FontProject` paliek kā PRD 10. sadaļā. IndexedDB: datubāze `rokraksts`, krātuve `session`, atslēga `current`. Ielādējot
  validē ar zod (`core/schema.ts`); nederīgs ieraksts nozīmē jaunu projektu.
- Neuzrakstītu burtu var izlaist: poga saucas "Izlaist", pēc pirmā vilciena "Tālāk" (rindas pēdējai
  zīmei "Gatavs"). Izlaistais paliek neuzrakstīts; aplis "Uzraksti vēlreiz" gaida visus 33.
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
  mezgli, starp tiem līkni dala, kamēr kļūda pārsniedz pielaidi. Pielaides 1,5 → 2,5 → 4 → 6 → 9 → 13 → 18
  vienības izmēģina pēc kārtas, līdz glifs ietilpst 60 punktos (lielākās vajag tikai lieliem, slīpiem
  glifiem; noklusējuma stilā pietiek ar 6). **"Punkts" šeit ir mezgls (segmenta
  galapunkts); vadības punktus neskaita.** Visas 99 etalona zīmes ietilpst arī ar galējiem stiliem.
- **`core/metrics.ts`.** Platums = robežkaste + `style.spacing` × 1000 katrā pusē (60 vienības); vieta
  laukumā platumu neietekmē. Augšējā un apakšējā robeža ir uzzīmētā galējie punkti, bet nekad nav
  šaurāka par laukuma līnijām (700 un −250), lai rindas augstums nelēkātu, kamēr uzrakstīti tikai zemi
  burti. `project.metrics` projektā netiek pārrakstīts; metriku vienmēr rēķina `compileFont`.
- **`core/font.ts`.** `compileFont(project, cache)` dod `CompiledFont`: katram variantam SVG ceļš
  (y uz leju, pamatlīnija 0, kreisā atstarpe no x = 0), platums un robežkaste. Kešs ir `WeakMap` pēc
  varianta objekta; tas strādā, jo `core/project.ts` jaunu objektu izveido tikai mainītajam burtam.
  Kontūras nekur neglabājam.
- **`core/layout.ts`.** NFC → aizstāšanas no kopas → atstarpju virknes saplūst → laušana pa vārdiem
  (pārāk garu vārdu pa burtiem). Atstarpe 300, neuzrakstīta zīme 420, trices rezerve 50 vienības pie
  `xHeight` 450; ar izmēru tās mērogojas proporcionāli `metrics.xHeight` (veseli skaitļi), tāpēc kartītei
  pietiek ar `Card.metrics`. Rindstarpa 1,15 × (augša − apakša). Variantu un trici nosaka `seed` (skat. "Latviešu burti"). Neuzrakstīta
  rakstzīme nonāk `layout.missing` ar rezervētu vietu un nekad netiek aizstāta ar citu glifu.
- **`core/render-svg.ts`.** Katrs izmantotais glifa variants vienreiz `<defs>`, tekstā `<use>` (ar trici
  `transform="matrix(...)"`, bez trices `x y`); neuzrakstītās
  zīmes ir blāvi rāmīši (`showMissing`). Ja vienā lapā ir vairāki SVG, katram vajag savu `idPrefix`.
- **Determinisms.** `layout` un `render-svg` lieto tikai veselu skaitļu aritmētiku un virkņu salikšanu,
  tāpēc tie ir bait-identiski visur (vienīgās decimāldaļas izvadē ir trices matricas koeficienti, salikti
  kā virknes no veseliem skaitļiem). `outline` lieto peldošā punkta matemātiku (`Math.hypot`, `exp`,
  `acos`) un tiek rēķināts tikai autora ierīcē; kartītē ceļo jau noapaļoti ceļi (`Card.outlines`).
  Serverī kontūras no vilcieniem nedrīkst pārrēķināt.
- **Priekšskatījums.** `components/Preview.tsx` zem laukuma rāda `previewText(session)`: lietotāja
  tekstu, ja tajā ir atvērtā zīme, citādi tās grupas paraugu (`charset.groupSamples`; mazajiem burtiem
  `sampleText`, pangramma bez punkta), lai rakstot lielos burtus, ciparus un pieturzīmes tās būtu
  redzamas. Pārrēķinās pēc katras sesijas izmaiņas. E2E:
  `tests/e2e/preview.spec.ts`, tikai telefona projektā, raksta ar CDP skārieniem.
- **Etalons.** `tests/fixtures/strokes.json` ģenerē `node tests/fixtures/generate-strokes.mjs`: sadaļā
  `glyphs` 33 mazie burti, `variants` 2. un 3. variants burtiem a i s e t u ā un 2. variants burtiem r ķ,
  `cases` gadījumi `cilpa`, `spiediens`, `punkts`, `svikajums`, un (4. posms) `more` pārējās 66 zīmes kā
  masīvs `[rakstzīme, vilcieni]` (objektā cipari nonāktu pirmie). Katra glifa trīce nāk no tā nosaukuma,
  tāpēc jaunas zīmes esošos vilcienus nemaina. `fixtureProject()` dod 33 mazos burtus (kā 3. posmā),
  `fixtureProject(fixtureAll)` visas 99, `{ variants: false }` pa vienam variantam; testi lasa tikai JSON
  caur `tests/fixtures/strokes.ts`. Momentuzņēmumi ir `tests/fixtures/snapshots/` (skatāmi SVG un
  `konturas.txt`); apzinātu izmaiņu pēc tos atjauno ar `npm test -- -u` un pārskata acīm.
- **Ātrums.** Etalona glifs uz izstrādes mašīnas pārrēķinās vidēji ap 2 ms, lēnākais (švīkājums) ap
  5 ms; tests prasa zem 25 ms (PRD slieksnis telefonam ir 50 ms). Īstā telefonā vēl nav mērīts.

## Latviešu burti (3. posms)

- **`core/random.ts`** ir vienīgais nejaušības avots izkārtotājā: `mix32` (jaucējfunkcija) un
  `createRandom` (mulberry32), tikai 32 bitu veselu skaitļu aritmētika (`Math.imul`, nobīdes, xor).
  `Math.random` un `Math.sin/cos` `layout`/`render-svg` ceļā nedrīkst parādīties. Vērtības ir piespraustas
  testos (inline momentuzņēmumi); ja tās mainās, mainās visas jau izveidotās kartītes.
- **`core/variants.ts`.** Variants = (`mix32(sēkla, 1, kodpunkts)` + rakstzīmes parādīšanās kārtas
  numurs) mod variantu skaits. Skaitītājs ir katrai rakstzīmei savs, tāpēc ar ≥ 2 variantiem divas
  secīgas parādīšanās vienmēr atšķiras. Katrs variants izkārtojumā aizņem savu platumu.
- **`core/trice.ts`.** Viss veselos skaitļos: `rotate` ir leņķa sinuss tūkstošdaļās (−26..26, tātad
  ≤ 1,49°), `scale` 981..1019 tūkstošdaļas, `shift` −10..10 vienības. Matrica `a = d = scale`,
  `b = (scale × rotate / 1000) | 0`, `c = −b`; kosinusu neskaita (kļūda < 0,035 %, zem režģa), tāpēc
  `scale` robeža ir par vienu tūkstošdaļu šaurāka par ±2 %. Griež ap glifa vidu uz pamatlīnijas.
  Trice ir atkarīga tikai no sēklas un rakstzīmes kārtas numura tekstā (skaitot arī neuzrakstītās,
  bez atstarpēm), nevis no kopīgas skaitļu virknes: jauna burta uzrakstīšana pārējo trici nemaina.
- **Trice SVG izvadē:** `<use href="#g0" transform="matrix(1.012 0.019 -0.019 1.012 3456 760)"/>`.
  `PlacedGlyph.matrix` ir seši veseli skaitļi (a–d tūkstošdaļās, e f vienībās); 5. posma canvas
  zīmētājam jālieto tā pati matrica. Ar trici izkārtojumam ir `TRICE_MARGIN` = 50 vienības virs
  pirmās un zem pēdējās rindas; starp rindām pietiek ar rindstarpas rezervi. Horizontāli glifu sargā
  sānu atstarpe (60); ja 4. posmā `style.spacing` var samazināt zem ~0,04, tas jāpārskata.
  `layoutText(..., { seed, trice })`: `seed` pēc noklusējuma 0, `trice: false` dod 2. posma izvadi
  bait-identiski (momentuzņēmums `pangramma-bez-trices.svg`).
- **Variantu ievade (`core/project.ts`).** `session.variant` ir atvērtā varianta indekss; `fresh` nozīmē,
  ka tā projektā vēl nav (jauns vai notīrīts) un pirmais vilciens to ieliek tieši vietā `variant`.
  Tāpēc Notīrīt + rakstīt no jauna pārzīmē variantu, nemainot pārējo secību. Tukšu variantu projektā
  neglabā nekad. `deleteVariant` neļauj izdzēst vienīgo variantu. Nemainītie variantu objekti paliek tie
  paši (kontūru kešs).
- **Variantu josla.** Zem uzvednes: pogas "1 2 3" (atvērt variantu), "+" (pievienot), "Dzēst variantu",
  un burtiem ar zīmi "Paraugs". Pārskats pār visu kopu ir 4. posma glifu režģis. `DrawPad` atslēga ir
  `rakstzīme/variants`, lai laika atskaite sāktos no jauna.
- **Aplis "Uzraksti vēlreiz".** Piedāvā, kad uzrakstīti visi 33 mazie burti un kādam vēl nav 3 variantu.
  Secība ir `lapOrder(charset)`: `frequentChars`, tad pārējie obligātie burti. Katram atver jaunu
  variantu; Tālāk drīkst arī bez vilcieniem (izlaist), Atpakaļ atver iepriekšējā burta pēdējo variantu,
  "Beigt apli" vai pēdējais burts atgriež pie pirmās neuzrakstītās rakstzīmes. Viens aplis dod vienu
  variantu; trešajam apli palaiž vēlreiz.
- **Blāvais paraugs** ir mūsu shematisks burts ar zīmi (ā č ē ģ ī ķ ļ ņ š ū ž), nevis lietotāja
  uzrakstītais pamatburts (īpašnieka lēmums 3. posmā; PRD 5. sadaļa izlabota). Dati ir
  `charset.guides` (`core/charsets/lv-guides.ts`, ģenerēts ar `node scripts/generate-guides.mjs` no
  `scripts/letter-shapes.mjs`; ar roku nelabot): lauztas līnijas veselos skaitļos, pēdējais vilciens ir
  zīme. Burtiem ķ ļ ņ komats ir zem pamatlīnijas un nav savienots ar burtu, mazajam ģ zīme ir augšā.
  `guideStrokes(session)` → `DrawPad` prop `guide`, zīmēts ar necaurredzamību 0,16; `onStroke` to
  neredz, tāpēc glifā tas nenonāk. `session.ghost` pēc noklusējuma ir ieslēgts, poga "Paraugs" to
  izslēdz, un izvēle glabājas sesijā. Lielajiem burtiem (Ā Č Ē Ģ Ī Ķ Ļ Ņ Š Ū Ž) paraugs ir kopš 4. posma:
  garumzīme un jumtiņš brīvajā joslā virs 700, Ģ Ķ Ļ Ņ komats apakšā. Tās pašas formas lieto etalona
  ģenerators, tāpēc pēc formu maiņas jāpārģenerē abi un `strokes.json` izmaiņas jāpārskata.
- **Priekšskatījums** lieto nemainīgu `PREVIEW_SEED` = 1. Pievienojot variantu, burti rindā pabīdās
  (cits platums), bet pārējo burtu kontūra, rotācija un mērogs paliek.
- **E2E:** `tests/e2e/variants.spec.ts` (tikai telefona projektā): variantu pievienošana, pārzīmēšana,
  dzēšana; blāvais paraugs (arī komata vieta burtiem ķ un ģ); visi 33 burti, aplis un pangramma bez
  tukšiem rāmīšiem.
- **Nav pārbaudīts:** īstā telefonā; trices izskats ar īstu rokrakstu (etalons ir ģenerēts).

## Pielāgošana un pārējās zīmes (4. posms)

- **Pārējās zīmes.** Pēc 33 mazajiem burtiem secība turpinās ar q w x y, lielajiem burtiem, cipariem un
  pieturzīmēm; tās raksta, kad vajag, un jebkuru zīmi var izlaist. Progress "58 no 99" ir galvenē.
  `scripts/letter-shapes.mjs` ir shematiskas formas visām 99 zīmēm (`moreShapes` ir masīvs tās pašas
  ciparu secības dēļ).
- **Stils (`core/style.ts`).** `STYLE_LIMITS`: biezums 0,5–2 (solis 0,1), atstarpes 0,04–0,16 (0,01),
  izmērs 0,8–1,25 (0,05), slīpums −0,2–0,35 (0,05). `normalizeStyle` pievelk un noapaļo (arī ielādējot).
  Stils mainās tikai kontūru būvē, nekad `layout`/`render-svg`:
  - **Slīpums ir nobīdes koeficients (tangenss), nevis grādi.** Pēc vilcienu apvienošanas katrs
    poligona punkts (veseli skaitļi) tiek pārveidots ar `s` (izmērs) un `k` (slīpums) tūkstošdaļās:
    `y' = round(y·s / 1000)`, `x' = round((x·s·1000 + (y·s − 225·1000)·k) / 10⁶)`. Tikai veselu
    skaitļu reizinājumi un viena dalīšana, bez `tan`. Slīpums griežas ap mazo burtu augstuma vidu (225).
    Platums nāk no slīpās robežkastes, tāpēc nekas netiek nogriezts. Saskarne rāda aptuvenos grādus.
  - **Izmērs** mērogo kontūru (arī līnijas biezumu) un laukuma līniju minimumus metrikā
    (`fontMetrics(bounds, style)`); atstarpe, tukšā vieta un trices rezerve aug līdzi caur `xHeight`.
  - Sānu atstarpe (`spacing`) nemērogojas ar izmēru. Minimums 0,04 ir pārbaudīts: ar galējiem stiliem
    un 25 sēklām neviens glifs ar trici neiziet ārpus attēla (`core/render-svg.test.ts`). Ja minimumu
    samazina, jāpārskata `TRICE_MARGIN` un sānu robežas.
  - Stila maiņa pārrēķina visus glifus (kešs ir pēc stila). `WriteFlow` kompilē fontu ar
    `useDeferredValue`, lai slīdnis paliek atsaucīgs; tāpēc e2e priekšskatījuma izmaiņas gaida ar
    `expect.poll` vai atkārtojošiem pieņēmumiem.
- **Sesija.** Jauni lauki `text` (lietotāja teksts, paliek ierīcē, līdz 500 zīmēm) un `queue`
  (trūkstošo zīmju rinda); vecs ieraksts ielādējas ar noklusējumiem. `openChar(s, char, variant)`
  atver jebkuru zīmi (pārtrauc apli un rindu). `textMissing(project, text)` sagatavo tekstu tāpat kā
  izkārtotājs un dod `writable` (neuzrakstītās kopas zīmes) un `unsupported` (nav kopā). `startQueue`
  ņem tikai neuzrakstītās; Tālāk iet pa rindu, pēc pēdējās `endQueue` atver pirmo neuzrakstīto.
  Neuzrakstīts "Ā" ir neuzrakstīts arī tad, ja ir "A" un "ā"; aizstāšanas nav nekur.
- **Saskarne.** Galvenē progress un divi skati blakus rakstīšanai:
  - **"Visas zīmes" (`components/GlyphGrid.tsx`).** Izvēlējos glifu režģi, nevis vienkāršāku sarakstu:
    tas ir PRD 9. sadaļā, 99 zīmes raksta ārpus kārtas, un vajag vienu vietu, kur redzēt, kas uzrakstīts
    (pa grupām "n no m"), cik variantu un kā tas izskatās. Šūnā ir pirmais variants vai blāva
    rakstzīme; pieskāriens atver zīmi.
  - **"Teksts un stils" (`components/TextStyle.tsx`).** Savs teksts, liels priekšskatījums, "Trūkst N
    zīmes: …" ar pogu "Uzrakstīt" (atver rindu) un četri slīdņi. Pēc rindas pēdējās zīmes ("Gatavs")
    vai "Beigt" atgriežas šeit.
  - **Viena pieskāriena pārzīmēšana:** pieskāriens glifam priekšskatījumā (abos skatos) atver tieši to
    rakstzīmi un variantu; pieskāriens tukšam rāmītim atver neuzrakstīto zīmi. Trāpījumu nosaka
    `Preview` pēc izkārtojuma datiem; SVG izvade nemainās.
- **E2E:** `tests/e2e/zimes.spec.ts` (tikai telefona projektā): trūkstošo zīmju rinda, "Ā" nav ne "A",
  ne "ā", stils (izmaiņa redzama, glifi iekš attēla, saglabājas), režģis, lielo burtu paraugi,
  pieskāriens priekšskatījumam. Momentuzņēmumi `etalona-teksti.svg` (visi trīs PRD 12. sadaļas teksti)
  un `stils.svg`.
- **Nav pārbaudīts:** stila pārrēķina ātrums ar pilnu kopu īstā telefonā. Izstrādes mašīnā visa etalona
  kopa (115 varianti) pēc stila maiņas pārrēķinās 180–250 ms; telefonā tas var būt sekunde, tāpēc
  slīdnis strādā caur `useDeferredValue`. Ja ar to nepietiek, nākamais solis ir pārrēķināt tikai
  tekstā redzamos glifus vai pārnest kompilēšanu uz Web Worker.

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
