// Tela de classificação dos grupos de uma categoria.
// Apenas exibe o resultado calculado pelo motor (a partir dos placares).
// params: { etapaCategoriaId }
(() => {
  App.registrarTela('classificacao', { render });

  const ROTULO = {
    V: 'Vitórias', AVG: 'Average', SP: 'Saldo de pontos',
    H2H: 'Confronto direto', SORTEIO: 'Sorteio',
  };

  async function render(container, params) {
    const r = await window.electronAPI.db.classificacao.calcular(params.etapaCategoriaId);
    const grupos = Object.keys(r.grupos);

    if (!grupos.length) {
      container.innerHTML = `
        <div class="topo-tela"><h2>Classificação</h2></div>
        <div class="vazio">Cadastre as duplas e os grupos para ver a classificação.</div>`;
      return;
    }

    const avgTexto = r.formulaAvg === 'diferenca'
      ? 'diferença PP − PC' : 'razão PP ÷ PC';

    container.innerHTML = `
      <div class="topo-tela"><h2>Classificação dos grupos</h2></div>
      <p class="dica">
        Critérios de desempate: ${r.criterios.map(c => ROTULO[c] || c).join(' › ')}.
        Average: ${avgTexto}. As 2 primeiras de cada grupo aparecem destacadas.
      </p>
      ${grupos.map(g => blocoGrupo(g, r.grupos[g], r.formulaAvg)).join('')}`;
  }

  function blocoGrupo(grupo, lista, formula) {
    return `
      <div class="bloco-grupo">
        <h3>Grupo ${App.escapar(grupo)}</h3>
        <table class="tab-class">
          <thead><tr>
            <th class="idx">#</th>
            <th>Dupla</th>
            <th class="n" title="Jogos">J</th>
            <th class="n" title="Vitórias">V</th>
            <th class="n" title="Pontos pró">PP</th>
            <th class="n" title="Pontos contra">PC</th>
            <th class="n" title="Ponto average">AVG</th>
            <th>Desempate</th>
          </tr></thead>
          <tbody>${lista.map(s => linhaHtml(s, formula)).join('')}</tbody>
        </table>
      </div>`;
  }

  function linhaHtml(s, formula) {
    const classificada = s.posicao <= 2 ? ' pos-q' : '';
    return `
      <tr>
        <td class="idx"><span class="pos${classificada}">${s.posicao}</span></td>
        <td><span class="cod">${App.escapar(s.codigo)}</span>${App.escapar(s.nome)}</td>
        <td class="n">${s.J}</td>
        <td class="n">${s.V}</td>
        <td class="n">${s.PP}</td>
        <td class="n">${s.PC}</td>
        <td class="n">${fmtAvg(s.AVG, formula)}</td>
        <td class="motivo">${s.motivo ? App.escapar(s.motivo) : '—'}</td>
      </tr>`;
  }

  function fmtAvg(valor, formula) {
    if (!isFinite(valor)) return '—';
    if (formula === 'diferenca') return (valor >= 0 ? '+' : '') + valor;
    return valor.toFixed(3);
  }
})();
