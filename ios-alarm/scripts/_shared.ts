import { AppIntentProtocol, Color } from "scripting"

/* ================================================================== *
 *  Error model
 * ================================================================== */

export type ErrorCode =
  | "UNAVAILABLE"
  | "MISSING_PARAM"
  | "INVALID_PARAM"
  | "UNKNOWN_PARAM"
  | "SCHEDULE_REJECTED"
  | "INTERNAL"

export class ValidationError extends Error {
  code: ErrorCode
  param?: string
  details?: any
  constructor(code: ErrorCode, message: string, param?: string, details?: any) {
    super(message)
    this.code = code
    this.param = param
    this.details = details
  }
}

export function fail(exit: (r: any) => void, err: unknown): void {
  if (err instanceof ValidationError) {
    exit({
      success: false,
      errorCode: err.code,
      param: err.param,
      message: err.message,
      ...(err.details !== undefined ? { details: err.details } : {}),
    })
    return
  }
  const anyErr = err as any
  exit({
    success: false,
    errorCode: "INTERNAL",
    message: anyErr?.message ?? String(err),
  })
}

/* ================================================================== *
 *  Apple-native weekday numbering: 1=Sun..7=Sat.
 * ================================================================== */
export const WEEKDAY_NAMES = ["", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

export function weekdaysToText(weekdays?: number[] | null): string[] | null {
  if (!weekdays || !weekdays.length) return null
  return weekdays.map(w => WEEKDAY_NAMES[w] ?? String(w))
}

/* ================================================================== *
 *  Low-level type guards
 * ================================================================== */

function isPlainObject(v: unknown): v is Record<string, any> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}

function ensureKnownKeys(
  obj: Record<string, any>,
  allowed: readonly string[],
  path: string,
): void {
  const allow = new Set(allowed)
  for (const k of Object.keys(obj)) {
    if (!allow.has(k)) {
      throw new ValidationError(
        "UNKNOWN_PARAM",
        `Unknown parameter '${k}' in ${path}. Allowed: ${allowed.join(", ")}`,
        `${path}.${k}`,
      )
    }
  }
}

function ensureType(
  v: unknown,
  kind: "string" | "number" | "boolean" | "object" | "array",
  param: string,
): void {
  const ok =
    kind === "array"
      ? Array.isArray(v)
      : kind === "object"
        ? isPlainObject(v)
        : typeof v === kind
  if (!ok) {
    throw new ValidationError(
      "INVALID_PARAM",
      `Parameter '${param}' must be of type ${kind}, got ${describe(v)}`,
      param,
    )
  }
}

function describe(v: unknown): string {
  if (v === null) return "null"
  if (Array.isArray(v)) return "array"
  return typeof v
}

/* ================================================================== *
 *  Coercion helpers (accept JSON-ish string variants too)
 * ================================================================== */

export function parseJsonParam<T = any>(v: unknown, param: string): T | null {
  if (v === undefined || v === null || v === "") return null
  if (typeof v === "object") return v as T
  if (typeof v === "string") {
    try { return JSON.parse(v) as T }
    catch {
      throw new ValidationError(
        "INVALID_PARAM",
        `Parameter '${param}' must be a JSON value (got unparseable string)`,
        param,
      )
    }
  }
  throw new ValidationError(
    "INVALID_PARAM",
    `Parameter '${param}' must be a JSON object or JSON string`,
    param,
  )
}

function coerceFiniteNumber(v: unknown, param: string): number | null {
  if (v === undefined || v === null || v === "") return null
  const n = typeof v === "string" ? Number(v) : v
  if (typeof n !== "number" || !Number.isFinite(n)) {
    throw new ValidationError(
      "INVALID_PARAM",
      `Parameter '${param}' must be a finite number, got ${describe(v)}`,
      param,
    )
  }
  return n
}

