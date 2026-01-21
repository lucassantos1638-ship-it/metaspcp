import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.0'
import { compareSync, hashSync } from 'https://deno.land/x/bcrypt@v0.4.1/mod.ts'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { userId, currentPassword, newPassword } = await req.json()

    console.log('Tentando atualizar senha para usuário:', userId)

    if (!userId || !currentPassword || !newPassword) {
      console.error('Dados faltando')
      return new Response(
        JSON.stringify({ error: 'userId, currentPassword e newPassword são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (newPassword.length < 6) {
      console.error('Nova senha muito curta')
      return new Response(
        JSON.stringify({ error: 'A nova senha deve ter no mínimo 6 caracteres' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log('Buscando usuário...')
    // Buscar usuário atual
    const { data: usuario, error: userError } = await supabase
      .from('usuarios')
      .select('password_hash, username')
      .eq('id', userId)
      .single()

    if (userError || !usuario) {
      console.error('Usuário não encontrado:', userError)
      return new Response(
        JSON.stringify({ error: 'Usuário não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Verificando senha atual...')
    // Verificar se a senha atual está correta (suporte a bcrypt e SHA-256 legado)
    let senhaCorreta = false
    const isBcrypt = /^\$2[aby]\$\d{2}\$/.test(usuario.password_hash)
    const isSha256Hex = /^[a-f0-9]{64}$/i.test(usuario.password_hash)

    if (isBcrypt) {
      console.log('Hash bcrypt detectado')
      senhaCorreta = compareSync(currentPassword, usuario.password_hash)
    } else if (isSha256Hex) {
      console.log('Hash SHA-256 detectado')
      const encoder = new TextEncoder()
      const data = encoder.encode(currentPassword)
      const hashBuffer = await crypto.subtle.digest('SHA-256', data)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
      senhaCorreta = hashHex === usuario.password_hash
    }
    
    if (!senhaCorreta) {
      console.error('Senha atual incorreta')
      return new Response(
        JSON.stringify({ error: 'Senha atual incorreta' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Gerando hash da nova senha...')
    // Gerar hash da nova senha
    const newPasswordHash = hashSync(newPassword)

    console.log('Atualizando senha...')
    // Atualizar senha
    const { error: updateError } = await supabase
      .from('usuarios')
      .update({ password_hash: newPasswordHash })
      .eq('id', userId)

    if (updateError) {
      console.error('Erro ao atualizar senha:', updateError)
      return new Response(
        JSON.stringify({ error: 'Erro ao atualizar senha' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Registrando log...')
    // Registrar log
    await supabase.from('logs_acoes').insert({
      acao: 'Senha alterada',
      username: usuario.username,
      user_id: userId,
      detalhes: { metodo: 'update-password' }
    })

    console.log('Senha atualizada com sucesso!')
    return new Response(
      JSON.stringify({ success: true, message: 'Senha atualizada com sucesso' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('Erro no update-password:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
