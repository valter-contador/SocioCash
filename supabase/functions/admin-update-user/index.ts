// Edita um Administrador/Analista já cadastrado (dados de perfil e, opcionalmente, senha/CPF).
//
// Arquivo autocontido (sem import de _shared) para poder ser colado direto no editor
// de Edge Functions do painel do Supabase.
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const onlyDigits = (s: string): string => (s || '').replace(/\D/g, '');
const loginEmail = (digits: string): string => `${digits}@login.sociocash.internal`;
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

  const { id, name, cpf, email, phone, role, password } = await req.json();
  if (!id) return json({ error: 'id obrigatório' }, 400);
  if (role && role !== 'admin' && role !== 'analyst') return json({ error: 'Perfil inválido' }, 400);

  const svc = serviceClient();
  const { data: existing, error: findErr } = await svc.from('access_users').select('*').eq('id', id).single();
  if (findErr || !existing) return json({ error: 'Usuário não encontrado' }, 404);

  const authPatch: Record<string, unknown> = {
    app_metadata: { role: role || existing.role, label: name || existing.name, user_id: id },
  };
  if (password) authPatch.password = password;
  if (cpf) {
    const digits = onlyDigits(cpf);
    if (digits.length !== 11) return json({ error: 'CPF inválido' }, 400);
    authPatch.email = loginEmail(digits);
  }

  const { error: updErr } = await svc.auth.admin.updateUserById(existing.auth_user_id, authPatch);
  if (updErr) return json({ error: updErr.message }, 400);

  const { error: rowErr } = await svc
    .from('access_users')
    .update({
      name: name ?? existing.name,
      cpf: cpf ?? existing.cpf,
      email: email ?? existing.email,
      phone: phone ?? existing.phone,
      role: role ?? existing.role,
    })
    .eq('id', id);
  if (rowErr) return json({ error: rowErr.message }, 400);

  return json({ ok: true });
});