function coerceIntegerInRange(
  v: unknown, param: string, min: number, max: number,
): number | null {
  const n = coerceFiniteNumber(v, param)
  if (n === null) return null
  if (!Number.isInteger(n)) {
    throw new ValidationError("INVALID_PARAM", `Parameter '${param}' must be an integer, got ${n}`, param)
  }
  if (n < min || n > max) {
    throw new ValidationError("INVALID_PARAM", `Parameter '${param}' must be in [${min},${max}], got ${n}`, param)
  }
  return n
}

function coercePositiveSeconds(v: unknown, param: string): number | null {
  const n = coerceFiniteNumber(v, param)
  if (n === null) return null
  if (n <= 0) {
    throw new ValidationError("INVALID_PARAM", `Parameter '${param}' must be > 0 seconds, got ${n}`, param)
  }
  const MAX = 7 * 24 * 3600 // 7 days
  if (n > MAX) {
    throw new ValidationError("INVALID_PARAM", `Parameter '${param}' must be ≤ ${MAX} seconds (7 days), got ${n}`, param)
  }
  return n
}

function coerceNonEmptyString(v: unknown, param: string, maxLen = 256): string | null {
  if (v === undefined || v === null) return null
  if (typeof v !== "string") {
    throw new ValidationError("INVALID_PARAM", `Parameter '${param}' must be a string, got ${describe(v)}`, param)
  }
  const trimmed = v.trim()
  if (!trimmed) {
    throw new ValidationError("INVALID_PARAM", `Parameter '${param}' must be a non-empty string`, param)
  }
  if (trimmed.length > maxLen) {
    throw new ValidationError("INVALID_PARAM", `Parameter '${param}' length ${trimmed.length} exceeds max ${maxLen}`, param)
  }
  return trimmed
}

function coerceEnum<T extends string>(
  v: unknown, param: string, allowed: readonly T[],
): T | null {
  if (v === undefined || v === null || v === "") return null
  if (typeof v !== "string" || !(allowed as readonly string[]).includes(v)) {
    throw new ValidationError(
      "INVALID_PARAM",
      `Parameter '${param}' must be one of: ${allowed.join(", ")}. Got ${JSON.stringify(v)}`,
      param,
    )
  }
  return v as T
}

/* ================================================================== *
 *  Color validation (simple structural filter)
 * ================================================================== */

const COLOR_KEYWORDS = new Set([
  // Apple system colors (subset)
  "red","orange","yellow","green","mint","teal","cyan","blue","indigo","purple","pink","brown","white","gray","black","clear","primary","secondary",
  "systemRed","systemOrange","systemYellow","systemGreen","systemMint","systemTeal","systemCyan","systemBlue","systemIndigo","systemPurple","systemPink","systemBrown","systemGray","systemWhite","systemBlack",
  "label","secondaryLabel","tertiaryLabel","quaternaryLabel",
  "link","placeholderText","separator","opaqueSeparator",
  "systemBackground","secondarySystemBackground","tertiarySystemBackground",
  "systemGroupedBackground","secondarySystemGroupedBackground","tertiarySystemGroupedBackground",
  "systemFill","secondarySystemFill","tertiarySystemFill","quaternarySystemFill",
])

function validateColor(v: unknown, param: string): Color | undefined {
  if (v === undefined || v === null || v === "") return undefined
  if (typeof v !== "string") {
    throw new ValidationError("INVALID_PARAM", `Parameter '${param}' must be a color string`, param)
  }
  const s = v.trim()
  if (!s) return undefined
  const hex = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/
  const rgba = /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1|0?\.\d+)\s*)?\)$/
  if (hex.test(s) || rgba.test(s) || COLOR_KEYWORDS.has(s)) return s as Color
  throw new ValidationError(
    "INVALID_PARAM",
    `Parameter '${param}' is not a valid color. Use #RRGGBB / #RRGGBBAA / rgba(...) / keyword (e.g. 'systemOrange'). Got: ${s}`,
    param,
  )
}

/* ================================================================== *
 *  Metadata
 * ================================================================== */

