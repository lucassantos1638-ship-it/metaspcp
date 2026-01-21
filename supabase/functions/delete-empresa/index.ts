import { corsHeaders } from '../_shared/cors.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('Delete empresa function started')

    const { empresa_id } = await req.json()

    if (!empresa_id) {
      throw new Error('empresa_id is required')
    }

    console.log('Deleting empresa:', empresa_id)

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Buscar todos os usuários da empresa
    const { data: usuarios, error: usuariosError } = await supabaseAdmin
      .from('usuarios')
      .select('id')
      .eq('empresa_id', empresa_id)

    if (usuariosError) {
      console.error('Error fetching users:', usuariosError)
      throw usuariosError
    }

    console.log('Found users:', usuarios?.length || 0)

    // 2. Para cada usuário, deletar todos os dados relacionados
    if (usuarios && usuarios.length > 0) {
      for (const usuario of usuarios) {
        console.log('Deleting data for user:', usuario.id)

        // Deletar documentos_pop criados por este usuário
        const { error: docError } = await supabaseAdmin
          .from('documentos_pop')
          .delete()
          .eq('created_by', usuario.id)

        if (docError) {
          console.error('Error deleting documentos_pop:', docError)
        }

        // Deletar permissões
        const { error: permError } = await supabaseAdmin
          .from('permissoes_telas')
          .delete()
          .eq('user_id', usuario.id)

        if (permError) {
          console.error('Error deleting permissions:', permError)
        }

        // Deletar roles
        const { error: rolesError } = await supabaseAdmin
          .from('user_roles')
          .delete()
          .eq('user_id', usuario.id)

        if (rolesError) {
          console.error('Error deleting roles:', rolesError)
        }

        // Deletar sessões
        const { error: sessoesError } = await supabaseAdmin
          .from('sessoes')
          .delete()
          .eq('user_id', usuario.id)

        if (sessoesError) {
          console.error('Error deleting sessions:', sessoesError)
        }
      }

      // 3. Deletar todos os usuários da empresa
      const { error: deleteUsersError } = await supabaseAdmin
        .from('usuarios')
        .delete()
        .eq('empresa_id', empresa_id)

      if (deleteUsersError) {
        console.error('Error deleting users:', deleteUsersError)
        throw deleteUsersError
      }

      console.log('Users deleted successfully')
    }

    // 4. Deletar todos os dados relacionados à empresa
    const tablesToDelete = [
      'previsao_imprevistos',
      'previsao_ajustes',
      'producoes',
      'produto_etapas',
      'lotes',
      'metas',
      'previsoes_producao',
      'produtos',
      'subetapas',
      'etapas',
      'colaboradores',
      'configuracoes_empresa'
    ]

    for (const table of tablesToDelete) {
      console.log(`Deleting ${table} for empresa:`, empresa_id)
      const { error } = await supabaseAdmin
        .from(table)
        .delete()
        .eq('empresa_id', empresa_id)

      if (error) {
        console.error(`Error deleting ${table}:`, error)
      }
    }

    // 5. Deletar a empresa
    const { error: empresaError } = await supabaseAdmin
      .from('empresas')
      .delete()
      .eq('id', empresa_id)

    if (empresaError) {
      console.error('Error deleting empresa:', empresaError)
      throw empresaError
    }

    console.log('Empresa deleted successfully:', empresa_id)

    return new Response(
      JSON.stringify({ success: true, message: 'Empresa deleted successfully' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )
  } catch (error) {
    console.error('Error in delete-empresa function:', error)
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    )
  }
})
