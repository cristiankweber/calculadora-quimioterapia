import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { Upload, Save, ArrowLeft } from 'lucide-react';
import { useLocation } from 'wouter';

export default function Settings() {
  const [, setLocation] = useLocation();
  const [institutionName, setInstitutionName] = useState('');
  const [institutionLogo, setInstitutionLogo] = useState('');
  const [prescriberName, setPrescriberName] = useState('');
  const [prescriberCRM, setPrescriberCRM] = useState('');
  const [prescriberSpecialty, setPrescriberSpecialty] = useState('');
  const [headerTemplate, setHeaderTemplate] = useState('');
  const [footerTemplate, setFooterTemplate] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>('');

  // Carregar configurações existentes
  const { data: settings, refetch } = trpc.settings.get.useQuery();
  const updateSettings = trpc.settings.upsert.useMutation();

  useEffect(() => {
    if (settings) {
      setInstitutionName(settings.institutionName || '');
      setInstitutionLogo(settings.institutionLogo || '');
      setPrescriberName(settings.prescriberName || '');
      setPrescriberCRM(settings.prescriberCRM || '');
      setPrescriberSpecialty(settings.prescriberSpecialty || '');
      setHeaderTemplate(settings.headerTemplate || '');
      setFooterTemplate(settings.footerTemplate || '');
      if (settings.institutionLogo) {
        setLogoPreview(settings.institutionLogo);
      }
    }
  }, [settings]);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setLogoPreview(result);
        setInstitutionLogo(result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    try {
      await updateSettings.mutateAsync({
        institutionName,
        institutionLogo,
        prescriberName,
        prescriberCRM,
        prescriberSpecialty,
        headerTemplate,
        footerTemplate,
      });
      
      await refetch();
      toast.success('Configurações salvas com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      toast.error('Erro ao salvar configurações');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-gray-900">Configurações Institucionais</h1>
              <p className="text-sm text-gray-600">Personalize os dados da instituição e prescritor</p>
            </div>
            <Button variant="outline" className="self-start sm:self-auto" onClick={() => setLocation('/')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Dados Institucionais */}
          <Card>
            <CardHeader>
              <CardTitle>Dados Institucionais</CardTitle>
              <CardDescription>
                Informações da instituição que aparecerão nas prescrições
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="institutionName">Nome da Instituição</Label>
                <Input
                  id="institutionName"
                  value={institutionName}
                  onChange={(e) => setInstitutionName(e.target.value)}
                  placeholder="Ex: Hospital Universitário"
                />
              </div>

              <div>
                <Label htmlFor="logo">Logo da Instituição</Label>
                <div className="flex flex-col items-start gap-4 sm:flex-row">
                  <div className="w-full min-w-0 sm:flex-1">
                    <Input
                      id="logo"
                      type="file"
                      accept="image/*"
                      onChange={handleLogoChange}
                      className="cursor-pointer"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Formatos aceitos: PNG, JPG, SVG. Tamanho recomendado: 200x80px
                    </p>
                  </div>
                  {logoPreview && (
                    <div className="max-w-full shrink-0 border rounded-lg p-2 bg-white">
                      <img
                        src={logoPreview}
                        alt="Prévia do logo da instituição"
                        className="h-16 max-w-full object-contain"
                      />
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Dados do Prescritor */}
          <Card>
            <CardHeader>
              <CardTitle>Dados do Prescritor</CardTitle>
              <CardDescription>
                Informações do médico responsável pelas prescrições
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="prescriberName">Nome Completo</Label>
                <Input
                  id="prescriberName"
                  value={prescriberName}
                  onChange={(e) => setPrescriberName(e.target.value)}
                  placeholder="Ex: Dr. João Silva"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="prescriberCRM">CRM</Label>
                  <Input
                    id="prescriberCRM"
                    value={prescriberCRM}
                    onChange={(e) => setPrescriberCRM(e.target.value)}
                    placeholder="Ex: CRM/SP 123456"
                  />
                </div>
                <div>
                  <Label htmlFor="prescriberSpecialty">Especialidade</Label>
                  <Input
                    id="prescriberSpecialty"
                    value={prescriberSpecialty}
                    onChange={(e) => setPrescriberSpecialty(e.target.value)}
                    placeholder="Ex: Oncologia Clínica"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Templates de Impressão */}
          <Card>
            <CardHeader>
              <CardTitle>Templates de Impressão</CardTitle>
              <CardDescription>
                Personalize o cabeçalho e rodapé das prescrições impressas
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="headerTemplate">Cabeçalho Adicional (opcional)</Label>
                <Textarea
                  id="headerTemplate"
                  value={headerTemplate}
                  onChange={(e) => setHeaderTemplate(e.target.value)}
                  placeholder="Ex: Serviço de Oncologia e Hematologia&#10;Telefone: (11) 1234-5678"
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="footerTemplate">Rodapé Adicional (opcional)</Label>
                <Textarea
                  id="footerTemplate"
                  value={footerTemplate}
                  onChange={(e) => setFooterTemplate(e.target.value)}
                  placeholder="Ex: Prescrição válida por 30 dias&#10;Em caso de dúvidas, contatar o prescritor"
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Botão Salvar */}
          <div className="flex justify-end">
            <Button onClick={handleSave} size="lg" disabled={updateSettings.isPending}>
              <Save className="w-4 h-4 mr-2" />
              {updateSettings.isPending ? 'Salvando...' : 'Salvar Configurações'}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
