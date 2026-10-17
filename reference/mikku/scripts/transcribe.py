"""transcribe.py <asrdir> <audio16k.wav> <lang:en|hi|...> <out.json>
VAD-segmented Whisper-medium (int8). Prints each segment as it goes. ~1–2x realtime on 1 CPU → run detached.
Test language first on 9 s:  python3 transcribe.py ... --probe   (prints en and hi guesses)."""
import sherpa_onnx, soundfile as sf, json, sys, numpy as np
A, WAV, LANG, OUT = sys.argv[1:5]
d = A + '/sherpa-onnx-whisper-medium/'
a, sr = sf.read(WAV, dtype='float32')
def rec(lang): return sherpa_onnx.OfflineRecognizer.from_whisper(encoder=d+'medium-encoder.int8.onnx', decoder=d+'medium-decoder.int8.onnx',
        tokens=d+'medium-tokens.txt', language=lang, task='transcribe', num_threads=1, tail_paddings=800)
if '--probe' in sys.argv:
    for lg in ('en', 'hi'):
        r = rec(lg); s = r.create_stream(); s.accept_waveform(sr, a[:int(9*sr)]); r.decode_stream(s); print(lg, '|', s.result.text, flush=True)
    sys.exit()
R = rec(LANG)
cfg = sherpa_onnx.VadModelConfig(); cfg.silero_vad.model = A + '/silero_vad.onnx'
cfg.silero_vad.min_silence_duration = .18; cfg.silero_vad.min_speech_duration = .2; cfg.silero_vad.max_speech_duration = 8; cfg.sample_rate = 16000
vad = sherpa_onnx.VoiceActivityDetector(cfg, buffer_size_in_seconds=600); segs = []; ws = cfg.silero_vad.window_size
def drain():
    while not vad.empty(): segs.append((vad.front.start, np.array(vad.front.samples))); vad.pop()
for i in range(0, len(a), ws): vad.accept_waveform(a[i:i+ws]); drain()
vad.flush(); drain(); out = []
for st, s in segs:
    x = R.create_stream(); x.accept_waveform(16000, s); R.decode_stream(x)
    r = {'start': round(st/16000, 2), 'end': round((st+len(s))/16000, 2), 'text': x.result.text.strip()}; out.append(r); print(r, flush=True)
json.dump(out, open(OUT, 'w'), ensure_ascii=False, indent=1); print('DONE', flush=True)
