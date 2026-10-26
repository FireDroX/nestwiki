#!/bin/sh
# Prints the body of the `## <version> — <date>` section of CHANGELOG.md
# (without its heading), used as the text of the GitHub release or
# pre-release of that version. Fails when the section is missing or
# empty, so a version is never released without its notes.
set -e

version="$1"
awk -v heading="## ${version} " 'index($0, heading) == 1 { found = 1; next } /^## / { if (found) exit } found' CHANGELOG.md > release-notes.md

if ! grep -q '[^[:space:]]' release-notes.md; then
  echo "CHANGELOG.md has no '## ${version} — <date>' section." >&2
  exit 1
fi
