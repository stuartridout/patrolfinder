from fontTools.subset import main as subset
from fontTools.ttLib import TTFont
import os, sys

# Basic Latin, Latin-1 and Latin Extended-A - enough for English, French,
# Polish and Spanish - plus the punctuation the copy uses. Deliberately not
# subset to the exact strings in the file: a tighter subset would break the
# moment anyone edits a question.
chars = ("".join(chr(c) for c in range(0x20, 0x7F)) + "".join(chr(c) for c in range(0xA0, 0x180))
         + "‘’“”„«»…—–·→←•€")
uni = ",".join("U+%04X" % ord(c) for c in sorted(set(chars)))

# Arabic is not cut here: Cairo's Arabic subset comes ready-made from
# @fontsource/cairo. These are the original file names Stuart supplied.
jobs = [
    ("fonts/BravelyScript-Regular.otf", "fonts/bravely.woff2"),
    ("fonts/galano/GalanoGrotesqueRegular.otf", "fonts/galano-400.woff2"),
    ("fonts/galano/GalanoGrotesqueBold.otf", "fonts/galano-700.woff2"),
    ("fonts/galano/GalanoGrotesqueBlack.otf", "fonts/galano-900.woff2"),
]
for src, out in jobs:
    subset([src, "--unicodes=" + uni, "--flavor=woff2", "--layout-features=*",
            "--desubroutinize", "--output-file=" + out])
    f = TTFont(out)
    n = len(f.getGlyphOrder())
    print("%-34s %6d B -> %6d B  (%d glyphs)  %s" % (
        os.path.basename(src), os.path.getsize(src), os.path.getsize(out), n, os.path.basename(out)))
