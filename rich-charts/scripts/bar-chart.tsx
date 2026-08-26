import { BarChart, Chart, VStack, Text } from "scripting"
import { ChartTitle, SeriesLegend } from "./chart-ui"
import { BarChartProps, categoryLabels, chartStyle, horizontalCategoryViewport, seriesColor } from "./types"

/** Category bar chart. Multi-series bars are grouped along the category axis. */
export function BarChartView({
  title,
  height,
  data,
  series,
  labelOnYAxis = false,
  color,
  cornerRadius = 4,
  scrollable = "auto",
  visibleCategoryCount,
}: BarChartProps) {
  const viewport = horizontalCategoryViewport(categoryLabels(data, series), labelOnYAxis, scrollable, visibleCategoryCount)
  const nonEmptySeries = series?.filter(item => item.data.length > 0) ?? []

  if (nonEmptySeries.length > 0) {
    const categoryAxis = labelOnYAxis ? "vertical" : "horizontal"
    const legendItems = nonEmptySeries.map((item, index) => ({
      key: `series-${index}`,
      name: item.name,
      color: seriesColor(item.color, index),
    }))

    return (
      <VStack spacing={8}>
        <ChartTitle title={title} />
        <Chart frame={{ height }} {...viewport}>
          {nonEmptySeries.map((item, index) => {
            const key = `series-${index}`
            return (
              <BarChart
                key={key}
                labelOnYAxis={labelOnYAxis}
                marks={item.data.map(point => ({
                  label: point.label,
                  value: point.value,
                  unit: point.unit,
                  stacking: "unstacked",
                  positionBy: { value: key, axis: categoryAxis },
                  foregroundStyle: chartStyle(seriesColor(item.color, index)),
                  cornerRadius,
                }))}
              />
            )
          })}
        </Chart>
        <SeriesLegend items={legendItems} />
      </VStack>
    )
  }

  if (data && data.length > 0) {
    return (
      <VStack spacing={8}>
        <ChartTitle title={title} />
        <Chart frame={{ height }} {...viewport}>
          <BarChart
            labelOnYAxis={labelOnYAxis}
            marks={data.map(point => ({
              label: point.label,
              value: point.value,
              unit: point.unit,
              foregroundStyle: chartStyle(color ?? seriesColor(undefined, 0)),
              cornerRadius,
            }))}
          />
        </Chart>
      </VStack>
    )
  }

  return (
    <VStack spacing={8}>
      <ChartTitle title={title} />
      <Text foregroundStyle="secondaryLabel">暂无数据</Text>
    </VStack>
  )
}
