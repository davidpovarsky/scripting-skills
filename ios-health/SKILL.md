---
name: ios-health
description: Query iOS Health data — retrieve health metrics from HealthKit such as step count, distance, active energy, exercise time, heart rate, sleep analysis, daily activity ring summaries, workout sessions, body measurements, blood oxygen, blood pressure, heart rate variability, VO2 Max, and fitness scores.
runtime: scripting
metadata:
  display_name: "iOS Health"
  required_tools: "run_shell_command"
---

# Purpose

This skill provides scripts for querying iOS Health (HealthKit) data through the Scripting TypeScript runtime. Use it when the user wants to read health metrics over a date range.

Each script is **purpose-built** for a single metric or concept. Parameters are kept intentionally minimal — units and aggregation semantics are fixed internally per metric, so callers don't need to know HealthKit internals.

# Permissions

The underlying `Health.*` APIs prompt the user (first time) to grant Read access to the requested data types via the system permission sheet. If access is denied:
- Quantity / category queries return **empty results** (no thrown error).
- Profile reads (date of birth, etc.) **reject** the promise.

If `Health.isHealthDataAvailable` is false (e.g. iPad without Health), all scripts exit with `{ success: false, error: ... }`.

Manual path: **Health app → Data Access & Devices → Scripting** → enable the needed data types.

# Common Conventions

All scripts share these rules:
- **Date parsing**: accepts `YYYY-MM-DD` (treated as local midnight), `YYYY-MM-DD HH:mm:ss` (local time), or ISO 8601.
- **`end_date` is exclusive at day granularity**: to query April 1–14 inclusive, pass `end_date: "2026-04-15"`.
- **Units are fixed per script** (no `unit` parameter). See each script's output description.
- **Output envelope**:
  - Success: `{ success: true, startDate, endDate, ...metricFields }`
  - Failure: `{ success: false, error: "<message>" }`
- Each script returns both raw numeric fields and a human-readable `formatted` string.

All scripts are executed via `run_shell_command` using `scripting-ts run <path> --queryparameters '<json>'`.

# Available Scripts

## 1. query_step_count.ts — Step count

Cumulative step count over a range, optional daily breakdown.

```
scripting-ts run <skill_dir>/scripts/query_step_count.ts --queryparameters '{"start_date":"2026-04-01","end_date":"2026-04-15","daily":true}'
```

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `start_date` | string | ✅ | Start (inclusive). |
| `end_date` | string | ✅ | End (exclusive). |
| `daily` | boolean | ❌ | If true, include per-day breakdown. Default: false. |

**Output:** `totalSteps: number`, optional `daily: [{date, steps}]`.

## 2. query_distance.ts — Walking + running distance (km)

```
scripting-ts run <skill_dir>/scripts/query_distance.ts --queryparameters '{"start_date":"2026-04-01","end_date":"2026-04-15","daily":true}'
```

**Parameters:** same as #1.

**Output:** `totalKm: number`, `formatted: "12.34 km"`, optional `daily: [{date, km, formatted}]`. Fixed unit: kilometer.

## 3. query_active_energy.ts — Active energy (kcal)

```
scripting-ts run <skill_dir>/scripts/query_active_energy.ts --queryparameters '{"start_date":"2026-04-01","end_date":"2026-04-15","daily":true}'
```

**Parameters:** same as #1.

**Output:** `totalKcal: number`, `formatted: "2341 kcal"`, optional `daily`. Fixed unit: kilocalorie.

## 4. query_exercise_time.ts — Apple Exercise Time (minutes)

```
scripting-ts run <skill_dir>/scripts/query_exercise_time.ts --queryparameters '{"start_date":"2026-04-01","end_date":"2026-04-15","daily":true}'
```

**Parameters:** same as #1.

**Output:** `totalMinutes: number`, `formatted: "3 h 25 min"`, optional `daily`. Fixed unit: minute.

## 5. query_heart_rate.ts — Heart rate (bpm)

Discrete metric — returns average, min, max, and most recent.

```
scripting-ts run <skill_dir>/scripts/query_heart_rate.ts --queryparameters '{"start_date":"2026-04-13","end_date":"2026-04-14"}'
```

**Parameters:**
| Name | Type | Required |
|------|------|----------|
| `start_date` | string | ✅ |
| `end_date` | string | ✅ |

