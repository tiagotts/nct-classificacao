-- =============================================================================
-- Migração 0005 — ranking inicial da temporada.
--
-- Pontos pré-cadastrados de cada atleta numa categoria+tipo da temporada,
-- usados na 1ª etapa para montar o ranking de entrada (a ordem que dirige
-- a serpentina) e nos cálculos subsequentes do ranking acumulado.
-- A partir da 2ª etapa, o app SOMA esses pontos iniciais aos pontos
-- ganhos nas etapas já realizadas.
-- =============================================================================

CREATE TABLE ranking_inicial (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  temporada_id INTEGER NOT NULL REFERENCES temporada(id),
  atleta_id    INTEGER NOT NULL REFERENCES atleta(id),
  categoria_id INTEGER NOT NULL REFERENCES categoria(id),
  tipo         TEXT NOT NULL CHECK (tipo IN ('masculino', 'feminino')),
  pontos       INTEGER NOT NULL DEFAULT 0,
  UNIQUE (temporada_id, atleta_id, categoria_id, tipo)
);

CREATE INDEX idx_rankini_escopo
  ON ranking_inicial (temporada_id, categoria_id, tipo);
