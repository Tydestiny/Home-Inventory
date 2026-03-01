import React, { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Loader2 } from 'lucide-react';
import { formatCurrency, Currency, Language, formatDate } from '../i18n';

interface PriceTrendChartProps {
  itemId: string;
  currency: Currency;
  lang: Language;
}

export function PriceTrendChart({ itemId, currency, lang }: PriceTrendChartProps) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [avgPrice, setAvgPrice] = useState<number | null>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch(`/api/items/${itemId}/price-history`);
        if (res.ok) {
          const history = await res.json();
          const formatted = history.map((h: any) => ({
            date: formatDate(h.recorded_at, lang),
            price: h.price
          }));
          setData(formatted);
          
          if (history.length > 0) {
            const sum = history.reduce((acc: number, curr: any) => acc + curr.price, 0);
            setAvgPrice(sum / history.length);
          }
        }
      } catch (error) {
        console.error('Error fetching price history:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchHistory();
  }, [itemId, lang]);

  if (loading) {
    return (
      <div className="h-48 flex items-center justify-center text-zinc-400">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (data.length < 2) {
    return (
      <div className="h-48 flex items-center justify-center text-zinc-400 text-sm border border-dashed border-zinc-200 rounded-lg">
        {lang === 'zh' ? '数据不足，无法进行趋势分析' : 'Not enough data for trend analysis'}
      </div>
    );
  }

  const currentPrice = data[data.length - 1].price;
  const isLowerThanAvg = avgPrice && currentPrice < avgPrice;

  return (
    <div className="space-y-4">
      {isLowerThanAvg && (
        <div className="p-3 bg-emerald-50 text-emerald-700 rounded-lg text-sm font-medium border border-emerald-100">
          {lang === 'zh' ? '当前价格低于历史平均水平！是补货的好时机。' : 'Current price is lower than historical average! Good time to restock.'}
        </div>
      )}
      <div className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
            <XAxis 
              dataKey="date" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 10, fill: '#71717a' }} 
              dy={10}
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 10, fill: '#71717a' }}
              tickFormatter={(value) => formatCurrency(value, currency)}
            />
            <Tooltip 
              contentStyle={{ borderRadius: '8px', border: '1px solid #e4e4e7', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              formatter={(value: number) => [formatCurrency(value, currency), lang === 'zh' ? '价格' : 'Price']}
            />
            <Line 
              type="monotone" 
              dataKey="price" 
              stroke="#10b981" 
              strokeWidth={2} 
              dot={{ r: 3, fill: '#10b981', strokeWidth: 0 }} 
              activeDot={{ r: 5 }} 
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