function validateMetadata(v: unknown, param: string): Record<string, string> | undefined {
  if (v === undefined || v === null || v === "") return undefined
  if (!isPlainObject(v)) {
    throw new ValidationError("INVALID_PARAM", `Parameter '${param}' must be a string-to-string object`, param)
  }
  const out: Record<string, string> = {}
  for (const [k, val] of Object.entries(v)) {
    if (typeof val !== "string") {
      throw new ValidationError("INVALID_PARAM", `metadata['${k}'] must be a string, got ${describe(val)}`, `${param}.${k}`)
    }
    out[k] = val
  }
  return out
}

/* ================================================================== *
 *  Schedule
 * ================================================================== */

export type ScheduleType = "fixed" | "relative" | "weekly"
export const SCHEDULE_TYPES: readonly ScheduleType[] = ["fixed", "relative", "weekly"] as const

export interface ScheduleParams {
  scheduleType?: ScheduleType | string | null
  date?: string | null
  hour?: number | null
  minute?: number | null
  weekdays?: number[] | null
}

const SCHEDULE_KEYS = ["scheduleType", "date", "hour", "minute", "weekdays"] as const

export function buildSchedule(p: ScheduleParams): AlarmManager.Schedule | null {
  if (!p || !p.scheduleType) return null
  if (isPlainObject(p)) ensureKnownKeys(p, SCHEDULE_KEYS, "schedule")

  const type = coerceEnum(p.scheduleType, "schedule.scheduleType", SCHEDULE_TYPES)
  if (!type) return null

  if (type === "fixed") {
    const d = coerceNonEmptyString(p.date, "schedule.date")
    if (!d) {
      throw new ValidationError("MISSING_PARAM", "schedule.fixed requires 'date' (ISO string).", "schedule.date")
    }
    const parsed = new Date(d)
    if (isNaN(parsed.getTime())) {
      throw new ValidationError("INVALID_PARAM", `schedule.date is not a valid date: '${d}'`, "schedule.date")
    }
    if (parsed.getTime() < Date.now() - 60_000) {
      throw new ValidationError(
        "INVALID_PARAM",
        `schedule.date must be in the future (got ${parsed.toISOString()}).`,
        "schedule.date",
      )
    }
    return AlarmManager.Schedule.fixed(parsed)
  }

  if (type === "relative") {
    const h = coerceIntegerInRange(p.hour, "schedule.hour", 0, 23)
    const m = coerceIntegerInRange(p.minute, "schedule.minute", 0, 59)
    if (h === null || m === null) {
      throw new ValidationError("MISSING_PARAM", "schedule.relative requires integer 'hour' (0-23) and 'minute' (0-59).", "schedule.hour|minute")
    }
    return AlarmManager.Schedule.relative(h, m)
  }

  // weekly
  const h = coerceIntegerInRange(p.hour, "schedule.hour", 0, 23)
  const m = coerceIntegerInRange(p.minute, "schedule.minute", 0, 59)
  if (h === null || m === null) {
    throw new ValidationError("MISSING_PARAM", "schedule.weekly requires integer 'hour' and 'minute'.", "schedule.hour|minute")
  }
  if (p.weekdays === undefined || p.weekdays === null) {
    throw new ValidationError("MISSING_PARAM", "schedule.weekly requires non-empty 'weekdays' (Apple: 1=Sun..7=Sat).", "schedule.weekdays")
  }
  if (!Array.isArray(p.weekdays) || p.weekdays.length === 0) {
    throw new ValidationError("INVALID_PARAM", "schedule.weekdays must be a non-empty array of 1..7.", "schedule.weekdays")
  }
  const seen = new Set<number>()
  const wds: number[] = []
  for (let i = 0; i < p.weekdays.length; i++) {
    const w = coerceIntegerInRange(p.weekdays[i], `schedule.weekdays[${i}]`, 1, 7)!
    if (!seen.has(w)) {
      seen.add(w)
      wds.push(w)
    }
  }
  return AlarmManager.Schedule.weekly(h, m, wds)
}

/* ================================================================== *
 *  Buttons
 * ================================================================== */

export interface ButtonParams {
  title?: string
  systemImageName?: string
  textColor?: string
}

