import { useState } from "react";
import { Maximize, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface FullscreenWrapperProps {
  children: React.ReactNode;
  title?: string;
}

export function FullscreenWrapper({ children, title }: FullscreenWrapperProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  return (
    <div className="relative">
      {/* Conteúdo normal visível na página */}
      {children}
      
      {/* Botão só visível no desktop (≥1024px) */}
      <Button
        variant="outline"
        size="icon"
        onClick={() => setIsFullscreen(true)}
        className="hidden lg:flex absolute top-4 right-4 z-10"
        title="Tela cheia"
      >
        <Maximize className="h-4 w-4" />
      </Button>

      {/* Dialog de tela cheia - replica o conteúdo */}
      <Dialog open={isFullscreen} onOpenChange={setIsFullscreen}>
        <DialogContent className="inset-0 left-0 top-0 translate-x-0 translate-y-0 w-[98vw] h-[98vh] max-w-none max-h-none overflow-auto p-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsFullscreen(false)}
            className="absolute top-2 right-2 z-50"
            title="Fechar"
          >
            <X className="h-4 w-4" />
          </Button>
          {children}
        </DialogContent>
      </Dialog>
    </div>
  );
}
