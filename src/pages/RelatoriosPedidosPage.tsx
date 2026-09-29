import React from "react";
import { RelatoriosPedidos } from "@/components/pedidos/RelatoriosPedidos";

export default function RelatoriosPedidosPage() {
    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-foreground">Relatórios de Pedidos</h1>
                    <p className="text-muted-foreground mt-1">
                        Análise de faturamento e ranking de clientes
                    </p>
                </div>
            </div>
            
            <div className="mt-6">
                <RelatoriosPedidos />
            </div>
        </div>
    );
}
