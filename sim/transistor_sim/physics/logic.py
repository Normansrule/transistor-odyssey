"""Static CMOS logic from transistors up: netlists, a switch-level simulator,
logical effort and an event-driven ripple-carry adder.

Gates are written as the series/parallel (SP) expression of their pull-down
network. A string is one nFET whose gate is that input ('!A' is the inverted
input, made by a small inverter); ('s', x, y, ...) puts children in series and
('p', x, y, ...) in parallel. The pull-up network is the dual (series <-> parallel)
built from pFETs, so the output is the complement of the pull-down function:
    Y = NOT f(inputs),   f = conduction function of the pull-down network.

Switch-level simulation (after Bryant 1984): every transistor is a switch that is
on, off or unknown. Nodes in a group joined by on switches take the value of the
supply or input they touch (0 or 1); a group touching both is a short (X); a
group touching neither is floating and keeps its stored charge (Z, last value).
Iterating to a fixed point handles internal nodes that drive other gates.

Logical effort (Sutherland, Sproull & Harris 1999): size each network so its
worst series path has the resistance of a unit nFET (width 1). Series children
share the resistance budget equally; parallel children each get all of it.
pFETs are gamma = 2 times wider for the same resistance. Then, for input x,
    g_x = (input capacitance of x) / 3      (a unit inverter has C_in = 1 + 2 = 3)
    p   = (diffusion width on the output) / 3
and the delay of a gate driving electrical effort h is d = g h + p, in units of
tau, the delay of an ideal fan-out-of-1 inverter with no parasitics.
"""
from __future__ import annotations

from itertools import product

GAMMA = 2.0  # pFET/nFET width ratio for equal resistance

GATES: dict[str, dict] = {
    "inv":   dict(name="Inverter", inputs=["A"], pd="A"),
    "nand2": dict(name="NAND2", inputs=["A", "B"], pd=("s", "A", "B")),
    "nor2":  dict(name="NOR2", inputs=["A", "B"], pd=("p", "A", "B")),
    "nand3": dict(name="NAND3", inputs=["A", "B", "C"], pd=("s", "A", "B", "C")),
    "nor3":  dict(name="NOR3", inputs=["A", "B", "C"], pd=("p", "A", "B", "C")),
    "aoi21": dict(name="AOI21", inputs=["A", "B", "C"], pd=("p", ("s", "A", "B"), "C")),
    "oai21": dict(name="OAI21", inputs=["A", "B", "C"], pd=("s", ("p", "A", "B"), "C")),
    "aoi22": dict(name="AOI22", inputs=["A", "B", "C", "D"], pd=("p", ("s", "A", "B"), ("s", "C", "D"))),
    "xor2":  dict(name="XOR2", inputs=["A", "B"], pd=("p", ("s", "A", "B"), ("s", "!A", "!B"))),
    "maj":   dict(name="Carry (inverting majority)", inputs=["A", "B", "C"], pd=("p", ("s", "A", "B"), ("s", "C", ("p", "A", "B")))),
}


def dual(e):
    if isinstance(e, str):
        return e
    return ("p" if e[0] == "s" else "s",) + tuple(dual(c) for c in e[1:])


def conducts(e, val: dict) -> bool:
    """Boolean conduction of an nFET network for input values (pFET: use dual with inverted inputs)."""
    if isinstance(e, str):
        return (not val[e[1:]]) if e.startswith("!") else bool(val[e])
    kids = [conducts(c, val) for c in e[1:]]
    return all(kids) if e[0] == "s" else any(kids)


def truth(key: str) -> list[tuple[tuple[int, ...], int]]:
    g = GATES[key]
    rows = []
    for bits in product((0, 1), repeat=len(g["inputs"])):
        val = dict(zip(g["inputs"], bits))
        rows.append((bits, 0 if conducts(g["pd"], val) else 1))
    return rows


def _size(e, budget: float, out: list, gamma: float):
    """Append (input, width) for every leaf; budget = allowed resistance (unit nFET = 1)."""
    if isinstance(e, str):
        out.append((e, gamma / budget))
        return
    kids = e[1:]
    for c in kids:
        _size(c, budget / len(kids) if e[0] == "s" else budget, out, gamma)


