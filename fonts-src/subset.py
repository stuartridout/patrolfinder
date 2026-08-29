from fontTools.subset import main as subset
from fontTools.ttLib import TTFont
import os, sys

# Basic Latin plus the handful of extras the copy uses now or plausibly will.
# Deliberately not subset to the exact strings in the file: a tighter subset
# would break the moment anyone edits a question.
chars = "".join(chr(c) for c in range(0x20, 0x7F)) + "ńŃáéíóúàèâêôçüöäßÁÉÍÓÚ·—–‘’“”…→&£"
uni = ",".join("U+%04X" % ord(c) for c in sorted(set(chars)))

jobs = [
    ("fonts/BravelyScript-Regular.otf", "fonts/bravely.woff2"),
    ("fonts/galano/GalanoGrotesqueSemiBold.otf", "fonts/galano-semibold.woff2"),
]
for src, out in jobs:
    subset([src, "--unicodes=" + uni, "--flavor=woff2", "--layout-features=*",
            "--desubroutinize", "--output-file=" + out])
    f = TTFont(out)
    n = len(f.getGlyphOrder())
    print("%-34s %6d B -> %6d B  (%d glyphs)  %s" % (
        os.path.basename(src), os.path.getsize(src), os.path.getsize(out), n, os.path.basename(out)))
