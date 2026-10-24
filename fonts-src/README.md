# fonts-src

The font files inlined in `index.html` and `viewer.html` (and the console),
kept here so they can be re-embedded rather than guessed at. Nothing in this
folder is served.

| File | Face | Used for |
|---|---|---|
| bravely.woff2 | Bravely Script Regular | capital headings only: titles, "You're a Wolf", patrol names |
| galano-400.woff2 | Galano Grotesque Regular | body text |
| galano-700.woff2 | Galano Grotesque Bold | answers, emphasis |
| galano-900.woff2 | Galano Grotesque Black | questions, buttons, caps labels, big numbers |
| cairo-arabic-400.woff2 | Cairo Regular, Arabic subset | Arabic body text |
| cairo-arabic-800.woff2 | Cairo ExtraBold, Arabic subset | Arabic headings and buttons |

Bravely sets lowercase as small caps, which carries a title and is hard work
across a sentence, so it never sets running text. Neither Bravely nor Galano
has Arabic; Cairo carries all of it.

The Bravely and Galano files came with the October 2026 design handoff,
already subset to Latin with Polish (ą ć ę ł ń ó ś ź ż), French and Spanish
(including ¿ ¡). Cairo is the Arabic subset from `@fontsource/cairo` 5.1.0.

## Rebuilding

To re-cut Bravely or Galano from the original OTFs (not kept here) run
`python3 subset.py` with `pip install fonttools brotli`, then paste the base64
of each file into the matching `@font-face` rule in both pages. The subset is
Latin wide enough for all four Latin-script languages, deliberately not the
exact characters in the current strings, because a subset that tight breaks
the moment anyone edits a question.

## Licensing

Cairo is SIL Open Font Licence (`cairo-OFL.txt`): free to embed. Bravely and
Galano are commercial faces supplied by Stuart. The Galano files carry
"Copyright 2014 René Bieder. All rights reserved"; Bravely carries no licence
text. Embedding a font on a public site needs a webfont licence, which is a
different thing from a desktop licence. That call is his, not this repo's.
