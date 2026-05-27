-- =============================================================================
-- Migração 0012 — renomeia "Misto Intermediário" para apenas "Misto".
--
-- Também ajusta o slug (de "misto-intermediario" para "misto"), que é usado
-- no nome do arquivo HTML publicado. Páginas já publicadas com o nome
-- antigo ficam órfãs no GitHub Pages até serem republicadas — não é
-- automático.
-- =============================================================================

UPDATE categoria
   SET nome = 'Misto', slug = 'misto'
 WHERE slug = 'misto-intermediario';
