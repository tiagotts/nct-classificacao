-- =============================================================================
-- Migração 0008 — datas de início e fim da etapa.
--
-- A coluna `data` virou `data_inicio` (semanticamente já era a data em que
-- a etapa começa) e ganhamos uma nova `data_fim` para etapas que se
-- estendem por mais de um dia.
-- =============================================================================

ALTER TABLE etapa RENAME COLUMN data TO data_inicio;
ALTER TABLE etapa ADD COLUMN data_fim TEXT;