def netlist(key: str) -> dict:
    """Transistor netlist with sizes: {transistors: [...], nodes: [...], inputs: [...]}.

    Each transistor: dict(type 'n'|'p', g gate node, a, b, w width). Pull-up runs vdd -> y,
    pull-down y -> gnd; series children are listed from the top terminal down.
    """
    g = GATES[key]
    T: list[dict] = []
    count = [0]

    def build(e, top, bot, typ, budget):
        if isinstance(e, str):
            T.append(dict(type=typ, g=e, a=top, b=bot, w=(GAMMA if typ == "p" else 1.0) / budget))
            return
        kids = e[1:]
        if e[0] == "p":
            for c in kids:
                build(c, top, bot, typ, budget)
        else:
            nodes = [top]
            for _ in kids[:-1]:
                count[0] += 1
                nodes.append(f"n{count[0]}")
            nodes.append(bot)
            for i, c in enumerate(kids):
                build(c, nodes[i], nodes[i + 1], typ, budget / len(kids))

    build(dual(g["pd"]), "vdd", "y", "p", 1.0)
    build(g["pd"], "y", "gnd", "n", 1.0)
    comps = sorted({leaf[1:] for t in T for leaf in [t["g"]] if leaf.startswith("!")})
    for x in comps:   # unit input inverters make the complements
        T.append(dict(type="p", g=x, a="vdd", b="!" + x, w=GAMMA, aux=True))
        T.append(dict(type="n", g=x, a="!" + x, b="gnd", w=1.0, aux=True))
    nodes = sorted({n for t in T for n in (t["a"], t["b"], t["g"])})
    return dict(transistors=T, nodes=nodes, inputs=list(g["inputs"]))


def simulate(net: dict, inputs: dict, prev: dict | None = None, iters: int = 40) -> dict:
    """Switch-level steady state. Values are '0', '1', 'X' (short or unknown)."""
    fixed = {"vdd": "1", "gnd": "0", **{k: str(int(v)) for k, v in inputs.items()}}
    stored = dict(prev or {})
    val = {n: fixed.get(n, stored.get(n, "X")) for n in net["nodes"]}
    for _ in range(iters):
        parent = {n: n for n in net["nodes"]}

        def find(n):
            while parent[n] != n:
                parent[n] = parent[parent[n]]
                n = parent[n]
            return n

        maybe = []
        for t in net["transistors"]:
            gv = val[t["g"]]
            on = (gv == "1") if t["type"] == "n" else (gv == "0")
            unk = gv == "X"
            if on:
                ra, rb = find(t["a"]), find(t["b"])
                if ra != rb:
                    parent[ra] = rb
            elif unk:
                maybe.append(t)
        groups: dict[str, list] = {}
        for n in net["nodes"]:
            groups.setdefault(find(n), []).append(n)
        new = {}
        for members in groups.values():
            srcs = {fixed[n] for n in members if n in fixed}
            if srcs:
                v = srcs.pop() if len(srcs) == 1 else "X"
            else:
                held = {stored.get(n, "X") for n in members}
                v = held.pop() if len(held) == 1 else "X"
            for n in members:
                new[n] = fixed.get(n, v)
        for t in maybe:   # a switch that might be on between different values poisons the non-driven side
            if new[t["a"]] != new[t["b"]]:
                for n in (t["a"], t["b"]):
                    if n not in fixed:
                        new[n] = "X"
        if new == val:
            break
        val = new
    return val


def on_transistors(net: dict, val: dict) -> list[int]:
    return [i for i, t in enumerate(net["transistors"]) if (val[t["g"]] == "1") == (t["type"] == "n") and val[t["g"]] != "X"]


def effort(key: str) -> dict:
    """Logical effort per input, parasitic delay and transistor count of a gate."""
    net = netlist(key)
    cin: dict[str, float] = {x: 0.0 for x in net["inputs"]}
    pdiff = 0.0
    for t in net["transistors"]:
        g = t["g"]
        if t.get("aux"):
            cin[g] += t["w"]            # input inverter loads the input
            continue
        if not g.startswith("!"):
            cin[g] += t["w"]
        if "y" in (t["a"], t["b"]):
            pdiff += t["w"]
    return dict(g={k: v / 3.0 for k, v in cin.items()}, p=pdiff / 3.0, n=len(net["transistors"]))


def delay(key: str, h: float = 4.0, inp: str | None = None) -> float:
    """Delay d = g h + p in units of tau for the slowest (or named) input."""
    e = effort(key)
    g = e["g"][inp] if inp else max(e["g"].values())
    return g * h + e["p"]


