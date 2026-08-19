// Apaga um Administrador/Analista: remove o usuário no Supabase Auth (a linha em
// access_users cai junto por ON DELETE CASCADE).
//
// Arquivo autocontido (sem import de _shared) para poder ser colado direto no editor
// de Edge Functions do painel do Supabase.
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

function serviceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

async function requireStaff(req: Request) {
  const token = (req.headers.get('Authorization') || '').replace('Bearer ', '');
  if (!token) return json({ error: 'Token ausente' }, 401);
  const anon = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!);
  const { data, error } = await anon.auth.getUser(token);
  if (error || !data.user) return json({ error: 'Token inválido' }, 401);
  const role = data.user.app_metadata?.role;
  if (role !== 'admin' && role !== 'analyst') return json({ error: 'Somente administrador ou analista' }, 403);
  return { id: data.user.id };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const staff = await requireStaff(req);
  if (staff instanceof Response) return staff;

  const { id } = await req.json();
  if (!id) return json({ error: 'id obrigatório' }, 400);

  const svc = serviceClient();
  const { data: existing } = await svc.from('access_users').select('auth_user_id').eq('id', id).single();
  if (existing?.auth_user_id) {
    const { error } = await svc.auth.admin.deleteUser(existing.auth_user_id);
    if (error) return json({ error: error.message }, 400);
  } else {
    await svc.from('access_users').delete().eq('id', id);
  }

  return json({ ok: true });
});
