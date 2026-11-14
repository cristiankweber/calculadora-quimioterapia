import React, { useState, useCallback, useMemo, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { isEnrichedClinicalDocument } from "@shared/clinicalProtocols/library";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  X,
  ChevronDown,
  ChevronUp,
  Pill,
  AlertTriangle,
  Shield,
  Stethoscope,
  Beaker,
  RotateCcw,
  Copy,
  Save,
  Loader2,
  Download,
  Upload,
  Database,
  FileJson,
  CheckSquare,
  Square,
} from "lucide-react";

// ─── Tipos ─────────────────────────────────────────────────────────────────

type DoseUnit = "mg/m²" | "mg/kg" | "mg" | "AUC" | "mcg/kg" | "cGy";
type EmetogenicRisk = "high" | "moderate" | "low" | "minimal";

interface DrugForm {
  name: string;
  dose: number;
  doseUnit: DoseUnit;
  maxDose?: number;
  route: string;
  days: string;
  observations?: string;
  emetogenicRisk?: EmetogenicRisk;
  renalAdjustment?: string;
  hepaticAdjustment?: string;
}

interface DilutionInfoForm {
  drugName: string;
  diluent: string;
  volume: string;
  infusionTime: string;
  stability: string;
  specialInstructions: string;
}

interface ProtocolFormData {
  name: string;
  indication: string;
  cycles: number;
  cycleLength: number;
  emetogenicRisk: EmetogenicRisk;
  drugs: DrugForm[];
  specialAlerts: string[];
  prophylaxis: string[];
  nursingCare: string[];
  renalAdjustments: string[];
  hepaticAdjustments: string[];
  hematologicAdjustments: string[];
  dilutionInfo: DilutionInfoForm[];
}

const emptyDrug: DrugForm = {
  name: "",
  dose: 0,
  doseUnit: "mg/m²",
  route: "IV",
  days: "1",
};

const emptyDilution: DilutionInfoForm = {
  drugName: "",
  diluent: "",
  volume: "",
  infusionTime: "",
  stability: "",
  specialInstructions: "",
};

const emptyForm: ProtocolFormData = {
  name: "",
  indication: "",
  cycles: 1,
  cycleLength: 21,
  emetogenicRisk: "moderate",
  drugs: [{ ...emptyDrug }],
  specialAlerts: [],
  prophylaxis: [],
  nursingCare: [],
  renalAdjustments: [],
  hepaticAdjustments: [],
  hematologicAdjustments: [],
  dilutionInfo: [],
};

const emetogenicLabels: Record<EmetogenicRisk, string> = {
  high: "Alto",
  moderate: "Moderado",
  low: "Baixo",
  minimal: "Mínimo",
};

const doseUnitOptions: DoseUnit[] = [
  "mg/m²",
  "mg/kg",
  "mg",
  "AUC",
  "mcg/kg",
  "cGy",
];

const routeOptions = [
  "IV",
  "IV contínuo",
  "IV bolus",
  "SC",
  "VO",
  "IM",
  "IT",
  "Tópico",
];

// ─── Componente de Lista de Strings ────────────────────────────────────────

