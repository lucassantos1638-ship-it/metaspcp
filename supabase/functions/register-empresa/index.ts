import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.0'
import { hashSync } from 'https://deno.land/x/bcrypt@v0.4.1/mod.ts'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { nome, email, username, cpf, cnpj, telefone, senha } = await req.json()

    console.log('Dados recebidos:', { nome, email, username, cpf, cnpj, telefone })

    // Validações básicas
    if (!nome || !email || !username || !telefone || !senha) {
      console.error('Campos obrigatórios faltando')
      return new Response(
        JSON.stringify({ error: 'Todos os campos são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validar username
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      console.error('Username inválido:', username)
      return new Response(
        JSON.stringify({ error: 'Nome de usuário inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (username.length < 3) {
      console.error('Username muito curto:', username)
      return new Response(
        JSON.stringify({ error: 'Nome de usuário deve ter no mínimo 3 caracteres' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!cpf && !cnpj) {
      console.error('CPF ou CNPJ não fornecido')
      return new Response(
        JSON.stringify({ error: 'CPF ou CNPJ é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validar formato de CPF ou CNPJ
    if (cpf && cpf.replace(/\D/g, '').length !== 11) {
      return new Response(
        JSON.stringify({ error: 'CPF inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (cnpj && cnpj.replace(/\D/g, '').length !== 14) {
      return new Response(
        JSON.stringify({ error: 'CNPJ inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log('Verificando username existente...')
    // Verificar se username já existe
    const { data: existingUsername } = await supabase
      .from('usuarios')
      .select('id')
      .eq('username', username)
      .maybeSingle()

    if (existingUsername) {
      console.error('Username já existe:', username)
      return new Response(
        JSON.stringify({ error: 'Nome de usuário já cadastrado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Verificando email existente...')
    // Verificar se email já existe
    const { data: existingEmail } = await supabase
      .from('empresas')
      .select('id')
      .eq('email_contato', email)
      .maybeSingle()

    if (existingEmail) {
      console.error('Email já cadastrado:', email)
      return new Response(
        JSON.stringify({ error: 'Email já cadastrado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verificar se CPF já existe
    if (cpf) {
      console.log('Verificando CPF existente...')
      const { data: existingCpf } = await supabase
        .from('empresas')
        .select('id')
        .eq('cpf', cpf.replace(/\D/g, ''))
        .maybeSingle()

      if (existingCpf) {
        console.error('CPF já cadastrado:', cpf)
        return new Response(
          JSON.stringify({ error: 'CPF já cadastrado' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Verificar se CNPJ já existe
    if (cnpj) {
      console.log('Verificando CNPJ existente...')
      const { data: existingCnpj } = await supabase
        .from('empresas')
        .select('id')
        .eq('cnpj', cnpj.replace(/\D/g, ''))
        .maybeSingle()

      if (existingCnpj) {
        console.error('CNPJ já cadastrado:', cnpj)
        return new Response(
          JSON.stringify({ error: 'CNPJ já cadastrado' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Calcular datas de trial
    const dataInicio = new Date()
    const dataFim = new Date()
    dataFim.setDate(dataFim.getDate() + 7)

    console.log('Criando empresa...')
    // Criar empresa com status trial
    const { data: empresa, error: empresaError } = await supabase
      .from('empresas')
      .insert({
        nome,
        email_contato: email,
        telefone,
        cpf: cpf ? cpf.replace(/\D/g, '') : null,
        cnpj: cnpj ? cnpj.replace(/\D/g, '') : null,
        status_assinatura: 'trial',
        data_inicio_trial: dataInicio.toISOString().split('T')[0],
        data_fim_trial: dataFim.toISOString().split('T')[0],
        ativo: true
      })
      .select()
      .single()

    if (empresaError) {
      console.error('Erro ao criar empresa:', empresaError)
      return new Response(
        JSON.stringify({ error: 'Erro ao criar empresa: ' + empresaError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Empresa criada com sucesso:', empresa.id)

    // Gerar hash da senha usando bcrypt
    console.log('Gerando hash da senha...')
    const passwordHash = hashSync(senha)

    console.log('Criando usuário gestor com username:', username)
    // Criar primeiro usuário gestor
    const { data: usuario, error: usuarioError } = await supabase
      .from('usuarios')
      .insert({
        username: username,
        nome_completo: nome,
        email: email,
        password_hash: passwordHash,
        empresa_id: empresa.id,
        ativo: true
      })
      .select()
      .single()

    if (usuarioError) {
      console.error('Erro ao criar usuário:', usuarioError)
      // Rollback: deletar empresa criada
      await supabase.from('empresas').delete().eq('id', empresa.id)
      return new Response(
        JSON.stringify({ error: 'Erro ao criar usuário gestor: ' + usuarioError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Usuário gestor criado com sucesso:', usuario.id)

    console.log('Atribuindo role de gestor...')
    // Atribuir role de gestor
    const { error: roleError } = await supabase
      .from('user_roles')
      .insert({
        user_id: usuario.id,
        role: 'gestor'
      })

    if (roleError) {
      console.error('Erro ao atribuir role:', roleError)
      // Rollback
      await supabase.from('usuarios').delete().eq('id', usuario.id)
      await supabase.from('empresas').delete().eq('id', empresa.id)
      return new Response(
        JSON.stringify({ error: 'Erro ao configurar permissões: ' + roleError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Role de gestor atribuída com sucesso')

    console.log('Registrando log de ação...')
    // Log da ação
    await supabase.from('logs_acoes').insert({
      acao: 'Empresa auto-cadastrada',
      username: username,
      user_id: usuario.id,
      detalhes: {
        empresa_id: empresa.id,
        empresa_nome: nome,
        trial_ate: dataFim.toISOString().split('T')[0]
      }
    })

    console.log('Cadastro concluído com sucesso!')
    return new Response(
      JSON.stringify({
        success: true,
        empresa_id: empresa.id,
        trial_dias: 7,
        data_fim_trial: dataFim.toISOString().split('T')[0]
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('Erro no register-empresa:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})