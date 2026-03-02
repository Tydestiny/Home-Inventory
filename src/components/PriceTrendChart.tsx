import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Label
} from 'recharts';
import { format } from 'date-fns';

interface PricePoint {
  recorded_at: string;
  price: number;
  currency: string;
  source_platform: string;
}

interface PriceTrendChartProps {
  data: PricePoint[];
  currency?: string;
}

const PriceTrendChart: React.FC<PriceTrendChartProps> = ({ data, currency: selectedCurrency }) => {
  if (!data || data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center bg-zinc-50 rounded-xl border border-dashed border-zinc-200">
        <p className="text-zinc-400 text-sm">No price history available</p>
      </div>
    );
  }

  // Sort data by date
  const sortedData = [...data].sort((a, b) => 
    new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
  );

  const prices = sortedData.map(d => d.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const currency = selectedCurrency || data[0]?.currency || 'USD';

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={sortedData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
          <XAxis 
            dataKey="recorded_at" 
            tickFormatter={(str) => format(new Date(str), 'MMM d')}
            tick={{ fontSize: 10, fill: '#888' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis 
            tick={{ fontSize: 10, fill: '#888' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(val) => `${currency === 'CNY' ? '¥' : '$'}${val}`}
          />
          <Tooltip 
            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
            labelFormatter={(label) => format(new Date(label), 'PPP')}
            formatter={(value: number, name: string, props: any) => [
              `${currency === 'CNY' ? '¥' : '$'}${value} (${props.payload.source_platform})`,
              'Price'
            ]}
          />
          <ReferenceLine y={minPrice} stroke="#10b981" strokeDasharray="3 3">
            <Label value="Low" position="right" fill="#10b981" fontSize={10} />
          </ReferenceLine>
          <ReferenceLine y={maxPrice} stroke="#ef4444" strokeDasharray="3 3">
            <Label value="High" position="right" fill="#ef4444" fontSize={10} />
          </ReferenceLine>
          <Line 
            type="monotone" 
            dataKey="price" 
            stroke="#141414" 
            strokeWidth={2}
            dot={{ r: 4, fill: '#141414', strokeWidth: 2, stroke: '#fff' }}
            activeDot={{ r: 6, strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default PriceTrendChart;
