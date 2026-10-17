"""align.py <asrdir> <audio16k.wav> <segments.json> <script.txt> <projdir> [--proportional]
Gives every word of the CORRECTED script a start time → projdir/words.json + words.js.
English: zipformer token timestamps + difflib alignment (≈80% direct matches, rest interpolated).
Hindi/other or --proportional: words spread inside VAD segments by character length (script must keep
the same sentence order; good enough for one-word captions, spot-check after)."""
import json, re, sys, difflib
A, WAV, SEG, SCRIPT, P = sys.argv[1:6]; prop = '--proportional' in sys.argv
segs = json.load(open(SEG)); script = open(SCRIPT, encoding='utf-8').read().split()
norm = lambda w: re.sub(r"[^\w']", "", w.lower())
times = [None]*len(script)
if not prop:
    import sherpa_onnx, soundfile as sf
    d = A + '/sherpa-onnx-zipformer-small-en-2023-06-26/'
    rec = sherpa_onnx.OfflineRecognizer.from_transducer(encoder=d+'encoder-epoch-99-avg-1.int8.onnx', decoder=d+'decoder-epoch-99-avg-1.int8.onnx',
          joiner=d+'joiner-epoch-99-avg-1.int8.onnx', tokens=d+'tokens.txt', num_threads=1)
    a, sr = sf.read(WAV, dtype='float32'); hyp = []
    for s in segs:
        st = rec.create_stream(); st.accept_waveform(sr, a[int(s['start']*sr):int(s['end']*sr)]); rec.decode_stream(st); cur = None
        for tok, ts in zip(st.result.tokens, st.result.timestamps):   # tokens look like ' HOW', 'AS' (leading space = new word)
            if tok.startswith(' ') or tok.startswith('▁') or cur is None:
                cur = {'w': tok.replace('▁', '').strip().lower(), 't': s['start']+ts}; hyp.append(cur)
            else: cur['w'] += tok.lower()
    for b in difflib.SequenceMatcher(None, [norm(w) for w in script], [h['w'] for h in hyp], autojunk=False).get_matching_blocks():
        for k in range(b.size): times[b.a+k] = hyp[b.b+k]['t']
else:
    total = sum(len(w) for w in script); dur = sum(s['end']-s['start'] for s in segs); i = 0
    for s in segs:   # fill each segment with its share of characters
        share = (s['end']-s['start'])/dur*total; acc = 0; t0 = s['start']
        while i < len(script) and (acc < share or s is segs[-1]):
            times[i] = t0 + (s['end']-s['start'])*acc/max(share, 1); acc += len(script[i]); i += 1
known = [i for i, t in enumerate(times) if t is not None]
for i in range(len(times)):
    if times[i] is None:
        p = max([k for k in known if k < i], default=None); n = min([k for k in known if k > i], default=None)
        times[i] = times[n]-.3*(n-i) if p is None else times[p]+.3*(i-p) if n is None else times[p]+(times[n]-times[p])*(i-p)/(n-p)
W = [{'w': w, 't': round(max(0, t), 3)} for w, t in zip(script, times)]
json.dump(W, open(P+'/words.json', 'w'), ensure_ascii=False)
open(P+'/words.js', 'w', encoding='utf-8').write('window.WORDS='+json.dumps(W, ensure_ascii=False)+';')
print('matched', len(known), '/', len(script)); print(' '.join(f"{w['w']}@{w['t']}" for w in W))
