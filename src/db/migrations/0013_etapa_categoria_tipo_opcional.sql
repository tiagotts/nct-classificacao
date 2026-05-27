-- =============================================================================
-- Migração 0013 — torna etapa_categoria.tipo opcional (NULL permitido).
--
-- Categorias como "Misto" (dupla M+F) não se encaixam nas opções
-- masculino/feminino. Em vez de criar um tipo novo, permitimos que o
-- campo fique nulo nessas categorias.
--
-- SQLite não tem ALTER TABLE pra remover NOT NULL/CHECK; recriamos a
-- tabela. As tabelas filhas (jogo, dupla, pontuacao) referenciam por
-- etapa_categoria_id, então não precisam ser recriadas.
-- =============================================================================

PRAGMA defer_foreign_keys = ON;

CREATE TABLE etapa_categoria_new (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  etapa_id        INTEGER NOT NULL REFERENCES etapa(id),
  categoria_id    INTEGER NOT NULL REFERENCES categoria(id),
  tipo            TEXT CHECK (tipo IS NULL OR tipo IN ('masculino', 'feminino')),
  num_grupos      INTEGER,
  config_json     TEXT,
  formato         TEXT NOT NULL DEFAULT 'todos-contra-todos'
                  CHECK (formato IN ('todos-contra-todos', 'dupla-eliminatoria')),
  data_competicao TEXT,
  UNIQUE (etapa_id, categoria_id, tipo)
);

INSERT INTO etapa_categoria_new
  (id, etapa_id, categoria_id, tipo, num_grupos, config_json, formato,
   data_competicao)
  SELECT id, etapa_id, categoria_id, tipo, num_grupos, config_json, formato,
         data_competicao
    FROM etapa_categoria;

DROP TABLE etapa_categoria;
ALTER TABLE etapa_categoria_new RENAME TO etapa_categoria;

CREATE INDEX idx_etapacat_etapa     ON etapa_categoria (etapa_id);
CREATE INDEX idx_etapacat_categoria ON etapa_categoria (categoria_id);
