-- =============================================================================
-- Migração 0006 — nome completo do atleta.
--
-- O campo `nome` passa a ser o apelido (curto, exibido em grids e tabelas
-- de duplas). `nome_completo` é o nome oficial, usado no ranking publicado
-- da temporada. Atletas antigos ficam com `nome_completo` nulo até serem
-- editados.
-- =============================================================================

ALTER TABLE atleta ADD COLUMN nome_completo TEXT;
