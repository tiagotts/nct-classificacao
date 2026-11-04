// Repositório da tabela de pontuação por colocação.
// Cada etapa_categoria pode ter a sua; quando não há nenhuma cadastrada,
// usa-se as faixas padrão do regulamento.
const { getDb } = require('../database');
const { FAIXAS_PADRAO, pontosDaColocacao } = require('../../motor/pontuacao');

// faixas(etapaCategoriaId): faixas de pontuação da categoria, ou as padrão.
function faixas(etapaCategoriaId) {
  const rows = getDb().prepare(
    `SELECT pos_ini, pos_fim, pontos FROM pontuacao
     WHERE etapa_categoria_id = ? ORDER BY pos_ini`).all(etapaCategoriaId);
  if (!rows.length) return FAIXAS_PADRAO;
  return rows.map(r => ({ ini: r.pos_ini, fim: r.pos_fim, pontos: r.pontos }));
}

// salvar(etapaCategoriaId, faixas): substitui as faixas de pontuação da
// categoria. faixas = [{ ini, fim, pontos }]. Lista vazia = volta ao padrão.
// Os pontos_ganhos das duplas são uma cópia das faixas no momento em que a
// colocação foi apurada; por isso são recalculados aqui, senão o ranking
// continuaria mostrando os valores antigos até o próximo placar.
function salvar(etapaCategoriaId, faixasNovas) {
  const db = getDb();
  const inserir = db.prepare(
    `INSERT INTO pontuacao (etapa_categoria_id, pos_ini, pos_fim, pontos)
     VALUES (?, ?, ?, ?)`);
  const atualizarDupla = db.prepare(
    'UPDATE dupla SET pontos_ganhos = ? WHERE id = ?');
  db.transaction(() => {
    db.prepare('DELETE FROM pontuacao WHERE etapa_categoria_id = ?')
      .run(etapaCategoriaId);
    for (const f of (faixasNovas || [])) {
      inserir.run(etapaCategoriaId, f.ini, f.fim, f.pontos);
    }
    const vigentes = faixas(etapaCategoriaId);
    const duplas = db.prepare(
      `SELECT id, colocacao_final FROM dupla
       WHERE etapa_categoria_id = ? AND colocacao_final IS NOT NULL`)
      .all(etapaCategoriaId);
    for (const d of duplas) {
      atualizarDupla.run(pontosDaColocacao(d.colocacao_final, vigentes), d.id);
    }
  })();
  return faixas(etapaCategoriaId);
}

module.exports = { faixas, salvar };
