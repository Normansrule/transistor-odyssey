# Contributing

Corrections and additions are welcome, especially new chips, nodes, materials and better sources.

1. **Every fact needs a source.** Add the source to `data/references.json` (unique `id`, `cat`, `cite`, and a `doi` or `url`), then reference its `id` from the data record (`"refs": [...]`) or from a chapter as `[@id]`.
2. **Regenerate** with `make figures` (charts, drawings, `site/js/data.js`, `REFERENCES.md`, `CREDITS.md`).
3. **Test** with `make test`. The suite fails on unknown citation keys, out-of-order timelines, or model drift away from published anchors.
4. **Model changes**: `sim/transistor_sim/mosfet.py` and `site/js/model.js` must stay equivalent. If you change one, change both.
5. **Images**: only freely licensed files (Wikimedia Commons, CC0/CC BY/CC BY-SA, public domain). Add them to `data/images.json`; run `python scripts/fetch_images.py` to record author and license.

Style: plain, direct sentences; SI units with a thin space where possible (10 µm, 0.42 nm); label estimates "est." and research results "research".
