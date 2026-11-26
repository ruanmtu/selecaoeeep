/* Tela do candidato: leitura dos documentos, tabela de notas e média ao vivo */
// o "?v=" obriga o navegador a baixar a versão nova (sem ele, um leitura.js antigo guardado no cache quebrava a página toda)
import * as L from './leitura.js?v=10';
const { lerArquivos, interpretarDocumento, interpretarNotas } = L;
async function textoPdf(f) { try { return L.textoPdf ? await L.textoPdf(f) : ''; } catch (e) { return ''; } }
const $ = s => document.querySelector(s);
const num = v => { v = String(v).trim().replace(',', '.'); if (v === '' || isNaN(v)) return null; let n = parseFloat(v); if (n > 10 && n <= 100) n /= 10; return n >= 0 && n <= 10 ? n : NaN; };
const br = (v, c = 2) => v === null || isNaN(v) ? '—' : v.toFixed(c).replace('.', ',');

/* ---------- média ao vivo ---------- */
function media() {
  let soma = 0, qtd = 0; const anos = { 6: [0, 0], 7: [0, 0], 8: [0, 0], 9: [0, 0] };
  document.querySelectorAll('#t68 tbody tr').forEach(tr => {
    if (!tr.querySelector('[name="d68[]"]').value.trim()) return;
    ['6', '7', '8'].forEach((a, i) => { const inp = tr.querySelectorAll('.nota')[i], v = num(inp.value); inp.classList.toggle('erro', Number.isNaN(v)); if (v !== null && !isNaN(v)) { soma += v; qtd++; anos[a][0] += v; anos[a][1]++; } });
  });
  document.querySelectorAll('#t9 tbody tr').forEach(tr => {
    const vs = [...tr.querySelectorAll('.nota')].map(i => { const v = num(i.value); i.classList.toggle('erro', Number.isNaN(v)); return v; }).filter(v => v !== null && !isNaN(v));
    const m = vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : null;
    tr.querySelector('.m9').textContent = br(m);
    if (m !== null && tr.querySelector('[name="d9[]"]').value.trim()) { soma += m; qtd++; anos[9][0] += m; anos[9][1]++; }
  });
  $('#mGeral').textContent = qtd ? br(soma / qtd, 3) : '—';
  for (const a in anos) $('#mA' + a).textContent = anos[a][1] ? br(anos[a][0] / anos[a][1]) : '—';
  $('#mQtd').textContent = qtd;
}
document.addEventListener('input', e => { if (e.target.closest('.sl-notas')) media(); });
document.addEventListener('click', e => {
  const rm = e.target.closest('.sl-rm'); if (rm) { rm.closest('tr').remove(); media(); }
  const add = e.target.closest('[data-add]'); if (add) novaLinha(add.dataset.add, '').querySelector('input').focus();
});
function novaLinha(tab, disc) {
  const tb = document.querySelector('#' + tab + ' tbody'), mod = tb.querySelector('tr');
  const tr = mod ? mod.cloneNode(true) : null;
  tr.querySelectorAll('input').forEach(i => i.value = ''); tr.querySelector('input').value = disc;
  const m = tr.querySelector('.m9'); if (m) m.textContent = '—';
  tb.appendChild(tr); return tr;
}
media();

/* ---------- CPF ---------- */
function cpfOk(c) { c = c.replace(/\D/g, ''); if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false; for (let t = 9; t < 11; t++) { let s = 0; for (let i = 0; i < t; i++) s += +c[i] * (t + 1 - i); if (+c[t] !== ((10 * s) % 11) % 10) return false; } return true; }
const cpf = $('#cpf');
cpf.addEventListener('input', () => {
  let d = cpf.value.replace(/\D/g, '').slice(0, 11);
  cpf.value = d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4');
  cpf.classList.toggle('is-invalid', d.length === 11 && !cpfOk(d));
});
/* cota de bairro marcada sozinha */
const semAc = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ');
function conferirBairro() {
  const t = ' ' + semAc($('#bairro').value + ' ' + $('#endereco').value) + ' ';
  const ok = (window.SEL_BAIRROS || []).some(b => t.includes(' ' + semAc(b).trim() + ' '));
  if (ok) $('#cotaBairro').checked = true;
}
['bairro', 'endereco'].forEach(k => $('#' + k).addEventListener('change', conferirBairro));

