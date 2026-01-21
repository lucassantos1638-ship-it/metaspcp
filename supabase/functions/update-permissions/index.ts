import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { validateSession } from '../_shared/auth.ts'

console.log("Update permissions function started")

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { user_id, permissoes, sessionToken } = await req.json()
    console.log('Updating permissions for user:', user_id)

    // VALIDAR SESSÃO
    const sessionValidation = await validateSession(sessionToken)
    if (!sessionValidation.valid) {
      return new Response(
        JSON.stringify({ error: sessionValidation.error }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!user_id || !Array.isArray(permissoes)) {
      return new Response(
        JSON.stringify({ error: 'Dados inválidos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Remover permissões antigas
    await supabaseAdmin
      .from('permissoes_telas')
      .delete()
      .eq('user_id', user_id)

    // Adicionar novas permissões
    if (permissoes.length > 0) {
      await supabaseAdmin.from('permissoes_telas').insert(
        permissoes.map(tela => ({
          user_id,
          tela
        }))
      )
    }

    // Log da alteração
    await supabaseAdmin.from('logs_acoes').insert({
      user_id: user_id,
      username: 'gestor',
      acao: 'ATUALIZAR_PERMISSOES',
      detalhes: { user_id, permissoes }
    })

    console.log('Permissions updated successfully')

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error updating permissions:', error)
    return new Response(
      JSON.stringify({ error: 'Erro ao atualizar permissões' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
