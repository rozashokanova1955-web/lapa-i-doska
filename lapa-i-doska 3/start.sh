#!/usr/bin/env bash
cd "$(dirname "$0")"
trap 'kill 0' EXIT
(cd server && npm run dev) &
(cd client && npm run dev) &
wait
