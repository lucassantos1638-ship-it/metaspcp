import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.0'

export interface SessionValidationResult {
  valid: boolean
  error?: string
  user?: {
    id: string
    empresa_id: string | null
  }
  role?: 'super_admin' | 'gestor' | 'colaborador'
}

export async function validateSession(
  sessionToken: string | undefined
): Promise<SessionValidationResult> {
  if (!sessionToken) {
    return { valid: false, error: 'Token de sessão não fornecido' }
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  // 1. Validar token JWT via Supabase Auth
  const { data: { user }, error: authError } = await supabase.auth.getUser(sessionToken)

  if (authError || !user) {
    console.error('Erro na validação do token:', authError)
    return { valid: false, error: 'Sessão inválida ou expirada' }
  }

  // 2. Buscar dados do usuário na tabela usuarios (incluindo a role)
  const { data: usuario, error: usuarioError } = await supabase
    .from('usuarios')
    .select('id, empresa_id, role')
    .eq('id', user.id)
    .single()

  if (usuarioError || !usuario) {
    console.error('Erro ao buscar dados do usuário:', usuarioError)
    return { valid: false, error: 'Usuário não encontrado no sistema' }
  }

  // 3. Verificar permissão usando a coluna role da tabela usuarios
  const role = usuario.role

  // 4. Verificar se tem permissão de gestor ou super_admin
  if (!['gestor', 'super_admin'].includes(role)) {
    return { valid: false, error: 'Sem permissão administrativa' }
  }

  return {
    valid: true,
    user: usuario,
    role: role as 'super_admin' | 'gestor' | 'colaborador'
  }
}
