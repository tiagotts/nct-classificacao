// Tela de cadastro de temporadas (o nível mais alto da hierarquia).
(() => {
  const api = () => window.electronAPI.db.temporada;

  App.registrarTela('temporadas', { render });

  async function render(container, params) {
    const temporadas = await api().listar();

    container.innerHTML = `
      <div class="topo-tela">
        <h2>Temporadas</h2>
        <button class="btn" data-acao="nova">Nova temporada</button>
      </div>
      <div id="form-area"></div>
      <div class="lista">
        ${temporadas.length
          ? temporadas.map(itemHtml).join('')
          : '<div class="vazio">Nenhuma temporada cadastrada. Crie a primeira.</div>'}
      </div>`;

    container.querySelector('[data-acao="nova"]').onclick = () => abrirForm(container);

    container.querySelectorAll('[data-acao="editar"]').forEach(b => {
      b.onclick = () => abrirForm(container,
        temporadas.find(t => t.id === Number(b.dataset.id)));
    });
    container.querySelectorAll('[data-acao="remover"]').forEach(b => {
      b.onclick = () => remover(Number(b.dataset.id));
    });
    container.querySelectorAll('[data-acao="abrir"]').forEach(b => {
      b.onclick = () => {
        const t = temporadas.find(x => x.id === Number(b.dataset.id));
        App.navegar('etapas', { temporadaId: t.id }, t.nome);
      };
    });
  }

  function itemHtml(t) {
    return `
      <div class="item">
        <div class="item-info">
          <div class="item-titulo">${App.escapar(t.nome)}</div>
          <div class="item-sub">Ano ${t.ano}</div>
        </div>
        <div class="item-acoes">
          <button class="btn ghost sm" data-acao="editar" data-id="${t.id}">Editar</button>
          <button class="btn danger sm" data-acao="remover" data-id="${t.id}">Remover</button>
          <button class="btn sm" data-acao="abrir" data-id="${t.id}">Etapas &rsaquo;</button>
        </div>
      </div>`;
  }

  function abrirForm(container, temporada) {
    const area = container.querySelector('#form-area');
    const editando = !!temporada;
    area.innerHTML = `
      <div class="form-card">
        <h3>${editando ? 'Editar temporada' : 'Nova temporada'}</h3>
        <div class="form-row">
          <label>Nome</label>
          <input type="text" id="f-nome" placeholder="Circuito NCT 2025"
                 value="${editando ? App.escapar(temporada.nome) : ''}">
        </div>
        <div class="form-row">
          <label>Ano</label>
          <input type="number" id="f-ano" min="2000" max="2100"
                 value="${editando ? temporada.ano : new Date().getFullYear()}">
        </div>
        <div class="form-acoes">
          <button class="btn" id="f-salvar">Salvar</button>
          <button class="btn ghost" id="f-cancelar">Cancelar</button>
        </div>
        <div class="form-erro" id="f-erro"></div>
      </div>`;

    area.querySelector('#f-cancelar').onclick = () => { area.innerHTML = ''; };
    area.querySelector('#f-nome').focus();
    area.querySelector('#f-salvar').onclick = async () => {
      const nome = area.querySelector('#f-nome').value.trim();
      const ano = Number(area.querySelector('#f-ano').value);
      const erro = area.querySelector('#f-erro');
      if (!nome) { erro.textContent = 'Informe o nome da temporada.'; return; }
      if (!ano) { erro.textContent = 'Informe um ano válido.'; return; }
      if (editando) await api().atualizar(temporada.id, { nome, ano });
      else await api().criar({ nome, ano });
      await App.recarregar();
    };
  }

  async function remover(id) {
    if (!confirm('Remover esta temporada?')) return;
    try {
      await api().remover(id);
      await App.recarregar();
    } catch (err) {
      alert('Não foi possível remover: a temporada tem etapas cadastradas.');
    }
  }
})();
