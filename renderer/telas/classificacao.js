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
    estado.pendentes = r.pendentes || [];
    // Detecta se a categoria está com a ordem manual ativa (lendo do config).
    let cfg = {};
    if (ec && ec.config_json) {
      try { cfg = JSON.parse(ec.config_json); } catch { cfg = {}; }
    }
    estado.temOverrideManual = Array.isArray(cfg.ordemManualClassificacao)
      && cfg.ordemManualClassificacao.length > 0;

    // Eliminados = duplas que não estão no ranking nem nos pendentes.
    // Ordena por grupo e posição no grupo (3º A, 3º B, 4º A, ...).
    const idsClass = new Set(estado.classificados.map(s => s.id));
    const idsPend = new Set(estado.pendentes.map(s => s.id));
    const eliminados = [];
    for (const grupo of Object.keys(r.grupos || {}).sort()) {
      for (const s of r.grupos[grupo]) {
        if (!idsClass.has(s.id) && !idsPend.has(s.id)) {
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
    const { container, classificados, pendentes, eliminados, formulaAvg } = estado;
    const temEmpate = classificados.some(s => s.motivo === 'Sorteio')
      || pendentes.length > 0;
    const temOverride = estado.temOverrideManual;
    const temPendentes = pendentes.length > 0;
    const dica = dicaTopo(temEmpate, temOverride, temPendentes);
    const acaoLimpar = temOverride
      ? `<button class="btn ghost sm" id="btn-limpar-ordem">Limpar ordem manual</button>`
      : '';

    // Pool completo: classificados + pendentes + eliminados. Todas as
    // linhas têm setas — o usuário pode promover qualquer dupla ao
    // mata-mata ou mover qualquer uma pra fora.
    const pool = [...classificados, ...pendentes, ...eliminados];
    const nClass = classificados.length;
    const nPend = pendentes.length;
    const tipoLinha = (i) => {
      if (i < nClass) return false;             // classificado
      if (i < nClass + nPend) return true;      // pendente (Sorteio)
      return 'eliminado';                       // eliminado
    };

    container.innerHTML = `
      <div class="topo-tela">
        <h2>Classificados e Eliminados</h2>
        <div class="acoes-topo">
          ${acaoLimpar}
          <button class="btn sm" id="btn-pdf">Gerar PDF</button>
        </div>
      </div>
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
          ${pool.map((s, i) =>
            linhaHtml(s, i + 1, tipoLinha(i), formulaAvg, i, pool.length)).join('')}
        </tbody>
      </table>`;

    container.querySelectorAll('[data-mover]').forEach(b => {
      b.onclick = () => moverClassificado(Number(b.dataset.i), b.dataset.mover);
    });
    container.querySelector('#btn-pdf').onclick = () =>
      App.imprimirCategoria(estado.etapaCategoriaId, 'Classificação');
    const btnLimpar = container.querySelector('#btn-limpar-ordem');
    if (btnLimpar) btnLimpar.onclick = limparOrdemManual;
  }

  function dicaTopo(temEmpate, temOverride, temPendentes) {
    const N = estado.classificados.length;
    const base = `Os ${N} primeiros vão para o mata-mata; eliminados ficam em
        vermelho. Use as setas ↑↓ para ajustar a ordem manualmente.`;
    if (temOverride) {
      return `<p class="dica">${base} <strong>A ordem manual está ativa</strong>
        — os critérios automáticos foram sobrescritos. Clique em "Limpar
        ordem manual" para voltar ao cálculo automático.</p>`;
    }
    if (temPendentes) {
      return `<p class="dica">${base}
        <strong>Há duplas empatadas no corte da repescagem</strong> — elas
        aparecem com a tag "Sorteio" logo após os classificados. Suba a que
        deve entrar no mata-mata com as setas ↑↓.</p>`;
    }
    if (temEmpate) {
      return `<p class="dica">${base}
        <strong>Há duplas empatadas após os critérios.</strong></p>`;
    }
    return `<p class="dica">${base}</p>`;
  }

  // Tipo da linha:
  //   false        — classificado (vai pro mata-mata)
  //   true         — pendente (tied no corte da repescagem; tag Sorteio)
  //   'eliminado'  — fora do mata-mata (linha vermelha)
  // Todas as linhas têm setas — o usuário pode promover/rebaixar qualquer
  // dupla via swap com a vizinha.
  function linhaHtml(s, pos, tipo, formula, idx, total) {
    const eliminado = tipo === 'eliminado';
    const pendente = tipo === true;
    const cls = eliminado ? ' class="eliminado"'
              : pendente ? ' class="pendente"' : '';
    const tagSorteio = (s.motivo === 'Sorteio' || s.empateRepescagem)
      ? ' <span class="tie-flag sorteio">Sorteio</span>' : '';
    const acoes = `
      <button class="btn ghost sm" data-mover="cima" data-i="${idx}"
              title="Subir"${idx === 0 ? ' disabled' : ''}>↑</button>
      <button class="btn ghost sm" data-mover="baixo" data-i="${idx}"
              title="Descer"${idx === total - 1 ? ' disabled' : ''}>↓</button>`;
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

  // Move uma dupla no pool (classificados + pendentes + eliminados),
  // trocando com a vizinha. Persiste a ordem completa em
  // config.ordemManualClassificacao; o motor aplica esse override depois
  // dos critérios. Primeiros N viram seeds; o resto fica fora do mata-mata.
  async function moverClassificado(idx, direcao) {
    const pool = [
      ...estado.classificados, ...estado.pendentes, ...estado.eliminados,
    ];
    const alvo = direcao === 'cima' ? idx - 1 : idx + 1;
    if (alvo < 0 || alvo >= pool.length) return;
    [pool[idx], pool[alvo]] = [pool[alvo], pool[idx]];
    await persistirOrdemManual(pool.map(s => s.id));
    await carregarEDesenhar();
  }

  async function limparOrdemManual() {
    if (!confirm('Voltar para a ordem calculada pelos critérios (V, AVG, '
      + 'H2H, sorteio)? Isto descarta a ordem manual atual.')) return;
    await persistirOrdemManual(null);
    await carregarEDesenhar();
  }

  async function persistirOrdemManual(ordem) {
    const ec = estado.ec;
    let cfg = {};
    if (ec && ec.config_json) {
      try { cfg = JSON.parse(ec.config_json); } catch { cfg = {}; }
    }
    if (ordem && ordem.length) cfg.ordemManualClassificacao = ordem;
    else delete cfg.ordemManualClassificacao;
    await window.electronAPI.db.etapaCategoria.atualizar(estado.etapaCategoriaId, {
      numGrupos: ec ? ec.num_grupos : null,
      configJson: JSON.stringify(cfg),
      formato: ec ? ec.formato : undefined,
    });
  }
})();
