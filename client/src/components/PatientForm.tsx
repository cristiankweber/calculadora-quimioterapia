import { memo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { PatientData } from '@/types/calculator';

interface PatientFormProps {
  data: PatientData;
  onChange: (data: PatientData) => void;
  validationErrors?: Set<keyof PatientData>;
}

function PatientForm({ data, onChange, validationErrors }: PatientFormProps) {
  const handleChange = (field: keyof PatientData, value: string | number) => {
    onChange({ ...data, [field]: value });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dados do Paciente</CardTitle>
        <CardDescription>
          Preencha as informações básicas e exames laboratoriais
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Identificação */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome ou Identificador</Label>
            <Input
              id="name"
              value={data.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="Nome do paciente"
            />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="age">Idade</Label>
              <Input
                id="age"
                type="number"
                value={data.age || ''}
                onChange={(e) => handleChange('age', parseInt(e.target.value) || 0)}
                placeholder="Anos"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sex">Sexo</Label>
              <Select value={data.sex} onValueChange={(v) => handleChange('sex', v as 'M' | 'F')}>
                <SelectTrigger id="sex">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="M">Masculino</SelectItem>
                  <SelectItem value="F">Feminino</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Antropometria */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="weight">Peso (kg)</Label>
            <Input
              id="weight"
              type="number"
              step="0.1"
              value={data.weight || ''}
              onChange={(e) => handleChange('weight', parseFloat(e.target.value) || 0)}
              placeholder="Ex: 70.5"
              className={validationErrors?.has('weight') ? 'border-destructive' : ''}
            />
            {validationErrors?.has('weight') && (
              <p className="text-xs text-destructive">Peso é obrigatório</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="height">Altura (cm)</Label>
            <Input
              id="height"
              type="number"
              step="0.1"
              value={data.height || ''}
              onChange={(e) => handleChange('height', parseFloat(e.target.value) || 0)}
              placeholder="Ex: 170"
              className={validationErrors?.has('height') ? 'border-destructive' : ''}
            />
            {validationErrors?.has('height') && (
              <p className="text-xs text-destructive">Altura é obrigatória</p>
            )}
          </div>
        </div>

        {/* Exames Laboratoriais */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="creatinine">Creatinina Sérica (mg/dL)</Label>
            <Input
              id="creatinine"
              type="number"
              step="0.01"
              value={data.creatinine || ''}
              onChange={(e) => handleChange('creatinine', parseFloat(e.target.value) || 0)}
              placeholder="Ex: 1.2"
              className={validationErrors?.has('creatinine') ? 'border-destructive' : ''}
            />
            {validationErrors?.has('creatinine') && (
              <p className="text-xs text-destructive">Creatinina é obrigatória</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="bilirubin">Bilirrubina Total (mg/dL)</Label>
            <Input
              id="bilirubin"
              type="number"
              step="0.01"
              value={data.bilirubin || ''}
              onChange={(e) => handleChange('bilirubin', parseFloat(e.target.value) || 0)}
              placeholder="Ex: 0.8"
            />
          </div>
        </div>

        {/* ECOG e Comorbidades */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="ecog">ECOG Performance Status</Label>
            <Select value={String(data.ecog)} onValueChange={(v) => handleChange('ecog', parseInt(v) as 0 | 1 | 2 | 3 | 4)}>
              <SelectTrigger id="ecog">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">0 - Assintomático</SelectItem>
                <SelectItem value="1">1 - Sintomático, mas deambula</SelectItem>
                <SelectItem value="2">2 - Em leito &lt;50% do tempo</SelectItem>
                <SelectItem value="3">3 - Em leito &gt;50% do tempo</SelectItem>
                <SelectItem value="4">4 - Acamado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="comorbidities">Comorbidades Relevantes</Label>
            <Input
              id="comorbidities"
              value={data.comorbidities}
              onChange={(e) => handleChange('comorbidities', e.target.value)}
              placeholder="Ex: HAS, DM, ICC"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default memo(PatientForm);
