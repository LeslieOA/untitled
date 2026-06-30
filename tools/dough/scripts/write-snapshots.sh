#!/usr/bin/env bash

node ./scripts/write-snapshots.mjs \
&& git lfs track snapshots/** \
&& play -t raw -r 44100 -e float -b 32 -c 2 ./snapshots/_all.pcm
