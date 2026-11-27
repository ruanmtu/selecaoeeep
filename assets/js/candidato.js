/* Tela do candidato: leitura dos documentos, tabela de notas e média ao vivo */
// o "?v=" obriga o navegador a baixar a versão nova (sem ele, um leitura.js antigo guardado no cache quebrava a página toda)
import * as L from './leitura.js?v=16';
const { lerArquivos, lerDocumento, interpretarDocumento, interpretarNotas } = L;
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
  document.querySelectorAll('#t9 tbody tr').forEach(tr => {   // 9º ano: uma média por disciplina
    const inp = tr.querySelector('.nota'), m = num(inp.value); inp.classList.toggle('erro', Number.isNaN(m));
    if (m !== null && !isNaN(m) && tr.querySelector('[name="d9[]"]').value.trim()) { soma += m; qtd++; anos[9][0] += m; anos[9][1]++; }
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
function resultado(k, j) {
  const motor = ` <span class="sl-selo">aparelho${j.segundos ? ' · ' + String(j.segundos).replace('.', ',') + ' s' : ''}</span>`;
  const achados = aplicarDoc(k, j.dados || {});
  if (k === 'doc' || k === 'end') {
    const dup = j.dados && j.dados.cpf_duvida ? ' <b>Atenção: o CPF lido não confere, verifique.</b>' : '';
    const cota = k === 'end' && j.dados && j.dados.cota_bairro ? ' <b>Bairro da cota marcado.</b>' : '';
    status(k, achados.length ? `<i class="bi bi-check-circle"></i><span>Preenchido${motor}: <b>${achados.join(', ')}</b>. Confira os campos em amarelo.${dup}${cota}</span>` : `<i class="bi bi-exclamation-triangle"></i><span>Não consegui ler os dados${motor}. Tente outra foto, bem de frente, com luz e sem reflexo, ou digite.</span>`, !achados.length);
  } else {
    const [n, d] = aplicarNotas(k, j.notas || {});
    const extra = achados.length ? ` Também: <b>${achados.join(', ')}</b>.` : '';
    if (k === 'h9' && j.decl !== undefined) {
      status(k, `<i class="bi bi-${n ? 'check-circle' : 'pencil'}"></i><span>${n ? `<b>${n} médias</b> lidas com segurança${motor}. ` : `Declaração preenchida à caneta${motor}: `}${n ? 'Digite as outras olhando a foto e confira tudo antes de salvar.' : 'digite as médias olhando a foto (a caligrafia não deu para ler com segurança).'}${j.aviso ? ' ' + j.aviso : ''}</span>`, false);
      return;
    }
    const nove = j.extra9 ? ` O 9º ano (média do histórico) foi para a parte 4.` : '';
    status(k, n || j.extra9 ? `<i class="bi bi-check-circle"></i><span><b>${n} notas</b> lidas em ${d} disciplinas${motor}.${extra}${nove} Confira com o documento antes de salvar.</span>` : `<i class="bi bi-exclamation-triangle"></i><span>${j.aviso || 'Não achei as notas nesse arquivo.'}${motor} Tente uma foto mais de perto, bem reta, ou digite.</span>`, !n && !j.extra9);
  }
}
const ultimos = {};
async function processar(k, arquivos) {
  const repetindo = ultimos[k] === arquivos; ultimos[k] = arquivos;
  if (!arquivos.length) return;
  if (!repetindo) { const mini = document.querySelector(`[data-mini="${k}"]`); [...arquivos].forEach(f => { if (f.type.startsWith('image/')) { const i = document.createElement('img'); i.src = URL.createObjectURL(f); i.alt = ''; mini.appendChild(i); } else { const s = document.createElement('span'); s.textContent = 'PDF'; mini.appendChild(s); } }); }
  const prog = barra(k, 'Lendo neste aparelho…');
  const t0 = performance.now();
  try {
    let j;
    if (k === 'doc' || k === 'end') j = { dados: await lerDocumento(arquivos, k, window.SEL_BAIRROS, prog) };
    else if (k === 'h68' && ![...arquivos].some(f => /pdf/i.test(f.type || f.name)) && L.lerHistorico) {
      /* histórico em foto: lê a tabela célula por célula; 6º-8º vão para esta parte e o 9º para a parte 4 */
      const r = await L.lerHistorico(arquivos, prog);
      const n68 = {}, n9 = {};
      for (const [d, v] of Object.entries((r && r.notas) || {})) { if (v.slice(0, 3).some(x => x !== null)) n68[d] = v.slice(0, 3); if (v[3] !== null) n9[d] = [v[3]]; }
      const [q9] = Object.keys(n9).length ? aplicarNotas('h9', n9) : [0];
      j = { dados: r && r.escola ? { escola_origem: r.escola } : {}, notas: n68, extra9: q9, aviso: r && r.aviso };
    }
    else if (k === 'h9' && ![...arquivos].some(f => /pdf/i.test(f.type || f.name)) && L.lerDeclaracao9) {
      /* declaração do 9º ano (média à caneta): só preenche o que três leituras confirmam */
      const r = await L.lerDeclaracao9(arquivos, prog);
      const n9 = {}; for (const [d, v] of Object.entries((r && r.notas) || {})) n9[d] = [v];
      j = { dados: {}, notas: n9, aviso: r && r.aviso, decl: r && r.disciplinas };
    }
    else { const texto = await lerArquivos(arquivos, prog); const d = interpretarDocumento(texto, []), dados = {}; for (const c of ['email', 'telefone', 'escola_origem']) if (d[c]) dados[c] = d[c];   // do histórico só vêm contato e escola
      const nt = interpretarNotas(texto, k === 'h68' ? '68' : '9');
      if (k === 'h9') for (const d in nt) { const vs = nt[d].filter(x => x !== null); nt[d] = vs.length ? [Math.round(vs.reduce((a, b) => a + b, 0) / vs.length * 100) / 100] : []; }
      j = { dados, notas: nt }; }
    j.segundos = Math.round((performance.now() - t0) / 100) / 10;
    resultado(k, j);
  } catch (e) {
    status(k, `<i class="bi bi-x-octagon"></i><span>${e.message || 'Não foi possível ler o arquivo.'}<br><button type="button" class="btn btn-sm btn-light mt-2" data-repetir="${k}"><i class="bi bi-arrow-repeat me-1"></i>Tentar de novo</button></span>`, true);
  }
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-repetir]'); if (b && ultimos[b.dataset.repetir]) processar(b.dataset.repetir, ultimos[b.dataset.repetir]);
});
/* carrega o leitor enquanto o professor ainda está tirando a foto (a primeira leitura fica bem mais rápida) */
setTimeout(() => { try { L.aquecer && L.aquecer(); } catch (e) {} }, 600);
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
