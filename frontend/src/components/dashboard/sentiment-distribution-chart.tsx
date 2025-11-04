"use client"

import { useMemo } from "react"
import { Pie, PieChart, ResponsiveContainer } from "recharts"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart"

type SentimentCounts = {
  positive?: number
  negative?: number
  neutral?: number
}

type SentimentDistributionChartProps = {
  data?: {
    sentiment: 'positive' | 'negative' | 'neutral'
  }[]
  counts?: SentimentCounts
}

export function SentimentDistributionChart({ data = [], counts }: SentimentDistributionChartProps) {
  const sentimentCounts = useMemo(() => {
    const base = { positive: 0, negative: 0, neutral: 0 }
    if (counts) {
      base.positive = Number(counts.positive || 0)
      base.negative = Number(counts.negative || 0)
      base.neutral = Number(counts.neutral || 0)
    } else {
      data.forEach(review => {
        base[review.sentiment]++
      })
    }
    return [
      { sentiment: 'positive', count: base.positive, fill: 'hsl(var(--chart-2))' },
      { sentiment: 'negative', count: base.negative, fill: 'hsl(var(--destructive))' },
      { sentiment: 'neutral', count: base.neutral, fill: 'hsl(var(--muted-foreground))' },
    ].filter(item => item.count > 0)
  }, [data, counts])

  const chartConfig = useMemo(() => {
    const config: any = {};
    sentimentCounts.forEach(item => {
        config[item.sentiment] = {
            label: item.sentiment.charAt(0).toUpperCase() + item.sentiment.slice(1),
            color: item.fill,
        };
    });
    return config;
}, [sentimentCounts]);

  const totalReviews = useMemo(() => sentimentCounts.reduce((acc, curr) => acc + curr.count, 0), [sentimentCounts]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sentiment Distribution</CardTitle>
        <CardDescription>Breakdown of review sentiment.</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pb-0">
        <ChartContainer
          config={chartConfig}
          className="mx-auto aspect-square h-[250px]"
        >
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent hideLabel />}
              />
              <Pie
                data={sentimentCounts}
                dataKey="count"
                nameKey="sentiment"
                innerRadius={60}
                strokeWidth={5}
              >
              </Pie>
              <ChartLegend
                content={<ChartLegendContent nameKey="sentiment" />}
                className="-translate-y-[2rem] flex-wrap gap-2 [&>*]:basis-1/4 [&>*]:justify-center"
              />
            </PieChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
