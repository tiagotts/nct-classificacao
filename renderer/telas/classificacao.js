// Tela "Classificados e Eliminados" de uma categoria: mostra os classificados
// (ordem do ranking geral, base para o mata-mata) e logo abaixo os eliminados.
// params: { etapaCategoriaId }
(() => {
  App.registrarTela('classificacao', { render });

  async function render(container, params) {
    const r = await window.electronAPI.db.classificacao
      .calcular(params.etapaCategoriaId);
    const classificados = r.ranking || [];

    if (!classificados.length) {
      container.innerHTML = `
        <div class="topo-tela"><h2>Classificados e Eliminados</h2></div>
        <div class="vazio">Cadastre as duplas e os grupos, e lance os placares
          da fase de grupos para ver a classificação.</div>`;
      return;
    }

    // Eliminados = duplas que não estão no ranking de classificados.
    // Ordena por grupo e posição no grupo (3º A, 3º B, 4º A, ...).
    const idsClass = new Set(classificados.map(s => s.id));
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

    container.innerHTML = `
      <div class="topo-tela"><h2>Classificados e Eliminados</h2></div>
      <p class="dica">Classificados (1º a ${classificados.length}º) seguem para
        o mata-mata; eliminados ficam em vermelho.</p>
      <table class="tab-class">
        <thead><tr>
          <th class="idx">Posição</th>
          <th>Dupla</th>
          <th class="n">Classif. no grupo</th>
          <th class="n">Vitórias</th>
          <th class="n">Average</th>
        </tr></thead>
        <tbody>
          ${classificados.map((s, i) => linhaHtml(s, i + 1, false, r.formulaAvg)).join('')}
          ${eliminados.map((s, i) =>
            linhaHtml(s, classificados.length + i + 1, true, r.formulaAvg)).join('')}
        </tbody>
      </table>`;
  }

  function linhaHtml(s, pos, eliminado, formula) {
    const cls = eliminado ? ' class="eliminado"' : '';
    return `
      <tr${cls}>
        <td class="idx"><span class="pos">${pos}º</span></td>
        <td><span class="cod">${App.escapar(s.codigo)}</span>${App.escapar(s.nome)}</td>
        <td class="n">${s.posGrupo}º ${App.escapar(s.grupoOrigem || s.grupo || '')}</td>
        <td class="n">${s.V}</td>
        <td class="n">${fmtAvg(s.AVG, formula)}</td>
      </tr>`;
  }

  function fmtAvg(valor, formula) {
    if (!isFinite(valor)) return '—';
    if (formula === 'diferenca') return (valor >= 0 ? '+' : '') + valor;
    return valor.toFixed(3);
  }
})();
