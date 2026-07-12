import pandas as pd
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.chart import LineChart, Reference
from openpyxl.utils import get_column_letter

ARIAL = "Arial"
BLUE = Font(name=ARIAL, color="0000FF")          # editable inputs
BLACK = Font(name=ARIAL, color="000000")         # formulas
BOLD = Font(name=ARIAL, bold=True)
H1 = Font(name=ARIAL, bold=True, size=13)
GREY = PatternFill("solid", start_color="EEECE1")
YELLOW = PatternFill("solid", start_color="FFFF00")

wb = Workbook()

def style_row(ws, row, font=None, fill=None, cols=range(1, 13)):
    for c in cols:
        cell = ws.cell(row=row, column=c)
        if font: cell.font = font
        if fill: cell.fill = fill

# ── Sheet 1: README ────────────────────────────────────────────────
ws = wb.active
ws.title = "README"
readme = [
    ["Kingdom-sim economy model", ""],
    ["", ""],
    ["What this is", "A feedback-loop model of the game economy, built from src/config.js rates and a 12-year headless run of the real sim (model/simulate.mjs, seed 42)."],
    ["", ""],
    ["Sheets", ""],
    ["  Rates", "Per-building flow rates straight from config. Shows each building's net food-equivalent after feeding its own workers."],
    ["  SteadyState", "Editable kingdom snapshot -> per-tick and per-year net flow for every resource. Change blue cells."],
    ["  SimRun", "The 12-year simulation time series with charts. Raw evidence of the snowball."],
    ["  SinkSandbox", "Candidate balance changes as dials. See which ones actually flatten the gold curve before touching code."],
    ["", ""],
    ["Color code", ""],
    ["  Blue text", "Inputs you can change"],
    ["  Black text", "Formulas — leave alone"],
    ["", ""],
    ["Key units", "1 tick = 0.6s at 1x speed. 480 ticks = 1 game year. Bread = 2 food-equivalents."],
]
for r, (a, b) in enumerate(readme, 1):
    ws.cell(row=r, column=1, value=a).font = BOLD if not a.startswith(" ") and a else Font(name=ARIAL)
    ws.cell(row=r, column=2, value=b).font = Font(name=ARIAL)
ws["A1"].font = H1
ws.column_dimensions["A"].width = 18
ws.column_dimensions["B"].width = 120

# ── Sheet 2: Rates (from src/config.js) ────────────────────────────
ws = wb.create_sheet("Rates")
hdr = ["Building", "Workers", "food/t", "wood/t", "stone/t", "ore/t", "iron/t", "bread/t",
       "Gross food-eq/t", "Worker mouths/t", "Net food-eq/t", "Notes"]
ws.append(hdr)
style_row(ws, 1, font=BOLD, fill=GREY)
# outputs positive, inputs negative — all per tick fully staffed, from src/config.js
rates = [
    ["Farm",    2, 0.5, 0, 0, 0, 0, 0,    "x0.4 in winter (avg x0.85 over a year)"],
    ["Dock",    2, 0.4, 0, 0, 0, 0, 0,    "immune to winter"],
    ["Lumber",  2, 0, 0.35, 0, 0, 0, 0,   ""],
    ["Quarry",  3, 0, 0, 0.3, 0, 0, 0,    ""],
    ["Mine",    3, 0, 0, 0, 0.25, 0, 0,   ""],
    ["Smelter", 2, 0, -0.15, 0, -0.3, 0.15, 0, "only demand for ore"],
    ["Bakery",  2, -0.4, 0, 0, 0, 0, 0.25, "the trap: see Net column"],
    ["Market",  1, 0, 0, 0, 0, 0, 0,      "gold = pop x 0.012 x morale/50 per tick"],
    ["House",   0, 0, 0, 0, 0, 0, 0,      "+5 pop cap"],
    ["Tower",   0, 0, 0, 0, 0, 0, 0,      "influence 7, arrows"],
    ["Church",  0, 0, 0, 0, 0, 0, 0,      "influence 8, morale"],
    ["Barracks",0, 0, 0, 0, 0, 0, 0,      "4 soldiers each"],
]
for r, row in enumerate(rates, 2):
    ws.append(row[:8] + [None, None, None, row[8]])
    ws.cell(row=r, column=9,  value=f"=C{r}+2*H{r}").font = BLACK          # gross food-eq (bread counts double)
    ws.cell(row=r, column=10, value=f"=B{r}*SteadyState!$B$5").font = BLACK  # workers x eat rate
    ws.cell(row=r, column=11, value=f"=I{r}-J{r}").font = BLACK
    for c in range(1, 9):
        ws.cell(row=r, column=c).font = BLUE if c > 1 else BOLD
for col, w in zip("ABCDEFGHIJKL", [10, 8, 8, 8, 8, 8, 8, 8, 14, 14, 12, 44]):
    ws.column_dimensions[col].width = w
