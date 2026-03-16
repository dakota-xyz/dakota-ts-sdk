#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "Generating TypeScript types from OpenAPI spec..."

npx openapi-typescript "$PROJECT_DIR/openapi.yaml" \
  --output "$PROJECT_DIR/src/generated/api.ts" \
  --export-type \
  --immutable

echo "Done! Generated types at src/generated/api.ts"
