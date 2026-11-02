# Pembuat latar desain dengan model gambar OpenAI (kunci dibaca dari variabel lingkungan OPENAI_API_KEY;
# kunci tidak pernah disimpan di repositori). Dipakai untuk tema sertifikat (assets/img/sertifikat/tema)
# dan latar Kartu Tanda Anggota (assets/img/kta). Daftar prompt: prompt-tema-sertifikat.txt
# (satu baris per gambar: nama-berkas ukuran kualitas prompt). Contoh, dari folder ini:
#   cat prompt-tema-sertifikat.txt | xargs -P 6 -L 1 sh -c 'python3 gen-gambar.py "$0" "$1" "$2" "$3"'
# Hasil PNG lalu diperkecil ke A4 150 dpi (1754x1240 / 1240x1754, JPEG q80) + gambar kecil 300 px.
import os, sys, json, base64, urllib.request, time
# pemakaian: gen.py <keluaran.png> <ukuran WxH> <kualitas> <prompt>
out, size, quality, prompt = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
body = json.dumps({'model': os.environ.get('IMG_MODEL', 'gpt-image-2'), 'prompt': prompt, 'size': size, 'quality': quality, 'n': 1}).encode()
for i in range(3):
    try:
        req = urllib.request.Request('https://api.openai.com/v1/images/generations', data=body, headers={'Authorization': 'Bearer ' + os.environ['OPENAI_API_KEY'], 'Content-Type': 'application/json'})
        with urllib.request.urlopen(req, timeout=300) as r: d = json.load(r)
        open(out, 'wb').write(base64.b64decode(d['data'][0]['b64_json'])); print('ok', out); break
    except urllib.error.HTTPError as e:
        print('HTTP', e.code, e.read().decode()[:300]); time.sleep(5)
    except Exception as e:
        print('ERR', str(e)[:200]); time.sleep(5)
