import { useState } from "react";
import { Maximize, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface FullscreenWrapperProps {
  children: React.ReactNode;
  renderFullscreen?: () => React.ReactNode;
  trigger?: React.ReactNode;
  title?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function FullscreenWrapper({
  children,
  renderFullscreen,
  trigger,
  title,
  open: controlledOpen,
  onOpenChange: setControlledOpen
}: FullscreenWrapperProps) {
  const [internalOpen, setInternalOpen] = useState(false);

  const isFullscreen = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setIsFullscreen = setControlledOpen || setInternalOpen;

  return (
    <div className="relative">
      {/* Conteúdo normal visível na página */}
      {children}

      {trigger !== undefined ? (
        trigger && (
          <div onClick={() => setIsFullscreen(true)} className="inline-block">
            {trigger}
          </div>
        )
      ) : (
        <Button
          variant="outline"
          size="icon"
          onClick={() => setIsFullscreen(true)}
          className="absolute top-4 right-4 z-[60]"
          title="Tela cheia"
        >
          <Maximize className="h-4 w-4" />
        </Button>
      )}

      {/* Dialog de tela cheia */}
      <Dialog open={isFullscreen} onOpenChange={setIsFullscreen}>
        <DialogContent className="inset-0 left-0 top-0 translate-x-0 translate-y-0 w-[98vw] h-[98vh] max-w-none max-h-none overflow-auto p-0 bg-background">
          <div className="sticky top-0 right-0 z-[100] flex justify-end p-4 bg-background/50 backdrop-blur-sm">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsFullscreen(false)}
              className="shadow-md"
              title="Sair da tela cheia (Esc)"
            >
              <X className="mr-2 h-4 w-4" /> Fechar
            </Button>
          </div>
          <div className="px-6 pb-6">
            {renderFullscreen ? renderFullscreen() : children}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
