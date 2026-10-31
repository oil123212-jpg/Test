# Source from any directory in the prepared Codex Debian cloud environment.
source /workspace/Test/.venv/bin/activate
export LD_LIBRARY_PATH="/workspace/portaudio-runtime/root/usr/lib/x86_64-linux-gnu${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
