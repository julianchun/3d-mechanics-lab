#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
python3 tools/das3_product.py --check
python3 tools/scapular_arms_product.py --check
