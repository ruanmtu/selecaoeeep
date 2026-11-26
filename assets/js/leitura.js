/* Leitura de documentos NO PRÓPRIO APARELHO (nada é enviado para fora):
 *  - PDF com texto (ex.: histórico gerado pelo SIGE): o texto sai direto do arquivo (pdf.js);
 *  - foto ou PDF escaneado: OCR em português no navegador (Tesseract), com a foto endireitada antes.
 * Rapidez: o leitor é carregado assim que a tela abre (aquecer) e, em aparelhos bons, 2 leitores trabalham juntos.
 * Sensibilidade: se faltar algum campo, lê de novo em preto e branco adaptativo; se a confiança vier muito baixa
 * (foto deitada), tenta girando 90° para cada lado. As regras de cada documento ficam em interpretar.js. */
import * as pdfjs from '../vendor/pdfjs/pdf.js';
import { cinza, limiar, orientacao } from './imagem.js?v=12';
import { interpretarIdentidade, interpretarComprovante, interpretarDocumento, interpretarNotas, pontos, PONTOS_MAX, notaNome } from './interpretar.js?v=12';
export { interpretarDocumento, interpretarNotas, interpretarIdentidade, interpretarComprovante };

const base = new URL('../vendor/pdfjs/', import.meta.url).href;
pdfjs.GlobalWorkerOptions.workerSrc = base + 'pdf.worker.js';

/* ---------------- o leitor (Tesseract) ---------------- */
const TESS = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
let leitoresP = null;
function carregarScript(src) {
  return new Promise((ok, falha) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => falha(new Error('Sem internet para baixar o leitor de fotos (só na primeira vez).')); document.head.appendChild(s); });
}
function quantosLeitores() { const c = navigator.hardwareConcurrency || 2, m = navigator.deviceMemory || 4; return c >= 4 && m >= 3 ? 2 : 1; }
function leitores() {
  if (!leitoresP) {
    leitoresP = (async () => {
      if (!window.Tesseract) await carregarScript(TESS);
      const T = window.Tesseract, sch = T.createScheduler();
      const ws = await Promise.all(Array.from({ length: quantosLeitores() }, () => T.createWorker('por', 1)));
      for (const w of ws) { await w.setParameters({ preserve_interword_spaces: '1', user_defined_dpi: '300' }); sch.addWorker(w); }
      return sch;
    })();
    leitoresP.catch(() => { leitoresP = null; });
  }
  return leitoresP;
}
/** começa a carregar o leitor em segundo plano (chamado quando a tela do candidato abre) */
export function aquecer() { leitores().catch(() => {}); }
async function ocr(canvas) {
  const s = await leitores();
  const r = await s.addJob('recognize', canvas);
  return { texto: r.data.text || '', conf: r.data.confidence || 0 };
}

/* ---------------- foto -> canvas tratado ---------------- */
async function abrirFoto(arquivo) {
  try { return await createImageBitmap(arquivo, { imageOrientation: 'from-image' }); }   // respeita a orientação gravada pelo celular
  catch (e) {
    const url = URL.createObjectURL(arquivo);
    try { const img = new Image(); img.src = url; await img.decode(); return img; } finally { URL.revokeObjectURL(url); }
  }
}
const larg = f => f.naturalWidth || f.width, alt = f => f.naturalHeight || f.height;
/** mede a inclinação numa cópia pequena da foto */
function medirGiro(fonte) {
  const w = larg(fonte), h = alt(fonte), k = 700 / Math.max(w, h);
  const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
  const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(fonte, 0, 0, c.width, c.height);
  const d = x.getImageData(0, 0, c.width, c.height);
  return orientacao(cinza(d.data, c.width, c.height), c.width, c.height);
}
/** inclinação fina de uma foto que vai ser girada em 90°/180° (mede na foto já girada) */
function medirGiroDeitado(fonte, extra) {
  const c = tratar(fonte, extra, 'cinza');
  return medirGiro(c);
}
/** foto -> canvas no tamanho bom para OCR (~2000 px), girado (graus anti-horários) e em cinza ou preto e branco */
function tratar(fonte, graus, modo) {
  const w0 = larg(fonte), h0 = alt(fonte);
  const k = Math.min(1, 2000 / Math.max(w0, h0)) * (Math.max(w0, h0) < 1300 ? 1.6 : 1);
  const w = Math.round(w0 * k), h = Math.round(h0 * k), r = -graus * Math.PI / 180;
  const W = Math.round(Math.abs(w * Math.cos(r)) + Math.abs(h * Math.sin(r))), H = Math.round(Math.abs(w * Math.sin(r)) + Math.abs(h * Math.cos(r)));
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
  x.translate(W / 2, H / 2); x.rotate(r); x.drawImage(fonte, -w / 2, -h / 2, w, h); x.setTransform(1, 0, 0, 1, 0, 0);
  const d = x.getImageData(0, 0, W, H);
  let g = cinza(d.data, W, H);
  if (modo === 'pb') g = limiar(g, W, H);
  const p = d.data; for (let i = 0, j = 0; j < g.length; i += 4, j++) { p[i] = p[i + 1] = p[i + 2] = g[j]; p[i + 3] = 255; }
  x.putImageData(d, 0, 0);
  return c;
}

