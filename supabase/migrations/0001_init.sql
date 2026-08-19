-- SócioCash — schema inicial (migração de localStorage para Supabase)
-- Espelha os tipos de types.ts. RLS por role/company_id lido do JWT (app_metadata),
-- setado pelas Edge Functions (admin-create-user / admin-update-user / admin-delete-user /
-- admin-set-company-password) via service-role key — nunca editável pelo próprio usuário.

create extension if not exists pgcrypto;

-- ---------- Helpers para ler claims do JWT dentro das policies ----------
create or replace function auth_role() returns text
language sql stable as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '');
$$;

create or replace function auth_company_id() returns uuid
language sql stable as $$
  select nullif(auth.jwt() -> 'app_metadata' ->> 'company_id', '')::uuid;
$$;

create or replace function is_staff() returns boolean
language sql stable as $$
  select auth_role() in ('admin', 'analyst');
$$;

-- ---------- Tabelas ----------

create table companies (
  id uuid primary key default gen_random_uuid(),
  razao_social text not null,
  nome_fantasia text not null,
  cnpj text not null unique,
  tipo text not null default 'LTDA',
  endereco text,
  foro_comarca text,
  client_auth_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  cpf text not null,
  participation numeric not null default 0,
  company_ids uuid[] not null default '{}',
  endereco text,
  created_at timestamptz not null default now()
);

create table bank_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  owner_type text not null check (owner_type in ('COMPANY', 'PARTNER')),
  bank_name text not null,
  agency text,
  account_number text not null,
  type text not null check (type in ('Corrente', 'Poupança', 'Investimento', 'Outra')),
  created_at timestamptz not null default now()
);

create table transactions (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  company_id uuid not null references companies(id) on delete cascade,
  partner_id uuid references partners(id) on delete set null,
  origin_account_id uuid not null,
  destination_account_id uuid not null,
  value numeric not null,
  type text not null check (type in ('CREDIT', 'DEBIT')),
  nature text check (nature in (
    'APORTE_CAPITAL', 'EMPRESTIMO', 'DEVOLUCAO_APORTE',
    'RETIRADA_LUCROS', 'PRO_LABORE', 'PAGTO_EMPRESTIMO'
  )),
  description text,
  created_at timestamptz not null default now()
);

create table mutuos (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  partner_id uuid not null references partners(id) on delete cascade,
  direction text not null check (direction in ('EMPRESA_PARA_SOCIO', 'SOCIO_PARA_EMPRESA')),
  socio_tipo text not null check (socio_tipo in ('PF', 'PJ')),
  value numeric not null,
  release_date date not null,
  first_installment_date date,
  due_date date not null,
  parcelas integer not null default 1,
  annual_interest_pct numeric not null default 0,
  observacao text,
  created_at timestamptz not null default now()
);

-- Perfil dos usuários da equipe (Administrador/Analista). A senha em si vive só em
-- auth.users — esta tabela guarda os dados de cadastro (Nome, CPF, e-mail, fone, perfil)
-- e aponta para o usuário de Auth correspondente.
create table access_users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  cpf text not null unique,
  email text,
  phone text,
  role text not null check (role in ('admin', 'analyst')),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index transactions_company_id_idx on transactions(company_id);
create index mutuos_company_id_idx on mutuos(company_id);
create index bank_accounts_owner_idx on bank_accounts(owner_type, owner_id);

-- ---------- RLS ----------

alter table companies enable row level security;
alter table partners enable row level security;
alter table bank_accounts enable row level security;
alter table transactions enable row level security;
alter table mutuos enable row level security;
alter table access_users enable row level security;

-- Equipe (admin/analyst): acesso total de leitura/escrita em todas as tabelas de dados.
create policy "staff full access" on companies for all using (is_staff()) with check (is_staff());
create policy "staff full access" on partners for all using (is_staff()) with check (is_staff());
create policy "staff full access" on bank_accounts for all using (is_staff()) with check (is_staff());
create policy "staff full access" on transactions for all using (is_staff()) with check (is_staff());
create policy "staff full access" on mutuos for all using (is_staff()) with check (is_staff());

-- Cliente: somente leitura, escopada à própria empresa (nunca escreve).
create policy "client read own company" on companies
  for select using (auth_role() = 'client' and id = auth_company_id());

create policy "client read own partners" on partners
  for select using (auth_role() = 'client' and auth_company_id() = any(company_ids));

create policy "client read own bank accounts" on bank_accounts
  for select using (
    auth_role() = 'client' and (
      (owner_type = 'COMPANY' and owner_id = auth_company_id())
      or (owner_type = 'PARTNER' and owner_id in (
            select id from partners where auth_company_id() = any(company_ids)
          ))
    )
  );

create policy "client read own transactions" on transactions
  for select using (auth_role() = 'client' and company_id = auth_company_id());

create policy "client read own mutuos" on mutuos
  for select using (auth_role() = 'client' and company_id = auth_company_id());

-- access_users: só administrador lê a lista (pela anon key); toda escrita (criar/editar/
-- apagar usuário) passa pelas Edge Functions com a service-role key, que ignora RLS.
create policy "admin read access users" on access_users
  for select using (auth_role() = 'admin');
