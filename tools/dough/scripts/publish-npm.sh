#!/usr/bin/env bash

# exit on error
set -e

# position ourselves properly relative to script
cd $(dirname $0)/..

./scripts/build-wasm.sh
npm publish