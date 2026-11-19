# LPJ-GUESS in the browser

## Description

Static site that runs the LPJ-GUESS vegetation model (compiled to WebAssembly) in the
visitor's browser. Open the published page, pick a location on the map, adjust the
monthly climate changes and press "Run model".

## Starting locally

Go into the directory and run
```
python3 webapp/server.py
```
this will start it on port 8000.


## Model version

Uses last compiled LPJ-GUESS from branch `kgregor_teaching_demoinput`.

Built from the LPJ-GUESS sources (Mozilla Public License 2.0, see LICENCE.TXT).
