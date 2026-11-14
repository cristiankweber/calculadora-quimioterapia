import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Protocol } from "@/types/calculator";
import { Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  getClinicalCatalogue,
  type CatalogueKind,
} from "@/lib/clinicalCatalogue";

interface ProtocolSelectorProps {
  selectedProtocol: Protocol | null;
  selectedCycle: number;
  onProtocolChange: (protocol: Protocol | null) => void;
  onCycleChange: (cycle: number) => void;
}

export default function ProtocolSelector({
  selectedProtocol,
  selectedCycle,
  onProtocolChange,
  onCycleChange,
}: ProtocolSelectorProps) {
  const [kind, setKind] = useState<CatalogueKind>("reviewed");
  const [searchTerm, setSearchTerm] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { isAuthenticated } = useAuth();
  const { data: storedProtocols, isError } =
    trpc.customProtocols.listActive.useQuery(undefined, {
      staleTime: 30_000,
      enabled: isAuthenticated,
    });
  const protocolList = useMemo(
    () =>
      getClinicalCatalogue(
        kind,
        (storedProtocols ?? []) as unknown as Record<string, unknown>[]
      ),
    [kind, storedProtocols]
  );
  const filteredProtocols = useMemo(
    () =>
      protocolList.filter(
        p =>
          !searchTerm.trim() ||
          `${p.name} ${p.indication}`
            .toLowerCase()
            .includes(searchTerm.trim().toLowerCase())
      ),
    [protocolList, searchTerm]
  );
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "k") {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, []);
  const choose = (protocol: Protocol) => {
    onProtocolChange(protocol);
    setSearchTerm("");
    setShowSuggestions(false);
  };
  const highlight = (text: string) => {
    const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (!escaped) return text;
    return text
      .split(new RegExp(`(${escaped})`, "gi"))
      .map((part, i) =>
        part.toLowerCase() === searchTerm.toLowerCase() ? (
          <strong key={i}>{part}</strong>
        ) : (
          part
        )
      );
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>Seleção de protocolo</CardTitle>
        <CardDescription>
          52 documentos revisados para consulta e simulação. Homologação clínica
          não concedida.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="protocol-library">Biblioteca</Label>
          <Select
            value={kind}
            onValueChange={value => {
              setKind(value as CatalogueKind);
              setSearchTerm("");
              onProtocolChange(null);
            }}
          >
            <SelectTrigger id="protocol-library">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="reviewed">
                Revisados — rascunhos clínicos
              </SelectItem>
              <SelectItem value="custom">Personalizados</SelectItem>
              <SelectItem value="legacy">
                Legados — consulta histórica
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        {kind === "legacy" && (
          <p
            role="status"
            className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"
          >
            Cadastros anteriores preservados. Protocolos correspondentes à
            biblioteca revisada não podem gerar novas prescrições pela versão
            antiga.
          </p>
        )}
        {kind === "custom" && !isAuthenticated && (
          <p className="text-sm text-muted-foreground">
            Entre na sua conta pelo Dashboard para consultar seus
            personalizados. A biblioteca revisada não exige login.
          </p>
        )}
        {isError && (
          <p role="alert" className="text-sm text-destructive">
            Não foi possível carregar os protocolos da conta. A biblioteca
            revisada continua disponível.
          </p>
        )}
        <div className="space-y-2">
          <Label htmlFor="search">Buscar protocolo</Label>
          <Popover
            open={
              showSuggestions &&
              searchTerm.length > 0 &&
              filteredProtocols.length > 0
            }
            onOpenChange={setShowSuggestions}
          >
            <PopoverTrigger asChild>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  ref={searchInputRef}
                  id="search"
                  placeholder="Nome ou indicação (ex.: R-DHAP, BuEM)"
                  className="pl-9"
                  value={searchTerm}
                  onChange={e => {
                    setSearchTerm(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                />
              </div>
            </PopoverTrigger>
            <PopoverContent
              className="w-[min(400px,calc(100vw-2rem))] p-0"
              align="start"
            >
              <Command shouldFilter={false}>
                <CommandList>
                  <CommandEmpty>Nenhum documento encontrado.</CommandEmpty>
                  <CommandGroup heading="Sugestões">
                    {filteredProtocols.slice(0, 10).map(protocol => (
                      <CommandItem
                        key={protocol.id}
                        value={protocol.id}
                        onSelect={() => choose(protocol)}
                      >
                        <div className="min-w-0">
                          <div className="font-medium">
                            {highlight(protocol.name)}
                          </div>
                          <div className="text-xs text-muted-foreground line-clamp-1">
                            {highlight(protocol.indication)}
                          </div>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          <p className="text-xs text-muted-foreground">
            {filteredProtocols.length} documento(s) nesta biblioteca
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="protocol">Protocolo</Label>
          <Select
            value={
              selectedProtocol &&
              protocolList.some(p => p.id === selectedProtocol.id)
                ? selectedProtocol.id
                : undefined
            }
            onValueChange={id => {
              const p = protocolList.find(p => p.id === id);
              if (p) choose(p);
            }}
          >
            <SelectTrigger id="protocol">
              <SelectValue placeholder="Selecione um protocolo" />
            </SelectTrigger>
            <SelectContent>
              {filteredProtocols.map(protocol => (
                <SelectItem key={protocol.id} value={protocol.id}>
                  {protocol.name}
                </SelectItem>
              ))}
              {!filteredProtocols.length && (
                <p className="p-3 text-sm text-muted-foreground">
                  Nenhum protocolo nesta seleção.
                </p>
              )}
            </SelectContent>
          </Select>
        </div>
        {selectedProtocol && (
          <div className="rounded-lg bg-muted/50 p-3 text-sm">
            <strong>Indicação: </strong>
            {selectedProtocol.indication}
          </div>
        )}
        {selectedProtocol &&
          !selectedProtocol.clinicalDocument &&
          kind === "custom" && (
            <div className="space-y-2">
              <Label htmlFor="cycle">Ciclo atual</Label>
              <Input
                id="cycle"
                type="number"
                min={1}
                max={
                  selectedProtocol.cycles === 999
                    ? undefined
                    : selectedProtocol.cycles
                }
                value={selectedCycle}
                onChange={e => {
                  const value = Number(e.target.value);
                  if (Number.isInteger(value) && value >= 1)
                    onCycleChange(value);
                }}
              />
            </div>
          )}
      </CardContent>
    </Card>
  );
}
