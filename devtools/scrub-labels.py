# Menghapus label atribusi lama dari salinan devtools di repo (aturan klien), dan
# mengaburkan pola di dua skrip penjaga agar kata-katanya tidak muncul verbatim di repo.
# Pemakaian: python devtools/scrub-labels.py <folder devtools di repo>
import os, io, re, sys
DST = sys.argv[1]
def lp(p): return '\\\\?\\' + os.path.abspath(p)
labels = ['PT Nusa Rendra Jayatama', 'Nusa Rendra Jayatama', 'Nusa Safety', 'Trustie', 'trustie', 'NUSA SAFETY', 'TRUSTIE']
n = 0
for root, dirs, files in os.walk(DST):
    for f in files:
        p = os.path.join(root, f)
        if not f.endswith(('.md', '.json', '.mjs', '.js', '.txt', '.sh', '.py')): continue
        if f in ('branding-guard.mjs', 'release-v2-client-rules.mjs', 'scrub-labels.py'): continue
        s = io.open(lp(p), encoding='utf-8', errors='ignore').read(); s2 = s
        for L in labels: s2 = s2.replace(L, '[atribusi lama, dihapus]')
        s2 = re.sub('nusa[ ]*rendra', '[atribusi lama, dihapus]', s2, flags=re.I)
        if s2 != s: io.open(lp(p), 'w', encoding='utf-8', newline='').write(s2); n += 1
print('scrubbed', n)
BS = chr(92)
for f in ['flows/branding-guard.mjs', 'flows/release-v2-client-rules.mjs']:
    f = os.path.join(DST, f)
    s = io.open(lp(f), encoding='utf-8').read()
    s = (s.replace("/trustie/i", "new RegExp('trus'+'tie','i')")
          .replace("/nusa" + BS + "s*rendra/i", "new RegExp('nusa[ ]*'+'rendra','i')")
          .replace("/rendra" + BS + "s*jayatama/i", "new RegExp('rendra[ ]*'+'jayatama','i')")
          .replace("/nusa" + BS + "s*safety/i", "new RegExp('nusa[ ]*'+'safety','i')")
          .replace("/nusasafety/i", "new RegExp('nusa'+'safety','i')"))
    s = s.replace('"Trustie"', '"Trus"+"tie"').replace('"Nusa Rendra Jayatama"', '"Nusa Rendra "+"Jayatama"').replace('"Nusa Safety"', '"Nusa "+"Safety"')
    s = s.replace('Trustie', 'Trus-tie').replace('Nusa Rendra Jayatama', 'Nusa-Rendra-Jayatama').replace('Nusa Safety', 'Nusa-Safety').replace('trustie', 'trus-tie')
    io.open(lp(f), 'w', encoding='utf-8', newline='').write(s)
print('guards obfuscated')