const BUTTON_KEYS = ["title", "systemImageName", "textColor"] as const

function validateButton(v: unknown, param: string): ButtonParams | null {
  if (v === undefined || v === null) return null
  if (!isPlainObject(v)) {
    throw new ValidationError("INVALID_PARAM", `Parameter '${param}' must be an object`, param)
  }
  ensureKnownKeys(v, BUTTON_KEYS, param)
  const title = coerceNonEmptyString(v.title, `${param}.title`, 64)
  const sys = coerceNonEmptyString(v.systemImageName, `${param}.systemImageName`, 128)
  if (!title && !sys) {
    throw new ValidationError(
      "INVALID_PARAM",
      `${param} must have at least 'title' or 'systemImageName'`,
      param,
    )
  }
  const color = validateColor(v.textColor, `${param}.textColor`)
  return {
    title: title ?? undefined,
    systemImageName: sys ?? undefined,
    textColor: color as string | undefined,
  }
}

export function buildButton(p?: ButtonParams | null): AlarmManager.Button | null {
  if (!p) return null
  return AlarmManager.Button.create({
    title: p.title,
    systemImageName: p.systemImageName,
    textColor: p.textColor as Color | undefined,
  })
}

/* ================================================================== *
 *  Shorthand-vs-object mutual exclusion for a button
 * ================================================================== */
function resolveButton(
  params: Record<string, any>,
  paramKey: "stopButton" | "secondaryButton",
  shorthand: { title?: string; systemImage?: string; textColor?: string },
  defaults?: ButtonParams | null,
): ButtonParams | null {
  const objRaw = params[paramKey]
  const hasObject = objRaw !== undefined && objRaw !== null && objRaw !== ""
  const hasShorthand =
    (shorthand.title !== undefined && shorthand.title !== null && shorthand.title !== "") ||
    (shorthand.systemImage !== undefined && shorthand.systemImage !== null && shorthand.systemImage !== "") ||
    (shorthand.textColor !== undefined && shorthand.textColor !== null && shorthand.textColor !== "")
  if (hasObject && hasShorthand) {
    throw new ValidationError(
      "INVALID_PARAM",
      `Cannot combine '${paramKey}' object with its shorthand keys; use one style only.`,
      paramKey,
    )
  }
  if (hasObject) {
    const parsed = parseJsonParam<ButtonParams>(objRaw, paramKey)
    return validateButton(parsed, paramKey)
  }
  if (hasShorthand) {
    return validateButton(
      {
        title: shorthand.title,
        systemImageName: shorthand.systemImage,
        textColor: shorthand.textColor,
      },
      paramKey,
    )
  }
  return defaults ?? null
}

/* ================================================================== *
 *  Attributes (alert + countdown + paused presentations)
 * ================================================================== */

export type SecondaryBehavior = "countdown" | "custom" | "none"
export const SECONDARY_BEHAVIORS: readonly SecondaryBehavior[] = ["countdown", "custom", "none"] as const

export interface AttributesParams {
  title: string
  stopButton?: ButtonParams | null
  secondaryButton?: ButtonParams | null
  secondaryBehavior?: SecondaryBehavior
  countdownTitle?: string | null
  countdownPauseButton?: ButtonParams | null
  pausedTitle?: string | null
  pausedResumeButton?: ButtonParams | null
  tintColor?: Color | null
  metadata?: Record<string, string> | null
}

/**
 * Build Attributes for alarm configurations.
 * 
 * IMPORTANT: For Configuration.alarm(), do NOT include countdown/paused presentations!
 * AlarmKit will reject the schedule with error 0 if these are present.
 * Only Configuration.timer() and Configuration.countdown() should use countdown/paused.
 */
