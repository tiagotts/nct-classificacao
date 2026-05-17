// Tela dos jogos da fase de grupos de uma categoria.
// Os jogos são gerados automaticamente (todos-contra-todos) a partir das
// duplas e seus grupos. Aqui se lançam os placares.
// params: { etapaCategoriaId }
(() => {
  const apiJogo = () => window.electronAPI.db.jogo;
  const apiDupla = () => window.electronAPI.db.dupla;
  const apiEC = () => window.electronAPI.db.etapaCategoria;

  App.registrarTela('jogos', { render });

  let estado = null; // { etapaCategoriaId, jogos, duplaMap }

  async function render(container, params) {
    const { etapaCategoriaId } = params;
    const duplas = await apiDupla().listar(etapaCategoriaId);
    let jogos = (await apiJogo().listar(etapaCategoriaId))
      .filter(j => j.fase === 'grupo');

    const comGrupo = duplas.filter(d => d.grupo);

    // Geração automática na primeira visita, quando ainda não há jogos.
    if (jogos.length === 0 && comGrupo.length >= 2) {
      await apiJogo().gerarFaseGrupos(etapaCategoriaId);
      jogos = (await apiJogo().listar(etapaCategoriaId))
        .filter(j => j.fase === 'grupo');
    }

    if (jogos.length === 0) {
      container.innerHTML = `
        <div class="topo-tela"><h2>Jogos da fase de grupos</h2></div>
        <div class="vazio">
          Cadastre as duplas e atribua os grupos antes de gerar os jogos.
        </div>`;
      return;
    }

    const ec = await apiEC().obter(etapaCategoriaId);
    const duplaMap = {};
    duplas.forEach(d => { duplaMap[d.id] = d; });
    estado = { etapaCategoriaId, etapaId: ec.etapa_id, jogos, duplaMap };

    container.innerHTML = `
      <div class="topo-tela">
        <h2>Jogos da fase de grupos</h2>
        <div class="acoes-topo">
          <button class="btn ghost sm" id="btn-publicar">Publicar resultados</button>
          <button class="btn ghost sm" id="btn-regerar">Regerar jogos</button>
        </div>
      </div>
      <p class="dica">${jogos.length} jogos gerados automaticamente (todos contra todos).
        Em W&times;0, informe o placar indicando o vencedor (ex.: 1 e 0).</p>
      <div id="pub-status"></div>
      <div id="grid-jogos"></div>
      <div class="form-erro" id="jogos-erro"></div>
      <div class="form-acoes">
        <button class="btn" id="btn-salvar">Salvar resultados</button>
      </div>`;

    desenhar();
    container.querySelector('#btn-salvar').onclick = (e) => salvar(e.target);
    container.querySelector('#btn-regerar').onclick = regerar;
    container.querySelector('#btn-publicar').onclick = (e) => publicar(e.target);
  }

  function desenhar() {
    const porGrupo = {};
    estado.jogos.forEach(j => {
      (porGrupo[j.grupo] = porGrupo[j.grupo] || []).push(j);
    });
    document.getElementById('grid-jogos').innerHTML =
      Object.keys(porGrupo).sort().map(g => `
        <div class="bloco-grupo">
          <h3>Grupo ${App.escapar(g)}</h3>
          <table class="tab-jogos">
            <thead><tr>
              <th class="idx">#</th>
              <th>Dupla 1</th>
              <th class="col-placar">Placar</th>
              <th class="col-placar">Placar</th>
              <th>Dupla 2</th>
              <th class="col-tipo">Resultado</th>
            </tr></thead>
            <tbody>${porGrupo[g].map(linhaHtml).join('')}</tbody>
          </table>
        </div>`).join('');
  }

  function nomeDupla(id) {
    const d = estado.duplaMap[id];
    if (!d) return '<span class="cod">?</span>';
    return `<span class="cod">${App.escapar(d.codigo)}</span>`
      + App.escapar(`${d.atleta1_nome} / ${d.atleta2_nome}`);
  }

  function linhaHtml(j) {
    const tipo = j.tipo_resultado || 'normal';
    const op = (v, txt) =>
      `<option value="${v}"${tipo === v ? ' selected' : ''}>${txt}</option>`;
    return `
      <tr data-id="${j.id}">
        <td class="idx">${j.num}</td>
        <td>${nomeDupla(j.dupla1_id)}</td>
        <td class="col-placar">
          <input type="number" min="0" class="p1"
                 value="${j.placar1 != null ? j.placar1 : ''}"></td>
        <td class="col-placar">
          <input type="number" min="0" class="p2"
                 value="${j.placar2 != null ? j.placar2 : ''}"></td>
        <td>${nomeDupla(j.dupla2_id)}</td>
        <td class="col-tipo">
          <select class="tipo">
            ${op('normal', 'Normal')}${op('wx0', 'W×0')}${op('desistencia', 'Desistência')}
          </select>
        </td>
      </tr>`;
  }

  async function salvar(botao) {
    botao.disabled = true;
    const erroEl = document.getElementById('jogos-erro');
    erroEl.textContent = '';
    try {
      for (const tr of document.querySelectorAll('#grid-jogos tbody tr')) {
        const id = Number(tr.dataset.id);
        const p1 = tr.querySelector('.p1').value;
        const p2 = tr.querySelector('.p2').value;
        await apiJogo().registrarPlacar(id, {
          placar1: p1 === '' ? null : Number(p1),
          placar2: p2 === '' ? null : Number(p2),
          tipoResultado: tr.querySelector('.tipo').value,
        });
      }
      await App.recarregar();
    } catch (err) {
      erroEl.textContent = 'Erro ao salvar: ' + err.message;
      botao.disabled = false;
    }
  }

  async function regerar() {
    if (!confirm('Regerar os jogos apaga todos os placares já lançados. Continuar?')) {
      return;
    }
    await apiJogo().gerarFaseGrupos(estado.etapaCategoriaId, { recriar: true });
    await App.recarregar();
  }

  // Publica a página da etapa sem sair desta tela. O módulo Publicar cuida
  // de publicar, acompanhar o build do GitHub Pages e notificar quando fica
  // no ar; usa a configuração do GitHub salva na tela "Publicar resultados".
  function publicar(botao) {
    Publicar.publicarEtapa(estado.etapaId, document.getElementById('pub-status'), botao);
  }
})();
