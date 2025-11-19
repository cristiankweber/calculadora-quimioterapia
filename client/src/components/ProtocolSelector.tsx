import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { protocols } from '@/data/protocols';
import type { Protocol } from '@/types/calculator';

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
  return (
    <Card>
      <CardHeader>
        <CardTitle>Seleção de Protocolo</CardTitle>
        <CardDescription>
          Escolha o protocolo quimioterápico e o ciclo atual
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="protocol">Protocolo Quimioterápico</Label>
          <Select
            value={selectedProtocol?.id || ''}
            onValueChange={(id) => {
              const protocol = protocols.find((p) => p.id === id);
              if (protocol) onProtocolChange(protocol);
            }}
          >
            <SelectTrigger id="protocol">
              <SelectValue placeholder="Selecione um protocolo" />
            </SelectTrigger>
            <SelectContent>
              {protocols.map((protocol) => (
                <SelectItem key={protocol.id} value={protocol.id}>
                  {protocol.name}
                </SelectItem>
              ))}
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
