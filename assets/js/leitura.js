/* Leitura de documentos NO PRÓPRIO APARELHO (nada é enviado para fora):
 *  - PDF com texto (ex.: histórico gerado pelo SIGE): o texto sai direto do arquivo (pdf.js);
 *  - foto ou PDF escaneado: OCR em português rodando no navegador (Tesseract).
 * Depois, os textos viram campos (nome, CPF, filiação…) e notas por disciplina. */
import * as pdfjs from '../vendor/pdfjs/pdf.js';
const base = new URL('../vendor/pdfjs/', import.meta.url).href;
pdfjs.GlobalWorkerOptions.workerSrc = base + 'pdf.worker.js';

const TESS = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
let workerP = null;
function carregarScript(src) {
  return new Promise((ok, falha) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => falha(new Error('Sem internet para baixar o leitor de fotos.')); document.head.appendChild(s); });
}
async function ocrWorker(progresso) {
  if (!workerP) workerP = (async () => {
    if (!window.Tesseract) await carregarScript(TESS);
    return window.Tesseract.createWorker('por', 1, { logger: m => { if (m.status === 'recognizing text' && ocrWorker.cb) ocrWorker.cb(m.progress); } });
  })();
  ocrWorker.cb = progresso;
  return workerP;
}

/* imagem -> canvas tratado (cinza, contraste, tamanho bom para OCR) */
function preparar(fonte, w, h) {
  const k = Math.min(1, 2400 / Math.max(w, h)) * (Math.max(w, h) < 1400 ? 1.6 : 1);
  const c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
  const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(fonte, 0, 0, c.width, c.height);
  const d = x.getImageData(0, 0, c.width, c.height), p = d.data;
  let mn = 255, mx = 0; const g = new Uint8ClampedArray(p.length / 4);
  for (let i = 0, j = 0; i < p.length; i += 4, j++) { const v = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2]; g[j] = v; }
  const hist = new Array(256).fill(0); g.forEach(v => hist[v | 0]++);
  let a = 0; for (let i = 0; i < 256; i++) { a += hist[i]; if (a > g.length * 0.02) { mn = i; break; } }
  a = 0; for (let i = 255; i >= 0; i--) { a += hist[i]; if (a > g.length * 0.02) { mx = i; break; } }
  const esc = 255 / Math.max(30, mx - mn);
  for (let i = 0, j = 0; i < p.length; i += 4, j++) { const v = Math.max(0, Math.min(255, (g[j] - mn) * esc)); p[i] = p[i + 1] = p[i + 2] = v; }
  x.putImageData(d, 0, 0);
  return c;
}
async function ocr(canvas, progresso) { const w = await ocrWorker(progresso); const r = await w.recognize(canvas); return r.data.text || ''; }

