import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { username, newPassword, resetKey } = await req.json();

    // Validate inputs
    if (!username?.trim() || !newPassword?.trim() || !resetKey?.trim()) {
      return new Response(
        JSON.stringify({ success: false, error: 'Todos os campos são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate reset key
    const adminResetKey = Deno.env.get('ADMIN_RESET_KEY');
    if (!adminResetKey || resetKey.trim() !== adminResetKey) {
      console.log('Invalid reset key attempt');
      return new Response(
        JSON.stringify({ success: false, error: 'Chave de reset inválida' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate password length
    if (newPassword.trim().length < 6) {
      return new Response(
        JSON.stringify({ success: false, error: 'A senha deve ter no mínimo 6 caracteres' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find user (case-insensitive)
    const { data: user, error: userError } = await supabase
      .from('usuarios')
      .select('id, username, nome_completo')
      .ilike('username', username.trim())
      .single();

    if (userError || !user) {
      console.log('User not found:', username);
      return new Response(
        JSON.stringify({ success: false, error: 'Usuário não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword.trim(), salt);

    // Update password
    const { error: updateError } = await supabase
      .from('usuarios')
      .update({ password_hash: passwordHash })
      .eq('id', user.id);

    if (updateError) {
      console.error('Error updating password:', updateError);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao atualizar senha' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log the action
    await supabase.from('logs_acoes').insert({
      username: user.username,
      user_id: user.id,
      acao: 'RESET_SENHA_EMERGENCIA',
      detalhes: { metodo: 'admin-reset-password', timestamp: new Date().toISOString() }
    });

    console.log('Password reset successful for:', user.username);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Senha de "${user.nome_completo}" (${user.username}) redefinida com sucesso` 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in admin-reset-password:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
