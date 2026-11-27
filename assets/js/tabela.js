/* Leitura de TABELAS de notas (históricos escolares) — funções puras sobre pixels (navegador e testes).
 *  1) acha a grade: linhas horizontais longas (faixas) e, dentro de cada faixa, as bordas verticais (células);
 *  2) diz o que é cada célula com as palavras lidas da página (posição de cada palavra);
 *  3) as células de nota (disciplina × 6º, 7º, 8º, 9º ano) são lidas uma a uma, só com números.
 * Dois formatos de histórico:
 *  - anos nas COLUNAS (cabeçalho "1º Ano … 9º Ano"; disciplinas escritas nas linhas): sem cadastro;
 *  - anos nas LINHAS (disciplinas escritas na vertical no topo): usa o cadastro do modelo (ordem das colunas). */

/** binária (0 = preto) -> linhas horizontais: [{y0, y1, x0, x1}] (traços ≥ 25% da largura, tolerando falhas de 3 px) */
export function linhasH(b, w, h, minFrac = 0.25) {
  const cand = [];
  for (let y = 0; y < h; y++) {
    let ini = -1, fimPreto = -1, melhor = [0, 0, 0];
    for (let x = 0; x <= w; x++) {
      const preto = x < w && b[y * w + x] === 0;
      if (preto) { if (ini < 0) ini = x; fimPreto = x; }
      else if (ini >= 0 && x - fimPreto > 3) { if (fimPreto - ini > melhor[0]) melhor = [fimPreto - ini, ini, fimPreto]; ini = -1; }
    }
    if (melhor[0] >= w * minFrac) cand.push({ y, x0: melhor[1], x1: melhor[2] });
  }
  const out = [];
  for (const c of cand) {
    const u = out[out.length - 1];
    if (u && c.y - u.y1 <= 2) { u.y1 = c.y; u.x0 = Math.min(u.x0, c.x0); u.x1 = Math.max(u.x1, c.x1); }
    else out.push({ y0: c.y, y1: c.y, x0: c.x0, x1: c.x1 });
  }
  return out;
}

/** bordas verticais dentro da faixa [ya, yb]: colunas com ≥ 80% de preto na altura da faixa */
export function bordasV(b, w, h, ya, yb, x0 = 0, x1 = w - 1) {
  const m = 2, y0 = Math.max(0, ya + m), y1 = Math.min(h - 1, yb - m), alt = y1 - y0 + 1;
  if (alt < 6) return [];
  const xs = [];
  for (let x = x0; x <= x1; x++) {
    let p = 0; for (let y = y0; y <= y1; y++) if (b[y * w + x] === 0) p++;
    if (p >= alt * 0.8) xs.push(x);
  }
  const out = [];
  for (const x of xs) { const u = out[out.length - 1]; if (u && x - u[1] <= 2) u[1] = x; else out.push([x, x]); }
  return out.map(([a, z]) => (a + z) / 2);
}

/** grade: faixas entre linhas horizontais seguidas, cada uma com suas células [{x0, x1}] */
export function grade(b, w, h) {
  const L = linhasH(b, w, h);
  const faixas = [];
  for (let i = 0; i + 1 < L.length; i++) {
    const ya = L[i].y1, yb = L[i + 1].y0; if (yb - ya < 10) continue;
    const xa = Math.max(L[i].x0, L[i + 1].x0) - 3, xb = Math.min(L[i].x1, L[i + 1].x1) + 3;
    const bs = bordasV(b, w, h, ya, yb, Math.max(0, xa), Math.min(w - 1, xb));
    const cel = []; for (let k = 0; k + 1 < bs.length; k++) if (bs[k + 1] - bs[k] >= 8) cel.push({ x0: bs[k], x1: bs[k + 1] });
    faixas.push({ y0: ya, y1: yb, cel });
  }
  return faixas;
}

