import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const empresaId = formData.get('empresa_id') as string;

    if (!file || !empresaId) {
      return new Response(
        JSON.stringify({ error: 'Arquivo e empresa_id são obrigatórios' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Upload arquivo original para storage
    const fileBuffer = await file.arrayBuffer();
    const fileName = `${empresaId}/${Date.now()}-${file.name}`;
    
    const { error: uploadError } = await supabase.storage
      .from('pop-documents')
      .upload(fileName, fileBuffer, {
        contentType: file.type,
        upsert: false
      });

    if (uploadError) {
      console.error('Erro ao fazer upload:', uploadError);
      return new Response(
        JSON.stringify({ error: 'Erro ao fazer upload do arquivo' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Usar biblioteca mammoth via npm.js (ESM)
    // Como Deno não suporta nativamente Node.js modules, vamos extrair texto básico
    // Para produção, considere usar um serviço externo ou AWS Lambda para conversão completa
    
    // Simples conversão - retorna HTML básico
    // Em produção real, você precisaria de uma solução mais robusta
    const textDecoder = new TextDecoder();
    const arrayBufferView = new Uint8Array(fileBuffer);
    
    // Por enquanto, retornamos uma mensagem indicando que o arquivo foi recebido
    // e um HTML básico. Para extrair o conteúdo real do .docx, seria necessário
    // implementar um parser completo ou usar serviço externo
    const htmlContent = `
      <div class="documento-pop">
        <p><strong>Documento processado com sucesso!</strong></p>
        <p>Arquivo: ${file.name}</p>
        <p>Tamanho: ${(fileBuffer.byteLength / 1024).toFixed(2)} KB</p>
        <p><em>Nota: Para visualização completa do conteúdo formatado, use o upload via frontend com a biblioteca mammoth.js</em></p>
      </div>
    `;

    const { data } = supabase.storage
      .from('pop-documents')
      .getPublicUrl(fileName);

    return new Response(
      JSON.stringify({
        success: true,
        html: htmlContent,
        fileUrl: data.publicUrl
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro ao processar documento:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
