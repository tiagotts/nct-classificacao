-- =============================================================================
-- Migração 0001 — schema inicial do NCT Classificação.
-- Cria todas as tabelas do modelo e semeia o catálogo fixo de categorias.
-- O runner de migrações (database.js) aplica este arquivo e ajusta o
-- PRAGMA user_version automaticamente — não defina user_version aqui.
-- =============================================================================

-- Temporada do circuito (ex: Circuito NCT 2025).
CREATE TABLE temporada (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  ano  INTEGER NOT NULL
);

-- Etapa: um evento do circuito (1ª etapa, 2ª etapa...).
CREATE TABLE etapa (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  temporada_id INTEGER NOT NULL REFERENCES temporada(id),
  nome         TEXT NOT NULL,
  data         TEXT,
  local        TEXT
);

-- Catálogo fixo de categorias do circuito.
CREATE TABLE categoria (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE
);

-- Categoria efetivamente disputada numa etapa. É a unidade de competição
-- independente: cada linha tem sua própria fase de grupos, classificação
-- e chave. config_json guarda critérios de desempate, fórmula do average
-- e cruzamentos do mata-mata daquela categoria.
CREATE TABLE etapa_categoria (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  etapa_id     INTEGER NOT NULL REFERENCES etapa(id),
  categoria_id INTEGER NOT NULL REFERENCES categoria(id),
  num_grupos   INTEGER,
  config_json  TEXT,
  UNIQUE (etapa_id, categoria_id)
);

-- Atleta: a pessoa. Reutilizável entre etapas e categorias.
CREATE TABLE atleta (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL
);

-- Dupla: a parceria de dois atletas inscrita numa categoria de uma etapa.
-- Como os parceiros mudam entre etapas, a dupla pertence a uma
-- etapa_categoria (não é cadastro global). colocacao_final e pontos_ganhos
-- são preenchidos quando a competição da categoria encerra.
CREATE TABLE dupla (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  etapa_categoria_id INTEGER NOT NULL REFERENCES etapa_categoria(id),
  codigo             TEXT NOT NULL,
  grupo              TEXT,
  atleta1_id         INTEGER NOT NULL REFERENCES atleta(id),
  atleta2_id         INTEGER NOT NULL REFERENCES atleta(id),
  colocacao_final    INTEGER,
  pontos_ganhos      INTEGER,
  UNIQUE (etapa_categoria_id, codigo)
);

-- Jogo da fase de grupos ou do mata-mata.
-- Jogo de grupo: dupla1_id/dupla2_id preenchidos na criação, origem* nulos.
-- Jogo de mata-mata: participantes definidos por origem*_jogo_id +
-- origem*_tipo ('vencedor'|'perdedor'); dupla1_id/dupla2_id ficam nulos
-- até o jogo de origem ser resolvido.
-- tipo_resultado trata os casos do regulamento: Wx0 (item 13) e
-- desistência (item 14).
CREATE TABLE jogo (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  etapa_categoria_id INTEGER NOT NULL REFERENCES etapa_categoria(id),
  fase               TEXT NOT NULL,
  num                INTEGER,
  grupo              TEXT,
  dupla1_id          INTEGER REFERENCES dupla(id),
  dupla2_id          INTEGER REFERENCES dupla(id),
  origem1_jogo_id    INTEGER REFERENCES jogo(id),
  origem1_tipo       TEXT CHECK (origem1_tipo IN ('vencedor', 'perdedor')),
  origem2_jogo_id    INTEGER REFERENCES jogo(id),
  origem2_tipo       TEXT CHECK (origem2_tipo IN ('vencedor', 'perdedor')),
  placar1            INTEGER,
  placar2            INTEGER,
  tipo_resultado     TEXT NOT NULL DEFAULT 'normal'
                     CHECK (tipo_resultado IN ('normal', 'wx0', 'desistencia'))
);

-- Tabela de pontuação por colocação, em faixas. Por etapa_categoria, pois
-- o regulamento é por categoria. Ex (Sub 17): (1,1,200) (2,2,180) (3,3,160)
-- (4,4,140) (5,8,120) (9,99,100).
CREATE TABLE pontuacao (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  etapa_categoria_id INTEGER NOT NULL REFERENCES etapa_categoria(id),
  pos_ini            INTEGER NOT NULL,
  pos_fim            INTEGER NOT NULL,
  pontos             INTEGER NOT NULL
);

-- Índices das chaves estrangeiras mais consultadas.
CREATE INDEX idx_etapa_temporada    ON etapa (temporada_id);
CREATE INDEX idx_etapacat_etapa     ON etapa_categoria (etapa_id);
CREATE INDEX idx_etapacat_categoria ON etapa_categoria (categoria_id);
CREATE INDEX idx_dupla_ec           ON dupla (etapa_categoria_id);
CREATE INDEX idx_jogo_ec            ON jogo (etapa_categoria_id);
CREATE INDEX idx_pontuacao_ec       ON pontuacao (etapa_categoria_id);

-- Catálogo fixo de categorias do circuito.
INSERT INTO categoria (nome, slug) VALUES
  ('Master', 'master'),
  ('Open',   'open'),
  ('Sub 21', 'sub21'),
  ('Sub 17', 'sub17');
