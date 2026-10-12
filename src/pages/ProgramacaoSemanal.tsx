import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Box, Loader2, Maximize, Minimize, ChevronDown, ChevronRight, ChevronUp, PackageOpen, Download, Search } from "lucide-react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useState, useMemo, useRef, useEffect, useCallback } from "react";
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

    // Estado para Estoque e Média
    const [inventario, setInventario] = useState<any[]>([]);
    const [inventarioCortes, setInventarioCortes] = useState<any[]>([]);
    const [inventarioMinimo, setInventarioMinimo] = useState<any[]>([]);
    const [inventarioMedia, setInventarioMedia] = useState<any[]>([]);
    const [faltasUpdate, setFaltasUpdate] = useState(0);
    const [termoPesquisa, setTermoPesquisa] = useState("");

    // Estado para os Produtos Expandidos (inicia vazio para que todas as cores comecem minimizadas)
    const [expandedProducts, setExpandedProducts] = useState<Record<string, boolean>>({});

    const toggleProduct = (produtoId: string) => {
        setExpandedProducts(prev => {
            const current = prev[produtoId] !== undefined ? prev[produtoId] : (termoPesquisa.trim().length > 0);
            return {
                ...prev,
                [produtoId]: !current
            };
        });
    };

    const toggleAllProducts = () => {
        const hasAnyExpanded = Object.values(expandedProducts).some(Boolean);
        if (hasAnyExpanded) {
            setExpandedProducts({});
        } else {
            const all: Record<string, boolean> = {};
            data.forEach(r => {
                if (r.isSummary && r.produtoId) {
                    all[r.produtoId] = true;
                }
            });
            setExpandedProducts(all);
        }
    };

    const [modalSemanaIndex, setModalSemanaIndex] = useState<number | null>(null);
    const [filtroPedidoModal, setFiltroPedidoModal] = useState<string>("");

    const carregarInventarios = useCallback(() => {
        if (!empresaId) return;
        try {
            const stored = localStorage.getItem(`estoque_cores_${empresaId}`);
            if (stored) {
                setInventario(JSON.parse(stored));
            } else {
                setInventario([]);
            }
            const storedCortes = localStorage.getItem(`estoque_cortes_${empresaId}`);
            if (storedCortes) {
                setInventarioCortes(JSON.parse(storedCortes));
            } else {
                setInventarioCortes([]);
            }
            const storedMinimo = localStorage.getItem(`estoque_minimo_${empresaId}`);
            if (storedMinimo) {
                setInventarioMinimo(JSON.parse(storedMinimo));
            } else {
                setInventarioMinimo([]);
            }
            const storedMedia = localStorage.getItem(`media_vendas_3m_${empresaId}`);
            if (storedMedia) {
                setInventarioMedia(JSON.parse(storedMedia));
            } else {
                setInventarioMedia([]);
            }
        } catch (e) {
            console.error("Erro ao carregar estoques na programação:", e);
        }
    }, [empresaId]);

    useEffect(() => {
        carregarInventarios();
        const handleUpdate = () => {
            carregarInventarios();
            setFaltasUpdate(prev => prev + 1);
        };

        window.addEventListener("storage", handleUpdate);
        window.addEventListener("focus", handleUpdate);
        window.addEventListener("estoque_minimo_updated", handleUpdate);
        window.addEventListener("estoque_cores_updated", handleUpdate);
        window.addEventListener("estoque_cortes_updated", handleUpdate);
        window.addEventListener("media_vendas_3m_updated", handleUpdate);

        return () => {
            window.removeEventListener("storage", handleUpdate);
            window.removeEventListener("focus", handleUpdate);
            window.removeEventListener("estoque_minimo_updated", handleUpdate);
            window.removeEventListener("estoque_cores_updated", handleUpdate);
            window.removeEventListener("estoque_cortes_updated", handleUpdate);
            window.removeEventListener("media_vendas_3m_updated", handleUpdate);
        };
    }, [carregarInventarios]);

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
                        estoque,
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
                        id,
                        pedido_id,
                        produto_id,
                        cor,
                        codigo_cor,
                        quantidade,
                        pedidos!inner(id, numero, data_emissao, data_entrega, status, empresa_id, entidade(nome))
                    `)
                    .eq("pedidos.empresa_id", empresaId)
                    .neq("pedidos.status", "Cancelado")
                    .neq("pedidos.status", "FINALIZADO")
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

        // Cache para carregar quantidades faltantes dos pedidos salvos no localStorage
        const faltasCache: Record<string, Record<string, number>> = {};
        const getFaltaDoItem = (pedidoId: string, produtoId: string, itemCor: string, corObjDesc: string, qtdOriginal: number) => {
            if (!pedidoId) return qtdOriginal;
            if (!(pedidoId in faltasCache)) {
                try {
                    const str = localStorage.getItem(`pedido_faltas_${pedidoId}`);
                    faltasCache[pedidoId] = str ? JSON.parse(str) : {};
                } catch (e) {
                    faltasCache[pedidoId] = {};
                }
            }
            const pedidoMap = faltasCache[pedidoId];
            if (!pedidoMap || Object.keys(pedidoMap).length === 0) {
                return qtdOriginal;
            }

            const c1 = itemCor || "";
            const key1 = `${produtoId}_${c1}`;
            if (pedidoMap[key1] !== undefined) {
                return Math.max(0, Number(pedidoMap[key1]));
            }

            if (corObjDesc) {
                const key2 = `${produtoId}_${corObjDesc}`;
                if (pedidoMap[key2] !== undefined) {
                    return Math.max(0, Number(pedidoMap[key2]));
                }
            }

            // Fallback: match case-insensitive / trimmed
            const target1 = c1.trim().toLowerCase();
            const target2 = (corObjDesc || "").trim().toLowerCase();
            const foundKey = Object.keys(pedidoMap).find(k => {
                const parts = k.split("_");
                const pProd = parts[0];
                const pCor = parts.slice(1).join("_").trim().toLowerCase();
                return pProd === String(produtoId) && (pCor === target1 || (target2 && pCor === target2));
            });

            if (foundKey && pedidoMap[foundKey] !== undefined) {
                return Math.max(0, Number(pedidoMap[foundKey]));
            }

            return qtdOriginal;
        };

        const result: any[] = [];

        for (const prod of produtos) {
            // Filtra os inventários correspondentes ao produto (por ID, SKU ou Nome)
            const prodSkuNorm = String(prod.sku || "").trim().toLowerCase();
            const prodNomeNorm = String(prod.nome || "").trim().toLowerCase();

            const isProdMatch = (i: any) => {
                if (i.produtoId && i.produtoId === prod.id) return true;
                if (prodSkuNorm && i.produtoSku && String(i.produtoSku).trim().toLowerCase() === prodSkuNorm) return true;
                if (prodNomeNorm && i.produtoNome && String(i.produtoNome).trim().toLowerCase() === prodNomeNorm) return true;
                return false;
            };

            const invForProd = inventario.filter(isProdMatch);
            const invCortesForProd = inventarioCortes.filter(isProdMatch);
            const invMinimoForProd = inventarioMinimo.filter(isProdMatch);
            const invMediaForProd = inventarioMedia.filter(isProdMatch);

            const totalMinimoCadastrado = invMinimoForProd.reduce((acc: number, item: any) => acc + (Number(item.quantidade) || 0), 0);
            const totalMediaCadastrada = invMediaForProd.reduce((acc: number, item: any) => acc + (Number(item.quantidade) || 0), 0);
            const totalEstoqueCadastrado = invForProd.reduce((acc: number, item: any) => acc + (Number(item.quantidade) || 0), 0) || (prod.estoque || 0);
            const totalCortesCadastrado = invCortesForProd.reduce((acc: number, item: any) => acc + (Number(item.quantidade) || 0), 0);

            // Mapeia todas as cores conhecidas do produto
            const mapCores = new Map<string, { codigo: string; descricao: string }>();

            (prod.produto_cores || []).forEach((c: any) => {
                const desc = (c.descricao || "").trim();
                const cod = (c.codigo || "").trim();
                const key = desc.toUpperCase();
                mapCores.set(key || "SEM COR DEFINIDA", {
                    codigo: cod || "-",
                    descricao: desc || "Sem cor definida"
                });
            });

            // Verifica se uma cor (ou código) já pertence a alguma cor mapeada do produto
            const isCorJaCadastrada = (corDesc: string, corCod?: string) => {
                const descUpper = (corDesc || "").trim().toUpperCase();
                const codLower = (corCod || "").trim().toLowerCase();
                if (!descUpper && !codLower) return true;

                if (descUpper && mapCores.has(descUpper)) return true;

                for (const existing of mapCores.values()) {
                    const exCod = (existing.codigo || "").trim().toLowerCase();
                    const exDesc = (existing.descricao || "").trim().toUpperCase();
                    if (codLower && codLower !== "-" && exCod === codLower) return true;
                    if (descUpper && exCod && exCod === descUpper.toLowerCase()) return true;
                    if (descUpper && exDesc === descUpper) return true;
                }

                if (Array.isArray(prod.produto_cores)) {
                    for (const c of prod.produto_cores) {
                        const cCod = (c.codigo || "").trim().toLowerCase();
                        const cDesc = (c.descricao || "").trim().toUpperCase();
                        if (codLower && codLower !== "-" && cCod === codLower) return true;
                        if (descUpper && cCod && cCod === descUpper.toLowerCase()) return true;
                        if (descUpper && cDesc === descUpper) return true;
                    }
                }
                return false;
            };

            // Adiciona apenas cores extras com descrição válida real (ignora números puros que são códigos, e cores já existentes)
            const addCorValida = (i: any) => {
                const corNome = (i.cor || "").trim();
                const codCor = (i.codigoCor || "").trim();
                const key = corNome.toUpperCase();

                if (!corNome || key === "ÚNICA" || key === "UNICA" || key === "SEM COR DEFINIDA" || key === "-") return;
                if (/^\d+$/.test(corNome)) return; // Códigos numéricos não devem criar linhas fantasmas!
                if (isCorJaCadastrada(corNome, codCor)) return;

                mapCores.set(key, { codigo: codCor || "-", descricao: corNome });
            };

            invMinimoForProd.forEach(addCorValida);
            invForProd.forEach(addCorValida);
            invCortesForProd.forEach(addCorValida);
            invMediaForProd.forEach(addCorValida);

            let cores = Array.from(mapCores.values());
            if (cores.length === 0) {
                cores.push({ codigo: "-", descricao: "Sem cor definida" });
            }

            const matchInvQtd = (invList: any[], corObj: any) => {
                if (!invList || invList.length === 0) return 0;
                if (cores.length === 1 && invList.length === 1) {
                    return Number(invList[0].quantidade) || 0;
                }

                const cDesc = String(corObj.descricao || "").trim().toLowerCase();
                const cCod = String(corObj.codigo || "").trim().toLowerCase();

                const found = invList.find((i: any) => {
                    const iCor = String(i.cor || "").trim().toLowerCase();
                    const iCod = String(i.codigoCor || "").trim().toLowerCase();

                    // Prioridade máxima: código da cor gravado no item bate com o código da cor
                    if (cCod && cCod !== "-" && iCod && iCod === cCod) return true;
                    if (cCod && cCod !== "-" && iCor === cCod) return true;

                    const isSingleI = !iCor || iCor === "única" || iCor === "unica" || iCor === "sem cor definida" || iCor === "-";
                    const isSingleC = !cDesc || cDesc === "única" || cDesc === "unica" || cDesc === "sem cor definida" || cDesc === "-";
                    if (isSingleI && isSingleC) return true;

                    if (iCor === cDesc) return true;

                    if (cCod && cCod !== "-") {
                        if (iCor.startsWith(cCod + " - ") || iCor.startsWith(cCod + "-") || iCor.startsWith(cCod + " ")) {
                            return true;
                        }
                    }

                    if (cDesc && cDesc !== "sem cor definida" && cDesc !== "única" && cDesc !== "unica") {
                        if (iCor.endsWith(" - " + cDesc) || iCor.endsWith("-" + cDesc) || iCor.endsWith(" " + cDesc)) return true;
                        if (iCor.includes(cDesc) || cDesc.includes(iCor)) return true;
                    }

                    return false;
                });

                if (found) {
                    return Number(found.quantidade) || 0;
                }

                if (cores.length === 1) {
                    return invList.reduce((acc, curr) => acc + (Number(curr.quantidade) || 0), 0);
                }

                return 0;
            };

            const getVendas = (corObj: any) => {
                let estoque = matchInvQtd(invForProd, corObj);
                if (estoque === 0 && invForProd.length === 0 && prod.estoque) {
                    estoque = prod.estoque;
                }
                let estoqueCortes = matchInvQtd(invCortesForProd, corObj);
                let estoqueMinimo = matchInvQtd(invMinimoForProd, corObj);
                if (cores.length === 1 && estoqueMinimo === 0 && totalMinimoCadastrado > 0) {
                    estoqueMinimo = totalMinimoCadastrado;
                }
                let mediaVendas = matchInvQtd(invMediaForProd, corObj);
                if (cores.length === 1 && mediaVendas === 0 && totalMediaCadastrada > 0) {
                    mediaVendas = totalMediaCadastrada;
                }

                const entregasPorSemana = semanasDoMes.map(() => 0);
                const pedidosPorSemana = semanasDoMes.map(() => [] as any[]);

                const cDesc = corObj.descricao ? corObj.descricao.trim().toLowerCase() : "";
                const cCod = corObj.codigo ? String(corObj.codigo).trim().toLowerCase() : "";

                const vendas = vendasItens.filter((v: any) => v.produto_id === prod.id);

                vendas.forEach((v: any) => {
                    const vCor = v.cor ? v.cor.trim().toLowerCase() : "";
                    const cComp = (cCod && cCod !== "-" ? `${cCod} - ${cDesc}` : cDesc).toLowerCase();

                    let isMatch = false;
                    if (vCor === cDesc || vCor === cComp) isMatch = true;
                    else if (v.codigo_cor && cCod && cCod !== "-" && String(v.codigo_cor).trim().toLowerCase() === cCod) isMatch = true;
                    else if (cDesc === "única" || cDesc === "unica" || cDesc === "sem cor definida" || cDesc === "") isMatch = true;
                    else if (vCor && cDesc && (vCor.includes(cDesc) || cDesc.includes(vCor))) isMatch = true;

                    if (isMatch) {
                        // Pedidos abertos (entregas) - ignora se estiver Cancelado ou FINALIZADO
                        const statusPed = String(v.pedidos?.status || "").toUpperCase();
                        if (statusPed === "VENDA" && statusPed !== "FINALIZADO" && statusPed !== "CANCELADO") {
                            const pId = v.pedido_id || v.pedidos?.id;
                            const qtd = getFaltaDoItem(pId, v.produto_id, v.cor, corObj.descricao, v.quantidade || 0);
                            
                            // Calcula em qual semana cai a data de entrega (apenas se ainda faltar entregar, qtd > 0)
                            if (qtd > 0 && v.pedidos?.data_entrega) {
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

                const totalPedidos = entregasPorSemana.reduce((acc: number, curr: number) => acc + curr, 0);

                return { totalPedidos, entregasPorSemana, pedidosPorSemana, estoque, estoqueCortes, estoqueMinimo, mediaVendas, saldoAposPedidos: estoque - totalPedidos };
            };

            let sumTotalPedidos = 0, sumEstoque = 0, sumEstoqueCortes = 0, sumEstoqueMinimo = 0, sumMediaVendas = 0, sumSaldoAposPedidos = 0;
            const sumEntregasPorSemana = semanasDoMes.map(() => 0);
            const sumPedidosPorSemana = semanasDoMes.map(() => [] as any[]);
            const colorRows: any[] = [];

            cores.forEach((cor: any) => {
                const { totalPedidos, entregasPorSemana, pedidosPorSemana, estoque, estoqueCortes, estoqueMinimo, mediaVendas } = getVendas(cor);
                
                // Exibe a cor se tiver pedidos em aberto, estoque, cortes, estoque mínimo OU média de vendas cadastrada
                if (totalPedidos > 0 || estoqueMinimo > 0 || estoque > 0 || estoqueCortes > 0 || mediaVendas > 0 || totalMinimoCadastrado > 0 || totalMediaCadastrada > 0) {
                    sumTotalPedidos += totalPedidos;
                    sumEstoque += estoque;
                    sumEstoqueCortes += estoqueCortes;
                    sumEstoqueMinimo += estoqueMinimo;
                    sumMediaVendas += mediaVendas;
                    sumSaldoAposPedidos += (estoque - totalPedidos);
                    entregasPorSemana.forEach((qtd, i) => {
                        sumEntregasPorSemana[i] += qtd;
                        if (pedidosPorSemana[i].length > 0) {
                            sumPedidosPorSemana[i].push(...pedidosPorSemana[i]);
                        }
                    });

                    const necessidadeProducao = (estoque || 0) + (estoqueCortes || 0) - totalPedidos - mediaVendas - (estoqueMinimo || 0);

                    colorRows.push({
                        isSummary: false,
                        produtoId: prod.id,
                        codigo: "",
                        produto: "",
                        codCor: cor.codigo || "-",
                        cor: cor.descricao || "-",
                        estoque: estoque,
                        estoqueCortes: estoqueCortes,
                        mediaVendas: mediaVendas,
                        totalPedidos: totalPedidos,
                        estoqueMinimo: estoqueMinimo,
                        entregasPorSemana,
                        pedidosPorSemana,
                        saldoAposPedidos: estoque - totalPedidos,
                        necessidadeProducao
                    });
                }
            });

            if (colorRows.length > 0) {
                const estoqueSummary = sumEstoque || (cores.length <= 1 ? totalEstoqueCadastrado : 0);
                const cortesSummary = sumEstoqueCortes || (cores.length <= 1 ? totalCortesCadastrado : 0);
                const mediaVendasSummary = sumMediaVendas || (cores.length <= 1 ? totalMediaCadastrada : 0);
                const estoqueMinimoSummary = sumEstoqueMinimo || (cores.length <= 1 ? totalMinimoCadastrado : 0);

                // Linha de sumário do Produto
                result.push({
                    isSummary: true,
                    produtoId: prod.id,
                    codigo: prod.sku || "-",
                    produto: prod.nome,
                    codCor: "",
                    cor: "",
                    estoque: estoqueSummary,
                    estoqueCortes: cortesSummary,
                    mediaVendas: mediaVendasSummary,
                    totalPedidos: sumTotalPedidos,
                    estoqueMinimo: estoqueMinimoSummary,
                    entregasPorSemana: sumEntregasPorSemana,
                    pedidosPorSemana: sumPedidosPorSemana,
                    saldoAposPedidos: sumSaldoAposPedidos,
                    necessidadeProducao: (estoqueSummary || 0) + (cortesSummary || 0) - sumTotalPedidos - mediaVendasSummary - (estoqueMinimoSummary || 0)
                });
                result.push(...colorRows);
            }
        }
        return result;
    }, [produtos, vendasItens, semanasDoMes, inventario, inventarioCortes, inventarioMinimo, inventarioMedia, faltasUpdate]);

    // Filtra dados em tempo real por nome do produto, código, ou cor
    const filteredData = useMemo(() => {
        if (!termoPesquisa.trim()) return data;

        const term = termoPesquisa
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .trim();

        const matchingProdutoIds = new Set<string>();

        data.forEach(r => {
            if (r.isSummary) {
                const nomeNorm = String(r.produto || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
                const codNorm = String(r.codigo || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
                if (nomeNorm.includes(term) || codNorm.includes(term)) {
                    matchingProdutoIds.add(r.produtoId);
                }
            } else {
                const corNorm = String(r.cor || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
                const codCorNorm = String(r.codCor || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
                if (corNorm.includes(term) || codCorNorm.includes(term)) {
                    matchingProdutoIds.add(r.produtoId);
                }
            }
        });

        return data.filter(r => matchingProdutoIds.has(r.produtoId));
    }, [data, termoPesquisa]);

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
        if (!filteredData || filteredData.length === 0) return;

        const exportData = tipo === 'resumo' ? filteredData.filter(r => r.isSummary) : filteredData;

        const headers = [
            "CÓDIGO", "PRODUTO", "CÓD. COR", "COR", "MÉDIA VENDAS (3 MESES)"
        ];
        
        headers.push("TOTAL EM PEDIDOS");
        headers.push("ESTOQUE MÍNIMO");
        
        semanasDoMes.forEach(semana => {
            headers.push(`Pedidos ${format(semana.start, "dd/MM")} a ${format(semana.end, "dd/MM")}`);
        });
        
        headers.push("SALDO APÓS PEDIDOS");
        headers.push("ESTOQUE");
        headers.push("CORTES");
        headers.push("NECESSIDADE PROD.");

        const rows = exportData.map(row => {
            const r: any = {
                "CÓDIGO": row.codigo,
                "PRODUTO": row.produto,
                "CÓD. COR": row.codCor,
                "COR": row.cor,
                "MÉDIA VENDAS (3 MESES)": row.mediaVendas,
            };
            
            r["TOTAL EM PEDIDOS"] = row.totalPedidos;
            r["ESTOQUE MÍNIMO"] = row.estoqueMinimo ?? 0;
            
            semanasDoMes.forEach((semana, idx) => {
                r[`Pedidos ${format(semana.start, "dd/MM")} a ${format(semana.end, "dd/MM")}`] = row.entregasPorSemana[idx];
            });
            
            r["SALDO APÓS PEDIDOS"] = row.saldoAposPedidos;
            r["ESTOQUE"] = row.estoque ?? 0;
            r["CORTES"] = row.estoqueCortes ?? 0;
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
        if (!filteredData || filteredData.length === 0) return;

        const exportData = tipo === 'resumo' ? filteredData.filter(r => r.isSummary) : filteredData;

        const doc = new jsPDF('landscape');
        
        doc.setFontSize(14);
        doc.text(`Programação Semanal (${tipo === 'resumo' ? 'Resumido' : 'Total'}) - ${format(new Date(), "dd/MM/yyyy")}`, 14, 15);
        
        const head = [[
            "CÓDIGO", "PRODUTO", "COR", "MÉDIA", "TOTAL PED", "EST MÍN",
            ...semanasDoMes.map(s => `${format(s.start, "dd/MM")} a ${format(s.end, "dd/MM")}`),
            "SALDO", "EST", "CORTES", "NEC"
        ]];
        
        const body = exportData.map(row => {
            return [
                row.codigo || row.codCor,
                row.isSummary ? row.produto : "",
                row.cor,
                formatVal(row.mediaVendas),
                formatVal(row.totalPedidos),
                formatVal(row.estoqueMinimo),
                ...row.entregasPorSemana.map((qtd: number) => formatVal(qtd)),
                formatVal(row.saldoAposPedidos),
                formatVal(row.estoque),
                formatVal(row.estoqueCortes),
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
                        <div className="flex items-center gap-3 flex-wrap">
                            <div className="flex items-center gap-2 text-slate-800 font-semibold text-xs uppercase tracking-wide">
                                <Box className="w-4 h-4 text-emerald-600" />
                                Tabela de Programação
                                {isLoading && <Loader2 className="w-3 h-3 ml-2 animate-spin text-muted-foreground" />}
                            </div>

                            <button
                                onClick={toggleAllProducts}
                                className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded border border-slate-300 hover:bg-slate-100 text-slate-700 transition-colors shadow-sm bg-white"
                                title={Object.values(expandedProducts).some(Boolean) ? "Recolher todas as cores" : "Expandir todas as cores"}
                            >
                                {Object.values(expandedProducts).some(Boolean) ? (
                                    <>
                                        <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
                                        <span>Recolher Cores</span>
                                    </>
                                ) : (
                                    <>
                                        <ChevronDown className="w-3.5 h-3.5 text-emerald-600" />
                                        <span>Expandir Cores</span>
                                    </>
                                )}
                            </button>

                            {/* Campo de Busca em Tempo Real */}
                            <div className="relative flex items-center min-w-[210px] sm:min-w-[280px]">
                                <Search className="w-3.5 h-3.5 absolute left-2.5 text-slate-400 pointer-events-none" />
                                <input 
                                    type="text"
                                    value={termoPesquisa}
                                    onChange={e => setTermoPesquisa(e.target.value)}
                                    placeholder="Pesquisar produto ou código..."
                                    className="w-full text-xs pl-8 pr-7 py-1 bg-white border border-slate-300 rounded hover:border-emerald-400 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-500 shadow-sm outline-none transition-all text-slate-700 font-medium placeholder:text-slate-400"
                                />
                                {termoPesquisa && (
                                    <button
                                        onClick={() => setTermoPesquisa("")}
                                        className="absolute right-2 text-slate-400 hover:text-slate-700 text-xs font-bold leading-none p-0.5 rounded-full hover:bg-slate-100"
                                        title="Limpar pesquisa"
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>
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
                                    <TableHead className="font-semibold text-slate-700 border-r text-center bg-indigo-50/50 leading-tight w-[95px]">
                                        MÉDIA VENDAS<br/>(3 MESES)
                                    </TableHead>
                                    <TableHead className="font-bold text-slate-700 border-r text-center bg-amber-50 leading-tight w-[100px]">TOTAL EM<br/>PEDIDOS</TableHead>
                                    <TableHead className="font-bold text-slate-700 border-r text-center bg-teal-50/70 leading-tight w-[90px]">ESTOQUE<br/>MÍNIMO</TableHead>
                                    
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
                                    <TableHead className="font-semibold text-slate-700 border-r text-center bg-blue-50/50 leading-tight w-[80px]">ESTOQUE</TableHead>
                                    <TableHead className="font-semibold text-amber-700 border-r text-center bg-amber-50/50 leading-tight w-[80px]">CORTES</TableHead>
                                    <TableHead className="font-bold text-slate-700 border-r text-center bg-pink-50 leading-tight w-[110px]">NECESSIDADE<br/>PROD. (1 MÊS)</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={11 + semanasDoMes.length} className="h-32 text-center text-slate-500">
                                            <div className="flex items-center justify-center">
                                                <Loader2 className="h-6 w-6 animate-spin mr-2" /> Carregando programação...
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : filteredData.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={11 + semanasDoMes.length} className="h-32 text-center text-slate-500">
                                            {termoPesquisa ? `Nenhum produto encontrado para "${termoPesquisa}".` : "Nenhum dado encontrado para os filtros atuais."}
                                        </TableCell>
                                    </TableRow>
                                ) : filteredData.map((row, idx) => {
                                    const isExpanded = expandedProducts[row.produtoId] !== undefined
                                        ? expandedProducts[row.produtoId]
                                        : (termoPesquisa.trim().length > 0);

                                    if (!row.isSummary && !isExpanded) {
                                        return null;
                                    }
                                    
                                    return row.isSummary ? (
                                        <TableRow 
                                            key={idx} 
                                            className="bg-[#f0f8f1] border-b border-[#d8ecd9] font-bold transition-colors hover:bg-[#e4f3e6] cursor-pointer select-none"
                                            onClick={() => toggleProduct(row.produtoId)}
                                        >
                                            <TableCell className="border-r border-[#d8ecd9] font-bold text-slate-700 text-xs">
                                                <div 
                                                    className="flex items-center gap-1 w-fit"
                                                >
                                                    {isExpanded ? <ChevronDown className="w-4 h-4 text-emerald-600" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
                                                    {row.codigo}
                                                </div>
                                            </TableCell>
                                            <TableCell className="border-r border-[#d8ecd9] font-bold text-slate-700">{row.produto}</TableCell>
                                            <TableCell className="border-r border-[#d8ecd9]"></TableCell>
                                            <TableCell className="border-r border-[#d8ecd9]"></TableCell>
                                            <TableCell className="border-r border-[#d8ecd9] text-right font-bold text-indigo-900 bg-indigo-50/50">{formatVal(row.mediaVendas)}</TableCell>
                                            <TableCell className="border-r border-[#d8ecd9] text-right font-bold text-amber-900 bg-amber-100/50">{formatVal(row.totalPedidos)}</TableCell>
                                            <TableCell className="border-r border-[#d8ecd9] text-right font-bold text-teal-900 bg-teal-50/40">{formatVal(row.estoqueMinimo)}</TableCell>
                                            
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
                                                {formatVal(row.saldoAposPedidos)}
                                            </TableCell>
                                            <TableCell className="border-r border-[#d8ecd9] text-right font-bold text-blue-900 bg-blue-50/50">{formatVal(row.estoque)}</TableCell>
                                            <TableCell className="border-r border-[#d8ecd9] text-right font-bold text-amber-700 bg-amber-50/50">{formatVal(row.estoqueCortes)}</TableCell>
                                            <TableCell className={`border-r border-[#d8ecd9] text-right font-bold ${row.necessidadeProducao < 0 ? 'text-rose-700 bg-rose-100/60' : 'text-pink-900 bg-pink-50/50'}`}>
                                                {formatVal(row.necessidadeProducao)}
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        <TableRow key={idx} className="hover:bg-[#f9fdf9] border-b border-[#ebf5eb]">
                                            <TableCell className="border-r border-[#ebf5eb]"></TableCell>
                                            <TableCell className="border-r border-[#ebf5eb]"></TableCell>
                                            <TableCell className="border-r border-[#ebf5eb] text-indigo-700 font-mono font-medium">{row.codCor}</TableCell>
                                            <TableCell className="border-r border-[#ebf5eb] text-slate-700">{row.cor}</TableCell>
                                            <TableCell className="border-r border-[#ebf5eb] text-right font-bold text-indigo-800 bg-indigo-50/30">{formatVal(row.mediaVendas)}</TableCell>
                                            <TableCell className="border-r border-[#ebf5eb] text-right font-bold text-amber-800 bg-amber-50/30">{formatVal(row.totalPedidos)}</TableCell>
                                            <TableCell className="border-r border-[#ebf5eb] text-right font-medium text-teal-800 bg-teal-50/20">{formatVal(row.estoqueMinimo)}</TableCell>
                                            
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
                                                {formatVal(row.saldoAposPedidos)}
                                            </TableCell>
                                            <TableCell className="border-r border-[#ebf5eb] text-right font-bold text-blue-800 bg-blue-50/30">{formatVal(row.estoque)}</TableCell>
                                            <TableCell className="border-r border-[#ebf5eb] text-right font-bold text-amber-600 bg-amber-50/10">{formatVal(row.estoqueCortes)}</TableCell>
                                            <TableCell className={`border-r border-[#ebf5eb] text-right font-bold ${row.necessidadeProducao < 0 ? 'text-rose-600 bg-rose-50/40' : 'text-pink-800 bg-pink-50/30'}`}>
                                                {formatVal(row.necessidadeProducao)}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                        <ScrollBar orientation="horizontal" className="top-0 bottom-auto border-t-0 border-b bg-slate-200" />
                        <ScrollBar orientation="horizontal" />
                        <ScrollBar orientation="vertical" className="bg-slate-200" />
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
