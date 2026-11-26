/* Tratamento da foto antes da leitura (funções puras sobre pixels: rodam no navegador e nos testes).
 *  cinza()       -> tons de cinza com contraste esticado (ignora 2% mais claros e mais escuros)
 *  limiar()      -> preto e branco com limiar adaptativo (Bradley): resiste a sombra e luz desigual
 *  orientacao()  -> quantos graus girar (até 20°) para as linhas de texto ficarem retas.
 *  Foto deitada (90°) é tratada na leitura: se a confiança vier baixa, tenta girando 90° para cada lado. */

/** rgba (Uint8ClampedArray do canvas) -> cinza com contraste */
export function cinza(rgba, w, h) {
  const n = w * h, g = new Uint8ClampedArray(n), hist = new Uint32Array(256);
  for (let i = 0, j = 0; j < n; i += 4, j++) { const v = (0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2]) | 0; g[j] = v; hist[v]++; }
  let mn = 0, mx = 255, a = 0;
  for (let i = 0; i < 256; i++) { a += hist[i]; if (a > n * 0.02) { mn = i; break; } }
  a = 0; for (let i = 255; i >= 0; i--) { a += hist[i]; if (a > n * 0.02) { mx = i; break; } }
  /* página com pouco texto: o "escuro" de 2% ainda é papel; ancora no branco do papel (mx) com faixa mínima */
  mn = Math.min(mn, mx - 80);
  const esc = 255 / (mx - mn);
  for (let j = 0; j < n; j++) g[j] = (g[j] - mn) * esc;
  return g;
}

/** limiar adaptativo de Bradley: o pixel fica preto se for t% mais escuro que a média da vizinhança */
export function limiar(g, w, h, frac = 16, t = 0.85) {
  const s = Math.max(7, (w / frac) | 0) >> 1, W1 = w + 1;
  const I = new Float64Array(W1 * (h + 1));
  for (let y = 1; y <= h; y++) { let lin = 0; for (let x = 1; x <= w; x++) { lin += g[(y - 1) * w + x - 1]; I[y * W1 + x] = I[(y - 1) * W1 + x] + lin; } }
  const out = new Uint8ClampedArray(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - s), y1 = Math.min(h, y + s + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - s), x1 = Math.min(w, x + s + 1);
      const soma = I[y1 * W1 + x1] - I[y0 * W1 + x1] - I[y1 * W1 + x0] + I[y0 * W1 + x0];
      out[y * w + x] = g[y * w + x] * (y1 - y0) * (x1 - x0) <= soma * t ? 0 : 255;
    }
  }
  return out;
}

/** ângulo (graus, sentido anti-horário) que endireita o texto. Recebe uma versão PEQUENA da foto (~700 px) em cinza.
 *  Mede, para cada ângulo, o quanto os pontos escuros se concentram em linhas horizontais. */
export function orientacao(g, w, h) {
  const b = limiar(g, w, h, 12, 0.80);
  const xs = [], ys = [];
  let tot = 0; for (let i = 0; i < b.length; i++) if (!b[i]) tot++;
  const passo = Math.max(1, Math.ceil(tot / 15000));
  for (let i = 0, c = 0; i < b.length; i++) if (!b[i] && (c++ % passo === 0)) { xs.push(i % w); ys.push((i / w) | 0); }
  if (xs.length < 50) return 0;
  const diag = Math.ceil(Math.hypot(w, h)) * 2 + 4, bins = new Float64Array(diag);
  const nota = a => {
    const r = a * Math.PI / 180, sn = Math.sin(r), cs = Math.cos(r); bins.fill(0);
    for (let i = 0; i < xs.length; i++) bins[(-xs[i] * sn + ys[i] * cs + diag / 2) | 0]++;
    let q = 0; for (let i = 0; i < diag; i++) q += bins[i] * bins[i]; return q;
  };
  const melhorEm = (de, ate, p) => { let m = de, nm = -1; for (let a = de; a <= ate + 1e-9; a += p) { const v = nota(a); if (v > nm) { nm = v; m = a; } } return m; };
  let a = melhorEm(-20, 20, 1);
  a = melhorEm(a - 1, a + 1, 0.25);
  return Math.abs(a) < 0.5 ? 0 : a;
}
