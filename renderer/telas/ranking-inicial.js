// Tela de cadastro do ranking inicial da temporada.
// O ranking de cada atleta numa categoria+tipo pode ser cadastrado em:
//   - "Inicial": pontos pré-temporada (bônus que entra sem etapa específica).
//   - Uma coluna por etapa já realizada: para importar resultados anteriores
//     no formato da planilha do circuito.
// O "Total" é a soma de tudo e é exibido só pra conferência.
// params: { temporadaId }
(() => {
  const apiTemp = () => window.electronAPI.db.temporada;
  const apiCat = () => window.electronAPI.db.categoria;
  const apiEtapa = () => window.electronAPI.db.etapa;
  const apiAtl = () => window.electronAPI.db.atleta;
  const apiRI = () => window.electronAPI.db.rankingInicial;

  App.registrarTela('ranking-inicial', { render });

  let estado = null;

  async function render(container, params) {
    const { temporadaId } = params;
    const [temp, categorias, atletas, etapas] = await Promise.all([
      apiTemp().obter(temporadaId),
      apiCat().listar(),
      apiAtl().listar(),
      apiEtapa().listar(temporadaId),
    ]);

    estado = {
      temporadaId, temp, categorias, atletas, etapas,
      categoriaId: categorias[0] ? categorias[0].id : null,
      tipo: 'masculino',
      linhas: [],
    };

    container.innerHTML = `
      <div class="topo-tela">
        <h2>Ranking inicial — ${App.escapar(temp.nome)}</h2>
      </div>
      <p class="dica">Pontos pré-cadastrados de cada atleta na temporada,
        por categoria e tipo. "Inicial" é um bônus pré-temporada; depois,
        uma coluna por etapa já realizada (use para importar a planilha do
        circuito). Tudo soma no ranking de entrada das próximas etapas e
        no ranking da temporada. Para colar do Excel, clique numa célula e
        cole — preenche para baixo e para a direita.</p>
      <div class="grid-toolbar">
        <label for="ri-cat">Categoria</label>
        <select id="ri-cat">
          ${categorias.map(c => `<option value="${c.id}">${App.escapar(c.nome)}</option>`).join('')}
        </select>
        <label for="ri-tipo">Tipo</label>
        <select id="ri-tipo">
          <option value="masculino">Masculino</option>
          <option value="feminino">Feminino</option>
        </select>
        <label for="ri-qtd">Qtd. de linhas</label>
        <input type="number" id="ri-qtd" min="0" max="999" style="width:80px">
      </div>
      <div id="grid-ri"></div>
      <div class="form-acoes">
        <button class="btn ghost sm" id="btn-ri-add">Adicionar atleta</button>
        <button class="btn" id="btn-ri-salvar">Salvar ranking</button>
      </div>
      <div class="form-erro" id="ri-erro"></div>
      <div id="ri-ok"></div>
      <datalist id="lista-atletas-ri">
        ${atletas.map(a => `<option value="${App.escapar(a.nome)}"></option>`).join('')}
      </datalist>`;

    const catSel = container.querySelector('#ri-cat');
    const tipoSel = container.querySelector('#ri-tipo');
    catSel.onchange = () => { estado.categoriaId = Number(catSel.value); carregar(); };
    tipoSel.onchange = () => { estado.tipo = tipoSel.value; carregar(); };
    container.querySelector('#btn-ri-add').onclick = adicionar;
    container.querySelector('#btn-ri-salvar').onclick = (e) => salvar(e.target);
    container.querySelector('#grid-ri').addEventListener('paste', aoColar);
    container.querySelector('#ri-qtd').onchange = ajustarQuantidade;

    await carregar();
  }

  // Ordem das colunas do grid (pra colar do Excel coluna a coluna). É
  // montada dinamicamente porque o nº de etapas muda por temporada.
  function colunas() {
    return [
      { chave: 'nome', tipo: 'texto' },
      { chave: 'nome_completo', tipo: 'texto' },
      { chave: 'inicial', tipo: 'numero' },
      ...estado.etapas.map(e => (
        { chave: `etapa:${e.id}`, etapaId: e.id, tipo: 'numero' })),
    ];
  }

  function linhaNova() {
    return { nome: '', nome_completo: '', inicial: 0, etapas: {} };
  }

  function valorDaLinha(linha, col) {
    if (col.chave === 'nome') return linha.nome;
    if (col.chave === 'nome_completo') return linha.nome_completo;
    if (col.chave === 'inicial') return linha.inicial;
    return linha.etapas[col.etapaId] || 0;
  }

  function gravarNaLinha(linha, col, valor) {
    if (col.tipo === 'numero') {
      const n = Number(valor) || 0;
      if (col.chave === 'inicial') linha.inicial = n;
      else linha.etapas[col.etapaId] = n;
    } else {
      if (col.chave === 'nome') linha.nome = valor;
      else linha.nome_completo = valor;
    }
  }

  function totalDaLinha(linha) {
    let t = Number(linha.inicial) || 0;
    for (const v of Object.values(linha.etapas)) t += Number(v) || 0;
    return t;
  }

  // Identifica em qual coluna do grid o input pertence (pra suportar paste).
  function colunaDoInput(input) {
    const cs = [...input.classList];
    if (cs.includes('ri-nome')) return 0;
    if (cs.includes('ri-nome-completo')) return 1;
    if (cs.includes('ri-inicial')) return 2;
    const m = cs.find(c => c.startsWith('ri-etapa-'));
    if (!m) return -1;
    const id = Number(m.slice('ri-etapa-'.length));
    const idx = estado.etapas.findIndex(e => e.id === id);
    return idx < 0 ? -1 : 3 + idx;
  }

  function aoColar(e) {
    const input = e.target;
    if (!input.matches || !input.matches('input')) return;
    const colInicio = colunaDoInput(input);
    if (colInicio < 0) return;

    const texto = (e.clipboardData || window.clipboardData).getData('text');
    const linhasTxt = texto.replace(/\r/g, '').split('\n');
    if (linhasTxt.length && linhasTxt[linhasTxt.length - 1] === '') linhasTxt.pop();
    // Colagem de uma única célula segue o comportamento normal do navegador.
    if (linhasTxt.length <= 1 && !texto.includes('\t')) return;

    e.preventDefault();
    lerGrid();
    const linhaInicio = Number(input.closest('tr').dataset.i);
    while (estado.linhas.length < linhaInicio + linhasTxt.length) {
      estado.linhas.push(linhaNova());
    }
    const cols = colunas();
    linhasTxt.forEach((linhaTexto, r) => {
      const alvo = estado.linhas[linhaInicio + r];
      if (!alvo) return;
      linhaTexto.split('\t').forEach((valor, c) => {
        const col = cols[colInicio + c];
        if (!col) return;
        gravarNaLinha(alvo, col, (valor || '').trim());
      });
    });
    desenhar();
  }

  async function carregar() {
    const rows = await apiRI().listar(
      estado.temporadaId, estado.categoriaId, estado.tipo);
    // O backend devolve uma linha por (atleta, etapa). Agrupa por atleta.
    const porAtleta = new Map();
    for (const r of rows) {
      if (!porAtleta.has(r.atleta_id)) {
        porAtleta.set(r.atleta_id, {
          nome: r.atleta_nome,
          nome_completo: r.atleta_nome_completo || '',
          inicial: 0,
          etapas: {},
        });
      }
      const a = porAtleta.get(r.atleta_id);
      if (r.etapa_id == null) a.inicial += r.pontos;
      else a.etapas[r.etapa_id] = (a.etapas[r.etapa_id] || 0) + r.pontos;
    }
    estado.linhas = [...porAtleta.values()];
    if (!estado.linhas.length) {
      estado.linhas.push(linhaNova());
    }
    document.getElementById('ri-qtd').value = estado.linhas.length;
    desenhar();
  }

  // Redimensiona o grid para a quantidade informada. Cresce adicionando
  // linhas em branco; encolhe descartando as linhas finais.
  function ajustarQuantidade() {
    const input = document.getElementById('ri-qtd');
    const n = Math.max(0, Number(input.value) || 0);
    lerGrid();
    while (estado.linhas.length < n) estado.linhas.push(linhaNova());
    if (estado.linhas.length > n) estado.linhas.length = n;
    desenhar();
  }

  function desenhar() {
    const qtdEl = document.getElementById('ri-qtd');
    if (qtdEl) qtdEl.value = estado.linhas.length;
    const colsEtapas = estado.etapas.map(e =>
      `<th class="col-pts">${App.escapar(e.nome)}</th>`).join('');
    document.getElementById('grid-ri').innerHTML = `
      <table class="grid-duplas">
        <thead><tr>
          <th class="idx">#</th>
          <th>Apelido</th>
          <th>Nome completo</th>
          <th class="col-pts">Inicial</th>
          ${colsEtapas}
          <th class="col-pts">Total</th>
          <th class="idx"></th>
        </tr></thead>
        <tbody>${estado.linhas.map(linhaHtml).join('')}</tbody>
      </table>`;
    document.querySelectorAll('#grid-ri [data-remover]').forEach(b => {
      b.onclick = () => {
        lerGrid();
        estado.linhas.splice(Number(b.dataset.remover), 1);
        desenhar();
      };
    });
    document.querySelectorAll('#grid-ri input.num').forEach(inp => {
      inp.oninput = atualizarTotalDaLinha;
    });
  }

  function linhaHtml(l, i) {
    const celulasEtapa = estado.etapas.map(e => {
      const v = l.etapas[e.id] || 0;
      return `<td class="col-pts"><input type="number" min="0"
        class="num ri-etapa-${e.id}" value="${v}"></td>`;
    }).join('');
    return `
      <tr data-i="${i}">
        <td class="idx">${i + 1}</td>
        <td><input type="text" class="ri-nome" list="lista-atletas-ri"
                   autocomplete="off" placeholder="Apelido"
                   value="${App.escapar(l.nome || '')}"></td>
        <td><input type="text" class="ri-nome-completo"
                   autocomplete="off" placeholder="Nome completo"
                   value="${App.escapar(l.nome_completo || '')}"></td>
        <td class="col-pts"><input type="number" min="0"
                   class="num ri-inicial"
                   value="${l.inicial != null ? l.inicial : 0}"></td>
        ${celulasEtapa}
        <td class="col-pts ri-total">${totalDaLinha(l)}</td>
        <td class="idx">
          <button class="btn danger sm" data-remover="${i}">×</button>
        </td>
      </tr>`;
  }

  function atualizarTotalDaLinha(ev) {
    const tr = ev.target.closest('tr');
    const i = Number(tr.dataset.i);
    const l = estado.linhas[i];
    if (!l) return;
    l.inicial = Number(tr.querySelector('.ri-inicial').value) || 0;
    estado.etapas.forEach(e => {
      const inp = tr.querySelector(`.ri-etapa-${e.id}`);
      if (inp) l.etapas[e.id] = Number(inp.value) || 0;
    });
    const totalEl = tr.querySelector('.ri-total');
    if (totalEl) totalEl.textContent = totalDaLinha(l);
  }

  // Captura o que está digitado no grid de volta para estado.linhas.
  function lerGrid() {
    document.querySelectorAll('#grid-ri tbody tr').forEach(tr => {
      const i = Number(tr.dataset.i);
      const l = estado.linhas[i];
      if (!l) return;
      l.nome = tr.querySelector('.ri-nome').value.trim();
      l.nome_completo = tr.querySelector('.ri-nome-completo').value.trim();
      l.inicial = Number(tr.querySelector('.ri-inicial').value) || 0;
      estado.etapas.forEach(e => {
        const inp = tr.querySelector(`.ri-etapa-${e.id}`);
        l.etapas[e.id] = inp ? (Number(inp.value) || 0) : 0;
      });
    });
  }

  function adicionar() {
    lerGrid();
    estado.linhas.push(linhaNova());
    desenhar();
  }

  async function salvar(botao) {
    lerGrid();
    const erroEl = document.getElementById('ri-erro');
    const okEl = document.getElementById('ri-ok');
    erroEl.textContent = '';
    okEl.innerHTML = '';
    const entradas = estado.linhas
      .filter(l => l.nome)
      .map(l => ({
        nome: l.nome,
        nome_completo: l.nome_completo || null,
        inicial: Number(l.inicial) || 0,
        porEtapa: l.etapas,
      }));
    botao.disabled = true;
    try {
      await apiRI().salvar(
        estado.temporadaId, estado.categoriaId, estado.tipo, entradas);
      okEl.innerHTML = '<div class="ok">Ranking salvo.</div>';
      // Recarrega para refletir IDs/normalização.
      await carregar();
    } catch (err) {
      erroEl.textContent = 'Erro ao salvar: ' + err.message;
    } finally {
      botao.disabled = false;
    }
  }
})();
