// =============================================================================
// Gerador da página pública de uma categoria de uma etapa.
// Lê os dados do banco e produz um HTML estático e autocontido (CSS embutido,
// sem JavaScript) — pronto para ser hospedado e aberto pelos jogadores.
// A página traz só a competição daquela categoria: classificação dos grupos
// (com average), jogos da fase de grupos e mata-mata. Não inclui rankings.
// =============================================================================

const fs = require('fs');
const path = require('path');
const etapaRepo = require('../db/repositorios/etapa');
const temporadaRepo = require('../db/repositorios/temporada');
const ecRepo = require('../db/repositorios/etapa-categoria');
const duplaRepo = require('../db/repositorios/dupla');
const jogoRepo = require('../db/repositorios/jogo');
const classificacaoRepo = require('../db/repositorios/classificacao');
const rankingTemporadaRepo = require('../db/repositorios/ranking-temporada');

// Logotipo NCT embutido na página (data URI base64) — mantém a página
// 100% autocontida, sem dependências externas.
const LOGO_PATH = path.join(__dirname, '..', '..', 'imagens', 'NCT_Fatiado_Padrao.png');
let logoCache = null;
function logoDataUri() {
  if (logoCache != null) return logoCache;
  try {
    const buf = fs.readFileSync(LOGO_PATH);
    logoCache = `data:image/png;base64,${buf.toString('base64')}`;
  } catch {
    logoCache = '';
  }
  return logoCache;
}

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

