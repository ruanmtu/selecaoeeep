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

/** caixa do documento na foto: a maior região clara ligada (o papel), numa cópia pequena em cinza.
 *  Devolve {x, y, w, h} em frações (0 a 1) ou null quando não vale recortar (papel ocupa quase tudo ou não achou). */
export function recorte(g, w, h) {
  const n = w * h, m = new Uint8Array(n);
  /* claro = acima do meio-termo entre o fundo e o papel (Otsu simples) */
  const hist = new Uint32Array(256); for (let i = 0; i < n; i++) hist[g[i]]++;
  let soma = 0; for (let i = 0; i < 256; i++) soma += i * hist[i];
  let sB = 0, wB = 0, mx = -1, lim = 128;
  for (let t = 0; t < 256; t++) { wB += hist[t]; if (!wB) continue; const wF = n - wB; if (!wF) break; sB += t * hist[t]; const mB = sB / wB, mF = (soma - sB) / wF, v = wB * wF * (mB - mF) ** 2; if (v > mx) { mx = v; lim = t; } }
  for (let i = 0; i < n; i++) m[i] = g[i] > lim ? 1 : 0;
  /* fecha os buracos do texto escuro dentro do papel (dilata 2 px) e depois afina 4 px: as manchas claras do fundo
     (granito, madeira) que encostam no papel por pontes finas se soltam; o papel, grande, sobrevive */
  const passa = (src, r, dil) => { const o = new Uint8Array(n); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let v = dil ? 0 : 1; for (let dy = -r; dy <= r && (dil ? !v : v); dy++) for (let dx = -r; dx <= r; dx++) { const yy = y + dy, xx = x + dx; const q = yy >= 0 && yy < h && xx >= 0 && xx < w ? src[yy * w + xx] : 0; if (dil && q) { v = 1; break; } if (!dil && !q) { v = 0; break; } } o[y * w + x] = v; } return o; };
  const d = passa(passa(m, 2, true), 4, false);
  const vis = new Int32Array(n).fill(-1), fila = new Int32Array(n); let melhor = null;
  for (let s = 0; s < n; s++) {
    if (!d[s] || vis[s] >= 0) continue;
    let ini = 0, fim = 0, x0 = w, y0 = h, x1 = 0, y1 = 0, cont = 0; fila[fim++] = s; vis[s] = s;
    while (ini < fim) {
      const p = fila[ini++], x = p % w, y = (p / w) | 0; cont++;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      const viz = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1];
      for (const q of viz) if (q >= 0 && d[q] && vis[q] < 0) { vis[q] = s; fila[fim++] = q; }
    }
    if (!melhor || cont > melhor.cont) melhor = { cont, x0, y0, x1, y1, id: s };
  }
  if (!melhor) return null;
  /* aparo: só ficam as colunas/linhas em que o bloco é "cheio" (≥ 50% do máximo; a margem de 4% devolve os cantos de um papel torto). Mancha clara do fundo grudada
     na lateral do papel é estreita e cai fora; o papel, retangular, fica inteiro */
  const col = new Uint32Array(w), lin = new Uint32Array(h);
  for (let i = 0; i < n; i++) if (vis[i] === melhor.id) { col[i % w]++; lin[(i / w) | 0]++; }
  const mc = Math.max(...col), ml = Math.max(...lin);
  let ax0 = 0, ax1 = w - 1, ay0 = 0, ay1 = h - 1;
  while (ax0 < w && col[ax0] < mc * 0.5) ax0++; while (ax1 > 0 && col[ax1] < mc * 0.5) ax1--;
  while (ay0 < h && lin[ay0] < ml * 0.5) ay0++; while (ay1 > 0 && lin[ay1] < ml * 0.5) ay1--;
  if (ax1 > ax0 && ay1 > ay0) Object.assign(melhor, { x0: ax0, x1: ax1, y0: ay0, y1: ay1 });
  const area = (melhor.x1 - melhor.x0 + 1) * (melhor.y1 - melhor.y0 + 1) / n;
  if (area > 0.85 || area < 0.08 || melhor.cont / n < 0.06) return null;   // já é só o documento, ou não achou o papel
  const mg = 0.04 + 4 / Math.max(w, h);
  const x = Math.max(0, melhor.x0 / w - mg), y = Math.max(0, melhor.y0 / h - mg);
  return { x, y, w: Math.min(1, (melhor.x1 + 1) / w + mg) - x, h: Math.min(1, (melhor.y1 + 1) / h + mg) - y };
}

/** texto deitado (90°)? Em texto na horizontal, percorrer as LINHAS da imagem cruza muito mais traços de letra
 *  (liga-desliga claro/escuro) do que percorrer as COLUNAS. Recebe uma cópia pequena (~700 px) só do documento. */
export function deitada(g, w, h) {
  const b = limiar(g, w, h, 12, 0.80);
  let th = 0, tv = 0;
  for (let y = 0; y < h; y++) for (let x = 1; x < w; x++) if (b[y * w + x] !== b[y * w + x - 1]) th++;
  for (let x = 0; x < w; x++) for (let y = 1; y < h; y++) if (b[y * w + x] !== b[(y - 1) * w + x]) tv++;
  const rh = th / Math.max(1, h), rv = tv / Math.max(1, w);   // por linha / por coluna (independe do formato)
  return { deitada: rv > rh * 1.12, razao: rv / Math.max(1, rh) };
}
