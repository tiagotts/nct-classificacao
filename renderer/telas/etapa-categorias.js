// Tela das categorias disputadas numa etapa (etapa_categoria).
// Escolhe quais categorias do catálogo a etapa roda, o tipo (masculino ou
// feminino) e o nº de grupos. A mesma categoria pode entrar duas vezes,
// uma para cada tipo. params: { etapaId }
(() => {
  const apiEC = () => window.electronAPI.db.etapaCategoria;
  const apiCat = () => window.electronAPI.db.categoria;

  const ROTULO_TIPO = { masculino: 'Masculino', feminino: 'Feminino' };
  const ROTULO_FORMATO = {
    'todos-contra-todos': 'Todos contra todos',
    'dupla-eliminatoria': 'Dupla eliminatória no grupo',
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
          <button class="btn ghost" data-acao="publicar">Configurar publicação</button>
          <button class="btn" data-acao="nova" ${cheio ? 'disabled' : ''}>
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
      ${cheio
        ? '<p class="dica">Todas as categorias do catálogo já foram adicionadas nos dois tipos.</p>'
        : ''}`;

    container.querySelector('[data-acao="nova"]').onclick =
      () => abrirForm(container, etapaId, catalogo, combosUsados);
    container.querySelector('[data-acao="publicar"]').onclick =
      () => App.navegar('publicacao', { etapaId }, 'Configurar publicação');

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
          `${ec.categoria_nome} ${ROTULO_TIPO[ec.tipo] || ''}`.trim());
      };
    });
  }

  function itemHtml(ec) {
    const grupos = ec.num_grupos
      ? `${ec.num_grupos} ${ec.num_grupos === 1 ? 'grupo' : 'grupos'}`
      : 'grupos não definidos';
    const tipo = ROTULO_TIPO[ec.tipo] || ec.tipo || '';
    const formato = ROTULO_FORMATO[ec.formato] || ec.formato || '';
    return `
      <div class="item">
        <div class="item-info">
          <div class="item-titulo">${App.escapar(ec.categoria_nome)} — ${App.escapar(tipo)}</div>
          <div class="item-sub">${grupos} · ${App.escapar(formato)}</div>
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
      ? `<input type="text" value="${App.escapar(ROTULO_TIPO[ec.tipo] || '')}" disabled>`
      : `<select id="f-tipo">
           <option value="masculino">Masculino</option>
           <option value="feminino">Feminino</option>
         </select>`;
    // O formato pode ser ajustado também na edição (vale na hora de gerar
    // os jogos da fase de grupos).
    const fmtAtual = editando ? ec.formato : 'todos-contra-todos';
    const seletorFormato = `<select id="f-formato">
        ${Object.entries(ROTULO_FORMATO).map(([v, rotulo]) =>
          `<option value="${v}"${v === fmtAtual ? ' selected' : ''}>${rotulo}</option>`
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
      const erroEl = area.querySelector('#f-erro');
      const numGrupos = Number(area.querySelector('#f-grupos').value) || null;
      const formato = area.querySelector('#f-formato').value;
      if (editando) {
        // Preserva o config_json existente ao salvar nº de grupos e formato.
        await apiEC().atualizar(ec.id,
          { numGrupos, configJson: ec.config_json, formato });
      } else {
        const categoriaId = Number(area.querySelector('#f-categoria').value);
        const tipo = area.querySelector('#f-tipo').value;
        if (combosUsados.has(chaveCombo(categoriaId, tipo))) {
          erroEl.textContent = 'Essa categoria já foi adicionada neste tipo.';
          return;
        }
        await apiEC().criar({ etapaId, categoriaId, tipo, formato, numGrupos });
      }
      await App.recarregar();
    };
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
