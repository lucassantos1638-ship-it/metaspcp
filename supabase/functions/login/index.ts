import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { compareSync } from 'https://deno.land/x/bcrypt@v0.4.1/mod.ts'

console.log("Login function started")

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { username: rawUsername, password: rawPassword } = await req.json()
    
    // Trim whitespace from inputs
    const username = rawUsername?.trim()
    const password = rawPassword?.trim()
    
    console.log('Login attempt for username:', username)

    if (!username || !password) {
      return new Response(
        JSON.stringify({ error: 'Usuário e senha são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Buscar usuário (permite login usando username OU e-mail)
    const usuarioSelect = 'id, username, password_hash, nome_completo, ativo, colaborador_id, empresa_id, email'

    let usuario:
      | {
          id: string
          username: string
          password_hash: string
          nome_completo: string
          ativo: boolean
          colaborador_id: string | null
          empresa_id: string | null
          email: string | null
        }
      | null = null

    const { data: byUsername, error: byUsernameError } = await supabaseAdmin
      .from('usuarios')
      .select(usuarioSelect)
      .eq('username', username)
      .maybeSingle()

    if (byUsernameError) {
      console.error('Error fetching user by username:', byUsernameError)
    }

    usuario = byUsername ?? null

    if (!usuario) {
      const { data: byEmail, error: byEmailError } = await supabaseAdmin
        .from('usuarios')
        .select(usuarioSelect)
        .eq('email', username)
        .maybeSingle()

      if (byEmailError) {
        console.error('Error fetching user by email:', byEmailError)
      }

      usuario = byEmail ?? null
    }

    if (!usuario) {
      console.log('User not found:', username)
      return new Response(
        JSON.stringify({ error: 'Usuário ou senha inválidos' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!usuario.ativo) {
      console.log('User inactive:', username)
      return new Response(
        JSON.stringify({ error: 'Usuário desativado. Contate o administrador.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verificar se empresa está ativa e status de trial (apenas se usuário tiver empresa)
    if (usuario.empresa_id) {
      const { data: empresa } = await supabaseAdmin
        .from('empresas')
        .select('ativo, plano_ativo, data_renovacao_plano, status_assinatura, data_fim_trial, nome')
        .eq('id', usuario.empresa_id)
        .maybeSingle()

      if (empresa && !empresa.ativo) {
        return new Response(
          JSON.stringify({ error: 'Empresa desativada. Entre em contato com o suporte.' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Verificar status de trial e assinatura
      if (empresa?.status_assinatura === 'trial') {
        const dataFim = new Date(empresa.data_fim_trial)
        const hoje = new Date()
        hoje.setHours(0, 0, 0, 0)
        dataFim.setHours(0, 0, 0, 0)

        if (hoje > dataFim) {
          // Trial expirado - atualizar status para vencida
          await supabaseAdmin
            .from('empresas')
            .update({ status_assinatura: 'vencida' })
            .eq('id', usuario.empresa_id)

          console.log('Trial expired for:', empresa.nome)
          return new Response(
            JSON.stringify({ 
              error: 'Seu período de teste expirou. Entre em contato para ativar sua assinatura.',
              trial_expirado: true
            }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      }

      // Verificar se assinatura está vencida
      if (empresa?.status_assinatura === 'vencida') {
        return new Response(
          JSON.stringify({ 
            error: 'Sua assinatura está vencida. Entre em contato para reativar.',
            assinatura_vencida: true
          }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Verificar se assinatura está cancelada
      if (empresa?.status_assinatura === 'cancelada') {
        return new Response(
          JSON.stringify({ error: 'Sua assinatura foi cancelada. Entre em contato com o suporte.' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Verificar se plano está vencido (sistema legado)
      if (empresa?.data_renovacao_plano && new Date(empresa.data_renovacao_plano) < new Date()) {
        return new Response(
          JSON.stringify({ error: 'Plano vencido. Entre em contato com o suporte.' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Verificar senha (suporte a bcrypt e SHA-256 legado)
    let senhaValida = false
    const isBcrypt = /^\$2[aby]\$\d{2}\$/.test(usuario.password_hash)
    const isSha256Hex = /^[a-f0-9]{64}$/i.test(usuario.password_hash)

    if (isBcrypt) {
      senhaValida = compareSync(password, usuario.password_hash)
    } else if (isSha256Hex) {
      const encoder = new TextEncoder()
      const data = encoder.encode(password)
      const hashBuffer = await crypto.subtle.digest('SHA-256', data)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
      senhaValida = hashHex === usuario.password_hash
    }
    
    if (!senhaValida) {
      console.log('Invalid password for user:', username)
      
      await supabaseAdmin.from('logs_acoes').insert({
        user_id: usuario.id,
        username: usuario.username,
        acao: 'LOGIN_FALHOU',
        detalhes: { motivo: 'senha_invalida' }
      })

      return new Response(
        JSON.stringify({ error: 'Usuário ou senha inválidos' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Buscar role
    const { data: roleData } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', usuario.id)
      .single()

    const role = roleData?.role || 'colaborador'
    console.log('User role:', role)

    // Buscar permissões (apenas se colaborador)
    let permissoes: string[] = []
    if (role === 'colaborador') {
      const { data: perms } = await supabaseAdmin
        .from('permissoes_telas')
        .select('tela')
        .eq('user_id', usuario.id)

      permissoes = perms?.map(p => p.tela) || []
      console.log('User permissions:', permissoes)
    }

    // Gerar token de sessão
    const sessionToken = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000)

    // Salvar sessão
    await supabaseAdmin.from('sessoes').insert({
      user_id: usuario.id,
      token: sessionToken,
      expires_at: expiresAt.toISOString()
    })

    // Log de login bem-sucedido
    await supabaseAdmin.from('logs_acoes').insert({
      user_id: usuario.id,
      username: usuario.username,
      acao: 'LOGIN',
      detalhes: {}
    })

    console.log('Login successful for:', username)

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: usuario.id,
          username: usuario.username,
          nome: usuario.nome_completo,
          email: usuario.email,
          role,
          colaborador_id: usuario.colaborador_id,
          empresa_id: usuario.empresa_id,
          permissoes: role === 'gestor' || role === 'super_admin' ? 'all' : permissoes
        },
        sessionToken,
        expiresAt: expiresAt.toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in login function:', error)
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
