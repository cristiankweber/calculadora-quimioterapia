import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import type { PatientData } from '@/types/calculator';
import { trpc } from '@/lib/trpc';

interface PatientHistoryDBProps {
  onLoadPatient: (patient: PatientData, prescriptionData?: any) => void;
}

export default function PatientHistoryDB({ onLoadPatient }: PatientHistoryDBProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Buscar pacientes do banco de dados
  const { data: patients = [], refetch } = trpc.patients.list.useQuery(undefined, {
    enabled: open, // Só busca quando o dialog está aberto
  });

  const deleteMutation = trpc.patients.delete.useMutation({
    onSuccess: () => {
      toast.success('Paciente removido do histórico');
      refetch();
    },
    onError: (error) => {
      toast.error(`Erro ao remover paciente: ${error.message}`);
    },
  });

  const filteredPatients = patients.filter((p) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const utils = trpc.useUtils();

  const handleLoadPatient = async (patient: any) => {
    // Valores do banco já são decimais (DECIMAL no schema)
    const patientData: PatientData = {
      name: patient.name,
      age: patient.age,
      sex: patient.sex,
      weight: patient.weight,
      height: patient.height,
      creatinine: Number(patient.creatinine), // Converter string para number
      bilirubin: Number(patient.bilirubin),
      ecog: patient.ecog,
      comorbidities: patient.comorbidities || '',
    };

    // Tentar buscar última prescrição
    try {
      const prescriptions = await utils.prescriptions.getByPatient.fetch({ patientId: patient.id });
      const lastPrescription = prescriptions && prescriptions.length > 0 ? prescriptions[0] : null;
      
      onLoadPatient(patientData, lastPrescription?.prescriptionData);
      
      if (lastPrescription) {
        toast.success(`Paciente ${patient.name} carregado com última prescrição (${lastPrescription.protocolName})`);
      } else {
        toast.success(`Paciente ${patient.name} carregado (sem prescrições anteriores)`);
      }
    } catch (error) {
      // Se falhar ao buscar prescrição, carregar apenas dados do paciente
      onLoadPatient(patientData);
      toast.success(`Paciente ${patient.name} carregado`);
    }
    
    setOpen(false);
  };

  const handleDeletePatient = (id: number, name: string) => {
    if (confirm(`Deseja realmente remover ${name} do histórico?`)) {
      deleteMutation.mutate({ id });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4 mr-2"
          >
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
          Histórico de Pacientes
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Histórico de Pacientes</DialogTitle>
          <DialogDescription>
            Selecione um paciente para carregar seus dados ou remova registros antigos
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="search">Buscar Paciente</Label>
            <Input
              id="search"
              placeholder="Digite o nome do paciente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {filteredPatients.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm
                ? 'Nenhum paciente encontrado com esse nome'
                : 'Nenhum paciente salvo no histórico'}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredPatients.map((patient) => (
                <div
                  key={patient.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="font-medium">{patient.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {patient.age} anos • {patient.sex === 'M' ? 'Masculino' : 'Feminino'} •{' '}
                      {patient.weight}kg • {patient.height}cm
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Última atualização: {new Date(patient.updatedAt).toLocaleDateString('pt-BR')}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleLoadPatient(patient)}
                    >
                      Carregar
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDeletePatient(patient.id, patient.name)}
                    >
                      Remover
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