export function buildAttributes(
  p: AttributesParams,
  options?: { includeCountdownPaused?: boolean }
): AlarmManager.Attributes | null {
  const stopBtn = buildButton(p.stopButton) ?? AlarmManager.Button.create({ title: "Stop" })

  let secondaryBtn: AlarmManager.Button | null = null
  let secondaryBehavior: AlarmManager.SecondaryButtonBehavior | null = null
  if (p.secondaryBehavior && p.secondaryBehavior !== "none") {
    secondaryBtn = buildButton(p.secondaryButton) ?? AlarmManager.Button.create({
      title: p.secondaryBehavior === "countdown" ? "Snooze" : "More",
    })
    secondaryBehavior = p.secondaryBehavior as AlarmManager.SecondaryButtonBehavior
  }

  const alert = AlarmManager.AlertPresentation.create({
    title: p.title,
    stopButton: stopBtn,
    secondaryButton: secondaryBtn,
    secondaryBehavior: secondaryBehavior,
  })

  // Only include countdown/paused for timer and countdown configurations.
  // Configuration.alarm() will FAIL with AlarmKit error 0 if these are present!
  if (options?.includeCountdownPaused) {
    const countdown = AlarmManager.CountdownPresentation.create(
      p.countdownTitle ?? p.title,
      buildButton(p.countdownPauseButton),
    )

    const paused = AlarmManager.PausedPresentation.create(
      p.pausedTitle ?? p.title,
      buildButton(p.pausedResumeButton),
    )

    return AlarmManager.Attributes.create({
      alert,
      countdown,
      paused,
      tintColor: (p.tintColor ?? undefined) as Color | undefined,
      metadata: p.metadata ?? undefined,
    })
  }

  // For Configuration.alarm(): only alert, no countdown/paused
  return AlarmManager.Attributes.create({
    alert,
    tintColor: (p.tintColor ?? undefined) as Color | undefined,
    metadata: p.metadata ?? undefined,
  })
}

/* ================================================================== *
 *  Sound
 * ================================================================== */

export function buildSound(name?: string | null): AlarmManager.Sound {
  if (name && name.trim()) {
    return AlarmManager.Sound.named(name.trim())
  }
  return AlarmManager.Sound.default()
}

/* ================================================================== *
 *  AppIntent (stop / secondary)
 * ================================================================== */

export interface AppIntentParams {
  script: string
  name: string
  params?: Record<string, any>
}

const INTENT_KEYS = ["script", "name", "params"] as const

function validateAppIntent(v: unknown, paramKey: string): AppIntentParams | null {
  if (v === undefined || v === null || v === "") return null
  if (!isPlainObject(v)) {
    throw new ValidationError("INVALID_PARAM", `Parameter '${paramKey}' must be an object {script,name,params?}`, paramKey)
  }
  ensureKnownKeys(v, INTENT_KEYS, paramKey)
  const script = coerceNonEmptyString(v.script, `${paramKey}.script`, 128)
  const name = coerceNonEmptyString(v.name, `${paramKey}.name`, 128)
  if (!script || !name) {
    throw new ValidationError("MISSING_PARAM", `${paramKey} requires non-empty 'script' and 'name'`, paramKey)
  }
  let params: Record<string, any> | undefined
  if (v.params !== undefined && v.params !== null) {
    if (!isPlainObject(v.params)) {
      throw new ValidationError("INVALID_PARAM", `${paramKey}.params must be a plain object`, `${paramKey}.params`)
    }
    try { JSON.stringify(v.params) }
    catch {
      throw new ValidationError("INVALID_PARAM", `${paramKey}.params must be JSON-serializable`, `${paramKey}.params`)
    }
    params = v.params
  }
  return { script, name, params }
}

export function buildAlarmAppIntent(p?: AppIntentParams | null): AlarmManager.AlarmAppIntent | null {
  if (!p) return null
  return {
    script: p.script,
    name: p.name,
    protocol: AppIntentProtocol.LiveActivityIntent,
    params: p.params ?? {},
  } as AlarmManager.AlarmAppIntent
}

/* ================================================================== *
 *  Guards
 * ================================================================== */

export function ensureAvailable(exit: (r: any) => void): boolean {
  if (!AlarmManager.isAvailable) {
    exit({
      success: false,
      errorCode: "UNAVAILABLE",
      message: "AlarmManager is not available on this device (requires iOS 26+).",
    })
    return false
  }
  return true
}

