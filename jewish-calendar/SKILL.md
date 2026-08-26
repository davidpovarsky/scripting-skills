---
name: jewish-calendar
description: Zmanim, Hebrew dates, Shabbat times, weekly parasha, Daf Yomi, Jewish holidays, fasts and the Omer for Jerusalem (defaults to the user's home). Use for any question about זמני היום, הדלקת נרות, מוצאי שבת, פרשת השבוע, דף יומי, תאריך עברי, ראש חודש, חגים, צומות, ספירת העומר.
runtime: python
entry: scripts/jewish_times.py
metadata:
  display_name: "לוח עברי וזמנים"
  intent_patterns: "זמני היום, זמני שבת, הדלקת נרות, מוצאי שבת, פרשת השבוע, דף יומי, תאריך עברי, ראש חודש, מתי החג, צום, ספירת העומר"
  required_tools: "run_shell_command"
---

# Purpose

Everything Jewish-calendar related for the user (David): daily zmanim, Shabbat
entering/exiting times, weekly parasha, Daf Yomi, Hebrew date conversion,
upcoming holidays/fasts/Rosh Chodesh, and the Omer count. The user is
dati-haredi, lives at Louis Lipsky 39, Jerusalem (the default location).

# Usage

Run via shell:

```
python3 "<skill_dir>/scripts/jewish_times.py" [flags]
```

Flags:

| Flag | Meaning |
|------|---------|
| `--date YYYY-MM-DD` | target date (default: today) |
| `--days N` | number of consecutive days (1–14) |
| `--shabbat` | force output for the upcoming Friday+Saturday |
| `--lat F` / `--lng F` | coordinates (default: home, 31.7525/35.2010) |
| `--place NAME` | location label printed in output |
| `--json` | machine-readable output instead of Hebrew text |
| `--no-net` | offline mode (zmanim only, no parasha/daf lookup) |

Conventions baked in:
- Candle lighting = sunset − **40 minutes** (minhag Yerushalayim).
- Motzaei Shabbat shown both as tzeit hakochavim (8.5°) and Rabbeinu Tam (72 min).
- Both MGA and GRA opinions for sof zman Shema/Tfila.
- Israel DST handled automatically.

# How to answer

1. Execute the script with the appropriate flags **using `--json`**.
2. Render the result as a rich UI card in the chat (see next section).
3. Relay any extra context in Hebrew — never invent or round times yourself.
4. For "מתי שבת?" / "מתי מדליקים?" use `--shabbat`.
5. Zmanim work fully offline; parasha/Daf Yomi need network. If they are
   null because of a network failure, say so honestly.
6. The Hebrew calendar engine was verified against Hebcal for years
   5770–5805 (Rosh Hashanah dates match exactly). Trust its dates.

# Rendering the UI card (always)

After running with `--json`, emit a fenced ` ```scripting-file ` block whose
body is JSON with the component path and the data as props:

```
```scripting-file
{
  "path": "<this skill dir>/ui/ZmanimCard.tsx",
  "props": {
    "place": "ירושלים (לואי ליפסקי 39)",
    "days": [ ...the raw array from --json output... ]
  }
}
```
```

- Pass the `--json` array through **unchanged** as `props.days`.
- For Shabbat questions pass both Friday and Saturday entries (`--shabbat`).
- The card handles RTL Hebrew, light/dark mode, Shabbat hero, holiday banners,
  parasha/daf chips and an Omer progress ring automatically.
- Keep a one-line Hebrew summary above or below the block.

# Notes

- Parasha is fetched for the Shabbat of the requested week; on Yom Tov days
  the weekly-parasha line is suppressed (special reading applies).
- Daf Yomi is attached only for today ± 1 day (it is a daily-cycle value).
