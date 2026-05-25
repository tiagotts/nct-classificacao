// Tela "Classificados e Eliminados" de uma categoria: mostra os classificados
// (ordem do ranking geral, base para o mata-mata) e logo abaixo os eliminados.
// Duplas que terminaram empatadas (motivo "Sorteio") ganham setas para o
// usuário definir manualmente a ordem do sorteio — o app não sorteia.
// params: { etapaCategoriaId }
(() => {
  App.registrarTela('classificacao', { render });

  let estado = null;

  async function render(container, params) {
    estado = { etapaCategoriaId: params.etapaCategoriaId, container };
    await carregarEDesenhar();
  }

  async function carregarEDesenhar() {
    const { etapaCategoriaId, container } = estado;
    const [ec, r] = await Promise.all([
      window.electronAPI.db.etapaCategoria.obter(etapaCategoriaId),
      window.electronAPI.db.classificacao.calcular(etapaCategoriaId),
    ]);
    estado.ec = ec;
    estado.formulaAvg = r.formulaAvg;
    estado.classificados = r.ranking || [];

    // Eliminados = duplas que não estão no ranking de classificados.
    // Ordena por grupo e posição no grupo (3º A, 3º B, 4º A, ...).
    const idsClass = new Set(estado.classificados.map(s => s.id));
    const eliminados = [];
    for (const grupo of Object.keys(r.grupos || {}).sort()) {
      for (const s of r.grupos[grupo]) {
        if (!idsClass.has(s.id)) {
          eliminados.push({ ...s, posGrupo: s.posicao, grupoOrigem: grupo });
        }
      }
    }
    eliminados.sort((a, b) =>
      a.posGrupo - b.posGrupo || a.grupoOrigem.localeCompare(b.grupoOrigem));
    estado.eliminados = eliminados;

    if (!estado.classificados.length) {
      container.innerHTML = `
        <div class="topo-tela"><h2>Classificados e Eliminados</h2></div>
        <div class="vazio">Cadastre as duplas e os grupos, e lance os placares
          da fase de grupos para ver a classificação.</div>`;
      return;
    }

    desenhar();
  }

  function desenhar() {
    const { container, classificados, eliminados, formulaAvg } = estado;
    const blocos = encontrarBlocosEmpatados(classificados);
    const posDoIndice = new Map();
    blocos.forEach(b => {
      for (let k = b.start; k <= b.end; k++) {
        posDoIndice.set(k, { primeiro: k === b.start, ultimo: k === b.end });
      }
    });

    const temEmpate = blocos.length > 0;
    const dica = dicaTopo(temEmpate);

    container.innerHTML = `
      <div class="topo-tela"><h2>Classificados e Eliminados</h2></div>
      ${dica}
      <table class="tab-class">
        <thead><tr>
          <th class="idx">Posição</th>
          <th>Dupla</th>
          <th class="n">Classif. no grupo</th>
          <th class="n">Vitórias</th>
          <th class="n">Average</th>
          <th class="col-ordem">Ordem</th>
        </tr></thead>
        <tbody>
          ${classificados.map((s, i) =>
            linhaHtml(s, i + 1, false, formulaAvg, posDoIndice.get(i), i)).join('')}
          ${eliminados.map((s, i) =>
            linhaHtml(s, classificados.length + i + 1, true, formulaAvg, null, -1)).join('')}
        </tbody>
      </table>`;

    container.querySelectorAll('[data-mover]').forEach(b => {
      b.onclick = () => moverClassificado(Number(b.dataset.i), b.dataset.mover);
    });
  }

  function dicaTopo(temEmpate) {
    if (temEmpate) {
      return `<p class="dica">Classificados (1º a ${estado.classificados.length}º)
        seguem para o mata-mata; eliminados ficam em vermelho.
        <strong>Há duplas empatadas após os critérios</strong> — use as setas
        ↑↓ para definir manualmente a ordem do sorteio. Se a chave já foi
        gerada, lembre de regerar para refletir a nova ordem.</p>`;
    }
    return `<p class="dica">Classificados (1º a ${estado.classificados.length}º) seguem para
        o mata-mata; eliminados ficam em vermelho.</p>`;
  }

  function linhaHtml(s, pos, eliminado, formula, blocoInfo, idx) {
    const cls = eliminado ? ' class="eliminado"' : '';
    const empatado = !!blocoInfo;
    const tagSorteio = empatado
      ? ' <span class="tie-flag sorteio">Sorteio</span>' : '';
    const podeSubir = empatado && !blocoInfo.primeiro;
    const podeDescer = empatado && !blocoInfo.ultimo;
    const acoes = (!eliminado && empatado) ? `
      <button class="btn ghost sm" data-mover="cima" data-i="${idx}"
              title="Subir"${podeSubir ? '' : ' disabled'}>↑</button>
      <button class="btn ghost sm" data-mover="baixo" data-i="${idx}"
              title="Descer"${podeDescer ? '' : ' disabled'}>↓</button>` : '';
    return `
      <tr${cls}>
        <td class="idx"><span class="pos">${pos}º</span>${tagSorteio}</td>
        <td><span class="cod">${App.escapar(s.codigo)}</span>${App.escapar(s.nome)}</td>
        <td class="n">${s.posGrupo}º ${App.escapar(s.grupoOrigem || s.grupo || '')}</td>
        <td class="n">${s.V}</td>
        <td class="n">${fmtAvg(s.AVG, formula)}</td>
        <td class="col-ordem">${acoes}</td>
      </tr>`;
  }

  function fmtAvg(valor, formula) {
    if (!isFinite(valor)) return '—';
    if (formula === 'diferenca') return (valor >= 0 ? '+' : '') + valor;
    return valor.toFixed(3);
  }

  // Identifica os blocos de empate no ranking: runs consecutivos de linhas
  // com motivo "Sorteio", incluindo a âncora imediatamente acima (que é a
  // primeira dupla do bloco e não carrega o motivo).
  function encontrarBlocosEmpatados(ranking) {
    const blocos = [];
    let i = 0;
    while (i < ranking.length) {
      if (i + 1 < ranking.length && ranking[i + 1].motivo === 'Sorteio') {
        let j = i + 1;
        while (j + 1 < ranking.length && ranking[j + 1].motivo === 'Sorteio') j++;
        blocos.push({ start: i, end: j });
        i = j + 1;
      } else {
        i++;
      }
    }
    return blocos;
  }

  async function moverClassificado(idx, direcao) {
    const blocos = encontrarBlocosEmpatados(estado.classificados);
    const bloco = blocos.find(b => idx >= b.start && idx <= b.end);
    if (!bloco) return;
    const alvo = direcao === 'cima' ? idx - 1 : idx + 1;
    if (alvo < bloco.start || alvo > bloco.end) return;

    const arr = estado.classificados;
    [arr[idx], arr[alvo]] = [arr[alvo], arr[idx]];

    // Monta prioridadeSorteio juntando os ids de todos os blocos empatados
    // na ordem atual. Ids fora desses blocos não entram (são decididos
    // pelos critérios anteriores e não precisam de prioridade explícita).
    const prioridade = [];
    blocos.forEach(b => {
      for (let k = b.start; k <= b.end; k++) prioridade.push(arr[k].id);
    });

    await persistirPrioridade(prioridade);
    await carregarEDesenhar();
  }

  async function persistirPrioridade(prioridade) {
    const ec = estado.ec;
    let cfg = {};
    if (ec && ec.config_json) {
      try { cfg = JSON.parse(ec.config_json); } catch { cfg = {}; }
    }
    cfg.prioridadeSorteio = prioridade;
    await window.electronAPI.db.etapaCategoria.atualizar(estado.etapaCategoriaId, {
      numGrupos: ec ? ec.num_grupos : null,
      configJson: JSON.stringify(cfg),
      formato: ec ? ec.formato : undefined,
    });
  }
})();
