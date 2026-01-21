import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.0'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { empresa_id, forma_pagamento } = await req.json()

    if (!empresa_id || !forma_pagamento) {
      return new Response(
        JSON.stringify({ error: 'Empresa ID e forma de pagamento são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const formasPagamento = ['cartao_credito', 'pix', 'boleto']
    if (!formasPagamento.includes(forma_pagamento)) {
      return new Response(
        JSON.stringify({ error: 'Forma de pagamento inválida' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Verificar se empresa existe e está em trial
    const { data: empresa, error: empresaError } = await supabase
      .from('empresas')
      .select('*')
      .eq('id', empresa_id)
      .single()

    if (empresaError || !empresa) {
      return new Response(
        JSON.stringify({ error: 'Empresa não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (empresa.status_assinatura !== 'trial') {
      return new Response(
        JSON.stringify({ error: 'Empresa não está em período de trial' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Atualizar empresa com forma de pagamento
    const { error: updateError } = await supabase
      .from('empresas')
      .update({
        forma_pagamento: forma_pagamento
      })
      .eq('id', empresa_id)

    if (updateError) {
      console.error('Erro ao atualizar empresa:', updateError)
      return new Response(
        JSON.stringify({ error: 'Erro ao processar checkout' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Log da ação
    await supabase.from('logs_acoes').insert({
      acao: 'Checkout processado',
      username: 'sistema',
      detalhes: {
        empresa_id: empresa_id,
        forma_pagamento: forma_pagamento
      }
    })

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Checkout processado com sucesso',
        trial_ate: empresa.data_fim_trial
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('Erro no process-checkout:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})