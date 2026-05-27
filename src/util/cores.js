// =============================================================================
// Helpers para derivar variantes de cor a partir de uma cor base (hex).
//
// Usado tanto pela tela de temporadas (override das CSS vars no renderer) quanto
// pelo publicador (interpolação no <style> da página). A escolha por mistura
// linear com preto/branco em RGB é proposital — é mais previsível que HSL
// quando a saturação da base varia (cores muito pálidas ou neutras).
// =============================================================================

function normalizarHex(hex) {
  let h = String(hex || '').trim();
  if (h.startsWith('#')) h = h.slice(1);
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return h.toLowerCase();
}

function hexParaRgb(hex) {
  const h = normalizarHex(hex);
  if (!h) return null;
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function rgbParaHex({ r, g, b }) {
  const dois = (n) => Math.max(0, Math.min(255, Math.round(n)))
    .toString(16).padStart(2, '0');
  return `#${dois(r)}${dois(g)}${dois(b)}`;
}

// Mistura `hex` com `alvo` (também hex), retornando uma nova cor; t=0 mantém
// hex, t=1 retorna alvo, valores intermediários interpolam linearmente.
function misturar(hex, alvo, t) {
  const a = hexParaRgb(hex);
  const b = hexParaRgb(alvo);
  if (!a || !b) return hex;
  return rgbParaHex({
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  });
}

function escurecer(hex, t = 0.4) { return misturar(hex, '#000000', t); }
function clarear(hex, t = 0.5) { return misturar(hex, '#ffffff', t); }
function tint(hex, t = 0.88) { return misturar(hex, '#ffffff', t); }

// A partir das 2 cores escolhidas pela temporada, devolve a paleta completa
// que a UI e a página publicada esperam. Quando uma cor é falsy/null, cai
// nos defaults NCT (azul oceano + amarelo dourado).
function paletaTemporada(corPrimaria, corSecundaria) {
  const primaria = normalizarHex(corPrimaria) ? `#${normalizarHex(corPrimaria)}` : '#1e7fc4';
  const secundaria = normalizarHex(corSecundaria) ? `#${normalizarHex(corSecundaria)}` : '#fbbf24';
  return {
    ocean: primaria,
    oceanDark: escurecer(primaria, 0.55),
    oceanLight: clarear(primaria, 0.55),
    oceanTint: tint(primaria, 0.88),
    sun: secundaria,
    sunDark: escurecer(secundaria, 0.3),
  };
}

const exportados = {
  normalizarHex, hexParaRgb, rgbParaHex,
  misturar, escurecer, clarear, tint, paletaTemporada,
};
if (typeof module !== 'undefined' && module.exports) {
  module.exports = exportados;
}
if (typeof window !== 'undefined') {
  window.NctCores = exportados;
}
