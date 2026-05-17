// Tela das categorias disputadas numa etapa (etapa_categoria).
// Escolhe quais categorias do catálogo fixo a etapa roda e o nº de grupos.
// params: { etapaId }
(() => {
  const apiEC = () => window.electronAPI.db.etapaCategoria;
  const apiCat = () => window.electronAPI.db.categoria;

  App.registrarTela('etapa-categorias', { render });

  async function render(container, params) {
    const { etapaId } = params;
    const [catalogo, lista] = await Promise.all([
      apiCat().listar(),
      apiEC().listar(etapaId),
    ]);
    // Categorias do catálogo ainda não adicionadas a esta etapa.
    const usadas = new Set(lista.map(ec => ec.categoria_id));
    const disponiveis = catalogo.filter(c => !usadas.has(c.id));

    container.innerHTML = `
      <div class="topo-tela">
        <h2>Categorias da etapa</h2>
        <div class="acoes-topo">
          <button class="btn ghost" data-acao="publicar">Publicar resultados</button>
          <button class="btn" data-acao="nova" ${disponiveis.length ? '' : 'disabled'}>
            Adicionar categoria
          </button>
        </div>
      </div>
      <div id="form-area"></div>
      <div class="lista">
        ${lista.length
          ? lista.map(itemHtml).join('')
          : '<div class="vazio">Nenhuma categoria nesta etapa. Adicione as categorias disputadas.</div>'}
      </div>
      ${!disponiveis.length && lista.length
        ? '<p class="dica">Todas as categorias do catálogo já foram adicionadas.</p>'
        : ''}`;

    container.querySelector('[data-acao="nova"]').onclick =
      () => abrirForm(container, etapaId, disponiveis);
    container.querySelector('[data-acao="publicar"]').onclick =
      () => App.navegar('publicacao', { etapaId }, 'Publicar');

    container.querySelectorAll('[data-acao="editar"]').forEach(b => {
      b.onclick = () => abrirForm(container, etapaId, disponiveis,
        lista.find(ec => ec.id === Number(b.dataset.id)));
    });
    container.querySelectorAll('[data-acao="remover"]').forEach(b => {
      b.onclick = () => remover(Number(b.dataset.id));
    });
    container.querySelectorAll('[data-acao="abrir"]').forEach(b => {
      b.onclick = () => {
        const ec = lista.find(x => x.id === Number(b.dataset.id));
        App.navegar('categoria-detalhe', { etapaCategoriaId: ec.id }, ec.categoria_nome);
      };
    });
  }

  function itemHtml(ec) {
    const grupos = ec.num_grupos
      ? `${ec.num_grupos} ${ec.num_grupos === 1 ? 'grupo' : 'grupos'}`
      : 'grupos não definidos';
    return `
      <div class="item">
        <div class="item-info">
          <div class="item-titulo">${App.escapar(ec.categoria_nome)}</div>
          <div class="item-sub">${grupos}</div>
        </div>
        <div class="item-acoes">
          <button class="btn ghost sm" data-acao="editar" data-id="${ec.id}">Editar</button>
          <button class="btn danger sm" data-acao="remover" data-id="${ec.id}">Remover</button>
          <button class="btn sm" data-acao="abrir" data-id="${ec.id}">Abrir &rsaquo;</button>
        </div>
      </div>`;
  }

  function abrirForm(container, etapaId, disponiveis, ec) {
    const area = container.querySelector('#form-area');
    const editando = !!ec;
    // Na edição a categoria é fixa; só o nº de grupos muda.
    const seletorCategoria = editando
      ? `<input type="text" value="${App.escapar(ec.categoria_nome)}" disabled>`
      : `<select id="f-categoria">
           ${disponiveis.map(c => `<option value="${c.id}">${App.escapar(c.nome)}</option>`).join('')}
         </select>`;

    area.innerHTML = `
      <div class="form-card">
        <h3>${editando ? 'Editar categoria da etapa' : 'Adicionar categoria'}</h3>
        <div class="form-row">
          <label>Categoria</label>
          ${seletorCategoria}
        </div>
        <div class="form-row">
          <label>Nº de grupos</label>
          <input type="number" id="f-grupos" min="1" max="16" placeholder="3"
                 value="${editando && ec.num_grupos ? ec.num_grupos : ''}">
        </div>
        <div class="form-acoes">
          <button class="btn" id="f-salvar">Salvar</button>
          <button class="btn ghost" id="f-cancelar">Cancelar</button>
        </div>
        <div class="form-erro" id="f-erro"></div>
      </div>`;

    area.querySelector('#f-cancelar').onclick = () => { area.innerHTML = ''; };
    area.querySelector('#f-salvar').onclick = async () => {
      const numGrupos = Number(area.querySelector('#f-grupos').value) || null;
      if (editando) {
        // Preserva o config_json existente ao salvar só o nº de grupos.
        await apiEC().atualizar(ec.id, { numGrupos, configJson: ec.config_json });
      } else {
        const categoriaId = Number(area.querySelector('#f-categoria').value);
        await apiEC().criar({ etapaId, categoriaId, numGrupos });
      }
      await App.recarregar();
    };
  }

  async function remover(id) {
    if (!confirm('Remover esta categoria da etapa?')) return;
    try {
      await apiEC().remover(id);
      await App.recarregar();
    } catch (err) {
      alert('Não foi possível remover: a categoria tem duplas ou jogos cadastrados.');
    }
  }
})();