ws.cell(row=15, column=1, value="Rates source: src/config.js BUILDINGS, 2026-07-09. Bakery row is why you needed 'a lot of bakeries':").font = BOLD
ws.cell(row=16, column=1, value="gross +0.1 eq/t but its 2 workers eat 0.08/t -> net +0.02, vs a farm's net +0.345. A bakery is ~6% of a farm.").font = Font(name=ARIAL)

# ── Sheet 3: SteadyState ───────────────────────────────────────────
ws = wb.create_sheet("SteadyState")
ws["A1"] = "Steady-state kingdom calculator"; ws["A1"].font = H1
ws["A2"] = "Blue = change me. Snapshot defaults to the year-12 sim state."; ws["A2"].font = Font(name=ARIAL, italic=True)

assumptions = [
    ("Assumptions", None),
    ("Eat per pop per tick", 0.04),
    ("Soldier eat per tick", 0.08),
    ("Ticks per year", 480),
    ("Morale (0-100)", 70),
    ("Farm winter avg mult", 0.85),
    ("Avg sell mult of base price", 0.7),
]
r = 4
for label, v in assumptions:
    ws.cell(row=r, column=1, value=label).font = BOLD if v is None else Font(name=ARIAL)
    if v is not None:
        c = ws.cell(row=r, column=2, value=v); c.font = BLUE
    r += 1
# B5 eat, B6 soldier eat, B7 ticks/yr, B8 morale, B9 winter mult, B10 sell mult

counts = [
    ("Kingdom snapshot", None),
    ("Population", 186), ("Soldiers", 4),
    ("Farms", 25), ("Docks", 0), ("Lumber camps", 3), ("Quarries", 2),
    ("Mines", 2), ("Smelters", 1), ("Bakeries", 2), ("Markets", 1),
]
r = 12
for label, v in counts:
    ws.cell(row=r, column=1, value=label).font = BOLD if v is None else Font(name=ARIAL)
    if v is not None:
        c = ws.cell(row=r, column=2, value=v); c.font = BLUE
    r += 1
# B13 pop, B14 soldiers, B15 farms, B16 docks, B17 lumber, B18 quarry, B19 mine, B20 smelter, B21 bakery, B22 market

ws["D4"] = "Net flow per tick"; ws["D4"].font = BOLD; ws["D4"].fill = GREY
ws["E4"] = "per tick"; ws["F4"] = "per year";
for cell in ("E4", "F4"): ws[cell].font = BOLD; ws[cell].fill = GREY
flows = [
    ("Food-eq produced", "=B15*0.5*B9+B16*0.4+B21*0.02"),
    ("Food-eq eaten", "=B13*B5+B14*B6"),
    ("Food-eq NET", "=E5-E6"),
    ("Wood net", "=B17*0.35-B20*0.15"),
    ("Stone net", "=B18*0.3"),
    ("Ore net", "=B19*0.25-B20*0.3"),
    ("Iron net", "=B20*0.15"),
    ("Tax gold (market)", "=IF(B22>0,B13*0.012*B8/50,0)"),
    ("Trade gold (sell all wood+stone surplus)", "=MAX(0,E8)*2*B10+MAX(0,E9)*3*B10"),
    ("Gold NET", "=E12+E13"),
]
r = 5
for label, f in flows:
    ws.cell(row=r, column=4, value=label).font = Font(name=ARIAL)
    ws.cell(row=r, column=5, value=f).font = BLACK
    ws.cell(row=r, column=6, value=f"=E{r}*$B$7").font = BLACK
    ws.cell(row=r, column=5).number_format = "0.000"
    ws.cell(row=r, column=6).number_format = "#,##0"
    r += 1
ws["D16"] = "Read: at this snapshot the treasury gains ~E14*480 gold/yr with nothing to spend it on."
ws["D16"].font = Font(name=ARIAL, italic=True)
for col, w in zip("ABCDEF", [24, 10, 3, 38, 10, 10]):
    ws.column_dimensions[col].width = w

# ── Sheet 4: SimRun ────────────────────────────────────────────────
ws = wb.create_sheet("SimRun")
df = pd.read_csv("/Users/chandraramanujan/Documents/claude-code/kingdom-sim/model/run.csv")
ws.append(list(df.columns))
style_row(ws, 1, font=BOLD, fill=GREY, cols=range(1, len(df.columns) + 1))
for row in df.itertuples(index=False):
    ws.append(list(row))
nrows = len(df) + 1
for col in range(1, len(df.columns) + 1):
    ws.column_dimensions[get_column_letter(col)].width = 10

gold_col = list(df.columns).index("gold") + 1
pop_col = list(df.columns).index("pop") + 1
raids_col = list(df.columns).index("raidsSeen") + 1
lost_col = list(df.columns).index("buildingsLost") + 1

