#!/bin/bash
# Download every page the index lists. A page already on disk is left alone, so
# a run that stops partway can be started again.
set -euo pipefail
cd "$(dirname "$0")/work"
mkdir -p api
fetch() {
  name=$(echo "${1#*/api/}" | tr "/" "_")
  [ -s "api/$name" ] && return 0
  curl -sS --max-time 30 --retry 2 -o "api/$name" "$1"
}
export -f fetch
xargs -P 10 -I{} bash -c 'fetch "$@"' _ {} < pages.txt
echo "pages on disk: $(ls api | wc -l | tr -d ' ')"