async function lerPdf(arquivo, progresso) {
  const doc = await pdfjs.getDocument({ data: await arquivo.arrayBuffer(), cMapUrl: base + 'cmaps/', cMapPacked: true, standardFontDataUrl: base + 'standard_fonts/', isEvalSupported: false }).promise;
  let texto = '';
  for (let n = 1; n <= Math.min(doc.numPages, 6); n++) {
    const pg = await doc.getPage(n), tc = await pg.getTextContent();
    // junta os pedaços em linhas pela altura (y), da esquerda para a direita
    const linhas = new Map();
    tc.items.forEach(it => { if (!it.str.trim()) return; const y = Math.round(it.transform[5] / 3) * 3; (linhas.get(y) || linhas.set(y, []).get(y)).push([it.transform[4], it.str]); });
    let t = [...linhas.entries()].sort((a, b) => b[0] - a[0]).map(([, l]) => l.sort((a, b) => a[0] - b[0]).map(x => x[1]).join('  ')).join('\n');
    if (t.replace(/\s/g, '').length < 60) {   // PDF escaneado: vira imagem e passa no OCR
      const vp = pg.getViewport({ scale: 2.2 }), c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height;
      await pg.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
      t = await ocr(preparar(c, c.width, c.height), p => progresso && progresso((n - 1 + p) / Math.min(doc.numPages, 6)));
    }
    texto += t + '\n';
    progresso && progresso(n / Math.min(doc.numPages, 6));
  }
  return texto;
}
async function lerImagem(arquivo, progresso) {
  const url = URL.createObjectURL(arquivo);
  try {
    const img = new Image(); img.src = url; await img.decode();
    return await ocr(preparar(img, img.naturalWidth, img.naturalHeight), progresso);
  } finally { URL.revokeObjectURL(url); }
}
/** só o texto de um PDF (sem OCR); vazio se o PDF for escaneado */
export async function textoPdf(arquivo) {
  try {
    const doc = await pdfjs.getDocument({ data: await arquivo.arrayBuffer(), cMapUrl: base + 'cmaps/', cMapPacked: true, isEvalSupported: false }).promise;
    let t = '';
    for (let n = 1; n <= Math.min(doc.numPages, 4); n++) {
      const tc = await (await doc.getPage(n)).getTextContent(), linhas = new Map();
      tc.items.forEach(it => { if (!it.str.trim()) return; const y = Math.round(it.transform[5] / 3) * 3; (linhas.get(y) || linhas.set(y, []).get(y)).push([it.transform[4], it.str]); });
      t += [...linhas.entries()].sort((a, b) => b[0] - a[0]).map(([, l]) => l.sort((a, b) => a[0] - b[0]).map(x => x[1]).join('  ')).join('\n') + '\n';
    }
    return t.replace(/\s/g, '').length > 80 ? t : '';
  } catch (e) { return ''; }
}
/** PDF escaneado -> fotos JPEG das primeiras páginas (os serviços de IA leem foto melhor e mais rápido que PDF) */
export async function imagensPdf(arquivo, max = 3, lado = 2000) {
  const doc = await pdfjs.getDocument({ data: await arquivo.arrayBuffer(), cMapUrl: base + 'cmaps/', cMapPacked: true, standardFontDataUrl: base + 'standard_fonts/', isEvalSupported: false }).promise;
  const fotos = [];
  for (let n = 1; n <= Math.min(doc.numPages, max); n++) {
    const pg = await doc.getPage(n), v1 = pg.getViewport({ scale: 1 });
    const vp = pg.getViewport({ scale: Math.min(3, lado / Math.max(v1.width, v1.height)) });
    const c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
    await pg.render({ canvasContext: x, viewport: vp }).promise;
    const b = await new Promise(ok => c.toBlob(ok, 'image/jpeg', 0.85));
    if (b) fotos.push(new File([b], `pagina${n}.jpg`, { type: 'image/jpeg' }));
  }
  return fotos;
}
export async function lerArquivos(arquivos, progresso) {
  let tudo = '';
  const lista = [...arquivos];
  for (let i = 0; i < lista.length; i++) {
    const f = lista[i], p = x => progresso && progresso((i + x) / lista.length);
    tudo += (f.type === 'application/pdf' || /\.pdf$/i.test(f.name) ? await lerPdf(f, p) : await lerImagem(f, p)) + '\n';
  }
  return tudo;
}

