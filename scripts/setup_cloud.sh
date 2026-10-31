#!/usr/bin/env bash
# Primary workflow: browser playground. Python/PortAudio are optional legacy tools.
set -euo pipefail
cd /workspace/Test/web
node -e 'if (Number(process.versions.node.split(".")[0]) < 24) { throw new Error("Node.js 24+ is required for this tested workflow"); }'
npm ci --cache /workspace/.npm-cache
npm run build
if ! command -v chromium >/dev/null 2>&1; then
  npx playwright install chromium
fi
npm test