**Output:** `averageBpm`, `minBpm`, `maxBpm`, `mostRecentBpm`, `mostRecentAt` (ISO), plus `formatted: {average, min, max, mostRecent}`. Fixed unit: count/minute (bpm).

## 6. query_sleep.ts — Sleep analysis

Aggregates `sleepAnalysis` category samples into total time asleep plus per-stage breakdown. Supports source selection to avoid double-counting when multiple apps/devices write overlapping sleep data.

```
scripting-ts run <skill_dir>/scripts/query_sleep.ts --queryparameters '{"start_date":"2026-04-13","end_date":"2026-04-14"}'
```

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `start_date` | string | ✅ | Start (inclusive). |
| `end_date` | string | ✅ | End (exclusive). |
| `source_name` | string | ❌ | Exact/partial source name to use, e.g. `"Thom’s Apple Watch"`. |
| `source_preference` | string | ❌ | Source preference shortcut: `"watch"`, `"iphone"`, or `"all"`. Default behavior prefers Apple Watch if present. |
| `include_source_summary` | boolean | ❌ | Include per-source summary in the output. Default: true. |

**Output:**
- `selectedSource`, `availableSources`
- `sampleCount`, `sessionCount` (distinct sleep sessions, gap >1h)
- `totalAsleepMinutes`, `totalAsleepFormatted` — sums `asleepCore + asleepDeep + asleepREM + asleepUnspecified`, excludes `inBed` and `awake`.
- `stageMinutes` and `stageFormatted` — per-stage totals for `inBed`, `awake`, `asleepCore`, `asleepDeep`, `asleepREM`, `asleepUnspecified`.
- Optional `sourceSummaries` — per-source sample counts and sleep totals for debugging overlaps.

