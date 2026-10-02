"""Data integrity: every reference id resolves, every chip/era is well formed."""
import csv
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def load(name):
    return json.loads((ROOT / "data" / name).read_text(encoding="utf-8"))


REFS = {r["id"]: r for r in load("references.json")["references"]}


def test_reference_ids_unique_and_linked():
    ids = [r["id"] for r in load("references.json")["references"]]
    assert len(ids) == len(set(ids))
    assert len(ids) >= 150
    for r in REFS.values():
        assert r["cite"]
        assert r.get("doi") or r.get("url") or "ISBN" in r["cite"] or "(" in r["cite"]


def _collect_refs(node, out):
    if isinstance(node, dict):
        for k, v in node.items():
            if k == "refs":
                out.update(v)
            else:
                _collect_refs(v, out)
    elif isinstance(node, list):
        for v in node:
            _collect_refs(v, out)


def test_all_data_refs_resolve():
    used = set()
    for name in ("chips.json", "timeline.json", "materials.json", "niche.json", "diamond.json"):
        _collect_refs(load(name), used)
    missing = sorted(u for u in used if u not in REFS)
    assert not missing, missing


def test_docs_refs_resolve():
    missing = set()
    for md in (ROOT / "docs").glob("*.md"):
        text = md.read_text(encoding="utf-8")
        for group in re.findall(r"\[(@[^\]]+)\]", text):
            for rid in re.findall(r"@([a-zA-Z0-9_]+)", group):
                if rid not in REFS:
                    missing.add(f"{md.name}:{rid}")
    assert not missing, sorted(missing)


def test_chips_sorted_fields():
    for c in load("chips.json")["chips"]:
        assert c["transistors"] > 0 and 1970 <= c["year"] <= 2026
        assert c["family"] in {"planar", "3d", "beyond"}


def test_timeline_chronological_and_arch_exists():
    import sys
    sys.path.insert(0, str(ROOT / "sim"))
    from transistor_sim.crosssection import ARCHS
    eras = load("timeline.json")["eras"]
    years = [e["year"] for e in eras]
    assert years == sorted(years)
    for e in eras:
        assert e["arch"] in ARCHS, e["arch"]


def test_nodes_csv():
    rows = list(csv.DictReader(open(ROOT / "data" / "nodes.csv", encoding="utf-8")))
    assert len(rows) >= 20
    years = [int(r["year"]) for r in rows]
    assert years == sorted(years)


def test_niche_archs_exist():
    import sys
    sys.path.insert(0, str(ROOT / "sim"))
    from transistor_sim.crosssection import ARCHS
    for dev in load("niche.json")["devices"]:
        assert dev["arch"] in ARCHS, dev["id"]
        assert dev["status"] in {"museum", "niche", "mainstream", "research"}


def test_process_flow_complete():
    steps = load("process.json")["steps"]
    assert [s["step"] for s in steps] == list(range(1, len(steps) + 1))
    assert len(steps) >= 12
    for s in steps:
        assert (ROOT / "site" / s["svg"]).exists(), s["svg"]
        assert (ROOT / "figures" / "process" / f"step_{s['step']:02d}.svg").exists()
