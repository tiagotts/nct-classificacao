-- =============================================================================
-- Migração 0002 — novo catálogo de categorias e campo "tipo" na etapa_categoria.
--
-- Mudanças:
--  - etapa_categoria ganha a coluna "tipo" (masculino|feminino): a mesma
--    categoria pode ser disputada nas duas versões na mesma etapa.
--  - O catálogo de categorias passa a ser: Aberto, Intermediário, Master 45+,
--    Master 50+, Sub 18, Sub 15. As categorias antigas são removidas.
--
-- Como o tipo é obrigatório e as categorias antigas saem, os dados de
-- competição já cadastrados (etapas, categorias da etapa, duplas, jogos e
-- pontuação) são apagados. Temporadas e atletas são preservados.
-- =============================================================================

-- Adia a checagem de FKs até o commit: necessário porque a tabela jogo
-- referencia a si mesma (origem dos jogos do mata-mata).
PRAGMA defer_foreign_keys = ON;

-- Limpa os dados que dependem das categorias antigas (filhos antes dos pais).
DELETE FROM jogo;
DELETE FROM pontuacao;
DELETE FROM dupla;
DELETE FROM etapa_categoria;
DELETE FROM etapa;
DELETE FROM categoria;

-- Zera os contadores de AUTOINCREMENT das tabelas esvaziadas, para os novos
-- registros voltarem a começar do id 1.
DELETE FROM sqlite_sequence
  WHERE name IN ('categoria', 'etapa', 'dupla', 'jogo', 'pontuacao');

-- Recria etapa_categoria com a coluna "tipo" e a nova chave única
-- (etapa + categoria + tipo). A tabela foi esvaziada acima, então pode
-- ser recriada com segurança; as tabelas filhas também estão vazias.
DROP TABLE etapa_categoria;
CREATE TABLE etapa_categoria (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  etapa_id     INTEGER NOT NULL REFERENCES etapa(id),
  categoria_id INTEGER NOT NULL REFERENCES categoria(id),
  tipo         TEXT NOT NULL CHECK (tipo IN ('masculino', 'feminino')),
  num_grupos   INTEGER,
  config_json  TEXT,
  UNIQUE (etapa_id, categoria_id, tipo)
);
CREATE INDEX idx_etapacat_etapa     ON etapa_categoria (etapa_id);
CREATE INDEX idx_etapacat_categoria ON etapa_categoria (categoria_id);

-- Novo catálogo fixo de categorias do circuito.
INSERT INTO categoria (nome, slug) VALUES
  ('Aberto',        'aberto'),
  ('Intermediário', 'intermediario'),
  ('Master 45+',    'master45'),
  ('Master 50+',    'master50'),
  ('Sub 18',        'sub18'),
  ('Sub 15',        'sub15');
