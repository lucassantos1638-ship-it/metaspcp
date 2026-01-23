import { useQuery } from "@tanstack/react-query";
import { supabase } from "../integrations/supabase/client";
import { format } from "date-fns";
import { useEmpresaId } from "@/hooks/useEmpresaId";

export interface MaterialNecessario {
    id: string;
    nome: string;
    codigo?: string | null;
    unidade_medida: string | null;
    quantidade_total: number; // Gross requirement
    custo_medio?: number;
    estoque_estamparia: number;
    estoque_tingimento: number;
    estoque_fabrica: number;
    estoque_produto_credit: number; // Material saved by finished product stock
    producao_produto_credit: number; // Material saved by products in progress
}

export const useProgramacaoMateriais = (mesesSelecionados: string[]) => {
    const empresaId = useEmpresaId();
    return useQuery({
        queryKey: ["programacao-materiais", mesesSelecionados, empresaId],
        enabled: mesesSelecionados.length > 0 && !!empresaId,
        queryFn: async () => {
            if (mesesSelecionados.length === 0 || !empresaId) return [];

            console.log("Calculando materiais para os meses:", mesesSelecionados);

            // 1. Buscar todas as projeções que correspondem aos meses selecionados
            const { data: projecoes, error: projecoesError } = await supabase
                .from("projecoes")
                .select(`
          id,
          data_referencia,
          itens:projecao_itens (
            id,
            produto_id,
            quantidade
          )
        `)
                .eq("empresa_id", empresaId);

            if (projecoesError) throw projecoesError;

            // Filtrar projeções pelos meses selecionados (Client-side filtering for simplicity with date formats)
            const projecoesFiltradas = projecoes.filter((p) => {
                const mesAno = format(new Date(p.data_referencia), "yyyy-MM");
                return mesesSelecionados.includes(mesAno);
            });

            console.log("Projeções encontradas:", projecoesFiltradas.length);

            // 2. Agregar quantidades de produtos
            const produtosMap = new Map<string, number>();

            projecoesFiltradas.forEach((projecao) => {
                projecao.itens.forEach((item) => {
                    if (item.produto_id) {
                        // Verificar se item.produto_id não é null
                        const qtdAtual = produtosMap.get(item.produto_id) || 0;
                        produtosMap.set(item.produto_id, qtdAtual + item.quantidade);
                    }
                });
            });

            const produtoIds = Array.from(produtosMap.keys());
            console.log("Produtos únicos nas projeções:", produtoIds.length);

            if (produtoIds.length === 0) return [];

            // 2.1 Buscar Estoque Atual dos Produtos e Produções em Andamento
            const { data: produtosInfo, error: produtosError } = await supabase
                .from("produtos")
                .select("id, estoque")
                .in("id", produtoIds);

            if (produtosError) throw produtosError;

            // Criar mapa de estoque de produtos
            const produtoEstoqueMap = new Map<string, number>();
            produtosInfo?.forEach(p => {
                produtoEstoqueMap.set(p.id, Number(p.estoque || 0));
            });

            // 2.2 Buscar Produções em Andamento (Lotes não finalizados)
            const { data: producoesEmAndamento, error: producoesError } = await supabase
                .from("lotes")
                .select("produto_id, quantidade_total")
                .in("produto_id", produtoIds)
                .neq("finalizado", true);

            if (producoesError) throw producoesError;

            console.log("Lotes em andamento encontrados:", producoesEmAndamento);

            // Criar mapa de produção em andamento
            const produtoProducaoMap = new Map<string, number>();
            producoesEmAndamento?.forEach(l => {
                const qtdAtual = produtoProducaoMap.get(l.produto_id) || 0;
                produtoProducaoMap.set(l.produto_id, qtdAtual + Number(l.quantidade_total || 0));
            });
            console.log("Mapa de Produção (WIP):", Object.fromEntries(produtoProducaoMap));

            // 3. Buscar os materiais desses produtos (FICHA TÉCNICA)
            const { data: fichasTecnicas, error: fichasError } = await supabase
                .from("produto_materiais")
                .select(`
          produto_id,
          quantidade,
          material:materiais (
            id,
            nome,
            codigo,
            unidade_medida,
            preco_custo,
            estoque_estamparia,
            estoque_tingimento,
            estoque_fabrica
          )
        `)
                .in("produto_id", produtoIds);

            if (fichasError) throw fichasError;

            console.log("Fichas técnicas encontradas:", fichasTecnicas.length);

            // 4. Calcular materiais totais
            const materiaisMap = new Map<string, MaterialNecessario>();

            fichasTecnicas.forEach((ft) => {
                const produtoQtd = produtosMap.get(ft.produto_id) || 0;
                // ft.quantidade é a qtd de material por unidade de produto
                const materialQtdTotal = produtoQtd * Number(ft.quantidade);

                const material = ft.material as any; // Cast explicit to avoid TS issues if types aren't fully updated globally yet
                if (material) {
                    const materialExistente = materiaisMap.get(material.id);

                    if (materialExistente) {
                        const wipCredit = (produtoProducaoMap.get(ft.produto_id) || 0) * Number(ft.quantidade);
                        console.log(`Material ${material.nome}: Produto Credit=${(produtoEstoqueMap.get(ft.produto_id) || 0) * Number(ft.quantidade)}, WIP Credit=${wipCredit}`);

                        materialExistente.quantidade_total += materialQtdTotal;
                        materialExistente.estoque_produto_credit += (produtoEstoqueMap.get(ft.produto_id) || 0) * Number(ft.quantidade);
                        materialExistente.producao_produto_credit += wipCredit;
                    } else {
                        materiaisMap.set(material.id, {
                            id: material.id,
                            nome: material.nome,
                            codigo: material.codigo,
                            unidade_medida: material.unidade_medida,
                            quantidade_total: materialQtdTotal,
                            custo_medio: material.preco_custo,
                            estoque_estamparia: Number(material.estoque_estamparia || 0),
                            estoque_tingimento: Number(material.estoque_tingimento || 0),
                            estoque_fabrica: Number(material.estoque_fabrica || 0),
                            estoque_produto_credit: (produtoEstoqueMap.get(ft.produto_id) || 0) * Number(ft.quantidade),
                            producao_produto_credit: (produtoProducaoMap.get(ft.produto_id) || 0) * Number(ft.quantidade),
                        });
                    }
                }
            });

            const resultado = Array.from(materiaisMap.values()).sort((a, b) =>
                a.nome.localeCompare(b.nome)
            );

            console.log("Materiais calculados:", resultado.length);
            return resultado;
        },
    });
};
