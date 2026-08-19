#!/usr/bin/env node
// Migração única: importa o sociocash_data (exportado do localStorage do navegador de
// produção) para o Supabase, e cria o primeiro usuário Administrador.
//
// Uso:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//   BOOTSTRAP_ADMIN_NAME="..." BOOTSTRAP_ADMIN_CPF="..." BOOTSTRAP_ADMIN_EMAIL="..." \
//   BOOTSTRAP_ADMIN_PHONE="..." BOOTSTRAP_ADMIN_PASSWORD="..." \
//   node scripts/migrate-local-data.mjs caminho/para/local-data-export.json
//
// (rode a partir da raiz do projeto; nunca commite o arquivo de export nem as chaves)

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const filePath = process.argv[2];

if (!url || !serviceKey) {
  console.error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente.');
  process.exit(1);
}
if (!filePath) {
  console.error('Uso: node scripts/migrate-local-data.mjs <arquivo-json-exportado>');
  process.exit(1);
}

const onlyDigits = (s) => (s || '').replace(/\D/g, '');
const loginEmail = (digits) => `${digits}@login.sociocash.internal`;

const svc = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

const raw = JSON.parse(readFileSync(filePath, 'utf-8'));

async function main() {
  // 1) Primeiro administrador (opcional — pula se as variáveis não forem passadas).
  const { BOOTSTRAP_ADMIN_NAME, BOOTSTRAP_ADMIN_CPF, BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_PHONE, BOOTSTRAP_ADMIN_PASSWORD } = process.env;
  if (BOOTSTRAP_ADMIN_NAME && BOOTSTRAP_ADMIN_CPF && BOOTSTRAP_ADMIN_PASSWORD) {
    const digits = onlyDigits(BOOTSTRAP_ADMIN_CPF);
    const { data: created, error } = await svc.auth.admin.createUser({
      email: loginEmail(digits),
      password: BOOTSTRAP_ADMIN_PASSWORD,
      email_confirm: true,
      app_metadata: { role: 'admin', label: BOOTSTRAP_ADMIN_NAME },
    });
    if (error) throw error;
    const { data: row, error: insErr } = await svc.from('access_users').insert({
      name: BOOTSTRAP_ADMIN_NAME, cpf: BOOTSTRAP_ADMIN_CPF, email: BOOTSTRAP_ADMIN_EMAIL || null,
      phone: BOOTSTRAP_ADMIN_PHONE || null, role: 'admin', auth_user_id: created.user.id,
    }).select().single();
    if (insErr) throw insErr;
    await svc.auth.admin.updateUserById(created.user.id, { app_metadata: { role: 'admin', label: BOOTSTRAP_ADMIN_NAME, user_id: row.id } });
    console.log(`Administrador "${BOOTSTRAP_ADMIN_NAME}" criado (CPF ${BOOTSTRAP_ADMIN_CPF}).`);
  } else {
    console.log('Sem BOOTSTRAP_ADMIN_* no ambiente — pulando criação do primeiro administrador.');
  }

  // 2) Empresas (+ usuário de Auth para quem já tinha clientPassword).
  const companyIdMap = new Map(); // id local -> id novo (Supabase gera o mesmo formato uuid, então mantemos o id local)
  for (const c of raw.companies || []) {
    companyIdMap.set(c.id, c.id);
    const { error } = await svc.from('companies').insert({
      id: c.id, razao_social: c.razaoSocial, nome_fantasia: c.nomeFantasia, cnpj: c.cnpj, tipo: c.tipo,
      endereco: c.endereco || null, foro_comarca: c.foroComarca || null,
    });
    if (error) throw error;
    if (c.clientPassword) {
      const digits = onlyDigits(c.cnpj);
      const { data: created, error: authErr } = await svc.auth.admin.createUser({
        email: loginEmail(digits), password: c.clientPassword, email_confirm: true,
        app_metadata: { role: 'client', company_id: c.id, label: c.nomeFantasia },
      });
      if (authErr) throw authErr;
      await svc.from('companies').update({ client_auth_user_id: created.user.id }).eq('id', c.id);
      console.log(`Empresa "${c.nomeFantasia}" (CNPJ ${c.cnpj}) migrada, login de cliente criado.`);
    } else {
      console.log(`Empresa "${c.nomeFantasia}" migrada (sem senha de cliente cadastrada).`);
    }
  }

  // 3) Sócios, contas bancárias, movimentações, mútuos — inserção direta (mesmos ids).
  for (const p of raw.partners || []) {
    const { error } = await svc.from('partners').insert({
      id: p.id, name: p.name, cpf: p.cpf, participation: p.participation, company_ids: p.companyIds || [], endereco: p.endereco || null,
    });
    if (error) throw error;
  }
  for (const a of raw.bankAccounts || []) {
    const { error } = await svc.from('bank_accounts').insert({
      id: a.id, owner_id: a.ownerId, owner_type: a.ownerType, bank_name: a.bankName, agency: a.agency || null,
      account_number: a.accountNumber, type: a.type,
    });
    if (error) throw error;
  }
  for (const t of raw.transactions || []) {
    const { error } = await svc.from('transactions').insert({
      id: t.id, date: t.date, company_id: t.companyId, partner_id: t.partnerId || null,
      origin_account_id: t.originAccountId, destination_account_id: t.destinationAccountId,
      value: t.value, type: t.type, nature: t.nature || null, description: t.description || null,
    });
    if (error) throw error;
  }
  for (const m of raw.mutuos || []) {
    const { error } = await svc.from('mutuos').insert({
      id: m.id, company_id: m.companyId, partner_id: m.partnerId, direction: m.direction, socio_tipo: m.socioTipo,
      value: m.value, release_date: m.releaseDate, first_installment_date: m.firstInstallmentDate || null,
      due_date: m.dueDate, parcelas: m.parcelas, annual_interest_pct: m.annualInterestPct, observacao: m.observacao || null,
    });
    if (error) throw error;
  }

  console.log('Migração concluída.');
}

main().catch(err => { console.error(err); process.exit(1); });
