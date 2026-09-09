// Tela das categorias disputadas numa etapa (etapa_categoria).
// Escolhe quais categorias do catálogo a etapa roda, o tipo (masculino ou
// feminino) e o nº de grupos. A mesma categoria pode entrar duas vezes,
// uma para cada tipo. params: { etapaId }
(() => {
  const apiEC = () => window.electronAPI.db.etapaCategoria;
  const apiCat = () => window.electronAPI.db.categoria;

  const ROTULO_TIPO = { masculino: 'Masculino', feminino: 'Feminino' };
  // Rótulo para mostrar no card/título. Tipo nulo (ex.: Misto) cai em "—".
  const rotuloTipo = (t) => ROTULO_TIPO[t] || (t ? t : 'Misto');
  const ROTULO_FORMATO = {
    'todos-contra-todos': 'Todos contra todos',
    'dupla-eliminatoria': 'Dupla eliminatória no grupo',
    'chave-dupla-direta': 'Chave dupla direta (sem grupos)',
  };
  const ROTULO_ORIGEM = {
    'temporada': 'Ranking da temporada (automático)',
    'manual':    'Definida manualmente',
  };

  App.registrarTela('etapa-categorias', { render });

  // Chave única de uma combinação categoria + tipo, para detectar repetição.
  const chaveCombo = (categoriaId, tipo) => `${categoriaId}|${tipo}`;

  async function render(container, params) {
    const { etapaId } = params;
    const [catalogo, lista] = await Promise.all([
      apiCat().listar(),
      apiEC().listar(etapaId),
    ]);
    // Combinações categoria+tipo já adicionadas a esta etapa.
    const combosUsados = new Set(
      lista.map(ec => chaveCombo(ec.categoria_id, ec.tipo)));
    // Cada categoria pode ser disputada nos dois tipos.
    const totalCombos = catalogo.length * 2;
    const cheio = lista.length >= totalCombos;

    container.innerHTML = `
      <div class="topo-tela">
        <h2>Categorias da etapa</h2>
        <div class="acoes-topo">
          <button class="btn ghost" data-acao="config">Configurar publicação</button>
          <button class="btn ghost" data-acao="publicar-tudo">Publicar tudo (categorias + geral)</button>
          <button class="btn" data-acao="nova" ${cheio ? 'disabled' : ''}>
            Adicionar categoria
          </button>
        </div>
      </div>
      <p class="dica">"Publicar tudo" envia cada categoria da etapa e
        depois a página geral — em um clique. A geral linka para cada
        categoria; sem republicar todas, os links caem em 404.</p>
      <div id="form-area"></div>
      <div class="lista">
        ${lista.length
          ? lista.map(itemHtml).join('')
          : '<div class="vazio">Nenhuma categoria nesta etapa. Adicione as categorias disputadas.</div>'}
      </div>
      <div id="pub-status"></div>
      ${cheio
        ? '<p class="dica">Todas as categorias do catálogo já foram adicionadas nos dois tipos.</p>'
        : ''}`;

    container.querySelector('[data-acao="nova"]').onclick =
      () => abrirForm(container, etapaId, catalogo, combosUsados);
    container.querySelector('[data-acao="config"]').onclick =
      () => App.navegar('publicacao', { etapaId }, 'Configurar publicação');
    container.querySelector('[data-acao="publicar-tudo"]').onclick = (e) =>
      Publicar.publicarTudoDaEtapa(
        etapaId, document.getElementById('pub-status'), e.currentTarget);

    container.querySelectorAll('[data-acao="editar"]').forEach(b => {
      b.onclick = () => abrirForm(container, etapaId, catalogo, combosUsados,
        lista.find(ec => ec.id === Number(b.dataset.id)));
    });
    container.querySelectorAll('[data-acao="remover"]').forEach(b => {
      b.onclick = () => remover(Number(b.dataset.id));
    });
    container.querySelectorAll('[data-acao="abrir"]').forEach(b => {
      b.onclick = () => {
        const ec = lista.find(x => x.id === Number(b.dataset.id));
        App.navegar('categoria-detalhe', { etapaCategoriaId: ec.id },
          `${ec.categoria_nome} ${ec.tipo ? rotuloTipo(ec.tipo) : ''}`.trim());
      };
    });
  }

  function itemHtml(ec) {
    const ehChaveDireta = ec.formato === 'chave-dupla-direta';
    // Chave dupla direta não tem grupos; mostra a origem da ordem no lugar.
    const grupos = ehChaveDireta
      ? (ROTULO_ORIGEM[ec.origem_ranking] || 'ordem não definida')
      : (ec.num_grupos
          ? `${ec.num_grupos} ${ec.num_grupos === 1 ? 'grupo' : 'grupos'}`
          : 'grupos não definidos');
    const tipo = rotuloTipo(ec.tipo);
    const formato = ROTULO_FORMATO[ec.formato] || ec.formato || '';
    const data = fmtData(ec.data_competicao);
    const sub = [grupos, formato, data ? `compete em ${data}` : null]
      .filter(Boolean).join(' · ');
    return `
      <div class="item">
        <div class="item-info">
          <div class="item-titulo">${App.escapar(ec.categoria_nome)} — ${App.escapar(tipo)}</div>
          <div class="item-sub">${App.escapar(sub)}</div>
        </div>
        <div class="item-acoes">
          <button class="btn ghost sm" data-acao="editar" data-id="${ec.id}">Editar</button>
          <button class="btn danger sm" data-acao="remover" data-id="${ec.id}">Remover</button>
          <button class="btn sm" data-acao="abrir" data-id="${ec.id}">Abrir &rsaquo;</button>
        </div>
      </div>`;
  }

  function abrirForm(container, etapaId, catalogo, combosUsados, ec) {
    const area = container.querySelector('#form-area');
    const editando = !!ec;

    // Na edição categoria e tipo são fixos; só o nº de grupos muda.
    const seletorCategoria = editando
      ? `<input type="text" value="${App.escapar(ec.categoria_nome)}" disabled>`
      : `<select id="f-categoria">
           ${catalogo.map(c =>
             `<option value="${c.id}">${App.escapar(c.nome)}</option>`).join('')}
         </select>`;
    const seletorTipo = editando
      ? `<input type="text" value="${App.escapar(rotuloTipo(ec.tipo))}" disabled>`
      : `<select id="f-tipo">
           <option value="">— (Misto / sem distinção)</option>
           <option value="masculino">Masculino</option>
           <option value="feminino">Feminino</option>
         </select>`;
    // O formato pode ser ajustado também na edição (vale na hora de gerar
    // os jogos da fase de grupos ou da chave dupla direta).
    const fmtAtual = editando ? ec.formato : 'todos-contra-todos';
    const seletorFormato = `<select id="f-formato">
        ${Object.entries(ROTULO_FORMATO).map(([v, rotulo]) =>
          `<option value="${v}"${v === fmtAtual ? ' selected' : ''}>${rotulo}</option>`
        ).join('')}
      </select>`;
    const origemAtual = editando && ec.origem_ranking
      ? ec.origem_ranking : 'temporada';
    const seletorOrigem = `<select id="f-origem-ranking">
        ${Object.entries(ROTULO_ORIGEM).map(([v, rotulo]) =>
          `<option value="${v}"${v === origemAtual ? ' selected' : ''}>${rotulo}</option>`
        ).join('')}
      </select>`;

    area.innerHTML = `
      <div class="form-card">
        <h3>${editando ? 'Editar categoria da etapa' : 'Adicionar categoria'}</h3>
        <div class="form-row">
          <label>Categoria</label>
          ${seletorCategoria}
        </div>
        <div class="form-row">
          <label>Tipo</label>
          ${seletorTipo}
        </div>
        <div class="form-row">
          <label>Formato</label>
          ${seletorFormato}
        </div>
        <div class="form-row" id="f-row-grupos">
          <label>Nº de grupos</label>
          <input type="number" id="f-grupos" min="1" max="16" placeholder="3"
                 value="${editando && ec.num_grupos ? ec.num_grupos : ''}">
        </div>
        <div class="form-row" id="f-row-origem" hidden>
          <label>Ordem das seeds</label>
          ${seletorOrigem}
        </div>
        <div class="form-row">
          <label>Data da categoria</label>
          <input type="date" id="f-data"
                 value="${editando && ec.data_competicao ? App.escapar(ec.data_competicao) : ''}">
        </div>
        <div class="form-acoes">
          <button class="btn" id="f-salvar">Salvar</button>
          <button class="btn ghost" id="f-cancelar">Cancelar</button>
        </div>
        <div class="form-erro" id="f-erro"></div>
      </div>`;

    // Alterna a visibilidade dos campos condicionais conforme o formato:
    // chave-dupla-direta não tem grupos e precisa da origem do ranking.
    const rowGrupos = area.querySelector('#f-row-grupos');
    const rowOrigem = area.querySelector('#f-row-origem');
    function ajustarCamposPorFormato() {
      const fmt = area.querySelector('#f-formato').value;
      const ehChaveDireta = fmt === 'chave-dupla-direta';
      rowGrupos.hidden = ehChaveDireta;
      rowOrigem.hidden = !ehChaveDireta;
    }
    area.querySelector('#f-formato').onchange = ajustarCamposPorFormato;
    ajustarCamposPorFormato();

    area.querySelector('#f-cancelar').onclick = () => { area.innerHTML = ''; };
    area.querySelector('#f-salvar').onclick = async () => {
      const erroEl = area.querySelector('#f-erro');
      const formato = area.querySelector('#f-formato').value;
      const ehChaveDireta = formato === 'chave-dupla-direta';
      const numGrupos = ehChaveDireta
        ? null
        : (Number(area.querySelector('#f-grupos').value) || null);
      const origemRanking = ehChaveDireta
        ? area.querySelector('#f-origem-ranking').value
        : null;
      const dataCompeticao = area.querySelector('#f-data').value || null;
      if (editando) {
        // Preserva o config_json existente ao salvar nº de grupos, formato,
        // origem do ranking e data.
        await apiEC().atualizar(ec.id, {
          numGrupos, configJson: ec.config_json, formato,
          origemRanking, dataCompeticao,
        });
      } else {
        const categoriaId = Number(area.querySelector('#f-categoria').value);
        const tipo = area.querySelector('#f-tipo').value || null;
        if (combosUsados.has(chaveCombo(categoriaId, tipo))) {
          erroEl.textContent = 'Essa categoria já foi adicionada neste tipo.';
          return;
        }
        await apiEC().criar({
          etapaId, categoriaId, tipo, formato, numGrupos,
          origemRanking, dataCompeticao,
        });
      }
      await App.recarregar();
    };
  }

  // Formata "YYYY-MM-DD" como "DD/MM/AAAA" para exibir no card.
  function fmtData(iso) {
    if (!iso) return '';
    const [a, m, d] = iso.split('-');
    return (a && m && d) ? `${d}/${m}/${a}` : iso;
  }

  async function remover(id) {
    if (!confirm('Remover esta categoria da etapa? '
        + 'As duplas e os jogos cadastrados nela também serão apagados.')) return;
    try {
      await apiEC().remover(id);
      await App.recarregar();
    } catch (err) {
      alert('Não foi possível remover: ' + err.message);
    }
  }
})();
