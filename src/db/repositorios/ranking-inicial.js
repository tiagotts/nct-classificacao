// Repositório do ranking inicial da temporada (pontos pré-cadastrados por
// atleta numa categoria+tipo). Usado na 1ª etapa para montar o ranking de
// entrada e somado aos pontos das etapas seguintes.
const { getDb } = require('../database');
const atletaRepo = require('./atleta');

// listar(temporadaId, categoriaId, tipo): linhas de ranking inicial daquela
// categoria+tipo da temporada, com o nome do atleta.
function listar(temporadaId, categoriaId, tipo) {
  return getDb().prepare(`
    SELECT ri.id, ri.atleta_id,
           a.nome AS atleta_nome,
           a.nome_completo AS atleta_nome_completo,
           ri.pontos
    FROM ranking_inicial ri
    JOIN atleta a ON a.id = ri.atleta_id
    WHERE ri.temporada_id = ? AND ri.categoria_id = ? AND ri.tipo = ?
    ORDER BY ri.pontos DESC, a.nome
  `).all(temporadaId, categoriaId, tipo);
}

// porAtleta(temporadaId, categoriaId, tipo): { atletaId: pontos }
function porAtleta(temporadaId, categoriaId, tipo) {
  const rows = getDb().prepare(`
    SELECT atleta_id, pontos FROM ranking_inicial
    WHERE temporada_id = ? AND categoria_id = ? AND tipo = ?
  `).all(temporadaId, categoriaId, tipo);
  const mapa = {};
  for (const r of rows) mapa[r.atleta_id] = r.pontos;
  return mapa;
}

// salvar(temporadaId, categoriaId, tipo, entradas): substitui as linhas da
// categoria+tipo pelas entradas informadas. Cada entrada =
// { nome, nome_completo, pontos }; atletas inexistentes são criados pelo
// nome (apelido). Se a entrada já tem nome_completo e o atleta encontrado
// ainda não tem, o cadastro é atualizado. Linhas com nome em branco são
// ignoradas.
function salvar(temporadaId, categoriaId, tipo, entradas) {
  const db = getDb();
  const inserir = db.prepare(`
    INSERT INTO ranking_inicial (temporada_id, atleta_id, categoria_id, tipo, pontos)
    VALUES (?, ?, ?, ?, ?)
  `);
  const apagar = db.prepare(
    `DELETE FROM ranking_inicial
     WHERE temporada_id = ? AND categoria_id = ? AND tipo = ?`);

  db.transaction(() => {
    apagar.run(temporadaId, categoriaId, tipo);
    const usados = new Set();
    for (const e of (entradas || [])) {
      const nome = (e.nome || '').trim();
      if (!nome) continue;
      const nomeCompleto = (e.nome_completo || '').trim();
      let atleta = atletaRepo.buscar(nome).find(
        a => a.nome.toLowerCase() === nome.toLowerCase()
      );
      if (!atleta) {
        atleta = atletaRepo.criar({ nome, nome_completo: nomeCompleto || null });
      } else if (nomeCompleto && !atleta.nome_completo) {
        atleta = atletaRepo.atualizar(atleta.id,
          { nome: atleta.nome, nome_completo: nomeCompleto });
      }
      // Evita inserir o mesmo atleta duas vezes (a UNIQUE seguraria, mas o
      // erro pararia toda a transação).
      if (usados.has(atleta.id)) continue;
      usados.add(atleta.id);
      const pontos = Number(e.pontos) || 0;
      inserir.run(temporadaId, atleta.id, categoriaId, tipo, pontos);
    }
  })();
  return listar(temporadaId, categoriaId, tipo);
}

module.exports = { listar, porAtleta, salvar };
