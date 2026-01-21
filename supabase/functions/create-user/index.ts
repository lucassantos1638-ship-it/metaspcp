import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.0'
import { corsHeaders } from '../_shared/cors.ts'
import { validateSession } from '../_shared/auth.ts'

console.log("Create user function started")

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { username, senha, nome_completo, email, role, colaborador_id, permissoes, empresa_id, sessionToken } = await req.json()
    console.log('Creating user:', email, 'with role:', role, 'and empresa_id:', empresa_id)

    // VALIDAR SESSÃO
    const sessionValidation = await validateSession(sessionToken)
    if (!sessionValidation.valid) {
      return new Response(
        JSON.stringify({ error: sessionValidation.error }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validar permissões multi-tenancy
    if (sessionValidation.role === 'gestor' && empresa_id !== sessionValidation.user?.empresa_id) {
      return new Response(
        JSON.stringify({ error: 'Gestores só podem criar usuários na própria empresa' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!senha || !nome_completo || !role || !email) {
      return new Response(
        JSON.stringify({ error: 'Dados incompletos: email, senha, nome_completo e role são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validar empresa_id para usuários não super_admin
    if (role !== 'super_admin' && !empresa_id) {
      return new Response(
        JSON.stringify({ error: 'empresa_id é obrigatório para gestores e colaboradores' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validar email
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(
        JSON.stringify({ error: 'Email inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (senha.length < 6) {
      return new Response(
        JSON.stringify({ error: 'Senha deve ter no mínimo 6 caracteres' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Criar usuário via Supabase Auth Admin
    const { data: user, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: senha,
      email_confirm: true, // Auto-confirm user
      user_metadata: {
        empresa_id: empresa_id,
        role: role,
        nome_completo: nome_completo,
        username: username || email, // Fallback username to email if empty
        permissoes: permissoes || []
      }
    })

    if (userError) {
      console.error('Error creating user (Auth):', userError)
      return new Response(
        JSON.stringify({ error: userError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // MANUALMENTE INSERIR NA TABELA PUBLICA PARA GARANTIR
    // (Caso o trigger falhe ou demore)
    const { error: publicProfileError } = await supabaseAdmin
      .from('usuarios')
      .insert({
        id: user.user.id,
        username: username || email,
        nome_completo: nome_completo,
        email: email,
        empresa_id: empresa_id,
        role: role,
        permissoes: permissoes || [],
        preferencia_ranking: 'moderno'
      })
      .select()
      .single()

    if (publicProfileError) {
      console.error('Erro ao criar perfil público (ignorando se duplicado):', publicProfileError)
      // Não retorna erro aqui para não travar o processo se o trigger já tiver rodado
    }

    // Adicionar log
    await supabaseAdmin.from('logs_acoes').insert({
      user_id: user.user.id,
      username: 'sistema',
      acao: 'CRIAR_USUARIO',
      detalhes: { usuario_criado: email, role }
    })

    console.log('User created successfully:', email, user.user.id)

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: user.user.id,
          username: username || email,
          nome: nome_completo,
          role
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in create-user function:', error)
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
