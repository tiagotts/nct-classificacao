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
    rankingGeral: 'blocos',
    setsFinal: 1,
  };
  const ROTULO_TIPO = { masculino: 'Masculino', feminino: 'Feminino' };
  const rotuloTipo = (t) => ROTULO_TIPO[t] || t || '';

  let estado = null; // { ecId, ec, cfg }

  async function render(container, params) {
    const { etapaCategoriaId } = params;
    const ec = await window.electronAPI.db.etapaCategoria.obter(etapaCategoriaId);
    const faixasSalvas =
      await window.electronAPI.db.pontuacao.faixas(etapaCategoriaId);

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
      tamanhoChave: salvo.tamanhoChave ?? null,
      rankingGeral: salvo.rankingGeral || PADRAO.rankingGeral,
      setsFinal: salvo.setsFinal === 3 ? 3 : PADRAO.setsFinal,
    };
    estado = {
      ecId: etapaCategoriaId, ec, cfg,
      faixas: faixasSalvas.map(f => ({ ini: f.ini, fim: f.fim, pontos: f.pontos })),
    };

    container.innerHTML = `
      <div class="topo-tela">
        <h2>Configuração — ${App.escapar(ec.categoria_nome)} ${App.escapar(rotuloTipo(ec.tipo))}</h2>
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
          <label>Tamanho do mata-mata</label>
          <select id="c-tamanho-chave">
            <option value=""${cfg.tamanhoChave == null ? ' selected' : ''}>Automático</option>
            <option value="16"${cfg.tamanhoChave === 16 ? ' selected' : ''}>Oitavas (16 duplas)</option>
            <option value="8"${cfg.tamanhoChave === 8 ? ' selected' : ''}>Quartas (8 duplas)</option>
            <option value="6"${cfg.tamanhoChave === 6 ? ' selected' : ''}>Com bye (6 duplas)</option>
            <option value="4"${cfg.tamanhoChave === 4 ? ' selected' : ''}>Semifinais (4 duplas)</option>
          </select>
        </div>
        <div class="form-row">
          <label>Repescagem</label>
          <input type="number" id="c-repescagem" min="0" max="16"
                 placeholder="automático"
                 value="${cfg.repescagem != null ? cfg.repescagem : ''}">
        </div>
        <p class="dica">Tamanho em <em>Automático</em> = o app escolhe a menor
          chave válida (4/8/16) que comporta os diretos. Escolher um tamanho
          fixo força esse formato, completando com melhores terceiros (e quartos)
          até atingir o número — se sobrar dupla direta, dá erro ao gerar.
          O campo Repescagem só é usado quando o tamanho é Automático.</p>

        <h3>Ranqueamento geral</h3>
        <p class="dica">Como os classificados são ordenados para definir
          as posições da chave do mata-mata.</p>
        <div class="radio-linha">
          <label><input type="radio" name="rkg" value="blocos"
            ${cfg.rankingGeral === 'blocos' ? 'checked' : ''}>
            Em blocos (1º colocados sempre à frente dos 2º)</label>
          <label><input type="radio" name="rkg" value="independente"
            ${cfg.rankingGeral === 'independente' ? 'checked' : ''}>
            Independente da posição no grupo</label>
        </div>

        <h3>Final</h3>
        <div class="form-row">
          <label>Sets da final (1º lugar)</label>
          <select id="c-sets-final">
            <option value="1"${cfg.setsFinal === 3 ? '' : ' selected'}>Set único (21 pontos)</option>
            <option value="3"${cfg.setsFinal === 3 ? ' selected' : ''}>Melhor de 3 sets</option>
          </select>
        </div>
        <p class="dica">Na final em melhor de 3, o placar é lançado set a set
          na tela do mata-mata. Só vale para a final de 1º lugar.</p>

        <h3>Critérios de desempate</h3>
        <p class="dica">Aplicados em ordem. O empate em um critério é resolvido
          pelo próximo.</p>
        <ul class="crit-lista" id="crit-lista"></ul>
        <div class="crit-add">
          <select id="crit-novo"></select>
          <button class="btn ghost sm" id="crit-add-btn">Adicionar critério</button>
        </div>
      </div>

      <div class="form-card">
        <h3>Pontuação por colocação</h3>
        <p class="dica">Pontos que cada dupla ganha conforme a colocação final
          da etapa — usados no ranking da temporada. Use intervalos para faixas
          (ex.: da 5ª à 8ª colocação). A última faixa pode ir até 9999 para
          cobrir todas as colocações seguintes.</p>
        <table class="grid-duplas">
          <thead><tr>
            <th>Da colocação</th><th>Até a colocação</th>
            <th>Pontos</th><th class="idx"></th>
          </tr></thead>
          <tbody id="faixas-corpo"></tbody>
        </table>
        <button class="btn ghost sm" id="faixa-add-btn">Adicionar faixa</button>
      </div>

      <div class="form-acoes">
        <button class="btn" id="b-salvar">Salvar configuração</button>
      </div>
      <div class="form-erro" id="cfg-erro"></div>
      <div id="cfg-ok"></div>`;

    container.querySelectorAll('input[name="avg"]').forEach(r => {
      r.onchange = () => { estado.cfg.formulaAvg = r.value; };
    });
    container.querySelectorAll('input[name="rkg"]').forEach(r => {
      r.onchange = () => { estado.cfg.rankingGeral = r.value; };
    });
    renderCriterios();
    renderFaixas();
    container.querySelector('#crit-add-btn').onclick = adicionarCriterio;
    container.querySelector('#faixa-add-btn').onclick = adicionarFaixa;
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

  // --- pontuação por colocação ----------------------------------------

  function renderFaixas() {
    const corpo = document.getElementById('faixas-corpo');
    corpo.innerHTML = estado.faixas.map((f, i) => `
      <tr data-i="${i}">
        <td><input type="number" class="f-ini" min="1" value="${f.ini}"></td>
        <td><input type="number" class="f-fim" min="1" value="${f.fim}"></td>
        <td><input type="number" class="f-pontos" min="0" value="${f.pontos}"></td>
        <td class="idx">
          <button class="btn danger sm" data-rem-faixa="${i}">×</button></td>
      </tr>`).join('');
    corpo.querySelectorAll('[data-rem-faixa]').forEach(b => {
      b.onclick = () => removerFaixa(Number(b.dataset.remFaixa));
    });
  }

  // Captura o que está digitado no grid de faixas de volta para o estado.
  function lerFaixas() {
    const linhas = [];
    document.querySelectorAll('#faixas-corpo tr').forEach(tr => {
      linhas.push({
        ini: Number(tr.querySelector('.f-ini').value),
        fim: Number(tr.querySelector('.f-fim').value),
        pontos: Number(tr.querySelector('.f-pontos').value),
      });
    });
    estado.faixas = linhas;
  }

  function adicionarFaixa() {
    lerFaixas();
    const ultima = estado.faixas[estado.faixas.length - 1];
    const ini = ultima ? ultima.fim + 1 : 1;
    estado.faixas.push({ ini, fim: ini, pontos: 0 });
    renderFaixas();
  }

  function removerFaixa(i) {
    lerFaixas();
    estado.faixas.splice(i, 1);
    renderFaixas();
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

    // Faixas de pontuação.
    lerFaixas();
    for (const f of estado.faixas) {
      if (!f.ini || !f.fim || Number.isNaN(f.pontos)
          || f.ini < 1 || f.fim < f.ini || f.pontos < 0) {
        erro.textContent = 'Pontuação: confira as faixas '
          + '(colocação inicial ≤ final, pontos ≥ 0).';
        return;
      }
    }

    const tamTxt = document.getElementById('c-tamanho-chave').value;
    const cfg = {
      formulaAvg: estado.cfg.formulaAvg,
      criterios: estado.cfg.criterios,
      classPorGrupo: porGrupo,
      rankingGeral: estado.cfg.rankingGeral,
      setsFinal: Number(document.getElementById('c-sets-final').value) === 3
        ? 3 : 1,
    };
    // Repescagem só vai ao config quando informada; em branco fica automática.
    if (repescTxt !== '') cfg.repescagem = Number(repescTxt);
    // Tamanho fixo do mata-mata; vazio = automático.
    if (tamTxt !== '') cfg.tamanhoChave = Number(tamTxt);

    botao.disabled = true;
    try {
      await window.electronAPI.db.etapaCategoria.atualizar(estado.ecId, {
        numGrupos: estado.ec.num_grupos,
        configJson: JSON.stringify(cfg),
      });
      await window.electronAPI.db.pontuacao.salvar(estado.ecId, estado.faixas);
      ok.innerHTML = '<div class="ok">Configuração salva.</div>';
    } catch (err) {
      erro.textContent = 'Erro ao salvar: ' + err.message;
    } finally {
      botao.disabled = false;
    }
  }
})();
