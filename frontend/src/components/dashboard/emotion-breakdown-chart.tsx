"use client"

import { useMemo } from "react"
import { Bar, BarChart, CartesianGrid, XAxis, ResponsiveContainer, YAxis } from "recharts"
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
} from "@/components/ui/chart"

type EmotionBreakdownChartProps = {
  data: {
    emotion: string
  }[]
}

const chartConfig = {
  count: {
    label: "Count",
    color: "hsl(var(--primary))",
  },
}

export function EmotionBreakdownChart({ data }: EmotionBreakdownChartProps) {
  const emotionCounts = useMemo(() => {
    const counts: { [key: string]: number } = {}
    data.forEach(review => {
      const emotion = review.emotion.toLowerCase();
      counts[emotion] = (counts[emotion] || 0) + 1
    })
    return Object.entries(counts)
      .map(([emotion, count]) => ({ emotion, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10) // show top 10 emotions
  }, [data])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Emotion Breakdown</CardTitle>
        <CardDescription>Top emotions expressed in customer reviews.</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={emotionCounts}
              layout="vertical"
              margin={{ top: 0, right: 20, left: 20, bottom: 0 }}
            >
              <CartesianGrid horizontal={false} />
              <YAxis
                dataKey="emotion"
                type="category"
                tickLine={false}
                axisLine={false}
                tickMargin={10}
                width={80}
                className="capitalize"
              />
              <XAxis dataKey="count" type="number" hide />
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent indicator="dot" />}
              />
              <Bar dataKey="count" fill="var(--color-count)" radius={4} />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
