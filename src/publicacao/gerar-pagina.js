// =============================================================================
// Gerador da página pública de uma categoria de uma etapa.
// Lê os dados do banco e produz um HTML estático e autocontido (CSS embutido,
// sem JavaScript) — pronto para ser hospedado e aberto pelos jogadores.
// A página traz só a competição daquela categoria: classificação dos grupos
// (com average), jogos da fase de grupos e mata-mata. Não inclui rankings.
// =============================================================================

const etapaRepo = require('../db/repositorios/etapa');
const temporadaRepo = require('../db/repositorios/temporada');
const ecRepo = require('../db/repositorios/etapa-categoria');
const duplaRepo = require('../db/repositorios/dupla');
const jogoRepo = require('../db/repositorios/jogo');
const classificacaoRepo = require('../db/repositorios/classificacao');

const ORDEM_FASE = ['oitavas', 'quartas', 'semi', 'final', 'terceiro'];
const ROTULO_FASE = {
  oitavas: 'Oitavas de final', quartas: 'Quartas de final',
  semi: 'Semifinais', final: 'Final', terceiro: 'Disputa de 3º lugar',
};
const ROTULO_TIPO = { masculino: 'Masculino', feminino: 'Feminino' };

function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
  }[c]));
}

function fmtData(iso) {
  if (!iso) return '';
  const [a, m, d] = iso.split('-');
  return (a && m && d) ? `${d}/${m}/${a}` : iso;
}

function fmtAvg(v, formula) {
  if (!isFinite(v)) return '—';
  return formula === 'diferenca' ? (v >= 0 ? '+' : '') + v : v.toFixed(3);
}

function nomeDupla(id, mapa) {
  const d = mapa[id];
  return d ? `${esc(d.codigo)} ${esc(d.atleta1_nome)} / ${esc(d.atleta2_nome)}`
    : '<i>a definir</i>';
}

// --- Gera o HTML de cada parte ----------------------------------------------

function tabelaClassificacao(grupo, lista, formula) {
  const linhas = lista.map(s => `<tr>
        <td class="c">${s.posicao}</td>
        <td>${esc(s.codigo)} — ${esc(s.nome)}</td>
        <td class="c">${s.J}</td><td class="c">${s.V}</td>
        <td class="c">${s.PP}</td><td class="c">${s.PC}</td>
        <td class="c">${fmtAvg(s.AVG, formula)}</td></tr>`).join('');
  return `<h4>Grupo ${esc(grupo)}</h4>
    <table><thead><tr><th class="c">#</th><th>Dupla</th><th class="c">J</th>
    <th class="c">V</th><th class="c">PP</th><th class="c">PC</th>
    <th class="c">AVG</th></tr></thead><tbody>${linhas}</tbody></table>`;
}

// Placar do jogo. Em jogo de múltiplos sets, mostra os sets vencidos e,
// abaixo, o placar de cada set (ex.: 2 × 1 / 21-18, 19-21, 15-12).
function placarJogo(j) {
  let txt = `${j.placar1 ?? '–'} × ${j.placar2 ?? '–'}`;
  if (j.sets) {
    try {
      const sets = JSON.parse(j.sets);
      if (sets.length) {
        txt += `<br><span class="sets">`
          + sets.map(s => `${esc(s[0])}-${esc(s[1])}`).join(', ') + '</span>';
      }
    } catch (e) { /* ignora */ }
  }
  return txt;
}

function tabelaJogos(jogos, mapa) {
  const linhas = jogos.map(j => `<tr>
        <td>${nomeDupla(j.dupla1_id, mapa)}</td>
        <td class="c placar">${placarJogo(j)}</td>
        <td>${nomeDupla(j.dupla2_id, mapa)}</td></tr>`).join('');
  return `<table><tbody>${linhas}</tbody></table>`;
}

function blocoMataMata(mata, mapa, duplas) {
  const porFase = {};
  mata.forEach(j => { (porFase[j.fase] = porFase[j.fase] || []).push(j); });

  let html = '';
  for (const f of ORDEM_FASE) {
    if (!porFase[f]) continue;
    html += `<h4>${ROTULO_FASE[f]}</h4>${tabelaJogos(porFase[f], mapa)}`;
  }

  const podio = ['Campeão', 'Vice', '3º lugar', '4º lugar'].map((rotulo, i) => {
    const d = duplas.find(x => x.colocacao_final === i + 1);
    return d ? `<li><b>${esc(rotulo)}:</b> ${esc(d.atleta1_nome)} / `
      + `${esc(d.atleta2_nome)}</li>` : '';
  }).join('');
  if (podio) {
    html += `<div class="podio"><h4>Resultado final</h4><ul>${podio}</ul></div>`;
  }
  return html;
}

