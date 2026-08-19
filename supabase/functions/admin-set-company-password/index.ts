// Define/troca a senha de acesso do cliente (login por CNPJ) — cria o usuário de Auth
// vinculado à empresa na primeira vez, ou atualiza a senha/CNPJ dele nas próximas.
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

  const { companyId, cnpj, password } = await req.json();
  if (!companyId || !cnpj || !password) return json({ error: 'Empresa, CNPJ e senha são obrigatórios' }, 400);

  const digits = onlyDigits(cnpj);
  if (digits.length !== 14) return json({ error: 'CNPJ inválido' }, 400);

  const svc = serviceClient();
  const { data: company, error: findErr } = await svc
    .from('companies')
    .select('id, client_auth_user_id, nome_fantasia')
    .eq('id', companyId)
    .single();
  if (findErr || !company) return json({ error: 'Empresa não encontrada' }, 404);

  const appMeta = { role: 'client', company_id: companyId, label: company.nome_fantasia };

  if (company.client_auth_user_id) {
    const { error } = await svc.auth.admin.updateUserById(company.client_auth_user_id, {
      email: loginEmail(digits),
      password,
      app_metadata: appMeta,
    });
    if (error) return json({ error: error.message }, 400);
  } else {
    const { data: created, error } = await svc.auth.admin.createUser({
      email: loginEmail(digits),
      password,
      email_confirm: true,
      app_metadata: appMeta,
    });
    if (error || !created.user) return json({ error: error?.message || 'Falha ao criar usuário' }, 400);
    await svc.from('companies').update({ client_auth_user_id: created.user.id }).eq('id', companyId);
  }

  return json({ ok: true });
});
