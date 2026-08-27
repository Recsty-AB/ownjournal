# Bundled PDF fonts

jsPDF's built-in fonts encode WinAnsi (cp1252) only, so anything outside it —
Polish, Vietnamese, Greek, Cyrillic, Hindi, Thai — comes out of a PDF export as
mojibake. These faces are embedded into the exported PDF instead, and only the
glyphs actually used are written into the file (jsPDF subsets on export).

| File | Covers | Locales |
|------|--------|---------|
| `NotoSans-Regular.ttf` | Latin (incl. Latin Extended + Vietnamese), Greek, Cyrillic | 18 of 21 |
| `NotoSansDevanagari-Regular.ttf` | Devanagari | `hi` |
| `NotoSansThai-Regular.ttf` | Thai | `th` |

They are fetched at export time, not at startup, so they cost nothing on load
and are runtime-cached by the service worker after the first export.

Japanese, Chinese and Korean are not here: Noto Sans CJK is ~18 MB per weight,
far too large to bundle, so `journalExport.ts` keeps fetching a subset from
Google Fonts for those three locales.

## Licence

Noto Sans, Noto Sans Devanagari and Noto Sans Thai are © Google Inc., licensed
under the SIL Open Font License 1.1 — see `OFL.txt`. Upstream:
https://github.com/notofonts/notofonts.github.io
