import { useState, useCallback, useEffect } from "react";

export function usePrintReport() {
    const [isPrinting, setIsPrinting] = useState(false);

    const triggerPrint = useCallback(() => {
        setIsPrinting(true);
        // Da tempo ao React de hidratar a DOM com isPrinting = true
        // Removendo os displays de tela normais por print:hidden e setando a table A4 pra renderizar
        setTimeout(() => {
            window.print();
        }, 300); // 300ms garante safe-spacing para tables grandes
    }, []);

    useEffect(() => {
        // Função para voltar a tela ao normal (desmontar o Report) quando a popup local fechar
        const handleAfterPrint = () => {
            setIsPrinting(false);
        };

        window.addEventListener('afterprint', handleAfterPrint);

        // Em navegadores modernos e Safari, onbeforeprint pode lidar com preparos sincrono, 
        // Mas a lógica do afterprint limpa o state
        return () => {
            window.removeEventListener('afterprint', handleAfterPrint);
        };
    }, []);

    return {
        isPrinting,
        triggerPrint
    };
}
