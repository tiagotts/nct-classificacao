// Tela de configuração da publicação (GitHub Pages) e do backup do banco.
// A publicação acontece por categoria (tela de cada categoria). Aqui só se
// cadastra a conta do GitHub e o repositório de backup, e se aciona
// "Fazer backup" / "Restaurar".
(() => {
  App.registrarTela('publicacao', { render });

  async function render(container) {
    const config = (await window.electronAPI.loadConfig()) || {};
    const gh = config.github || {};
    const bk = config.backup || {};

    container.innerHTML = `
      <div class="topo-tela"><h2>Configurar publicação e backup</h2></div>
      <p class="dica">A publicação dos resultados (HTML público) é feita na
        tela de cada categoria. O backup do banco (.db) usa um repositório
        separado — recomendado privado.</p>

      <div class="form-card">
        <h3>GitHub — publicação</h3>
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
        <p class="dica">Token "fine-grained" com Conteúdo (leitura e escrita)
          neste e no repo de backup. Fica salvo só neste computador.</p>
      </div>

      <div class="form-card">
        <h3>GitHub — backup do banco</h3>
        <div class="form-row">
          <label>Usuário/org</label>
          <input type="text" id="b-owner" placeholder="seu-usuario"
                 value="${App.escapar(bk.owner || '')}">
        </div>
        <div class="form-row">
          <label>Repositório (privado)</label>
          <input type="text" id="b-repo" placeholder="nct-backup"
                 value="${App.escapar(bk.repo || '')}">
        </div>
        <div class="form-row">
          <label>Branch</label>
          <input type="text" id="b-branch" value="${App.escapar(bk.branch || 'main')}">
        </div>
        <p class="dica">Cada backup vira um commit sobre o arquivo
          <code>nct.db</code> no repo — o histórico do git é o histórico de
          versões. Usa o mesmo token da publicação.</p>
      </div>

      <div class="form-acoes">
        <button class="btn" id="b-salvar">Salvar configuração</button>
        <button class="btn ghost" id="b-backup">Fazer backup agora</button>
        <button class="btn ghost" id="b-restaurar">Restaurar backup…</button>
      </div>
      <div class="form-erro" id="cfg-erro"></div>
      <div id="cfg-ok"></div>
      <div id="backup-lista"></div>`;

    container.querySelector('#b-salvar').onclick =
      (e) => salvar(container, e.target);
    container.querySelector('#b-backup').onclick =
      (e) => fazerBackup(container, e.target);
    container.querySelector('#b-restaurar').onclick =
      () => listarBackups(container);
  }

  function lerConfigPub(container) {
    return {
      owner: container.querySelector('#g-owner').value.trim(),
      repo: container.querySelector('#g-repo').value.trim(),
      branch: container.querySelector('#g-branch').value.trim() || 'main',
      token: container.querySelector('#g-token').value.trim(),
    };
  }

  function lerConfigBackup(container) {
    return {
      owner: container.querySelector('#b-owner').value.trim(),
      repo: container.querySelector('#b-repo').value.trim(),
      branch: container.querySelector('#b-branch').value.trim() || 'main',
    };
  }

  async function salvar(container, botao) {
    const erro = container.querySelector('#cfg-erro');
    const ok = container.querySelector('#cfg-ok');
    erro.textContent = '';
    ok.innerHTML = '';
    const gh = lerConfigPub(container);
    if (!gh.owner || !gh.repo || !gh.token) {
      erro.textContent = 'Preencha usuário, repositório e token da publicação.';
      return;
    }
    const bk = lerConfigBackup(container);
    botao.disabled = true;
    try {
      const config = (await window.electronAPI.loadConfig()) || {};
      config.github = gh;
      // Backup é opcional — só salva se tiver owner e repo.
      if (bk.owner && bk.repo) config.backup = bk;
      else delete config.backup;
      await window.electronAPI.saveConfig(config);
      ok.innerHTML = '<div class="ok">Configuração salva.</div>';
    } catch (err) {
      erro.textContent = 'Erro ao salvar: ' + err.message;
    } finally {
      botao.disabled = false;
    }
  }

  // Junta o token da publicação com o repo do backup.
  function cfgBackupCompleto(container) {
    const gh = lerConfigPub(container);
    const bk = lerConfigBackup(container);
    if (!gh.token) {
      throw new Error('Preencha o token na seção de publicação.');
    }
    if (!bk.owner || !bk.repo) {
      throw new Error('Preencha usuário e repositório do backup.');
    }
    return { ...bk, token: gh.token };
  }

  async function fazerBackup(container, botao) {
    const erro = container.querySelector('#cfg-erro');
    const ok = container.querySelector('#cfg-ok');
    erro.textContent = '';
    ok.innerHTML = '';
    let cfg;
    try { cfg = cfgBackupCompleto(container); }
    catch (err) { erro.textContent = err.message; return; }
    botao.disabled = true;
    try {
      const res = await window.electronAPI.backup.fazer(cfg);
      const quando = new Date(res.data || Date.now()).toLocaleString('pt-BR');
      ok.innerHTML = `<div class="ok">Backup feito em ${App.escapar(quando)}.${
        res.url ? ` <a href="${App.escapar(res.url)}" target="_blank">Ver commit</a>` : ''
      }</div>`;
    } catch (err) {
      erro.textContent = 'Erro no backup: ' + err.message;
    } finally {
      botao.disabled = false;
    }
  }

  async function listarBackups(container) {
    const erro = container.querySelector('#cfg-erro');
    const ok = container.querySelector('#cfg-ok');
    const lista = container.querySelector('#backup-lista');
    erro.textContent = '';
    ok.innerHTML = '';
    let cfg;
    try { cfg = cfgBackupCompleto(container); }
    catch (err) { erro.textContent = err.message; return; }
    lista.innerHTML = '<div class="carregando">Carregando…</div>';
    try {
      const backups = await window.electronAPI.backup.listar(cfg);
      if (!backups.length) {
        lista.innerHTML = '<div class="vazio">Nenhum backup encontrado no repositório.</div>';
        return;
      }
      lista.innerHTML = `
        <div class="form-card">
          <h3>Restaurar de um backup</h3>
          <p class="dica">A restauração substitui o banco atual. Faça um
            backup antes se quiser preservar o estado de agora.</p>
          <ul class="crit-lista">
            ${backups.map(itemHtml).join('')}
          </ul>
        </div>`;
      lista.querySelectorAll('[data-restaurar]').forEach(b => {
        b.onclick = () => restaurarBackup(cfg, b.dataset.restaurar);
      });
    } catch (err) {
      lista.innerHTML = '';
      erro.textContent = 'Erro ao listar: ' + err.message;
    }
  }

  function itemHtml(b) {
    const quando = b.data ? new Date(b.data).toLocaleString('pt-BR') : '—';
    const sha = (b.sha || '').slice(0, 7);
    return `
      <li>
        <span class="crit-nome">${App.escapar(quando)}</span>
        <span class="motivo">${App.escapar(b.mensagem || '')} · ${sha}</span>
        <span class="crit-acoes">
          <button class="btn ghost sm" data-restaurar="${App.escapar(b.sha)}">
            Restaurar</button>
        </span>
      </li>`;
  }

  async function restaurarBackup(cfg, sha) {
    if (!confirm('Isto vai SUBSTITUIR o banco atual pelo backup selecionado. '
      + 'Continuar?')) return;
    try {
      await window.electronAPI.backup.restaurar(cfg, sha);
      alert('Backup restaurado. O app vai recarregar.');
      await App.recarregar();
    } catch (err) {
      alert('Erro ao restaurar: ' + err.message);
    }
  }
})();
