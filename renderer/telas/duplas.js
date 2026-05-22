// Tela de cadastro de duplas de uma categoria da etapa.
// Em vez de um formulário por dupla, usa um combo de quantidade + um grid
// editável: escolhe-se quantas duplas e preenchem-se as linhas de uma vez.
// Código e grupo já vêm pré-preenchidos; atletas novos são criados ao salvar.
// params: { etapaCategoriaId }
(() => {
  const apiDupla = () => window.electronAPI.db.dupla;
  const apiAtleta = () => window.electronAPI.db.atleta;
  const apiEC = () => window.electronAPI.db.etapaCategoria;

  // 9 e 15 cobrem os formatos de grupos de 3 (ex.: 9 duplas = 3 grupos de 3,
  // com mata-mata de 8 e o 9º eliminado).
  const QUANTIDADES_BASE = [4, 6, 8, 9, 10, 12, 14, 15, 16, 18, 20, 24, 28, 32];

  App.registrarTela('duplas', { render });

  // Estado da tela enquanto está aberta.
  // linhas: [{ duplaId|null, codigo, grupo, atleta1, atleta2 }]
  let estado = null;

  async function render(container, params) {
    const { etapaCategoriaId } = params;
    const [ec, duplas, atletas] = await Promise.all([
      apiEC().obter(etapaCategoriaId),
      apiDupla().listar(etapaCategoriaId),
      apiAtleta().listar(),
    ]);

    estado = {
      etapaCategoriaId,
      ec,
      atletas,
      idsOriginais: duplas.map(d => d.id),
      linhas: duplas.map(d => ({
        duplaId: d.id, codigo: d.codigo, grupo: d.grupo || '',
        atleta1: d.atleta1_nome, atleta2: d.atleta2_nome,
      })),
      pontosPorDupla: {},
    };

    const qtdInicial = estado.linhas.length || sugestaoQuantidade(ec);
    const qtds = [...new Set([...QUANTIDADES_BASE, qtdInicial])].sort((a, b) => a - b);

    container.innerHTML = `
      <div class="topo-tela">
        <h2>Duplas</h2>
        <div class="grid-toolbar">
          <label for="combo-qtd">Quantidade de duplas</label>
          <select id="combo-qtd">
            ${qtds.map(q => `<option value="${q}"${q === qtdInicial ? ' selected' : ''}>${q}</option>`).join('')}
          </select>
          <button class="btn ghost sm" id="btn-ranking-entrada">Aplicar ranking</button>
          <button class="btn ghost sm" id="btn-serpentina">Distribuir em grupos</button>
        </div>
      </div>
      <p class="dica">Código e grupo já vêm preenchidos — ajuste se precisar.
        Limpar todos os campos de uma linha remove a dupla ao salvar.
        "Distribuir em grupos" reparte as duplas em serpentina pelos grupos,
        seguindo a ordem das linhas (1ª colocada do ranking no topo).
        Dica: dá para colar (Ctrl+V) uma coluna copiada de uma planilha —
        clique na primeira célula e cole; preenche para baixo. Se cada célula
        tiver os dois nomes ("Atleta 1 / Atleta 2"), cole na coluna Atleta 1
        que o app separa pela barra.</p>
      <div id="grid"></div>
      <div class="total-ranking" id="total-ranking"></div>
      <div class="form-erro" id="grid-erro"></div>
      <div class="form-acoes">
        <button class="btn" id="btn-salvar">Salvar duplas</button>
      </div>
      <datalist id="lista-atletas">
        ${atletas.map(a => `<option value="${App.escapar(a.nome)}"></option>`).join('')}
      </datalist>`;

    ajustarQuantidade(qtdInicial);
    desenharGrid();
    // Os pontos do ranking só aparecem quando o usuário clica em
    // "Aplicar ranking". Até lá a coluna fica em branco.

    container.querySelector('#combo-qtd').onchange = (e) => {
      lerGridParaEstado();
      // Trocar a quantidade re-distribui código e grupo de todas as linhas
      // pelo novo layout (ex.: de 12 para 9 vira 3 grupos de 3).
      ajustarQuantidade(Number(e.target.value), true);
      desenharGrid();
    };
    container.querySelector('#btn-serpentina').onclick = distribuirSerpentina;
    container.querySelector('#btn-ranking-entrada').onclick = aplicarRankingEntrada;
    container.querySelector('#btn-salvar').onclick = (e) => salvar(e.target);
    container.querySelector('#grid').addEventListener('paste', aoColar);
  }

  // Reordena as linhas pelo ranking de entrada: pontos somados dos atletas
  // (iniciais + etapas anteriores), com desempate por melhores colocações
  // dos atletas. Duplas que ficam empatadas até nisso vêm marcadas
  // (sorteada=true) para o usuário ajustar a ordem manualmente — o app NÃO
  // sorteia. Linhas ainda não salvas (sem duplaId) ficam no final.
  async function aplicarRankingEntrada() {
    lerGridParaEstado();
    const ranking = await window.electronAPI.db.rankingEntrada
      .calcular(estado.etapaCategoriaId);
    if (!ranking.length) {
      alert('Salve as duplas antes de aplicar o ranking de entrada.');
      return;
    }
    const ordem = {};
    estado.sorteadas = new Set();
    ranking.forEach(d => {
      ordem[d.id] = d.pos;
      if (d.sorteada) estado.sorteadas.add(d.id);
    });
    estado.linhas.sort((a, b) => {
      const pa = a.duplaId != null ? (ordem[a.duplaId] || 9999) : 9999;
      const pb = b.duplaId != null ? (ordem[b.duplaId] || 9999) : 9999;
      return pa - pb;
    });
    desenharGrid();
    mostrarTotalRanking(ranking);
    if (estado.sorteadas.size) {
      const n = estado.sorteadas.size;
      alert(`${n} dupla(s) ficaram empatadas após os critérios — use as `
        + `setas ↑↓ para definir manualmente a ordem do sorteio.`);
    }
  }

  // Atualiza a coluna Pontos do grid e o totalizador no rodapé a partir do
  // ranking calculado. Só é chamada depois que o usuário clica em
  // "Aplicar ranking" — até lá os pontos ficam zerados/em branco.
  function mostrarTotalRanking(ranking) {
    estado.pontosPorDupla = {};
    (ranking || []).forEach(d => {
      estado.pontosPorDupla[d.id] = {
        p1: d.pontos1 || 0, p2: d.pontos2 || 0, total: d.score || 0,
      };
    });
    document.querySelectorAll('#grid tbody tr').forEach(tr => {
      const i = Number(tr.dataset.i);
      const linha = estado.linhas[i];
      const cel = tr.querySelector('.col-pts');
      if (!cel) return;
      const info = linha && linha.duplaId != null
        ? estado.pontosPorDupla[linha.duplaId] : null;
      cel.textContent = info ? `${info.p1} + ${info.p2} = ${info.total}` : '';
    });
    const el = document.getElementById('total-ranking');
    if (!el) return;
    if (!ranking || !ranking.length) { el.textContent = ''; return; }
    const total = ranking.reduce((s, d) => s + (d.score || 0), 0);
    el.textContent = `Soma do ranking das duplas: ${total}`;
  }

  // Campos do grid, na ordem das colunas — usado para colar de planilha.
  const COLUNAS = ['codigo', 'grupo', 'atleta1', 'atleta2'];
  const CLASSE_CAMPO = {
    'c-cod': 'codigo', 'c-grupo': 'grupo', 'c-at1': 'atleta1', 'c-at2': 'atleta2',
  };

  // Atribui um valor a um campo da linha. Quando o campo é o Atleta 1 e o
  // valor traz os dois nomes na mesma célula ("Atleta 1 / Atleta 2"), separa
  // pela barra — é como as planilhas do circuito guardam a dupla.
  function atribuir(linha, campo, valor) {
    const v = valor.trim();
    if (campo === 'atleta1' && v.includes('/')) {
      const i = v.indexOf('/');
      linha.atleta1 = v.slice(0, i).trim();
      linha.atleta2 = v.slice(i + 1).trim();
    } else {
      linha[campo] = v;
    }
  }

  // Colar do Excel: o usuário copia uma coluna (ou bloco) de células, clica
  // numa célula do grid e cola — os valores preenchem para baixo/direita.
  // Se a célula da dupla tiver "Atleta 1 / Atleta 2", a barra separa os dois.
  function aoColar(e) {
    const input = e.target;
    if (!input.matches || !input.matches('input')) return;
    const campo = CLASSE_CAMPO[[...input.classList].find(c => CLASSE_CAMPO[c])];
    if (!campo) return;

    const texto = (e.clipboardData || window.clipboardData).getData('text');
    const linhas = texto.replace(/\r/g, '').split('\n');
    if (linhas.length && linhas[linhas.length - 1] === '') linhas.pop();

    const varias = linhas.length > 1 || texto.includes('\t');
    const duplaNaCelula = campo === 'atleta1' && texto.includes('/');
    // Colagem de uma célula simples (sem barra) segue o comportamento normal.
    if (!varias && !duplaNaCelula) return;

    e.preventDefault();
    lerGridParaEstado();
    const linhaInicio = Number(input.closest('tr').dataset.i);
    const colInicio = COLUNAS.indexOf(campo);
    linhas.forEach((linhaTexto, r) => {
      const alvo = estado.linhas[linhaInicio + r];
      if (!alvo) return;
      linhaTexto.split('\t').forEach((valor, c) => {
        const campoAlvo = COLUNAS[colInicio + c];
        if (campoAlvo) atribuir(alvo, campoAlvo, valor);
      });
    });
    desenharGrid();
  }

  // Sugere uma quantidade inicial quando ainda não há duplas.
  function sugestaoQuantidade(ec) {
    return ec && ec.num_grupos ? ec.num_grupos * 4 : 12;
  }

  // Gera código + grupo para cada posição, distribuindo as duplas pelos grupos
  // o mais uniformemente possível.
  function gerarPosicoes(qtd, numGrupos) {
    const pos = [];
    if (!numGrupos || numGrupos < 1) {
      for (let i = 0; i < qtd; i++) pos.push({ codigo: String(i + 1), grupo: '' });
      return pos;
    }
    const base = Math.floor(qtd / numGrupos);
    const resto = qtd % numGrupos;
    for (let g = 0; g < numGrupos; g++) {
      const tamanho = base + (g < resto ? 1 : 0);
      const letra = String.fromCharCode(65 + g);
      for (let n = 1; n <= tamanho; n++) {
        pos.push({ codigo: `${letra}${n}`, grupo: letra });
      }
    }
    return pos;
  }

  // Redimensiona estado.linhas para a quantidade pedida.
  // regenerar = true reescreve código e grupo de TODAS as linhas pelo novo
  // layout (usado ao trocar a quantidade). regenerar = false só preenche as
  // linhas novas ou as que estiverem sem código/grupo (usado na carga
  // inicial, para preservar o que veio do banco).
  function ajustarQuantidade(qtd, regenerar) {
    const pos = gerarPosicoes(qtd, estado.ec.num_grupos);
    const novas = [];
    for (let i = 0; i < qtd; i++) {
      const linha = estado.linhas[i];
      if (linha) {
        if (regenerar || !linha.codigo) linha.codigo = pos[i].codigo;
        if (regenerar || !linha.grupo) linha.grupo = pos[i].grupo;
        novas.push(linha);
      } else {
        novas.push({
          duplaId: null, codigo: pos[i].codigo, grupo: pos[i].grupo,
          atleta1: '', atleta2: '',
        });
      }
    }
    estado.linhas = novas;
  }

  // Distribui as duplas pelos grupos em serpentina, seguindo a ordem das
  // linhas (1ª colocada do ranking no topo). A regra está no motor
  // src/motor/serpentina.js (distribuirEmGrupos).
  function distribuirSerpentina() {
    const ng = estado.ec.num_grupos;
    if (!ng || ng < 1) {
      alert('Defina o número de grupos da categoria antes de distribuir.');
      return;
    }
    lerGridParaEstado();
    const pos = distribuirEmGrupos(estado.linhas.length, ng);
    estado.linhas.forEach((linha, i) => {
      linha.grupo = pos[i].grupo;
      linha.codigo = pos[i].codigo;
    });
    desenharGrid();
  }

  // Captura o que está digitado no grid de volta para estado.linhas.
  function lerGridParaEstado() {
    document.querySelectorAll('#grid tbody tr').forEach(tr => {
      const i = Number(tr.dataset.i);
      const linha = estado.linhas[i];
      if (!linha) return;
      linha.codigo = tr.querySelector('.c-cod').value.trim();
      linha.grupo = tr.querySelector('.c-grupo').value.trim();
      linha.atleta1 = tr.querySelector('.c-at1').value.trim();
      linha.atleta2 = tr.querySelector('.c-at2').value.trim();
    });
  }

  function desenharGrid() {
    document.getElementById('grid').innerHTML = `
      <table class="grid-duplas">
        <thead>
          <tr>
            <th class="idx">#</th>
            <th class="col-cod">Código</th>
            <th class="col-grupo">Grupo</th>
            <th>Atleta 1</th>
            <th>Atleta 2</th>
            <th class="col-pts">Pontos</th>
            <th class="col-ordem">Ordem</th>
          </tr>
        </thead>
        <tbody>
          ${estado.linhas.map(linhaHtml).join('')}
        </tbody>
      </table>`;
    document.querySelectorAll('#grid [data-mover]').forEach(b => {
      b.onclick = () => moverLinha(Number(b.dataset.i), b.dataset.mover);
    });
  }

  function moverLinha(i, direcao) {
    const j = direcao === 'cima' ? i - 1 : i + 1;
    if (j < 0 || j >= estado.linhas.length) return;
    lerGridParaEstado();
    [estado.linhas[i], estado.linhas[j]] = [estado.linhas[j], estado.linhas[i]];
    desenharGrid();
  }

  function linhaHtml(linha, i) {
    const info = linha.duplaId != null ? estado.pontosPorDupla[linha.duplaId] : null;
    const txt = info ? `${info.p1} + ${info.p2} = ${info.total}` : '';
    const empate = estado.sorteadas && linha.duplaId != null
      && estado.sorteadas.has(linha.duplaId);
    const trCls = empate ? ' class="sorteada"' : '';
    const tagEmpate = empate ? ' <span class="tag-sorteio">sorteio</span>' : '';
    return `
      <tr data-i="${i}"${trCls}>
        <td class="idx">${i + 1}${tagEmpate}</td>
        <td class="col-cod">
          <input type="text" class="c-cod" value="${App.escapar(linha.codigo)}"></td>
        <td class="col-grupo">${celulaGrupo(linha.grupo)}</td>
        <td><input type="text" class="c-at1" list="lista-atletas" autocomplete="off"
                   placeholder="Atleta 1" value="${App.escapar(linha.atleta1)}"></td>
        <td><input type="text" class="c-at2" list="lista-atletas" autocomplete="off"
                   placeholder="Atleta 2" value="${App.escapar(linha.atleta2)}"></td>
        <td class="col-pts">${App.escapar(txt)}</td>
        <td class="col-ordem">
          <button class="btn ghost sm" data-mover="cima" data-i="${i}"
                  title="Subir" ${i === 0 ? 'disabled' : ''}>↑</button>
          <button class="btn ghost sm" data-mover="baixo" data-i="${i}"
                  title="Descer" ${i === estado.linhas.length - 1 ? 'disabled' : ''}>↓</button>
        </td>
      </tr>`;
  }

  // Grupo: select A, B, C... quando o nº de grupos é conhecido; senão texto livre.
  function celulaGrupo(valor) {
    const ng = estado.ec.num_grupos;
    if (ng) {
      let opcoes = '<option value="">—</option>';
      for (let g = 0; g < ng; g++) {
        const letra = String.fromCharCode(65 + g);
        opcoes += `<option value="${letra}"${letra === valor ? ' selected' : ''}>${letra}</option>`;
      }
      return `<select class="c-grupo">${opcoes}</select>`;
    }
    return `<input type="text" class="c-grupo" maxlength="2" value="${App.escapar(valor)}">`;
  }

  // Devolve o id do atleta com este nome, criando-o se ainda não existir.
  async function resolverAtleta(nome) {
    const existente = estado.atletas.find(
      a => a.nome.toLowerCase() === nome.toLowerCase());
    if (existente) return existente.id;
    const novo = await apiAtleta().criar({ nome });
    estado.atletas.push(novo);
    return novo.id;
  }

  async function salvar(botao) {
    lerGridParaEstado();
    const erroEl = document.getElementById('grid-erro');
    const erros = [];
    const validas = [];

    estado.linhas.forEach((l, i) => {
      const temAlgo = l.codigo || l.atleta1 || l.atleta2;
      const completa = l.codigo && l.atleta1 && l.atleta2;
      if (temAlgo && !completa) {
        erros.push(`Linha ${i + 1}: preencha código e os dois atletas.`);
      } else if (completa) {
        if (l.atleta1.toLowerCase() === l.atleta2.toLowerCase()) {
          erros.push(`Linha ${i + 1}: os dois atletas devem ser diferentes.`);
        } else {
          validas.push(l);
        }
      }
    });

    // Códigos repetidos no grid.
    const vistos = new Set();
    for (const l of validas) {
      const c = l.codigo.toLowerCase();
      if (vistos.has(c)) erros.push(`Código "${l.codigo}" está repetido.`);
      vistos.add(c);
    }

    if (erros.length) {
      erroEl.innerHTML = erros.map(App.escapar).join('<br>');
      return;
    }
    erroEl.textContent = '';

    // Duplas que existiam e não estão mais no grid (linha esvaziada/removida).
    const idsNoGrid = new Set(validas.filter(l => l.duplaId).map(l => l.duplaId));
    const aRemover = estado.idsOriginais.filter(id => !idsNoGrid.has(id));
    if (aRemover.length &&
        !confirm(`${aRemover.length} dupla(s) já cadastrada(s) serão removidas. Continuar?`)) {
      return;
    }

    botao.disabled = true;
    try {
      for (const l of validas) {
        const atleta1Id = await resolverAtleta(l.atleta1);
        const atleta2Id = await resolverAtleta(l.atleta2);
        const dados = { codigo: l.codigo, grupo: l.grupo || null, atleta1Id, atleta2Id };
        if (l.duplaId) await apiDupla().atualizar(l.duplaId, dados);
        else await apiDupla().criar({ etapaCategoriaId: estado.etapaCategoriaId, ...dados });
      }
      for (const id of aRemover) await apiDupla().remover(id);
      await App.recarregar();
    } catch (err) {
      erroEl.textContent = 'Erro ao salvar: ' + err.message;
      botao.disabled = false;
    }
  }
})();
