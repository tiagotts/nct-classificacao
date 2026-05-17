// Tela de cadastro de etapas de uma temporada.
// params: { temporadaId }
(() => {
  const api = () => window.electronAPI.db.etapa;

  App.registrarTela('etapas', { render });

  async function render(container, params) {
    const { temporadaId } = params;
    const etapas = await api().listar(temporadaId);

    container.innerHTML = `
      <div class="topo-tela">
        <h2>Etapas</h2>
        <div class="acoes-topo">
          <button class="btn ghost" data-acao="ranking">Ranking da temporada</button>
          <button class="btn" data-acao="nova">Nova etapa</button>
        </div>
      </div>
      <div id="form-area"></div>
      <div class="lista">
        ${etapas.length
          ? etapas.map(itemHtml).join('')
          : '<div class="vazio">Nenhuma etapa cadastrada nesta temporada.</div>'}
      </div>`;

    container.querySelector('[data-acao="nova"]').onclick =
      () => abrirForm(container, temporadaId);
    container.querySelector('[data-acao="ranking"]').onclick =
      () => App.navegar('ranking-temporada', { temporadaId }, 'Ranking da temporada');

    container.querySelectorAll('[data-acao="editar"]').forEach(b => {
      b.onclick = () => abrirForm(container, temporadaId,
        etapas.find(e => e.id === Number(b.dataset.id)));
    });
    container.querySelectorAll('[data-acao="remover"]').forEach(b => {
      b.onclick = () => remover(Number(b.dataset.id));
    });
    container.querySelectorAll('[data-acao="abrir"]').forEach(b => {
      b.onclick = () => {
        const e = etapas.find(x => x.id === Number(b.dataset.id));
        App.navegar('etapa-categorias', { etapaId: e.id }, e.nome);
      };
    });
  }

  function itemHtml(e) {
    const detalhes = [formatarData(e.data), e.local].filter(Boolean).join(' · ');
    return `
      <div class="item">
        <div class="item-info">
          <div class="item-titulo">${App.escapar(e.nome)}</div>
          <div class="item-sub">${detalhes ? App.escapar(detalhes) : 'Sem data/local'}</div>
        </div>
        <div class="item-acoes">
          <button class="btn ghost sm" data-acao="editar" data-id="${e.id}">Editar</button>
          <button class="btn danger sm" data-acao="remover" data-id="${e.id}">Remover</button>
          <button class="btn sm" data-acao="abrir" data-id="${e.id}">Categorias &rsaquo;</button>
        </div>
      </div>`;
  }

  function abrirForm(container, temporadaId, etapa) {
    const area = container.querySelector('#form-area');
    const editando = !!etapa;
    area.innerHTML = `
      <div class="form-card">
        <h3>${editando ? 'Editar etapa' : 'Nova etapa'}</h3>
        <div class="form-row">
          <label>Nome</label>
          <input type="text" id="f-nome" placeholder="4ª Etapa"
                 value="${editando ? App.escapar(etapa.nome) : ''}">
        </div>
        <div class="form-row">
          <label>Data</label>
          <input type="date" id="f-data" value="${editando && etapa.data ? etapa.data : ''}">
        </div>
        <div class="form-row">
          <label>Local</label>
          <input type="text" id="f-local" placeholder="Arena 61"
                 value="${editando && etapa.local ? App.escapar(etapa.local) : ''}">
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
      const data = area.querySelector('#f-data').value || null;
      const local = area.querySelector('#f-local').value.trim() || null;
      const erro = area.querySelector('#f-erro');
      if (!nome) { erro.textContent = 'Informe o nome da etapa.'; return; }
      if (editando) await api().atualizar(etapa.id, { nome, data, local });
      else await api().criar({ temporadaId, nome, data, local });
      await App.recarregar();
    };
  }

  async function remover(id) {
    if (!confirm('Remover esta etapa?')) return;
    try {
      await api().remover(id);
      await App.recarregar();
    } catch (err) {
      alert('Não foi possível remover: a etapa tem categorias cadastradas.');
    }
  }

  // Converte 'AAAA-MM-DD' para 'DD/MM/AAAA' na exibição.
  function formatarData(iso) {
    if (!iso) return '';
    const [a, m, d] = iso.split('-');
    return (a && m && d) ? `${d}/${m}/${a}` : iso;
  }
})();
