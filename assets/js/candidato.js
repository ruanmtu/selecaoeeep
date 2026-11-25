/* Tela do candidato: leitura dos documentos, tabela de notas e média ao vivo */
import { lerArquivos, interpretarDocumento, interpretarNotas } from './leitura.js';
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
function marcar(inp, v) { if (!v || inp.value.trim()) return false; inp.value = v; inp.classList.add('sl-lido'); setTimeout(() => inp.classList.remove('sl-lido'), 2500); return true; }
function status(k, html, erro) { const s = document.querySelector(`[data-status="${k}"]`); s.hidden = !html; s.classList.toggle('erro', !!erro); s.innerHTML = html || ''; }
function barra(k, txt) { status(k, `<i class="bi bi-hourglass-split"></i><span>${txt}</span><div class="progress"><div class="progress-bar" style="width:0%"></div></div>`); return p => { const b = document.querySelector(`[data-status="${k}"] .progress-bar`); if (b) b.style.width = Math.round(p * 100) + '%'; }; }

async function processar(k, arquivos) {
  if (!arquivos.length) return;
  if (k === 'doc') { const mini = document.querySelector('[data-mini="doc"]'); [...arquivos].forEach(f => { if (f.type.startsWith('image/')) { const i = document.createElement('img'); i.src = URL.createObjectURL(f); i.alt = ''; mini.appendChild(i); } else { const s = document.createElement('span'); s.textContent = 'PDF'; mini.appendChild(s); } }); }
  const prog = barra(k, 'Lendo… na primeira vez demora um pouco mais');
  try {
    const texto = await lerArquivos(arquivos, prog);
    if (k === 'doc') {
      const r = interpretarDocumento(texto, window.SEL_BAIRROS), achados = [];
      for (const [campo, rot] of [['nome', 'nome'], ['cpf', 'CPF'], ['nascimento', 'nascimento'], ['mae', 'mãe'], ['pai', 'pai'], ['email', 'e-mail'], ['telefone', 'telefone'], ['endereco', 'endereço'], ['bairro', 'bairro'], ['cidade', 'cidade'], ['escola_origem', 'escola']]) {
        const inp = $('#' + campo); if (inp && r[campo] && (campo !== 'cidade' || r[campo] !== inp.value) && marcar(inp, r[campo])) achados.push(rot);
      }
      if (r.cota_bairro) $('#cotaBairro').checked = true;
      cpf.dispatchEvent(new Event('input')); conferirBairro();
      status(k, achados.length ? `<i class="bi bi-check-circle"></i><span>Preenchido: <b>${achados.join(', ')}</b>. Confira os campos em amarelo.</span>` : `<i class="bi bi-exclamation-triangle"></i><span>Não consegui ler os dados. Tente outra foto, bem de frente e com luz, ou digite.</span>`, !achados.length);
    } else {
      const r = interpretarNotas(texto, k === 'h68' ? '68' : '9'), tab = k === 'h68' ? 't68' : 't9', nomeCampo = k === 'h68' ? 'd68[]' : 'd9[]';
      let n = 0;
      for (const [disc, vals] of Object.entries(r)) {
        let tr = [...document.querySelectorAll(`#${tab} tbody tr`)].find(t => semAc(t.querySelector(`[name="${nomeCampo}"]`).value).trim() === semAc(disc).trim());
        if (!tr) tr = novaLinha(tab, disc);
        tr.querySelectorAll('.nota').forEach((inp, i) => { if (vals[i] !== null && vals[i] !== undefined) { inp.value = String(vals[i]).replace('.', ','); inp.classList.add('sl-lido'); setTimeout(() => inp.classList.remove('sl-lido'), 2500); n++; } });
      }
      media();
      status(k, n ? `<i class="bi bi-check-circle"></i><span><b>${n} notas</b> lidas em ${Object.keys(r).length} disciplinas. Confira com o documento antes de salvar.</span>` : `<i class="bi bi-exclamation-triangle"></i><span>Não achei as notas nessa imagem. Tente uma foto mais de perto, bem reta, ou digite.</span>`, !n);
    }
  } catch (e) { status(k, `<i class="bi bi-x-octagon"></i><span>${e.message || 'Não foi possível ler o arquivo.'}</span>`, true); }
}
document.querySelectorAll('[data-ler]').forEach(l => {
  const inp = l.querySelector('input[type=file]');
  inp.addEventListener('change', () => { processar(l.dataset.ler, inp.files); inp.value = ''; });
  l.addEventListener('dragover', e => { e.preventDefault(); l.classList.add('arrastando'); });
  l.addEventListener('dragleave', () => l.classList.remove('arrastando'));
  l.addEventListener('drop', e => { e.preventDefault(); l.classList.remove('arrastando'); processar(l.dataset.ler, e.dataTransfer.files); });
});
/* avisa se sair sem salvar */
let sujo = false; document.getElementById('fCand').addEventListener('input', () => sujo = true);
document.getElementById('fCand').addEventListener('submit', () => sujo = false);
addEventListener('beforeunload', e => { if (sujo) { e.preventDefault(); e.returnValue = ''; } });
