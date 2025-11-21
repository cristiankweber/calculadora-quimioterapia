import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface DataPoint {
  label: string;
  value: number;
  color?: string;
}

interface BarChartProps {
  title: string;
  description?: string;
  data: DataPoint[];
  maxValue?: number;
}

export const BarChart = React.memo(({ title, description, data, maxValue }: BarChartProps) => {
  const max = maxValue || Math.max(...data.map(d => d.value), 1);
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {data.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhum dado disponível
            </p>
          ) : (
            data.map((item, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium truncate max-w-[200px]" title={item.label}>
                    {item.label}
                  </span>
                  <span className="text-muted-foreground ml-2">{item.value}</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${(item.value / max) * 100}%`,
                      backgroundColor: item.color || "hsl(var(--primary))",
                    }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
});

BarChart.displayName = "BarChart";