/* ---------------- PDF ---------------- */
function abrirPdf(arquivo) { return arquivo.arrayBuffer().then(b => pdfjs.getDocument({ data: b, cMapUrl: base + 'cmaps/', cMapPacked: true, standardFontDataUrl: base + 'standard_fonts/', isEvalSupported: false }).promise); }
function textoDaPagina(tc) {
  const linhas = new Map();   // junta os pedaços em linhas pela altura (y), da esquerda para a direita
  tc.items.forEach(it => { if (!it.str.trim()) return; const y = Math.round(it.transform[5] / 3) * 3; (linhas.get(y) || linhas.set(y, []).get(y)).push([it.transform[4], it.str]); });
  return [...linhas.entries()].sort((a, b) => b[0] - a[0]).map(([, l]) => l.sort((a, b) => a[0] - b[0]).map(x => x[1]).join('    ')).join('\n');
}
/** só o texto de um PDF (sem OCR); vazio se o PDF for escaneado */
export async function textoPdf(arquivo) {
  try {
    const doc = await abrirPdf(arquivo); let t = '';
    for (let n = 1; n <= Math.min(doc.numPages, 4); n++) t += textoDaPagina(await (await doc.getPage(n)).getTextContent()) + '\n';
    return t.replace(/\s/g, '').length > 80 ? t : '';
  } catch (e) { return ''; }
}
/** PDF escaneado -> imagens das primeiras páginas */
export async function imagensPdf(arquivo, max = 3, lado = 2000) {
  const doc = await abrirPdf(arquivo), fotos = [];
  for (let n = 1; n <= Math.min(doc.numPages, max); n++) {
    const pg = await doc.getPage(n), v1 = pg.getViewport({ scale: 1 });
    const vp = pg.getViewport({ scale: Math.min(3, lado / Math.max(v1.width, v1.height)) });
    const c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
    await pg.render({ canvasContext: x, viewport: vp }).promise;
    fotos.push(c);
  }
  return fotos;
}

