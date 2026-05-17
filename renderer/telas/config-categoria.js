// Tela de configuração de uma categoria da etapa.
// Define as regras usadas no cálculo: fórmula do average, critérios de
// desempate, classificados por grupo e repescagem. Salvas no config_json.
// params: { etapaCategoriaId }
(() => {
  App.registrarTela('config-categoria', { render });

  const CRIT_LABEL = {
    V: 'Nº de vitórias',
    AVG: 'Ponto average',
    H2H: 'Confronto direto',
    SP: 'Saldo de pontos',
    SORTEIO: 'Sorteio',
  };
  const PADRAO = {
    formulaAvg: 'razao',
    criterios: ['V', 'AVG', 'H2H', 'SORTEIO'],
    classPorGrupo: 2,
  };

  let estado = null; // { ecId, ec, cfg }

  async function render(container, params) {
    const { etapaCategoriaId } = params;
    const ec = await window.electronAPI.db.etapaCategoria.obter(etapaCategoriaId);

    let salvo = {};
    if (ec.config_json) {
      try { salvo = JSON.parse(ec.config_json); } catch { salvo = {}; }
    }
    const cfg = {
      formulaAvg: salvo.formulaAvg || PADRAO.formulaAvg,
      criterios: (salvo.criterios && salvo.criterios.length)
        ? salvo.criterios.slice() : PADRAO.criterios.slice(),
      classPorGrupo: salvo.classPorGrupo ?? PADRAO.classPorGrupo,
      repescagem: salvo.repescagem ?? null,
    };
    estado = { ecId: etapaCategoriaId, ec, cfg };

    container.innerHTML = `
      <div class="topo-tela">
        <h2>Configuração — ${App.escapar(ec.categoria_nome)}</h2>
      </div>
      <p class="dica">Regras usadas no cálculo da classificação dos grupos e
        na montagem do mata-mata desta categoria.</p>

      <div class="form-card">
        <h3>Fórmula do average</h3>
        <div class="radio-linha">
          <label><input type="radio" name="avg" value="razao"
            ${cfg.formulaAvg === 'razao' ? 'checked' : ''}>
            Razão (pontos pró ÷ contra)</label>
          <label><input type="radio" name="avg" value="diferenca"
            ${cfg.formulaAvg === 'diferenca' ? 'checked' : ''}>
            Diferença (pró − contra)</label>
        </div>

        <h3>Classificação</h3>
        <div class="form-row">
          <label>Classificados por grupo</label>
          <input type="number" id="c-porgrupo" min="1" max="4"
                 value="${cfg.classPorGrupo}">
        </div>
        <div class="form-row">
          <label>Repescagem</label>
          <input type="number" id="c-repescagem" min="0" max="16"
                 placeholder="automático"
                 value="${cfg.repescagem != null ? cfg.repescagem : ''}">
        </div>
        <p class="dica">Repescagem em branco = o app completa automaticamente
          até a próxima chave válida (4, 8 ou 16 duplas). Ex.: 3 grupos com 2
          classificados (6) recebem 2 melhores terceiros para fechar 8.</p>

        <h3>Critérios de desempate</h3>
        <p class="dica">Aplicados em ordem. O empate em um critério é resolvido
          pelo próximo.</p>
        <ul class="crit-lista" id="crit-lista"></ul>
        <div class="crit-add">
          <select id="crit-novo"></select>
          <button class="btn ghost sm" id="crit-add-btn">Adicionar critério</button>
        </div>
      </div>

      <div class="form-acoes">
        <button class="btn" id="b-salvar">Salvar configuração</button>
      </div>
      <div class="form-erro" id="cfg-erro"></div>
      <div id="cfg-ok"></div>`;

    container.querySelectorAll('input[name="avg"]').forEach(r => {
      r.onchange = () => { estado.cfg.formulaAvg = r.value; };
    });
    renderCriterios();
    container.querySelector('#crit-add-btn').onclick = adicionarCriterio;
    container.querySelector('#b-salvar').onclick = (e) => salvar(e.target);
  }

  function renderCriterios() {
    const ul = document.getElementById('crit-lista');
    ul.innerHTML = estado.cfg.criterios.map((c, i) => `
      <li>
        <span class="crit-ordem">${i + 1}º</span>
        <span class="crit-nome">${App.escapar(CRIT_LABEL[c] || c)}</span>
        <span class="crit-acoes">
          <button class="btn ghost sm" data-mover="${i}" data-dir="-1">↑</button>
          <button class="btn ghost sm" data-mover="${i}" data-dir="1">↓</button>
          <button class="btn danger sm" data-remover="${i}">×</button>
        </span>
      </li>`).join('');

    ul.querySelectorAll('[data-mover]').forEach(b => {
      b.onclick = () => mover(Number(b.dataset.mover), Number(b.dataset.dir));
    });
    ul.querySelectorAll('[data-remover]').forEach(b => {
      b.onclick = () => remover(Number(b.dataset.remover));
    });

    // O select de adicionar mostra só os critérios ainda não usados.
    const disponiveis = Object.keys(CRIT_LABEL)
      .filter(c => !estado.cfg.criterios.includes(c));
    const sel = document.getElementById('crit-novo');
    sel.innerHTML = disponiveis
      .map(c => `<option value="${c}">${CRIT_LABEL[c]}</option>`).join('');
    document.getElementById('crit-add-btn').disabled = disponiveis.length === 0;
  }

  function mover(i, dir) {
    const j = i + dir;
    const cr = estado.cfg.criterios;
    if (j < 0 || j >= cr.length) return;
    [cr[i], cr[j]] = [cr[j], cr[i]];
    renderCriterios();
  }

  function remover(i) {
    if (estado.cfg.criterios.length <= 1) return;
    estado.cfg.criterios.splice(i, 1);
    renderCriterios();
  }

  function adicionarCriterio() {
    const sel = document.getElementById('crit-novo');
    if (sel.value) {
      estado.cfg.criterios.push(sel.value);
      renderCriterios();
    }
  }

  async function salvar(botao) {
    const erro = document.getElementById('cfg-erro');
    const ok = document.getElementById('cfg-ok');
    erro.textContent = '';
    ok.innerHTML = '';

    const porGrupo = Number(document.getElementById('c-porgrupo').value);
    if (!porGrupo || porGrupo < 1) {
      erro.textContent = 'Informe quantas duplas se classificam por grupo.';
      return;
    }
    const repescTxt = document.getElementById('c-repescagem').value.trim();

    const cfg = {
      formulaAvg: estado.cfg.formulaAvg,
      criterios: estado.cfg.criterios,
      classPorGrupo: porGrupo,
    };
    // Repescagem só vai ao config quando informada; em branco fica automática.
    if (repescTxt !== '') cfg.repescagem = Number(repescTxt);

    botao.disabled = true;
    try {
      await window.electronAPI.db.etapaCategoria.atualizar(estado.ecId, {
        numGrupos: estado.ec.num_grupos,
        configJson: JSON.stringify(cfg),
      });
      ok.innerHTML = '<div class="ok">Configuração salva.</div>';
    } catch (err) {
      erro.textContent = 'Erro ao salvar: ' + err.message;
    } finally {
      botao.disabled = false;
    }
  }
})();
