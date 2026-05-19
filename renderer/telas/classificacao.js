// Tela de classificação de uma categoria: o ranking geral dos classificados,
// de 1 a N — é a partir dele que o mata-mata é montado.
// params: { etapaCategoriaId }
(() => {
  App.registrarTela('classificacao', { render });

  async function render(container, params) {
    const r = await window.electronAPI.db.classificacao
      .calcular(params.etapaCategoriaId);
    const ranking = r.ranking || [];

    if (!ranking.length) {
      container.innerHTML = `
        <div class="topo-tela"><h2>Classificação</h2></div>
        <div class="vazio">Cadastre as duplas e os grupos, e lance os placares
          da fase de grupos para ver a classificação.</div>`;
      return;
    }

    container.innerHTML = `
      <div class="topo-tela"><h2>Classificados</h2></div>
      <p class="dica">Ranking geral dos classificados, de 1º a ${ranking.length}º.
        É a ordem usada para montar o mata-mata.</p>
      <table class="tab-class">
        <thead><tr>
          <th class="idx">Posição</th>
          <th>Dupla</th>
          <th class="n">Vitórias</th>
          <th class="n">Classif. no grupo</th>
          <th class="n">Average</th>
        </tr></thead>
        <tbody>${ranking.map(s => linhaHtml(s, r.formulaAvg)).join('')}</tbody>
      </table>`;
  }

  function linhaHtml(s, formula) {
    return `
      <tr>
        <td class="idx"><span class="pos">${s.seed}º</span></td>
        <td><span class="cod">${App.escapar(s.codigo)}</span>${App.escapar(s.nome)}</td>
        <td class="n">${s.V}</td>
        <td class="n">${s.posGrupo}º</td>
        <td class="n">${fmtAvg(s.AVG, formula)}</td>
      </tr>`;
  }

  function fmtAvg(valor, formula) {
    if (!isFinite(valor)) return '—';
    if (formula === 'diferenca') return (valor >= 0 ? '+' : '') + valor;
    return valor.toFixed(3);
  }
})();
