// Repositório do ranking inicial da temporada (pontos pré-cadastrados por
// atleta numa categoria+tipo). Cada linha tem `etapa_id` opcional:
// - etapa_id NULL = pontos "Inicial" (pré-temporada).
// - etapa_id NOT NULL = pontos do atleta naquela etapa específica
//   (usado para importar resultados de etapas anteriores).
const { getDb } = require('../database');
const atletaRepo = require('./atleta');

// listar(temporadaId, categoriaId, tipo): linhas de ranking inicial daquela
// categoria+tipo da temporada, com o nome do atleta e a etapa (se houver).
function listar(temporadaId, categoriaId, tipo) {
  return getDb().prepare(`
    SELECT ri.id, ri.atleta_id, ri.etapa_id,
           a.nome AS atleta_nome,
           a.nome_completo AS atleta_nome_completo,
           ri.pontos
    FROM ranking_inicial ri
    JOIN atleta a ON a.id = ri.atleta_id
    WHERE ri.temporada_id = ? AND ri.categoria_id = ? AND ri.tipo = ?
    ORDER BY a.nome, ri.etapa_id
  `).all(temporadaId, categoriaId, tipo);
}

// porAtleta(temporadaId, categoriaId, tipo): { atletaId: total } onde total
// é a soma dos pontos da coluna "Inicial" (etapa_id NULL) com todas as
// etapas cadastradas para o atleta.
function porAtleta(temporadaId, categoriaId, tipo) {
  const rows = getDb().prepare(`
    SELECT atleta_id, SUM(pontos) AS total FROM ranking_inicial
    WHERE temporada_id = ? AND categoria_id = ? AND tipo = ?
    GROUP BY atleta_id
  `).all(temporadaId, categoriaId, tipo);
  const mapa = {};
  for (const r of rows) mapa[r.atleta_id] = r.total;
  return mapa;
}

// porAtletaPorEtapa(temporadaId, categoriaId, tipo):
//   { atletaId: { inicial: pontos, porEtapa: { etapaId: pontos } } }
// Usado pelo ranking de temporada para mostrar uma coluna por etapa.
function porAtletaPorEtapa(temporadaId, categoriaId, tipo) {
  const rows = getDb().prepare(`
    SELECT atleta_id, etapa_id, pontos FROM ranking_inicial
    WHERE temporada_id = ? AND categoria_id = ? AND tipo = ?
  `).all(temporadaId, categoriaId, tipo);
  const mapa = {};
  for (const r of rows) {
    const a = mapa[r.atleta_id] = mapa[r.atleta_id] || { inicial: 0, porEtapa: {} };
    if (r.etapa_id == null) a.inicial += r.pontos;
    else a.porEtapa[r.etapa_id] = (a.porEtapa[r.etapa_id] || 0) + r.pontos;
  }
  return mapa;
}

// salvar(temporadaId, categoriaId, tipo, entradas): substitui as linhas da
// categoria+tipo pelas entradas informadas. Cada entrada =
//   { nome, nome_completo, inicial, porEtapa: { etapaId: pontos } }
// Atletas inexistentes são criados pelo apelido; quem já existir mas estiver
// sem nome_completo recebe o cadastro. Linhas com nome em branco são
// ignoradas. Pontos zerados (inicial 0, sem etapas) descartam o atleta.
function salvar(temporadaId, categoriaId, tipo, entradas) {
  const db = getDb();
  const inserir = db.prepare(`
    INSERT INTO ranking_inicial
      (temporada_id, atleta_id, categoria_id, tipo, etapa_id, pontos)
    VALUES (?, ?, ?, ?, ?, ?)
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
      // Evita gravar o mesmo atleta duas vezes na mesma chamada.
      if (usados.has(atleta.id)) continue;
      usados.add(atleta.id);

      const inicial = Number(e.inicial) || 0;
      if (inicial) {
        inserir.run(temporadaId, atleta.id, categoriaId, tipo, null, inicial);
      }
      const porEtapa = e.porEtapa || {};
      for (const [etapaId, pts] of Object.entries(porEtapa)) {
        const p = Number(pts) || 0;
        if (!p) continue;
        inserir.run(temporadaId, atleta.id, categoriaId, tipo,
          Number(etapaId), p);
      }
    }
  })();
  return listar(temporadaId, categoriaId, tipo);
}

module.exports = { listar, porAtleta, porAtletaPorEtapa, salvar };
