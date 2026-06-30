#!/usr/bin/env bash

gcc -DIS_NATIVE=1 dough.c -o dough $(pkg-config --cflags --libs portaudio-2.0 liblo sndfile samplerate)
