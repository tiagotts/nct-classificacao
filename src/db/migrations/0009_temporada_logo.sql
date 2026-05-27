-- =============================================================================
-- Migração 0009 — logo da temporada.
--
-- Guarda o nome do arquivo de logo escolhido na criação/edição da temporada.
-- O arquivo em si fica em imagens/logos/, distribuído com o app. Quando
-- nulo, o publicador usa o logo padrão (NCT_Fatiado_Padrao.png).
-- =============================================================================

ALTER TABLE temporada ADD COLUMN logo TEXT;
