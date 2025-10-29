"use client"

import { Bar, BarChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer } from "recharts"
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

type DepartmentRatingChartProps = {
  data: {
    department: string
    averageRating: number
  }[]
}

const chartConfig = {
  averageRating: {
    label: "Average Rating",
    color: "hsl(var(--primary))",
  },
}

export function DepartmentRatingChart({ data }: DepartmentRatingChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Department Average Rating</CardTitle>
        <CardDescription>Comparing average product ratings across departments.</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data} margin={{ top: 20, right: 20, left: -10, bottom: 0 }}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="department"
                tickLine={false}
                tickMargin={10}
                axisLine={false}
              />
              <YAxis domain={[0, 5]} />
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent indicator="dot" />}
              />
              <Bar dataKey="averageRating" fill="var(--color-averageRating)" radius={4} />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