/* ---------------- interpretação ---------------- */
const semAcento = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const norm = s => semAcento(s).toUpperCase().replace(/[^A-Z0-9@.\/\-: ]+/g, ' ').replace(/\s+/g, ' ').trim();
const ehNome = s => { const t = semAcento(s).replace(/[^A-Za-z ]/g, '').trim(); const p = t.split(/\s+/).filter(x => x.length > 1); return p.length >= 2 && t.length >= 7 && t.length / Math.max(1, s.trim().length) > 0.8 && !/\b(REPUBLICA|FEDERATIVA|BRASIL|ESTADO|SECRETARIA|CARTEIRA|IDENTIDADE|REGISTRO|CERTIDAO|NASCIMENTO|VALIDA|TERRITORIO|NACIONAL|ASSINATURA|DATA|EXPEDICAO|ORGAO|NATURALIDADE|CPF|FILIACAO|NOME|DOCUMENTO|POLEGAR|DIRETOR|INSTITUTO|CEARA|OFICIAL|CARTORIO|MUNICIPIO|SEXO|MASCULINO|FEMININO|NACIONALIDADE|BRASILEIR)\b/i.test(semAcento(t)); };
const limpaNome = s => s.replace(/[^A-Za-zÀ-ÿ' ]/g, ' ').replace(/\s+/g, ' ').trim();
function cpfOk(c) { c = c.replace(/\D/g, ''); if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false; for (let t = 9; t < 11; t++) { let s = 0; for (let i = 0; i < t; i++) s += +c[i] * (t + 1 - i); if (+c[t] !== ((10 * s) % 11) % 10) return false; } return true; }
const dataBr = (d, m, a) => { a = +a < 100 ? (+a > 30 ? 1900 + +a : 2000 + +a) : +a; const dt = new Date(a, m - 1, d); return dt.getDate() == d && dt.getMonth() == m - 1 ? `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` : null; };

export function interpretarDocumento(texto, bairrosCota) {
  const linhas = texto.split(/\n/).map(l => l.trim()).filter(Boolean), N = linhas.map(norm), r = {};
  // CPF (o primeiro que tiver dígitos verificadores certos)
  for (const m of texto.matchAll(/(\d{3})[.\s,]?(\d{3})[.\s,]?(\d{3})[\s.\-–,]?(\d{2})(?!\d)/g)) { const c = m.slice(1).join(''); if (cpfOk(c)) { r.cpf = `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9)}`; break; } }
  const em = texto.match(/[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/); if (em) r.email = em[0].toLowerCase();
  const tel = texto.match(/\(?\b(\d{2})\)?\s?(9\s?\d{4})[\s\-.]?(\d{4})\b/); if (tel) r.telefone = `(${tel[1]}) ${tel[2].replace(/\s/g, '')}-${tel[3]}`;
  const cep = texto.match(/\b(\d{2})\.?(\d{3})-?(\d{3})\b/); if (cep && /CEP/i.test(texto)) r.cep = `${cep[1]}${cep[2]}-${cep[3]}`;
  // data de nascimento: perto de "NASC", senão a data que dá idade de estudante (11 a 20 anos)
  const datas = [];
  N.forEach((l, i) => { for (const m of l.matchAll(/\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})\b/g)) { const d = dataBr(m[1], m[2], m[3]); if (d) datas.push([d, i, /NASC/.test(l) || /NASC/.test(N[i - 1] || '')]); } });
  const idade = d => (Date.now() - new Date(d)) / 3.156e10;
  const nasc = datas.find(x => x[2] && idade(x[0]) > 8 && idade(x[0]) < 25) || datas.find(x => idade(x[0]) > 10 && idade(x[0]) < 20);
  if (nasc) r.nascimento = nasc[0];
  // rótulos "NOME", "PAI", "MÃE", "FILIAÇÃO"
  const depois = (i, rot) => { const resto = limpaNome(linhas[i].replace(new RegExp('^.*?' + rot + '[^A-Za-zÀ-ÿ]*', 'i'), '')); if (ehNome(resto)) return resto; for (let k = i + 1; k <= i + 2 && k < linhas.length; k++) if (ehNome(linhas[k])) return limpaNome(linhas[k]); return null; };
  N.forEach((l, i) => {
    if (!r.nome && /^(NOME|NOME CIVIL|NOME SOCIAL|NOME DO ALUNO|NOME DO A ESTUDANTE|ALUNO|ESTUDANTE|CANDIDATO)\b/.test(l) && !/PAI|MAE/.test(l)) r.nome = depois(i, '(NOME( CIVIL| DO ALUNO)?|ALUNO\\(A\\)|ALUNO|ESTUDANTE|CANDIDATO\\(A\\)|CANDIDATO)');
    if (!r.pai && /^(PAI|NOME DO PAI|GENITOR)\b/.test(l)) r.pai = depois(i, '(NOME DO PAI|PAI|GENITOR)');
    if (!r.mae && /^(MAE|NOME DA MAE|GENITORA)\b/.test(l)) r.mae = depois(i, '(NOME DA M[ÃA]E|M[ÃA]E|GENITORA)');
    if (/FILIACAO/.test(l) && (!r.pai || !r.mae)) {
      const nomes = []; const resto = limpaNome(linhas[i].replace(/^.*?filia[çc][ãa]o[^A-Za-zÀ-ÿ]*/i, '')); if (ehNome(resto)) nomes.push(resto);
      for (let k = i + 1; k < Math.min(linhas.length, i + 5) && nomes.length < 2; k++) if (ehNome(linhas[k])) nomes.push(limpaNome(linhas[k]));
      if (nomes.length === 2) { r.pai = r.pai || nomes[0]; r.mae = r.mae || nomes[1]; } else if (nomes.length === 1) r.mae = r.mae || nomes[0];
    }
    if (!r.endereco && /\b(RUA|R |AV |AVENIDA|TRAVESSA|TV |SITIO|DISTRITO|LOCALIDADE|ENDERECO|FAZENDA|VILA|CONJUNTO)\b/.test(' ' + l + ' ') && !/NASC/.test(l)) r.endereco = linhas[i].replace(/^(endere[çc]o|end\.?)\s*[:\-]?\s*/i, '').trim();
    if (!r.bairro && /^BAIRRO\b/.test(l)) r.bairro = linhas[i].replace(/^bairro\s*[:\-]?\s*/i, '').split(/\s{2,}|CEP|CIDADE/i)[0].trim();
    if (!r.cidade && /\b(CIDADE|MUNICIPIO)\b/.test(l)) { const c = linhas[i].replace(/^.*?(cidade|munic[íi]pio)\s*[:\-]?\s*/i, '').split(/\s{2,}|UF|\-/)[0].trim(); if (c.length > 2) r.cidade = c; }
    if (!r.escola_origem && /\b(ESCOLA|E\.?E\.?F|EMEF|COLEGIO|E\.?M\.?E\.?F)\b/.test(l) && !/VENCESLAU|PROFISSIONAL/.test(l)) r.escola_origem = linhas[i].replace(/^.*?(escola|col[ée]gio)\b/i, m => m.match(/(escola|col[ée]gio)/i)[0]).trim();
  });
  const sx = norm(texto).match(/SEXO\s*[:\-]?\s*(F|M)\b/); if (sx) r.sexo = sx[1] === 'F' ? 'Feminino' : 'Masculino';
  if (r.nome) r.nome = titulo(r.nome); if (r.pai) r.pai = titulo(r.pai); if (r.mae) r.mae = titulo(r.mae);
  if (!r.nome) { const c = linhas.find(l => ehNome(l) && l === l.toUpperCase() && l.split(' ').length >= 3); if (c) r.nome = titulo(limpaNome(c)); }
  // bairro da cota: procura os bairros no texto inteiro
  const T = ' ' + norm(texto).replace(/[^A-Z0-9 ]/g, ' ') + ' ';
  for (const b of bairrosCota || []) { const n = ' ' + norm(b).replace(/[^A-Z0-9 ]/g, ' ') + ' '; if (T.includes(n)) { r.bairro = r.bairro || b; r.cota_bairro = true; break; } }
  return r;
}
function titulo(s) { const m = ['da', 'de', 'do', 'das', 'dos', 'e']; return s.toLowerCase().split(/\s+/).map((p, i) => i && m.includes(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)).join(' '); }

/* disciplinas do histórico: nome que aparece -> nome padronizado */
const DISC = [
  [/LINGUA PORTUGUESA|PORTUGUES|L\.? ?PORTUGUESA/, 'Língua Portuguesa'], [/MATEMATICA/, 'Matemática'], [/CIENCIAS/, 'Ciências'],
  [/EDUCACAO FISICA|ED\.? ?FISICA|E\.? ?FISICA/, 'Educação Física'], [/BIOLOGIA/, 'Biologia'], [/(?<!EDUCACAO |ED\. |ED )\bFISICA\b/, 'Física'], [/QUIMICA/, 'Química'], [/HISTORIA/, 'História'], [/GEOGRAFIA/, 'Geografia'],
  [/\bARTES?\b|ARTE E/, 'Arte'], [/INGLES|LINGUA INGLESA|L\.? ?INGLESA/, 'Língua Inglesa'],
  [/ESPANHOL|LINGUA ESPANHOLA/, 'Língua Espanhola'], [/LINGUA ESTRANGEIRA|L\.? ?E\.? ?M\.?\b/, 'Língua Estrangeira'], [/ENSINO RELIGIOSO|RELIGIAO/, 'Ensino Religioso'],
  [/REDACAO/, 'Redação'], [/FILOSOFIA/, 'Filosofia'], [/SOCIOLOGIA/, 'Sociologia'], [/PROJETO DE VIDA/, 'Projeto de Vida'], [/EMPREENDEDORISMO/, 'Empreendedorismo'],
];
function numeros(l) {
  const out = [];
  for (const m of l.matchAll(/(?<![\d\/])(\d{1,3})(?:[.,](\d{1,2}))?(?![\d\/])/g)) {
    let v = parseFloat(m[1] + (m[2] ? '.' + m[2] : ''));
    if (v > 100) continue;
    if (!m[2] && v > 10 && v % 40 === 0) continue;   // carga horária (40, 80, 120, 160 h)
    if (v > 10) v = v / 10;                          // escala de 0 a 100
    out.push(Math.round(v * 100) / 100);
  }
  return out;
}
/** modo "68": devolve {disc: [n6, n7, n8]} · modo "9": {disc: [b1, b2, b3, b4]} */
export function interpretarNotas(texto, modo) {
  const r = {};
  texto.split(/\n/).forEach(l => {
    const n = norm(l).replace(/[^A-Z0-9 .,]/g, ' ');
    const d = DISC.find(([re]) => re.test(n)); if (!d) return;
    const resto = l.replace(/^[^0-9]*?(?=\d)/, '');   // números depois do nome
    let v = numeros(resto); if (!v.length) return;
    if (modo === '68') { v = v.length >= 3 ? v.slice(-3) : v; while (v.length < 3) v.unshift(null); }
    else v = v.slice(0, 4);
    if (!r[d[1]]) r[d[1]] = v;
  });
  return r;
}
