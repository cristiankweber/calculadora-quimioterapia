import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface DataPoint {
  label: string;
  value: number;
  color: string;
}

interface PieChartProps {
  title: string;
  description?: string;
  data: DataPoint[];
}

export const PieChart = React.memo(({ title, description, data }: PieChartProps) => {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  
  // Calcular ângulos para cada segmento
  let currentAngle = 0;
  const segments = data.map(item => {
    const percentage = (item.value / total) * 100;
    const angle = (item.value / total) * 360;
    const segment = {
      ...item,
      percentage,
      startAngle: currentAngle,
      endAngle: currentAngle + angle,
    };
    currentAngle += angle;
    return segment;
  });

  // Criar path SVG para cada segmento
  const createArc = (startAngle: number, endAngle: number) => {
    const start = polarToCartesian(50, 50, 45, endAngle);
    const end = polarToCartesian(50, 50, 45, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
    
    return [
      "M", 50, 50,
      "L", start.x, start.y,
      "A", 45, 45, 0, largeArcFlag, 0, end.x, end.y,
      "Z"
    ].join(" ");
  };

  const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
    const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
    return {
      x: centerX + radius * Math.cos(angleInRadians),
      y: centerY + radius * Math.sin(angleInRadians),
    };
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhum dado disponível
          </p>
        ) : (
          <div className="flex flex-col items-center gap-6">
            <svg viewBox="0 0 100 100" className="w-48 h-48">
              {segments.map((segment, index) => (
                <g key={index}>
                  <title>{`${segment.label}: ${segment.value} (${segment.percentage.toFixed(1)}%)`}</title>
                  <path
                    d={createArc(segment.startAngle, segment.endAngle)}
                    fill={segment.color}
                    className="transition-opacity hover:opacity-80 cursor-pointer"
                  />
                </g>
              ))}
            </svg>
            <div className="grid grid-cols-1 gap-2 w-full">
              {segments.map((segment, index) => (
                <div key={index} className="flex items-center gap-2 text-sm">
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: segment.color }}
                  />
                  <span className="truncate flex-1" title={segment.label}>
                    {segment.label}
                  </span>
                  <span className="text-muted-foreground">
                    {segment.value} ({segment.percentage.toFixed(1)}%)
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
});

PieChart.displayName = "PieChart";
