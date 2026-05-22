// =============================================================================
// Publicador: publica a página de uma categoria no GitHub Pages, acompanha a
// geração (que leva cerca de 1 minuto) e avisa quando a página fica no ar —
// inclusive com uma notificação do sistema, caso o app esteja em segundo plano.
//
// Uso: Publicar.publicarCategoria(etapaCategoriaId, elementoDeStatus, botao)
// =============================================================================

const Publicar = (() => {
  const ESPERA_MAX = 4 * 60 * 1000;  // desiste de acompanhar após 4 min
  const INTERVALO = 6000;            // consulta o build a cada 6 s

  async function publicarCategoria(etapaCategoriaId, statusEl, botao) {
    // Só desabilita o botão (não mexe no texto, para funcionar tanto em
    // botões simples quanto em cartões com estrutura interna).
    const restaurarBotao = () => { if (botao) botao.disabled = false; };
    if (botao) botao.disabled = true;

    const config = (await window.electronAPI.loadConfig()) || {};
    const gh = config.github;
    if (!gh || !gh.owner || !gh.repo || !gh.token) {
      render(statusEl, 'semconfig');
      restaurarBotao();
      return;
    }

    render(statusEl, 'publicando');
    let res;
    try {
      res = await window.electronAPI.publicacao
        .publicarCategoria(etapaCategoriaId, gh);
    } catch (err) {
      render(statusEl, 'erro', { mensagem: err.message });
      restaurarBotao();
      return;
    }
    restaurarBotao();
    render(statusEl, 'aguardando', res);

    if (!res.sha) return; // sem o commit não dá para acompanhar o build

    const inicio = Date.now();
    const timer = setInterval(async () => {
      let st = 'aguardando';
      try {
        st = await window.electronAPI.publicacao.statusBuild(gh, res.sha);
      } catch { st = 'aguardando'; }

      if (st === 'pronto') {
        clearInterval(timer);
        render(statusEl, 'pronto', res);
        notificar();
      } else if (st === 'erro') {
        clearInterval(timer);
        render(statusEl, 'erroBuild', res);
      } else if (Date.now() - inicio > ESPERA_MAX) {
        clearInterval(timer);
        render(statusEl, 'demorou', res);
      }
    }, INTERVALO);
  }

  // Desenha o estado da publicação no elemento informado.
  function render(el, estado, dados = {}) {
    if (!el) return;

    if (estado === 'semconfig') {
      el.innerHTML = `<div class="erro">Configure o GitHub primeiro:
        tela da etapa &rsaquo; "Configurar publicação".</div>`;
      return;
    }
    if (estado === 'erro') {
      el.innerHTML = `<div class="erro">Falha ao publicar:
        ${App.escapar(dados.mensagem || '')}</div>`;
      return;
    }
    if (estado === 'publicando') {
      el.innerHTML = '<div class="ok">Publicando… enviando os arquivos '
        + 'para o GitHub.</div>';
      return;
    }

    const TEXTO = {
      aguardando: ['ok', 'Enviado. Aguardando o GitHub Pages gerar a página '
        + '(cerca de 1 minuto)…'],
      pronto: ['ok', 'Página atualizada e no ar.'],
      erroBuild: ['erro', 'Enviado, mas o GitHub Pages reportou erro ao gerar '
        + 'a página. Verifique o repositório.'],
      demorou: ['erro', 'Enviado. A geração está demorando mais que o normal — '
        + 'verifique o repositório.'],
    };
    const [classe, cabecalho] = TEXTO[estado];
    const link = `<a href="${App.escapar(dados.url)}" target="_blank"
      >${App.escapar(dados.url)}</a>`;

    el.innerHTML = `<div class="${classe}">${cabecalho}<br>${link}<br>
      <button class="btn ghost sm" data-qr style="margin-top:8px">
        Mostrar QR code</button>
      <div data-qrarea></div></div>`;

    const btnQr = el.querySelector('[data-qr]');
    const area = el.querySelector('[data-qrarea]');
    btnQr.onclick = () => {
      if (area.innerHTML) {
        area.innerHTML = '';
        btnQr.textContent = 'Mostrar QR code';
      } else {
        area.innerHTML = `<div class="qrcode-box">
          <p class="dica">Os jogadores podem escanear este código.</p>
          ${dados.qrcode || ''}</div>`;
        btnQr.textContent = 'Ocultar QR code';
      }
    };
  }

  // Notificação do sistema operacional (funciona mesmo com o app em 2º plano).
  function notificar() {
    try {
      new Notification('NCT Classificação', {
        body: 'A página de resultados foi atualizada e está no ar.',
      });
    } catch { /* notificação indisponível */ }
  }

  return { publicarCategoria };
})();