# ------------------------------------------------------------------ adder
def adder_delays() -> dict:
    """Stage delays (tau) for a ripple-carry adder built from XOR2 and carry gates.

    P_i = A_i xor B_i (drives one XOR), C_{i+1} = MAJ(A_i, B_i, C_i) (carry input drives the next carry
    gate and one sum XOR, h = 2), S_i = P_i xor C_i (drives a fan-out of 4).
    """
    return dict(t_p=delay("xor2", 1.0), t_c=delay("maj", 2.0, "C"), t_s=delay("xor2", 4.0))


def _wave_gate(fn, waves, d):
    """Transport-delay output waveform of fn over input waveforms [(t, v), ...] (first entry at t = -inf)."""
    times = sorted({t for w in waves for t, _ in w})

    def at(w, t):
        v = w[0][1]
        for tt, vv in w:
            if tt <= t:
                v = vv
            else:
                break
        return v

    out = [(-1.0, fn(*[at(w, times[0]) for w in waves]))]
    for t in times[1:]:
        v = fn(*[at(w, t) for w in waves])
        if v != out[-1][1]:
            out.append((t + d, v))
    return out


def ripple_add(a_old: int, b_old: int, a: int, b: int, n: int = 8, d: dict | None = None) -> dict:
    """Event-driven ripple-carry adder: inputs switch from (a_old, b_old) to (a, b) at t = 0.

    Returns per-bit waveforms of sums and carries, the settle time (tau) and the number of
    output transitions (each one costs C V^2 of energy; extra ones are glitches).
    """
    d = d or adder_delays()
    bit = lambda x, i: (x >> i) & 1
    A = [[(-1.0, bit(a_old, i)), (0.0, bit(a, i))] for i in range(n)]
    B = [[(-1.0, bit(b_old, i)), (0.0, bit(b, i))] for i in range(n)]
    C = [[(-1.0, 0)]]
    S, P = [], []
    for i in range(n):
        P.append(_wave_gate(lambda x, y: x ^ y, [A[i], B[i]], d["t_p"]))
        S.append(_wave_gate(lambda x, y: x ^ y, [P[i], C[i]], d["t_s"]))
        C.append(_wave_gate(lambda x, y, z: (x & y) | (z & (x | y)), [A[i], B[i], C[i]], d["t_c"]))
    events = [t for w in S + C[1:] for t, _ in w[1:]]
    settle = max(events) if events else 0.0
    total = sum(v << i for i, w in enumerate(S) for v in [w[-1][1]]) + (C[n][-1][1] << n)
    return dict(S=S, C=C, P=P, settle=settle, transitions=len(events), sum=total)


def ripple_worst(n: int, d: dict | None = None) -> float:
    """Worst-case settle time (tau): the carry ripples through n - 1 stages, then the last sum XOR
    (or the carry-out, n stages) finishes."""
    d = d or adder_delays()
    return max(max(d["t_p"], (n - 1) * d["t_c"]) + d["t_s"], n * d["t_c"])


def kogge_stone_delay(n: int) -> float:
    """Parallel-prefix adder: P/G generation, log2(n) prefix levels of AOI/OAI cells, final XOR (tau)."""
    import math
    levels = math.ceil(math.log2(n)) if n > 1 else 0
    t_pg = delay("nand2", 2.0)
    t_pre = delay("aoi21", 2.0) * 0.5 + delay("oai21", 2.0) * 0.5   # alternating polarity cells, fan-out 2
    return t_pg + levels * t_pre + delay("xor2", 4.0)


def kogge_stone_count(n: int) -> int:
    """Transistor count: PG cells, prefix cells and sum XORs (approximate, standard-cell style)."""
    import math
    levels = math.ceil(math.log2(n)) if n > 1 else 0
    cells = sum(n - 2 ** k for k in range(levels))
    pg = effort("nand2")["n"] + effort("xor2")["n"]          # generate (NAND) and propagate (XOR) per bit
    cell = effort("aoi21")["n"] + effort("nand2")["n"]       # one prefix cell: group generate + group propagate
    return n * pg + cells * cell + n * effort("xor2")["n"]   # plus the sum XOR per bit


def ripple_count(n: int) -> int:
    return n * (2 * effort("xor2")["n"] + effort("maj")["n"])
