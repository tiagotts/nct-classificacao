// Tela de publicação da página de resultados de uma etapa no GitHub Pages.
// params: { etapaId }
(() => {
  App.registrarTela('publicacao', { render });

  async function render(container, params) {
    const { etapaId } = params;
    const config = (await window.electronAPI.loadConfig()) || {};
    const gh = config.github || {};

    container.innerHTML = `
      <div class="topo-tela"><h2>Publicar resultados</h2></div>
      <p class="dica">Gera a página desta etapa e envia para o GitHub Pages.
        Os jogadores acessam por um link, apenas leitura. O app continua
        funcionando offline — só o momento de publicar usa internet.</p>

      <div class="form-card">
        <h3>Configuração do GitHub</h3>
        <div class="form-row">
          <label>Usuário/org</label>
          <input type="text" id="g-owner" placeholder="seu-usuario"
                 value="${App.escapar(gh.owner || '')}">
        </div>
        <div class="form-row">
          <label>Repositório</label>
          <input type="text" id="g-repo" placeholder="nct-resultados"
                 value="${App.escapar(gh.repo || '')}">
        </div>
        <div class="form-row">
          <label>Branch</label>
          <input type="text" id="g-branch" value="${App.escapar(gh.branch || 'main')}">
        </div>
        <div class="form-row">
          <label>Token</label>
          <input type="password" id="g-token" placeholder="github_pat_..."
                 value="${App.escapar(gh.token || '')}">
        </div>
        <p class="dica">Use um token "fine-grained" com permissão de Conteúdo
          (leitura e escrita) apenas nesse repositório. O token fica salvo
          apenas neste computador. O repositório precisa ter o GitHub Pages
          ativado.</p>
      </div>

      <div class="form-acoes">
        <button class="btn" id="b-publicar">Publicar agora</button>
      </div>
      <div id="pub-status"></div>`;

    container.querySelector('#b-publicar').onclick =
      (e) => publicar(container, etapaId, e.target);
  }

  function lerConfig(container) {
    return {
      owner: container.querySelector('#g-owner').value.trim(),
      repo: container.querySelector('#g-repo').value.trim(),
      branch: container.querySelector('#g-branch').value.trim() || 'main',
      token: container.querySelector('#g-token').value.trim(),
    };
  }

  async function publicar(container, etapaId, botao) {
    const status = container.querySelector('#pub-status');
    const gh = lerConfig(container);
    if (!gh.owner || !gh.repo || !gh.token) {
      status.innerHTML =
        '<div class="erro">Preencha usuário, repositório e token.</div>';
      return;
    }
    // Guarda a configuração para as próximas publicações.
    const config = (await window.electronAPI.loadConfig()) || {};
    config.github = gh;
    await window.electronAPI.saveConfig(config);

    // O módulo Publicar cuida de publicar, acompanhar o build e notificar.
    Publicar.publicarEtapa(etapaId, status, botao);
  }
})();
