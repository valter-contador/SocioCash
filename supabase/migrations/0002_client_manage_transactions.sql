-- Libera o perfil "client" (empresa logada por CNPJ) para lançar/editar/excluir as
-- próprias movimentações (aba Movimentações), já que os lançamentos de retirada
-- passam a ser feitos pelo preposto da empresa. Continua restrito à própria
-- company_id (mesma regra de leitura já existente) e não muda nada para
-- companies/partners/bank_accounts/mutuos, que seguem só leitura para client.
drop policy if exists "client read own transactions" on transactions;

create policy "client manage own transactions" on transactions
  for all
  using (auth_role() = 'client' and company_id = auth_company_id())
  with check (auth_role() = 'client' and company_id = auth_company_id());
