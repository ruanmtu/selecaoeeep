/* Leitura de documentos NO PRÓPRIO APARELHO (nada é enviado para fora):
 *  - PDF com texto (ex.: histórico gerado pelo SIGE): o texto sai direto do arquivo (pdf.js);
 *  - foto ou PDF escaneado: OCR em português no navegador (Tesseract), com a foto endireitada antes.
 * Rapidez: o leitor é carregado assim que a tela abre (aquecer) e, em aparelhos bons, 2 leitores trabalham juntos.
 * Sensibilidade: se faltar algum campo, lê de novo em preto e branco adaptativo; se a confiança vier muito baixa
 * (foto deitada), tenta girando 90° para cada lado. As regras de cada documento ficam em interpretar.js. */
import * as pdfjs from '../vendor/pdfjs/pdf.js';
import { cinza, limiar, orientacao, recorte, deitada } from './imagem.js?v=13';
import { interpretarIdentidade, interpretarComprovante, interpretarDocumento, interpretarNotas, pontos, PONTOS_MAX, notaNome } from './interpretar.js?v=13';
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
const TUDO = { x: 0, y: 0, w: 1, h: 1 };
/** desenha o pedaço "caixa" da foto, girado (graus anti-horários), com o lado maior = lado (ou escala k) */
function desenhar(fonte, caixa, graus, lado, kMax = 2.5) {
  const sx = caixa.x * larg(fonte), sy = caixa.y * alt(fonte), sw = caixa.w * larg(fonte), sh = caixa.h * alt(fonte);
  const k = Math.min(kMax, lado / Math.max(sw, sh)), w = Math.max(1, Math.round(sw * k)), h = Math.max(1, Math.round(sh * k)), r = -graus * Math.PI / 180;
  const W = Math.round(Math.abs(w * Math.cos(r)) + Math.abs(h * Math.sin(r))), H = Math.round(Math.abs(w * Math.sin(r)) + Math.abs(h * Math.cos(r)));
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
  x.translate(W / 2, H / 2); x.rotate(r); x.drawImage(fonte, sx, sy, sw, sh, -w / 2, -h / 2, w, h); x.setTransform(1, 0, 0, 1, 0, 0);
  return { c, x, W, H };
}
function cinzaDe(fonte, caixa, graus, lado) { const { x, W, H } = desenhar(fonte, caixa, graus, lado, 1); return { g: cinza(x.getImageData(0, 0, W, H).data, W, H), w: W, h: H }; }
/** uma vez por foto: onde está o documento e se a foto está deitada */
function analisar(p) {
  if (p.caixa) return;
  const a = cinzaDe(p.foto, TUDO, 0, 300);
  p.caixa = recorte(a.g, a.w, a.h) || TUDO;
  const b = cinzaDe(p.foto, p.caixa, 0, 700), d = deitada(b.g, b.w, b.h);
  p.giros = d.razao > 1.3 ? [-90, 90] : [0];   // deitada: as duas posições de 90°; o OCR escolhe pela confiança
  p.duvida = d.razao >= 0.85 && d.razao <= 1.3;
}
/** inclinação fina (até 20°) do documento já na posição (graus) */
function medirGiro(p, graus) { const b = cinzaDe(p.foto, p.caixa, graus, 700); return graus + orientacao(b.g, b.w, b.h); }
/** documento recortado -> canvas para o OCR (~2000 px), em cinza ou preto e branco */
function tratar(p, graus, modo) {
  const { c, x, W, H } = desenhar(p.foto, p.caixa, graus, 2000);
  const d = x.getImageData(0, 0, W, H);
  let g = cinza(d.data, W, H);
  if (modo === 'pb') g = limiar(g, W, H);
  const px = d.data; for (let i = 0, j = 0; j < g.length; i += 4, j++) { px[i] = px[i + 1] = px[i + 2] = g[j]; px[i + 3] = 255; }
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
/** lê uma foto na posição "giro" (graus) com o tratamento "modo" */
async function lerFoto(p, giro, modo) { const g = medirGiro(p, giro); const r = await ocr(tratar(p, g, modo)); r.giro = giro; return r; }
/** 1ª leitura de cada foto: recorta, decide a posição (deitada: tenta os dois lados de 90° e fica com o de maior confiança) */
async function primeira(p, passo) {
  analisar(p);
  let melhor = null;
  for (const giro of p.giros) {
    const r = await lerFoto(p, giro, 'cinza'); passo();
    if (!melhor || r.conf > melhor.conf) melhor = r;
    if (melhor.conf >= 60) break;
  }
  p.giro = melhor.giro;
  return melhor;
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
  const ps = await partes(arquivos), fotos = ps.filter(p => p.foto);
  let feitos = 0, previsto = Math.max(1, fotos.length);
  const passo = () => { feitos++; progresso && progresso(Math.min(0.97, 0.05 + 0.92 * feitos / Math.max(previsto, feitos + 1))); };
  const texto = rs => ps.map((p, i) => p.texto || (rs[i] ? rs[i].texto : '')).join('\n');

  /* 1ª: documento recortado, endireitado, na posição certa, em cinza */
  const r1 = await Promise.all(ps.map(p => p.foto ? primeira(p, passo) : null));
  let r = ler(texto(r1));
  if (pontos(tipo, r) >= PONTOS_MAX[tipo] || !fotos.length) return r;

  /* 2ª: preto e branco adaptativo (sombra, reflexo, fundo estampado) na mesma posição */
  previsto += fotos.length;
  const r2 = await Promise.all(ps.map(async p => { if (!p.foto) return null; const x = await lerFoto(p, p.giro, 'pb'); passo(); return x; }));
  r = juntar(r, ler(texto(r2)));
  if (pontos(tipo, r) >= PONTOS_MAX[tipo]) return r;

  /* 3ª: só fotos com confiança muito baixa: outras posições (90° para cada lado, 180°), fica a de maior confiança */
  const ruins = ps.map((p, i) => p.foto && Math.max(r1[i].conf, r2[i].conf) < 55 ? i : -1).filter(i => i >= 0);
  if (ruins.length) {
    const novos = {};
    for (const i of ruins) {
      const p = ps[i];
      for (const giro of [-90, 90, 180].map(g => p.giro + g).map(g => ((g + 540) % 360) - 180).filter(g => g !== p.giro)) {
        previsto++; const x = await lerFoto(p, giro, 'cinza'); passo();
        if (x.conf > Math.max(r1[i].conf, r2[i].conf) && (!novos[i] || x.conf > novos[i].conf)) novos[i] = x;
        if (novos[i] && novos[i].conf >= 60) break;
      }
    }
    if (Object.keys(novos).length) r = juntar(ler(texto(ps.map((p, i) => novos[i] || r1[i]))), r);
  }
  return r;
}

/** histórico/boletim: texto de todas as páginas (uma passada; o PDF com texto não passa no OCR) */
export async function lerArquivos(arquivos, progresso) {
  const ps = await partes(arquivos), nf = ps.filter(p => p.foto).length || 1;
  let feitos = 0; progresso && progresso(0.05);
  const rs = await Promise.all(ps.map(p => p.foto ? primeira(p, () => { feitos++; progresso && progresso(Math.min(0.97, feitos / nf)); }) : null));
  return ps.map((p, i) => p.texto || (rs[i] ? rs[i].texto : '')).join('\n');
}
