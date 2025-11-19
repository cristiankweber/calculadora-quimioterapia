import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { Drug } from '@/types/calculator';

interface DrugsTableProps {
  drugs: Drug[];
}

export default function DrugsTable({ drugs }: DrugsTableProps) {
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Doses Calculadas</CardTitle>
        <CardDescription>
          Doses ajustadas por superfície corporal e fatores de correção
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
                      {drug.calculatedDose.toFixed(1)} mg
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
