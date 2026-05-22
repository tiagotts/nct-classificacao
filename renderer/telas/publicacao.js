// Tela de configuração da publicação no GitHub Pages.
// A publicação em si é feita por categoria, na tela de cada categoria.
// Aqui só se cadastra/guarda a conta do GitHub usada nas publicações.
(() => {
  App.registrarTela('publicacao', { render });

  async function render(container) {
    const config = (await window.electronAPI.loadConfig()) || {};
    const gh = config.github || {};

    container.innerHTML = `
      <div class="topo-tela"><h2>Configurar publicação</h2></div>
      <p class="dica">Conta do GitHub usada para publicar as páginas de
        resultados. A publicação é feita por categoria, na tela de cada
        categoria. O app funciona offline — só o momento de publicar usa
        internet.</p>

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
        <button class="btn" id="b-salvar">Salvar configuração</button>
      </div>
      <div class="form-erro" id="cfg-erro"></div>
      <div id="cfg-ok"></div>`;

    container.querySelector('#b-salvar').onclick =
      (e) => salvar(container, e.target);
  }

  function lerConfig(container) {
    return {
      owner: container.querySelector('#g-owner').value.trim(),
      repo: container.querySelector('#g-repo').value.trim(),
      branch: container.querySelector('#g-branch').value.trim() || 'main',
      token: container.querySelector('#g-token').value.trim(),
    };
  }

  async function salvar(container, botao) {
    const erro = container.querySelector('#cfg-erro');
    const ok = container.querySelector('#cfg-ok');
    erro.textContent = '';
    ok.innerHTML = '';
    const gh = lerConfig(container);
    if (!gh.owner || !gh.repo || !gh.token) {
      erro.textContent = 'Preencha usuário, repositório e token.';
      return;
    }
    botao.disabled = true;
    try {
      const config = (await window.electronAPI.loadConfig()) || {};
      config.github = gh;
      await window.electronAPI.saveConfig(config);
      ok.innerHTML = '<div class="ok">Configuração salva.</div>';
    } catch (err) {
      erro.textContent = 'Erro ao salvar: ' + err.message;
    } finally {
      botao.disabled = false;
    }
  }
})();
