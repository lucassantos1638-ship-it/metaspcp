import React from "react";
import ReportA4Layout from "@/components/common/ReportA4Layout";
import { formatarCusto } from "@/lib/custoUtils";

interface PedidoRelatorioA4Props {
    pedido: any;
    empresa: any;
    itens: any[];
}

export default function PedidoRelatorioA4({ pedido, empresa, itens }: PedidoRelatorioA4Props) {

    const valorTotalProduto = itens.reduce((acc, curr) => acc + (curr.valor_unitario * curr.quantidade), 0);
    const descontoTotal = pedido.desconto || 0;
    const valorFinal = valorTotalProduto - descontoTotal;

    return (
        <ReportA4Layout title="Relatório de Pedido" empresa={empresa}>

            {/* Informações Gerais do Pedido */}
            <div className="mb-8 break-inside-avoid">
                <h3 className="text-sm font-bold text-[#1D4ED8] mb-3 uppercase border-b border-gray-200 pb-1 break-after-avoid">Informações Gerais</h3>
                <div className="grid grid-cols-2 gap-x-4">
                    <div>
                        <p className="text-sm mb-1"><span className="font-semibold text-gray-600">Nº do Pedido:</span> #{pedido.numero}</p>
                        <p className="text-sm mb-1"><span className="font-semibold text-gray-600">Cliente:</span> {pedido.cliente_nome}</p>
                        <p className="text-sm mb-1"><span className="font-semibold text-gray-600">Data do Pedido:</span> {new Date(pedido.criado_em).toLocaleDateString()}</p>
                        <p className="text-sm mb-1"><span className="font-semibold text-gray-600">Data de Entrega:</span> {pedido.data_entrega ? new Date(pedido.data_entrega).toLocaleDateString() : 'Não informada'}</p>
                    </div>
                    <div>
                        <p className="text-sm mb-1"><span className="font-semibold text-gray-600">Valor Bruto:</span> {formatarCusto(valorTotalProduto)}</p>
                        <p className="text-sm mb-1"><span className="font-semibold text-gray-600">Desconto:</span> {formatarCusto(descontoTotal)}</p>
                        <p className="text-sm mb-1"><span className="font-semibold text-gray-600">Valor Líquido:</span> {formatarCusto(valorFinal)}</p>
                        <p className="text-sm mb-1"><span className="font-semibold text-gray-600">Status:</span> {pedido.status}</p>
                    </div>
                </div>
            </div>

            {/* Listagem de Itens / Carrinho */}
            <div className="mb-8">
                <h3 className="text-sm font-bold text-[#1D4ED8] mb-3 uppercase border-b border-gray-200 pb-1 break-after-avoid">Itens do Pedido</h3>
                <table className="w-full text-sm text-left border-collapse mb-2 border border-gray-300">
                    <thead className="bg-gray-100 text-gray-800 border-b border-gray-300">
                        <tr>
                            <th className="py-2 px-3 font-semibold border-r border-gray-300 w-16 text-center">SKU</th>
                            <th className="py-2 px-3 font-semibold border-r border-gray-300">Descrição do Produto</th>
                            <th className="py-2 px-3 font-semibold text-center border-r border-gray-300 w-24">Qtde</th>
                            <th className="py-2 px-3 font-semibold text-right border-r border-gray-300 w-32">Vlr. Unitário</th>
                            <th className="py-2 px-3 font-semibold text-right w-32">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {itens?.length > 0 ? (
                            itens.map((item: any, idx: number) => {
                                const subtotal = item.quantidade * item.valor_unitario;

                                return (
                                    <tr key={idx} className="border-b border-gray-200 hover:bg-gray-50 break-inside-avoid">
                                        <td className="py-2 px-3 border-r border-gray-200 text-center text-gray-500">
                                            {item.produto?.sku || "-"}
                                        </td>
                                        <td className="py-2 px-3 border-r border-gray-200 font-medium">
                                            {item.produto?.nome || "Produto Desconhecido"}
                                        </td>
                                        <td className="py-2 px-3 text-center border-r border-gray-200">
                                            {item.quantidade} un.
                                        </td>
                                        <td className="py-2 px-3 text-right border-r border-gray-200 text-gray-600">
                                            {formatarCusto(item.valor_unitario)}
                                        </td>
                                        <td className="py-2 px-3 text-right font-medium">
                                            {formatarCusto(subtotal)}
                                        </td>
                                    </tr>
                                );
                            })
                        ) : (
                            <tr>
                                <td colSpan={5} className="py-4 px-3 text-center text-gray-500 italic border-b border-gray-200">Nenhum item cadastrado neste pedido.</td>
                            </tr>
                        )}
                    </tbody>
                    <tfoot className="bg-gray-50 border-t-2 border-gray-300 break-inside-avoid">
                        <tr>
                            <td colSpan={4} className="py-2 px-3 text-right font-bold border-r border-gray-200">Total Geral:</td>
                            <td className="py-2 px-3 text-right font-bold text-[#1D4ED8]">
                                {formatarCusto(valorTotalProduto)}
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>

        </ReportA4Layout>
    );
}
