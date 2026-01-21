import { useState, useEffect } from "react";
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
  const [isNativeFullscreen, setIsNativeFullscreen] = useState(false);

  const isFullscreen = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setIsFullscreen = setControlledOpen || setInternalOpen;

  // Sincronizar estado do Dialog com Fullscreen Nativo
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isDocFullscreen = !!document.fullscreenElement;
      setIsNativeFullscreen(isDocFullscreen);
      if (!isDocFullscreen && isFullscreen) {
        setIsFullscreen(false);
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, [isFullscreen, setIsFullscreen]);

  // Ativar/Desativar Fullscreen Nativo quando o estado muda
  useEffect(() => {
    if (isFullscreen && !document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error(`Erro ao tentar ativar tela cheia: ${err.message}`);
      });
    } else if (!isFullscreen && document.fullscreenElement) {
      document.exitFullscreen().catch((err) => {
        console.error(`Erro ao sair da tela cheia: ${err.message}`);
      });
    }
  }, [isFullscreen]);

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
        <DialogContent className="fixed inset-0 w-screen h-screen max-w-none max-h-none m-0 p-0 border-none rounded-none bg-background z-[150] overflow-auto focus:outline-none translate-x-0 translate-y-0 left-0 top-0 data-[state=open]:slide-in-from-left-0 data-[state=open]:slide-in-from-top-0">
          <div className="fixed top-4 right-4 z-[200]">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsFullscreen(false)}
              className="shadow-md bg-background/80 hover:bg-background"
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
