// Tela do ranking de temporada por atleta.
// Soma os pontos de cada atleta em todas as etapas da temporada, por categoria.
// params: { temporadaId }
(() => {
  App.registrarTela('ranking-temporada', { render });

  async function render(container, params) {
    const { temporadaId, categoriaId, tipo } = params;
    const categorias = await window.electronAPI.db.categoria.listar();

    // Pré-seleção: usa a categoria/tipo vindos da navegação (quando o
    // usuário entrou pelo botão "Ranking" dentro de uma categoria), senão
    // cai na primeira categoria da lista e tipo masculino.
    const catSelecionada = categoriaId != null && categorias.some(c => c.id === categoriaId)
      ? categoriaId : (categorias[0] && categorias[0].id);
    const tipoSelecionado = tipo === 'feminino' ? 'feminino' : 'masculino';

    container.innerHTML = `
      <div class="topo-tela">
        <h2>Ranking da temporada</h2>
        <div class="grid-toolbar">
          <label for="combo-cat">Categoria</label>
          <select id="combo-cat">
            ${categorias.map(c =>
              `<option value="${c.id}"${c.id === catSelecionada ? ' selected' : ''}>${App.escapar(c.nome)}</option>`).join('')}
          </select>
          <label for="combo-tipo">Tipo</label>
          <select id="combo-tipo">
            <option value="masculino"${tipoSelecionado === 'masculino' ? ' selected' : ''}>Masculino</option>
            <option value="feminino"${tipoSelecionado === 'feminino' ? ' selected' : ''}>Feminino</option>
          </select>
        </div>
      </div>
      <p class="dica">Pontos por atleta somando todas as etapas da temporada.
        Desempate: pontos e, em seguida, maior número de melhores colocações.</p>
      <div id="ranking"></div>`;

    const combo = container.querySelector('#combo-cat');
    const comboTipo = container.querySelector('#combo-tipo');
    const atualizar = () =>
      carregar(temporadaId, Number(combo.value), comboTipo.value);
    combo.onchange = atualizar;
    comboTipo.onchange = atualizar;
    if (categorias.length) atualizar();
  }

  async function carregar(temporadaId, categoriaId, tipo) {
    const div = document.getElementById('ranking');
    div.innerHTML = '<div class="carregando">Carregando…</div>';
    const { etapas, ranking } = await window.electronAPI.db.rankingTemporada
      .calcular(temporadaId, categoriaId, tipo);

    if (!ranking.length) {
      div.innerHTML = `<div class="vazio">Nenhum resultado nesta categoria ainda.
        Os pontos aparecem conforme as colocações das etapas são apuradas.</div>`;
      return;
    }

    const colsEtapa = etapas.map(e =>
      `<th class="n">${App.escapar(e.nome)}</th>`).join('');

    div.innerHTML = `
      <table class="tab-class">
        <thead><tr>
          <th class="idx">#</th>
          <th>Atleta</th>
          <th class="n">Inicial</th>
          ${colsEtapa}
          <th class="n">Total</th>
          <th>Colocações</th>
        </tr></thead>
        <tbody>${ranking.map(a => linhaHtml(a, etapas)).join('')}</tbody>
      </table>`;
  }

  function linhaHtml(a, etapas) {
    const destaque = a.posicao <= 3 ? ' pos-q' : '';
    const cels = etapas.map(e => {
      const pts = a.pontosPorEtapa && a.pontosPorEtapa[e.id];
      return `<td class="n">${pts || 0}</td>`;
    }).join('');
    return `
      <tr>
        <td class="idx"><span class="pos${destaque}">${a.posicao}</span></td>
        <td>${App.escapar(a.nome)}</td>
        <td class="n">${a.pontosIniciais || 0}</td>
        ${cels}
        <td class="n"><strong>${a.pontos}</strong></td>
        <td class="motivo">${resumoColocacoes(a.colocacoes)}</td>
      </tr>`;
  }

  function resumoColocacoes(colocacoes) {
    if (!colocacoes || !colocacoes.length) return '—';
    return colocacoes.slice().sort((a, b) => a - b)
      .map(c => `${c}º`).join(', ');
  }
})();
