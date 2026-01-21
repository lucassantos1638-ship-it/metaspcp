import * as React from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { useColaboradores } from "@/hooks/usePrevisaoProducao";

interface SelecaoColaboradoresProps {
  colaboradoresSelecionados: string[];
  onToggle: (id: string) => void;
}

export default function SelecaoColaboradores({
  colaboradoresSelecionados,
  onToggle,
}: SelecaoColaboradoresProps) {
  const { data: colaboradores, isLoading } = useColaboradores();
  const [open, setOpen] = React.useState(false);

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Carregando colaboradores...</div>;
  }

  const selectedCollaboratorsDetails =
    colaboradores?.filter((c) => colaboradoresSelecionados.includes(c.id)) || [];

  return (
    <div className="space-y-4">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
          >
            Selecione um colaborador...
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
          <Command>
            <CommandInput placeholder="Buscar colaborador..." />
            <CommandList>
              <CommandEmpty>Nenhum colaborador encontrado.</CommandEmpty>
              <CommandGroup>
                {colaboradores?.map((colab) => {
                  const isSelected = colaboradoresSelecionados.includes(colab.id);
                  return (
                    <CommandItem
                      key={colab.id}
                      value={colab.nome}
                      onSelect={() => {
                        onToggle(colab.id);
                        // Optional: Keep open for multiple selection or close
                        // setOpen(false); 
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          isSelected ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {colab.nome}
                      {colab.funcao && (
                        <span className="text-muted-foreground ml-2">
                          ({colab.funcao})
                        </span>
                      )}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Lista de Colaboradores Selecionados */}
      <div className="flex flex-wrap gap-2">
        {selectedCollaboratorsDetails.length > 0 ? (
          selectedCollaboratorsDetails.map((colab) => (
            <Badge
              key={colab.id}
              variant="secondary"
              className="px-3 py-1 text-sm flex items-center gap-2"
            >
              {colab.nome}
              <button
                onClick={() => onToggle(colab.id)}
                className="hover:bg-muted-foreground/20 rounded-full p-0.5 transition-colors"
              >
                <X className="h-3 w-3" />
                <span className="sr-only">Remover</span>
              </button>
            </Badge>
          ))
        ) : (
          <p className="text-sm text-muted-foreground italic">
            Nenhum colaborador selecionado
          </p>
        )}
      </div>
    </div>
  );
}
