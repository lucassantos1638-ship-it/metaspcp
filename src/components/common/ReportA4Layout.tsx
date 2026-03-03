import React from "react";

interface EmpresaDados {
    nome?: string;
    cnpj?: string;
}

interface ReportA4LayoutProps {
    title: string;
    empresa?: EmpresaDados | null;
    children: React.ReactNode;
}

export default function ReportA4Layout({ title, empresa, children }: ReportA4LayoutProps) {
    return (
        <div className="hidden print:block w-full bg-white text-black font-sans box-border" style={{ padding: 0, margin: 0 }}>
            <table className="w-full border-collapse">
                {/* O Thead garante que o cabeçalho se repita em todas as folhas geradas pelo navegador */}
                <thead className="table-header-group">
                    <tr>
                        <td className="p-0 border-none">
                            <div className="flex flex-col mb-6 pb-4 border-b-2 border-[#1D4ED8] bg-white pt-2 break-inside-avoid">
                                <div className="flex justify-between items-end mb-2">
                                    <h1 className="text-2xl font-bold text-[#1D4ED8] m-0 leading-none">
                                        {empresa?.nome || "Empresa Não Informada"}
                                    </h1>
                                    <span className="text-xs font-semibold text-gray-600">
                                        CNPJ: {empresa?.cnpj || "Não informado"}
                                    </span>
                                </div>
                                <h2 className="text-xl font-bold text-gray-800 m-0 uppercase tracking-wide">
                                    {title}
                                </h2>
                            </div>
                        </td>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td className="p-0 border-none">
                            {/* O conteúdo principal do relatório (tabelas, informações) entra aqui */}
                            {children}
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
}
