#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "Merging OpenAPI overlays..."
node "$SCRIPT_DIR/merge-openapi.mjs"

echo "Generating TypeScript types from merged OpenAPI spec..."
npx openapi-typescript "$PROJECT_DIR/openapi.merged.yaml" \
  --output "$PROJECT_DIR/src/generated/api.ts" \
  --export-type \
  --immutable

echo "Done! Generated types at src/generated/api.ts"
