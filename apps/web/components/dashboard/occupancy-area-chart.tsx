'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

interface DataPoint {
  date: string
  occupied: number
  total: number
  pct: number
}

interface Props {
  data: DataPoint[]
}

function formatDay(dateStr: string) {
  return new Intl.DateTimeFormat('en-GH', { weekday: 'short', day: 'numeric' }).format(
    new Date(dateStr)
  )
}

export function OccupancyAreaChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={192}>
      <AreaChart data={data} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="occupancyGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(207 58% 28%)" stopOpacity={0.2} />
            <stop offset="95%" stopColor="hsl(207 58% 28%)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(60 5% 91%)" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={formatDay}
          tick={{ fontSize: 11, fill: 'hsl(35 3% 48%)' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          domain={[0, 100]}
          tickFormatter={(v) => `${v}%`}
          tick={{ fontSize: 11, fill: 'hsl(35 3% 48%)' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          formatter={(value: number) => [`${value}%`, 'Occupancy']}
          labelFormatter={formatDay}
          contentStyle={{
            background: 'hsl(0 0% 100%)',
            border: '1px solid hsl(60 5% 91%)',
            borderRadius: '8px',
            fontSize: '12px',
          }}
        />
        <Area
          type="monotone"
          dataKey="pct"
          stroke="hsl(207 58% 28%)"
          strokeWidth={2}
          fill="url(#occupancyGradient)"
          dot={false}
          activeDot={{ r: 4, fill: 'hsl(207 58% 28%)' }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