// Corpo da página: classificação dos grupos (com average), jogos da fase de
// grupos e mata-mata. Sem rankings.
function corpoCategoria(ec) {
  const cls = classificacaoRepo.calcular(ec.id);
  const jogos = jogoRepo.listar(ec.id);
  const duplas = duplaRepo.listar(ec.id);
  const mapa = {};
  duplas.forEach(d => { mapa[d.id] = d; });

  let html = '';
  const grupos = Object.keys(cls.grupos);
  if (grupos.length) {
    html += '<h3>Classificação dos grupos</h3>';
    for (const g of grupos) {
      html += tabelaClassificacao(g, cls.grupos[g], cls.formulaAvg);
    }
    const jogosGrupo = jogos.filter(j => j.fase === 'grupo'
      && (j.placar1 != null || j.placar2 != null));
    if (jogosGrupo.length) {
      html += `<h3>Jogos da fase de grupos</h3>${tabelaJogos(jogosGrupo, mapa)}`;
    }
  }

  const mata = jogos.filter(j => j.fase !== 'grupo');
  if (mata.length) {
    html += `<h3>Mata-mata</h3>${blocoMataMata(mata, mapa, duplas)}`;
  }

  if (!grupos.length && !mata.length) {
    html += '<p class="vazio">Sem dados cadastrados nesta categoria.</p>';
  }
  return html;
}

const CSS = `
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;
background:#f6efe1;color:#1a2434;line-height:1.45}
header{background:linear-gradient(135deg,#0a6e7e,#063e48);color:#fff;padding:20px 16px}
header h1{margin:0;font-size:20px}
header p{margin:4px 0 0;opacity:.85;font-size:13px}
main{max-width:760px;margin:0 auto;padding:16px}
.atualizado{color:#6b7280;font-size:12px;margin:0 0 16px}
.categoria{background:#fff;border:1px solid #d8d2c3;border-radius:10px;padding:16px;margin-bottom:16px}
h2{color:#063e48;font-size:18px;margin:0 0 12px;border-bottom:2px solid #e7d9b4;padding-bottom:6px}
h3{color:#0a6e7e;font-size:13px;margin:18px 0 8px;text-transform:uppercase;letter-spacing:.05em}
h4{font-size:13px;margin:12px 0 4px}
table{width:100%;border-collapse:collapse;font-size:13px;margin-bottom:8px}
th{background:#f6efe1;text-align:left;padding:6px 8px;font-size:11px;
text-transform:uppercase;color:#6b7280}
td{padding:6px 8px;border-top:1px solid #f1ecdd}
td.c,th.c{text-align:center}
td.placar{font-weight:700;white-space:nowrap}
.sets{font-size:11px;font-weight:400;color:#6b7280}
.podio{background:#fffbeb;border:1px solid #f59e0b;border-radius:8px;padding:10px 14px;margin-top:10px}
.podio h4{margin:0 0 6px;color:#92400e}
.podio ul{margin:0;padding-left:18px}
.vazio{color:#6b7280;text-align:center;padding:20px}
footer{text-align:center;color:#6b7280;font-size:12px;padding:20px}
i{color:#6b7280}`;

function paginaHtml(titulo, subtitulo, corpo) {
  const agora = new Date().toLocaleString('pt-BR');
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${titulo} — NCT Classificação</title>
<style>${CSS}</style>
</head>
<body>
<header><h1>${titulo}</h1><p>${subtitulo}</p></header>
<main>
<p class="atualizado">Atualizado em ${esc(agora)}</p>
<section class="categoria">${corpo}</section>
</main>
<footer>Gerado pelo NCT Classificação</footer>
</body>
</html>`;
}

/**
 * Gera o HTML público de UMA categoria de uma etapa.
 * @param {number} etapaCategoriaId
 * @returns {string} documento HTML completo
 */
function gerarPaginaCategoria(etapaCategoriaId) {
  const ec = ecRepo.obter(etapaCategoriaId);
  if (!ec) throw new Error('Categoria da etapa não encontrada.');
  const etapa = etapaRepo.obter(ec.etapa_id);
  if (!etapa) throw new Error('Etapa não encontrada.');
  const temporada = temporadaRepo.obter(etapa.temporada_id);

  const tipo = ROTULO_TIPO[ec.tipo] || ec.tipo || '';
  const titulo = `${ec.categoria_nome}${tipo ? ' — ' + tipo : ''}`;
  const subtitulo = [
    etapa.nome, fmtData(etapa.data), etapa.local, temporada && temporada.nome,
  ].filter(Boolean).map(esc).join(' · ');

  return paginaHtml(esc(titulo), subtitulo, corpoCategoria(ec));
}

module.exports = { gerarPaginaCategoria };
