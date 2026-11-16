# Rokraksta fonts latviešu valodai — PRD

Nov 16, 2026 · @Aigars Grenins

## 1. Kopsavilkums

Tīmekļa lietotne (mobile-first PWA), kurā cilvēks ar pirkstu vai irbuli uzraksta burtus uz ekrāna, dažās minūtēs iegūst fontu savā rokrakstā ar pilnu latviešu alfabētu un ar to izveido digitālu apsveikumu, ko saņēmējs var atvērt jebkurā ierīcē. Darba nosaukums: **Rokraksts**.

Esošie rīki (Calligraphr, FontCrafter, [Ductus](https://ductus.sorenblank.com)) beidzas pie fonta faila un neatbalsta latviešu burtus bez papildu darba. Šis produkts atšķiras divās vietās: latviešu alfabēts ir iebūvēts no pirmā soļa (katru burtu, arī ā, č un ķ, lietotājs uzraksta pats, vairākos variantos), un fonts ir tikai līdzeklis, bet rezultāts ir nosūtāms apsveikums.

**Mērķi**

- No pirmā burta līdz gatavam apsveikumam telefonā mazāk nekā 5 minūtēs, bez konta.
- Visi 33 latviešu alfabēta burti (mazie un lielie) izskatās pareizi, ieskaitot komatveida mīkstinājuma zīmes.
- Apsveikums izskatās identiski jebkurā ierīcē un lietotnē, jo saņēmējam fonts nav jāinstalē.
- Rokraksts pēc noklusējuma paliek lietotāja ierīcē; uz serveri nonāk tikai tas, ko lietotājs apzināti kopīgo.

**Ne-mērķi (MVP)**

- Pilns saistītais raksts ar kontekstuāliem savienojumiem.
- Fontu redaktors ar Bezjē līkņu labošanu.
- Natīvās iOS/Android lietotnes, konti, maksājumi.
- Citas valodas. Rakstzīmju kopa tomēr jāveido kā dati, lai lietuviešu un igauņu valodu vēlāk varētu pievienot bez koda pārrakstīšanas.

## 2. Lietotāji un scenāriji

Galvenais lietotājs ir privātpersona, kas grib nosūtīt personīgu apsveikumu, nevis fontu entuziasts.

| Loma | Ko grib | Kas viņam svarīgs |
| --- | --- | --- |
| Sūtītājs | Apsveikt Ziemassvētkos, dzimšanas dienā, vārda dienā, Līgo, izlaidumā | Ātri, telefonā, bez reģistrācijas; rezultāts izskatās kā viņa rokraksts |
| Saņēmējs | Atvērt apsveikumu WhatsApp, Messenger, e-pastā vai SMS saitē | Nekas nav jāinstalē; teksts ir salasāms; saite izskatās uzticama |
| Fonta lietotājs (sekundārs) | Lejupielādēt OTF/WOFF2 un lietot Word, Canva, savā mājaslapā | Latviešu burti strādā visās programmās |

**Galvenie scenāriji**

1. Anna telefonā uzraksta alfabētu, ieraksta "Priecīgus Ziemassvētkus, omiņ!", izvēlas fonu un nosūta attēlu WhatsApp.
2. Jānis izveido apsveikumu kā saiti; saņēmējs to atver pārlūkā un redz, kā teksts "uzrakstās" (vēlākais posms).
3. Lietotājs atgriežas pēc mēneša: fonts joprojām ir viņa ierīcē, un jauns apsveikums top 30 sekundēs.
4. Skolotāja lejupielādē savu fontu un lieto to darba lapās.

## 3. MVP tvērums

MVP ir plūsma "uzraksti burtus, ieraksti tekstu, nosūti attēlu vai saiti"; viss pārējais nāk pēc tam.

| Joma | MVP | Vēlāk |
| --- | --- | --- |
| Burtu ievade | Zīmēšana uz ekrāna (pirksts, irbulis, pele) | Fotografiēts papīra šablons |
| Rakstzīmes | Latviešu alfabēts, q w x y, cipari, pamata pieturzīmes | Lietuviešu, igauņu; papildu simboli |
| Diakritika | Katru burtu ar zīmi (ā, č, ķ …) lietotājs uzraksta pats kā atsevišķu burtu | Lietuviešu un igauņu burti pēc tā paša principa |
| Varianti | Līdz 3 variantiem katrai rakstzīmei, maiņa pēc kārtas, viegla "trice" | Varianti arī eksportētajā fontā; vairāk variantu biežākajiem burtiem |
| Savienojumi | Atsevišķi burti; ieejas/izejas palīgpunkti laukumā | Ligatūras biežākajiem pāriem; saistītais raksts |
| Apsveikums | Teksts + 6–8 foni, 3 formāti, PNG | Animēta "rakstīšana", mūzika, PDF drukai |
| Kopīgošana | Attēls caur sistēmas Share + publiska saite | E-pasta izsūtīšana, plānota nosūtīšana |
| Fonta eksports | OTF un WOFF2 | TTF, varianti fontā (`calt`) |
| Glabāšana | Lokāli (IndexedDB); serveris tikai kopīgotām kartītēm | Konti, sinhronizācija starp ierīcēm |
| Valoda | Latviešu saskarne | Angļu, lietuviešu, igauņu |

## 4. Lietotāja plūsma

Plūsmas galvenais princips: priekšskatījums ir redzams jau pēc pirmajiem burtiem, un nevienu burtu nav jāzīmē, pirms tas ir vajadzīgs.

1. **Sākums.** Viena poga "Sākt rakstīt". Nav konta, nav sīkdatņu sienas.
2. **Pamācība (10 sekundes).** Parāda laukumu ar četrām līnijām (augšējā, mazo burtu augstums, pamatlīnija, apakšējā) un lūdz uzrakstīt vienu pārbaudes burtu.
3. **Latviešu alfabēta mazie burti.** 33 burti alfabēta secībā (a, ā, b, c, č …), katrs uzrakstīts pilnībā kopā ar savu garumzīmi, jumtiņu vai komatu. Uzvedne "Raksti mazo ā", pogas Atpakaļ, Atsaukt, Notīrīt, Tālāk. Zem laukuma visu laiku redzams parauga teksts jaunajā rokrakstā.
4. **Pirmais apsveikums.** Lietotājs jau tagad var ierakstīt tekstu. Ja tekstā ir neuzrakstīta rakstzīme (piemēram, "P" vai "!"), lietotne parāda "Trūkst 2 zīmes" un atver rakstīšanu tieši tām.
5. **Varianti (pēc izvēles).** Aplis "Uzraksti vēlreiz": katram burtam līdz 3 variantiem, sākot ar biežākajiem. Priekšskatījumā uzreiz redzams, ka atkārtoti burti vairs nav vienādi.
6. **Pārējās rakstzīmes (pēc izvēles).** q w x y, 37 lielie burti, cipari, pieturzīmes. Progress redzams kā "58 no 99".
7. **Pielāgošana.** Līnijas biezums, burtu atstarpes, izmērs, slīpums; atsevišķa burta vai varianta pārzīmēšana ar vienu pieskarienu.
8. **Kartītes redaktors.** Teksts, fons, formāts (kvadrāts, portrets, stāsts), tintes krāsa, līdzinājums; poga "Sajaukt", kas maina sēklu un līdz ar to variantu izkārtojumu.
9. **Kopīgošana.** "Sūtīt kā attēlu" (sistēmas Share) vai "Izveidot saiti". Pirms saites izveides parāda, kas tiks augšupielādēts.
10. **Eksports (pēc izvēles).** Lejupielādēt OTF/WOFF2 un projekta failu (JSON), ko vēlāk var iemest atpakaļ lietotnē.

## 5. Rakstzīmju kopa un latviešu specifika

Lietotājs pats uzraksta katru rakstzīmi, arī burtus ar garumzīmēm, jumtiņiem un mīkstinājuma zīmēm; nekas netiek salikts automātiski. Pilnā kopa ir 99 rakstzīmes, un katrai var būt līdz 3 variantiem.

| Grupa | Skaits | Saturs | Kad jāuzraksta |
| --- | --- | --- | --- |
| Latviešu alfabēta mazie burti | 33 | a ā b c č d e ē f g ģ h i ī j k ķ l ļ m n ņ o p r s š t u ū v z ž | Pirms pirmās kartītes |
| Papildu mazie burti | 4 | q w x y | Kad parādās tekstā |
| Lielie burti | 37 | A Ā B C Č … Z Ž un Q W X Y | Kad parādās tekstā |
| Cipari | 10 | 0–9 | Kad parādās tekstā |
| Pieturzīmes | 15 | . , ! ? : ; - – ( ) „ “ ' & ♥ | Kad parādās tekstā |

**Noteikumi**

- **Katrs burts ir patstāvīgs glifs.** "ā" ir atsevišķs zīmējums ar savu kodpunktu (U+0101), nevis "a" plus zīme. Tā saglabājas cilvēka paša veids, kā viņš velk garumzīmi vai komatu un kur to novieto.
- **Alfabēta secība.** Uzvednes iet secībā a, ā, b, c, č …, lai burts ar zīmi tiktu rakstīts uzreiz pēc pamatburta un sanāktu tajā pašā rokā.
- **Blāvs paraugs (pēc izvēles).** Rakstot "ā", laukumā var ieslēgt blāvu tikko uzrakstītā "a" attēlu kā orientieri. Tas ir tikai fons; glifā nonāk tikai jaunie vilcieni.
- **Vieta zīmēm.** Laukumā ir brīva josla virs augšējās līnijas (Ā, Č, ģ) un zem pamatlīnijas (ķ, ļ, ņ, Ģ). Fonta vertikālo metriku aprēķina no faktiski uzzīmētā augstākā un zemākā punkta, lai zīmes netiktu nogrieztas.
- **Komats, nevis sedija.** Uzvednes paraugs burtiem ķ ļ ņ ģ rāda komatu, kas nav savienots ar burtu; mazajam ģ zīme ir augšā.
- **Normalizācija.** Ievadīto tekstu pirms attēlošanas normalizē uz NFC, lai "a + kombinējamā garumzīme" kļūtu par "ā".
- **Aizstāšana.** `"` un `”` attēlo ar “ glifu, `—` ar `–`, `…` ar trim punktiem.
- **Trūkstošas zīmes.** Neuzrakstīts "ā" nekad netiek aizstāts ar "a". Jebkura neuzrakstīta zīme bloķē kopīgošanu, līdz tā uzrakstīta vai izņemta no teksta. Emocijzīmes attēlo ar sistēmas fontu.
- **Kopa kā dati.** Rakstzīmju saraksts, secība, kodpunkti un uzvedņu teksti dzīvo vienā konfigurācijas failā katrai valodai (`charsets/lv.ts`).

## 6. No vilcieniem līdz fontam

Patiesības avots ir lietotāja vilcieni (punkti ar laiku un spiedienu), nevis gatavas kontūras; kontūras un fonta failu vienmēr var pārēķināt no jauna.

Tas dod trīs lietas: līnijas biezumu var mainīt pēc uzzīmēšanas, vilcienu secību vēlāk var izmantot "rakstīšanas" animācijai, un konveijeru var uzlabot, neprasot lietotājam zīmēt vēlreiz.

1. **Tveršana.** Pointer Events (ar `getCoalescedEvents`), `touch-action: none`. Katrs punkts: x, y, laiks, spiediens (ja ierīce to dod). Koordinātas uzreiz pārvērš fonta vienībās (1000 vienības uz em), pamatlīnija ir y = 0.
2. **Vilciens uz kontūru.** No punktiem ģenerē mainīga platuma līnijas kontūru (bibliotēka `perfect-freehand`); ja spiediena nav, platumu simulē no ātruma.
3. **Apvienošana.** Viena burta vilcienu kontūras apvieno vienā formā bez pārklājumiem (`paper.js` vai `polygon-clipping`), izlīdzina kontūru virzienus.
4. **Vienkāršošana.** Poligonu pārvērš Bezjē līknēs ar pielaidi; mērķis ir zem 60 punktiem uz glifu.
5. **Metrika.** Augšējā un apakšējā robeža, mazo un lielo burtu augstums nāk no laukuma līnijām. Glifa platums = robežkaste + sānu atstarpes (noklusējums 6% no em katrā pusē, globāli regulējams). Kerninga MVP nav.
6. **Varianti.** Kontūru rēķina katram uzrakstītajam variantam; izkārtotājs katrai rakstzīmei izvēlas vienu no tiem (7. sadaļa).
7. **Izkārtojums.** Pašu teksta izkārtotājs: teksts → glifu secība ar pozīcijām (rindu laušana pa vārdiem, līdzinājums, rindstarpa). To lieto priekšskatījums, kartītes un kopīgošanas lapa.
8. **Fonta eksports.** `opentype.js` būvē OTF; WOFF2 saspiešanai `wawoff2` (Brotli WASM). Fonta nosaukumu ievada lietotājs; `name` tabulā ieraksta izveides datumu un rīka nosaukumu.

**Lēmums: kartītes zīmējam paši, nevis ar fontu.** Kartītes un kopīgošanas lapa attēlo glifu kontūras tieši (SVG/canvas) caur savu izkārtotāju. Fonta fails ir tikai eksporta formāts. Ieguvumi: nav fonta ielādes un rezerves fonta problēmu, variantu maiņu un "trici" kontrolējam paši bez OpenType funkcijām, un viena un tā pati kartīte visur izskatās identiski. Cena: izkārtotājs jāraksta pašiem, bet kartīšu tekstam tas ir vienkāršs.

**Jāpārbauda izstrādes sākumā:** vai `opentype.js` spēj ierakstīt GSUB funkcijas (`calt`, `liga`), kas vajadzīgas variantiem eksportētajā fontā. Ja nespēj, rezerves ceļš ir `fontTools` servera funkcijā vai caur Pyodide. MVP to nebloķē: kartītēs variantus maina mūsu izkārtotājs, un eksportētais fonts sākumā satur katras rakstzīmes pirmo variantu.

## 7. Burtu savienojumi un varianti

Burti ir atsevišķi, un dabiskumu dod varianti: katru burtu var uzrakstīt līdz 3 reizēm, un izkārtotājs variantus maina, lai divi vienādi burti tekstā neizskatītos identiski.

- **Variantu ievade (MVP).** Pirmais variants ir obligāts, otrais un trešais pēc izvēles jebkurai rakstzīmei, arī burtiem ar zīmēm, cipariem un pieturzīmēm. Glifu režģī katram burtam redzams variantu skaits; pieskaroties var pievienot, pārzīmēt vai dzēst variantu.
- **Otrais aplis.** Pēc alfabēta pabeigšanas lietotne piedāvā "Uzraksti vēlreiz" un sāk ar latviešu tekstā biežākajiem burtiem (a, i, s, e, t, u, ā). Apli var pārtraukt jebkurā brīdī.
- **Varianta izvēle (MVP).** Izkārtotājs katrai rakstzīmei tur skaitītāju un ņem nākamo variantu pēc kārtas; sākuma nobīde nāk no kartītes sēklas. Ja burtam ir vismaz 2 varianti, divas secīgas tā paša burta parādīšanās vienmēr atšķiras.
- **"Trice" (MVP).** Papildus variantiem katram glifam pieliek nelielu nobirzi: rotācija līdz ±1,5°, mērogs līdz ±2%, pamatlīnija līdz ±1% no em. Nobirzes nāk no pseidonejauša ģeneratora ar to pašu sēklu, tāpēc kartīte visur izskatās vienādi.
- **Eksportētais fonts.** MVP fonta failā ir katras rakstzīmes pirmais variants. Variantu maiņa pašā fontā prasa OpenType funkciju `calt` un nāk pēc MVP (skat. 6. sadaļas pārbaudi).
- **Ieejas un izejas palīgpunkti.** Zīmēšanas laukumā uz pamatlīnijas kreisajā un labajā malā ir divi blāvi punkti. Kas grib saistītāku rakstu, sāk un beidz vilcienu tajos; kas negrib, tos ignorē.
- **Ligatūras (vēlāk).** Atsevišķi rakstīti biežākie burtu pāri; kuri, nosaka ar biežuma analīzi latviešu tekstu korpusā.
- **Saistītais raksts (izpēte).** Prasa vairākas katra burta formas atkarībā no iepriekšējā burta izejas augstuma. Nav plānots, kamēr nav pierādījumu, ka lietotāji to grib.

## 8. Apsveikumi un saderība ar ierīcēm

Saņēmēja ierīcei nekad nav jāzina lietotāja fonts: apsveikums nonāk vai nu kā attēls, vai kā tīmekļa lapa ar iezīmētām kontūrām.

| Kanāls | Kā top | Kur strādā | Posms |
| --- | --- | --- | --- |
| Attēls (PNG) | Kartīti uzzīmē uz canvas lietotāja ierīcē un nodod `navigator.share` ar failu; rezervē lejupielāde | Visur: WhatsApp, Messenger, iMessage, e-pasts, sociālie tīkli | MVP |
| Saite | Kartītes dati (teksts, izkārtojums, tikai izmantoto glifu kontūras) glabājas serverī; lapa `/k/{id}` zīmē SVG | Jebkurš mūsdienu pārlūks | MVP |
| Animēta saite | Tas pats, bet vilcieni parādās rakstīšanas secībā | Jebkurš mūsdienu pārlūks | Vēlāk |
| PDF drukai | Vektoru PDF A6/A5 formātā | Druka | Vēlāk |
| Fonta fails | OTF/WOFF2 lejupielāde | Tikai ierīcēs, kur fonts instalēts vai iegults | MVP |

**Prasības**

- **Formāti.** Kvadrāts 1080×1080, portrets 1080×1350, stāsts 1080×1920. PNG zem 1 MB.
- **Saites priekšskatījums.** Izveidojot saiti, klients augšupielādē arī 1200×630 attēlu, ko lapa norāda kā `og:image`, lai saite čatos rādītu kartīti, nevis tukšu lodziņu.
- **Pieejamība.** Kopīgošanas lapā pilns teksts ir pieejams ekrāna lasītājiem (`aria-label` uz SVG un slēpts teksta elements); attēlam teksts tiek piedāvāts kā alt apraksts.
- **Salasāmība.** Minimālais burtu izmērs kartītē atbilst 28 px pie 1080 px platuma; tintes un fona kontrasts vismaz 4,5:1. Redaktors neatļauj to pārkāpt.
- **Determinisms.** Viena kartīte (teksts + glifi + sēkla) dod bait‑identisku SVG jebkurā ierīcē.
- **Kopīgošanas lapa.** Zem 150 KB, bez fontu ielādes, strādā ar izslēgtu JavaScript (SVG ģenerēts serverī). Apakšā neuzbāzīga saite "Izveido savu".
- **Ko nedarīt.** Nelietot Unicode "fancy text" simbolus un nelūgt saņēmējam instalēt fontu.

## 9. Arhitektūra un tehnoloģijas

Lietotne ir local-first: visa fonta veidošana notiek pārlūkā, un serveris vajadzīgs tikai kopīgotām kartītēm.

| Slānis | Izvēle | Piezīmes |
| --- | --- | --- |
| Ietvars | Next.js (App Router) + TypeScript | Tas pats steks, kas STG; kopīgošanas lapa tiek renderēta serverī |
| Stils | Tailwind CSS |  |
| Lokālā glabāšana | IndexedDB (caur `idb` vai Dexie) | Projekts, glifi, kartīšu melnraksti |
| Servera dati | Supabase: Postgres + Storage | Tikai tabula `cards` un OG attēli |
| Fonta kodols | `perfect-freehand`, `paper.js` vai `polygon-clipping`, `opentype.js`, `wawoff2` | Versijas un API jāpārbauda izstrādes sākumā |
| Validācija | `zod` | Projekta un kartītes shēmas, arī importējot JSON |
| Testi | Vitest (kodols), Playwright (plūsmas, vīzuālie momentuzņēmumi) |  |
| Uzraudzība | Sentry | Bez vilcienu datiem kļūdu ziņojumos |
| Izvietošana | Vercel vai Cloudflare |  |

**Repozitorija struktūra**

```
/core            tīrs TypeScript bez DOM; 100% testējams
  types.ts         Point, Stroke, Glyph, FontProject, Card
  charsets/lv.ts   rakstzīmju kopa, secība, uzvednes
  outline.ts       vilcieni -> kontūra (4.–6. solis)
  metrics.ts       platumi, vertikālā metrika
  variants.ts      varianta izvēle katrai rakstzīmei
  layout.ts        teksts -> novietoti glifi (ar sēklu)
  render-svg.ts    novietoti glifi -> SVG virkne
  export-font.ts   OTF / WOFF2
/app             Next.js
  (create)/        burtu ievade, pielāgošana
  (card)/          kartītes redaktors, kopīgošana
  k/[id]/          publiskā kartītes lapa (SSR)
  api/cards/       izveide, dzēšana
/components      DrawPad, GlyphGrid, Preview, CardCanvas
/tests           vienotie un e2e testi, etalona vilcienu komplekts
```

**Robežas.** `core` nezina par React, pārlūku vai Supabase. Tas pats `layout` un `render-svg` kods darbojas klientā (priekšskatījums, PNG) un serverī (kopīgošanas lapa), kas garantē vienādu rezultātu.

## 10. Datu modelis, privātums un drošība

Pilns rokraksts nekad neatstāj ierīci; kopīgota kartīte satur tikai to glifu kontūras, kas izmantoti tās tekstā.

```ts
type Point  = { x: number; y: number; t: number; p?: number }  // fonta vienības, ms, spiediens 0..1
type Stroke = { points: Point[] }

type GlyphVariant = {
  strokes: Stroke[]
  advance?: number            // ja lietotājs pielāgojis platumu
}

type Glyph = {
  char: string                // viena NFC rakstzīme: 'a', 'ā', 'Ķ', '!' ...
  variants: GlyphVariant[]    // 1..3; pirmais ir obligāts
}

type FontProject = {
  id: string
  schemaVersion: 1
  name: string
  charset: 'lv'
  createdAt: string
  metrics: { upm: 1000; ascender: number; descender: number; xHeight: number; capHeight: number }
  style: { strokeWidth: number; spacing: number; slant: number; scale: number }
  glyphs: Record<string, Glyph>      // atslēga = rakstzīme
}

type Card = {
  id: string
  schemaVersion: 1
  text: string                // NFC
  format: 'square' | 'portrait' | 'story'
  templateId: string
  ink: string                 // hex
  align: 'left' | 'center'
  seed: number                // nosaka variantu secību un trici
  metrics: FontProject['metrics']
  outlines: Record<string, string[]> // rakstzīme -> SVG path katram variantam; tikai tekstā izmantotās
}
```

**Servera tabula `cards`**

| Kolonna | Tips | Piezīme |
| --- | --- | --- |
| `id` | text, PK | Nejaušs, vismaz 12 simboli; nav uzmināms |
| `payload` | jsonb | `Card` objekts, validēts ar `zod`, līdz 200 KB |
| `og_image_path` | text | Fails Supabase Storage |
| `delete_token_hash` | text | Dzēšanas atslēga glabājas tikai autora ierīcē |
| `created_at`, `expires_at` | timestamptz | Noklusējuma termiņš 12 mēneši |

**Noteikumi**

- Tabulai ir ieslēgts RLS bez publiskām politikām; lasīšana un rakstīšana notiek tikai caur servera maršrutiem ar servisa atslēgu. Sarakstu iegūt nevar, tikai vienu kartīti pēc `id`.
- Kartītes izveidei ir ātruma ierobežojums pēc IP un izmēra ierobežojums.
- Pirms pirmās saites izveides lietotājs redz, kas tiks augšupielādēts, un piekrīt. Autors saiti var dzēst jebkurā laikā.
- Kopīgošanas lapā ir `noindex` un poga "Ziņot".
- Lietotne nepiedāvā paraksta glifu un pie eksporta atgādina, ka fonts atdarina rokrakstu.
- Projekta JSON eksports un imports ir vienīgā rezerves kopija, kamēr nav kontu; lietotne to atgādina pēc fonta pabeigšanas.
- Analītika bez sīkdatņēm un bez vilcienu vai teksta satura.

## 11. Izstrādes posmi

Astoņi posmi, katrs ar pārbaudāmu rezultātu; posmi 0–5 veido lietojamu produktu bez servera.

| Posms | Kas top | Gatavs, kad |
| --- | --- | --- |
| 0. Pamats | Next.js + TypeScript projekts, Vitest, Playwright, lint, CI, `CLAUDE.md` ar šī dokumenta lēmumiem | `npm test` un `npm run build` iziet tīri |
| 1. Zīmēšanas laukums | `DrawPad` ar līnijām un palīgpunktiem, Atsaukt/Notīrīt, burtu secība, glabāšana IndexedDB | Telefonā var uzrakstīt 26 burtus, pārlādēt lapu un turpināt; lapa neritinās zīmējot |
| 2. Kodols | `outline`, `metrics`, `layout`, `render-svg`; dzīvs priekšskatījums zem laukuma | Etalona vilcienu komplekts dod stabilus SVG momentuzņēmumus; glifs pārrēķinās zem 50 ms |
| 3. Latviešu burti | Visi 33 latviešu mazie burti alfabēta secībā ar vietu zīmēm laukumā, blāvais paraugs, variantu ievade (līdz 3) un maiņa izkārtotājā (`variants`) | Pangramma no 12. sadaļas, rakstīta ar mazajiem burtiem un bez punkta, attēlojas pilnībā; atkārtoti burti izmanto dažādus variantus; zīmes netiek nogrieztas |
| 4. Pielāgošana un pārējās zīmes | Lielie burti, cipari, pieturzīmes; biezums, atstarpes, slīpums; "trūkst zīmes" plūsma | Jebkurš teksts no kopas attēlojas; trūkstošā zīme atver savu zīmēšanu |
| 5. Kartīte un attēls | Redaktors, foni, 3 formāti, PNG, `navigator.share` | Kartīte no iPhone un Android aiziet uz WhatsApp kā attēls |
| 6. Saite | Supabase tabula, API, `/k/[id]` ar SSR, OG attēls, dzēšana, ziņošana | Saite čatā rāda priekšskatījumu; lapa atveras bez JavaScript; dzēsta kartīte atgriež 404 |
| 7. Fonta eksports un noslīpēšana | OTF/WOFF2, projekta JSON eksports/imports, PWA, saskarnes teksti, pieejamība | Fonts instalējas macOS un Windows un raksta latviski Word un Pages |

**Pēc MVP, prioritātes secībā:** varianti eksportētajā fontā; animēta rakstīšana kopīgošanas lapā; sezonas šabloni; PDF drukai; lietuviešu un igauņu kopas; konti un sinhronizācija; ligatūras.

**Darbam ar Claude Code**

- Šo dokumentu ieliec repozitorijā kā `docs/PRD.md` (eksports uz Markdown), un `CLAUDE.md` norādi uz to kā patiesības avotu.
- Vienu posmu vienā sesijā; katru posmu sāc ar plānu un beidz ar zaļiem testiem.
- 2. un 3. posmu raksti ar testiem pa priekšu: `core` ir tīrs TypeScript, un etalona vilcienu komplekts (`tests/fixtures/strokes.json`) dod atkārtojamus rezultātus bez pārlūka.
- 0. posmā uzdod pārbaudīt bibliotēku aktuālās versijas un API, īpaši `opentype.js` rakstīšanas iespējas un `wawoff2`.

## 12. Akceptēšana un testēšana

MVP ir gatavs, kad cilvēks bez pamācības telefonā 5 minūtēs izveido un nosūta latvisku apsveikumu, kas saņēmējam izskatās pareizi.

**Etalona teksti**

- Pangramma ar visiem 11 diakritiskajiem burtiem: "Glāžšķūņa rūķīši dzērumā čiepj Baha koncertflīģeļu vākus."
- Lielie burti: "ĀBOLU ČIEKURS ĒNA ĢIMENE ĪSS ĶERRA ĻOTI ŅEM ŠŪPOĻU ŪDENS ŽOGS".
- Apsveikums ar pieturzīmēm un cipariem: "Daudz laimes 30. dzimšanas dienā, Mārīt! ♥"

**Kvalitātes sliekšņi**

| Kas | Slieksnis |
| --- | --- |
| Laiks līdz pirmajai kartītei (33 burti + teksts) | Zem 5 minūtēm jaunam lietotājam |
| Glifa pārrēķins pēc vilciena | Zem 50 ms vidējas klases telefonā |
| Pilna fonta būve (OTF + WOFF2) | Zem 2 sekundēm |
| WOFF2 izmērs pilnai kopai | Zem 80 KB |
| Kopīgošanas lapas svars | Zem 150 KB |
| PNG izmērs | Zem 1 MB |

**Pārbaudes**

- [ ] Vienotie testi `core`: kontūras, metrika, variantu maiņa (secīgi vienādi burti atšķiras), vertikālā metrika ar zīmēm, izkārtojums, NFC normalizācija.
- [ ] Determinisms: viena kartīte dod identisku SVG klientā un serverī (koordinātas noapaļotas līdz veseliem skaitļiem pirms izvades).
- [ ] Eksportētais fonts: atveras ar `fontTools` bez kļūdām, iziet OpenType Sanitizer, satur visus kopas kodpunktus.
- [ ] Fonts pārlūkos: Chrome, Safari, Firefox attēlo pangrammu ar `@font-face`.
- [ ] Ierīces: iPhone Safari, Android Chrome, iPad ar irbuli, galddators ar peli.
- [ ] Saņemšana: attēls un saite pārbaudīti WhatsApp, Messenger, iMessage, Gmail.
- [ ] Pieejamība: kopīgošanas lapu ekrāna lasītājs nolasa kā tekstu; saskarne lietojama ar tastatūru.
- [ ] Lietojamības tests ar 5 cilvēkiem, kas nav izstrādātāji.

## 13. Riski un atvērtie jautājumi

Lielākais risks ir rokraksta kvalitāte, zīmējot ar pirkstu mazā ekrānā; tas jāpārbauda ar īstiem cilvēkiem jau pēc 2. posma.

| Risks | Ko darām |
| --- | --- |
| Ar pirkstu rakstīts izskatās neveikli un nelīdzinās rokrakstam | Liels laukums, vilcienu izlīdzināšana, viegla pārzīmēšana, regulējams biezums; agrīns lietojamības tests |
| 99 zīmes un varianti ir par daudz, cilvēki pamet pusceļā | Pirmā kartīte pēc 33 mazajiem burtiem; pārējās zīmes tikai tad, kad tās vajadzīgas; varianti ir izvēles aplis |
| Burts ar zīmi (ā) sanāk manāmi citāds nekā pamatburts (a) | Alfabēta secība (ā uzreiz pēc a), blāvais pamatburta paraugs, viegla pārzīmēšana |
| Garumzīmes un komati tiek nogriezti vai saduras ar blakus rindām | Brīva josla laukumā, metrika no faktiskā augstuma, rindstarpa ar rezervi |
| `opentype.js` neprot ierakstīt vajadzīgās OpenType funkcijas | MVP tās nevajag; variantiem fontā rezervē `fontTools` |
| Sveša rokraksta atdarināšana, nepiemērots saturs publiskās saitēs | Nav paraksta glifa, `noindex`, ziņošanas poga, dzēšana, termiņš |
| IndexedDB dati pazud (pārlūka tīrīšana, iOS ierobežojumi) | Projekta JSON eksports un atgādinājums; vēlāk konti |

**Atvērtie jautājumi**

- [ ] Produkta nosaukums un domēns.
- [ ] Biznesa modelis: bezmaksas ar maksas šabloniem, maksas fonta eksports vai drukātas kartītes.
- [ ] Vai rokraksta dati GDPR izpratnē prasa īpašu apstrādes pamatojumu; jāprecīzē ar juristu pirms publiskas palaišanas.
- [ ] Kartīšu glabāšanas termiņš: 12 mēneši vai lietotāja izvēle.
- [ ] Fonu un ilustrāciju avots (pašu veidoti vai licencēti).
- [ ] Vai palaišanu piesaistīt Ziemassvētkiem 2026 ar samazinātu tvērumu (posmi 0–5, tikai attēls).

**Atsauces:** [Ductus](https://ductus.sorenblank.com) (zīmēšana pārlūkā, lokāla apstrāde), [Calligraphr](https://www.calligraphr.com) (šabloni, varianti), FontCrafter (lokāla apstrāde bez konta).
