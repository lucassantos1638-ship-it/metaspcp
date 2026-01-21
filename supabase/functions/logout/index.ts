import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

console.log("Logout function started")

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { sessionToken } = await req.json()
    console.log('Logout request for token')

    if (!sessionToken) {
      return new Response(
        JSON.stringify({ error: 'Token não fornecido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Buscar sessão
    const { data: sessao } = await supabaseAdmin
      .from('sessoes')
      .select('user_id, usuarios(username)')
      .eq('token', sessionToken)
      .single()

    // Deletar sessão
    await supabaseAdmin
      .from('sessoes')
      .delete()
      .eq('token', sessionToken)

    // Log de logout
    if (sessao) {
      await supabaseAdmin.from('logs_acoes').insert({
        user_id: sessao.user_id,
        username: (sessao.usuarios as any)?.username || 'desconhecido',
        acao: 'LOGOUT',
        detalhes: {}
      })
    }

    console.log('Logout successful')

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in logout function:', error)
    return new Response(
      JSON.stringify({ error: 'Erro ao fazer logout' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