/* ---------------- leitura ---------------- */
/** arquivos -> partes: textos de PDF e fotos já abertas (na ordem em que vieram) */
async function partes(arquivos) {
  const out = [];
  for (const f of [...arquivos].slice(0, 6)) {
    if (f.type === 'application/pdf' || /\.pdf$/i.test(f.name)) {
      const t = await textoPdf(f);
      if (t) out.push({ texto: t });
      else for (const c of await imagensPdf(f)) out.push({ foto: c });
    } else out.push({ foto: await abrirFoto(f) });
  }
  return out;
}
/** lê todas as fotos (em paralelo) com um tratamento; devolve o texto junto e a confiança de cada foto */
async function passada(ps, modo, giroExtra, passo) {
  const res = await Promise.all(ps.map(async p => {
    if (p.texto) return { texto: p.texto, conf: 100 };
    if (p.giro === undefined) p.giro = medirGiro(p.foto);
    const r = await ocr(tratar(p.foto, p.giro + (giroExtra(p) || 0), modo));
    passo(); return r;
  }));
  return { texto: res.map(r => r.texto).join('\n'), confs: res.map(r => r.conf) };
}
function juntar(r, r2) {
  /* nomes: quando as leituras discordam, fica o que tem mais "cara de nome" */
  for (const k of ['nome', 'pai', 'mae', 'titular']) if (r[k] && r2[k] && notaNome(r2[k]) > notaNome(r[k]) + 1) r[k] = r2[k];
  for (const k in r2) if (k !== 'cpf_duvida' && (r[k] === undefined || r[k] === '' || (k === 'cpf' && r.cpf_duvida && !r2.cpf_duvida))) r[k] = r2[k];
  if (r.cpf && r2.cpf === r.cpf && !r2.cpf_duvida) delete r.cpf_duvida;
  return r;
}
/**
 * Documento de identidade ('doc') ou comprovante ('end'): devolve os campos achados.
 * progresso(0..1) atualiza a barra.
 */
export async function lerDocumento(arquivos, tipo, bairrosCota, progresso) {
  const ler = t => tipo === 'doc' ? interpretarIdentidade(t) : interpretarComprovante(t, bairrosCota || []);
  progresso && progresso(0.03);
  const ps = await partes(arquivos), nf = ps.filter(p => p.foto).length || 1;
  let feitos = 0, previsto = nf;
  const passo = () => { feitos++; progresso && progresso(Math.min(0.97, 0.05 + 0.92 * feitos / previsto)); };

  /* 1ª passada: cinza com contraste, foto endireitada */
  const p1 = await passada(ps, 'cinza', () => 0, passo);
  let r = ler(p1.texto);
  if (pontos(tipo, r) >= PONTOS_MAX[tipo] || !ps.some(p => p.foto)) return r;

  /* 2ª: preto e branco adaptativo (sombra, luz desigual, fundo estampado do RG) */
  previsto += nf;
  const p2 = await passada(ps, 'pb', () => 0, passo);
  r = juntar(r, ler(p2.texto));
  if (pontos(tipo, r) >= PONTOS_MAX[tipo]) return r;

  /* 3ª: foto deitada ou de cabeça para baixo — só as fotos com confiança muito baixa. Lê girando 90° para cada
     lado (e 180° se ainda estiver ruim) e fica com o giro de MAIOR confiança: o giro errado lê lixo. */
  const ruins = ps.map((p, i) => p.foto && Math.max(p1.confs[i], p2.confs[i]) < 55 ? i : -1).filter(i => i >= 0);
  if (ruins.length) {
    const melhor = {};
    for (const extra of [90, -90, 180]) {
      if (extra === 180 && ruins.every(i => melhor[i] && melhor[i].conf >= 55)) break;
      previsto += ruins.length;
      const res = await Promise.all(ruins.map(async i => { const p = ps[i]; const x = await ocr(tratar(p.foto, medirGiroDeitado(p.foto, extra) + extra, 'cinza')); passo(); return [i, x]; }));
      for (const [i, x] of res) if (!melhor[i] || x.conf > melhor[i].conf) melhor[i] = x;
    }
    const textos = ps.map((p, i) => melhor[i] && melhor[i].conf > Math.max(p1.confs[i], p2.confs[i]) ? melhor[i].texto : '');
    if (textos.some(Boolean)) r = juntar(ler(textos.join('\n')), r);
  }
  return r;
}

/** histórico/boletim: texto de todas as páginas (uma passada; o PDF com texto não passa no OCR) */
export async function lerArquivos(arquivos, progresso) {
  const ps = await partes(arquivos), nf = ps.filter(p => p.foto).length || 1;
  let feitos = 0; progresso && progresso(0.05);
  const p = await passada(ps, 'cinza', () => 0, () => { feitos++; progresso && progresso(feitos / nf); });
  return p.texto;
}
