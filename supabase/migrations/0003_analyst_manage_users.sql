-- Iguala o Analista Contábil ao Administrador na tela de Usuários (Controle de Acesso):
-- agora pode listar os usuários cadastrados (a escrita em si sempre passou pelas Edge
-- Functions com service-role, atualizadas separadamente para aceitar analyst também).
drop policy if exists "admin read access users" on access_users;

create policy "staff read access users" on access_users
  for select using (is_staff());
