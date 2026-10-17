#!/usr/bin/env bash
# finish.sh <projdir> <out.mp4>  — sfx from cues.json, mix under voice (voice 1.0, sfx 0.45), mux, faststart.
set -e; P="$1"; OUT="$2"; S="$(dirname "$0")"
python3 "$S/sfx.py" "$P/cues.json" -o "$P/sfx.wav"
ffmpeg -v error -y -i "$P/voice.wav" -i "$P/sfx.wav" -filter_complex \
 "[0:a]volume=1.0[v];[1:a]volume=0.45,aresample=48000[s];[v][s]amix=inputs=2:normalize=0:duration=first,alimiter=limit=0.95[a]" \
 -map "[a]" -ac 2 -ar 48000 "$P/mix.wav"
ffmpeg -v error -y -i "$P/video_noaudio.mp4" -i "$P/mix.wav" -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart "$OUT"
ffprobe -v error -show_entries format=duration,size -of compact "$OUT"
