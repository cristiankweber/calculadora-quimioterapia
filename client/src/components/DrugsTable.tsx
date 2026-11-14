import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { Drug } from "@/types/calculator";
import { useState, memo, useCallback, useMemo } from "react";
import { getDoseResultUnit } from "@shared/clinicalDoseEngine";

// ── Constantes estáticas (fora do componente para evitar recriação) ──────

const EMETOGENIC_COLORS: Record<string, string> = {
  high: "bg-red-100 text-red-800 border-red-300",
  moderate: "bg-yellow-100 text-yellow-800 border-yellow-300",
  low: "bg-blue-100 text-blue-800 border-blue-300",
  minimal: "bg-green-100 text-green-800 border-green-300",
};

const EMETOGENIC_LABELS: Record<string, string> = {
  high: "Alto",
  moderate: "Moderado",
  low: "Baixo",
  minimal: "Mínimo",
};

// ── Componente de Linha Memoizado ────────────────────────────────────────

interface DrugRowProps {
  drug: Drug;
  index: number;
  isEditing: boolean;
  editValue: string;
  onDoseClick: (index: number, currentDose: number) => void;
  onEditChange: (value: string) => void;
  onEditBlur: (index: number) => void;
  onKeyDown: (e: React.KeyboardEvent, index: number) => void;
}

const DrugRow = memo(function DrugRow({
  drug,
  index,
  isEditing,
  editValue,
  onDoseClick,
  onEditChange,
  onEditBlur,
  onKeyDown,
}: DrugRowProps) {
  return (
    <TableRow>
      <TableCell className="font-semibold">{drug.name}</TableCell>
      <TableCell>
        {drug.dose} {drug.doseUnit}
        {drug.doseUnit === "AUC" && (
          <Badge
            variant="outline"
            className="ml-2 text-xs bg-blue-50 text-blue-700 border-blue-300"
          >
            Calvert
          </Badge>
        )}
        {drug.doseUnit === "cGy" && (
          <Badge
            variant="outline"
            className="ml-2 text-xs bg-purple-50 text-purple-700 border-purple-300"
          >
            Procedimento
          </Badge>
        )}
      </TableCell>
      <TableCell className="font-bold text-primary">
        {isEditing ? (
          <Input
            type="number"
            step="0.1"
            value={editValue}
            onChange={e => onEditChange(e.target.value)}
            onBlur={() => onEditBlur(index)}
            onKeyDown={e => onKeyDown(e, index)}
            className="w-24 h-8"
            autoFocus
          />
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={() => onDoseClick(index, drug.calculatedDose || 0)}
              className="hover:bg-muted px-2 py-1 rounded transition-colors cursor-pointer"
              title="Clique para ajustar manualmente"
            >
              {(drug.calculatedDose || 0).toFixed(1)}{" "}
              {drug.resultUnit ?? getDoseResultUnit(drug.doseUnit)}
            </button>
            {drug.maxDose &&
              drug.calculatedDose &&
              drug.calculatedDose >= drug.maxDose && (
                <Badge
                  variant="outline"
                  className="text-xs bg-yellow-50 text-yellow-700 border-yellow-300"
                >
                  Máx
                </Badge>
              )}
          </div>
        )}
      </TableCell>
      <TableCell>{drug.route}</TableCell>
      <TableCell>{drug.days}</TableCell>
      <TableCell>
        {drug.emetogenicRisk && (
          <Badge
            variant="outline"
            className={EMETOGENIC_COLORS[drug.emetogenicRisk]}
          >
            {EMETOGENIC_LABELS[drug.emetogenicRisk]}
          </Badge>
        )}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground max-w-xs">
        {drug.observations || "-"}
      </TableCell>
    </TableRow>
  );
});

// ── Componente Principal ─────────────────────────────────────────────────

interface DrugsTableProps {
  drugs: Drug[];
  onDoseChange?: (index: number, newDose: number) => void;
}

function DrugsTable({ drugs, onDoseChange }: DrugsTableProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState<string>("");

  const handleDoseClick = useCallback((index: number, currentDose: number) => {
    setEditingIndex(index);
    setEditValue(currentDose.toFixed(1));
  }, []);

  const handleDoseBlur = useCallback(
    (index: number) => {
      const newDose = parseFloat(editValue);
      if (!isNaN(newDose) && newDose > 0 && onDoseChange) {
        onDoseChange(index, newDose);
      }
      setEditingIndex(null);
    },
    [editValue, onDoseChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, index: number) => {
      if (e.key === "Enter") {
        handleDoseBlur(index);
      } else if (e.key === "Escape") {
        setEditingIndex(null);
      }
    },
    [handleDoseBlur]
  );

  const handleEditChange = useCallback((value: string) => {
    setEditValue(value);
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Doses Calculadas</CardTitle>
        <CardDescription>
          Doses ajustadas por superfície corporal e fatores de correção (clique
          na dose para ajustar manualmente)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Droga</TableHead>
                <TableHead>Dose Base</TableHead>
                <TableHead>Dose Calculada</TableHead>
                <TableHead>Via</TableHead>
                <TableHead>Dias</TableHead>
                <TableHead>Risco Emético</TableHead>
                <TableHead>Observações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {drugs.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center text-muted-foreground py-8"
                  >
                    Selecione um protocolo para visualizar as drogas
                  </TableCell>
                </TableRow>
              ) : (
                drugs.map((drug, index) => (
                  <DrugRow
                    key={`${drug.name}-${index}`}
                    drug={drug}
                    index={index}
                    isEditing={editingIndex === index}
                    editValue={editValue}
                    onDoseClick={handleDoseClick}
                    onEditChange={handleEditChange}
                    onEditBlur={handleDoseBlur}
                    onKeyDown={handleKeyDown}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

export default memo(DrugsTable);
