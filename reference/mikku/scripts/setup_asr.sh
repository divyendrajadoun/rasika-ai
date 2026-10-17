#!/usr/bin/env bash
# Downloads speech models from GitHub releases (HF/OpenAI hosts are blocked in the claude.ai sandbox).
# Run DETACHED — the medium model is ~1.9 GB and takes ~1–2 min:
#   setsid nohup bash setup_asr.sh /home/claude/asr > /home/claude/asr_setup.log 2>&1 < /dev/null &
set -e
D=${1:-/home/claude/asr}; mkdir -p "$D"; cd "$D"
pip install sherpa-onnx soundfile --break-system-packages -q
R=https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models
[ -f silero_vad.onnx ] || curl -sL -o silero_vad.onnx $R/silero_vad.onnx
if [ ! -d sherpa-onnx-zipformer-small-en-2023-06-26 ]; then
  curl -sL -C - -o zf.tar.bz2 $R/sherpa-onnx-zipformer-small-en-2023-06-26.tar.bz2 && tar xjf zf.tar.bz2 && rm zf.tar.bz2; fi
if [ ! -f sherpa-onnx-whisper-medium/medium-encoder.int8.onnx ]; then
  curl -sL -C - -o wm.tar.bz2 $R/sherpa-onnx-whisper-medium.tar.bz2
  tar xjf wm.tar.bz2 sherpa-onnx-whisper-medium/medium-encoder.int8.onnx sherpa-onnx-whisper-medium/medium-decoder.int8.onnx sherpa-onnx-whisper-medium/medium-tokens.txt
  rm wm.tar.bz2; fi
echo ASR_READY
