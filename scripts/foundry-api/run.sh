#!/bin/bash
# Rebuild packages/types/foundry-api.d.ts from the published reference.
set -euo pipefail
cd "$(dirname "$0")"
python3 index.py
./fetch.sh
python3 generate.py
python3 emit.py
python3 relax.py
cp work/foundry-api.d.ts ../../packages/types/foundry-api.d.ts
echo "wrote packages/types/foundry-api.d.ts"