/* ================================================================== *
 *  Full payload validation used by each scheduler
 * ================================================================== */

export const COMMON_PARAM_KEYS = [
  "id", "title",
  "sound", "tintColor",
  "stopButton", "stopButtonTitle", "stopButtonSystemImage", "stopButtonTextColor",
  "secondaryButton", "secondaryButtonTitle", "secondaryButtonSystemImage",
  "secondaryBehavior",
  "countdownTitle", "pausedTitle",
  "metadata",
  "stopIntent", "secondaryIntent",
] as const

export const TIMER_PARAM_KEYS = [...COMMON_PARAM_KEYS, "duration"] as const

export const ALARM_PARAM_KEYS = [
  ...COMMON_PARAM_KEYS,
  "schedule",
  "scheduleType", "date", "hour", "minute", "weekdays",
] as const

export const COUNTDOWN_PARAM_KEYS = [
  ...COMMON_PARAM_KEYS,
  "preAlert", "postAlert",
  "schedule",
  "scheduleType", "date", "hour", "minute", "weekdays",
] as const

export function validateTopLevelKeys(params: Record<string, any>, allowed: readonly string[]) {
  ensureKnownKeys(params, allowed, "query")
}

export interface NormalizedCommon {
  id: string
  title: string
  sound: AlarmManager.Sound
  stopIntent: AlarmManager.AlarmAppIntent | null
  secondaryIntent: AlarmManager.AlarmAppIntent | null
  attributesParams: AttributesParams
}

export function validateCommon(params: Record<string, any>): NormalizedCommon {
  const id = coerceNonEmptyString(params.id, "id", 128) ?? UUID.string()
  const title = coerceNonEmptyString(params.title, "title", 256) ?? "Alarm"
  const sound = buildSound(coerceNonEmptyString(params.sound, "sound", 128))

  const stopButton = resolveButton(
    params, "stopButton",
    {
      title: params.stopButtonTitle,
      systemImage: params.stopButtonSystemImage,
      textColor: params.stopButtonTextColor,
    },
    null,
  )
  const secondaryButton = resolveButton(
    params, "secondaryButton",
    {
      title: params.secondaryButtonTitle,
      systemImage: params.secondaryButtonSystemImage,
    },
    null,
  )

  const secondaryBehavior =
    coerceEnum(params.secondaryBehavior, "secondaryBehavior", SECONDARY_BEHAVIORS) ?? "countdown"

  const countdownTitle = coerceNonEmptyString(params.countdownTitle, "countdownTitle", 256)
  const pausedTitle = coerceNonEmptyString(params.pausedTitle, "pausedTitle", 256)
  const tintColor = validateColor(params.tintColor, "tintColor") ?? null
  const metadata = validateMetadata(parseJsonParam(params.metadata, "metadata"), "metadata") ?? null

  const stopIntent = buildAlarmAppIntent(
    validateAppIntent(parseJsonParam(params.stopIntent, "stopIntent"), "stopIntent"),
  )
  const secondaryIntent = buildAlarmAppIntent(
    validateAppIntent(parseJsonParam(params.secondaryIntent, "secondaryIntent"), "secondaryIntent"),
  )

  return {
    id,
    title,
    sound,
    stopIntent,
    secondaryIntent,
    attributesParams: {
      title,
      stopButton,
      secondaryButton,
      secondaryBehavior: secondaryBehavior as SecondaryBehavior,
      countdownTitle,
      pausedTitle,
      tintColor,
      metadata,
    },
  }
}

/* Numeric duration / seconds */
export function requirePositiveSeconds(v: unknown, param: string): number {
  const n = coercePositiveSeconds(v, param)
  if (n === null) {
    throw new ValidationError("MISSING_PARAM", `Parameter '${param}' is required (positive seconds).`, param)
  }
  return n
}
export function optionalPositiveSeconds(v: unknown, param: string): number | null {
  return coercePositiveSeconds(v, param)
}
