-- =============================================================================
-- Migração 0010 — cores da temporada.
--
-- Duas cores escolhidas no cadastro da temporada (hex como "#rrggbb"). A UI
-- e a página publicada usam essas cores como primária e secundária; as
-- variantes (dark, tint) são derivadas em código. Quando nulas, cai na
-- paleta padrão NCT (azul oceano + amarelo).
-- =============================================================================

ALTER TABLE temporada ADD COLUMN cor_primaria TEXT;
ALTER TABLE temporada ADD COLUMN cor_secundaria TEXT;
