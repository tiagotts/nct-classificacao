-- =============================================================================
-- Migração 0003 — formato de disputa da fase de grupos.
--
-- A etapa_categoria ganha a coluna "formato":
--   - 'todos-contra-todos'  : round-robin dentro do grupo (padrão).
--   - 'dupla-eliminatoria'  : dupla eliminatória dentro do grupo.
-- As linhas já existentes recebem o padrão 'todos-contra-todos'.
-- =============================================================================

ALTER TABLE etapa_categoria
  ADD COLUMN formato TEXT NOT NULL DEFAULT 'todos-contra-todos'
  CHECK (formato IN ('todos-contra-todos', 'dupla-eliminatoria'));
