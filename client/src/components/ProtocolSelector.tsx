import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { protocols } from '@/data/protocols';
import type { Protocol } from '@/types/calculator';
import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';

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

  // Filtrar protocolos baseado no termo de busca
  const filteredProtocols = useMemo(() => {
    if (!searchTerm.trim()) {
      return protocols;
    }
    
    const term = searchTerm.toLowerCase();
    return protocols.filter((protocol) => 
      protocol.name.toLowerCase().includes(term) ||
      protocol.indication.toLowerCase().includes(term)
    );
  }, [searchTerm]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Seleção de Protocolo</CardTitle>
        <CardDescription>
          Escolha o protocolo quimioterápico e o ciclo atual
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Campo de busca */}
        <div className="space-y-2">
          <Label htmlFor="search">Buscar Protocolo</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="search"
              type="text"
              placeholder="Digite o nome do protocolo (ex: R-CHOP, FLAG-Ida)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
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
              const protocol = protocols.find((p) => p.id === id);
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