/* ---------- nota lida numa célula (o OCR perde a vírgula: "70" = 7,0; "885" = 8,85; "100" = 10,0) ---------- */
export function valorNota(t) {
  t = String(t || '').replace(/^[\s|\[\](){}!'"“”‘’`]+|[\s|\[\](){}!'"“”‘’`]+$/g, '').replace(/[Oo]/g, '0').replace(/[Il]/g, '1').replace(/[Ss]/g, '5').replace(/B/g, '8').trim();
  if (!t || /^[-–—_.,~=]+$/.test(t)) return null;
  const m = t.match(/(\d{1,2})\s*[.,]\s*(\d{1,2})|(\d{1,3})/); if (!m) return null;
  let v;
  if (m[1] !== undefined) v = parseFloat(m[1] + '.' + m[2]);
  else {
    const d = m[3];
    if (d.length === 1) v = +d;
    else if (d.length === 2) v = d === '10' ? 10 : +d / 10;         // "70" = 7,0 · "95" = 9,5 · "10" = 10
    else v = d === '100' ? 10 : +d / 100;                             // "885" = 8,85 · "100" = 10,0
  }
  return v >= 0 && v <= 10 ? Math.round(v * 100) / 100 : null;
}

/** apaga as linhas da tabela (traços longos) de uma imagem binária: o OCR lê muito melhor sem elas */
export function semLinhas(b, w, h) {
  const out = new Uint8ClampedArray(b), Lh = Math.round(w * 0.04), Lv = Math.round(h * 0.025);
  const apaga = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) { let ini = -1; for (let x = 0; x <= w; x++) { const p = x < w && b[y * w + x] === 0; if (p && ini < 0) ini = x; if (!p && ini >= 0) { if (x - ini >= Lh) for (let k = ini; k < x; k++) apaga[y * w + k] = 1; ini = -1; } } }
  for (let x = 0; x < w; x++) { let ini = -1; for (let y = 0; y <= h; y++) { const p = y < h && b[y * w + x] === 0; if (p && ini < 0) ini = y; if (!p && ini >= 0) { if (y - ini >= Lv) for (let k = ini; k < y; k++) apaga[k * w + x] = 1; ini = -1; } } }
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x; if (apaga[i] || apaga[i - 1] || apaga[i + 1] || apaga[i - w] || apaga[i + w]) out[i] = 255;
  }
  return out;
}

/* ======================================================================
 *  O QUE CADA CÉLULA É
 * ====================================================================== */
const sa = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
/* só as disciplinas da Base Nacional Comum (a parte diversificada varia de escola para escola) */
const DISC = [
  [/PORTUGU/, 'Língua Portuguesa'], [/MATEMAT/, 'Matemática'], [/CIENCIA/, 'Ciências'], [/HISTORIA/, 'História'], [/GEOGRAF/, 'Geografia'],
  [/EDUCACAO FISICA|ED\.? ?FISICA|EDUC\.? ?FISICA|\bFISICA\b/, 'Educação Física'], [/RELIGI/, 'Ensino Religioso'],
  [/INGLES/, 'Língua Inglesa'], [/ESPANHOL/, 'Língua Espanhola'], [/ESTRANGEIRA/, 'Língua Estrangeira'], [/\bARTES?\b/, 'Arte'],
];
const FORA = /IMERSAO|\bCCE\b|CONHECIMENTO|LITERATURA|APROFUND|PROJETO|REDACAO|ANALISE|SOCIOEMOC|AFRO|AMBIENTAL|CIDADANIA|TECNOLOGIA|RECREACAO|MUSICA|HORTICULTURA|PROGRAMA|COMPETENCIA/;
/** nome da disciplina de uma linha: olha as palavras da DIREITA para a esquerda (o componente fica à direita da área) */
export function disciplinaDaLinha(palavrasLinha) {
  const t = palavrasLinha.map(p => sa(p.t));
  if (FORA.test(t.join(' '))) return null;
  for (let k = 1; k <= Math.min(5, t.length); k++) {
    const pedaco = t.slice(-k).join(' ');
    const d = DISC.find(([re]) => re.test(pedaco)); if (d) return d[1];
  }
  return null;
}

/* modelos cadastrados com os anos nas LINHAS e as disciplinas escritas na vertical:
   ordem das colunas a partir da 1ª coluna de nota (null = coluna que não entra na média) */