/* ---------- leitura dos arquivos ---------- */
function marcar(inp, v, forcar = false) { if (!v || (!forcar && inp.value.trim())) return false; inp.value = inp.classList.contains('maiusc') ? String(v).toUpperCase() : v; inp.classList.add('sl-lido'); setTimeout(() => inp.classList.remove('sl-lido'), 2500); return true; }
function status(k, html, erro) { const s = document.querySelector(`[data-status="${k}"]`); s.hidden = !html; s.classList.toggle('erro', !!erro); s.innerHTML = html || ''; }
function barra(k, txt) { status(k, `<i class="bi bi-hourglass-split"></i><span>${txt}</span><div class="progress"><div class="progress-bar" style="width:0%"></div></div>`); return p => { const b = document.querySelector(`[data-status="${k}"] .progress-bar`); if (b) b.style.width = Math.round(p * 100) + '%'; }; }

const CAMPOS = [['nome', 'nome'], ['cpf', 'CPF'], ['nascimento', 'nascimento'], ['sexo', 'sexo'], ['mae', 'mãe'], ['pai', 'pai'], ['naturalidade', 'naturalidade'],
  ['titular', 'titular'], ['telefone', 'telefone'], ['endereco', 'endereço'], ['cep', 'CEP'], ['bairro', 'bairro'], ['cidade', 'cidade'], ['email', 'e-mail'], ['escola_origem', 'escola']];
