// Tela do ranking de temporada por atleta.
// Soma os pontos de cada atleta em todas as etapas da temporada, por categoria.
// params: { temporadaId }
(() => {
  App.registrarTela('ranking-temporada', { render });

  async function render(container, params) {
    const { temporadaId } = params;
    const categorias = await window.electronAPI.db.categoria.listar();

    container.innerHTML = `
      <div class="topo-tela">
        <h2>Ranking da temporada</h2>
        <div class="grid-toolbar">
          <label for="combo-cat">Categoria</label>
          <select id="combo-cat">
            ${categorias.map(c =>
              `<option value="${c.id}">${App.escapar(c.nome)}</option>`).join('')}
          </select>
        </div>
      </div>
      <p class="dica">Pontos por atleta somando todas as etapas da temporada.
        Desempate: pontos e, em seguida, maior número de melhores colocações.</p>
      <div id="ranking"></div>`;

    const combo = container.querySelector('#combo-cat');
    combo.onchange = () => carregar(temporadaId, Number(combo.value));
    if (categorias.length) carregar(temporadaId, Number(combo.value));
  }

  async function carregar(temporadaId, categoriaId) {
    const div = document.getElementById('ranking');
    div.innerHTML = '<div class="carregando">Carregando…</div>';
    const lista = await window.electronAPI.db.rankingTemporada
      .calcular(temporadaId, categoriaId);

    if (!lista.length) {
      div.innerHTML = `<div class="vazio">Nenhum resultado nesta categoria ainda.
        Os pontos aparecem conforme as colocações das etapas são apuradas.</div>`;
      return;
    }

    div.innerHTML = `
      <table class="tab-class">
        <thead><tr>
          <th class="idx">#</th>
          <th>Atleta</th>
          <th class="n">Pontos</th>
          <th class="n">Etapas</th>
          <th>Colocações</th>
        </tr></thead>
        <tbody>${lista.map(linhaHtml).join('')}</tbody>
      </table>`;
  }

  function linhaHtml(a) {
    const destaque = a.posicao <= 3 ? ' pos-q' : '';
    return `
      <tr>
        <td class="idx"><span class="pos${destaque}">${a.posicao}</span></td>
        <td>${App.escapar(a.nome)}</td>
        <td class="n">${a.pontos}</td>
        <td class="n">${a.etapas}</td>
        <td class="motivo">${resumoColocacoes(a.colocacoes)}</td>
      </tr>`;
  }

  function resumoColocacoes(colocacoes) {
    if (!colocacoes || !colocacoes.length) return '—';
    return colocacoes.slice().sort((a, b) => a - b)
      .map(c => `${c}º`).join(', ');
  }
})();
