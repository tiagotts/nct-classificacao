// Tela de cadastro do ranking inicial da temporada.
// Pontos pré-cadastrados de cada atleta numa categoria + tipo da temporada.
// Servem como ranking de entrada da 1ª etapa e são somados aos pontos das
// etapas seguintes (acúmulo da temporada).
// params: { temporadaId }
(() => {
  const apiTemp = () => window.electronAPI.db.temporada;
  const apiCat = () => window.electronAPI.db.categoria;
  const apiAtl = () => window.electronAPI.db.atleta;
  const apiRI = () => window.electronAPI.db.rankingInicial;

  App.registrarTela('ranking-inicial', { render });

  let estado = null;

  async function render(container, params) {
    const { temporadaId } = params;
    const [temp, categorias, atletas] = await Promise.all([
      apiTemp().obter(temporadaId),
      apiCat().listar(),
      apiAtl().listar(),
    ]);

    estado = {
      temporadaId, temp, categorias, atletas,
      categoriaId: categorias[0] ? categorias[0].id : null,
      tipo: 'masculino',
      linhas: [],
    };

    container.innerHTML = `
      <div class="topo-tela">
        <h2>Ranking inicial — ${App.escapar(temp.nome)}</h2>
      </div>
      <p class="dica">Pontos pré-cadastrados de cada atleta para a temporada,
        por categoria e tipo. Servem como ranking de entrada da 1ª etapa
        e são somados aos pontos ganhos nas etapas seguintes. Para colar
        do Excel, use a ordem das colunas: apelido, nome completo, pontos.
        O ranking publicado mostra o nome completo (ou o apelido, se vazio).</p>
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

  // Colar do Excel: o usuário copia uma coluna (apelidos, nomes completos
  // ou pontos), clica numa célula do grid e cola — os valores preenchem
  // para baixo. Se a colagem for maior que o grid, novas linhas são
  // criadas para caber. A ordem das colunas é apelido, nome completo,
  // pontos.
  const COLUNAS = ['nome', 'nome_completo', 'pontos'];
  const CLASSE_CAMPO = {
    'ri-nome': 'nome',
    'ri-nome-completo': 'nome_completo',
    'ri-pts': 'pontos',
  };

  function linhaNova() {
    return { nome: '', nome_completo: '', pontos: 0 };
  }

  function aoColar(e) {
    const input = e.target;
    if (!input.matches || !input.matches('input')) return;
    const campo = CLASSE_CAMPO[[...input.classList].find(c => CLASSE_CAMPO[c])];
    if (!campo) return;

    const texto = (e.clipboardData || window.clipboardData).getData('text');
    const linhas = texto.replace(/\r/g, '').split('\n');
    if (linhas.length && linhas[linhas.length - 1] === '') linhas.pop();
    // Colagem de uma única célula segue o comportamento normal do navegador.
    if (linhas.length <= 1 && !texto.includes('\t')) return;

    e.preventDefault();
    lerGrid();
    const linhaInicio = Number(input.closest('tr').dataset.i);
    const colInicio = COLUNAS.indexOf(campo);
    // Cresce o grid se a colagem for maior que o que está visível.
    while (estado.linhas.length < linhaInicio + linhas.length) {
      estado.linhas.push(linhaNova());
    }
    linhas.forEach((linhaTexto, r) => {
      const alvo = estado.linhas[linhaInicio + r];
      if (!alvo) return;
      linhaTexto.split('\t').forEach((valor, c) => {
        const campoAlvo = COLUNAS[colInicio + c];
        if (!campoAlvo) return;
        const v = valor.trim();
        if (campoAlvo === 'pontos') alvo.pontos = Number(v) || 0;
        else alvo[campoAlvo] = v;
      });
    });
    desenhar();
  }

  async function carregar() {
    const rows = await apiRI().listar(
      estado.temporadaId, estado.categoriaId, estado.tipo);
    estado.linhas = rows.map(r => ({
      nome: r.atleta_nome,
      nome_completo: r.atleta_nome_completo || '',
      pontos: r.pontos,
    }));
    if (!estado.linhas.length) {
      // Começa com uma linha em branco para facilitar o primeiro cadastro.
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
    document.getElementById('grid-ri').innerHTML = `
      <table class="grid-duplas">
        <thead><tr>
          <th class="idx">#</th>
          <th>Apelido</th>
          <th>Nome completo</th>
          <th class="col-pts">Pontos</th>
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
  }

  function linhaHtml(l, i) {
    return `
      <tr data-i="${i}">
        <td class="idx">${i + 1}</td>
        <td><input type="text" class="ri-nome" list="lista-atletas-ri"
                   autocomplete="off" placeholder="Apelido"
                   value="${App.escapar(l.nome || '')}"></td>
        <td><input type="text" class="ri-nome-completo"
                   autocomplete="off" placeholder="Nome completo"
                   value="${App.escapar(l.nome_completo || '')}"></td>
        <td class="col-pts"><input type="number" min="0" class="ri-pts"
                   value="${l.pontos != null ? l.pontos : ''}"></td>
        <td class="idx">
          <button class="btn danger sm" data-remover="${i}">×</button>
        </td>
      </tr>`;
  }

  // Captura o que está digitado no grid de volta para estado.linhas.
  function lerGrid() {
    document.querySelectorAll('#grid-ri tbody tr').forEach(tr => {
      const i = Number(tr.dataset.i);
      const l = estado.linhas[i];
      if (!l) return;
      l.nome = tr.querySelector('.ri-nome').value.trim();
      l.nome_completo = tr.querySelector('.ri-nome-completo').value.trim();
      l.pontos = Number(tr.querySelector('.ri-pts').value) || 0;
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
        pontos: l.pontos,
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