// Período da etapa: "11/06/2026" ou "11/06/2026 a 13/06/2026" quando há
// data de fim e ela é diferente da de início.
function fmtPeriodo(inicio, fim) {
  const i = fmtData(inicio);
  const f = fmtData(fim);
  if (i && f && i !== f) return `${i} a ${f}`;
  return i || f;
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

// Placar do jogo. Em W×0, mostra "W × 0" / "0 × W" / "0 × 0" (duplo W×0)
// com a tag W×0 logo abaixo. Em jogo de múltiplos sets, mostra os sets
// vencidos e, abaixo, o placar de cada set (ex.: 2 × 1 / 21-18, 19-21, 15-12).
function placarJogo(j) {
  if (j.tipo_resultado === 'wx0') {
    const p1 = Number(j.placar1) || 0;
    const p2 = Number(j.placar2) || 0;
    const lado1 = p1 > p2 ? 'W' : '0';
    const lado2 = p2 > p1 ? 'W' : '0';
    return `${lado1} × ${lado2}<br><span class="sets">W×0</span>`;
  }
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

// Lista <li> do pódio (1º ao 4º) a partir das colocações finais. Retorna ''
// se nenhuma colocação ainda foi apurada. O wrapper (div.podio + título)
// fica a cargo de quem chama, porque o título muda entre contextos.
function itensPodio(duplas) {
  return ['Campeão', 'Vice', '3º lugar', '4º lugar'].map((rotulo, i) => {
    const d = duplas.find(x => x.colocacao_final === i + 1);
    return d ? `<li><b>${esc(rotulo)}:</b> ${esc(d.atleta1_nome)} / `
      + `${esc(d.atleta2_nome)}</li>` : '';
  }).join('');
}

function blocoMataMata(mata, mapa, duplas) {
  const porFase = {};
  mata.forEach(j => { (porFase[j.fase] = porFase[j.fase] || []).push(j); });

  let html = '';
  for (const f of ORDEM_FASE) {
    if (!porFase[f]) continue;
    html += `<h4>${ROTULO_FASE[f]}</h4>${tabelaJogos(porFase[f], mapa)}`;
  }

  const podio = itensPodio(duplas);
  if (podio) {
    html += `<div class="podio"><h4>Resultado final</h4><ul>${podio}</ul></div>`;
  }
  return html;
}

// Ranking final da etapa por categoria: todas as duplas com a sua colocação
// final e pontos ganhos. Colocações de faixa (ex.: 5º-8º) aparecem agrupadas.
function tabelaRankingEtapa(duplas) {
  const ranqueadas = duplas
    .filter(d => d.colocacao_final != null)
    .sort((a, b) => a.colocacao_final - b.colocacao_final);
  if (!ranqueadas.length) return '';

  // Conta quantas duplas terminam em cada colocação para virar faixa.
  const contagem = {};
  for (const d of ranqueadas) {
    contagem[d.colocacao_final] = (contagem[d.colocacao_final] || 0) + 1;
  }

  const linhas = ranqueadas.map(d => {
    const c = d.colocacao_final;
    const n = contagem[c];
    const rotulo = n > 1 ? `${c}º-${c + n - 1}º` : `${c}º`;
    return `<tr>
        <td class="c">${rotulo}</td>
        <td>${esc(d.codigo)} — ${esc(d.atleta1_nome)} / ${esc(d.atleta2_nome)}</td>
        <td class="c">${d.pontos_ganhos != null ? d.pontos_ganhos : '–'}</td></tr>`;
  }).join('');

  return `<table><thead><tr>
      <th class="c">Colocação</th><th>Dupla</th><th class="c">Pontos</th>
    </tr></thead><tbody>${linhas}</tbody></table>`;
}

// Ranking da temporada (acumulado por atleta) — usado na página geral da etapa.
function tabelaRanking(ranking, etapas) {
  const colsEtapa = etapas.map(e =>
    `<th class="c">${esc(e.nome)}</th>`).join('');
  const linhas = ranking.map(a => {
    const cels = etapas.map(e => {
      const p = a.pontosPorEtapa && a.pontosPorEtapa[e.id];
      return `<td class="c">${p || 0}</td>`;
    }).join('');
    return `<tr>
        <td class="c">${a.posicao}</td><td>${esc(a.nome)}</td>
        <td class="c">${a.pontosIniciais || 0}</td>
        ${cels}
        <td class="c"><strong>${a.pontos}</strong></td></tr>`;
  }).join('');
  return `<table><thead><tr>
      <th class="c">#</th><th>Atleta</th>
      <th class="c">Inicial</th>${colsEtapa}<th class="c">Total</th>
    </tr></thead><tbody>${linhas}</tbody></table>`;
}

// Caminho do arquivo de uma categoria publicada (usado para gerar os links
// da página geral da etapa para as páginas individuais).
function caminhoCategoriaHtml(ec, ano) {
  const slug = ec.categoria_slug || `cat${ec.categoria_id}`;
  return `etapa-${ano}-${ec.etapa_id}-${slug}-${ec.tipo}.html`;
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

// Paleta NCT: azul navy (#13325c) e oceano vibrante (#1e7fc4) do logo,
// amarelo/dourado (#fbbf24) do sol, areia (#f6efe1) como fundo neutro.
const CSS = `
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;
background:#f6efe1;color:#13325c;line-height:1.45}
header{background:linear-gradient(135deg,#1e7fc4,#13325c);color:#fff;padding:20px 16px;
display:flex;align-items:center;gap:14px;border-bottom:3px solid #fbbf24}
header img.logo{height:64px;width:auto;flex-shrink:0;background:#fff;
border-radius:8px;padding:6px}
header .header-text{flex:1;min-width:0}
header .header-temporada{
font-size:12px;text-transform:uppercase;letter-spacing:.08em;opacity:.85;
font-weight:600;margin:0 0 2px}
header h1{margin:0;font-size:22px;line-height:1.2}
header .header-periodo{margin:4px 0 0;opacity:.9;font-size:13px;font-weight:500}
.local{color:#6b7280;font-size:12px;margin:0 0 12px;font-style:italic}
main{max-width:760px;margin:0 auto;padding:16px}
.atualizado{color:#6b7280;font-size:12px;margin:0 0 16px}
.categoria{background:#fff;border:1px solid #d8d2c3;border-radius:10px;padding:16px;margin-bottom:16px}
h2{color:#13325c;font-size:18px;margin:0 0 12px;border-bottom:2px solid #fbbf24;padding-bottom:6px}
h3{color:#1e7fc4;font-size:13px;margin:18px 0 8px;text-transform:uppercase;letter-spacing:.05em}
h4{font-size:13px;margin:12px 0 4px}
table{width:100%;border-collapse:collapse;font-size:13px;margin-bottom:8px}
th{background:#f6efe1;text-align:left;padding:6px 8px;font-size:11px;
text-transform:uppercase;color:#6b7280}
td{padding:6px 8px;border-top:1px solid #f1ecdd}
td.c,th.c{text-align:center}
td.placar{font-weight:700;white-space:nowrap}
.sets{font-size:11px;font-weight:400;color:#6b7280}
.podio{background:#fffbeb;border:1px solid #fbbf24;border-radius:8px;padding:10px 14px;margin-top:10px}
.podio h4{margin:0 0 6px;color:#92400e}
.podio ul{margin:0;padding-left:18px}
.lista-cats{list-style:none;padding:0;margin:0 0 8px;display:flex;flex-wrap:wrap;gap:8px}
.lista-cats li a{display:inline-block;padding:8px 12px;background:#1e7fc4;color:#fff;
border-radius:6px;text-decoration:none;font-size:13px}
.lista-cats li a:hover{background:#13325c}
.vazio{color:#6b7280;text-align:center;padding:20px}
footer{text-align:center;color:#6b7280;font-size:12px;padding:20px}
i{color:#6b7280}
/* Botão flutuante "Gerar PDF" — visível só na tela, escondido na impressão. */
.btn-pdf{position:fixed;top:14px;right:14px;z-index:10;
background:#fbbf24;color:#13325c;border:1px solid #f7a300;
padding:8px 14px;border-radius:8px;font-size:13px;font-weight:600;
font-family:inherit;cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,.18);
transition:.15s}
.btn-pdf:hover{background:#f7a300;color:#fff}
@media print{
  @page{size:A4;margin:14mm 12mm}
  body{background:#fff}
  .btn-pdf,.atualizado,footer{display:none !important}
  header{background:#13325c !important;color:#fff !important;
    -webkit-print-color-adjust:exact;print-color-adjust:exact;
    border-bottom:3px solid #fbbf24 !important}
  *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  main{padding:0}
  .categoria{box-shadow:none;border:0;padding:0;margin:0}
  table,.podio{page-break-inside:avoid}
  thead{display:table-header-group}
  tr{page-break-inside:avoid}
  h3{page-break-after:avoid}
}`;

// Script injetado na página pública: a cada 30s, busca a própria URL sem
// cache, compara a meta "versao" e — se mudou — recarrega forçando bypass
// do cache do navegador/CDN (usando uma query string nova). Isso reduz o
// delay perceptível depois de publicar com a página já aberta.
const AUTO_RELOAD_JS = `(function () {
  var meta = document.querySelector('meta[name="versao"]');
  if (!meta || !window.fetch) return;
  var atual = meta.content;
  setInterval(function () {
    fetch(location.pathname + '?_check=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.text() : ''; })
      .then(function (html) {
        var m = html.match(/<meta name="versao" content="([^"]+)"/);
        if (m && m[1] !== atual) {
          location.replace(location.pathname + '?_v=' + Date.now());
        }
      })
      .catch(function () {});
  }, 30000);
})();`;

// Cabeçalho fixo de todas as páginas publicadas:
//   linha 1 — nome da temporada
//   linha 2 — nome da etapa (h1)
//   linha 3 — período (data início — data fim)
// O título do navegador (tituloMeta) é o nome mais específico (categoria
// nas páginas de categoria, etapa na página geral).
function paginaHtml({ tituloMeta, temporadaNome, etapaNome, periodo }, corpo) {
  const agora = new Date();
  const versao = agora.getTime();
  const agoraFmt = agora.toLocaleString('pt-BR');
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="versao" content="${versao}">
<title>${esc(tituloMeta)} — NCT Classificação</title>
<style>${CSS}</style>
</head>
<body>
<header>
${logoDataUri() ? `<img class="logo" src="${logoDataUri()}" alt="NCT">` : ''}
<div class="header-text">
  <div class="header-temporada">${esc(temporadaNome || '')}</div>
  <h1>${esc(etapaNome || '')}</h1>
  <div class="header-periodo">${esc(periodo || '')}</div>
</div>
</header>
<main>
<p class="atualizado">Atualizado em ${esc(agoraFmt)}</p>
<button class="btn-pdf" type="button" onclick="window.print()" title="Gerar PDF desta página">Gerar PDF</button>
<section class="categoria">${corpo}</section>
</main>
<footer>Gerado pelo NCT Classificação</footer>
<script>${AUTO_RELOAD_JS}</script>
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
  const tituloCategoria = `${ec.categoria_nome}${tipo ? ' — ' + tipo : ''}`;
  // Nome da categoria vai como título da seção (h2) já que o h1 agora é a
  // etapa. Local entra abaixo do h2 quando existir.
  const sub = etapa.local ? `<p class="local">${esc(etapa.local)}</p>` : '';
  const corpo = `<h2>${esc(tituloCategoria)}</h2>${sub}${corpoCategoria(ec)}`;

  return paginaHtml({
    tituloMeta: tituloCategoria,
    temporadaNome: temporada && temporada.nome,
    etapaNome: etapa.nome,
    periodo: fmtPeriodo(etapa.data_inicio, etapa.data_fim),
  }, corpo);
}

/**
 * Gera o HTML da página GERAL da etapa: lista de categorias linkando para
 * as páginas individuais, pódio de cada categoria e ranking da temporada.
 * @param {number} etapaId
 * @returns {string} documento HTML completo
 */
function gerarPaginaEtapa(etapaId) {
  const etapa = etapaRepo.obter(etapaId);
  if (!etapa) throw new Error('Etapa não encontrada.');
  const temporada = temporadaRepo.obter(etapa.temporada_id);
  const ecs = ecRepo.listar(etapaId);
  const ano = (temporada && temporada.ano) || new Date().getFullYear();

  const cabecalho = {
    tituloMeta: etapa.nome,
    temporadaNome: temporada && temporada.nome,
    etapaNome: etapa.nome,
    periodo: fmtPeriodo(etapa.data_inicio, etapa.data_fim),
  };
  const localHtml = etapa.local ? `<p class="local">${esc(etapa.local)}</p>` : '';

  let corpo = localHtml;

  if (!ecs.length) {
    corpo += '<p class="vazio">Nenhuma categoria cadastrada nesta etapa.</p>';
    return paginaHtml(cabecalho, corpo);
  }

  // 1) Lista de categorias linkando para as páginas individuais.
  corpo += '<h3>Categorias</h3><ul class="lista-cats">';
  for (const ec of ecs) {
    const tipoLabel = ROTULO_TIPO[ec.tipo] || ec.tipo || '';
    const titulo = `${ec.categoria_nome}${tipoLabel ? ' — ' + tipoLabel : ''}`;
    const url = caminhoCategoriaHtml(ec, ano);
    corpo += `<li><a href="${esc(url)}">${esc(titulo)}</a></li>`;
  }
  corpo += '</ul>';

  // 2) Pódio de cada categoria (Campeão/Vice/3º/4º) quando há colocação final.
  const podios = [];
  for (const ec of ecs) {
    const duplas = duplaRepo.listar(ec.id);
    const itens = itensPodio(duplas);
    if (!itens) continue;
    const tipoLabel = ROTULO_TIPO[ec.tipo] || ec.tipo || '';
    const titulo = `${ec.categoria_nome}${tipoLabel ? ' — ' + tipoLabel : ''}`;
    podios.push(`<div class="podio"><h4>${esc(titulo)}</h4><ul>${itens}</ul></div>`);
  }
  if (podios.length) {
    corpo += `<h3>Pódio por categoria</h3>${podios.join('')}`;
  }

  // 3) Ranking final da etapa: todas as duplas com colocação e pontos.
  const rankingsEtapa = [];
  for (const ec of ecs) {
    const duplas = duplaRepo.listar(ec.id);
    const tabela = tabelaRankingEtapa(duplas);
    if (!tabela) continue;
    const tipoLabel = ROTULO_TIPO[ec.tipo] || ec.tipo || '';
    const titulo = `${ec.categoria_nome}${tipoLabel ? ' — ' + tipoLabel : ''}`;
    rankingsEtapa.push(`<h4>${esc(titulo)}</h4>${tabela}`);
  }
  if (rankingsEtapa.length) {
    corpo += `<h3>Ranking final por categoria</h3>${rankingsEtapa.join('')}`;
  }

  // 4) Ranking da temporada (acumulado por atleta) — uma seção por categoria.
  if (temporada) {
    const tabelas = [];
    for (const ec of ecs) {
      const { etapas, ranking } = rankingTemporadaRepo.calcular(
        temporada.id, ec.categoria_id, ec.tipo);
      if (!ranking.length) continue;
      const tipoLabel = ROTULO_TIPO[ec.tipo] || ec.tipo || '';
      const titulo = `${ec.categoria_nome}${tipoLabel ? ' — ' + tipoLabel : ''}`;
      tabelas.push(`<h4>${esc(titulo)}</h4>${tabelaRanking(ranking, etapas)}`);
    }
    if (tabelas.length) {
      corpo += `<h3>Ranking da temporada</h3>${tabelas.join('')}`;
    }
  }

  return paginaHtml(cabecalho, corpo);
}

module.exports = { gerarPaginaCategoria, gerarPaginaEtapa };
