import { Skeleton } from "@/components/ui/skeleton";

export default function PatientHistorySkeleton() {
  return (
    <div className="space-y-4">
      {/* Barra de busca */}
      <Skeleton className="h-10 w-full" />

      {/* Lista de pacientes */}
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-64" />
            </div>
            <Skeleton className="h-9 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}
