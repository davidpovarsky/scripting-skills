import type {
  CalendarComponent,
  ChartInterpolationMethod,
  ChartMarkStackingMethod,
  ChartSymbolShape,
  Color,
  ShapeStyle,
} from "scripting"

/** Colors accepted by Scripting's Color API: keyword, hex, rgb/rgba or hsl/hsla. */
export type ChartColor = Color
export type ChartLabel = string
export type ChartSymbol = ChartSymbolShape
export type ChartInterpolation = ChartInterpolationMethod
export type ChartStacking = ChartMarkStackingMethod

export const DEFAULT_COLORS: ChartColor[] = [
  "#4A90D9", "#E85D75", "#50C878", "#FFB347",
  "#9B59B6", "#1ABC9C", "#F39C12", "#E74C3C",
]

/** Converts a validated public chart color into the style expected by chart marks. */
export function chartStyle(color: ChartColor): ShapeStyle {
  return color
}

export function seriesColor(color: ChartColor | undefined, index: number): ChartColor {
  return color ?? DEFAULT_COLORS[index % DEFAULT_COLORS.length]
}

export interface DataPoint {
  /** String category label. JSON inputs use category axes; ISO date strings are not automatically converted to Date axes. */
  label: ChartLabel
  value: number
  /** Reserved for programmatic renderers that convert labels to Date before reaching chart marks. */
  unit?: CalendarComponent
}

export interface CategoryDataPoint {
  category: string
  value: number
}

export interface ScatterPoint {
  x: number
  y: number
}

export interface SeriesData {
  /** Optional caller identity. It must be non-empty and unique in ChartRenderer configs; when absent, ChartRenderer assigns `series-${index}` as a stable per-render grouping and color key. */
  id?: string
  /** Displayed in the legend; it is not used as a grouping key. */
  name: string
  data: DataPoint[]
  color?: ChartColor
}

export type ChartType = "bar" | "bar1d" | "line" | "area" | "areaStack" | "pie" | "donut" | "point"

export interface CategoryViewportOptions {
  /** Enable category-axis scrolling. "auto" scrolls dense horizontal category axes; default: "auto". */
  scrollable?: boolean | "auto"
  /** Number of categories visible at once while scrolling. Overrides the adaptive default. */
  visibleCategoryCount?: number
}

export interface BarChartConfig {
  type: "bar"
  title?: string
  data?: DataPoint[]
  series?: SeriesData[]
  options?: CategoryViewportOptions & { labelOnYAxis?: boolean; color?: ChartColor; cornerRadius?: number }
}

export interface Bar1DChartConfig {
  type: "bar1d"
  title?: string
  data: CategoryDataPoint[]
  options?: { labelOnYAxis?: boolean; colors?: ChartColor[] }
}

export interface LineChartConfig {
  type: "line"
  title?: string
  data?: DataPoint[]
  series?: SeriesData[]
  options?: CategoryViewportOptions & { labelOnYAxis?: boolean; interpolationMethod?: ChartInterpolation; showSymbols?: boolean; symbol?: ChartSymbol }
}

export interface AreaChartConfig {
  type: "area"
  title?: string
  data?: DataPoint[]
  series?: SeriesData[]
  options?: CategoryViewportOptions & { labelOnYAxis?: boolean; interpolationMethod?: ChartInterpolation }
}

export interface AreaStackChartConfig {
  type: "areaStack"
  title?: string
  data: Array<{ category: string; label: ChartLabel; value: number; unit?: CalendarComponent }>
  options?: CategoryViewportOptions & { labelOnYAxis?: boolean; stacking?: ChartStacking; colors?: ChartColor[] }
}

export interface PieChartConfig {
  type: "pie"
  title?: string
  data: CategoryDataPoint[]
  options?: { showPercentage?: boolean; colors?: ChartColor[] }
}

export interface DonutChartConfig {
  type: "donut"
  title?: string
  data: CategoryDataPoint[]
  options?: { showPercentage?: boolean; colors?: ChartColor[]; innerRadius?: number; outerRadius?: number }
}

export interface PointChartConfig {
  type: "point"
  title?: string
  data?: ScatterPoint[]
  series?: Array<{ id?: string; name: string; data: ScatterPoint[]; color?: ChartColor }>
  options?: { symbolSize?: number; symbol?: ChartSymbol }
}

export type ChartConfig = BarChartConfig | Bar1DChartConfig | LineChartConfig | AreaChartConfig | AreaStackChartConfig | PieChartConfig | DonutChartConfig | PointChartConfig

export function categoryLabels(data?: DataPoint[], series?: SeriesData[]): string[] {
  const labels = series?.length ? series.flatMap(item => item.data.map(point => point.label)) : (data ?? []).map(point => point.label)
  return [...new Set(labels)]
}

/** Adaptive horizontal category viewport for narrow mobile charts. */
export function horizontalCategoryViewport(labels: string[], labelOnYAxis: boolean, scrollable: boolean | "auto" = "auto", requestedCount?: number) {
  if (labelOnYAxis || labels.length === 0 || scrollable === false) return {}
  const longest = labels.reduce((max, label) => Math.max(max, label.length), 0)
  const adaptiveCount = longest >= 10 ? 6 : longest >= 6 ? 8 : 10
  const visibleCount = requestedCount == null ? adaptiveCount : Math.max(1, Math.floor(requestedCount))
  const shouldScroll = scrollable === true || labels.length > visibleCount
  return shouldScroll ? { chartScrollableAxes: "horizontal" as const, chartXVisibleDomain: Math.min(visibleCount, labels.length) } : {}
}

export interface ChartRendererProps { config: ChartConfig; height?: number }
export interface BaseChartProps { title?: string; height: number }
export interface BarChartProps extends BaseChartProps, CategoryViewportOptions { data?: DataPoint[]; series?: SeriesData[]; labelOnYAxis?: boolean; color?: ChartColor; cornerRadius?: number }
export interface Bar1DChartProps extends BaseChartProps { data: CategoryDataPoint[]; labelOnYAxis?: boolean; colors?: ChartColor[] }
export interface LineChartProps extends BaseChartProps, CategoryViewportOptions { data?: DataPoint[]; series?: SeriesData[]; labelOnYAxis?: boolean; interpolationMethod?: ChartInterpolation; showSymbols?: boolean; symbol?: ChartSymbol }
export interface AreaChartProps extends BaseChartProps, CategoryViewportOptions { data?: DataPoint[]; series?: SeriesData[]; labelOnYAxis?: boolean; interpolationMethod?: ChartInterpolation }
export interface AreaStackChartProps extends BaseChartProps, CategoryViewportOptions { data: AreaStackChartConfig["data"]; labelOnYAxis?: boolean; stacking?: ChartStacking; colors?: ChartColor[] }
export interface PieChartProps extends BaseChartProps { data: CategoryDataPoint[]; showPercentage?: boolean; colors?: ChartColor[] }
export interface DonutChartProps extends BaseChartProps { data: CategoryDataPoint[]; showPercentage?: boolean; colors?: ChartColor[]; innerRadius?: number; outerRadius?: number }
export interface PointChartProps extends BaseChartProps { data?: ScatterPoint[]; series?: PointChartConfig["series"]; symbolSize?: number; symbol?: ChartSymbol }
