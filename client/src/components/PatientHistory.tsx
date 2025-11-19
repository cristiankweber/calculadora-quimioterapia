import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  getPatientHistoryByName,
  calculateCumulativeDoses,
  checkCardiotoxicityRisk,
  deleteHistoryEntry,
  type PatientHistoryEntry,
} from '@/lib/patientHistory';
import type { PatientData } from '@/types/calculator';
import { History, Search, Trash2, AlertTriangle, Heart } from 'lucide-react';
import { toast } from 'sonner';

interface PatientHistoryProps {
  onLoadPatient?: (patient: PatientData) => void;
}

export default function PatientHistory({ onLoadPatient }: PatientHistoryProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<string | null>(null);
  const [historyEntries, setHistoryEntries] = useState<PatientHistoryEntry[]>([]);

  const handleSearch = () => {
    if (!searchTerm.trim()) {
      toast.error('Digite um nome para buscar');
      return;
    }
    
    const results = getPatientHistoryByName(searchTerm);
    setHistoryEntries(results);
    
    if (results.length === 0) {
      toast.info('Nenhum histórico encontrado para este paciente');
    } else {
      setSelectedPatient(searchTerm);
      toast.success(`${results.length} registro(s) encontrado(s)`);
    }
  };

  const handleLoadPatient = (entry: PatientHistoryEntry) => {
    if (onLoadPatient) {
      onLoadPatient(entry.patient);
      toast.success('Dados do paciente carregados com sucesso!');
    }
  };

  const handleDeleteEntry = (id: string) => {
    deleteHistoryEntry(id);
    setHistoryEntries(prev => prev.filter(e => e.id !== id));
    toast.success('Registro excluído do histórico');
  };

  const cumulativeDoses = selectedPatient ? calculateCumulativeDoses(selectedPatient) : [];
  const cardiotoxicityRisks = selectedPatient ? checkCardiotoxicityRisk(selectedPatient) : [];

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">
          <History className="h-4 w-4 mr-2" />
          Histórico de Pacientes
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Histórico de Pacientes</DialogTitle>
          <DialogDescription>
            Busque e visualize prescrições anteriores e doses cumulativas
          </DialogDescription>
        </DialogHeader>

        {/* Busca */}
        <div className="flex gap-2">
          <Input
            placeholder="Digite o nome do paciente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <Button onClick={handleSearch}>
            <Search className="h-4 w-4 mr-2" />
            Buscar
          </Button>
        </div>

        {/* Alertas de Cardiotoxicidade */}
        {cardiotoxicityRisks.length > 0 && (
          <Card className="border-orange-200 bg-orange-50">
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Heart className="h-5 w-5 text-orange-600" />
                <CardTitle className="text-orange-900">Monitoramento de Cardiotoxicidade</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {cardiotoxicityRisks.map((risk, index) => (
                <Alert
                  key={index}
                  variant={risk.risk === 'danger' ? 'destructive' : 'default'}
                  className={risk.risk === 'warning' ? 'border-yellow-500 bg-yellow-50' : ''}
                >
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>{risk.drug}:</strong> {risk.totalDose.toFixed(0)} mg / {risk.limit} mg ({risk.percentage.toFixed(1)}%)
                    {risk.risk === 'danger' && ' - LIMITE EXCEDIDO'}
                    {risk.risk === 'warning' && ' - PRÓXIMO DO LIMITE'}
                  </AlertDescription>
                </Alert>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Doses Cumulativas */}
        {cumulativeDoses.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Doses Cumulativas</CardTitle>
              <CardDescription>
                Total acumulado de cada droga para {selectedPatient}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {cumulativeDoses.map((dose, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                    <span className="font-semibold">{dose.drugName}</span>
                    <Badge variant="outline">
                      {dose.totalDose.toFixed(1)} mg ({dose.entries.length} dose{dose.entries.length > 1 ? 's' : ''})
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Lista de Prescrições */}
        {historyEntries.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Prescrições Anteriores</CardTitle>
              <CardDescription>
                {historyEntries.length} registro(s) encontrado(s)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {historyEntries.map((entry) => (
                <div key={entry.id} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{entry.protocol} - Ciclo {entry.cycle}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(entry.timestamp).toLocaleString('pt-BR')}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleLoadPatient(entry)}
                      >
                        Carregar
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeleteEntry(entry.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="text-sm">
                    <p><strong>Idade:</strong> {entry.patient.age} anos | <strong>ECOG:</strong> {entry.patient.ecog}</p>
                    <p><strong>Drogas:</strong> {entry.drugs.map(d => d.name).join(', ')}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {historyEntries.length === 0 && selectedPatient && (
          <div className="text-center py-8 text-muted-foreground">
            <History className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Nenhum histórico encontrado para este paciente</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