export const MODELOS = [
  { id: 'diocesano', nome: 'Colégio Diocesano Valdemar Alcântara', acha: /DIOCESANO|VALDEMAR/, faixa: 0,
    colunas: ['Língua Portuguesa', 'Arte', 'Educação Física', 'História', 'Geografia', 'Ensino Religioso', 'Ciências', 'Matemática', 'Língua Inglesa'] },
  { id: 'paulo-davidson', nome: 'Instituto de Educação Paulo Davidson', acha: /PAULO DAVIDSON|DAVIDSON/, faixa: 1,   // Carga Horária / Média Final
    colunas: ['Língua Portuguesa', 'Arte', 'Educação Física', 'História', 'Geografia', null, 'Ensino Religioso', 'Matemática', 'Ciências', null, null, null, null, 'Língua Inglesa'] },
  { id: 'monsenhor-tabosa', nome: 'Prefeitura de Monsenhor Tabosa (C/H e C/N)', acha: /MONSENHOR TABOSA|TABOSA/, faixa: 1,   // C/H / C/N
    colunas: ['Língua Portuguesa', 'Arte', 'Educação Física', 'Língua Inglesa', 'História', 'Geografia', 'Ensino Religioso', 'Ciências', 'Matemática'] },
];
const ehNotaTxt = t => /^\d{1,2}[.,]\d{1,2}$/.test(t) || /^10$/.test(t);

/* faixas e colunas a partir das linhas da tabela */
function faixasDe(b, w, h) {
  const L = linhasH(b, w, h, 0.2), F = [];
  for (let i = 0; i + 1 < L.length; i++) { const ya = L[i].y1, yb = L[i + 1].y0; if (yb - ya >= h * 0.006) F.push({ y0: ya, y1: yb, x0: Math.max(L[i].x0, L[i + 1].x0), x1: Math.min(L[i].x1, L[i + 1].x1) }); }
  return F;
}
/** colunas que se repetem nas faixas dadas (votação das bordas verticais de cada faixa) */
function colunasDe(b, w, h, faixas) {
  const xs = [];
  for (const f of faixas) for (const x of bordasV(b, w, h, f.y0, f.y1, Math.max(0, f.x0 - 4), Math.min(w - 1, f.x1 + 4))) xs.push(x);
  xs.sort((a, c) => a - c);
  const grupos = [];
  for (const x of xs) { const g = grupos[grupos.length - 1]; if (g && x - g[g.length - 1] <= w * 0.005) g.push(x); else grupos.push([x]); }
  const bordas = grupos.filter(g => g.length >= Math.max(2, faixas.length * 0.3)).map(g => g[g.length >> 1]);
  let cols = []; for (let k = 0; k + 1 < bordas.length; k++) if (bordas[k + 1] - bordas[k] >= w * 0.012) cols.push({ x0: bordas[k], x1: bordas[k + 1] });
  /* borda falsa (mancha, traço de letra) parte uma coluna em duas estreitas: junta de volta */
  const lg = cols.map(c => c.x1 - c.x0).sort((a, c) => a - c), lm = lg[lg.length >> 1] || 0;
  for (let k = 0; k + 1 < cols.length; k++) {
    const a = cols[k], c = cols[k + 1], wa = a.x1 - a.x0, wc = c.x1 - c.x0;
    if (wa < lm * 0.75 && wc < lm * 0.75 && Math.abs(wa + wc - lm) <= lm * 0.3 && c.x0 - a.x1 < 3) { cols.splice(k, 2, { x0: a.x0, x1: c.x1 }); k--; }
  }
  return cols;
}
const meio = p => [(p.x0 + p.x1) / 2, (p.y0 + p.y1) / 2];
const dentro = (p, f) => { const [, y] = meio(p); return y > f.y0 && y < f.y1; };
/* caixa de uma célula, com margem pequena (o recorte depois apaga o que sobrar da borda) */
const caixa = (c, f) => { const mx = Math.max(1, Math.round((c.x1 - c.x0) * 0.03)), my = Math.max(1, Math.round((f.y1 - f.y0) * 0.06)); return { x0: Math.round(c.x0 + mx), y0: Math.round(f.y0 + my), x1: Math.round(c.x1 - mx), y1: Math.round(f.y1 - my) }; };

/**
 * Lê as notas do 6º ao 9º de um histórico.
 * b: imagem binária (0 = preto) já endireitada; palavras: [{t, x0, y0, x1, y1}] lidas da página (sem as linhas);
 * lerCelulas(caixas) -> textos lidos SÓ COM NÚMEROS em cada caixa; lerTexto(caixas) -> texto (português) de cada caixa.
 * Devolve { notas: {disciplina: [n6, n7, n8, n9]}, formato, modelo, escola, aviso }
 */
