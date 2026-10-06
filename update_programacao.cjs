const fs = require('fs');
let code = fs.readFileSync('src/pages/ProgramacaoSemanal.tsx', 'utf8');

// 1. Add Search to lucide-react import
code = code.replace(/import \{([^}]+)\}\s+from\s+['"]lucide-react['"];/, (match, p1) => {
    return 'import { ' + p1.trim() + ', Search } from "lucide-react";';
});

// 2. Add filtroPedidoModal state
code = code.replace(/const \[modalSemanaIndex, setModalSemanaIndex\] = useState[^\n]+;/, 
    'const [modalSemanaIndex, setModalSemanaIndex] = useState<number | null>(null);\n    const [filtroPedidoModal, setFiltroPedidoModal] = useState<string>("");'
);

// 3. Update modalRows useMemo
const oldModalRows = /const modalRows = useMemo\(\(\) => \{[\s\S]*?return result;\n    \}, \[data, modalSemanaIndex\]\);/;
const newModalRows = `const modalRows = useMemo(() => {
        if (modalSemanaIndex === null) return [];
        
        const result: any[] = [];
        
        data.forEach(row => {
            if (row.isSummary) {
                // Wait, if it's summary, we need to gather all orders across colors for this product!
                const pedidosDaSemana = row.pedidosPorSemana[modalSemanaIndex] || [];
                let filteredPedidos = [...pedidosDaSemana];
                
                if (filtroPedidoModal) {
                    filteredPedidos = filteredPedidos.filter((p: any) => p.numero && String(p.numero).includes(filtroPedidoModal));
                }
                
                const totalQtd = filteredPedidos.reduce((acc: number, p: any) => acc + (p.quantidade || 0), 0);
                
                if (totalQtd > 0) {
                    result.push({
                        isSummary: true,
                        codigo: row.codigo,
                        produto: row.produto,
                        codCor: "",
                        cor: "",
                        estoque: row.estoque,
                        pedido: "",
                        cliente: "",
                        data_entrega: "",
                        qtd: totalQtd,
                        saldo: (row.estoque !== null ? row.estoque : 0) - totalQtd
                    });
                }
            } else {
                const pedidos = row.pedidosPorSemana[modalSemanaIndex] || [];
                let filteredPedidos = [...pedidos];
                
                if (filtroPedidoModal) {
                    filteredPedidos = filteredPedidos.filter((p: any) => p.numero && String(p.numero).includes(filtroPedidoModal));
                }
                
                if (filteredPedidos.length > 0) {
                    // Sort by client
                    filteredPedidos.sort((a: any, b: any) => (a.cliente || "").localeCompare(b.cliente || ""));
                    
                    const corTotalQtd = filteredPedidos.reduce((acc: number, p: any) => acc + (p.quantidade || 0), 0);
                    
                    filteredPedidos.forEach((p: any) => {
                        result.push({
                            isSummary: false,
                            codigo: "",
                            produto: "",
                            codCor: row.codCor,
                            cor: row.cor,
                            estoque: row.estoque,
                            pedido: p.numero || "-",
                            cliente: p.cliente || "Sem nome",
                            data_entrega: p.data_entrega,
                            qtd: p.quantidade,
                            saldo: (row.estoque !== null ? row.estoque : 0) - corTotalQtd
                        });
                    });
                }
            }
        });
        
        return result;
    }, [data, modalSemanaIndex, filtroPedidoModal]);`;
code = code.replace(oldModalRows, newModalRows);

// 4. Update DialogHeader to include filter and Dropdown for PDF
const oldDialogHeader = /<div className="absolute right-12 top-6">[\s\S]*?<\/button>\s*<\/div>/;
const newDialogHeader = `<div className="absolute right-12 top-6 flex items-center gap-4">
                            <div className="flex items-center gap-2 border border-slate-300 rounded-md px-2 py-1.5 bg-white shadow-sm">
                                <Search className="w-4 h-4 text-slate-400" />
                                <input 
                                    type="text" 
                                    placeholder="Filtrar Pedido..." 
                                    value={filtroPedidoModal}
                                    onChange={e => setFiltroPedidoModal(e.target.value)}
                                    className="text-sm border-none outline-none w-32 bg-transparent text-slate-700 font-medium"
                                />
                            </div>
                            
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <button
                                        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-md transition-colors border border-red-200"
                                    >
                                        <Download className="w-4 h-4" />
                                        PDF
                                    </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                    <DropdownMenuItem onClick={() => handleExportModalPDF('resumo')} className="cursor-pointer text-sm">
                                        Resumido (Só Produtos)
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleExportModalPDF('total')} className="cursor-pointer text-sm">
                                        Completo (Com Cores)
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>`;
code = code.replace(oldDialogHeader, newDialogHeader);

