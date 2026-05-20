-- =============================================================================
-- Migração 0007 — ranking inicial por etapa.
--
-- Permite cadastrar pontos do ranking inicial por etapa já realizada
-- (formato da planilha do circuito: 1ª etapa, 2ª etapa, ...). A coluna
-- nova `etapa_id` é nullable: linhas com NULL representam pontos
-- pré-temporada (formato anterior), preservando os cadastros existentes.
--
-- Como o ALTER TABLE do SQLite não muda constraints UNIQUE, recriamos a
-- tabela copiando os dados antigos com etapa_id NULL. Os UNIQUE viram
-- dois índices parciais: um para a coluna "Inicial" (etapa_id NULL,
-- só uma linha por escopo) e outro para cada etapa (etapa_id NOT NULL,
-- uma linha por atleta+etapa).
-- =============================================================================

CREATE TABLE ranking_inicial_new (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  temporada_id INTEGER NOT NULL REFERENCES temporada(id),
  atleta_id    INTEGER NOT NULL REFERENCES atleta(id),
  categoria_id INTEGER NOT NULL REFERENCES categoria(id),
  tipo         TEXT NOT NULL CHECK (tipo IN ('masculino', 'feminino')),
  etapa_id     INTEGER REFERENCES etapa(id),
  pontos       INTEGER NOT NULL DEFAULT 0
);

INSERT INTO ranking_inicial_new
  (id, temporada_id, atleta_id, categoria_id, tipo, etapa_id, pontos)
  SELECT id, temporada_id, atleta_id, categoria_id, tipo, NULL, pontos
    FROM ranking_inicial;

DROP TABLE ranking_inicial;
ALTER TABLE ranking_inicial_new RENAME TO ranking_inicial;

CREATE INDEX idx_rankini_escopo
  ON ranking_inicial (temporada_id, categoria_id, tipo);

CREATE UNIQUE INDEX idx_rankini_inicial
  ON ranking_inicial (temporada_id, atleta_id, categoria_id, tipo)
  WHERE etapa_id IS NULL;

CREATE UNIQUE INDEX idx_rankini_etapa
  ON ranking_inicial (temporada_id, atleta_id, categoria_id, tipo, etapa_id)
  WHERE etapa_id IS NOT NULL;
