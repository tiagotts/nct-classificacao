-- =============================================================================
-- Migração 0004 — placar por sets.
--
-- A coluna "sets" guarda, em JSON, o placar de cada set de um jogo de
-- múltiplos sets (ex.: a final em melhor de 3): [[21,18],[19,21],[15,12]].
-- Jogos de set único deixam "sets" nulo e usam placar1/placar2 normalmente.
-- Num jogo com sets, placar1/placar2 guardam os sets vencidos por cada dupla.
-- =============================================================================

ALTER TABLE jogo ADD COLUMN sets TEXT;
