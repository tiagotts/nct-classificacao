-- =============================================================================
-- Migração 0011 — novas categorias do circuito + data de competição da
-- categoria dentro da etapa.
--
-- Catálogo: adiciona Kids+Pai/Mãe, Iniciante 1, Misto Intermediário,
-- Avançado Masc, Teens e Iniciante 2. Intermediário já existe e é
-- preservado. Os slugs são usados nos nomes dos arquivos HTML publicados
-- (precisam ser ASCII e sem espaços).
--
-- etapa_categoria.data_competicao: a data (TEXT no formato YYYY-MM-DD) em
-- que aquela categoria daquela etapa vai competir. Nula até ser preenchida.
-- =============================================================================

INSERT OR IGNORE INTO categoria (nome, slug) VALUES
  ('Kids+Pai/Mãe',        'kids-pai-mae'),
  ('Iniciante 1',         'iniciante1'),
  ('Misto Intermediário', 'misto-intermediario'),
  ('Avançado Masc',       'avancado-masc'),
  ('Teens',               'teens'),
  ('Iniciante 2',         'iniciante2');

ALTER TABLE etapa_categoria ADD COLUMN data_competicao TEXT;
