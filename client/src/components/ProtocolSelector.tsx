import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { protocols } from '@/data/protocols';
import type { Protocol } from '@/types/calculator';
import { Search, ChevronDown } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface ProtocolSelectorProps {
  selectedProtocol: Protocol | null;
  selectedCycle: number;
  onProtocolChange: (protocol: Protocol) => void;
  onCycleChange: (cycle: number) => void;
}

export default function ProtocolSelector({
  selectedProtocol,
  selectedCycle,
  onProtocolChange,
  onCycleChange,
}: ProtocolSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Atalho Ctrl+K (ou Cmd+K no Mac) para focar no campo de busca
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Memoizar lista de protocolos para evitar recriar objetos
  const protocolList = useMemo(() => protocols, []);

  // Filtrar protocolos baseado no termo de busca
  const filteredProtocols = useMemo(() => {
    if (!searchTerm.trim()) {
      return protocolList;
    }
    
    const term = searchTerm.toLowerCase();
    return protocolList.filter((protocol) => 
      protocol.name.toLowerCase().includes(term) ||
      protocol.indication.toLowerCase().includes(term)
    );
  }, [searchTerm, protocolList]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Seleção de Protocolo</CardTitle>
        <CardDescription>
          Escolha o protocolo quimioterápico e o ciclo atual
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Campo de busca com autocomplete */}
        <div className="space-y-2">
          <Label htmlFor="search">Buscar Protocolo</Label>
          <Popover open={showSuggestions && searchTerm.length > 0 && filteredProtocols.length > 0} onOpenChange={setShowSuggestions}>
            <PopoverTrigger asChild>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  ref={searchInputRef}
                  id="search"
                  type="text"
                  placeholder="Digite o nome do protocolo (ex: R-CHOP, FLAG-Ida)..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  className="pl-9"
                />
              </div>
            </PopoverTrigger>
            <PopoverContent className="w-[400px] p-0" align="start">
              <Command>
                <CommandList>
                  <CommandEmpty>Nenhum protocolo encontrado.</CommandEmpty>
                  <CommandGroup heading="Sugestões">
                    {filteredProtocols.slice(0, 10).map((protocol) => {
                      const highlightText = (text: string, term: string) => {
                        if (!term) return text;
                        const parts = text.split(new RegExp(`(${term})`, 'gi'));
                        return parts.map((part, i) => 
                          part.toLowerCase() === term.toLowerCase() 
                            ? <strong key={i} className="font-bold text-primary">{part}</strong>
                            : part
                        );
                      };

                      return (
                        <CommandItem
                          key={protocol.id}
                          value={protocol.id}
                          onSelect={() => {
                            setSearchTerm(protocol.name);
                            setShowSuggestions(false);
                            onProtocolChange(protocol);
                          }}
                          className="cursor-pointer"
                        >
                          <div className="flex flex-col gap-1">
                            <div className="font-medium">
                              {highlightText(protocol.name, searchTerm)}
                            </div>
                            <div className="text-xs text-muted-foreground line-clamp-1">
                              {highlightText(protocol.indication, searchTerm)}
                            </div>
                          </div>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          {searchTerm && (
            <p className="text-xs text-muted-foreground">
              {filteredProtocols.length} protocolo(s) encontrado(s)
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="protocol">Protocolo Quimioterápico</Label>
          <Select
            value={selectedProtocol ? selectedProtocol.id : undefined}
            onValueChange={(id) => {
              console.log('[ProtocolSelector] onValueChange called', { id, currentId: selectedProtocol?.id });
              const protocol = protocolList.find((p) => p.id === id);
              // Só chamar onProtocolChange se o protocolo realmente mudou
              if (protocol && protocol.id !== selectedProtocol?.id) {
                console.log('[ProtocolSelector] Calling onProtocolChange - protocol changed');
                onProtocolChange(protocol);
              } else {
                console.log('[ProtocolSelector] Skipping onProtocolChange - same protocol');
              }
            }}
          >
            <SelectTrigger id="protocol">
              <SelectValue placeholder="Selecione um protocolo" />
            </SelectTrigger>
            <SelectContent>
              {filteredProtocols.length > 0 ? (
                filteredProtocols.map((protocol) => (
                  <SelectItem key={protocol.id} value={protocol.id}>
                    {protocol.name}
                  </SelectItem>
                ))
              ) : (
                <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                  Nenhum protocolo encontrado
                </div>
              )}
            </SelectContent>
          </Select>
        </div>

        {selectedProtocol && (
          <>
            <div className="p-4 bg-muted/50 rounded-lg space-y-2">
              <p className="text-sm font-semibold text-foreground">Indicação:</p>
              <p className="text-sm text-muted-foreground">{selectedProtocol.indication}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cycle">Ciclo Atual</Label>
              <Select
                value={String(selectedCycle)}
                onValueChange={(v) => onCycleChange(parseInt(v))}
              >
                <SelectTrigger id="cycle">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: selectedProtocol.cycles }, (_, i) => i + 1).map((cycle) => (
                    <SelectItem key={cycle} value={String(cycle)}>
                      Ciclo {cycle}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
