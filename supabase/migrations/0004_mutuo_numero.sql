-- Numeração sequencial do Contrato de Mútuo (controle único, cross-empresa).
-- Exibida como NNNN.dd.mm.aaaa, onde dd.mm.aaaa é a data de liberação
-- (crédito do valor ao mutuário) — formatação feita no app, aqui só o inteiro.

alter table mutuos add column numero integer;

-- Backfill dos contratos já existentes, na ordem de criação.
with numbered as (
  select id, row_number() over (order by created_at) as rn
  from mutuos
)
update mutuos m set numero = numbered.rn
from numbered where numbered.id = m.id;

alter table mutuos alter column numero set not null;
alter table mutuos add constraint mutuos_numero_unique unique (numero);
