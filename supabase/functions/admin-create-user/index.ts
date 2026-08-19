// Cria um Administrador/Analista: usuário no Supabase Auth (login = CPF, via e-mail
// sintético) + a linha de perfil em access_users.
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

  const { name, cpf, email, phone, role, password } = await req.json();
  if (!name || !cpf || !role || !password) return json({ error: 'Nome, CPF, perfil e senha são obrigatórios' }, 400);
  if (role !== 'admin' && role !== 'analyst') return json({ error: 'Perfil inválido' }, 400);

  const digits = onlyDigits(cpf);
  if (digits.length !== 11) return json({ error: 'CPF inválido' }, 400);

  const svc = serviceClient();

  const { data: created, error: createErr } = await svc.auth.admin.createUser({
    email: loginEmail(digits),
    password,
    email_confirm: true,
    app_metadata: { role, label: name },
  });
  if (createErr || !created.user) return json({ error: createErr?.message || 'Falha ao criar usuário' }, 400);

  const { data: row, error: insertErr } = await svc
    .from('access_users')
    .insert({ name, cpf, email: email || null, phone: phone || null, role, auth_user_id: created.user.id })
    .select()
    .single();
  if (insertErr || !row) {
    await svc.auth.admin.deleteUser(created.user.id); // rollback
    return json({ error: insertErr?.message || 'Falha ao salvar usuário' }, 400);
  }

  await svc.auth.admin.updateUserById(created.user.id, { app_metadata: { role, label: name, user_id: row.id } });

  return json({ id: row.id });
});
