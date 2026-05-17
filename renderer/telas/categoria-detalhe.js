// Tela hub de uma categoria da etapa: dá acesso às áreas dessa competição
// (duplas, jogos, classificação, chave). params: { etapaCategoriaId }
(() => {
  App.registrarTela('categoria-detalhe', { render });

  async function render(container, params) {
    const { etapaCategoriaId } = params;
    const ec = await window.electronAPI.db.etapaCategoria.obter(etapaCategoriaId);

    container.innerHTML = `
      <div class="topo-tela">
        <h2>Categoria ${App.escapar(ec.categoria_nome)}</h2>
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
      </div>`;

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
  }
})();