export async function lerTabela(b, w, h, palavras, lerCelulas, lerTexto) {
  const F = faixasDe(b, w, h), texto = sa(palavras.map(p => p.t).join(' '));
  const ps = palavras.filter(p => p.t && p.t.trim());
  const res = { notas: {}, formato: null, modelo: null, escola: null, aviso: null };
  const alvos = [];   // {disc, ano, caixa, palavra}
  const notaDaPalavra = (cx) => { const p = ps.find(q => { const [x, y] = meio(q); return x > cx.x0 - 3 && x < cx.x1 + 3 && y > cx.y0 - 3 && y < cx.y1 + 3 && /\d/.test(q.t); }); return p ? p.t : ''; };

  /* ---------- formato 1: anos nas COLUNAS (cabeçalho com vários "Ano") ---------- */
  const anos = ps.filter(p => /^AN[O0]S?\.?$/.test(sa(p.t)));
  let grupoAno = [];
  for (const a of anos) { const g = anos.filter(q => Math.abs(meio(q)[1] - meio(a)[1]) < h * 0.012); if (g.length > grupoAno.length) grupoAno = g; }
  const espalhado = grupoAno.length >= 5 && Math.max(...grupoAno.map(p => meio(p)[0])) - Math.min(...grupoAno.map(p => meio(p)[0])) > w * 0.3;
  if (espalhado) {
    res.formato = 'anos nas colunas';
    grupoAno.sort((p, q) => meio(p)[0] - meio(q)[0]);
    const yCab = meio(grupoAno[0])[1];
    /* linhas da tabela abaixo do cabeçalho e as colunas da grade */
    const xAno0 = grupoAno[0].x0;
    const bandas = F.filter(f => f.y0 >= yCab - h * 0.02 && f.y1 - f.y0 < h * 0.035 && bordasV(b, w, h, f.y0, f.y1, Math.max(0, f.x0 - 4), Math.min(w - 1, f.x1 + 4)).length >= 6);
    const cols = colunasDe(b, w, h, bandas.length >= 3 ? bandas : F.filter(f => f.y0 >= yCab));
    /* colunas dos anos: à direita do 1º "Ano", com a largura típica */
    let colAno = cols.filter(c => c.x1 > xAno0 + 2);
    const larg = colAno.map(c => c.x1 - c.x0).sort((x, y) => x - y), lm = larg[larg.length >> 1] || 0;
    colAno = colAno.filter(c => Math.abs(c.x1 - c.x0 - lm) <= lm * 0.35);
    if (colAno.length < 4) colAno = grupoAno.map(a => ({ x0: a.x0 - (a.x1 - a.x0) * 0.6, x1: a.x1 + (a.x1 - a.x0) * 0.6 }));
    /* nome da disciplina de cada linha: a célula logo à esquerda da coluna do 1º ano, lida sozinha (em português);
       sem esse leitor, as palavras da página */
    const colNome = cols.filter(c => c.x1 <= colAno[0].x0 + 3).pop();
    const corpo = bandas.filter(f => f.y0 > yCab);
    let nomes;
    if (lerTexto && colNome) nomes = (await lerTexto(corpo.map(f => caixa(colNome, f)))).map(t => String(t).split(/\s+/).map(x => ({ t: x })));
    else nomes = corpo.map(f => ps.filter(p => dentro(p, f) && meio(p)[0] < xAno0).sort((p, q) => p.x0 - q.x0));
    const linhas = [];
    corpo.forEach((f, i) => { const d = disciplinaDaLinha(nomes[i]); if (d && !linhas.some(l => l.d === d)) linhas.push({ d, f }); });
    if (!linhas.length) { res.aviso = 'Não achei as linhas das disciplinas.'; return res; }
    /* número do ano escrito no cabeçalho de cada coluna (lido só com números) para conferir a ordem */
    const fCab = F.find(f => yCab > f.y0 && yCab < f.y1) || { y0: grupoAno[0].y0 - (grupoAno[0].y1 - grupoAno[0].y0) * 2, y1: grupoAno[0].y1 };
    const dig = await lerCelulas(colAno.map(c => caixa(c, { y0: fCab.y0, y1: Math.min(fCab.y1, grupoAno[0].y0 + 2) })));
    let num = dig.map(t => { const m = String(t).match(/[1-9]/); return m ? +m[0] : null; });
    const certos = num.filter((n, i) => n === i + 1 + (num.length === 9 ? 0 : 9 - num.length)).length;
    if (num.some(n => n === null) || certos < num.length * 0.6) num = colAno.map((_, i) => i + 1 + Math.max(0, 9 - colAno.length));   // pela ordem, terminando no 9º
    for (const { d, f } of linhas) num.forEach((ano, i) => { if (ano >= 6 && ano <= 9) alvos.push({ disc: d, ano, cx: caixa(colAno[i], f) }); });
    /* escola: rótulo ESCOLA ou ESTABELECIMENTO no cabeçalho */
    res.escola = escolaDoTexto(palavras, null);
  } else {
    /* ---------- formato 2: anos nas LINHAS (disciplinas na vertical): precisa do cadastro do modelo ---------- */
    res.formato = 'anos nas linhas';
    const modelo = MODELOS.find(m => m.acha.test(texto));
    if (!modelo) { res.aviso = 'Modelo de histórico ainda não cadastrado (anos nas linhas). Digite as notas e mande uma foto deste modelo para cadastrar.'; return res; }
    res.modelo = modelo.nome;
    /* faixas com muitas células (≥ 8) e baixas: linhas da tabela de notas. Faixas coladas formam o bloco de um ano
       (C/H + C/N, Carga Horária + Média Final); o cadastro diz qual delas tem a nota. Blocos de cima para baixo = 1º, 2º… */
    const muitas = F.filter(f => f.y1 - f.y0 < h * 0.025 && bordasV(b, w, h, f.y0, f.y1, Math.max(0, f.x0 - 4), Math.min(w - 1, f.x1 + 4)).length >= 9);
    const blocos = [];
    for (const f of muitas) { const u = blocos[blocos.length - 1]; if (u && f.y0 - u[u.length - 1].y1 <= h * 0.004) u.push(f); else blocos.push([f]); }
    const fx = blocos.map(bl => bl[Math.min(modelo.faixa || 0, bl.length - 1)]);
    if (fx.length < 6) { res.aviso = 'Não achei as linhas de notas da tabela.'; return res; }
    /* bordas das colunas medidas no bloco inteiro de cada ano (a borda de verdade atravessa C/H e C/N;
       o traço do "1" de um "10" não), só nos blocos do tamanho mais comum */
    const span = blocos.map(bl => ({ y0: bl[0].y0, y1: bl[bl.length - 1].y1, x0: Math.max(...bl.map(f => f.x0)), x1: Math.min(...bl.map(f => f.x1)) }));
    const cols = colunasDe(b, w, h, span);
    /* 1ª coluna de nota: a primeira com a largura típica (a coluna do rótulo do ano, à esquerda, é mais larga) */
    const larg = cols.map(c => c.x1 - c.x0).sort((x, y) => x - y), lm = larg[larg.length >> 1];
    const normal = c => c && Math.abs(c.x1 - c.x0 - lm) <= lm * 0.25;
    const i0 = cols.findIndex((c, i) => normal(c) && normal(cols[i + 1]) && normal(cols[i + 2]));
    if (i0 < 0) { res.aviso = 'Não achei as colunas de notas.'; return res; }
    /* ano de cada bloco pelo ANO LETIVO escrito nele ("Ano: 2016", "2017" no rótulo à esquerda): a leitura da página
       lê bem esses números. O bloco de menor ano letivo é o 1º ano; os seguintes, 2º, 3º… Blocos sem ano letivo por
       perto (cabeçalho) ficam de fora; um ano letivo não lido é completado pela sequência dos vizinhos. */
    const xLimite = (cols[i0 + 3] || cols[cols.length - 1]).x0;
    const letivos = ps.map(p => ({ p, v: +String(p.t).replace(/\D/g, '') })).filter(({ p, v }) => v >= 2000 && v <= 2040 && String(p.t).replace(/\D/g, '').length === 4 && meio(p)[0] < xLimite);
    /* cada ano letivo pertence ao último bloco que começa ACIMA dele (fica no rótulo do bloco ou logo abaixo das notas) */
    const anoLet = span.map(() => null);
    for (const { p, v } of letivos) {
      const y = meio(p)[1]; let k = -1;
      span.forEach((sp, j) => { if (sp.y0 - (sp.y1 - sp.y0) * 0.3 <= y) k = j; });
      if (k >= 0 && y <= span[k].y1 + (span[k].y1 - span[k].y0) * 3 && anoLet[k] === null) anoLet[k] = v;
    }
    /* descarta leituras que não batem com a sequência (cada bloco = ano seguinte) e completa as que faltam */
    const votos = {}; anoLet.forEach((v, k) => { if (v) votos[v - k] = (votos[v - k] || 0) + 1; });
    const base0 = Object.entries(votos).sort((x, y) => y[1] - x[1])[0];
    let anosB;
    if (base0 && base0[1] >= 3) {
      const b0 = +base0[0];   // ano letivo do bloco 0
      const temAno = anoLet.map((v, k) => v === b0 + k);
      let primeiro = temAno.indexOf(true); const ultimo = temAno.lastIndexOf(true);
      /* o fundamental tem 9 anos: se a sequência confirmada é menor, o bloco logo antes (com nota) também é ano */
      while (Math.max(ultimo, primeiro + 8) - primeiro + 1 > 0 && ultimo - primeiro + 1 < 9 && primeiro > 0) {
        const ant = await lerCelulas([0, 1, 2].map(j => caixa(cols[i0 + j] || cols[i0], fx[primeiro - 1])));
        if (ant.some(t => valorNota(t) !== null)) primeiro--; else break;
      }
      anosB = fx.map((_, k) => k >= primeiro && k - primeiro < 9 ? k - primeiro + 1 : null);
    } else {
      /* reserva: lê as 3 primeiras células de cada bloco; o 1º bloco com nota é o 1º ano */
      const tres = await lerCelulas(fx.flatMap(f => [0, 1, 2].map(j => caixa(cols[i0 + j] || cols[i0], f))));
      const formaNota = t => { t = String(t).replace(/[^0-9.,]/g, '').replace(/[.,]$/, ''); return /^(\d{1,2}[.,]\d{1,2}|10|[1-9]\d|100)$/.test(t) && valorNota(t) !== null; };
      const comNota = fx.map((_, k) => tres.slice(k * 3, k * 3 + 3).filter(formaNota).length >= 2);
      const ini = comNota.indexOf(true);
      anosB = fx.map((_, k) => ini >= 0 && k >= ini && k - ini < 9 ? k - ini + 1 : null);
    }
    const rot = anoLet;
    if (globalThis.DEPURA) console.log('blocos', blocos.map(bl => bl.map(f => f.y0 + '-' + f.y1).join('+')).join(' | '), '\nletivos', letivos.map(l => l.v + '@' + Math.round(meio(l.p)[1])).join(' '));
    if (globalThis.DEPURA) console.log('rótulos', rot, '→', anosB, '\ncols', cols.map(c => Math.round(c.x0) + '-' + Math.round(c.x1)).join(' '), 'i0', i0);
    const ordem = fx;
    ordem.forEach((f, k) => {
      const ano = anosB[k]; if (!ano || ano < 6 || ano > 9 || anosB.indexOf(ano) !== k) return;
      modelo.colunas.forEach((d, j) => { const c = cols[i0 + j]; if (d && c) alvos.push({ disc: d, ano, cx: caixa(c, f) }); });
    });
    res.escola = escolaDoTexto(palavras, ordem[Math.min(8, ordem.length - 1)]);
  }

  /* ---------- lê as células (só números) ---------- */
  res.celulas = alvos;   // (para conferência e testes)
  const textos = await lerCelulas(alvos.map(a => a.cx));
  alvos.forEach((a, i) => {
    let v = valorNota(textos[i]);
    if (v === null) v = valorNota(notaDaPalavra(a.cx));   // reserva: o que a leitura da página viu nessa célula
    (res.notas[a.disc] ??= [null, null, null, null])[a.ano - 6] = v;
  });
  for (const d in res.notas) if (res.notas[d].every(v => v === null)) delete res.notas[d];
  return res;
}

