import React from "react";
import { trpc } from "@/lib/trpc";
import { BarChart } from "@/components/BarChart";
import { PieChart } from "@/components/PieChart";
import { LineChart } from "@/components/LineChart";
import { StatCard } from "@/components/StatCard";
import DashboardSkeleton from "@/components/DashboardSkeleton";
import { Activity, FileText, Users, Pill } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  
  // Buscar dados de estatísticas
  const { data: overview, isLoading: overviewLoading } = trpc.stats.overview.useQuery();
  const { data: topProtocols, isLoading: topProtocolsLoading } = trpc.stats.topProtocols.useQuery({ limit: 10 });
  const { data: byIndication, isLoading: byIndicationLoading } = trpc.stats.protocolsByIndication.useQuery();
  const { data: trends, isLoading: trendsLoading } = trpc.stats.prescriptionTrends.useQuery({ days: 30 });

  // Cores para gráficos
  const colors = [
    "#3b82f6", // blue
    "#10b981", // green
    "#f59e0b", // amber
    "#ef4444", // red
    "#8b5cf6", // violet
    "#ec4899", // pink
    "#06b6d4", // cyan
    "#f97316", // orange
    "#14b8a6", // teal
    "#a855f7", // purple
  ];

  // Mostrar skeleton enquanto carrega
  const isLoading = overviewLoading || topProtocolsLoading || byIndicationLoading || trendsLoading;
  if (isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                Dashboard de Estatísticas
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                Análise de uso da calculadora de quimioterapia
              </p>
            </div>
            <Button onClick={() => setLocation("/")}>
              Voltar para Calculadora
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Cards de Resumo */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            title="Total de Prescrições"
            value={overviewLoading ? "..." : overview?.totalPrescriptions || 0}
            description="Prescrições geradas"
            icon={FileText}
          />
          <StatCard
            title="Pacientes Cadastrados"
            value={overviewLoading ? "..." : overview?.totalPatients || 0}
            description="Pacientes no sistema"
            icon={Users}
          />
          <StatCard
            title="Protocolos Utilizados"
            value={overviewLoading ? "..." : overview?.totalProtocols || 0}
            description="Protocolos diferentes"
            icon={Pill}
          />
          <StatCard
            title="Atividade Recente"
            value={overviewLoading ? "..." : overview?.recentActivity || 0}
            description="Últimos 7 dias"
            icon={Activity}
          />
        </div>

        {/* Gráficos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Top Protocolos */}
          <BarChart
            title="Protocolos Mais Prescritos"
            description="Top 10 protocolos mais utilizados"
            data={
              topProtocolsLoading || !topProtocols
                ? []
                : topProtocols.map((p, i) => ({
                    label: p.name,
                    value: p.count,
                    color: colors[i % colors.length],
                  }))
            }
          />

          {/* Distribuição por Indicação */}
          <PieChart
            title="Distribuição por Patologia"
            description="Protocolos agrupados por indicação clínica"
            data={
              byIndicationLoading || !byIndication
                ? []
                : byIndication.map((item, i) => ({
                    label: item.indication,
                    value: item.count,
                    color: colors[i % colors.length],
                  }))
            }
          />
        </div>

        {/* Tendências */}
        <div className="grid grid-cols-1 gap-6">
          <LineChart
            title="Tendência de Prescrições"
            description="Número de prescrições nos últimos 30 dias"
            data={
              trendsLoading || !trends
                ? []
                : trends.map(t => ({
                    date: new Date(t.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
                    value: t.count,
                  }))
            }
          />
        </div>

        {/* Mensagem se não houver dados */}
        {!overviewLoading && overview?.totalPrescriptions === 0 && (
          <div className="bg-white rounded-lg border border-slate-200 p-8 text-center mt-8">
            <FileText className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              Nenhuma prescrição registrada ainda
            </h3>
            <p className="text-slate-600 mb-4">
              Comece a usar a calculadora para gerar prescrições e visualizar estatísticas aqui.
            </p>
            <Button onClick={() => setLocation("/")}>
              Ir para Calculadora
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
