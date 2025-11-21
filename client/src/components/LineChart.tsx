import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface DataPoint {
  date: string;
  value: number;
}

interface LineChartProps {
  title: string;
  description?: string;
  data: DataPoint[];
}

export const LineChart = React.memo(({ title, description, data }: LineChartProps) => {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhum dado disponível
          </p>
        </CardContent>
      </Card>
    );
  }

  const maxValue = Math.max(...data.map(d => d.value), 1);
  const minValue = Math.min(...data.map(d => d.value), 0);
  const range = maxValue - minValue || 1;

  // Dimensões do gráfico
  const width = 100;
  const height = 60;
  const padding = 5;

  // Calcular pontos do gráfico
  const points = data.map((point, index) => {
    const x = padding + (index / (data.length - 1 || 1)) * (width - 2 * padding);
    const y = height - padding - ((point.value - minValue) / range) * (height - 2 * padding);
    return { x, y, ...point };
  });

  // Criar path SVG
  const pathData = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');

  // Criar área preenchida
  const areaData = [
    pathData,
    `L ${points[points.length - 1]?.x || 0} ${height - padding}`,
    `L ${points[0]?.x || 0} ${height - padding}`,
    'Z'
  ].join(' ');

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-32">
            {/* Área preenchida */}
            <path
              d={areaData}
              fill="hsl(var(--primary))"
              opacity="0.1"
            />
            {/* Linha */}
            <path
              d={pathData}
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth="0.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Pontos */}
            {points.map((point, index) => (
              <g key={index}>
                <title>{`${point.date}: ${point.value}`}</title>
                <circle
                  cx={point.x}
                  cy={point.y}
                  r="1"
                  fill="hsl(var(--primary))"
                  className="cursor-pointer hover:r-1.5 transition-all"
                />
              </g>
            ))}
          </svg>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{data[0]?.date || ''}</span>
            <span>{data[data.length - 1]?.date || ''}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

LineChart.displayName = "LineChart";