/** escola de origem: a instituição da última linha de notas (anos nas linhas) ou o rótulo ESCOLA/ESTABELECIMENTO */
function escolaDoTexto(palavras, faixa) {
  const linhas = [];
  for (const p of palavras.filter(q => q.t && q.t.trim()).sort((a, c) => meio(a)[1] - meio(c)[1])) {
    const l = linhas.find(x => Math.abs(x.y - meio(p)[1]) < (p.y1 - p.y0) * 0.7); if (l) l.p.push(p); else linhas.push({ y: meio(p)[1], p: [p] });
  }
  const txt = l => l.p.sort((a, c) => a.x0 - c.x0).map(p => p.t).join(' ');
  const ESC = /\b(E\.?E\.?F\.?(TI)?|EMEIF(TI)?|EEFTI|EEEP|ESCOLA|COL[EÉ]GIO|INSTITUTO)\b/i;
  const limpa = s => s.replace(/^.*?\b(institui[çc][ãa]o|escola|estabelecimento( de ensino)?)\s*[:\-!”"]+\s*/i, '').replace(/\s*\b(C[OÓ]DI?G?O|INEP|CNPJ|EMAIL|E-MAIL)\b.*$/i, '').replace(/\b(estabelecimento|institui[çc][ãa]o de ensino|resultado|cidade|estado|aprovad[oa]\(?a?\)?)\b.*$/i, '').replace(/[|\[\]]/g, ' ').replace(/\s+/g, ' ').trim();
  if (faixa) {
    const cand = linhas.filter(l => l.y > faixa.y1 && l.y < faixa.y1 + (faixa.y1 - faixa.y0) * 4 && ESC.test(txt(l)));
    if (cand.length) return limpa(txt(cand[0])).toUpperCase();
  }
  const rot = linhas.find(l => /\b(ESCOLA|ESTABELECIMENTO)\b\s*(DE ENSINO)?\s*[:\-]?/i.test(txt(l)) && ESC.test(txt(l).replace(/^\s*ESCOLA\s*:/i, '')));
  if (rot) return limpa(txt(rot)).toUpperCase();
  const tit = linhas.find(l => ESC.test(txt(l)));
  return tit ? limpa(txt(tit)).toUpperCase() : null;
}

/** recorte de uma célula para o OCR: apaga restos de borda (colunas/linhas da beirada quase todas escuras),
 *  estica o contraste e põe uma moldura branca. g = cinza da página. Devolve {d: Uint8ClampedArray, w, h}. */
export function recortarCelula(g, W, H, cx) {
  const x0 = Math.max(0, cx.x0), y0 = Math.max(0, cx.y0), x1 = Math.min(W, cx.x1), y1 = Math.min(H, cx.y1);
  const w = Math.max(1, x1 - x0), h = Math.max(1, y1 - y0), c = new Uint8ClampedArray(w * h);
  let mn = 255, mx = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = g[(y0 + y) * W + x0 + x]; c[y * w + x] = v; if (v < mn) mn = v; if (v > mx) mx = v; }
  const lim = (mn + mx) / 2, esc = (x, y) => c[y * w + x] < lim;
  /* bordas: da beirada para dentro (até 18%), coluna/linha com ≥ 70% escuro é linha da tabela */
  for (let x = 0; x < Math.max(1, w * 0.18); x++) { let e = 0; for (let y = 0; y < h; y++) if (esc(x, y)) e++; if (e >= h * 0.7) for (let y = 0; y < h; y++) c[y * w + x] = 255; else break; }
  for (let x = w - 1; x > w * 0.82; x--) { let e = 0; for (let y = 0; y < h; y++) if (esc(x, y)) e++; if (e >= h * 0.7) for (let y = 0; y < h; y++) c[y * w + x] = 255; else break; }
  for (let y = 0; y < Math.max(1, h * 0.25); y++) { let e = 0; for (let x = 0; x < w; x++) if (esc(x, y)) e++; if (e >= w * 0.6) for (let x = 0; x < w; x++) c[y * w + x] = 255; else break; }
  for (let y = h - 1; y > h * 0.75; y--) { let e = 0; for (let x = 0; x < w; x++) if (esc(x, y)) e++; if (e >= w * 0.6) for (let x = 0; x < w; x++) c[y * w + x] = 255; else break; }
  /* contraste dentro da célula e moldura branca */
  const k = 255 / Math.max(40, mx - mn), p = Math.round(h * 0.35), ow = w + 2 * p, oh = h + 2 * p, d = new Uint8ClampedArray(ow * oh).fill(255);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) d[(y + p) * ow + x + p] = (c[y * w + x] - mn) * k;
  return { d, w: ow, h: oh };
}

