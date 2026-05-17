// =============================================================================
// Núcleo do app: roteador, estado de navegação e menu lateral.
//
// As telas se registram via App.registrarTela(nome, { render }). render recebe
// (container, params) e desenha dentro do #conteudo.
//
// A navegação mantém uma pilha de telas. O menu lateral é desenhado a partir
// dessa pilha: cada nível é um item clicável. Dentro de uma categoria, as
// quatro seções (Duplas, Jogos, Classificação, Mata-mata) aparecem como
// subitens — alternar entre elas troca a tela no lugar, sem empilhar.
// =============================================================================

const App = (() => {
  const telas = {};
  let pilha = [];               // [{ nome, params, titulo }]
  let conteudo, navEl;

  // Seções de uma categoria: [nomeDaTela, rótulo].
  const SECOES = [
    ['duplas', 'Duplas'],
    ['jogos', 'Jogos'],
    ['classificacao', 'Classificação'],
    ['chave', 'Mata-mata'],
    ['config-categoria', 'Configuração'],
  ];
  const NOMES_SECAO = SECOES.map(s => s[0]);

  function registrarTela(nome, def) {
    telas[nome] = def;
  }

  async function iniciar() {
    conteudo = document.getElementById('conteudo');
    navEl = document.getElementById('nav');
    await navegar('temporadas', {}, 'Temporadas');
  }

  // Empilha uma tela nova (drill-down) e desenha.
  async function navegar(nome, params = {}, titulo = '') {
    pilha.push({ nome, params, titulo: titulo || nome });
    await desenhar();
  }

  // Navega para uma seção da categoria. Se a tela atual já é uma seção,
  // troca no lugar (não empilha) — alternar seções não cria níveis novos.
  async function navegarSecao(nome, params = {}, titulo = '') {
    const entrada = { nome, params, titulo: titulo || nome };
    const topo = pilha[pilha.length - 1];
    if (NOMES_SECAO.includes(topo.nome)) {
      pilha[pilha.length - 1] = entrada;
    } else {
      pilha.push(entrada);
    }
    await desenhar();
  }

  // Volta para um nível anterior da pilha (clique no menu lateral).
  async function voltarPara(indice) {
    pilha = pilha.slice(0, indice + 1);
    await desenhar();
  }

  // Redesenha a tela atual (após criar/editar/remover).
  async function recarregar() {
    await desenhar();
  }

  async function desenhar() {
    renderMenu();
    conteudo.innerHTML = '<div class="carregando">Carregando…</div>';
    const atual = pilha[pilha.length - 1];
    try {
      await telas[atual.nome].render(conteudo, atual.params);
    } catch (err) {
      conteudo.innerHTML =
        `<div class="erro">Erro ao carregar a tela: ${escapar(err.message)}</div>`;
    }
  }

  // Desenha o menu lateral a partir da pilha de navegação.
  function renderMenu() {
    const topo = pilha[pilha.length - 1];
    const topoESecao = NOMES_SECAO.includes(topo.nome);
    const idxCategoria = pilha.findIndex(p => p.nome === 'categoria-detalhe');

    let html = '';
    pilha.forEach((entry, i) => {
      if (NOMES_SECAO.includes(entry.nome)) return; // seções vêm dos subitens
      const ativo = i === pilha.length - 1 && !topoESecao;
      html += `<button class="nav-item nivel-${Math.min(i, 5)}${ativo ? ' ativo' : ''}"
        data-voltar="${i}" title="${escapar(entry.titulo)}">${escapar(entry.titulo)}</button>`;

      // Logo após a categoria, lista as quatro seções.
      if (i === idxCategoria) {
        const ecId = entry.params.etapaCategoriaId;
        for (const [nome, titulo] of SECOES) {
          const ativoSec = topoESecao && topo.nome === nome;
          html += `<button class="nav-item nav-secao${ativoSec ? ' ativo' : ''}"
            data-secao="${nome}" data-ec="${ecId}">${escapar(titulo)}</button>`;
        }
      }
    });
    navEl.innerHTML = html;

    navEl.querySelectorAll('[data-voltar]').forEach(b => {
      b.onclick = () => voltarPara(Number(b.dataset.voltar));
    });
    navEl.querySelectorAll('[data-secao]').forEach(b => {
      const rotulo = SECOES.find(s => s[0] === b.dataset.secao)[1];
      b.onclick = () => navegarSecao(b.dataset.secao,
        { etapaCategoriaId: Number(b.dataset.ec) }, rotulo);
    });
  }

  // Escapa texto vindo do usuário antes de injetar via innerHTML.
  function escapar(s) {
    return String(s ?? '').replace(/[&<>"]/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
    }[c]));
  }

  return {
    registrarTela, iniciar, navegar, navegarSecao, voltarPara, recarregar, escapar,
  };
})();
