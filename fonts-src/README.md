# fonts-src

The two faces the **today** question set uses, and the script that made them.
They are inlined in `index.html` as base64 WOFF2, so nothing here is served —
this folder exists so the subsets can be rebuilt rather than guessed at.

| Face | Used for | Subset |
|---|---|---|
| Bravely Script Regular | the today set's questions and titles | 27KB OTF → 6.8KB WOFF2 |
| Galano Grotesque SemiBold | the today set's answer buttons | 46KB OTF → 12.6KB WOFF2 |

The 1907 set keeps the serif. The two looking different is half the point.

## Rebuilding

Needs the original OTFs (not kept here) and `pip install fonttools brotli`:

```sh
python3 subset.py            # writes bravely.woff2 and galano-semibold.woff2
```

The subset is Basic Latin plus the accents and punctuation the copy uses or
plausibly will — deliberately *not* the exact characters in the current
strings, because a subset that tight breaks the moment anyone edits a
question. Paste the base64 of each file into the two `@font-face` rules at the
top of the style block in `index.html`.

## Licensing

Both are commercial faces supplied by Stuart. Embedding a font on a public
site needs a webfont licence, which is a different thing from a desktop
licence. That call is his, not this repo's.
