import { useEffect, useState } from "react";
import { contarDiasUteis } from "@/lib/previsaoUtils";
import { AlertTriangle, Calendar } from "lucide-react";

interface ContagemRegressivaProps {
  dataEntrega: string;
}

export default function ContagemRegressiva({ dataEntrega }: ContagemRegressivaProps) {
  const [diasRestantes, setDiasRestantes] = useState(0);

  useEffect(() => {
    const calcularDias = () => {
      const dias = contarDiasUteis(new Date(), new Date(dataEntrega));
      setDiasRestantes(dias);
    };

    calcularDias();
    const intervalo = setInterval(calcularDias, 60000);

    return () => clearInterval(intervalo);
  }, [dataEntrega]);

  const getColorClass = () => {
    if (diasRestantes < 0) return "text-destructive";
    if (diasRestantes <= 3) return "text-destructive";
    if (diasRestantes <= 7) return "text-yellow-600 dark:text-yellow-500";
    return "text-success";
  };

  const getIcon = () => {
    if (diasRestantes <= 3) return <AlertTriangle className="h-5 w-5" />;
    return <Calendar className="h-5 w-5" />;
  };

  const getTexto = () => {
    if (diasRestantes < 0) {
      return `ATRASADO: ${Math.abs(diasRestantes)} ${Math.abs(diasRestantes) === 1 ? 'DIA' : 'DIAS'}`;
    }
    return `FALTAM ${diasRestantes} ${diasRestantes === 1 ? 'DIA' : 'DIAS'}`;
  };

  return (
    <div className={`flex items-center gap-2 font-bold ${getColorClass()}`}>
      {getIcon()}
      <span className="text-lg">{getTexto()}</span>
    </div>
  );
}
