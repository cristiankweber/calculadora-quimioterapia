import { Skeleton } from "@/components/ui/skeleton";

export default function DrugsTableSkeleton() {
  return (
    <div className="space-y-4">
      {/* Cabeçalho da tabela */}
      <div className="grid grid-cols-7 gap-4 pb-2 border-b">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </div>
      
      {/* Linhas da tabela */}
      {Array.from({ length: 5 }).map((_, rowIndex) => (
        <div key={rowIndex} className="grid grid-cols-7 gap-4 py-3">
          {Array.from({ length: 7 }).map((_, colIndex) => (
            <Skeleton key={colIndex} className="h-6 w-full" />
          ))}
        </div>
      ))}
    </div>
  );
}
