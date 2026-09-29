import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Box, Loader2 } from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresaId } from "@/hooks/useEmpresaId";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { format, subMonths } from "date-fns";

export function ProgramacaoMalha() {
    const empresaId = useEmpresaId();
    const [selectedGroup, setSelectedGroup] = useState<string>("");

    const [mes1, setMes1] = useState(() => format(subMonths(new Date(), 2), 'yyyy-MM'));
    const [mes2, setMes2] = useState(() => format(subMonths(new Date(), 1), 'yyyy-MM'));
    const [mes3, setMes3] = useState(() => format(new Date(), 'yyyy-MM'));
    const [showMonths, setShowMonths] = useState(false);
    const [showTerceiros, setShowTerceiros] = useState(false);

    const { data: vendasItens, isLoading: isLoadingVendas } = useQuery({
        queryKey: ["vendas-programacao", empresaId, mes1, mes2, mes3],
        enabled: !!empresaId,
        queryFn: async () => {
            const getStr = (m: string) => m + '-01T00:00:00';
            const startDate = new Date(Math.min(
                new Date(getStr(mes1)).getTime(), 
                new Date(getStr(mes2)).getTime(), 
                new Date(getStr(mes3)).getTime()
            )).toISOString().split('T')[0];

            const maxDate = new Date(Math.max(
                new Date(getStr(mes1)).getTime(), 
                new Date(getStr(mes2)).getTime(), 
                new Date(getStr(mes3)).getTime()
            ));
            maxDate.setMonth(maxDate.getMonth() + 1);
            maxDate.setDate(0); 
            const endDate = maxDate.toISOString().split('T')[0];

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
                        pedidos!inner(data_emissao, status, empresa_id)
                    `)
                    .eq("pedidos.empresa_id", empresaId)
                    .neq("pedidos.status", "Cancelado")
                    .gte("pedidos.data_emissao", startDate)
                    .lte("pedidos.data_emissao", endDate)
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

    const { data: materiaisComCores, isLoading } = useQuery({
        queryKey: ["materiais_com_cores_programacao", empresaId],
        enabled: !!empresaId,
        queryFn: async () => {
            const { data, error } = await supabase
                .from("materiais")
                .select(`
                    id,
                    nome,
                    codigo,
                    grupo,
                    materiais_cores (
                        id,
                        nome,
                        codigo
                    )
                `)
                .eq("empresa_id", empresaId)
                .order("nome");
            if (error) throw error;
            return data;
        }
    });

    const [estoqueCores, setEstoqueCores] = useState<any[]>([]);
    const [refresh, setRefresh] = useState(0);

    useEffect(() => {
        const handleFocus = () => setRefresh(r => r + 1);
        window.addEventListener('focus', handleFocus);
        return () => window.removeEventListener('focus', handleFocus);
    }, []);

    useEffect(() => {
        if (empresaId) {
            const stored = localStorage.getItem(`estoque_cores_${empresaId}`);
            if (stored) {
                try {
                    setEstoqueCores(JSON.parse(stored));
                } catch (e) {
                    console.error("Erro ao parsear estoque_cores", e);
                }
            }
        }
    }, [empresaId]);

    const { data: entidades } = useQuery({
        queryKey: ["entidades-terceirizadas", empresaId],
        queryFn: async () => {
            if (!empresaId) return [];
            const { data, error } = await supabase
                .from("entidade")
                .select("id, nome")
                .eq("empresa_id", empresaId)
                .eq("tipo", "terceirizado")
                .order("nome");
            if (error) throw error;
            return data;
        },
        enabled: !!empresaId,
    });

    const { data: estoqueGlobal } = useQuery({
        queryKey: ["estoque-global-terceirizacao", empresaId],
        queryFn: async () => {
            if (!empresaId) return {};
            const { data, error } = await supabase
                .from("movimentacoes_terceiros")
                .select("entidade_origem_id, entidade_destino_id, material_origem_id, material_destino_id, quantidade, cor_origem, cor_destino")
                .eq("empresa_id", empresaId);
                
            if (error) throw error;
            
            const saldos: Record<string, Record<string, Record<string, number>>> = {};
            
            const safeAdd = (matId: string, cor: string, entId: string | null, qtd: number) => {
                const companyKey = entId || "MINHA_EMPRESA";
                const corKey = cor || "Única";
                if (!saldos[matId]) saldos[matId] = {};
                if (!saldos[matId][corKey]) saldos[matId][corKey] = {};
                saldos[matId][corKey][companyKey] = (saldos[matId][corKey][companyKey] || 0) + qtd;
            };

            data?.forEach(mov => {
                const qtd = Number(mov.quantidade);
                if (mov.material_origem_id) {
                    safeAdd(mov.material_origem_id, mov.cor_origem || "Única", mov.entidade_origem_id, -qtd);
                }
                if (mov.material_destino_id) {
                    safeAdd(mov.material_destino_id, mov.cor_destino || "Única", mov.entidade_destino_id, qtd);
                }
            });

            return saldos;
        },
        enabled: !!empresaId,
    });

    const { data: produtosComMateriais } = useQuery({
        queryKey: ["produtos-estoque", empresaId],
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
                        produto_materiais (
                            consumo_padrao,
                            material:materiais(nome, unidade_medida, codigo)
                        )
                    `)
                    .eq("empresa_id", empresaId)
                    .eq("ativo", true)
                    .order("nome")
                    .range(page * pageSize, (page + 1) * pageSize - 1);

                if (error) throw error;

                if (data) {
                    allData = [...allData, ...data];
                    if (data.length < pageSize) {
                        hasMore = false;
                    } else {
                        page++;
                    }
                } else {
                    hasMore = false;
                }
            }
            return allData;
        }
    });

    const groups = useMemo(() => {
        if (!materiaisComCores) return [];
        const grps = new Set(materiaisComCores.map((m: any) => m.grupo).filter(Boolean));
        const arr = Array.from(grps).sort() as string[];
        // Auto-select first group if none selected
        if (!selectedGroup && arr.length > 0) {
            setSelectedGroup(arr[0]);
        }
        return arr;
    }, [materiaisComCores, selectedGroup]);

    const data = useMemo(() => {
        if (!materiaisComCores || !selectedGroup) return [];
        const filtered = materiaisComCores.filter((m: any) => m.grupo === selectedGroup);
        
        const normalize = (s: string) => s ? s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, ' ').trim() : "";
        const stored = localStorage.getItem(`estoque_cores_${empresaId}`);
        const freshEstoqueCores = stored ? JSON.parse(stored) : [];

        const storedMateriais = localStorage.getItem(`estoque_materiais_cores_${empresaId}`);
        const freshEstoqueMateriais = storedMateriais ? JSON.parse(storedMateriais) : [];

        const result: any[] = [];
        
        for (const mat of filtered) {
            const produtosVinculados = produtosComMateriais?.filter((p: any) => 
                p.produto_materiais?.some((pm: any) => pm.material?.codigo === mat.codigo)
            ) || [];

            const getVendasForMatCor = (matCor: string) => {
                let m1 = 0; let m2 = 0; let m3 = 0;
                const vendas = vendasItens?.filter((v: any) => produtosVinculados.some((pv: any) => pv.id === v.produto_id)) || [];
                
                vendas.forEach((v: any) => {
                    const vCor = v.cor ? v.cor.trim().toLowerCase() : "";
                    
                    let isMatch = false;
                    if (vCor === matCor) isMatch = true;
                    else if (matCor === "única" || matCor === "sem cor definida" || matCor === "") isMatch = true;

                    if (isMatch) {
                        const prod = produtosVinculados.find((pv: any) => pv.id === v.produto_id);
                        if (prod) {
                            const relacao = prod.produto_materiais.find((pm: any) => pm.material?.codigo === mat.codigo);
                            let consumo = relacao?.consumo_padrao || 0;
                            if (typeof consumo === 'string') consumo = Number(consumo.replace(',', '.'));
                            if (isNaN(consumo)) consumo = 0;

                            if (consumo > 0) {
                                const dataEmissao = v.pedidos.data_emissao;
                                const monthStr = dataEmissao.substring(0, 7);
                                const consumed = v.quantidade * consumo;

                                if (monthStr === mes1) m1 += consumed;
                                if (monthStr === mes2) m2 += consumed;
                                if (monthStr === mes3) m3 += consumed;
                            }
                        }
                    }
                });
                return { m1, m2, m3 };
            };

            if (!mat.materiais_cores || mat.materiais_cores.length === 0) {
                 let estoqueAtualCalculado = 0;
                 let estoqueMaterialAtual = 0;

                 const { m1, m2, m3 } = getVendasForMatCor("");

                 produtosVinculados.forEach((prod: any) => {
                     const relacao = prod.produto_materiais.find((pm: any) => pm.material?.codigo === mat.codigo);
                     let consumo = relacao?.consumo_padrao || 0;
                     if (typeof consumo === 'string') {
                         consumo = Number(consumo.replace(',', '.'));
                     }
                     if (isNaN(consumo)) consumo = 0;

                     if (consumo > 0) {
                         const corEstoqueList = freshEstoqueCores.filter((ec: any) => ec.produtoId === prod.id);
                         const totalProdEstoque = corEstoqueList.reduce((acc: any, ec: any) => acc + ec.quantidade, 0);
                         estoqueAtualCalculado += totalProdEstoque * consumo;
                     }
                 });

                 // Find material stock for "única" color
                 const materialStockItem = freshEstoqueMateriais.find((em: any) => {
                     if (String(em.materialCodigo) !== String(mat.codigo)) return false;
                     const emCor = em.cor ? em.cor.trim().toLowerCase() : "";
                     return emCor === "única" || emCor === "sem cor definida" || emCor === "unica";
                 });
                 if (materialStockItem) {
                     estoqueMaterialAtual = materialStockItem.quantidade;
                 }

                 const terceirosSaldos: Record<string, number> = {};
                 if (estoqueGlobal && estoqueGlobal[mat.id]) {
                     const corKey = Object.keys(estoqueGlobal[mat.id]).find(k => {
                         const kl = k.trim().toLowerCase();
                         return kl === "única" || kl === "sem cor definida" || kl === "unica";
                     });
                     if (corKey) {
                         entidades?.forEach((ent: any) => {
                             terceirosSaldos[ent.id] = estoqueGlobal[mat.id][corKey][ent.id] || 0;
                         });
                     }
                 }

                 const totalTerceiros = entidades?.reduce((acc: any, ent: any) => acc + (terceirosSaldos[ent.id] || 0), 0) || 0;
                 const mediaVendas = (m1 + m2 + m3) / 3;
                 const saldo = mediaVendas - estoqueAtualCalculado - estoqueMaterialAtual - totalTerceiros;

                 result.push({
                    isSummary: true,
                    codigoMaterial: mat.codigo || "-",
                    materiaPrima: mat.nome,
                    codCor: "-",
                    cor: "Sem cor",
                    naturezaCor: "-",
                    necMes1: m1,
                    necMes2: m2,
                    necMes3: m3,
                    mediaVendas,
                    estoqueAtual: estoqueAtualCalculado,
                    estoqueMaterial: estoqueMaterialAtual,
                    terceirosSaldos,
                    emProcesso: 0, saldo
                 });
            } else {
                let sumM1 = 0, sumM2 = 0, sumM3 = 0, sumEstProduto = 0, sumEstMaterial = 0;
                const colorRows: any[] = [];
                
                mat.materiais_cores.forEach((cor: any) => {
                    let estoqueAtualCalculado = 0;
                    
                    const matCorNormal = cor.nome ? cor.nome.trim().toLowerCase() : "";
                    const { m1, m2, m3 } = getVendasForMatCor(matCorNormal);

                    produtosVinculados.forEach((prod: any) => {
                        const relacao = prod.produto_materiais.find((pm: any) => pm.material?.codigo === mat.codigo);
                        let consumo = relacao?.consumo_padrao || 0;
                        if (typeof consumo === 'string') {
                            consumo = Number(consumo.replace(',', '.'));
                        }
                        if (isNaN(consumo)) consumo = 0;
                        
                        if (consumo > 0) {
                            const corEstoqueList = freshEstoqueCores.filter((ec: any) => ec.produtoId === prod.id);
                            
                            const matchedStocks = corEstoqueList.filter((ec: any) => {
                                const ecCor = ec.cor ? ec.cor.trim().toLowerCase() : "";
                                const matCor = cor.nome ? cor.nome.trim().toLowerCase() : "";
                                const matCorCompleta = (cor.codigo ? `${cor.codigo} - ${cor.nome}` : cor.nome).trim().toLowerCase();
                                if (ecCor === matCor || ecCor === matCorCompleta) return true;
                                if (ecCor === "única" || ecCor === "sem cor definida") return true;
                                return false;
                            });

                            if (matchedStocks.length > 0) {
                                const totalMatched = matchedStocks.reduce((acc: any, ms: any) => acc + ms.quantidade, 0);
                                estoqueAtualCalculado += totalMatched * consumo;
                            }
                        }
                    });

                    // Find material stock for specific color
                    let estoqueMaterialAtual = 0;
                    const materialStockItem = freshEstoqueMateriais.find((em: any) => {
                        if (String(em.materialCodigo) !== String(mat.codigo)) return false;
                        const emCor = em.cor ? em.cor.trim().toLowerCase() : "";
                        const matCor = cor.nome ? cor.nome.trim().toLowerCase() : "";
                        const matCorCompleta = (cor.codigo ? `${cor.codigo} - ${cor.nome}` : cor.nome).trim().toLowerCase();
                        return emCor === matCor || emCor === matCorCompleta;
                    });
                    if (materialStockItem) {
                        estoqueMaterialAtual = materialStockItem.quantidade;
                    }

                    sumM1 += m1;
                    sumM2 += m2;
                    sumM3 += m3;
                    sumEstProduto += estoqueAtualCalculado;
                    sumEstMaterial += estoqueMaterialAtual;

                    const terceirosSaldos: Record<string, number> = {};
                    if (estoqueGlobal && estoqueGlobal[mat.id]) {
                        const corCompleta = cor.codigo ? `${cor.codigo} - ${cor.nome}` : cor.nome;
                        const matCorCompleta = corCompleta.trim().toLowerCase();
                        
                        const corKey = Object.keys(estoqueGlobal[mat.id]).find(k => {
                            const kl = k.trim().toLowerCase();
                            return kl === matCorNormal || kl === matCorCompleta;
                        });
                        if (corKey) {
                            entidades?.forEach((ent: any) => {
                                terceirosSaldos[ent.id] = estoqueGlobal[mat.id][corKey][ent.id] || 0;
                            });
                        }
                    }

                    const totalTerceiros = entidades?.reduce((acc: any, ent: any) => acc + (terceirosSaldos[ent.id] || 0), 0) || 0;
                    const mediaVendas = (m1 + m2 + m3) / 3;
                    const saldo = mediaVendas - estoqueAtualCalculado - estoqueMaterialAtual - totalTerceiros;

                    colorRows.push({
                        isSummary: false,
                        codigoMaterial: "",
                        materiaPrima: "",
                        codCor: cor.codigo || "-",
                        cor: cor.nome || "-",
                        naturezaCor: "FUNDO (estampado)", // Placeholder
                        necMes1: m1,
                        necMes2: m2,
                        necMes3: m3,
                        mediaVendas,
                        estoqueAtual: estoqueAtualCalculado,
                        estoqueMaterial: estoqueMaterialAtual,
                        terceirosSaldos,
                        emProcesso: 0, saldo
                    });
                });
                
                const sumTerceiros: Record<string, number> = {};
                colorRows.forEach(cr => {
                    entidades?.forEach((ent: any) => {
                        sumTerceiros[ent.id] = (sumTerceiros[ent.id] || 0) + (cr.terceirosSaldos[ent.id] || 0);
                    });
                });

                const totalTerceirosSummary = entidades?.reduce((acc: any, ent: any) => acc + (sumTerceiros[ent.id] || 0), 0) || 0;
                const mediaVendasSummary = (sumM1 + sumM2 + sumM3) / 3;
                const saldoSummary = mediaVendasSummary - sumEstProduto - sumEstMaterial - totalTerceirosSummary;

                result.push({
                    isSummary: true,
                    codigoMaterial: mat.codigo || "-",
                    materiaPrima: mat.nome,
                    codCor: "",
                    cor: "",
                    naturezaCor: "",
                    necMes1: sumM1,
                    necMes2: sumM2,
                    necMes3: sumM3,
                    mediaVendas: mediaVendasSummary,
                    estoqueAtual: sumEstProduto,
                    estoqueMaterial: sumEstMaterial,
                    terceirosSaldos: sumTerceiros,
                    emProcesso: 0, saldo: saldoSummary
                });
                result.push(...colorRows);
            }
        }
        return result;
    }, [materiaisComCores, selectedGroup, produtosComMateriais, empresaId, refresh, vendasItens, mes1, mes2, mes3, entidades, estoqueGlobal]);


    const formatKg = (val: number) => {
        if (!val) return "-";
        return val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    return (
        <Card className="border-slate-200 shadow-sm overflow-hidden mt-6">
            <div className="bg-slate-50/50 px-5 py-3 border-b border-slate-200 flex flex-wrap gap-4 justify-between items-center">
                <div className="flex items-center gap-2 text-slate-800 font-semibold text-xs">
                    <Box className="w-4 h-4 text-blue-600" />
                    Programação de Malha
                    {isLoadingVendas && <Loader2 className="w-3 h-3 ml-2 animate-spin text-muted-foreground" />}
                </div>
                
                    <div className="flex items-center gap-2">
                        <Label className="text-xs text-slate-500">Grupo:</Label>
                    <Select value={selectedGroup} onValueChange={setSelectedGroup} disabled={isLoading}>
                        <SelectTrigger className="w-[200px] h-8 text-xs bg-white">
                            <SelectValue placeholder="Selecione um grupo" />
                        </SelectTrigger>
                        <SelectContent>
                            {groups.map(g => (
                                <SelectItem key={g} value={g}>{g}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>
        
        <ScrollArea className="w-full h-[calc(100vh-220px)] min-h-[400px]" type="always">
                <Table className="text-[11px] [&_td]:p-2 [&_th]:p-2 min-w-max border-collapse">
                    <TableHeader className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                        <TableRow>
                            <TableHead className="font-semibold text-slate-600 border-r w-[80px]">CÓDIGO</TableHead>
                            <TableHead className="font-semibold text-slate-600 border-r">MATERIA PRIMA</TableHead>
                            <TableHead className="font-semibold text-slate-600 border-r">CÓD. COR</TableHead>
                            <TableHead className="font-semibold text-slate-600 border-r min-w-[150px]">COR</TableHead>
                            <TableHead 
                                className="font-semibold text-slate-700 border-r text-center bg-blue-50/50 leading-tight min-w-[100px] cursor-pointer hover:bg-blue-100 transition-colors" 
                                onClick={() => setShowMonths(!showMonths)}
                                title="Clique para expandir/ocultar os meses"
                            >
                                <div className="flex items-center justify-center gap-1">
                                    MÉDIA VENDAS<br/>(3 MESES)
                                    <span className="text-blue-600 font-black text-sm ml-1">{showMonths ? "-" : "+"}</span>
                                </div>
                            </TableHead>
                            {showMonths && (
                                <>
                                    <TableHead className="font-semibold text-slate-600 border-r text-center w-[90px] p-1 align-middle bg-slate-100/50">
                                        <div className="flex flex-col items-center justify-center gap-0.5 w-full h-full">
                                            <span className="text-[9px] leading-none text-slate-500">VENDAS (KG)</span>
                                            <input 
                                                type="month" 
                                                value={mes1} 
                                                onChange={e => setMes1(e.target.value)} 
                                                onClick={(e: any) => e.target.showPicker?.()}
                                                className="text-[10px] font-bold text-slate-600 bg-transparent border-b border-slate-300 border-dashed w-[85px] text-center cursor-pointer outline-none pb-0.5 hover:border-blue-400 hover:text-blue-700 transition-colors" 
                                            />
                                        </div>
                                    </TableHead>
                                    <TableHead className="font-semibold text-slate-600 border-r text-center w-[90px] p-1 align-middle bg-slate-100/50">
                                        <div className="flex flex-col items-center justify-center gap-0.5 w-full h-full">
                                            <span className="text-[9px] leading-none text-slate-500">VENDAS (KG)</span>
                                            <input 
                                                type="month" 
                                                value={mes2} 
                                                onChange={e => setMes2(e.target.value)} 
                                                onClick={(e: any) => e.target.showPicker?.()}
                                                className="text-[10px] font-bold text-slate-600 bg-transparent border-b border-slate-300 border-dashed w-[85px] text-center cursor-pointer outline-none pb-0.5 hover:border-blue-400 hover:text-blue-700 transition-colors" 
                                            />
                                        </div>
                                    </TableHead>
                                    <TableHead className="font-semibold text-slate-600 border-r text-center w-[90px] p-1 align-middle bg-slate-100/50">
                                        <div className="flex flex-col items-center justify-center gap-0.5 w-full h-full">
                                            <span className="text-[9px] leading-none text-slate-500">VENDAS (KG)</span>
                                            <input 
                                                type="month" 
                                                value={mes3} 
                                                onChange={e => setMes3(e.target.value)} 
                                                onClick={(e: any) => e.target.showPicker?.()}
                                                className="text-[10px] font-bold text-slate-600 bg-transparent border-b border-slate-300 border-dashed w-[85px] text-center cursor-pointer outline-none pb-0.5 hover:border-blue-400 hover:text-blue-700 transition-colors" 
                                            />
                                        </div>
                                    </TableHead>
                                </>
                            )}
                            <TableHead className="font-semibold text-slate-600 border-r text-center leading-tight">ESTOQUE<br/>PRODUTO (KG)</TableHead>
                            <TableHead className="font-semibold text-slate-600 border-r text-center leading-tight">ESTOQUE<br/>MATERIAL (KG)</TableHead>
                            <TableHead 
                                className="font-semibold text-slate-700 border-r text-center bg-teal-50/50 leading-tight min-w-[100px] cursor-pointer hover:bg-teal-100 transition-colors" 
                                onClick={() => setShowTerceiros(!showTerceiros)}
                                title="Clique para expandir/ocultar os saldos em terceiros"
                            >
                                <div className="flex items-center justify-center gap-1">
                                    ESTOQUE<br/>TERCEIROS
                                    <span className="text-teal-600 font-black text-sm ml-1">{showTerceiros ? "-" : "+"}</span>
                                </div>
                            </TableHead>
                            {showTerceiros && entidades?.map(ent => (
                                <TableHead key={ent.id} className="font-semibold text-slate-600 border-r text-center leading-tight max-w-[100px] break-words bg-slate-100/50">
                                    {ent.nome}
                                </TableHead>
                            ))}

                            <TableHead className="font-bold text-slate-700 text-center bg-slate-100 leading-tight">SALDO A<br/>PROGRAMAR (KG)</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={15} className="h-32 text-center text-slate-500">
                                    <div className="flex items-center justify-center">
                                        <Loader2 className="h-6 w-6 animate-spin mr-2" /> Carregando materiais...
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : data.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={15} className="h-32 text-center text-slate-500">
                                    Nenhum material encontrado neste grupo.
                                </TableCell>
                            </TableRow>
                        ) : data.map((row, idx) => (
                            row.isSummary ? (
                                <TableRow key={idx} className="bg-slate-100 hover:bg-slate-200 border-b border-slate-300 font-bold transition-colors">
                                    <TableCell className="border-r border-slate-300 font-bold text-slate-700 text-xs">{row.codigoMaterial}</TableCell>
                                    <TableCell className="border-r border-slate-300 font-bold text-slate-700">{row.materiaPrima}</TableCell>
                                    <TableCell className="border-r border-slate-300"></TableCell>
                                    <TableCell className="border-r border-slate-300"></TableCell>
                                    <TableCell className="border-r border-slate-300 text-right font-bold text-blue-900 bg-blue-50/50">{formatKg(row.mediaVendas)}</TableCell>
                                    {showMonths && (
                                        <>
                                            <TableCell className="border-r border-slate-300 text-right text-slate-500 font-normal bg-slate-100/50">{formatKg(row.necMes1)}</TableCell>
                                            <TableCell className="border-r border-slate-300 text-right text-slate-500 font-normal bg-slate-100/50">{formatKg(row.necMes2)}</TableCell>
                                            <TableCell className="border-r border-slate-300 text-right text-slate-500 font-normal bg-slate-100/50">{formatKg(row.necMes3)}</TableCell>
                                        </>
                                    )}
                                    <TableCell className="border-r border-slate-300 text-right text-slate-800">{formatKg(row.estoqueAtual)}</TableCell>
                                    <TableCell className="border-r border-slate-300 text-right text-blue-900">{formatKg(row.estoqueMaterial)}</TableCell>
                                    <TableCell className="border-r border-slate-300 text-right font-bold text-teal-800 bg-teal-50/50">
                                        {formatKg(entidades?.reduce((acc, ent) => acc + (row.terceirosSaldos?.[ent.id] || 0), 0) || 0)}
                                    </TableCell>
                                    {showTerceiros && entidades?.map(ent => (
                                        <TableCell key={ent.id} className="border-r border-slate-300 text-right bg-slate-100/30">
                                            {row.terceirosSaldos?.[ent.id] > 0 ? formatKg(row.terceirosSaldos[ent.id]) : "-"}
                                        </TableCell>
                                    ))}

                                    <TableCell className={`text-right font-bold bg-slate-50/50 ${row.saldo > 0 ? "text-red-600" : "text-emerald-600"}`}>
                                        {formatKg(row.saldo)}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                <TableRow key={idx} className="hover:bg-slate-50 border-b border-slate-100">
                                    <TableCell className="border-r border-slate-100"></TableCell>
                                    <TableCell className="border-r border-slate-100"></TableCell>
                                    <TableCell className="border-r border-slate-200 text-emerald-700 font-mono font-medium">{row.codCor}</TableCell>
                                    <TableCell className="border-r border-slate-200 text-slate-700">{row.cor}</TableCell>
                                    <TableCell className="border-r border-slate-200 text-right font-bold text-blue-800 bg-blue-50/30">{formatKg(row.mediaVendas)}</TableCell>
                                    {showMonths && (
                                        <>
                                            <TableCell className="border-r border-slate-200 text-right font-medium text-slate-500 bg-slate-50/50">{formatKg(row.necMes1)}</TableCell>
                                            <TableCell className="border-r border-slate-200 text-right font-medium text-slate-500 bg-slate-50/50">{formatKg(row.necMes2)}</TableCell>
                                            <TableCell className="border-r border-slate-200 text-right font-medium text-slate-500 bg-slate-50/50">{formatKg(row.necMes3)}</TableCell>
                                        </>
                                    )}
                                    <TableCell className="border-r border-slate-200 text-right font-semibold text-slate-800 bg-slate-50/50">{formatKg(row.estoqueAtual)}</TableCell>
                                    <TableCell className="border-r border-slate-200 text-right font-semibold text-blue-800 bg-blue-50/30">{formatKg(row.estoqueMaterial)}</TableCell>
                                    <TableCell className="border-r border-slate-200 text-right font-semibold text-teal-800 bg-teal-50/30">
                                        {formatKg(entidades?.reduce((acc, ent) => acc + (row.terceirosSaldos?.[ent.id] || 0), 0) || 0)}
                                    </TableCell>
                                    {showTerceiros && entidades?.map(ent => (
                                        <TableCell key={ent.id} className="border-r border-slate-200 text-right text-slate-500 bg-slate-50/30">
                                            {row.terceirosSaldos?.[ent.id] > 0 ? <span className="font-bold text-blue-600">{formatKg(row.terceirosSaldos[ent.id])}</span> : "-"}
                                        </TableCell>
                                    ))}

                                    <TableCell className={`text-right font-bold bg-slate-50/50 ${row.saldo > 0 ? "text-red-600" : "text-emerald-600"}`}>
                                        {formatKg(row.saldo)}
                                    </TableCell>
                                </TableRow>
                            )
                        ))}
                    </TableBody>
                </Table>
                <ScrollBar orientation="horizontal" className="top-0 bottom-auto border-t-0 border-b bg-slate-200" />
                <ScrollBar orientation="horizontal" />
            </ScrollArea>
        </Card>
    );
}
