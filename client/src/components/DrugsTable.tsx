import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import type { Drug } from '@/types/calculator';
import { useState } from 'react';

interface DrugsTableProps {
  drugs: Drug[];
  onDoseChange?: (index: number, newDose: number) => void;
}

export default function DrugsTable({ drugs, onDoseChange }: DrugsTableProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  const getEmetogenicBadge = (risk?: 'high' | 'moderate' | 'low' | 'minimal') => {
    if (!risk) return null;
    
    const colors = {
      high: 'bg-red-100 text-red-800 border-red-300',
      moderate: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      low: 'bg-blue-100 text-blue-800 border-blue-300',
      minimal: 'bg-green-100 text-green-800 border-green-300',
    };

    const labels = {
      high: 'Alto',
      moderate: 'Moderado',
      low: 'Baixo',
      minimal: 'Mínimo',
    };

    return (
      <Badge variant="outline" className={colors[risk]}>
        {labels[risk]}
      </Badge>
    );
  };

  const handleDoseClick = (index: number, currentDose: number) => {
    setEditingIndex(index);
    setEditValue(currentDose.toFixed(1));
  };

  const handleDoseBlur = (index: number) => {
    const newDose = parseFloat(editValue);
    if (!isNaN(newDose) && newDose > 0 && onDoseChange) {
      onDoseChange(index, newDose);
    }
    setEditingIndex(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'Enter') {
      handleDoseBlur(index);
    } else if (e.key === 'Escape') {
      setEditingIndex(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Doses Calculadas</CardTitle>
        <CardDescription>
          Doses ajustadas por superfície corporal e fatores de correção (clique na dose para ajustar manualmente)
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
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Selecione um protocolo para visualizar as drogas
                  </TableCell>
                </TableRow>
              ) : (
                drugs.map((drug, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-semibold">{drug.name}</TableCell>
                    <TableCell>
                      {drug.dose} {drug.doseUnit}
                    </TableCell>
                    <TableCell className="font-bold text-primary">
                      {editingIndex === index ? (
                        <Input
                          type="number"
                          step="0.1"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => handleDoseBlur(index)}
                          onKeyDown={(e) => handleKeyDown(e, index)}
                          className="w-24 h-8"
                          autoFocus
                        />
                      ) : (
                        <button
                          onClick={() => handleDoseClick(index, drug.calculatedDose || 0)}
                          className="hover:bg-muted px-2 py-1 rounded transition-colors cursor-pointer"
                          title="Clique para ajustar manualmente"
                        >
                          {(drug.calculatedDose || 0).toFixed(1)} mg
                        </button>
                      )}
                    </TableCell>
                    <TableCell>{drug.route}</TableCell>
                    <TableCell>{drug.days}</TableCell>
                    <TableCell>{getEmetogenicBadge(drug.emetogenicRisk)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-xs">
                      {drug.observations || '-'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
