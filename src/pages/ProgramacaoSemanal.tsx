import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Box, Loader2, Maximize, Minimize, ChevronDown, ChevronRight, PackageOpen, Download, Search } from "lucide-react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { format, subMonths, parseISO, isValid, startOfMonth, endOfMonth, eachWeekOfInterval, startOfWeek, endOfWeek, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function ProgramacaoSemanal() {
    const empresaId = useEmpresaId();

    const [mes1, setMes1] = useState(() => format(subMonths(new Date(), 2), 'yyyy-MM'));
    const [mes2, setMes2] = useState(() => format(subMonths(new Date(), 1), 'yyyy-MM'));
    const [mes3, setMes3] = useState(() => format(new Date(), 'yyyy-MM'));
    const [showMonths, setShowMonths] = useState(false);
    
    // Novo estado para o mês de Entregas
    const [mesEntregas, setMesEntregas] = useState(() => format(new Date(), 'yyyy-MM'));

    // Estado para Fullscreen
    const [isFullscreen, setIsFullscreen] = useState(false);
    const fullscreenRef = useRef<HTMLDivElement>(null);

    // Estado para Estoque
    const [inventario, setInventario] = useState<any[]>([]);
    const [inventarioCortes, setInventarioCortes] = useState<any[]>([]);

    // Estado para os Produtos Colapsados
    const [collapsedProducts, setCollapsedProducts] = useState<Record<string, boolean>>({});

    const toggleProduct = (produtoId: string) => {
        setCollapsedProducts(prev => ({
            ...prev,
            [produtoId]: !prev[produtoId]
        }));
    };

    const [modalSemanaIndex, setModalSemanaIndex] = useState<number | null>(null);
    const [filtroPedidoModal, setFiltroPedidoModal] = useState<string>("");

    useEffect(() => {
        if (empresaId) {
            const stored = localStorage.getItem(`estoque_cores_${empresaId}`);
            if (stored) {
                try {
                    setInventario(JSON.parse(stored));
                } catch (e) {}
            }
            const storedCortes = localStorage.getItem(`estoque_cortes_${empresaId}`);
            if (storedCortes) {
                try {
                    setInventarioCortes(JSON.parse(storedCortes));
                } catch (e) {}
            }
        }
    }, [empresaId]);

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener("fullscreenchange", handleFullscreenChange);
        return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
    }, []);

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            fullscreenRef.current?.requestFullscreen().catch(err => {
                console.error(`Error attempting to enable fullscreen: ${err.message}`);
            });
        } else {
            document.exitFullscreen();
        }
    };

    const semanasDoMes = useMemo(() => {
        if (!mesEntregas) return [];
        try {
            const selectedMonthDate = parseISO(`${mesEntregas}-01T00:00:00`);
            const monthStart = startOfMonth(selectedMonthDate);
            const monthEnd = endOfMonth(selectedMonthDate);

            // Semana começando na Segunda-feira (1)
            const weeks = eachWeekOfInterval({ start: monthStart, end: monthEnd }, { weekStartsOn: 1 });

            return weeks.map(weekStart => {
                const s = startOfWeek(weekStart, { weekStartsOn: 1 });
                const e = endOfWeek(weekStart, { weekStartsOn: 1 });
                return { start: s, end: e };
            });
        } catch (e) {
            return [];
        }
    }, [mesEntregas]);

    // Fetch Produtos e suas Cores
    const { data: produtos, isLoading: isLoadingProdutos } = useQuery({
        queryKey: ["produtos-com-cores", empresaId],
        enabled: !!empresaId,
        queryFn: async () => {
            let allData: any[] = [];
            let page = 0;
            const pageSize = 1000;
            let hasMore = true;

            while (hasMore) {
                const { data, error } = await supabase
                    .from("produtos")
                    .select(`
                        id, 
                        nome, 
                        sku,
                        produto_cores(codigo, descricao)
                    `)
                    .eq("empresa_id", empresaId)
                    .eq("ativo", true)
                    .order("nome")
                    .range(page * pageSize, (page + 1) * pageSize - 1);

                if (error) throw error;
                if (data) {
                    allData = [...allData, ...data];
                    if (data.length < pageSize) hasMore = false;
                    else page++;
                } else {
                    hasMore = false;
                }
            }
            return allData;
        }
    });

    // Fetch Todos os Pedidos/Itens não cancelados
    const { data: vendasItens, isLoading: isLoadingVendas } = useQuery({
        queryKey: ["todas-vendas-programacao", empresaId],
        enabled: !!empresaId,
        queryFn: async () => {
            let allData: any[] = [];
            let page = 0;
            const pageSize = 1000;
            let hasMore = true;

            while (hasMore) {
                const { data, error } = await supabase
                    .from("pedido_itens")
                    .select(`
                        produto_id,
                        cor,
                        codigo_cor,
                        quantidade,
                        pedidos!inner(numero, data_emissao, data_entrega, status, empresa_id, entidade(nome))
                    `)
                    .eq("pedidos.empresa_id", empresaId)
                    .neq("pedidos.status", "Cancelado")
                    .range(page * pageSize, (page + 1) * pageSize - 1);

                if (error) throw error;
                if (data) {
                    allData = [...allData, ...data];
                    if (data.length < pageSize) hasMore = false;
                    else page++;
                } else {
                    hasMore = false;
                }
            }
            return allData;
        }
    });

    const data = useMemo(() => {
        if (!produtos || !vendasItens) return [];

        const result: any[] = [];

        for (const prod of produtos) {
            const cores = prod.produto_cores || [];
            if (cores.length === 0) {
                cores.push({ codigo: "-", descricao: "Sem cor definida" });
            }

            const getVendas = (corObj: any) => {
                let m1 = 0; let m2 = 0; let m3 = 0;
                let totalPedidos = 0;
                let estoque = 0;
                let estoqueCortes = 0;
                const entregasPorSemana = semanasDoMes.map(() => 0); // inicializa um array com 0s do tamanho de semanasDoMes
                const pedidosPorSemana = semanasDoMes.map(() => [] as any[]);

                const cDesc = corObj.descricao ? corObj.descricao.trim() : "";
                
                // Busca o estoque no inventario do LocalStorage
                const invForProd = inventario.filter((i: any) => i.produtoId === prod.id);
                const invCor = invForProd.find((i: any) => {
                    const iCor = i.cor.toLowerCase();
                    const desc = cDesc.toLowerCase();
                    return iCor === desc || (desc === "única" && iCor === "única") || (desc === "sem cor definida" && iCor === "sem cor definida");
                });
                if (invCor) {
                    estoque = invCor.quantidade || 0;
                }

                // Busca o estoque de cortes no inventario do LocalStorage
                const invCortesForProd = inventarioCortes.filter((i: any) => i.produtoId === prod.id);
                const invCorCorte = invCortesForProd.find((i: any) => {
                    const iCor = i.cor.toLowerCase();
                    const desc = cDesc.toLowerCase();
                    return iCor === desc || (desc === "única" && iCor === "única") || (desc === "sem cor definida" && iCor === "sem cor definida");
                });
                if (invCorCorte) {
                    estoqueCortes = invCorCorte.quantidade || 0;
                }

                const vendas = vendasItens.filter((v: any) => v.produto_id === prod.id);

                vendas.forEach((v: any) => {
                    const vCor = v.cor ? v.cor.trim().toLowerCase() : "";
                    const desc = cDesc.toLowerCase();
                    const cCod = corObj.codigo ? String(corObj.codigo).trim() : "";
                    const cComp = (cCod ? `${cCod} - ${desc}` : desc).toLowerCase();

                    let isMatch = false;
                    if (vCor === desc || vCor === cComp) isMatch = true;
                    else if (v.codigo_cor && cCod && String(v.codigo_cor).trim() === cCod) isMatch = true;
                    else if (desc === "única" || desc === "sem cor definida" || desc === "") isMatch = true;

                    if (isMatch) {
                        const dataEmissao = v.pedidos.data_emissao;
                        const monthStr = dataEmissao ? dataEmissao.substring(0, 7) : "";
                        const qtd = v.quantidade || 0;

                        // Soma para os meses selecionados (vendas passadas)
                        if (monthStr === mes1) m1 += qtd;
                        if (monthStr === mes2) m2 += qtd;
                        if (monthStr === mes3) m3 += qtd;

                        // Pedidos abertos (entregas)
                        if (v.pedidos.status === "VENDA") {
                            totalPedidos += qtd;
                            
                            // Calcula em qual semana cai a data de entrega
                            if (v.pedidos.data_entrega) {
                                const entregaData = parseISO(v.pedidos.data_entrega + "T00:00:00");
                                semanasDoMes.forEach((semana, index) => {
                                    if (isWithinInterval(entregaData, { start: semana.start, end: semana.end })) {
                                        entregasPorSemana[index] += qtd;
                                        pedidosPorSemana[index].push({
                                            numero: v.pedidos.numero,
                                            cliente: v.pedidos.entidade?.nome || "Sem nome",
                                            data_entrega: v.pedidos.data_entrega,
                                            quantidade: qtd
                                        });
                                    }
                                });
                            }
                        }
                    }
                });

                return { m1, m2, m3, totalPedidos, entregasPorSemana, pedidosPorSemana, estoque, estoqueCortes, saldoAposPedidos: estoque - totalPedidos };
            };

            let sumM1 = 0, sumM2 = 0, sumM3 = 0, sumTotalPedidos = 0, sumEstoque = 0, sumEstoqueCortes = 0, sumSaldoAposPedidos = 0;
            const sumEntregasPorSemana = semanasDoMes.map(() => 0);
            const sumPedidosPorSemana = semanasDoMes.map(() => [] as any[]);
            const colorRows: any[] = [];

            cores.forEach((cor: any) => {
                const { m1, m2, m3, totalPedidos, entregasPorSemana, pedidosPorSemana, estoque, estoqueCortes } = getVendas(cor);
                
                // Exibe a cor se tiver vendas nos meses selecionados ou pedidos em aberto.
                // O usuário pediu para puxar o estoque dos produtos que estão em pedido, mesmo que seja zero.
                if (m1 > 0 || m2 > 0 || m3 > 0 || totalPedidos > 0) {
                    sumM1 += m1;
                    sumM2 += m2;
                    sumM3 += m3;
                    sumTotalPedidos += totalPedidos;
                    sumEstoque += estoque;
                    sumEstoqueCortes += estoqueCortes;
                    sumSaldoAposPedidos += (estoque - totalPedidos);
                    entregasPorSemana.forEach((qtd, i) => {
                        sumEntregasPorSemana[i] += qtd;
                        if (pedidosPorSemana[i].length > 0) {
                            sumPedidosPorSemana[i].push(...pedidosPorSemana[i]);
                        }
                    });

                    const mediaVendas = (m1 + m2 + m3) / 3;
                    const necessidadeProducao = estoque - totalPedidos - mediaVendas;

                    colorRows.push({
                        isSummary: false,
                        produtoId: prod.id,
                        codigo: "",
                        produto: "",
                        codCor: cor.codigo || "-",
                        cor: cor.descricao || "-",
                        estoque: totalPedidos > 0 ? estoque : null, // Só exibe estoque se tiver pedido (conforme solicitado "só o estoque dos produtos que está em pedido")
                        estoqueCortes: totalPedidos > 0 ? estoqueCortes : null,
                        m1, m2, m3,
                        mediaVendas,
                        totalPedidos,
                        entregasPorSemana,
                        pedidosPorSemana,
                        saldoAposPedidos: estoque - totalPedidos,
                        necessidadeProducao
                    });
                }
            });

            if (colorRows.length > 0) {
                const mediaVendasSummary = (sumM1 + sumM2 + sumM3) / 3;

                // Verifica quantos das cores tem estoque puxado para o sumário
                const totalCoresComPedido = colorRows.filter(r => r.totalPedidos > 0).length;

                // Linha de sumário do Produto
                result.push({
                    isSummary: true,
                    produtoId: prod.id,
                    codigo: prod.sku || "-",
                    produto: prod.nome,
                    codCor: "",
                    cor: "",
                    estoque: sumEstoque, // Sumário exibe a soma dos estoques exibidos
                    estoqueCortes: sumEstoqueCortes,
                    m1: sumM1,
                    m2: sumM2,
                    m3: sumM3,
                    mediaVendas: mediaVendasSummary,
                    totalPedidos: sumTotalPedidos,
                    entregasPorSemana: sumEntregasPorSemana,
                    pedidosPorSemana: sumPedidosPorSemana,
                    saldoAposPedidos: sumSaldoAposPedidos,
                    necessidadeProducao: sumEstoque - sumTotalPedidos - mediaVendasSummary
                });
                result.push(...colorRows);
            }
        }
        return result;
    }, [produtos, vendasItens, mes1, mes2, mes3, semanasDoMes, inventario]);

    const modalRows = useMemo(() => {
        if (modalSemanaIndex === null) return [];
        
        const result: any[] = [];
        
        data.forEach(row => {
            if (row.isSummary) {
                // Wait, if it's summary, we need to gather all orders across colors for this product!
                const pedidosDaSemana = row.pedidosPorSemana[modalSemanaIndex] || [];
                let filteredPedidos = [...pedidosDaSemana];
                
                if (filtroPedidoModal) {
                    const term = filtroPedidoModal.toLowerCase();
                    filteredPedidos = filteredPedidos.filter((p: any) => 
                        (p.numero && String(p.numero).toLowerCase().includes(term)) || 
                        (p.cliente && String(p.cliente).toLowerCase().includes(term))
                    );
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
                        estoqueCortes: row.estoqueCortes,
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
                    const term = filtroPedidoModal.toLowerCase();
                    filteredPedidos = filteredPedidos.filter((p: any) => 
                        (p.numero && String(p.numero).toLowerCase().includes(term)) || 
                        (p.cliente && String(p.cliente).toLowerCase().includes(term))
                    );
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
                            estoqueCortes: row.estoqueCortes,
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
    }, [data, modalSemanaIndex, filtroPedidoModal]);

    const formatVal = (val: number) => {
        if (!val) return "0";
        return val.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    };

    const handleExportExcel = (tipo: 'resumo' | 'total') => {
        if (!data || data.length === 0) return;

        const filteredData = tipo === 'resumo' ? data.filter(r => r.isSummary) : data;

        const headers = [
            "CÓDIGO", "PRODUTO", "CÓD. COR", "COR", "ESTOQUE", "CORTES", "MÉDIA VENDAS (3 MESES)"
        ];
        
        if (showMonths) {
            headers.push(`Vendas ${format(parseISO(mes1 + "-01"), "MMM/yy", {locale: ptBR})}`);
            headers.push(`Vendas ${format(parseISO(mes2 + "-01"), "MMM/yy", {locale: ptBR})}`);
            headers.push(`Vendas ${format(parseISO(mes3 + "-01"), "MMM/yy", {locale: ptBR})}`);
        }
        
        headers.push("TOTAL EM PEDIDOS");
        
        semanasDoMes.forEach(semana => {
            headers.push(`Pedidos ${format(semana.start, "dd/MM")} a ${format(semana.end, "dd/MM")}`);
        });
        
        headers.push("SALDO APÓS PEDIDOS");
        headers.push("NECESSIDADE PROD.");

        const rows = filteredData.map(row => {
            const r: any = {
                "CÓDIGO": row.codigo,
                "PRODUTO": row.produto,
                "CÓD. COR": row.codCor,
                "COR": row.cor,
                "ESTOQUE": row.estoque !== null ? row.estoque : '',
                "CORTES": row.estoqueCortes !== null ? row.estoqueCortes : '',
                "MÉDIA VENDAS (3 MESES)": row.mediaVendas,
            };
            
            if (showMonths) {
                r[`Vendas ${format(parseISO(mes1 + "-01"), "MMM/yy", {locale: ptBR})}`] = row.m1;
                r[`Vendas ${format(parseISO(mes2 + "-01"), "MMM/yy", {locale: ptBR})}`] = row.m2;
                r[`Vendas ${format(parseISO(mes3 + "-01"), "MMM/yy", {locale: ptBR})}`] = row.m3;
            }
            
            r["TOTAL EM PEDIDOS"] = row.totalPedidos;
            
            semanasDoMes.forEach((semana, idx) => {
                r[`Pedidos ${format(semana.start, "dd/MM")} a ${format(semana.end, "dd/MM")}`] = row.entregasPorSemana[idx];
            });
            
            r["SALDO APÓS PEDIDOS"] = row.saldoAposPedidos;
            r["NECESSIDADE PROD."] = row.necessidadeProducao;
            
            return r;
        });

        const worksheet = XLSX.utils.json_to_sheet(rows, { header: headers });
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Programação Semanal");
        
        XLSX.writeFile(workbook, `programacao-semanal-${tipo}-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
    };

    const handleExportModalPDF = (tipo: 'resumo' | 'total' = 'total') => {
        if (!modalRows || modalRows.length === 0 || modalSemanaIndex === null) return;

        const doc = new jsPDF('landscape');
        
        doc.setFontSize(14);
        const periodo = `${format(semanasDoMes[modalSemanaIndex].start, "dd/MM")} a ${format(semanasDoMes[modalSemanaIndex].end, "dd/MM")}`;
        
        let titulo = `Entregas da Semana (${tipo === 'resumo' ? 'Resumido' : 'Total'}): ${periodo}`;
        if (filtroPedidoModal) {
            titulo += ` - Filtro: ${filtroPedidoModal}`;
        }
        
        const clients = new Set<string>();
        modalRows.forEach(r => {
            if (!r.isSummary && r.cliente && r.cliente !== "Sem nome") {
                clients.add(r.cliente);
            }
        });
        const clientList = Array.from(clients);
        if (clientList.length > 0 && clientList.length <= 4) {
            titulo += ` - Clientes: ${clientList.join(', ')}`;
        } else if (clientList.length > 4) {
            titulo += ` - ${clientList.length} Clientes`;
        }
        
        doc.text(titulo, 14, 15);
        
        const head = tipo === 'resumo' 
            ? [["CÓDIGO", "PRODUTO", "ESTOQUE", "CORTES", "QTD TOTAL", "SALDO"]]
            : [["CÓDIGO", "PRODUTO", "CÓD. COR", "COR", "ESTOQUE", "CORTES", "Nº PEDIDO", "CLIENTE", "ENTREGA", "QTD", "SALDO"]];
        
        const filteredRows = tipo === 'resumo' ? modalRows.filter(r => r.isSummary) : modalRows;
        
        const body = filteredRows.map(r => {
            if (tipo === 'resumo') {
                return [
                    r.codigo || "",
                    r.produto || "",
                    r.estoque !== null ? formatVal(r.estoque) : '',
                    r.estoqueCortes !== null && r.estoqueCortes !== undefined ? formatVal(r.estoqueCortes) : '',
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
                    r.estoqueCortes !== null && r.estoqueCortes !== undefined ? formatVal(r.estoqueCortes) : '',
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
                [tipo === 'resumo' ? 2 : 4]: { halign: 'right' },
                [tipo === 'resumo' ? 3 : 5]: { halign: 'right' },
                [tipo === 'resumo' ? 4 : 9]: { halign: 'right' },
                [tipo === 'resumo' ? 5 : 10]: { halign: 'right' }
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

        doc.save(`entregas-semana-${tipo}-${periodo.replace(/\//g, '-')}.pdf`);
    };

    const handleExportPDF = (tipo: 'resumo' | 'total') => {
        if (!data || data.length === 0) return;

        const filteredData = tipo === 'resumo' ? data.filter(r => r.isSummary) : data;

        const doc = new jsPDF('landscape');
        
        doc.setFontSize(14);
        doc.text(`Programação Semanal (${tipo === 'resumo' ? 'Resumido' : 'Total'}) - ${format(new Date(), "dd/MM/yyyy")}`, 14, 15);
        
        const head = [[
            "CÓDIGO", "PRODUTO", "COR", "EST", "CORTES", "MÉDIA", "TOTAL PED",
            ...semanasDoMes.map(s => `${format(s.start, "dd/MM")} a ${format(s.end, "dd/MM")}`),
            "SALDO", "NEC"
        ]];
        
        const body = filteredData.map(row => {
            return [
                row.codigo || row.codCor,
                row.isSummary ? row.produto : "",
                row.cor,
                row.estoque !== null ? formatVal(row.estoque) : '',
                row.estoqueCortes !== null ? formatVal(row.estoqueCortes) : '',
                formatVal(row.mediaVendas),
                formatVal(row.totalPedidos),
                ...row.entregasPorSemana.map((qtd: number) => formatVal(qtd)),
                formatVal(row.saldoAposPedidos),
                formatVal(row.necessidadeProducao)
            ];
        });

        autoTable(doc, {
            head: head,
            body: body,
            startY: 20,
            theme: 'grid',
            styles: { 
                fontSize: 6, 
                cellPadding: 1,
                lineColor: [220, 220, 220],
                lineWidth: 0.1
            },
            headStyles: { fillColor: [94, 143, 62], fontSize: 6, halign: 'center', textColor: [255, 255, 255] },
            columnStyles: {
                0: { cellWidth: 15 },
                1: { cellWidth: 40 },
                2: { cellWidth: 30 }
            },
            didParseCell: function(d: any) {
                if (d.section === 'body') {
                    if (d.column.index > 2) {
                        d.cell.styles.halign = 'right';
                    }
                    const rowData = body[d.row.index];
                    if (rowData && rowData[1] !== "") {
                        d.cell.styles.fontStyle = 'bold';
                        d.cell.styles.fillColor = [240, 248, 241];
                    }
                }
            }
        });

                                doc.save(`programacao-semanal-${tipo}-${format(new Date(), "yyyy-MM-dd")}.pdf`);
    };

    const isLoading = isLoadingProdutos || isLoadingVendas;

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-800">Programação Semanal</h1>
                    <p className="text-muted-foreground mt-1">
                        Análise de vendas e programação de entregas por semana
                    </p>
                </div>
            </div>
            
            <div ref={fullscreenRef} className={isFullscreen ? "bg-white p-4 h-screen w-screen overflow-hidden flex flex-col" : ""}>
                <Card className={`border-slate-200 shadow-sm overflow-hidden flex flex-col ${isFullscreen ? 'h-full mt-0 flex-1' : 'mt-6'}`}>
                    <div className="bg-slate-50/50 px-5 py-3 border-b border-slate-200 flex justify-between items-center gap-4 flex-wrap shrink-0">
                        <div className="flex items-center gap-2 text-slate-800 font-semibold text-xs uppercase tracking-wide">
                            <Box className="w-4 h-4 text-emerald-600" />
                            Tabela de Programação
                            {isLoading && <Loader2 className="w-3 h-3 ml-2 animate-spin text-muted-foreground" />}
                        </div>
                        
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Mês de Entregas:</span>
                                <input 
                                    type="month" 
                                    value={mesEntregas} 
                                    onChange={e => setMesEntregas(e.target.value)} 
                                    onClick={(e: any) => e.target.showPicker?.()}
                                    className="text-sm font-bold text-slate-700 bg-white border border-slate-300 rounded px-3 py-1 cursor-pointer outline-none hover:border-emerald-400 hover:text-emerald-700 transition-colors shadow-sm" 
                                />
                            </div>
                            <div className="flex gap-1 border-l pl-4 ml-2 border-slate-300">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <button 
                                            className="flex items-center justify-center p-2 rounded-md hover:bg-emerald-100 text-slate-600 transition-colors border border-transparent hover:border-emerald-300"
                                            title="Exportar Excel"
                                        >
                                            <Download className="w-4 h-4 text-emerald-700" />
                                            <span className="text-xs font-bold text-emerald-700 ml-1">XLSX</span>
                                        </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-48">
                                        <DropdownMenuItem onClick={() => handleExportExcel('resumo')} className="cursor-pointer">
                                            Exportar Resumo (Só Produtos)
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleExportExcel('total')} className="cursor-pointer">
                                            Exportar Total (Com Cores)
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>

                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <button 
                                            className="flex items-center justify-center p-2 rounded-md hover:bg-rose-100 text-slate-600 transition-colors border border-transparent hover:border-rose-300"
                                            title="Exportar PDF"
                                        >
                                            <Download className="w-4 h-4 text-rose-700" />
                                            <span className="text-xs font-bold text-rose-700 ml-1">PDF</span>
                                        </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-48">
                                        <DropdownMenuItem onClick={() => handleExportPDF('resumo')} className="cursor-pointer">
                                            Exportar Resumo (Só Produtos)
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleExportPDF('total')} className="cursor-pointer">
                                            Exportar Total (Com Cores)
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>

                                <button 
                                    onClick={toggleFullscreen}
                                    className="flex items-center justify-center p-2 rounded-md hover:bg-slate-200 text-slate-600 transition-colors border border-transparent hover:border-slate-300 ml-2"
                                    title={isFullscreen ? "Sair da Tela Cheia" : "Tela Cheia"}
                                >
                                    {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>
                    </div>
                
                    <ScrollArea className={`w-full flex-1 ${isFullscreen ? 'h-full min-h-0' : 'h-[calc(100vh-220px)] min-h-[400px]'}`} type="always">
                        <Table className="text-[11px] [&_td]:p-2 [&_th]:p-2 min-w-max border-collapse">
                            <TableHeader className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                                <TableRow>
                                    <TableHead className="font-semibold text-slate-600 border-r w-[80px]">CÓDIGO</TableHead>
                                    <TableHead className="font-semibold text-slate-600 border-r min-w-[200px]">PRODUTO</TableHead>
                                    <TableHead className="font-semibold text-slate-600 border-r w-[80px]">CÓD. COR</TableHead>
                                    <TableHead className="font-semibold text-slate-600 border-r min-w-[150px]">COR</TableHead>
                                    <TableHead className="font-semibold text-slate-700 border-r text-center bg-blue-50/50 leading-tight w-[80px]">ESTOQUE</TableHead>
                                    <TableHead className="font-semibold text-amber-700 border-r text-center bg-amber-50/50 leading-tight w-[80px]">CORTES</TableHead>
                                    <TableHead 
                                        className="font-semibold text-slate-700 border-r text-center bg-indigo-50/50 leading-tight min-w-[100px] cursor-pointer hover:bg-indigo-100 transition-colors" 
                                        onClick={() => setShowMonths(!showMonths)}
                                        title="Clique para expandir/ocultar os meses"
                                    >
                                        <div className="flex items-center justify-center gap-1">
                                            MÉDIA VENDAS<br/>(3 MESES)
                                            <span className="text-indigo-600 font-black text-sm ml-1">{showMonths ? "-" : "+"}</span>
                                        </div>
                                    </TableHead>
                                    {showMonths && (
                                        <>
                                            <TableHead className="font-semibold text-slate-600 border-r text-center w-[90px] p-1 align-middle bg-slate-100/50">
                                                <div className="flex flex-col items-center justify-center gap-0.5 w-full h-full">
                                                    <span className="text-[9px] leading-none text-slate-500">VENDAS</span>
                                                    <input 
                                                        type="month" 
                                                        value={mes1} 
                                                        onChange={e => setMes1(e.target.value)} 
                                                        onClick={(e: any) => e.target.showPicker?.()}
                                                        className="text-[10px] font-bold text-slate-600 bg-transparent border-b border-slate-300 border-dashed w-[85px] text-center cursor-pointer outline-none pb-0.5 hover:border-indigo-400 hover:text-indigo-700 transition-colors" 
                                                    />
                                                </div>
                                            </TableHead>
                                            <TableHead className="font-semibold text-slate-600 border-r text-center w-[90px] p-1 align-middle bg-slate-100/50">
                                                <div className="flex flex-col items-center justify-center gap-0.5 w-full h-full">
                                                    <span className="text-[9px] leading-none text-slate-500">VENDAS</span>
                                                    <input 
                                                        type="month" 
                                                        value={mes2} 
                                                        onChange={e => setMes2(e.target.value)} 
                                                        onClick={(e: any) => e.target.showPicker?.()}
                                                        className="text-[10px] font-bold text-slate-600 bg-transparent border-b border-slate-300 border-dashed w-[85px] text-center cursor-pointer outline-none pb-0.5 hover:border-indigo-400 hover:text-indigo-700 transition-colors" 
                                                    />
                                                </div>
                                            </TableHead>
                                            <TableHead className="font-semibold text-slate-600 border-r text-center w-[90px] p-1 align-middle bg-slate-100/50">
                                                <div className="flex flex-col items-center justify-center gap-0.5 w-full h-full">
                                                    <span className="text-[9px] leading-none text-slate-500">VENDAS</span>
                                                    <input 
                                                        type="month" 
                                                        value={mes3} 
                                                        onChange={e => setMes3(e.target.value)} 
                                                        onClick={(e: any) => e.target.showPicker?.()}
                                                        className="text-[10px] font-bold text-slate-600 bg-transparent border-b border-slate-300 border-dashed w-[85px] text-center cursor-pointer outline-none pb-0.5 hover:border-indigo-400 hover:text-indigo-700 transition-colors" 
                                                    />
                                                </div>
                                            </TableHead>
                                        </>
                                    )}
                                    <TableHead className="font-bold text-slate-700 border-r text-center bg-amber-50 leading-tight w-[100px]">TOTAL EM<br/>PEDIDOS</TableHead>
                                    
                                    {/* Colunas de Semanas */}
                                    {semanasDoMes.map((semana, idx) => (
                                        <TableHead 
                                            key={idx} 
                                            className="font-bold text-white text-center bg-[#5e8f3e] hover:bg-[#4c7532] cursor-pointer transition-colors leading-tight w-[120px] border-r border-[#4c7532]"
                                            onClick={() => setModalSemanaIndex(idx)}
                                        >
                                            Pedidos<br/>{format(semana.start, "dd/MM")} a {format(semana.end, "dd/MM")}
                                        </TableHead>
                                    ))}
                                    <TableHead className="font-bold text-slate-700 border-r text-center bg-purple-50 leading-tight w-[100px]">SALDO APÓS<br/>PEDIDOS</TableHead>
                                    <TableHead className="font-bold text-slate-700 border-r text-center bg-pink-50 leading-tight w-[110px]">NECESSIDADE<br/>PROD. (1 MÊS)</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={14 + semanasDoMes.length} className="h-32 text-center text-slate-500">
                                            <div className="flex items-center justify-center">
                                                <Loader2 className="h-6 w-6 animate-spin mr-2" /> Carregando programação...
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : data.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={14 + semanasDoMes.length} className="h-32 text-center text-slate-500">
                                            Nenhum dado encontrado para os filtros atuais.
                                        </TableCell>
                                    </TableRow>
                                ) : data.map((row, idx) => {
                                    if (!row.isSummary && collapsedProducts[row.produtoId]) {
                                        return null;
                                    }
                                    
                                    return row.isSummary ? (
                                        <TableRow key={idx} className="bg-[#f0f8f1] border-b border-[#d8ecd9] font-bold transition-colors">
                                            <TableCell className="border-r border-[#d8ecd9] font-bold text-slate-700 text-xs">
                                                <div 
                                                    className="flex items-center gap-1 cursor-pointer hover:text-emerald-700 transition-colors w-fit"
                                                    onClick={() => toggleProduct(row.produtoId)}
                                                >
                                                    {collapsedProducts[row.produtoId] ? <ChevronRight className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-emerald-600" />}
                                                    {row.codigo}
                                                </div>
                                            </TableCell>
                                            <TableCell className="border-r border-[#d8ecd9] font-bold text-slate-700">{row.produto}</TableCell>
                                            <TableCell className="border-r border-[#d8ecd9]"></TableCell>
                                            <TableCell className="border-r border-[#d8ecd9]"></TableCell>
                                            <TableCell className="border-r border-[#d8ecd9] text-right font-bold text-blue-900 bg-blue-50/50">{row.estoque !== null ? formatVal(row.estoque) : ''}</TableCell>
                                            <TableCell className="border-r border-[#d8ecd9] text-right font-bold text-amber-700 bg-amber-50/50">{row.estoqueCortes !== null ? formatVal(row.estoqueCortes) : ''}</TableCell>
                                            <TableCell className="border-r border-[#d8ecd9] text-right font-bold text-indigo-900 bg-indigo-50/50">{row.mediaVendas ? formatVal(row.mediaVendas) : '0'}</TableCell>
                                            {showMonths && (
                                                <>
                                                    <TableCell className="border-r border-[#d8ecd9] text-right text-slate-500 font-normal bg-slate-100/50">{formatVal(row.m1)}</TableCell>
                                                    <TableCell className="border-r border-[#d8ecd9] text-right text-slate-500 font-normal bg-slate-100/50">{formatVal(row.m2)}</TableCell>
                                                    <TableCell className="border-r border-[#d8ecd9] text-right text-slate-500 font-normal bg-slate-100/50">{formatVal(row.m3)}</TableCell>
                                                </>
                                            )}
                                            <TableCell className="border-r border-[#d8ecd9] text-right font-bold text-amber-900 bg-amber-100/50">{formatVal(row.totalPedidos)}</TableCell>
                                            
                                            {/* Valores das semanas */}
                                            {row.entregasPorSemana.map((qtd: number, i: number) => (
                                                <TableCell 
                                                    key={i} 
                                                    className="border-r border-[#d8ecd9] text-right font-bold text-slate-800 bg-[#e6f3e8]"
                                                >
                                                    {formatVal(qtd)}
                                                </TableCell>
                                            ))}
                                            <TableCell className={`border-r border-[#d8ecd9] text-right font-bold ${row.saldoAposPedidos < 0 ? 'text-red-600 bg-red-50/50' : 'text-purple-900 bg-purple-50/50'}`}>
                                                {row.estoque !== null ? formatVal(row.saldoAposPedidos) : ''}
                                            </TableCell>
                                            <TableCell className={`border-r border-[#d8ecd9] text-right font-bold ${row.necessidadeProducao < 0 ? 'text-rose-700 bg-rose-100/60' : 'text-pink-900 bg-pink-50/50'}`}>
                                                {row.estoque !== null ? formatVal(row.necessidadeProducao) : ''}
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        <TableRow key={idx} className="hover:bg-[#f9fdf9] border-b border-[#ebf5eb]">
                                            <TableCell className="border-r border-[#ebf5eb]"></TableCell>
                                            <TableCell className="border-r border-[#ebf5eb]"></TableCell>
                                            <TableCell className="border-r border-[#ebf5eb] text-indigo-700 font-mono font-medium">{row.codCor}</TableCell>
                                            <TableCell className="border-r border-[#ebf5eb] text-slate-700">{row.cor}</TableCell>
                                            <TableCell className="border-r border-[#ebf5eb] text-right font-bold text-blue-800 bg-blue-50/30">{row.estoque !== null ? formatVal(row.estoque) : '-'}</TableCell>
                                            <TableCell className="border-r border-[#ebf5eb] text-right font-bold text-amber-600 bg-amber-50/10">{row.estoqueCortes !== null ? formatVal(row.estoqueCortes) : '-'}</TableCell>
                                            <TableCell className="border-r border-[#ebf5eb] text-right font-bold text-indigo-800 bg-indigo-50/30">{row.mediaVendas ? formatVal(row.mediaVendas) : '0'}</TableCell>
                                            {showMonths && (
                                                <>
                                                    <TableCell className="border-r border-[#ebf5eb] text-right font-medium text-slate-500 bg-slate-50/50">{formatVal(row.m1)}</TableCell>
                                                    <TableCell className="border-r border-[#ebf5eb] text-right font-medium text-slate-500 bg-slate-50/50">{formatVal(row.m2)}</TableCell>
                                                    <TableCell className="border-r border-[#ebf5eb] text-right font-medium text-slate-500 bg-slate-50/50">{formatVal(row.m3)}</TableCell>
                                                </>
                                            )}
                                            <TableCell className="border-r border-[#ebf5eb] text-right font-bold text-amber-800 bg-amber-50/30">{formatVal(row.totalPedidos)}</TableCell>
                                            
                                            {/* Valores das semanas */}
                                            {row.entregasPorSemana.map((qtd: number, i: number) => (
                                                <TableCell 
                                                    key={i} 
                                                    className="border-r border-[#ebf5eb] text-right font-medium text-slate-700 bg-white"
                                                >
                                                    {formatVal(qtd)}
                                                </TableCell>
                                            ))}
                                            <TableCell className={`border-r border-[#ebf5eb] text-right font-bold ${row.saldoAposPedidos < 0 ? 'text-red-500 bg-red-50/30' : 'text-purple-800 bg-purple-50/30'}`}>
                                                {row.estoque !== null ? formatVal(row.saldoAposPedidos) : '-'}
                                            </TableCell>
                                            <TableCell className={`border-r border-[#ebf5eb] text-right font-bold ${row.necessidadeProducao < 0 ? 'text-rose-600 bg-rose-50/40' : 'text-pink-800 bg-pink-50/30'}`}>
                                                {row.estoque !== null ? formatVal(row.necessidadeProducao) : '-'}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                        <ScrollBar orientation="horizontal" className="top-0 bottom-auto border-t-0 border-b bg-slate-200" />
                        <ScrollBar orientation="horizontal" />
                    </ScrollArea>
                </Card>
            </div>

            <Dialog open={modalSemanaIndex !== null} onOpenChange={(open) => { if (!open) { setModalSemanaIndex(null); setFiltroPedidoModal(""); } }}>
                <DialogContent className="max-w-[95vw] max-h-[90vh] flex flex-col p-0 overflow-hidden">
                    <DialogHeader className="p-6 pb-2 relative">
                        <DialogTitle className="text-xl flex items-center gap-2">
                            <PackageOpen className="w-5 h-5 text-indigo-600" />
                            Entregas da Semana: 
                            <span className="text-indigo-600">
                                {modalSemanaIndex !== null ? `${format(semanasDoMes[modalSemanaIndex].start, "dd/MM")} a ${format(semanasDoMes[modalSemanaIndex].end, "dd/MM")}` : ''}
                            </span>
                        </DialogTitle>
                        <DialogDescription>
                            Visualização geral de todos os produtos com pedidos agendados para esta semana.
                        </DialogDescription>
                        
                        <div className="absolute right-12 top-6 flex items-center gap-4">
                            <div className="flex items-center gap-2 border border-slate-300 rounded-md px-2 py-1.5 bg-white shadow-sm">
                                <Search className="w-4 h-4 text-slate-400" />
                                <input 
                                    type="text" 
                                    placeholder="Cliente ou Pedido..." 
                                    value={filtroPedidoModal}
                                    onChange={e => setFiltroPedidoModal(e.target.value)}
                                    className="text-sm border-none outline-none w-36 bg-transparent text-slate-700 font-medium"
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
                        </div>
                    </DialogHeader>

                    <div className="flex-1 overflow-auto p-6 pt-0">
                        <div className="border rounded-md">
                            <Table className="text-xs">
                                <TableHeader className="bg-slate-100 sticky top-0 z-10">
                                    <TableRow>
                                        <TableHead className="font-bold text-slate-700 w-[80px]">CÓDIGO</TableHead>
                                        <TableHead className="font-bold text-slate-700 w-[250px]">PRODUTO</TableHead>
                                        <TableHead className="font-bold text-slate-700 w-[80px]">CÓD. COR</TableHead>
                                        <TableHead className="font-bold text-slate-700 w-[150px]">COR</TableHead>
                                        <TableHead className="font-bold text-slate-700 w-[80px] text-right">ESTOQUE</TableHead>
                                        <TableHead className="font-bold text-slate-700 w-[100px]">Nº PEDIDO</TableHead>
                                        <TableHead className="font-bold text-slate-700 w-[200px]">CLIENTE</TableHead>
                                        <TableHead className="font-bold text-slate-700 w-[100px]">ENTREGA</TableHead>
                                        <TableHead className="font-bold text-slate-700 w-[80px] text-right">QTD</TableHead>
                                        <TableHead className="font-bold text-slate-700 w-[80px] text-right">SALDO</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {modalRows.map((r, idx) => r.isSummary ? (
                                        <TableRow key={idx} className="bg-[#f0f8f1] border-b border-[#d8ecd9] font-bold">
                                            <TableCell className="border-r border-[#d8ecd9] text-xs">{r.codigo}</TableCell>
                                            <TableCell className="border-r border-[#d8ecd9]">{r.produto}</TableCell>
                                            <TableCell className="border-r border-[#d8ecd9]"></TableCell>
                                            <TableCell className="border-r border-[#d8ecd9]"></TableCell>
                                            <TableCell className="border-r border-[#d8ecd9] text-right text-blue-900 bg-blue-50/50">{r.estoque !== null ? formatVal(r.estoque) : ''}</TableCell>
                                            <TableCell className="border-r border-[#d8ecd9]"></TableCell>
                                            <TableCell className="border-r border-[#d8ecd9]"></TableCell>
                                            <TableCell className="border-r border-[#d8ecd9]"></TableCell>
                                            <TableCell className="border-r border-[#d8ecd9] text-right text-indigo-900 bg-indigo-50/50">{formatVal(r.qtd)}</TableCell>
                                            <TableCell className={`border-r border-[#d8ecd9] text-right ${r.saldo < 0 ? 'text-red-600 bg-red-50/50' : 'text-purple-900 bg-purple-50/50'}`}>
                                                {r.estoque !== null ? formatVal(r.saldo) : ''}
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        <TableRow key={idx} className="hover:bg-slate-50 border-b border-slate-100">
                                            <TableCell className="border-r border-slate-100"></TableCell>
                                            <TableCell className="border-r border-slate-100"></TableCell>
                                            <TableCell className="border-r border-slate-100 text-indigo-700 font-mono text-xs">{r.codCor}</TableCell>
                                            <TableCell className="border-r border-slate-100">{r.cor}</TableCell>
                                            <TableCell className="border-r border-slate-100 text-right text-blue-800 bg-blue-50/30">{r.estoque !== null ? formatVal(r.estoque) : '-'}</TableCell>
                                            <TableCell className="border-r border-slate-100 font-mono text-slate-600 text-xs">{r.pedido}</TableCell>
                                            <TableCell className="border-r border-slate-100 text-sm">{r.cliente}</TableCell>
                                            <TableCell className="border-r border-slate-100 text-xs">{r.data_entrega ? format(parseISO(r.data_entrega + "T00:00:00"), "dd/MM/yyyy") : '-'}</TableCell>
                                            <TableCell className="border-r border-slate-100 text-right font-bold text-indigo-700">{formatVal(r.qtd)}</TableCell>
                                            <TableCell className={`border-r border-slate-100 text-right font-bold ${r.saldo < 0 ? 'text-red-500 bg-red-50/30' : 'text-purple-800 bg-purple-50/30'}`}>
                                                {r.estoque !== null ? formatVal(r.saldo) : '-'}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {modalRows.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={10} className="text-center h-24 text-slate-500 italic">
                                                Nenhum pedido agendado para esta semana.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