**Note:** `inBed` typically overlaps with the asleep stages (it's a superset). When multiple sources exist, prefer a single source (usually Apple Watch) to avoid double-counting.

## 7. query_activity_summary.ts — Activity rings (Move / Exercise / Stand)

Daily Move, Exercise, and Stand ring values with goals and completion percentages.

```
scripting-ts run <skill_dir>/scripts/query_activity_summary.ts --queryparameters '{"start_date":"2026-04-08","end_date":"2026-04-15"}'
```

**Parameters:** same as #5.

**Output:**
- `dayCount`, `daily: [...]`
- Each day has: `date`, `moveMode` (`activeEnergy`|`appleMoveTime`), and three rings:
  - `move: { actual, goal, unit, percent, formatted }` — unit depends on `moveMode` (kcal vs minute)
  - `exercise: { minutes, goalMinutes, percent, formatted }`
  - `stand: { hours, goalHours, percent, formatted }`

## 8. query_workouts.ts — Workout sessions

List individual workout sessions (running, walking, strength training, etc.) in a date range, with per-workout stats.

```
scripting-ts run <skill_dir>/scripts/query_workouts.ts --queryparameters '{"start_date":"2026-04-08","end_date":"2026-04-15","limit":50}'
```

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `start_date` | string | ✅ | Start (inclusive). |
| `end_date` | string | ✅ | End (exclusive). |
| `limit` | number | ❌ | Max workouts to return. Default: 50. Results sorted newest-first. |

**Output:**
- `count`, `totals: { durationMinutes, durationFormatted, kcal, km }`
- `workouts: [...]` — each item has:
  - `uuid`, `activityType` (numeric), `activityName` (human-readable, e.g. `"Walking"`, `"Traditional Strength Training"`)
  - `startDate`, `endDate`, `durationMinutes`, `durationFormatted`
  - `distanceKm` (null for non-distance activities like strength training)
  - `kcal`, `avgHeartRateBpm`, `maxHeartRateBpm` (null if unavailable)
  - `source` (recording device/app name, e.g. `"Apple Watch"`)
  - `formatted` — one-line summary string

## 9. query_today_snapshot.ts — Today at a glance

A combined one-shot overview of today's health data. All sub-queries run in parallel so HealthKit shows a single merged permission prompt.

```
scripting-ts run <skill_dir>/scripts/query_today_snapshot.ts --queryparameters '{}'
```

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `source_name` | string | ❌ | Sleep source name to use for `sleepLastNight`, e.g. `"Thom’s Apple Watch"`. |
| `source_preference` | string | ❌ | Sleep source preference for `sleepLastNight`: `"watch"`, `"iphone"`, or `"all"`. Default behavior prefers Apple Watch if present. |

**Output:**
- `asOf`, `dayStart`, `dayEnd` (ISO timestamps)
- `today: { steps, distanceKm, activeKcal, exerciseMinutes, flightsClimbed, formatted: {...} }`
- `heartRate: { latestBpm, latestAt, restingBpm, restingAt }` — latest reading within 24h, resting within 7 days
- `rings`: same shape as `query_activity_summary.ts` for today, or `null` if no summary
- `sleepLastNight`: sleep session within the last ~18h window — `{ sessionStart, sessionEnd, totalAsleepMinutes, totalAsleepFormatted, stageMinutes, selectedSource, availableSources }`, or `null` if no sleep samples

# Instructions

1. Pick the script that matches the user's question:
   - **Quick overview** of today → `query_today_snapshot.ts` (no args needed)
   - **Single metric over a range** → step count / distance / active energy / exercise time
   - **Heart rate** → `query_heart_rate.ts`
   - **Sleep** → `query_sleep.ts`
   - **Activity rings by day** → `query_activity_summary.ts`
   - **Workout sessions list** → `query_workouts.ts`
   - **Body measurements** (weight, height, BMI) → `query_body_measurements.ts`
   - **Blood and vital signs** (SpO2, blood pressure, glucose, temperature) → `query_blood_metrics.ts`
   - **Heart health** (HRV, resting HR, VO2 Max) → `query_heart_health.ts`
   - **Fitness metrics** (flights, stand, exercise, distance, steps) → `query_fitness_metrics.ts`
   - **Body measurements** (weight, height, BMI) → `query_body_measurements.ts`
   - **Blood and vital signs** (SpO2, blood pressure, glucose, temperature) → `query_blood_metrics.ts`
   - **Heart health** (HRV, resting HR, VO2 Max) → `query_heart_health.ts`
   - **Fitness metrics** (flights, stand, exercise, distance, steps) → `query_fitness_metrics.ts`
2. Clarify the date range. Remember `end_date` is **exclusive at day granularity** — add +1 day if the user names an inclusive end date.
3. For cumulative metrics (#1–#4, #13), ask whether they want a daily breakdown (`daily: true`) or just a total.
4. Build the `--queryparameters` JSON and invoke via `run_shell_command`.
5. Parse the JSON and summarize using the `formatted` fields. For `daily` output, highlight totals, averages, and peak days.
6. On `success: false`, surface the error and suggest checking Health permissions for the Scripting app.

## New Scripts (Added)

## 10. query_body_measurements.ts — Body measurements (weight, height, BMI)

Query body measurements including weight, height, BMI, body fat percentage, and waist circumference.

```
scripting-ts run <skill_dir>/scripts/query_body_measurements.ts --queryparameters '{"start_date":"2026-04-01","end_date":"2026-05-27","metric":"all"}'
```

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `start_date` | string | ✅ | Start (inclusive). |
| `end_date` | string | ✅ | End (exclusive). |
| `metric` | string | ❌ | Specific metric: `"weight"`, `"height"`, `"bmi"`, `"bodyFat"`, `"waist"`, or `"all"`. Default: `"all"`. |

**Output:**
- `weight: { latest, latestFormatted, average, averageFormatted, min, minFormatted, max, maxFormatted }` — unit: kg
- `height: { latest, latestFormatted, average, averageFormatted }` — unit: cm
- `bmi: { latest, latestFormatted, average, averageFormatted, min, max }` — with health category (偏瘦/正常/偏胖/肥胖)
- `bodyFat: { latest, latestFormatted, average, averageFormatted }` — unit: percentage
- `waist: { latest, latestFormatted, average, averageFormatted }` — unit: cm

**Note:** If no BMI data is found but weight and height are available, BMI will be calculated automatically.

## 11. query_blood_metrics.ts — Blood and vital signs

Query blood oxygen (SpO2), blood pressure, blood glucose, respiratory rate, and body temperature.

```
scripting-ts run <skill_dir>/scripts/query_blood_metrics.ts --queryparameters '{"start_date":"2026-04-01","end_date":"2026-05-27","metric":"all"}'
```

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `start_date` | string | ✅ | Start (inclusive). |
| `end_date` | string | ✅ | End (exclusive). |
| `metric` | string | ❌ | Specific metric: `"oxygen"`, `"bloodPressure"`, `"glucose"`, `"respiratory"`, `"temperature"`, or `"all"`. Default: `"all"`. |

**Output:**
- `oxygen: { latest, latestFormatted, average, averageFormatted, min, max }` — SpO2 percentage with status (正常/偏低/过低)
- `bloodPressure: { sampleCount, latest: { systolic, diastolic, formatted, date, endDate, uuid, source }, average, range }` — mmHg with category (正常/偏高/高血压1级/高血压2级/高血压危象). Queried as HealthKit `bloodPressure` correlations so systolic and diastolic values are paired from the same measurement.
- `glucose: { latest, latestFormatted, average, averageFormatted, min, max }` — mg/dL with status (低血糖/正常/偏高/糖尿病范围)
- `respiratory: { latest, latestFormatted, average, averageFormatted }` — breaths per minute with status (正常/偏低/偏高)
- `temperature: { latest, latestFormatted, average, averageFormatted }` — °C with status (正常/偏低/偏高)

## 12. query_heart_health.ts — Heart health metrics

Query heart rate variability (HRV), resting heart rate, walking heart rate, current heart rate, and VO2 Max.

```
scripting-ts run <skill_dir>/scripts/query_heart_health.ts --queryparameters '{"start_date":"2026-04-01","end_date":"2026-05-27","metric":"all"}'
```

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `start_date` | string | ✅ | Start (inclusive). |
| `end_date` | string | ✅ | End (exclusive). |
| `metric` | string | ❌ | Specific metric: `"hrv"`, `"resting"`, `"walking"`, `"current"`, `"vo2max"`, or `"all"`. Default: `"all"`. |

**Output:**
- `hrv: { latest, latestFormatted, average, averageFormatted, min, max }` — milliseconds with status (良好/一般/偏低)
- `restingHeartRate: { latest, latestFormatted, average, averageFormatted, min, max }` — bpm with status (正常/偏低/偏高)
- `walkingHeartRate: { latest, latestFormatted, average, averageFormatted }` — bpm
- `heartRate: { latest, latestFormatted, average, averageFormatted, min, max }` — current heart rate in bpm
- `vo2Max: { latest, latestFormatted, average, averageFormatted }` — mL/min/kg with fitness level (优秀/良好/一般/需提升)
- `heartHealthScore: { score, maxScore, percentage, level, formatted, details }` — calculated when metric is `"all"`

## 13. query_fitness_metrics.ts — Fitness and activity metrics

Query flights climbed, stand time, exercise time, active energy, distance, and step count with optional daily breakdown.

```
scripting-ts run <skill_dir>/scripts/query_fitness_metrics.ts --queryparameters '{"start_date":"2026-05-01","end_date":"2026-05-27","metric":"all","daily":true}'
```

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `start_date` | string | ✅ | Start (inclusive). |
| `end_date` | string | ✅ | End (exclusive). |
| `metric` | string | ❌ | Specific metric: `"flights"`, `"stand"`, `"exercise"`, `"energy"`, `"distance"`, `"steps"`, or `"all"`. Default: `"all"`. |
| `daily` | boolean | ❌ | If true, include per-day breakdown. Default: false. |

**Output:**
- `flightsClimbed: { total, totalFormatted }` — flights climbed, optional `daily: [{date, flights}]`
- `stand: { totalHours, totalFormatted, daysTracked, averagePerDay, averagePerDayFormatted }` — stand hours, optional `daily: [{date, hours}]`
- `exerciseTime: { totalMinutes, totalFormatted }` — exercise minutes, optional `daily: [{date, minutes, formatted}]`
- `activeEnergy: { totalKcal, totalFormatted }` — active kilocalories, optional `daily: [{date, kcal}]`
- `distance: { totalKm, totalFormatted }` — walking/running distance in km, optional `daily: [{date, km, formatted}]`
- `steps: { total, totalFormatted }` — step count, optional `daily: [{date, steps}]`
- `fitnessScore: { score, maxScore, percentage, level, formatted, details }` — calculated when metric is `"all"`
