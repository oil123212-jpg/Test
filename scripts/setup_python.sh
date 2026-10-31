#!/usr/bin/env bash
# Tested on the Codex Debian 13 cloud image. No source/lockfile modifications.
set -euo pipefail
cd /workspace/Test
python3 -m venv .venv
.venv/bin/python -m pip install --no-cache-dir -r ai_friend/requirements-dev.txt
# Non-root, signed Debian package installation outside the checkout.
phase0_runtime=/workspace/portaudio-runtime
mkdir -p "$phase0_runtime/apt/lists/partial" "$phase0_runtime/apt/archives/partial" "$phase0_runtime/root"
cat > "$phase0_runtime/apt/sources.list" <<'SOURCES'
deb [signed-by=/usr/share/keyrings/debian-archive-keyring.gpg] https://deb.debian.org/debian trixie main
SOURCES
phase0_apt_options=(
  -o "Dir::Etc::sourcelist=$phase0_runtime/apt/sources.list"
  -o Dir::Etc::sourceparts=- -o Dir::Etc::main=- -o Dir::Etc::parts=-
  -o "Dir::State::lists=$phase0_runtime/apt/lists"
  -o "Dir::Cache::archives=$phase0_runtime/apt/archives"
  -o APT::Get::List-Cleanup=0
)
/usr/bin/apt-get "${phase0_apt_options[@]}" update
cd "$phase0_runtime"
/usr/bin/apt-get "${phase0_apt_options[@]}" download libportaudio2=19.6.0-1.2+b3
dpkg-deb -x libportaudio2_19.6.0-1.2+b3_amd64.deb root
ln -sfn libportaudio.so.2 root/usr/lib/x86_64-linux-gnu/libportaudio.so
cd /workspace/Test
source scripts/activate_cloud.sh
python -c 'import sounddevice; print("PortAudio loaded:", sounddevice.get_portaudio_version()[0])'
cd ai_friend
python main.py --system-info
python -m pytest -q
