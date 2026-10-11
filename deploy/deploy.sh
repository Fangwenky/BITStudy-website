#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
host="${1:-root@107.175.115.136}"
python3 -m unittest discover -s scripts -p 'test_*.py'
# Transfer only public website source, never environment files or downloaded APKs.
COPYFILE_DISABLE=1 tar --exclude='__pycache__' -czf - site scripts deploy README.md LICENSE | ssh "$host" 'mkdir -p /opt/bitstudy-website && tar -xzf - -C /opt/bitstudy-website'
ssh "$host" 'bash /opt/bitstudy-website/deploy/install.sh'
