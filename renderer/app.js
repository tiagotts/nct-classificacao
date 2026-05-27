// =============================================================================
// Núcleo do app: roteador, estado de navegação e árvore lateral.
//
// As telas se registram via App.registrarTela(nome, { render }). render recebe
// (container, params) e desenha dentro do #conteudo.
//
// O menu lateral é uma árvore navegável: Temporadas > Etapas > Categorias >
// seções (Duplas, Jogos, Classificação, Mata-mata, Configuração). Cada nó
// com filhos pode ser recolhido/expandido pelo triângulo; clicar no rótulo
// navega para a tela daquele nó. A pilha de navegação guarda a tela atual.
// =============================================================================

const App = (() => {
  const telas = {};
  let pilha = [];               // [{ nome, params, titulo }]
  let conteudo, navEl;

  // Nós da árvore expandidos, por chave. A raiz começa aberta.
  const expandidos = new Set(['raiz']);
  // Mapa chave-do-nó -> pilha de navegação; refeito a cada render da árvore.
  let mapaNav = {};

  // Seções de uma categoria: [nomeDaTela, rótulo].
  const SECOES = [
    ['duplas', 'Duplas'],
    ['jogos', 'Jogos'],
    ['classificacao', 'Classificação'],
    ['chave', 'Mata-mata'],
    ['config-categoria', 'Configuração'],
  ];
  const NOMES_SECAO = SECOES.map(s => s[0]);
  const ROTULO_TIPO = { masculino: 'Masculino', feminino: 'Feminino' };

  function registrarTela(nome, def) {
    telas[nome] = def;
  }

  async function iniciar() {
    conteudo = document.getElementById('conteudo');
    navEl = document.getElementById('nav');
    await navegar('temporadas', {}, 'Temporadas');
  }

  function ent(nome, params, titulo) {
    return { nome, params: params || {}, titulo: titulo || nome };
  }

  // Empilha uma tela nova (drill-down) e desenha.
  async function navegar(nome, params = {}, titulo = '') {
    pilha.push(ent(nome, params, titulo));
    await desenhar();
  }

  // Navega para uma seção da categoria. Se a tela atual já é uma seção,
  // troca no lugar (não empilha) — alternar seções não cria níveis novos.
  async function navegarSecao(nome, params = {}, titulo = '') {
    const entrada = ent(nome, params, titulo);
    const topo = pilha[pilha.length - 1];
    if (NOMES_SECAO.includes(topo.nome)) {
      pilha[pilha.length - 1] = entrada;
    } else {
      pilha.push(entrada);
    }
    await desenhar();
  }

  // Volta para um nível anterior da pilha.
  async function voltarPara(indice) {
    pilha = pilha.slice(0, indice + 1);
    await desenhar();
  }

  // Redesenha a tela atual (após criar/editar/remover).
  async function recarregar() {
    await desenhar();
  }

  async function desenhar() {
    expandirCaminho();
    await renderMenu();
    await aplicarTemaTemporada();
    conteudo.innerHTML = '<div class="carregando">Carregando…</div>';
    const atual = pilha[pilha.length - 1];
    try {
      await telas[atual.nome].render(conteudo, atual.params);
    } catch (err) {
      conteudo.innerHTML =
        `<div class="erro">Erro ao carregar a tela: ${escapar(err.message)}</div>`;
    }
  }

  // Tema (logo + cores) segue a temporada atualmente aberta. Quando não há
  // temporada selecionada (ou ela não tem logo escolhido), usa o ícone
  // padrão do BeachPlay (../imagens/beachplay-icone.svg). Caso contrário
  // usa o arquivo escolhido na criação da temporada e sobrescreve as CSS
  // vars do :root com a paleta derivada.
  const LOGO_PADRAO_URL = '../imagens/beachplay-icone.svg';
  let temaAtual = { logo: null, cor1: null, cor2: null };
  async function aplicarTemaTemporada() {
    const sel = selecaoAtual();
    let temporada = null;
    if (sel.temporadaId != null) {
      try {
        temporada = await window.electronAPI.db.temporada.obter(sel.temporadaId);
      } catch { /* mantém o padrão */ }
    }
    const arquivo = (temporada && temporada.logo) || null;
    const cor1 = (temporada && temporada.cor_primaria) || null;
    const cor2 = (temporada && temporada.cor_secundaria) || null;

    if (arquivo !== temaAtual.logo) {
      const img = document.querySelector('.marca-logo');
      if (img) {
        img.src = arquivo
          ? `../imagens/logos/${encodeURIComponent(arquivo)}`
          : LOGO_PADRAO_URL;
      }
      temaAtual.logo = arquivo;
    }
    if (cor1 !== temaAtual.cor1 || cor2 !== temaAtual.cor2) {
      aplicarPaleta(cor1, cor2);
      temaAtual.cor1 = cor1;
      temaAtual.cor2 = cor2;
    }
  }

  // Sobrescreve as CSS vars de cor no :root. Quando cor1/cor2 são null,
  // remove os overrides e o app volta para a paleta declarada em estilos.css.
  function aplicarPaleta(cor1, cor2) {
    const root = document.documentElement.style;
    const VARS = [
      '--ocean', '--ocean-dark', '--ocean-light', '--ocean-tint',
      '--sun', '--sun-dark',
    ];
    if (!cor1 && !cor2) {
      VARS.forEach(v => root.removeProperty(v));
      return;
    }
    const p = window.NctCores.paletaTemporada(cor1, cor2);
    root.setProperty('--ocean', p.ocean);
    root.setProperty('--ocean-dark', p.oceanDark);
    root.setProperty('--ocean-light', p.oceanLight);
    root.setProperty('--ocean-tint', p.oceanTint);
    root.setProperty('--sun', p.sun);
    root.setProperty('--sun-dark', p.sunDark);
  }

  // Garante que os nós ancestrais da tela atual estejam expandidos, para a
  // árvore sempre mostrar onde o usuário está.
  function expandirCaminho() {
    for (const e of pilha) {
      const p = e.params || {};
      if (p.temporadaId != null) expandidos.add(`temp:${p.temporadaId}`);
      if (p.etapaId != null) expandidos.add(`etapa:${p.etapaId}`);
      if (p.etapaCategoriaId != null) expandidos.add(`ec:${p.etapaCategoriaId}`);
    }
  }

  // O que está selecionado agora, para destacar o nó certo na árvore.
  function selecaoAtual() {
    const sel = { tela: pilha[pilha.length - 1].nome };
    for (const e of pilha) {
      const p = e.params || {};
      if (p.temporadaId != null) sel.temporadaId = p.temporadaId;
      if (p.etapaId != null) sel.etapaId = p.etapaId;
      if (p.etapaCategoriaId != null) sel.ecId = p.etapaCategoriaId;
    }
    return sel;
  }

  function toggle(chave) {
    if (expandidos.has(chave)) expandidos.delete(chave);
    else expandidos.add(chave);
  }

  // HTML de uma linha da árvore. temFilhos define se há triângulo.
  function linhaArvore({ nivel, chave, rotulo, temFilhos, aberto, ativo }) {
    const tri = temFilhos
      ? `<button class="arv-tri" data-toggle="${escapar(chave)}"
           title="${aberto ? 'Recolher' : 'Expandir'}">${aberto ? '▾' : '▸'}</button>`
      : '<span class="arv-tri vazia"></span>';
    return `<div class="arv-linha nivel-${nivel}${ativo ? ' ativo' : ''}">
      ${tri}
      <button class="arv-rotulo" data-nav="${escapar(chave)}"
        title="${escapar(rotulo)}">${escapar(rotulo)}</button>
    </div>`;
  }

  // Desenha a árvore lateral, carregando do banco só os ramos expandidos.
  async function renderMenu() {
    const api = window.electronAPI.db;
    const sel = selecaoAtual();
    mapaNav = { raiz: [ent('temporadas', {}, 'Temporadas')] };
    const linhas = [];

    const raizAberta = expandidos.has('raiz');
    linhas.push(linhaArvore({
      nivel: 0, chave: 'raiz', rotulo: 'Temporadas', temFilhos: true,
      aberto: raizAberta, ativo: sel.tela === 'temporadas',
    }));

    if (raizAberta) {
      const temporadas = await api.temporada.listar();
      for (const t of temporadas) {
        const ckt = `temp:${t.id}`;
        const abertoT = expandidos.has(ckt);
        mapaNav[ckt] = [...mapaNav.raiz,
          ent('etapas', { temporadaId: t.id }, t.nome)];
        linhas.push(linhaArvore({
          nivel: 1, chave: ckt, rotulo: t.nome, temFilhos: true,
          aberto: abertoT,
          ativo: sel.tela === 'etapas' && sel.temporadaId === t.id,
        }));
        if (!abertoT) continue;

        const etapas = await api.etapa.listar(t.id);
        for (const e of etapas) {
          const cke = `etapa:${e.id}`;
          const abertoE = expandidos.has(cke);
          mapaNav[cke] = [...mapaNav[ckt],
            ent('etapa-categorias', { etapaId: e.id }, e.nome)];
          linhas.push(linhaArvore({
            nivel: 2, chave: cke, rotulo: e.nome, temFilhos: true,
            aberto: abertoE,
            ativo: sel.tela === 'etapa-categorias' && sel.etapaId === e.id,
          }));
          if (!abertoE) continue;

          const ecs = await api.etapaCategoria.listar(e.id);
          for (const c of ecs) {
            const ckc = `ec:${c.id}`;
            const abertoC = expandidos.has(ckc);
            const rotC =
              `${c.categoria_nome} ${ROTULO_TIPO[c.tipo] || ''}`.trim();
            mapaNav[ckc] = [...mapaNav[cke],
              ent('categoria-detalhe', { etapaCategoriaId: c.id }, rotC)];
            linhas.push(linhaArvore({
              nivel: 3, chave: ckc, rotulo: rotC, temFilhos: true,
              aberto: abertoC,
              ativo: sel.tela === 'categoria-detalhe' && sel.ecId === c.id,
            }));
            if (!abertoC) continue;

            for (const [snome, stitulo] of SECOES) {
              const cks = `sec:${c.id}:${snome}`;
              mapaNav[cks] = [...mapaNav[ckc],
                ent(snome, { etapaCategoriaId: c.id }, stitulo)];
              linhas.push(linhaArvore({
                nivel: 4, chave: cks, rotulo: stitulo, temFilhos: false,
                aberto: false, ativo: sel.tela === snome && sel.ecId === c.id,
              }));
            }
          }
        }
      }
    }

    navEl.innerHTML = linhas.join('');

    navEl.querySelectorAll('[data-toggle]').forEach(b => {
      b.onclick = async () => { toggle(b.dataset.toggle); await renderMenu(); };
    });
    navEl.querySelectorAll('[data-nav]').forEach(b => {
      b.onclick = async () => {
        const destino = mapaNav[b.dataset.nav];
        if (!destino) return;
        pilha = destino.map(x => ent(x.nome, x.params, x.titulo));
        await desenhar();
      };
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
