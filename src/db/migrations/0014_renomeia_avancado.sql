-- =============================================================================
-- Migração 0014 — renomeia "Avançado Masc" para apenas "Avançado".
--
-- Também ajusta o slug (de "avancado-masc" para "avancado"), que é usado
-- no nome do arquivo HTML publicado. Páginas já publicadas com o nome
-- antigo ficam órfãs no GitHub Pages até serem republicadas.
-- =============================================================================

UPDATE categoria
   SET nome = 'Avançado', slug = 'avancado'
 WHERE slug = 'avancado-masc';
