import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY || "",
  dangerouslyAllowBrowser: true,
});

export interface PedidoExtraidoIA {
  clienteNome: string;
  clienteCnpj?: string;
  numeroPedido?: string;
  observacoes?: string;
  tipoPagamento?: string;
  itens: {
    descricao: string;
    cor?: string;
    quantidade: number;
    precoUnitario: number;
    valorTotal: number;
  }[];
}

export async function analisarTextoPedidoComIA(textoPdf: string): Promise<PedidoExtraidoIA> {
  const prompt = `
Você é um assistente especializado em ler textos extraídos de PDFs de Pedidos de Venda e transformá-los em JSON estruturado.

Abaixo está o texto extraído de um PDF. Por favor, extraia as seguintes informações e retorne EXATAMENTE um JSON válido no seguinte formato, sem formatação markdown ou texto extra:

{
  "clienteNome": "Nome do Cliente",
  "clienteCnpj": "CNPJ do Cliente (apenas números, se houver)",
  "numeroPedido": "Número do Pedido (se houver)",
  "observacoes": "Junte todas as observações, prazos ou condições que encontrar no pedido em um único texto.",
  "tipoPagamento": "Forma de pagamento (ex: BOLETO)",
  "itens": [
    {
      "descricao": "Descrição completa do produto (Ex: JG LENCOL DIAMANTE CASAL)",
      "cor": "Cor do produto (se houver, ex: SALMAO, TURQUESA)",
      "quantidade": 40,
      "precoUnitario": 46.56,
      "valorTotal": 1862.40
    }
  ]
}

Regras:
1. Certifique-se de que 'quantidade', 'precoUnitario' e 'valorTotal' sejam números reais (floats). 
2. Para os valores monetários no Brasil que usam vírgula (ex: 46,56), converta para ponto (46.56).
3. Se algo não for encontrado, retorne uma string vazia ("") ou 0 para números.

TEXTO DO PDF:
=========================
${textoPdf}
=========================
  `;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo", // gpt-3.5-turbo é suficiente, gpt-4o seria mais preciso
      messages: [
        { role: "system", content: "Você é um extrator de dados JSON." },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1, // temperatura baixa para evitar alucinações
    });

    const conteudo = response.choices[0]?.message?.content;
    if (!conteudo) {
      throw new Error("Resposta vazia da OpenAI");
    }

    const dadosMapeados = JSON.parse(conteudo) as PedidoExtraidoIA;
    return dadosMapeados;
  } catch (error) {
    console.error("Erro ao analisar PDF com IA:", error);
    throw error;
  }
}