const DO_TIPO = { doc: ['nome', 'cpf', 'nascimento', 'sexo', 'mae', 'pai', 'naturalidade'], end: ['titular', 'telefone', 'endereco', 'cep', 'bairro', 'cidade'], h68: ['email', 'escola_origem'], h9: ['email'] };
function aplicarDoc(k, r) {
  const achados = [], meus = DO_TIPO[k] || [];   // os campos da própria parte são trocados pela leitura nova
  for (const [campo, rot] of CAMPOS) {
    const inp = $('#' + campo); if (!inp || !r[campo]) continue;
    if (campo === 'cidade' && /^boa viagem$/i.test(inp.value)) inp.value = '';
    if (marcar(inp, r[campo], meus.includes(campo))) achados.push(rot);
  }
  if (r.cota_bairro) $('#cotaBairro').checked = true;
  cpf.dispatchEvent(new Event('input')); conferirBairro();
  if ($('#cidade') && !$('#cidade').value) $('#cidade').value = 'BOA VIAGEM';
  return achados;
}
function aplicarNotas(k, r) {
  const tab = k === 'h68' ? 't68' : 't9', nomeCampo = k === 'h68' ? 'd68[]' : 'd9[]';
  let n = 0;
  for (const [disc, vals] of Object.entries(r)) {
    let tr = [...document.querySelectorAll(`#${tab} tbody tr`)].find(t => semAc(t.querySelector(`[name="${nomeCampo}"]`).value).trim() === semAc(disc).trim());
    if (!tr) tr = novaLinha(tab, disc);
    tr.querySelectorAll('.nota').forEach((inp, i) => { if (vals[i] !== null && vals[i] !== undefined) { inp.value = String(vals[i]).replace('.', ','); inp.classList.add('sl-lido'); setTimeout(() => inp.classList.remove('sl-lido'), 2500); n++; } });
  }
  media();
  return [n, Object.keys(r).length];
}
/* foto grande -> JPEG de até 2000 px (envio mais rápido para a leitura automática) */
async function reduzir(f, lado = 1600) {
  if (!f.type.startsWith('image/') || (f.size < 350 * 1024 && /^image\/(jpeg|png)$/.test(f.type))) return f;   // HEIC/WEBP sempre viram JPEG (o Groq só lê JPEG/PNG)
  try {
    const bmp = await createImageBitmap(f), k = Math.min(1, lado / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const b = await new Promise(ok => c.toBlob(ok, 'image/jpeg', 0.82));
    return b ? new File([b], 'foto.jpg', { type: 'image/jpeg' }) : f;
  } catch (e) { return f; }
}
async function lerNuvem(k, arquivos) {
  const fd = new FormData(); fd.append('csrf', window.SEL_CSRF); fd.append('tipo', k);
  let n = 0;
  for (const f of [...arquivos].slice(0, 6)) {
    if (f.type === 'application/pdf' || /\.pdf$/i.test(f.name)) {
      const t = await textoPdf(f); if (t) { fd.append('texto[]', t); continue; }   // PDF com texto: manda só o texto
      /* PDF escaneado: vira fotos das páginas (todos os serviços gratuitos leem foto) */
      let fotos = []; try { fotos = L.imagensPdf ? await L.imagensPdf(f, 3, k === 'doc' ? 1600 : 2200) : []; } catch (e) {}
      if (fotos.length) { for (const p of fotos) if (n++ < 6) fd.append('arq[]', p); continue; }
    }
    if (n++ < 6) fd.append('arq[]', await reduzir(f, k === 'doc' ? 1600 : 2200));
  }
  const r = await fetch('ler.php', { method: 'POST', body: fd, credentials: 'same-origin' });
  const bruto = await r.text(); let j;
  try { j = JSON.parse(bruto); } catch (e) {   // o servidor não devolveu JSON: mostra o motivo real
    const det = bruto.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 140);
    j = { erro: r.status === 504 || r.status === 502 ? 'O servidor desistiu de esperar a leitura (erro ' + r.status + '). Tente de novo.'
      : r.status === 413 ? 'Arquivo grande demais para o servidor (erro 413). Mande uma foto menor ou o PDF.'
      : 'O servidor respondeu com erro ' + r.status + (det ? ': ' + det : ' sem detalhes') + '.' };
  }
  if (!r.ok || !j.ok) throw new Error(j.erro || 'Não foi possível ler.');
  return j;
}
function resultado(k, j, aviso = '') {
  const NOMES = { gemini: 'Gemini', groq: 'Groq' };
  const motor = NOMES[j.motor] ? ` <span class="sl-selo ok">${NOMES[j.motor]}${j.segundos ? ' · ' + String(j.segundos).replace('.', ',') + ' s' : ''}</span>` : ' <span class="sl-selo">aparelho</span>';
  const achados = aplicarDoc(k, j.dados || {});
  if (k === 'doc' || k === 'end') {
    const dup = j.dados && j.dados.cpf_duvida ? ' <b>Atenção: o CPF lido não confere, verifique.</b>' : '';
    status(k, achados.length ? `<i class="bi bi-check-circle"></i><span>Preenchido${motor}: <b>${achados.join(', ')}</b>. Confira os campos em amarelo.${dup}${aviso}</span>` : `<i class="bi bi-exclamation-triangle"></i><span>Não consegui ler os dados${motor}. Tente outra foto, bem de frente e com luz, ou digite.${aviso}</span>`, !achados.length);
  } else {
    const [n, d] = aplicarNotas(k, j.notas || {});
    const extra = achados.length ? ` Também: <b>${achados.join(', ')}</b>.` : '';
    status(k, n ? `<i class="bi bi-check-circle"></i><span><b>${n} notas</b> lidas em ${d} disciplinas${motor}.${extra} Confira com o documento antes de salvar.${aviso}</span>` : `<i class="bi bi-exclamation-triangle"></i><span>Não achei as notas nesse arquivo${motor}. Tente uma foto mais de perto, bem reta, ou digite.${aviso}</span>`, !n);
  }
}
const ultimos = {};
async function processar(k, arquivos) {
  let avisoG = ''; const repetindo = ultimos[k] === arquivos; ultimos[k] = arquivos;
  if (!arquivos.length) return;
  if (!repetindo) { const mini = document.querySelector(`[data-mini="${k}"]`); [...arquivos].forEach(f => { if (f.type.startsWith('image/')) { const i = document.createElement('img'); i.src = URL.createObjectURL(f); i.alt = ''; mini.appendChild(i); } else { const s = document.createElement('span'); s.textContent = 'PDF'; mini.appendChild(s); } }); }
  if (window.SEL_GEMINI) {
    status(k, `<span class="spinner-border spinner-border-sm"></span><span>Lendo o documento…</span>`);
    try { resultado(k, await lerNuvem(k, arquivos)); return; }
    catch (e) {   /* não preenche nada sozinho com a leitura do aparelho (ela erra muito): o usuário escolhe */
      status(k, `<i class="bi bi-exclamation-triangle"></i><span>A leitura automática falhou: ${e.message}<br><button type="button" class="btn btn-sm btn-primary mt-2 me-1" data-repetir="${k}"><i class="bi bi-arrow-repeat me-1"></i>Tentar de novo</button><button type="button" class="btn btn-sm btn-light mt-2" data-local="${k}"><i class="bi bi-phone me-1"></i>Ler neste aparelho</button></span>`, true);
      return;
    }
  }
  return lerLocal(k, arquivos, avisoG);
}
async function lerLocal(k, arquivos, avisoG = '') {
  const prog = barra(k, 'Lendo neste aparelho… na primeira vez demora um pouco mais');
  try {
    const texto = await lerArquivos(arquivos, prog);
    if (k === 'doc' || k === 'end') resultado(k, { dados: interpretarDocumento(texto, window.SEL_BAIRROS) }, avisoG || '');
    else resultado(k, { dados: interpretarDocumento(texto, []), notas: interpretarNotas(texto, k === 'h68' ? '68' : '9') }, avisoG || '');
  } catch (e) { status(k, `<i class="bi bi-x-octagon"></i><span>${e.message || 'Não foi possível ler o arquivo.'}${avisoG || ''}</span>`, true); }
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-repetir]'); if (b && ultimos[b.dataset.repetir]) processar(b.dataset.repetir, ultimos[b.dataset.repetir]);
  const l = e.target.closest('[data-local]'); if (l && ultimos[l.dataset.local]) lerLocal(l.dataset.local, ultimos[l.dataset.local]);
});
document.querySelectorAll('[data-ler]').forEach(l => {
  const inp = l.querySelector('input[type=file]');
  inp.addEventListener('change', () => { processar(l.dataset.ler, [...inp.files]); inp.value = ''; });
  l.addEventListener('dragover', e => { e.preventDefault(); l.classList.add('arrastando'); });
  l.addEventListener('dragleave', () => l.classList.remove('arrastando'));
  l.addEventListener('drop', e => { e.preventDefault(); l.classList.remove('arrastando'); processar(l.dataset.ler, e.dataTransfer.files); });
});
/* avisa se sair sem salvar */
let sujo = false; document.getElementById('fCand').addEventListener('input', () => sujo = true);
document.getElementById('fCand').addEventListener('submit', () => sujo = false);
addEventListener('beforeunload', e => { if (sujo) { e.preventDefault(); e.returnValue = ''; } });

/* nomes e endereço sempre em letra maiúscula, também quando digitados */
document.querySelectorAll('.maiusc').forEach(i => i.addEventListener('input', () => { const p = i.selectionStart; i.value = i.value.toUpperCase(); try { i.setSelectionRange(p, p); } catch (e) {} }));
