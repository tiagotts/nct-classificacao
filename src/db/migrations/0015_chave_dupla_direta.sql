-- =============================================================================
-- Migração 0015 — novo formato de disputa "chave-dupla-direta" e origem do
-- ranking para gerar essa chave.
--
-- Amplia o CHECK do campo `formato` em etapa_categoria (novo valor
-- 'chave-dupla-direta') e adiciona a coluna `origem_ranking`, usada só
-- quando o formato é chave dupla direta. Valores previstos:
--   - 'temporada' : ordem sai do ranking acumulado da temporada
--   - 'manual'    : ordem é definida pelo operador antes de gerar a chave
--
-- SQLite não permite ALTER TABLE para trocar o CHECK, então recriamos a
-- tabela (padrão "12-step ALTER TABLE"). Os dados existentes são
-- preservados; nenhum registro atual usa o novo formato ou a nova coluna.
-- =============================================================================

CREATE TABLE etapa_categoria_new (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  etapa_id        INTEGER NOT NULL REFERENCES etapa(id),
  categoria_id    INTEGER NOT NULL REFERENCES categoria(id),
  tipo            TEXT CHECK (tipo IS NULL OR tipo IN ('masculino', 'feminino')),
  num_grupos      INTEGER,
  config_json     TEXT,
  formato         TEXT NOT NULL DEFAULT 'todos-contra-todos'
                  CHECK (formato IN ('todos-contra-todos',
                                     'dupla-eliminatoria',
                                     'chave-dupla-direta')),
  origem_ranking  TEXT CHECK (origem_ranking IS NULL
                              OR origem_ranking IN ('temporada', 'manual')),
  data_competicao TEXT,
  UNIQUE (etapa_id, categoria_id, tipo)
);

INSERT INTO etapa_categoria_new
  (id, etapa_id, categoria_id, tipo, num_grupos, config_json, formato,
   origem_ranking, data_competicao)
  SELECT id, etapa_id, categoria_id, tipo, num_grupos, config_json, formato,
         NULL, data_competicao
    FROM etapa_categoria;

DROP TABLE etapa_categoria;
ALTER TABLE etapa_categoria_new RENAME TO etapa_categoria;

CREATE INDEX idx_etapacat_etapa     ON etapa_categoria (etapa_id);
CREATE INDEX idx_etapacat_categoria ON etapa_categoria (categoria_id);
