// Tela da chave do mata-mata de uma categoria.
// Gera a chave (eliminação simples + 3º lugar) a partir do ranking geral e
// permite lançar os placares. Ao salvar, o vencedor/perdedor é propagado
// para os jogos seguintes.
// params: { etapaCategoriaId }
(() => {
  const apiJogo = () => window.electronAPI.db.jogo;
  const apiDupla = () => window.electronAPI.db.dupla;
  const apiEC = () => window.electronAPI.db.etapaCategoria;

  App.registrarTela('chave', { render });

  const ORDEM_FASE = ['oitavas', 'quartas', 'semi', 'final', 'terceiro'];
  const ROTULO_FASE = {
    oitavas: 'Oitavas de final', quartas: 'Quartas de final',
    semi: 'Semifinais', final: 'Final (1º lugar)',
    terceiro: 'Disputa de 3º lugar',
  };
  const ROTULO_CURTO = {
    oitavas: 'Oitavas', quartas: 'Quartas', semi: 'Semi',
    final: 'Final', terceiro: '3º lugar',
  };

  let estado = null;

  async function render(container, params) {
    const { etapaCategoriaId } = params;
    const duplas = await apiDupla().listar(etapaCategoriaId);
    const ec = await apiEC().obter(etapaCategoriaId);
    const jogos = (await apiJogo().listar(etapaCategoriaId))
      .filter(j => j.fase !== 'grupo')
      .sort((a, b) => a.num - b.num);

    // Nº de sets da final (1º lugar): 1 ou melhor de 3, vindo da configuração.
    let setsFinal = 1;
    if (ec && ec.config_json) {
      try {
        setsFinal = JSON.parse(ec.config_json).setsFinal === 3 ? 3 : 1;
      } catch (e) { setsFinal = 1; }
    }

    if (jogos.length === 0) {
      container.innerHTML = `
        <div class="topo-tela"><h2>Chave do mata-mata</h2></div>
        <p class="dica">A chave é montada a partir do ranking geral dos
          classificados. Lance os placares da fase de grupos antes de gerar.</p>
        <div class="form-acoes">
          <button class="btn" id="btn-gerar">Gerar chave do mata-mata</button>
        </div>
        <div class="form-erro" id="chave-erro"></div>`;
      container.querySelector('#btn-gerar').onclick = () => gerar(etapaCategoriaId);
      return;
    }

    const duplaMap = {};
    duplas.forEach(d => { duplaMap[d.id] = d; });

    // Rótulo de cada jogo (usado pelos ponteiros de origem).
    const labelMap = {};
    const contagem = {};
    for (const j of jogos) {
      contagem[j.fase] = (contagem[j.fase] || 0) + 1;
      const unico = j.fase === 'final' || j.fase === 'terceiro';
      labelMap[j.id] = unico
        ? ROTULO_CURTO[j.fase]
        : `${ROTULO_CURTO[j.fase]} ${contagem[j.fase]}`;
    }

    estado = { etapaCategoriaId, jogos, duplaMap, labelMap, setsFinal };

    container.innerHTML = `
      <div class="topo-tela">
        <h2>Chave do mata-mata</h2>
        <button class="btn ghost sm" id="btn-regerar">Regerar chave</button>
      </div>
      ${podioHtml(duplas)}
      <div id="blocos"></div>
      <div class="form-erro" id="chave-erro"></div>
      <div class="form-acoes">
        <button class="btn" id="btn-salvar">Salvar resultados</button>
      </div>`;

    desenhar();
    container.querySelector('#btn-salvar').onclick = (e) => salvar(e.target);
    container.querySelector('#btn-regerar').onclick = regerar;
  }

  function desenhar() {
    const porFase = {};
    estado.jogos.forEach(j => { (porFase[j.fase] = porFase[j.fase] || []).push(j); });
    document.getElementById('blocos').innerHTML = ORDEM_FASE
      .filter(f => porFase[f])
      .map(f => `
        <div class="bloco-grupo">
          <h3>${ROTULO_FASE[f]}</h3>
          <table class="tab-jogos">
            <thead><tr>
              <th class="col-jogo">Jogo</th>
              <th>Dupla 1</th>
              <th class="col-placar">Placar</th>
              <th class="col-placar">Placar</th>
              <th>Dupla 2</th>
              <th class="col-tipo">Resultado</th>
            </tr></thead>
            <tbody>${porFase[f].map(linhaHtml).join('')}</tbody>
          </table>
        </div>`).join('');
    document.querySelectorAll('#blocos .tipo').forEach(sel => {
      sel.onchange = () => aoMudarTipo(sel);
    });
  }

  // Variantes de resultado (mesma lógica da tela de jogos da fase de grupos).
  function variante(j) {
    const t = j.tipo_resultado || 'normal';
    if (t !== 'wx0') return t;
    const p1 = Number(j.placar1) || 0;
    const p2 = Number(j.placar2) || 0;
    if (p1 > p2) return 'wx0-d1';
    if (p2 > p1) return 'wx0-d2';
    return 'wx0-duplo';
  }
  function ehVarianteWO(v) {
    return v === 'wx0-d1' || v === 'wx0-d2' || v === 'wx0-duplo';
  }
  function placaresDaVariante(v) {
    if (v === 'wx0-d1') return { p1: 1, p2: 0 };
    if (v === 'wx0-d2') return { p1: 0, p2: 1 };
    if (v === 'wx0-duplo') return { p1: 0, p2: 0 };
    return null;
  }
  function aoMudarTipo(sel) {
    const tr = sel.closest('tr');
    const v = sel.value;
    const p1 = tr.querySelector('.p1');
    const p2 = tr.querySelector('.p2');
    if (!p1 || !p2) return; // final em multi-set não tem .p1/.p2
    const placares = placaresDaVariante(v);
    if (placares) {
      p1.value = placares.p1; p2.value = placares.p2;
      p1.disabled = true; p2.disabled = true;
    } else if (!tr.hasAttribute('data-pendente')) {
      p1.disabled = false; p2.disabled = false;
    }
  }

  // Exibe um lado do jogo: a dupla, ou o ponteiro de origem ("Vencedor de...").
  function ladoHtml(duplaId, origemId, origemTipo) {
    if (duplaId && estado.duplaMap[duplaId]) {
      const d = estado.duplaMap[duplaId];
      return `<span class="cod">${App.escapar(d.codigo)}</span>`
        + App.escapar(`${d.atleta1_nome} / ${d.atleta2_nome}`);
    }
    if (origemId && estado.labelMap[origemId]) {
      const t = origemTipo === 'perdedor' ? 'Perdedor' : 'Vencedor';
      return `<span class="tbd">${t} de ${App.escapar(estado.labelMap[origemId])}</span>`;
    }
    return '<span class="tbd">A definir</span>';
  }

  function linhaHtml(j) {
    const definido = j.dupla1_id && j.dupla2_id;
    const pendente = definido ? '' : ' data-pendente="1"';
    const dis = definido ? '' : ' disabled';
    // Final em melhor de 3: placar lançado set a set.
    if (j.fase === 'final' && estado.setsFinal === 3) {
      return linhaFinalSets(j, dis);
    }
    const v = variante(j);
    const op = (val, txt) =>
      `<option value="${val}"${v === val ? ' selected' : ''}>${txt}</option>`;
    const disPlacar = !definido || ehVarianteWO(v) ? ' disabled' : '';
    return `
      <tr data-id="${j.id}"${pendente}>
        <td class="col-jogo">${App.escapar(estado.labelMap[j.id])}</td>
        <td>${ladoHtml(j.dupla1_id, j.origem1_jogo_id, j.origem1_tipo)}</td>
        <td class="col-placar"><input type="number" min="0" class="p1"${disPlacar}
            value="${j.placar1 != null ? j.placar1 : ''}"></td>
        <td class="col-placar"><input type="number" min="0" class="p2"${disPlacar}
            value="${j.placar2 != null ? j.placar2 : ''}"></td>
        <td>${ladoHtml(j.dupla2_id, j.origem2_jogo_id, j.origem2_tipo)}</td>
        <td class="col-tipo"><select class="tipo"${dis}>
          ${op('normal', 'Normal')}
          ${op('wx0-d1', 'W×0: Dupla 1 venceu')}
          ${op('wx0-d2', 'W×0: Dupla 2 venceu')}
          ${op('wx0-duplo', 'Duplo W×0')}
          ${op('desistencia', 'Desistência')}
        </select></td>
      </tr>`;
  }

  // Linha da final em melhor de 3: três pares de inputs (um por set). Os
  // sets ficam empilhados na célula de placar; sets em branco são ignorados.
  function linhaFinalSets(j, dis) {
    let sets = [];
    if (j.sets) { try { sets = JSON.parse(j.sets); } catch (e) { sets = []; } }
    const val = (k, lado) => {
      const s = sets[k - 1];
      return s && s[lado] != null ? s[lado] : '';
    };
    const inputs = (lado, cls) => [1, 2, 3].map(k =>
      `<input type="number" min="0" class="${cls}" data-set="${k}"${dis}
         placeholder="Set ${k}" value="${val(k, lado)}">`).join('');
    const resumo = (j.placar1 != null && j.placar2 != null)
      ? `${j.placar1} × ${j.placar2}` : 'melhor de 3';
    return `
      <tr data-id="${j.id}" data-multiset="1">
        <td class="col-jogo">${App.escapar(estado.labelMap[j.id])}</td>
        <td>${ladoHtml(j.dupla1_id, j.origem1_jogo_id, j.origem1_tipo)}</td>
        <td class="col-placar col-sets">${inputs(0, 'ms-p1')}</td>
        <td class="col-placar col-sets">${inputs(1, 'ms-p2')}</td>
        <td>${ladoHtml(j.dupla2_id, j.origem2_jogo_id, j.origem2_tipo)}</td>
        <td class="col-tipo">${resumo}</td>
      </tr>`;
  }

  function podioHtml(duplas) {
    const porColoc = {};
    duplas.forEach(d => { if (d.colocacao_final) porColoc[d.colocacao_final] = d; });
    const linha = (pos, rotulo) => {
      const d = porColoc[pos];
      if (!d) return '';
      return `<div class="podio-item">
        <span class="podio-pos">${rotulo}</span>
        <span class="cod">${App.escapar(d.codigo)}</span>${App.escapar(
          `${d.atleta1_nome} / ${d.atleta2_nome}`)}</div>`;
    };
    const itens = linha(1, 'Campeão') + linha(2, 'Vice')
      + linha(3, '3º lugar') + linha(4, '4º lugar');
    return itens ? `<div class="podio"><h3>Resultado final</h3>${itens}</div>` : '';
  }

  async function salvar(botao) {
    botao.disabled = true;
    const erroEl = document.getElementById('chave-erro');
    erroEl.textContent = '';
    try {
      for (const tr of document.querySelectorAll('#blocos tbody tr')) {
        const id = Number(tr.dataset.id);

        // Final em melhor de 3: monta o array de sets preenchidos.
        if (tr.dataset.multiset) {
          const primeiro = tr.querySelector('.ms-p1');
          if (!primeiro || primeiro.disabled) continue;
          const sets = [];
          for (let k = 1; k <= 3; k++) {
            const v1 = tr.querySelector(`.ms-p1[data-set="${k}"]`).value;
            const v2 = tr.querySelector(`.ms-p2[data-set="${k}"]`).value;
            if (v1 !== '' && v2 !== '') sets.push([Number(v1), Number(v2)]);
          }
          await apiJogo().registrarPlacar(id,
            sets.length ? { sets } : { placar1: null, placar2: null });
          continue;
        }

        if (tr.hasAttribute('data-pendente')) continue; // sem as duas duplas
        const p1 = tr.querySelector('.p1').value;
        const p2 = tr.querySelector('.p2').value;
        const v = tr.querySelector('.tipo').value;
        const tipo = ehVarianteWO(v) ? 'wx0' : v;
        await apiJogo().registrarPlacar(id, {
          placar1: p1 === '' ? null : Number(p1),
          placar2: p2 === '' ? null : Number(p2),
          tipoResultado: tipo,
        });
      }
      await App.recarregar();
    } catch (err) {
      erroEl.textContent = 'Erro ao salvar: ' + err.message;
      botao.disabled = false;
    }
  }

  async function gerar(etapaCategoriaId) {
    const erroEl = document.getElementById('chave-erro');
    erroEl.textContent = '';
    try {
      await apiJogo().gerarMataMata(etapaCategoriaId);
      await App.recarregar();
    } catch (err) {
      erroEl.textContent = 'Não foi possível gerar a chave: ' + err.message
        + ' São necessárias 4, 8 ou 16 duplas classificadas.';
    }
  }

  async function regerar() {
    if (!confirm('Regerar a chave apaga os placares do mata-mata. Continuar?')) {
      return;
    }
    await apiJogo().gerarMataMata(estado.etapaCategoriaId, { recriar: true });
    await App.recarregar();
  }
})();