function StringListEditor({
  label,
  icon: Icon,
  items,
  onChange,
  placeholder,
}: {
  label: string;
  icon: React.ElementType;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
}) {
  const [newItem, setNewItem] = useState("");

  const addItem = () => {
    const trimmed = newItem.trim();
    if (trimmed && !items.includes(trimmed)) {
      onChange([...items, trimmed]);
      setNewItem("");
    }
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <Label className="flex items-center gap-2 text-sm font-semibold">
        <Icon className="h-4 w-4" />
        {label}
      </Label>
      <div className="flex gap-2">
        <Input
          value={newItem}
          onChange={e => setNewItem(e.target.value)}
          placeholder={placeholder}
          onKeyDown={e => {
            if (e.key === "Enter") {
              e.preventDefault();
              addItem();
            }
          }}
          className="flex-1"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addItem}
          disabled={!newItem.trim()}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {items.length > 0 && (
        <div className="space-y-1">
          {items.map((item, index) => (
            <div
              key={index}
              className="flex items-center gap-2 bg-muted/50 rounded-md px-3 py-2 text-sm"
            >
              <span className="flex-1">{item}</span>
              <button
                type="button"
                onClick={() => removeItem(index)}
                className="text-muted-foreground hover:text-destructive transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Componente Principal ──────────────────────────────────────────────────

export default function ProtocolManager() {
  const utils = trpc.useUtils();

  // Queries
  const { data: customProtocols, isLoading } =
    trpc.customProtocols.list.useQuery();

  // Mutations
  const createMutation = trpc.customProtocols.create.useMutation({
    onSuccess: () => {
      utils.customProtocols.list.invalidate();
      utils.customProtocols.listActive.invalidate();
      toast.success("Protocolo criado com sucesso!");
      setDialogOpen(false);
      resetForm();
    },
    onError: err => {
      toast.error(`Erro ao criar protocolo: ${err.message}`);
    },
  });

  const updateMutation = trpc.customProtocols.update.useMutation({
    onSuccess: () => {
      utils.customProtocols.list.invalidate();
      utils.customProtocols.listActive.invalidate();
      toast.success("Protocolo atualizado com sucesso!");
      setDialogOpen(false);
      resetForm();
    },
    onError: err => {
      toast.error(`Erro ao atualizar protocolo: ${err.message}`);
    },
  });

  const deleteMutation = trpc.customProtocols.delete.useMutation({
    onSuccess: () => {
      utils.customProtocols.list.invalidate();
      utils.customProtocols.listActive.invalidate();
      toast.success("Protocolo excluído com sucesso!");
    },
    onError: err => {
      toast.error(`Erro ao excluir protocolo: ${err.message}`);
    },
  });

  const restoreMutation = trpc.customProtocols.restore.useMutation({
    onSuccess: () => {
      utils.customProtocols.list.invalidate();
      utils.customProtocols.listActive.invalidate();
      toast.success("Protocolo restaurado com sucesso!");
    },
    onError: err => {
      toast.error(`Erro ao restaurar protocolo: ${err.message}`);
    },
  });

  const exportMutation = trpc.customProtocols.export.useMutation({
    onSuccess: data => {
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `protocolos-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(
        "JSON exportado com documentos, calendários e fontes preservados."
      );
      setSelectedIds(new Set());
    },
    onError: err => {
      toast.error(`Erro ao exportar: ${err.message}`);
    },
  });

  const exportAllMutation = trpc.customProtocols.exportAll.useMutation({
    onSuccess: data => {
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `protocolos-todos-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(
        "JSON exportado com documentos, calendários e fontes preservados."
      );
    },
    onError: err => {
      toast.error(`Erro ao exportar: ${err.message}`);
    },
  });

  const importMutation = trpc.customProtocols.import.useMutation({
    onSuccess: data => {
      utils.customProtocols.list.invalidate();
      utils.customProtocols.listActive.invalidate();
      toast.success(`${data.imported} protocolo(s) importado(s) com sucesso!`);
      setImportDialogOpen(false);
    },
    onError: err => {
      toast.error(`Erro na importação: ${err.message}`);
    },
  });

  const seedMutation = trpc.customProtocols.seedSystem.useMutation({
    onSuccess: data => {
      utils.customProtocols.list.invalidate();
      utils.customProtocols.listActive.invalidate();
      toast.success(data.message);
      setSeedDialogOpen(false);
    },
    onError: err => {
      toast.error(`Erro ao importar protocolos do sistema: ${err.message}`);
    },
  });

  // State
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["drugs"])
  );
  const [formData, setFormData] = useState<ProtocolFormData>({
    ...emptyForm,
  });
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [seedDialogOpen, setSeedDialogOpen] = useState(false);
  const [importJsonText, setImportJsonText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Helpers ────────────────────────────────────────────────────────────

  const resetForm = useCallback(() => {
    setFormData({ ...emptyForm, drugs: [{ ...emptyDrug }] });
    setEditingId(null);
  }, []);

  const toggleSection = useCallback((section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  }, []);

  const filteredProtocols = useMemo(() => {
    if (!customProtocols) return [];
    if (!searchTerm.trim()) return customProtocols;
    const term = searchTerm.toLowerCase();
    return customProtocols.filter(
      p =>
        p.name.toLowerCase().includes(term) ||
        p.indication.toLowerCase().includes(term)
    );
  }, [customProtocols, searchTerm]);

  // ── Drug Management ────────────────────────────────────────────────────

  const addDrug = useCallback(() => {
    setFormData(prev => ({
      ...prev,
      drugs: [...prev.drugs, { ...emptyDrug }],
    }));
  }, []);

  const removeDrug = useCallback((index: number) => {
    setFormData(prev => ({
      ...prev,
      drugs: prev.drugs.filter((_, i) => i !== index),
    }));
  }, []);

  const updateDrug = useCallback(
    (index: number, field: keyof DrugForm, value: any) => {
      setFormData(prev => ({
        ...prev,
        drugs: prev.drugs.map((d, i) =>
          i === index ? { ...d, [field]: value } : d
        ),
      }));
    },
    []
  );

  // ── Dilution Management ────────────────────────────────────────────────

  const addDilution = useCallback(() => {
    setFormData(prev => ({
      ...prev,
      dilutionInfo: [...prev.dilutionInfo, { ...emptyDilution }],
    }));
  }, []);

  const removeDilution = useCallback((index: number) => {
    setFormData(prev => ({
      ...prev,
      dilutionInfo: prev.dilutionInfo.filter((_, i) => i !== index),
    }));
  }, []);

  const updateDilution = useCallback(
    (index: number, field: keyof DilutionInfoForm, value: string) => {
      setFormData(prev => ({
        ...prev,
        dilutionInfo: prev.dilutionInfo.map((d, i) =>
          i === index ? { ...d, [field]: value } : d
        ),
      }));
    },
    []
  );

  // ── Form Actions ───────────────────────────────────────────────────────

  const openCreateDialog = useCallback(() => {
    resetForm();
    setExpandedSections(new Set(["drugs"]));
    setDialogOpen(true);
  }, [resetForm]);

  const openEditDialog = useCallback((protocol: any) => {
    const drugs: DrugForm[] = (protocol.drugs as any[]).map((d: any) => ({
      name: d.name || "",
      dose: d.dose || 0,
      doseUnit: d.doseUnit || "mg/m²",
      maxDose: d.maxDose,
      route: d.route || "IV",
      days: d.days || "1",
      observations: d.observations,
      emetogenicRisk: d.emetogenicRisk,
      renalAdjustment: d.renalAdjustment,
      hepaticAdjustment: d.hepaticAdjustment,
    }));

    const dilutionInfo: DilutionInfoForm[] = (
      (protocol.dilutionInfo as any[]) || []
    ).map((d: any) => ({
      drugName: d.drugName || "",
      diluent: d.diluent || "",
      volume: d.volume || "",
      infusionTime: d.infusionTime || "",
      stability: d.stability || "",
      specialInstructions: d.specialInstructions || "",
    }));

    setFormData({
      name: protocol.name,
      indication: protocol.indication,
      cycles: protocol.cycles,
      cycleLength: protocol.cycleLength,
      emetogenicRisk: protocol.emetogenicRisk,
      drugs,
      specialAlerts: (protocol.specialAlerts as string[]) || [],
      prophylaxis: (protocol.prophylaxis as string[]) || [],
      nursingCare: (protocol.nursingCare as string[]) || [],
      renalAdjustments: (protocol.renalAdjustments as string[]) || [],
      hepaticAdjustments: (protocol.hepaticAdjustments as string[]) || [],
      hematologicAdjustments:
        (protocol.hematologicAdjustments as string[]) || [],
      dilutionInfo,
    });
    setEditingId(protocol.id);
    setExpandedSections(new Set(["drugs"]));
    setDialogOpen(true);
  }, []);

  const handleSubmit = useCallback(() => {
    // Validação básica
    if (!formData.name.trim()) {
      toast.error("Nome do protocolo é obrigatório.");
      return;
    }
    if (!formData.indication.trim()) {
      toast.error("Indicação é obrigatória.");
      return;
    }
    if (formData.drugs.length === 0) {
      toast.error("Pelo menos uma droga é obrigatória.");
      return;
    }
    for (const drug of formData.drugs) {
      if (!drug.name.trim()) {
        toast.error("Todas as drogas devem ter nome.");
        return;
      }
      if (drug.dose <= 0) {
        toast.error(`Dose de ${drug.name || "droga"} deve ser maior que 0.`);
        return;
      }
    }

    const payload = {
      ...formData,
      drugs: formData.drugs.map(d => ({
        ...d,
        observations: d.observations || undefined,
        emetogenicRisk: d.emetogenicRisk || undefined,
        renalAdjustment: d.renalAdjustment || undefined,
        hepaticAdjustment: d.hepaticAdjustment || undefined,
        maxDose: d.maxDose || undefined,
      })),
      specialAlerts:
        formData.specialAlerts.length > 0 ? formData.specialAlerts : undefined,
      prophylaxis:
        formData.prophylaxis.length > 0 ? formData.prophylaxis : undefined,
      nursingCare:
        formData.nursingCare.length > 0 ? formData.nursingCare : undefined,
      renalAdjustments:
        formData.renalAdjustments.length > 0
          ? formData.renalAdjustments
          : undefined,
      hepaticAdjustments:
        formData.hepaticAdjustments.length > 0
          ? formData.hepaticAdjustments
          : undefined,
      hematologicAdjustments:
        formData.hematologicAdjustments.length > 0
          ? formData.hematologicAdjustments
          : undefined,
      dilutionInfo:
        formData.dilutionInfo.length > 0 ? formData.dilutionInfo : undefined,
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  }, [formData, editingId, createMutation, updateMutation]);

  const handleDelete = useCallback(() => {
    if (deletingId) {
      deleteMutation.mutate({ id: deletingId });
      setDeleteDialogOpen(false);
      setDeletingId(null);
    }
  }, [deletingId, deleteMutation]);

  const isSaving = createMutation.isPending || updateMutation.isPending;

  // ── Selection & Import/Export ──────────────────────────────────────────

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (!customProtocols) return;
    const activeIds = customProtocols
      .filter(p => p.isActive === 1)
      .map(p => p.id);
    setSelectedIds(prev => {
      if (prev.size === activeIds.length) return new Set();
      return new Set(activeIds);
    });
  }, [customProtocols]);

  const handleFileImport = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        const text = ev.target?.result as string;
        setImportJsonText(text);
        setImportDialogOpen(true);
      };
      reader.readAsText(file);
      // Reset input so same file can be selected again
      e.target.value = "";
    },
    []
  );

  const handleImportSubmit = useCallback(() => {
    if (!importJsonText.trim()) {
      toast.error("Nenhum conteúdo JSON fornecido.");
      return;
    }
    importMutation.mutate({ jsonData: importJsonText });
  }, [importJsonText, importMutation]);

  const handleExportSelected = useCallback(() => {
    if (selectedIds.size === 0) {
      toast.error("Selecione pelo menos um protocolo para exportar.");
      return;
    }
    exportMutation.mutate({ ids: Array.from(selectedIds) });
  }, [selectedIds, exportMutation]);

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileImport}
        className="hidden"
      />

      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              Gerenciamento de Protocolos
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              Crie, edite e gerencie seus protocolos personalizados
            </p>
          </div>
          <Button onClick={openCreateDialog} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Protocolo
          </Button>
        </div>

        {/* Action Bar */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSeedDialogOpen(true)}
            className="gap-2"
          >
            <Database className="h-4 w-4" />
            Sincronizar 52 revisados
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="gap-2"
          >
            <Upload className="h-4 w-4" />
            Importar JSON
          </Button>
          {selectedIds.size > 0 ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportSelected}
              disabled={exportMutation.isPending}
              className="gap-2"
            >
              {exportMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Exportar Selecionados ({selectedIds.size})
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportAllMutation.mutate()}
              disabled={exportAllMutation.isPending || !customProtocols?.length}
              className="gap-2"
            >
              {exportAllMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Exportar Todos
            </Button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar protocolos por nome ou indicação..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Protocol List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filteredProtocols.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Pill className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              {searchTerm
                ? "Nenhum protocolo encontrado"
                : "Nenhum protocolo personalizado"}
            </h3>
            <p className="text-slate-600 mb-4">
              {searchTerm
                ? "Tente outro termo de busca."
                : "Crie seu primeiro protocolo personalizado para começar."}
            </p>
            {!searchTerm && (
              <Button
                onClick={openCreateDialog}
                variant="outline"
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                Criar Protocolo
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {/* Select All toggle */}
          {filteredProtocols.filter(p => p.isActive === 1).length > 0 && (
            <div className="flex items-center gap-2 px-1">
              <button
                type="button"
                onClick={toggleSelectAll}
                className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 transition-colors"
              >
                {selectedIds.size ===
                filteredProtocols.filter(p => p.isActive === 1).length ? (
                  <CheckSquare className="h-4 w-4 text-primary" />
                ) : (
                  <Square className="h-4 w-4" />
                )}
                Selecionar todos
              </button>
              {selectedIds.size > 0 && (
                <span className="text-xs text-slate-500">
                  ({selectedIds.size} selecionado
                  {selectedIds.size > 1 ? "s" : ""})
                </span>
              )}
            </div>
          )}
          {filteredProtocols.map(protocol => (
            <Card
              key={protocol.id}
              className={`transition-all ${protocol.isActive === 0 ? "opacity-60 border-dashed" : ""} ${selectedIds.has(protocol.id) ? "ring-2 ring-primary/50" : ""}`}
            >
              <CardContent className="py-4">
                <div className="flex items-start justify-between gap-4">
                  {/* Checkbox */}
                  {protocol.isActive === 1 && (
                    <button
                      type="button"
                      onClick={() => toggleSelect(protocol.id)}
                      className="mt-1 shrink-0"
                    >
                      {selectedIds.has(protocol.id) ? (
                        <CheckSquare className="h-5 w-5 text-primary" />
                      ) : (
                        <Square className="h-5 w-5 text-slate-400 hover:text-slate-600" />
                      )}
                    </button>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="font-semibold text-slate-900 truncate">
                        {protocol.name}
                      </h3>
                      {isEnrichedClinicalDocument(
                        protocol.clinicalDocument
                      ) && (
                        <Badge
                          variant="outline"
                          className="text-xs border-amber-300 text-amber-900"
                        >
                          Rascunho · somente consulta
                        </Badge>
                      )}
                      {(protocol as any).isSystem === 1 && (
                        <Badge
                          variant="outline"
                          className="text-xs shrink-0 border-blue-300 text-blue-700"
                        >
                          Sistema
                        </Badge>
                      )}
                      <Badge
                        variant={
                          protocol.emetogenicRisk === "high"
                            ? "destructive"
                            : protocol.emetogenicRisk === "moderate"
                              ? "default"
                              : "secondary"
                        }
                        className="text-xs shrink-0"
                      >
                        Risco{" "}
                        {emetogenicLabels[
                          protocol.emetogenicRisk as EmetogenicRisk
                        ] || protocol.emetogenicRisk}
                      </Badge>
                      {protocol.isActive === 0 && (
                        <Badge variant="outline" className="text-xs shrink-0">
                          Inativo
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-slate-600 mb-2 line-clamp-2">
                      {protocol.indication}
                    </p>
                    <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                      <span>
                        {(protocol.drugs as any[])?.length || 0} droga(s)
                      </span>
                      <span>
                        {isEnrichedClinicalDocument(protocol.clinicalDocument)
                          ? "Calendário e fases no documento clínico"
                          : `${protocol.cycles} ciclo(s) de ${protocol.cycleLength} dias`}
                      </span>
                      <span>
                        Criado em{" "}
                        {new Date(protocol.createdAt).toLocaleDateString(
                          "pt-BR"
                        )}
                      </span>
                    </div>
                    {isEnrichedClinicalDocument(protocol.clinicalDocument) && (
                      <details className="mt-3 text-sm">
                        <summary className="cursor-pointer text-primary">
                          Documento integral · versão{" "}
                          {String(
                            protocol.clinicalPackage?.version ?? "não informada"
                          )}
                        </summary>
                        <p className="my-2 text-muted-foreground">
                          Para simular calendário e doses, selecione este
                          protocolo na calculadora. Revisões devem ser
                          importadas em JSON completo, sem remover políticas de
                          segurança.
                        </p>
                        <pre className="max-h-80 overflow-auto rounded-md bg-muted p-3 text-xs">
                          {JSON.stringify(protocol.clinicalDocument, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {protocol.isActive === 0 ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          restoreMutation.mutate({ id: protocol.id })
                        }
                        className="gap-1"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Restaurar
                      </Button>
                    ) : (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(protocol)}
                          disabled={isEnrichedClinicalDocument(
                            protocol.clinicalDocument
                          )}
                          title={
                            isEnrichedClinicalDocument(
                              protocol.clinicalDocument
                            )
                              ? "Revisar por JSON completo; o editor legado não preserva fases."
                              : "Editar protocolo"
                          }
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setDeletingId(protocol.id);
                            setDeleteDialogOpen(true);
                          }}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Editar Protocolo" : "Novo Protocolo"}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? "Modifique os campos do protocolo e salve as alterações."
                : "Preencha os campos para criar um novo protocolo personalizado."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Informações Básicas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="protocol-name">
                  Nome do Protocolo <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="protocol-name"
                  value={formData.name}
                  onChange={e =>
                    setFormData(prev => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="Ex: R-CHOP, FLAG-Ida, VRd..."
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="protocol-indication">
                  Indicação <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="protocol-indication"
                  value={formData.indication}
                  onChange={e =>
                    setFormData(prev => ({
                      ...prev,
                      indication: e.target.value,
                    }))
                  }
                  placeholder="Ex: Linfoma Difuso de Grandes Células B, 1ª linha"
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="protocol-cycles">Número de Ciclos</Label>
                <Input
                  id="protocol-cycles"
                  type="number"
                  min={1}
                  value={formData.cycles}
                  onChange={e =>
                    setFormData(prev => ({
                      ...prev,
                      cycles: parseInt(e.target.value) || 1,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="protocol-cycle-length">
                  Duração do Ciclo (dias)
                </Label>
                <Input
                  id="protocol-cycle-length"
                  type="number"
                  min={1}
                  value={formData.cycleLength}
                  onChange={e =>
                    setFormData(prev => ({
                      ...prev,
                      cycleLength: parseInt(e.target.value) || 21,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Risco Emetogênico</Label>
                <Select
                  value={formData.emetogenicRisk}
                  onValueChange={v =>
                    setFormData(prev => ({
                      ...prev,
                      emetogenicRisk: v as EmetogenicRisk,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">Alto</SelectItem>
                    <SelectItem value="moderate">Moderado</SelectItem>
                    <SelectItem value="low">Baixo</SelectItem>
                    <SelectItem value="minimal">Mínimo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            {/* ── Drogas ────────────────────────────────────────────────── */}
            <CollapsibleSection
              title="Drogas do Protocolo"
              icon={Pill}
              required
              count={formData.drugs.length}
              expanded={expandedSections.has("drugs")}
              onToggle={() => toggleSection("drugs")}
            >
              <div className="space-y-4">
                {formData.drugs.map((drug, index) => (
                  <Card key={index} className="border-dashed">
                    <CardContent className="py-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-700">
                          Droga {index + 1}
                        </span>
                        {formData.drugs.length > 1 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeDrug(index)}
                            className="text-destructive hover:text-destructive h-7"
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">
                            Nome <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            value={drug.name}
                            onChange={e =>
                              updateDrug(index, "name", e.target.value)
                            }
                            placeholder="Ex: Rituximabe"
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">
                            Dose <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            type="number"
                            min={0}
                            step="any"
                            value={drug.dose || ""}
                            onChange={e =>
                              updateDrug(
                                index,
                                "dose",
                                parseFloat(e.target.value) || 0
                              )
                            }
                            placeholder="375"
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Unidade</Label>
                          <Select
                            value={drug.doseUnit}
                            onValueChange={v =>
                              updateDrug(index, "doseUnit", v)
                            }
                          >
                            <SelectTrigger className="h-8 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {doseUnitOptions.map(unit => (
                                <SelectItem key={unit} value={unit}>
                                  {unit}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Dose Máxima (mg)</Label>
                          <Input
                            type="number"
                            min={0}
                            step="any"
                            value={drug.maxDose || ""}
                            onChange={e =>
                              updateDrug(
                                index,
                                "maxDose",
                                parseFloat(e.target.value) || undefined
                              )
                            }
                            placeholder="Opcional"
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">
                            Via <span className="text-destructive">*</span>
                          </Label>
                          <Select
                            value={drug.route}
                            onValueChange={v => updateDrug(index, "route", v)}
                          >
                            <SelectTrigger className="h-8 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {routeOptions.map(route => (
                                <SelectItem key={route} value={route}>
                                  {route}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">
                            Dias <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            value={drug.days}
                            onChange={e =>
                              updateDrug(index, "days", e.target.value)
                            }
                            placeholder="1-3, 8, 15"
                            className="h-8 text-sm"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Observações</Label>
                          <Input
                            value={drug.observations || ""}
                            onChange={e =>
                              updateDrug(index, "observations", e.target.value)
                            }
                            placeholder="Observações opcionais"
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">
                            Risco Emetogênico da Droga
                          </Label>
                          <Select
                            value={drug.emetogenicRisk || "none"}
                            onValueChange={v =>
                              updateDrug(
                                index,
                                "emetogenicRisk",
                                v === "none" ? undefined : v
                              )
                            }
                          >
                            <SelectTrigger className="h-8 text-sm">
                              <SelectValue placeholder="Não especificado" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">
                                Não especificado
                              </SelectItem>
                              <SelectItem value="high">Alto</SelectItem>
                              <SelectItem value="moderate">Moderado</SelectItem>
                              <SelectItem value="low">Baixo</SelectItem>
                              <SelectItem value="minimal">Mínimo</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  onClick={addDrug}
                  className="w-full gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Adicionar Droga
                </Button>
              </div>
            </CollapsibleSection>

            {/* ── Alertas Especiais ──────────────────────────────────── */}
            <CollapsibleSection
              title="Alertas Especiais"
              icon={AlertTriangle}
              count={formData.specialAlerts.length}
              expanded={expandedSections.has("alerts")}
              onToggle={() => toggleSection("alerts")}
            >
              <StringListEditor
                label="Alertas Clínicos"
                icon={AlertTriangle}
                items={formData.specialAlerts}
                onChange={items =>
                  setFormData(prev => ({ ...prev, specialAlerts: items }))
                }
                placeholder="Ex: Risco de síndrome de lise tumoral"
              />
            </CollapsibleSection>

            {/* ── Profilaxias ────────────────────────────────────────── */}
            <CollapsibleSection
              title="Profilaxias"
              icon={Shield}
              count={formData.prophylaxis.length}
              expanded={expandedSections.has("prophylaxis")}
              onToggle={() => toggleSection("prophylaxis")}
            >
              <StringListEditor
                label="Profilaxias Recomendadas"
                icon={Shield}
                items={formData.prophylaxis}
                onChange={items =>
                  setFormData(prev => ({ ...prev, prophylaxis: items }))
                }
                placeholder="Ex: Aciclovir 400mg 12/12h"
              />
            </CollapsibleSection>

            {/* ── Cuidados de Enfermagem ─────────────────────────────── */}
            <CollapsibleSection
              title="Cuidados de Enfermagem"
              icon={Stethoscope}
              count={formData.nursingCare.length}
              expanded={expandedSections.has("nursing")}
              onToggle={() => toggleSection("nursing")}
            >
              <StringListEditor
                label="Informações para Enfermagem"
                icon={Stethoscope}
                items={formData.nursingCare}
                onChange={items =>
                  setFormData(prev => ({ ...prev, nursingCare: items }))
                }
                placeholder="Ex: Monitorar sinais vitais a cada 15 min durante infusão"
              />
            </CollapsibleSection>

            {/* ── Ajustes de Dose ────────────────────────────────────── */}
            <CollapsibleSection
              title="Ajustes de Dose"
              icon={AlertTriangle}
              count={
                formData.renalAdjustments.length +
                formData.hepaticAdjustments.length +
                formData.hematologicAdjustments.length
              }
              expanded={expandedSections.has("adjustments")}
              onToggle={() => toggleSection("adjustments")}
            >
              <div className="space-y-6">
                <StringListEditor
                  label="Ajustes Renais"
                  icon={AlertTriangle}
                  items={formData.renalAdjustments}
                  onChange={items =>
                    setFormData(prev => ({
                      ...prev,
                      renalAdjustments: items,
                    }))
                  }
                  placeholder="Ex: Reduzir 50% se ClCr < 30 mL/min"
                />
                <StringListEditor
                  label="Ajustes Hepáticos"
                  icon={AlertTriangle}
                  items={formData.hepaticAdjustments}
                  onChange={items =>
                    setFormData(prev => ({
                      ...prev,
                      hepaticAdjustments: items,
                    }))
                  }
                  placeholder="Ex: Reduzir se bilirrubina > 3x LSN"
                />
                <StringListEditor
                  label="Ajustes Hematológicos"
                  icon={AlertTriangle}
                  items={formData.hematologicAdjustments}
                  onChange={items =>
                    setFormData(prev => ({
                      ...prev,
                      hematologicAdjustments: items,
                    }))
                  }
                  placeholder="Ex: Adiar se neutrófilos < 1000/mm³"
                />
              </div>
            </CollapsibleSection>

            {/* ── Diluição e Administração ───────────────────────────── */}
            <CollapsibleSection
              title="Diluição e Administração"
              icon={Beaker}
              count={formData.dilutionInfo.length}
              expanded={expandedSections.has("dilution")}
              onToggle={() => toggleSection("dilution")}
            >
              <div className="space-y-4">
                {formData.dilutionInfo.map((dilution, index) => (
                  <Card key={index} className="border-dashed">
                    <CardContent className="py-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-700">
                          Informação de Diluição {index + 1}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeDilution(index)}
                          className="text-destructive hover:text-destructive h-7"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Droga</Label>
                          <Input
                            value={dilution.drugName}
                            onChange={e =>
                              updateDilution(index, "drugName", e.target.value)
                            }
                            placeholder="Nome da droga"
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Diluente</Label>
                          <Input
                            value={dilution.diluent}
                            onChange={e =>
                              updateDilution(index, "diluent", e.target.value)
                            }
                            placeholder="Ex: SF 0,9%"
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Volume</Label>
                          <Input
                            value={dilution.volume}
                            onChange={e =>
                              updateDilution(index, "volume", e.target.value)
                            }
                            placeholder="Ex: 250 mL"
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Tempo de Infusão</Label>
                          <Input
                            value={dilution.infusionTime}
                            onChange={e =>
                              updateDilution(
                                index,
                                "infusionTime",
                                e.target.value
                              )
                            }
                            placeholder="Ex: 90 minutos"
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Estabilidade</Label>
                          <Input
                            value={dilution.stability}
                            onChange={e =>
                              updateDilution(index, "stability", e.target.value)
                            }
                            placeholder="Ex: 24h em temperatura ambiente"
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">
                            Instruções Especiais
                          </Label>
                          <Input
                            value={dilution.specialInstructions}
                            onChange={e =>
                              updateDilution(
                                index,
                                "specialInstructions",
                                e.target.value
                              )
                            }
                            placeholder="Ex: Proteger da luz"
                            className="h-8 text-sm"
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  onClick={addDilution}
                  className="w-full gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Adicionar Info de Diluição
                </Button>
              </div>
            </CollapsibleSection>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={isSaving}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSaving}
              className="gap-2"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {editingId ? "Salvar Alterações" : "Criar Protocolo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import JSON Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileJson className="h-5 w-5" />
              Importar Protocolos de JSON
            </DialogTitle>
            <DialogDescription>
              Cole o conteúdo JSON ou selecione um arquivo exportado
              anteriormente. Os protocolos serão adicionados à sua lista.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Conteúdo JSON</Label>
              <Textarea
                value={importJsonText}
                onChange={e => setImportJsonText(e.target.value)}
                placeholder='{\n  "version": "1.0",\n  "protocols": [...]\n}'
                className="font-mono text-xs min-h-[200px]"
              />
            </div>
            {importJsonText &&
              (() => {
                try {
                  const parsed = JSON.parse(importJsonText);
                  const count = parsed?.protocols?.length || 0;
                  return (
                    <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 px-3 py-2 rounded-md">
                      <CheckSquare className="h-4 w-4" />
                      JSON válido — {count} protocolo(s) encontrado(s)
                    </div>
                  );
                } catch {
                  return (
                    <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 px-3 py-2 rounded-md">
                      <AlertTriangle className="h-4 w-4" />
                      JSON inválido — verifique o formato
                    </div>
                  );
                }
              })()}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setImportDialogOpen(false);
                setImportJsonText("");
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleImportSubmit}
              disabled={importMutation.isPending || !importJsonText.trim()}
              className="gap-2"
            >
              {importMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              Importar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Seed System Protocols Dialog */}
      <AlertDialog open={seedDialogOpen} onOpenChange={setSeedDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Sincronizar 52 documentos revisados
            </AlertDialogTitle>
            <AlertDialogDescription>
              Adiciona os 52 rascunhos clínicos à sua conta com calendários,
              fases, políticas e fontes preservados. Documentos já presentes não
              serão duplicados; personalizados e legados não serão substituídos.
              Esta operação não homologa nem libera prescrições. As revisões
              devem usar importação/exportação do JSON completo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => seedMutation.mutate()}
              disabled={seedMutation.isPending}
              className="gap-2"
            >
              {seedMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Database className="h-4 w-4" />
              )}
              Sincronizar documentos
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Protocolo</AlertDialogTitle>
            <AlertDialogDescription>
              O protocolo será desativado e não aparecerá mais na calculadora.
              Você poderá restaurá-lo posteriormente se necessário.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Collapsible Section ───────────────────────────────────────────────────

function CollapsibleSection({
  title,
  icon: Icon,
  required,
  count,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  icon: React.ElementType;
  required?: boolean;
  count: number;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border rounded-lg">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors rounded-lg"
      >
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-slate-600" />
          <span className="font-medium text-sm text-slate-900">{title}</span>
          {required && <span className="text-destructive text-xs">*</span>}
          {count > 0 && (
            <Badge variant="secondary" className="text-xs">
              {count}
            </Badge>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-slate-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-400" />
        )}
      </button>
      {expanded && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}
