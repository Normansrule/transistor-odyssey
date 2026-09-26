PY ?= python3

.PHONY: figures data test serve spice all clean

all: figures test

figures:
	$(PY) sim/make_figures.py
	$(PY) scripts/build_data.py

data:
	$(PY) scripts/build_data.py

test:
	$(PY) -m pytest -q tests

serve:
	$(PY) -m http.server 8000 -d site

spice:
	cd sim/spice && for f in *.cir; do echo "== $$f"; ngspice -b $$f; done

clean:
	rm -rf .pytest_cache sim/spice/*.csv
