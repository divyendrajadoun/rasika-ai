#!/usr/bin/env bash
# prep_video.sh <input.mp4> <projdir>  → frames/f%05d.jpg (30fps), voice.wav (48k stereo), audio16k.wav, video.js
# Run detached for long clips (frame extraction ~1 min per minute of 1080p HEVC).
set -e; IN="$1"; P="${2:-/home/claude/proj}"; mkdir -p "$P/frames" "$P/img" "$P/fonts"
cp "$(dirname "$0")/../assets/fonts/"* "$P/fonts/"
ffmpeg -v error -y -i "$IN" -vn -ac 2 -ar 48000 "$P/voice.wav"
ffmpeg -v error -y -i "$IN" -vn -ac 1 -ar 16000 "$P/audio16k.wav"
ffmpeg -v error -y -i "$IN" -vf "fps=30,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920" -q:v 3 "$P/frames/f%05d.jpg"
N=$(ls "$P/frames" | wc -l); DUR=$(python3 -c "print(round($N/30,3))")
echo "window.VIDEO={frames:$N,duration:$DUR};" > "$P/video.js"; echo "frames=$N duration=$DUR"
