# Rokraksts

Uzraksti burtus ar pirkstu, iegūsti fontu savā rokrakstā ar pilnu latviešu alfabētu un nosūti
apsveikumu, ko saņēmējs var atvērt jebkurā ierīcē.

- Produkta apraksts un plāns: [`docs/PRD.md`](docs/PRD.md)
- Izstrādes noteikumi un lēmumi: [`CLAUDE.md`](CLAUDE.md)

## Izstrāde

Vajadzīgs Node.js 22 vai jaunāks.

```bash
npm install
npm run dev
```

Pārbaudes: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run e2e`.

## Stāvoklis

0. posms (pamats) ir pabeigts: Next.js + TypeScript, Vitest, Playwright, ESLint, CI, datu tipi un
latviešu rakstzīmju kopa. Nākamais ir 1. posms, zīmēšanas laukums.