c1 = LineChart()
c1.title = "Gold compounds without limit: 10 -> 29,102 in 12 years (zero sinks)"
c1.add_data(Reference(ws, min_col=gold_col, min_row=1, max_row=nrows), titles_from_data=True)
c1.width, c1.height = 24, 10
ws.add_chart(c1, "X2")

c2 = LineChart()
c2.title = "15 raids, 0 buildings lost: threat never scales past defense"
c2.add_data(Reference(ws, min_col=raids_col, min_row=1, max_row=nrows), titles_from_data=True)
c2.add_data(Reference(ws, min_col=lost_col, min_row=1, max_row=nrows), titles_from_data=True)
c2.width, c2.height = 24, 10
ws.add_chart(c2, "X22")

c3 = LineChart()
c3.title = "Population grows linearly (housing-gated), gold grows super-linearly"
c3.add_data(Reference(ws, min_col=pop_col, min_row=1, max_row=nrows), titles_from_data=True)
c3.width, c3.height = 24, 10
ws.add_chart(c3, "X42")

# ── Sheet 5: SinkSandbox ───────────────────────────────────────────
ws = wb.create_sheet("SinkSandbox")
ws["A1"] = "Sink sandbox — test balance changes before coding them"; ws["A1"].font = H1
ws["A2"] = "Uses the SteadyState snapshot. Blue dials; effects on yearly flows below."
ws["A2"].font = Font(name=ARIAL, italic=True)

dials = [
    ("Dials", None, ""),
    ("Soldier eat multiplier (now 2x pop)", 3, "your idea: armies as mouths"),
    ("Building upkeep, wood/t per building", 0.004, "decay+repair drain"),
    ("Building upkeep, stone/t per building", 0.002, ""),
    ("Total buildings (from sim yr-12)", 78, ""),
    ("Merchant buy cap, units per visit", 40, "can't liquidate infinite surplus"),
    ("Merchant visits per year", 2.5, "~213 ticks per cycle"),
    ("Bakery: food in /t", 0.5, "proposed rework"),
    ("Bakery: bread out /t", 0.4, "0.8 eq out = net +0.3 before workers"),
    ("Soldiers recruited from population?", "yes", "1 soldier = 1 fewer worker (design note)"),
]
r = 4
for label, v, note in dials:
    ws.cell(row=r, column=1, value=label).font = BOLD if v is None else Font(name=ARIAL)
    if v is not None:
        c = ws.cell(row=r, column=2, value=v); c.font = BLUE
    ws.cell(row=r, column=3, value=note).font = Font(name=ARIAL, italic=True)
    r += 1
# B5 soldier mult, B6 upkeep wood, B7 upkeep stone, B8 total buildings, B9 cap, B10 visits/yr, B11 bakein, B12 bakeout

ws["A16"] = "Yearly flows: before -> after"; ws["A16"].font = BOLD; ws["A16"].fill = GREY
ws["B16"] = "Before"; ws["C16"] = "After";
for cell in ("B16", "C16"): ws[cell].font = BOLD; ws[cell].fill = GREY
rows = [
    ("Food-eq net / yr",
     "=SteadyState!F7",
     "=(SteadyState!E5 + SteadyState!B21*((B12*2-B11)-2*SteadyState!B5) - SteadyState!B21*0.02"
     " - SteadyState!B13*SteadyState!B5 - SteadyState!B14*SteadyState!B5*B5)*SteadyState!B7"),
    ("Wood net / yr",
     "=SteadyState!F8",
     "=(SteadyState!E8-B6*B8)*SteadyState!B7"),
    ("Stone net / yr",
     "=SteadyState!F9",
     "=(SteadyState!E9-B7*B8)*SteadyState!B7"),
    ("Trade gold / yr (capped)",
     "=SteadyState!F13",
     "=MIN(SteadyState!F13, B9*B10*2.5*SteadyState!B10)"),
    ("Gold net / yr",
     "=SteadyState!F14",
     "=SteadyState!F12+C20"),
]
r = 17
for label, before, after in rows:
    ws.cell(row=r, column=1, value=label).font = Font(name=ARIAL)
    ws.cell(row=r, column=2, value=before).font = BLACK
    ws.cell(row=r, column=3, value=after).font = BLACK
    ws.cell(row=r, column=2).number_format = "#,##0"
    ws.cell(row=r, column=3).number_format = "#,##0"
    r += 1
ws["A23"] = "Goal: 'After' gold/yr should stay in the low hundreds — enough to want, not enough to drown in."
ws["A23"].font = Font(name=ARIAL, italic=True)
for col, w in zip("ABC", [40, 12, 12]):
    ws.column_dimensions[col].width = w

out = "/Users/chandraramanujan/Documents/claude-code/kingdom-sim/model/kingdom-economy-model.xlsx"
wb.save(out)
print("saved", out)
