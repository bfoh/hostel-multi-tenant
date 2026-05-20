'use client'

import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts'

interface Point {
  label:     string
  revenue:   number  // pesewas
  expenses:  number  // pesewas
  netProfit: number  // pesewas
}

function fmtGhs(p: number) {
  return new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS', maximumFractionDigits: 0 }).format(p / 100)
}

function fmtAxisGhs(p: number) {
  if (Math.abs(p) >= 1_00_00_000) return `${(p / 1_00_00_000).toFixed(1)}M`
  if (Math.abs(p) >= 1_00_000)    return `${(p / 1_00_000).toFixed(0)}k`
  return String(p / 100)
}

export function TrendChart({ data }: { data: Point[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: 'currentColor' }}
            stroke="currentColor"
            strokeOpacity={0.3}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tickFormatter={fmtAxisGhs}
            tick={{ fontSize: 11, fill: 'currentColor' }}
            stroke="currentColor"
            strokeOpacity={0.3}
            tickLine={false}
            axisLine={false}
            width={56}
          />
          <Tooltip
            formatter={(value: number) => fmtGhs(value)}
            cursor={{ fill: 'rgba(125,125,125,0.06)' }}
            contentStyle={{
              borderRadius: 8,
              border: '1px solid rgba(125,125,125,0.25)',
              fontSize: 12,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
          <Bar  dataKey="revenue"   name="Revenue"   fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={28} />
          <Bar  dataKey="expenses"  name="Expenses"  fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={28} />
          <Line dataKey="netProfit" name="Net Profit" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
