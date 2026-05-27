// Tela hub de uma categoria da etapa: dá acesso às áreas dessa competição
// (duplas, jogos, classificação, chave, ranking) e à publicação.
// params: { etapaCategoriaId }
(() => {
  App.registrarTela('categoria-detalhe', { render });

  const ROTULO_TIPO = { masculino: 'Masculino', feminino: 'Feminino' };

  async function render(container, params) {
    const { etapaCategoriaId } = params;
    const ec = await window.electronAPI.db.etapaCategoria.obter(etapaCategoriaId);
    const etapa = await window.electronAPI.db.etapa.obter(ec.etapa_id);
    // Categorias sem tipo definido (ex.: Misto) só mostram o nome.
    const tipo = ec.tipo ? (ROTULO_TIPO[ec.tipo] || ec.tipo) : '';
    const titulo = tipo
      ? `Categoria ${App.escapar(ec.categoria_nome)} — ${App.escapar(tipo)}`
      : `Categoria ${App.escapar(ec.categoria_nome)}`;

    container.innerHTML = `
      <div class="topo-tela">
        <h2>${titulo}</h2>
      </div>
      <div class="hub">
        <button class="hub-card" data-ir="duplas">
          <div class="hub-titulo">Duplas</div>
          <div class="hub-sub">Cadastrar duplas e atletas</div>
        </button>
        <button class="hub-card" data-ir="jogos">
          <div class="hub-titulo">Jogos</div>
          <div class="hub-sub">Gerar e lançar os jogos da fase de grupos</div>
        </button>
        <button class="hub-card" data-ir="classificacao">
          <div class="hub-titulo">Classificação</div>
          <div class="hub-sub">Classificação dos grupos pelos placares</div>
        </button>
        <button class="hub-card" data-ir="chave">
          <div class="hub-titulo">Chave do mata-mata</div>
          <div class="hub-sub">Gerar a chave e lançar os jogos eliminatórios</div>
        </button>
        <button class="hub-card" data-ir="config-categoria">
          <div class="hub-titulo">Configuração</div>
          <div class="hub-sub">Critérios de desempate, average e classificação</div>
        </button>
        <button class="hub-card" data-ir="ranking">
          <div class="hub-titulo">Ranking</div>
          <div class="hub-sub">Pontos acumulados por atleta na temporada</div>
        </button>
        <button class="hub-card" id="card-publicar">
          <div class="hub-titulo">Publicar resultados</div>
          <div class="hub-sub">Grupos, jogos e mata-mata no GitHub Pages</div>
        </button>
      </div>
      <div id="pub-status"></div>`;

    container.querySelector('[data-ir="duplas"]').onclick =
      () => App.navegarSecao('duplas', { etapaCategoriaId }, 'Duplas');
    container.querySelector('[data-ir="jogos"]').onclick =
      () => App.navegarSecao('jogos', { etapaCategoriaId }, 'Jogos');
    container.querySelector('[data-ir="classificacao"]').onclick =
      () => App.navegarSecao('classificacao', { etapaCategoriaId }, 'Classificação');
    container.querySelector('[data-ir="chave"]').onclick =
      () => App.navegarSecao('chave', { etapaCategoriaId }, 'Mata-mata');
    container.querySelector('[data-ir="config-categoria"]').onclick =
      () => App.navegarSecao('config-categoria', { etapaCategoriaId }, 'Configuração');
    container.querySelector('[data-ir="ranking"]').onclick =
      () => App.navegarSecao('ranking-temporada', {
        temporadaId: etapa.temporada_id,
        categoriaId: ec.categoria_id,
        tipo: ec.tipo,
      }, 'Ranking da temporada');
    container.querySelector('#card-publicar').onclick = (e) =>
      Publicar.publicarCategoria(
        etapaCategoriaId, document.getElementById('pub-status'), e.currentTarget);
  }
})();
