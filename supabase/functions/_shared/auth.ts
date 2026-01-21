import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

  // Buscar sessão e validar expiração
  const { data: sessao, error: sessaoError } = await supabase
    .from('sessoes')
    .select('user_id, expires_at')
    .eq('token', sessionToken)
    .single()

  if (sessaoError || !sessao) {
    return { valid: false, error: 'Sessão inválida' }
  }

  if (new Date(sessao.expires_at) < new Date()) {
    return { valid: false, error: 'Sessão expirada' }
  }

  // Buscar dados do usuário
  const { data: usuario, error: usuarioError } = await supabase
    .from('usuarios')
    .select('id, empresa_id')
    .eq('id', sessao.user_id)
    .single()

  if (usuarioError || !usuario) {
    return { valid: false, error: 'Usuário não encontrado' }
  }

  // Buscar role do usuário
  const { data: userRole, error: roleError } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', usuario.id)
    .single()

  if (roleError || !userRole) {
    return { valid: false, error: 'Role não encontrada' }
  }

  const role = userRole.role

  // Verificar se tem permissão de gestor ou super_admin
  if (!['gestor', 'super_admin'].includes(role)) {
    return { valid: false, error: 'Sem permissão administrativa' }
  }

  return {
    valid: true,
    user: usuario,
    role: role as 'super_admin' | 'gestor' | 'colaborador'
  }
}
