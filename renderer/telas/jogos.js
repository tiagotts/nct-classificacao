// Tela dos jogos da fase de grupos de uma categoria.
// Os jogos são gerados automaticamente (todos-contra-todos) a partir das
// duplas e seus grupos. Aqui se lançam os placares.
// params: { etapaCategoriaId }
(() => {
  const apiJogo = () => window.electronAPI.db.jogo;
  const apiDupla = () => window.electronAPI.db.dupla;
  const apiEC = () => window.electronAPI.db.etapaCategoria;

  App.registrarTela('jogos', { render });

  let estado = null; // { etapaCategoriaId, jogos, duplaMap }

  async function render(container, params) {
    const { etapaCategoriaId } = params;
    const duplas = await apiDupla().listar(etapaCategoriaId);
    let jogos = (await apiJogo().listar(etapaCategoriaId))
      .filter(j => j.fase === 'grupo');

    const comGrupo = duplas.filter(d => d.grupo);

    // Geração automática na primeira visita, quando ainda não há jogos.
    if (jogos.length === 0 && comGrupo.length >= 2) {
      try {
        await apiJogo().gerarFaseGrupos(etapaCategoriaId);
        jogos = (await apiJogo().listar(etapaCategoriaId))
          .filter(j => j.fase === 'grupo');
      } catch (err) {
        container.innerHTML = `
          <div class="topo-tela"><h2>Jogos da fase de grupos</h2></div>
          <div class="vazio">Não foi possível gerar os jogos:
            ${App.escapar(err.message)}</div>`;
        return;
      }
    }

    if (jogos.length === 0) {
      container.innerHTML = `
        <div class="topo-tela"><h2>Jogos da fase de grupos</h2></div>
        <div class="vazio">
          Cadastre as duplas e atribua os grupos antes de gerar os jogos.
        </div>`;
      return;
    }

    const ec = await apiEC().obter(etapaCategoriaId);
    const duplaMap = {};
    duplas.forEach(d => { duplaMap[d.id] = d; });
    // A ordem dos jogos só pode ser mudada no formato todos-contra-todos.
    // Na dupla eliminatória a ordem (nº do jogo) é estrutural — define quem
    // são os jogos de vencedores/perdedores/repescagem.
    const reordenavel = ec.formato !== 'dupla-eliminatoria';
    estado = { etapaCategoriaId, jogos, duplaMap, reordenavel };

    container.innerHTML = `
      <div class="topo-tela">
        <h2>Jogos da fase de grupos</h2>
        <div class="acoes-topo">
          <button class="btn ghost sm" id="btn-regerar">Regerar jogos</button>
        </div>
      </div>
      <p class="dica">${jogos.length} jogos gerados automaticamente
        (${ec.formato === 'dupla-eliminatoria'
          ? 'dupla eliminatória no grupo' : 'todos contra todos'}).
        Em W&times;0 escolha no resultado quem venceu — o app preenche
        o placar sozinho.${reordenavel
          ? ' Use as setas ↑↓ para mudar a ordem dos jogos.' : ''}</p>
      <div id="grid-jogos"></div>
      <div class="form-erro" id="jogos-erro"></div>
      <div class="form-acoes">
        <button class="btn" id="btn-salvar">Salvar resultados</button>
      </div>`;

    desenhar();
    container.querySelector('#btn-salvar').onclick = (e) => salvar(e.target);
    container.querySelector('#btn-regerar').onclick = regerar;
  }

  // Variantes do dropdown de resultado: o backend só conhece 'normal',
  // 'wx0' e 'desistencia'; o W×0 tem 3 variantes na UI para já indicar
  // o vencedor sem o usuário precisar digitar o placar.
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

  // Placares automáticos para cada variante de W×0.
  function placaresDaVariante(v) {
    if (v === 'wx0-d1') return { p1: 1, p2: 0 };
    if (v === 'wx0-d2') return { p1: 0, p2: 1 };
    if (v === 'wx0-duplo') return { p1: 0, p2: 0 };
    return null;
  }

  // Rótulo do placar do W×0: vencedor mostra "W", perdedor "0".
  function rotuloWO(v, lado) {
    if (v === 'wx0-d1') return lado === 1 ? 'W' : '0';
    if (v === 'wx0-d2') return lado === 1 ? '0' : 'W';
    return '0'; // duplo W×0 — ambos "0"
  }

  // Reage à troca de tipo: nos W×0 esconde o input e mostra o rótulo
  // (W para o vencedor, 0 para o perdedor); voltar para Normal/Desistência
  // mostra os inputs editáveis de novo.
  function aoMudarTipo(sel) {
    const tr = sel.closest('tr');
    const v = sel.value;
    const ehWO = ehVarianteWO(v);
    [1, 2].forEach(lado => {
      const input = tr.querySelector('.p' + lado);
      const rotulo = tr.querySelector('.p' + lado + '-wo');
      if (ehWO) {
        const placares = placaresDaVariante(v);
        input.value = lado === 1 ? placares.p1 : placares.p2;
        input.style.display = 'none';
        const txt = rotuloWO(v, lado);
        rotulo.textContent = txt;
        rotulo.classList.toggle('venceu', txt === 'W');
        rotulo.style.display = '';
      } else {
        input.style.display = '';
        rotulo.style.display = 'none';
      }
    });
  }

  // Jogos na ordem do nº do jogo.
  function jogosOrdenados() {
    return estado.jogos.slice().sort((a, b) => (a.num || 0) - (b.num || 0));
  }

  // Tabela única, com os jogos em sequência (ordem do nº do jogo) — os
  // grupos aparecem intercalados, como na planilha do circuito.
  function desenhar() {
    const jogos = jogosOrdenados();
    const colOrdem = estado.reordenavel ? '<th class="col-ordem">Ordem</th>' : '';
    document.getElementById('grid-jogos').innerHTML = `
      <table class="tab-jogos">
        <thead><tr>
          <th class="idx">#</th>
          <th class="col-grp">Grupo</th>
          <th>Dupla 1</th>
          <th class="col-placar">Placar</th>
          <th class="col-placar">Placar</th>
          <th>Dupla 2</th>
          <th class="col-tipo">Resultado</th>
          ${colOrdem}
        </tr></thead>
        <tbody>${jogos.map((j, i) => linhaHtml(j, i, jogos.length)).join('')}</tbody>
      </table>`;
    document.querySelectorAll('#grid-jogos .tipo').forEach(sel => {
      sel.onchange = () => aoMudarTipo(sel);
    });
    document.querySelectorAll('#grid-jogos [data-mover]').forEach(b => {
      b.onclick = () => moverJogo(Number(b.dataset.id), b.dataset.mover);
    });
  }

  // Move um jogo para cima/baixo na lista, trocando o nº com o vizinho.
  // Captura antes os placares digitados para não perdê-los no redesenho.
  function moverJogo(id, direcao) {
    lerGrid();
    const jogos = jogosOrdenados();
    const i = jogos.findIndex(j => j.id === id);
    const k = direcao === 'cima' ? i - 1 : i + 1;
    if (i < 0 || k < 0 || k >= jogos.length) return;
    const tmp = jogos[i].num;
    jogos[i].num = jogos[k].num;
    jogos[k].num = tmp;
    desenhar();
  }

  // Captura placar e tipo digitados no grid de volta para estado.jogos.
  function lerGrid() {
    document.querySelectorAll('#grid-jogos tbody tr').forEach(tr => {
      const j = estado.jogos.find(x => x.id === Number(tr.dataset.id));
      if (!j) return;
      const p1 = tr.querySelector('.p1').value;
      const p2 = tr.querySelector('.p2').value;
      j.placar1 = p1 === '' ? null : Number(p1);
      j.placar2 = p2 === '' ? null : Number(p2);
      const v = tr.querySelector('.tipo').value;
      j.tipo_resultado = ehVarianteWO(v) ? 'wx0' : v;
    });
  }

  function nomeDupla(id) {
    const d = estado.duplaMap[id];
    // Jogo da dupla eliminatória ainda sem vencedor/perdedor definido.
    if (!d) return '<i>a definir</i>';
    return `<span class="cod">${App.escapar(d.codigo)}</span>`
      + App.escapar(`${d.atleta1_nome} / ${d.atleta2_nome}`);
  }

  function linhaHtml(j, i, total) {
    const v = variante(j);
    const op = (val, txt) =>
      `<option value="${val}"${v === val ? ' selected' : ''}>${txt}</option>`;
    const ehWO = ehVarianteWO(v);
    const inputStyle = ehWO ? ' style="display:none"' : '';
    const woStyle = ehWO ? '' : ' style="display:none"';
    const woTxt1 = ehWO ? rotuloWO(v, 1) : '';
    const woTxt2 = ehWO ? rotuloWO(v, 2) : '';
    const venceu1 = woTxt1 === 'W' ? ' venceu' : '';
    const venceu2 = woTxt2 === 'W' ? ' venceu' : '';
    const colOrdem = estado.reordenavel ? `
        <td class="col-ordem">
          <button class="btn ghost sm" data-mover="cima" data-id="${j.id}"
                  title="Subir" ${i === 0 ? 'disabled' : ''}>↑</button>
          <button class="btn ghost sm" data-mover="baixo" data-id="${j.id}"
                  title="Descer" ${i === total - 1 ? 'disabled' : ''}>↓</button>
        </td>` : '';
    return `
      <tr data-id="${j.id}">
        <td class="idx">${j.num}</td>
        <td class="col-grp">${App.escapar(j.grupo || '')}</td>
        <td>${nomeDupla(j.dupla1_id)}</td>
        <td class="col-placar">
          <input type="number" min="0" class="p1"${inputStyle}
                 value="${j.placar1 != null ? j.placar1 : ''}">
          <span class="placar-wo p1-wo${venceu1}"${woStyle}>${woTxt1}</span>
        </td>
        <td class="col-placar">
          <input type="number" min="0" class="p2"${inputStyle}
                 value="${j.placar2 != null ? j.placar2 : ''}">
          <span class="placar-wo p2-wo${venceu2}"${woStyle}>${woTxt2}</span>
        </td>
        <td>${nomeDupla(j.dupla2_id)}</td>
        <td class="col-tipo">
          <select class="tipo">
            ${op('normal', 'Normal')}
            ${op('wx0-d1', 'W×0: Dupla 1 venceu')}
            ${op('wx0-d2', 'W×0: Dupla 2 venceu')}
            ${op('wx0-duplo', 'Duplo W×0')}
            ${op('desistencia', 'Desistência')}
          </select>
        </td>
        ${colOrdem}
      </tr>`;
  }

  async function salvar(botao) {
    botao.disabled = true;
    const erroEl = document.getElementById('jogos-erro');
    erroEl.textContent = '';
    try {
      for (const tr of document.querySelectorAll('#grid-jogos tbody tr')) {
        const id = Number(tr.dataset.id);
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
      // Persiste a ordem dos jogos (só no formato todos-contra-todos).
      if (estado.reordenavel) {
        await apiJogo().reordenarGrupo(
          estado.etapaCategoriaId, jogosOrdenados().map(j => j.id));
      }
      await App.recarregar();
    } catch (err) {
      erroEl.textContent = 'Erro ao salvar: ' + err.message;
      botao.disabled = false;
    }
  }

  async function regerar() {
    if (!confirm('Regerar os jogos apaga todos os placares já lançados. Continuar?')) {
      return;
    }
    try {
      await apiJogo().gerarFaseGrupos(estado.etapaCategoriaId, { recriar: true });
      await App.recarregar();
    } catch (err) {
      alert('Não foi possível regerar os jogos: ' + err.message);
    }
  }
})();