// 5. Update handleExportModalPDF to support tipo
const oldHandleExport = /const handleExportModalPDF = \(\) => \{[\s\S]*?autoTable\(doc, \{[\s\S]*?doc\.save[^\n]+\n    \};/;
const newHandleExport = `const handleExportModalPDF = (tipo: 'resumo' | 'total' = 'total') => {
        if (!modalRows || modalRows.length === 0 || modalSemanaIndex === null) return;

        const doc = new jsPDF('landscape');
        
        doc.setFontSize(14);
        const periodo = \`\${format(semanasDoMes[modalSemanaIndex].start, "dd/MM")} a \${format(semanasDoMes[modalSemanaIndex].end, "dd/MM")}\`;
        
        let titulo = \`Entregas da Semana (\${tipo === 'resumo' ? 'Resumido' : 'Total'}): \${periodo}\`;
        if (filtroPedidoModal) {
            titulo += \` - Pedido: \${filtroPedidoModal}\`;
        }
        
        doc.text(titulo, 14, 15);
        
        const head = tipo === 'resumo' 
            ? [["CÓDIGO", "PRODUTO", "ESTOQUE", "QTD TOTAL", "SALDO"]]
            : [["CÓDIGO", "PRODUTO", "CÓD. COR", "COR", "ESTOQUE", "Nº PEDIDO", "CLIENTE", "ENTREGA", "QTD", "SALDO"]];
        
        const filteredRows = tipo === 'resumo' ? modalRows.filter(r => r.isSummary) : modalRows;
        
        const body = filteredRows.map(r => {
            if (tipo === 'resumo') {
                return [
                    r.codigo || "",
                    r.produto || "",
                    r.estoque !== null ? formatVal(r.estoque) : '',
                    formatVal(r.qtd),
                    r.estoque !== null ? formatVal(r.saldo) : ''
                ];
            } else {
                return [
                    r.codigo || r.codCor || "",
                    r.isSummary ? r.produto : "",
                    r.codCor || "",
                    r.cor || "",
                    r.estoque !== null ? formatVal(r.estoque) : '',
                    r.pedido || "",
                    r.cliente || "",
                    r.data_entrega ? format(parseISO(r.data_entrega + "T00:00:00"), "dd/MM/yyyy") : "",
                    formatVal(r.qtd),
                    r.estoque !== null ? formatVal(r.saldo) : ''
                ];
            }
        });

        autoTable(doc, {
            head: head,
            body: body,
            startY: 20,
            theme: 'grid',
            styles: { 
                fontSize: 7, 
                cellPadding: 1,
                lineColor: [220, 220, 220],
                lineWidth: 0.1
            },
            headStyles: { fillColor: [79, 70, 229], fontSize: 7, halign: 'center', textColor: [255, 255, 255] },
            columnStyles: {
                0: { cellWidth: 15 },
                1: { cellWidth: tipo === 'resumo' ? 80 : 50 },
                [tipo === 'resumo' ? 3 : 8]: { halign: 'right' },
                [tipo === 'resumo' ? 4 : 9]: { halign: 'right' }
            },
            didParseCell: function(d: any) {
                if (d.section === 'body') {
                    const rowData = body[d.row.index];
                    if (rowData && rowData[1] !== "") {
                        d.cell.styles.fontStyle = 'bold';
                        d.cell.styles.fillColor = [240, 248, 241];
                    }
                }
            }
        });

        doc.save(\`entregas-semana-\${tipo}-\${periodo.replace(/\\//g, '-')}.pdf\`);
    };`;
code = code.replace(oldHandleExport, newHandleExport);

// 6. Reset filter when modal closes
code = code.replace(/onOpenChange=\{\(open\) => !open && setModalSemanaIndex\(null\)\}/, 'onOpenChange={(open) => { if (!open) { setModalSemanaIndex(null); setFiltroPedidoModal(""); } }}');

fs.writeFileSync('src/pages/ProgramacaoSemanal.tsx', code);
console.log('Update complete');
