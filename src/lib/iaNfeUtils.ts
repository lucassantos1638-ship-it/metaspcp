import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY || "dummy_key",
  dangerouslyAllowBrowser: true,
});

export interface NFeExtraidaIA {
  remetenteNome: string;
  remetenteCnpj?: string;
  destinatarioNome: string;
  destinatarioCnpj?: string;
  numeroNota?: string;
  itens: {
    descricao: string;
    quantidade: number;
    unidade: string;
  }[];
}

export async function analisarTextoNfeComIA(textoPdf: string): Promise<NFeExtraidaIA> {
  const prompt = `
Você é um assistente especializado em ler textos extraídos de PDFs de Notas Fiscais (NFe) e transformá-los em JSON estruturado.

Abaixo está o texto extraído de um PDF. Por favor, extraia as seguintes informações e retorne EXATAMENTE um JSON válido no seguinte formato, sem formatação markdown ou texto extra:

{
  "remetenteNome": "Nome do Emitente/Remetente",
  "remetenteCnpj": "CNPJ do Emitente (apenas números, se houver)",
  "destinatarioNome": "Nome do Destinatário",
  "destinatarioCnpj": "CNPJ do Destinatário (apenas números, se houver)",
  "numeroNota": "Número da Nota Fiscal (geralmente um número pequeno tipo 1234, não a chave de acesso gigante)",
  "itens": [
    {
      "descricao": "Descrição do produto",
      "quantidade": 100.50,
      "unidade": "KG"
    }
  ]
}

Regras:
1. Certifique-se de que "quantidade" seja um número real (float). Converta vírgulas para pontos.
2. Se não encontrar uma informação, retorne string vazia.
3. Foque apenas nos produtos físicos movimentados (materiais, fios, malhas). Ignore taxas de serviço se não fizerem sentido no estoque.

TEXTO DO PDF:
=========================
${textoPdf}
=========================
  `;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "Você é um extrator de dados JSON." },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });

    const conteudo = response.choices[0]?.message?.content;
    if (!conteudo) {
      throw new Error("Resposta vazia da OpenAI");
    }

    return JSON.parse(conteudo) as NFeExtraidaIA;
  } catch (error) {
    console.error("Erro ao analisar NFe com IA:", error);
    throw error;
  }
}
