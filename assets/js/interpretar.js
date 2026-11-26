/* Regras de leitura: texto do OCR -> campos do formulário.
 * Sem dependências (roda no navegador e nos testes). Modelos conhecidos:
 *  - RG antigo (verso): REGISTRO GERAL, NOME, FILIAÇÃO, NATURALIDADE, DATA DE NASCIMENTO, DOC. ORIGEM, CPF
 *  - CIN (carteira nova): rótulos bilíngues "Nome / Name", "Sexo / Sex"… e a zona MRZ (IDBRA…) no verso
 *  - certidão de nascimento: NOME, PAI, MÃE, SEXO, DATA DE NASCIMENTO
 *  - comprovante de residência (Enel, Cagece, internet, declaração): titular, endereço, bairro, CEP e cidade
 *    do CLIENTE, ignorando o endereço da própria empresa. */

export const semAcento = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
export const norm = s => semAcento(s).toUpperCase().replace(/[^A-Z0-9@.\/\-:,|<]+/g, ' ').replace(/\s+/g, ' ').trim();
const so = s => norm(s).replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

/* ---------- números lidos errado pelo OCR: O→0, I/l→1, S→5, B→8… (só em pedaços que já são quase só números) ---------- */
const DIG = { O: '0', o: '0', Q: '0', D: '0', U: '0', I: '1', l: '1', '|': '1', i: '1', L: '1', '!': '1', Z: '2', z: '2', S: '5', s: '5', B: '8', G: '6', b: '6', g: '9', q: '9', T: '7' };
export function consertaNumeros(l) {
  return String(l).replace(/[0-9OoQDUIl|iL!ZzSsBGbgqT][0-9OoQDUIl|iL!ZzSsBGbgqT.,\-\/ ]{3,}[0-9OoQDUIl|iL!ZzSsBGbgqT]/g, t => {
    return t.split(/(\s+)/).map(p => {
      const d = (p.match(/\d/g) || []).length, a = (p.match(/[A-Za-z|!]/g) || []).length;
      return d >= 2 && d >= a * 2 ? p.replace(/[OoQDUIl|iL!ZzSsBGbgqT]/g, c => DIG[c]) : p;
    }).join('');
  });
}

export function cpfOk(c) { c = String(c).replace(/\D/g, ''); if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false; for (let t = 9; t < 11; t++) { let s = 0; for (let i = 0; i < t; i++) s += +c[i] * (t + 1 - i); if (+c[t] !== ((10 * s) % 11) % 10) return false; } return true; }
const cpfFmt = c => `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9)}`;
const dataIso = (d, m, a) => { a = +a < 100 ? (+a > new Date().getFullYear() % 100 ? 1900 + +a : 2000 + +a) : +a; const dt = new Date(a, m - 1, d); return a > 1900 && dt.getDate() == d && dt.getMonth() == m - 1 ? `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` : null; };
const idade = iso => (Date.now() - new Date(iso + 'T12:00:00')) / 3.156e10;
export function titulo(s) { const m = ['da', 'de', 'do', 'das', 'dos', 'e']; return s.toLowerCase().split(/\s+/).map((p, i) => i && m.includes(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)).join(' '); }

/* ---------- nomes de pessoa ---------- */
const NAO_NOME = /\b(GOVERNO|FEDERAL|MINISTERIO|GESTAO|INOVACAO|PUBLICOS|POLICIA|CIVIL|PERICIA|PERITO|IDENTIFICACAO|GOV|VALIDACAO|ASSINADO|DIGITALMENTE|ELETRONICO|DIGITAL|VERSAO|DETRAN|SSP|SSPDS|SUPERINTENDENCIA|COORDENADORIA|DEPARTAMENTO|REPUBLICA|FEDERATIVA|ESTADO|SECRETARIA|SEGURANCA|PUBLICA|CARTEIRA|IDENTIDADE|IDENTITY|REGISTRO|GERAL|CERTIDAO|VALIDA|VALIDADE|TERRITORIO|NACIONAL|ASSINATURA|SIGNATURE|DATA|DATE|EXPEDICAO|EXPEDIDOR|EMISSAO|ORGAO|NATURALIDADE|CPF|FILIACAO|FILIATION|NOME|NAME|SOCIAL|DOCUMENTO|ORIGEM|POLEGAR|DIRETOR|DIRETORA|INSTITUTO|CEARA|OFICIAL|CARTORIO|MUNICIPIO|SEXO|SEX|MASCULINO|FEMININO|NACIONALIDADE|NATIONALITY|BRASILEIR\w*|PLACE|BIRTH|EXPIRY|PERSONAL|NUMBER|LOCAL|TITULAR|PORTADOR|LEI|DECRETO|VIA|REGISTRADOR|LIVRO|FOLHA|TERMO|MATRICULA|AVERBACOES|OBSERVACOES|CONTA|FATURA|VENCIMENTO|TOTAL|PAGAR|ENEL|CAGECE|CLIENTE|CONSUMIDOR|ENDERECO|RUA|AVENIDA|BAIRRO|CIDADE|CEP|LEITURA|CONSUMO|RESIDENCIAL|CLASSE|INSTALACAO|UNIDADE|MEDIDOR|DISTRIBUICAO|ENERGIA|AGUA|ESGOTO|TARIFA|REFERENCIA|EMITIDA|COMPANHIA|SERVICOS?|INTERNET|TELEFONE|PROTOCOLO|AUTENTICACAO|CODIGO|BARRAS|DECLARACAO|RESIDENCIA|DECLARO|PORTADOR|PORTADORA)\b/;
/* primeiros nomes comuns (ajudam a separar um nome de pessoa de um rótulo lido com erro) */
const PRENOMES = new Set('MARIA JOSE JOAO ANA ANTONIO ANTONIA FRANCISCO FRANCISCA RAIMUNDO RAIMUNDA LUIZ LUIS PAULO PAULA CARLOS CARLA MANOEL MANUEL PEDRO LUCAS GABRIEL GABRIELA RAFAEL RAFAELA DANIEL DANIELA MARCOS MARCO MARCELO MARCIA MATEUS MATHEUS LEONARDO JULIA JULIANA FERNANDO FERNANDA RICARDO RITA RITA SEBASTIAO SEBASTIANA GERALDO GERALDA JORGE ROBERTO ROBERTA EDUARDO EDUARDA SANDRA SONIA SIMONE PATRICIA ALINE AMANDA BRUNA BRUNO CAMILA CICERO CICERA DAVI DAVID EMANUEL EMANUELLE ENZO ERICK FABIO FABIANA FELIPE FRANCINALDO GUSTAVO HELENA IGOR ISABEL ISABELA ISABELLE IVONE JEFFERSON JESSICA JOANA JOSEFA JOSIAS KAUAN KAUA LARA LARISSA LETICIA LIVIA LORENA LUANA LUCIA LUCIANA LUCIANO MARIANA MIGUEL NATALIA NICOLAS OTAVIO PABLO PRISCILA RAQUEL REGINA RENATA RODRIGO ROSA ROSANA SAMUEL SARA SARAH TATIANA TERESA THIAGO TIAGO VALDIR VALERIA VANESSA VERA VICTOR VITOR VITORIA WELLINGTON WESLEY YASMIN ALICE ALEXANDRE ADRIANA ADRIANO AGNALDO ANDRE ANDREA ANTONIEL ARTHUR ARTUR BEATRIZ BENEDITO BENEDITA CLAUDIA CLAUDIO CRISTIANE CRISTINA DEBORA DENISE DIEGO EDSON ELIANE ELISANGELA ERIVALDO EVANDRO FATIMA FLAVIA FLAVIO FRANCIMAR GILVAN HELIO HEITOR IRACEMA IRENE IVAN JAQUELINE JANAINA JOAQUIM JULIO KARINA KATIA LEANDRO LUZIA MAGNO MARILENE MARLENE MILENA MONICA NAYARA NEIDE NILTON NORMA ODETE OSVALDO PIETRO RAIANE REBECA ROSIANE SERGIO SILVANA SILVIO SOFIA SOPHIA SUELI TEREZA VALDECI VALDENIA VILMA WALTER ZILDA'.split(' '));
const SOBRENOMES = new Set('SILVA SOUSA SOUZA OLIVEIRA LIMA PEREIRA ALVES COSTA SANTOS RODRIGUES FERREIRA GOMES MARTINS ARAUJO RIBEIRO CARVALHO ALMEIDA NASCIMENTO BARBOSA ROCHA DIAS MOREIRA CAVALCANTE CAVALCANTI MENDES NUNES VIEIRA BEZERRA FREITAS LOPES MOURA SALES MACEDO MAIA PINHEIRO TEIXEIRA BATISTA FERNANDES MONTEIRO CRUZ CASTRO CAMPOS PAIVA SAMPAIO QUEIROZ UCHOA FARIAS MEDEIROS XAVIER HOLANDA LEITE BRAGA MATOS MATTOS ANDRADE TAVARES CORREIA CORREA MESQUITA AGUIAR JUNIOR NETO FILHO SOBRINHO PONTES MARQUES BRITO SIQUEIRA GUIMARAES BRASIL LUZ PAZ MELO MELLO NOGUEIRA FONTES FREIRE PIRES PINTO REIS RAMOS SA VASCONCELOS JESUS CHAVES ROLIM TORRES VALE FEITOSA LOIOLA LOYOLA ARRUDA BENEVIDES SARAIVA GADELHA FIRMINO DUARTE'.split(' '));
/** quanto uma linha "parece" nome de pessoa (0 = não parece) */
export function notaNome(s) {
  if (!ehNome(s)) return 0;
  const p = semAcento(limpaNome(s)).toUpperCase().split(' ');
  const lig = ['DA', 'DE', 'DO', 'DAS', 'DOS', 'E'];
  let n = 1 + (PRENOMES.has(p[0]) || FEM.has(p[0]) || MASC.has(p[0]) ? 3 : 0) + (p.length >= 3 ? 1 : 0) + (p.length >= 4 ? 1 : 0) + Math.min(2, p.slice(1).filter(w => SOBRENOMES.has(w)).length);
  n -= p.filter(w => !lig.includes(w) && w.length < 3).length * 2;   // pedaços curtos = lixo de leitura
  n -= p.filter(w => /[^AEIOUY]{4,}/.test(w)).length;                // muitas consoantes seguidas
  return Math.max(0, n);
}
export function limpaNome(s) {
  let p = String(s).replace(/[ÁÀÂÃ]{2,}/g, m => m[m.length - 1]).replace(/[ÉÊ]{2,}/g, m => m[0]).replace(/[ÓÔÕ]{2,}/g, m => m[m.length - 1]).replace(/[^A-Za-zÀ-ÿ' ]/g, ' ').replace(/\s+/g, ' ').trim().split(' ');
  while (p.length && p[0].length < 2) p.shift();                                    // lixo de 1 letra nas pontas
  while (p.length && p[p.length - 1].length < 2) p.pop();
  return p.join(' ');
}
/* palavras de cabeçalho/rótulo: uma linha que tenha uma delas, mesmo lida com 1-2 letras erradas, não é nome */
const ROTULOS = ['GOVERNO', 'FEDERAL', 'REPUBLICA', 'FEDERATIVA', 'CARTEIRA', 'IDENTIDADE', 'NACIONAL', 'NATURALIDADE', 'FILIACAO', 'FILIATION',
  'VALIDADE', 'ASSINATURA', 'SECRETARIA', 'SEGURANCA', 'PUBLICA', 'MINISTERIO', 'DOCUMENTO', 'REGISTRO', 'EXPEDICAO', 'NACIONALIDADE',
  'NATIONALITY', 'IDENTIFICACAO', 'TERRITORIO', 'ORIGEM', 'EMISSAO', 'EXPEDIDOR', 'SIGNATURE', 'PERSONAL', 'DIRETOR', 'INSTITUTO', 'CERTIDAO', 'CARTORIO'];
export function pareceRotulo(t) {
  return semAcento(t).toUpperCase().replace(/[^A-Z ]/g, ' ').split(/\s+/).some(w => w.length >= 5 && ROTULOS.some(r => Math.abs(r.length - w.length) <= 2 && distancia(w, r) <= (r.length >= 9 ? 2 : 1)));
}
const FEM = new Set('ANA MARIA RITA RUTE RUTH ALICE ISABEL RAQUEL BEATRIZ RAIMUNDA LUZ CARMEM CARMEN MIRIAM ESTER ESTHER LILIAN VIVIAN KAREN ELLEN HELEN EDITE IVONE IRENE ALINE ELIANE DENISE CRISTIANE ROSIANE SIMONE ODETE ELIENE ROSILENE MARILENE MARLENE GISELE JAQUELINE SUELI NEIDE IRACI INES INÊS LUCI NOEMI RAQUELE SOLANGE ROSE ROSANGELA DAIANE TAMIRES THAIS LAIS MARISE NAIR ZULEIDE DAMIANA'.split(' '));
const MASC = new Set('JOSUE LUCA NOA ISAIAS ELIAS MATIAS TOBIAS JONAS NICOLAS LUCAS MARCOS CARLOS LUIS LUIZ JOSE JOAO DAVI DAVID SAMUEL MANOEL MANUEL DANIEL GABRIEL RAFAEL MIGUEL ISRAEL ABEL NOEL JOEL ARTUR ARTHUR HEITOR VITOR VICTOR NESTOR JUNIOR WALTER WAGNER VALDIR VALDECI GERSON NILTON EDSON WILSON NELSON AIRTON AILTON MILTON IVAN ALAN ALLAN RUAN JEAN KAUAN JULIAN IAN RENAN WILLIAN WILLIAM CAUE KAUE KAUA FELIPE HENRIQUE ALEXANDRE ANDRE JORGE GUILHERME CLEBER ROBSON ENZO PIETRO'.split(' '));
/** 'F', 'M' ou null pelo primeiro nome (lista + terminação: -A feminino, -O masculino) */
export function genero(nome) {
  const p = semAcento(limpaNome(nome)).toUpperCase().split(' ')[0] || '';
  if (FEM.has(p)) return 'F'; if (MASC.has(p)) return 'M';
  if (/A$/.test(p)) return 'F'; if (/O$/.test(p)) return 'M';
  return null;
}
const nomeBom = s => notaNome(s) > 0;
export function ehNome(s) {
  const t = limpaNome(s); if (!t || /[\/|\\]/.test(s)) return false;
  const p = t.split(' ').filter(x => x.length > 1);
  const letras = (String(s).match(/[A-Za-zÀ-ÿ]/g) || []).length, total = String(s).replace(/\s/g, '').length;
  return p.length >= 2 && t.length >= 7 && letras / Math.max(1, total) > 0.8 && !NAO_NOME.test(semAcento(t).toUpperCase()) && !pareceRotulo(t);
}

/* ---------- utilidades de linha ---------- */
function linhasDe(texto) { return String(texto).split(/\n/).flatMap(l => l.split(/ {4,}|\t+/)).map(l => l.replace(/\s+/g, ' ').trim()).filter(l => l.replace(/[^A-Za-z0-9]/g, '').length >= 2 || /^[MF]$/.test(l)); }
/** primeira linha cujo texto normalizado casa com o rótulo */
const acha = (N, re, de = 0) => { for (let i = de; i < N.length; i++) if (re.test(N[i])) return i; return -1; };
/** valor de um rótulo: o resto da mesma linha (se for válido) ou as linhas seguintes */
function aposRotulo(L, N, i, rotRe, valido, max = 2) {
  if (i < 0) return null;
  const resto = L[i].replace(new RegExp('^.*?' + rotRe.source + '[\\s:\\-/.]*', 'i'), '');
  if (resto && resto !== L[i] && valido(resto)) return resto;
  for (let k = i + 1; k <= i + max && k < L.length; k++) if (valido(L[k])) return L[k];
  return null;
}

/* ---------- MRZ da CIN (3 linhas de 30 caracteres no verso) ---------- */
export function lerMrz(L) {
  const r = {};
  const dig = t => t.replace(/[OQDU]/g, '0').replace(/[IL|]/g, '1').replace(/S/g, '5').replace(/B/g, '8').replace(/Z/g, '2').replace(/G/g, '6');
  for (const bruta of L) {
    const l = bruta.replace(/\s/g, '').replace(/«/g, '<<').replace(/[‹〈]/g, '<').toUpperCase();
    if (!/<</.test(l) && !/BRA/.test(l)) continue;
    /* linha 2: AAMMDD (nascimento) + dígito + sexo + AAMMDD (validade) + dígito + BRA */
    const m = l.match(/([0-9OQDUILSBZG]{6})[0-9OQDUILSBZG<]?([MF<])([0-9OQDUILSBZG]{6})[0-9OQDUILSBZG<]?BRA/);
    if (m && !r.nascimento) { const n = dig(m[1]); const iso = dataIso(+n.slice(4, 6), +n.slice(2, 4), n.slice(0, 2)); if (iso) r.nascimento = iso; if (m[2] !== '<') r.sexo = m[2] === 'F' ? 'Feminino' : 'Masculino'; }
    /* linha 3: SOBRENOME<<PRENOMES (o OCR troca O por 0, I por 1 e "<" por c, e, K) */
    if (!/^I[DO0]BRA/.test(l) && !r.nome) {
      const t = l.replace(/0/g, 'O').replace(/1/g, 'I').replace(/5/g, 'S').replace(/8/g, 'B').replace(/[^A-Z<]/g, '');
      const n = t.match(/^([A-Z]{2,}(?:<[A-Z]{2,})*)<<([A-Z]{2,}(?:<[A-Z]{2,})*)/);
      if (n && !/BRA$/.test(n[1])) { const nome = n[2].split('<').join(' ') + ' ' + n[1].split('<').join(' '); if (nome.split(' ').length >= 2) r.nome = nome.trim(); }
    }
  }
  return r;
}

/* ======================================================================
 *  DOCUMENTO DE IDENTIDADE (RG, CIN, certidão)
 * ====================================================================== */
export function interpretarIdentidade(texto) {
  const L = linhasDe(texto), N = L.map(norm), r = {};
  const mrz = lerMrz(L);

  /* CPF: o primeiro com dígitos verificadores certos (perto do rótulo CPF vale mais); se nenhum confere,
     o número de 11 dígitos ao lado do rótulo entra marcado como dúvida */
  const cands = [];
  L.forEach((l, i) => {
    const f = consertaNumeros(l), perto = /CPF|PERSONAL NUMBER|REGISTRO GERAL - CPF/.test(N[i]) || /CPF|PERSONAL/.test(N[i - 1] || '');
    for (const m of f.matchAll(/(?<!\d)(\d{3})\s?[.,]?\s?(\d{3})\s?[.,]?\s?(\d{3})\s?[-–.,/ ]?\s?(\d{2})(?!\d)/g)) { const c = m.slice(1).join(''); cands.push({ c, ok: cpfOk(c), perto }); }
  });
  const cpf = cands.find(x => x.ok && x.perto) || cands.find(x => x.ok) || cands.find(x => x.perto);
  if (cpf) { r.cpf = cpfFmt(cpf.c); if (!cpf.ok) r.cpf_duvida = true; }

  /* data de nascimento: a que está junto do rótulo NASCIMENTO/BIRTH; nunca a de expedição, emissão ou validade */
  const ds = [];
  L.forEach((l, i) => {
    const f = consertaNumeros(l);
    for (const m of f.matchAll(/(?<!\d)(\d{1,2})\s?[\/.\-]\s?(\d{1,2})\s?[\/.\-]\s?(\d{4}|\d{2})(?!\d)/g)) {
      const iso = dataIso(+m[1], +m[2], m[3]); if (!iso) continue;
      const ctx = N[i] + ' | ' + (N[i - 1] || '') + ' | ' + (N[i - 2] || '');
      const ruim = /EXPEDI|EMISS|VALID|EXPIR|VENC|EMITID/.test(N[i]) || (!/NASC|BIRTH/.test(N[i]) && /EXPEDI|EMISS|VALID|EXPIR/.test(N[i - 1] || ''));
      ds.push({ iso, nasc: /NASC|BIRTH/.test(ctx), ruim, id: idade(iso) });
    }
  });
  const nasc = ds.find(x => x.nasc && !x.ruim && x.id > 8 && x.id < 30) || ds.find(x => !x.ruim && x.id > 10 && x.id < 20) || (mrz.nascimento ? { iso: mrz.nascimento } : null);
  if (nasc) r.nascimento = nasc.iso;

  /* ----- pai, mãe e nome ----- */
  const mesmo = (a, b) => so(limpaNome(a)) === so(limpaNome(b));
  const sobrenomes = n => so(limpaNome(n)).split(' ').slice(1).filter(w => w.length >= 3 && !['DAS', 'DOS'].includes(w));
  const divideSobrenome = (a, b) => { const x = sobrenomes(a); return sobrenomes(b).some(w => x.includes(w)); };
  /* pai e mãe pelo gênero do primeiro nome; sem pista, a ordem do documento (pai, depois mãe) */
  const filiacao = nomes => {
    nomes = nomes.map(limpaNome).filter(Boolean).slice(0, 2);
    if (nomes.length === 2) { const [g1, g2] = nomes.map(genero); return g1 === 'F' && g2 !== 'F' || g2 === 'M' && g1 !== 'M' ? { mae: nomes[0], pai: nomes[1] } : { pai: nomes[0], mae: nomes[1] }; }
    if (nomes.length === 1) return genero(nomes[0]) === 'M' ? { pai: nomes[0] } : { mae: nomes[0] };
    return {};
  };
  /* rótulo NOME (não o social, não o do pai/mãe) */
  const iNome = N.findIndex(l => /^(NOME|NOME CIVIL|NAME|NOME DO A? ?REGISTRADO|REGISTRADO)\b/.test(l) && !/SOCIAL|PAI|MAE/.test(l));
  let nome = aposRotulo(L, N, iNome, /(nome( civil)?|name)( \/ name)?/, nomeBom, 2);
  /* filiação: até duas linhas de nome depois do rótulo; certidão: rótulos PAI e MÃE */
  const iFil = N.findIndex(l => /FILIA(CAO|TION)/.test(l) || (pareceRotulo(l) && /^F[I1L]L/.test(l)));
  let pais = {};
  if (iFil >= 0) {
    const nomes = []; const resto = L[iFil].replace(/^.*?filia\S*[\s:\-/]*(filiation)?[\s:\-]*/i, '');
    if (nomeBom(resto)) nomes.push(resto);
    for (let k = iFil + 1; k < Math.min(L.length, iFil + 6) && nomes.length < 2; k++) {
      if (/NATURALIDADE|PLACE OF|NASCIMENTO|DOC|CPF|ORGAO|EXPEDIDOR|EMISSAO/.test(N[k])) break;
      if (nomeBom(L[k]) && !(nome && mesmo(L[k], nome))) nomes.push(L[k]);
    }
    pais = filiacao(nomes);
  }
  const iPai = N.findIndex(l => /^(PAI|NOME DO PAI|GENITOR)\b/.test(l)), iMae = N.findIndex(l => /^(MAE|NOME DA MAE|GENITORA)\b/.test(l));
  if (!pais.pai && iPai >= 0) { const v = aposRotulo(L, N, iPai, /(nome do pai|pai|genitor)/, nomeBom, 1); if (v) pais.pai = limpaNome(v); }
  if (!pais.mae && iMae >= 0) { const v = aposRotulo(L, N, iMae, /(nome da m[ãa]e|m[ãa]e|genitora)/, nomeBom, 1); if (v) pais.mae = limpaNome(v); }
  /* linhas que parecem nome de pessoa (o cabeçalho e o lixo de leitura já ficam de fora) */
  /* nos documentos de identidade os nomes são impressos em MAIÚSCULAS: linha em minúsculas é rótulo lido errado */
  const maiusc = l => { const a = l.replace(/[^A-Za-zÀ-ÿ]/g, ''); return a.length && a.replace(/[^A-ZÀ-Þ]/g, '').length / a.length >= 0.8; };
  const pessoas = L.map((l, i) => ({ i, t: limpaNome(l), n: maiusc(l) ? notaNome(l) : 0 })).filter(c => c.n > 0);
  const ehPai = t => (pais.pai && mesmo(t, pais.pai)) || (pais.mae && mesmo(t, pais.mae));
  if (!nome && mrz.nome) nome = mrz.nome;
  /* sem rótulos: no RG e na CIN a filiação vem DEPOIS do nome, em duas linhas seguidas. Então o último par de
     nomes seguidos (que não seja o nome já achado) é pai/mãe; o nome do candidato é o melhor que sobra,
     de preferência dividindo um sobrenome com os pais. O cabeçalho e o lixo de leitura já ficaram de fora. */
  const semRotFil = !pais.pai && !pais.mae && iFil < 0 && iPai < 0 && iMae < 0;
  const fortes = pessoas.filter(c => c.n >= 2 && !(nome && mesmo(c.t, nome)));
  if (semRotFil) {
    for (let j = fortes.length - 2; j >= 0; j--) {
      if (fortes[j + 1].i - fortes[j].i > 2) continue;
      const sobra = nome || pessoas.some(c => c.i !== fortes[j].i && c.i !== fortes[j + 1].i);
      if (sobra) { pais = filiacao([fortes[j].t, fortes[j + 1].t]); break; }
    }
  }
  if (!nome) {
    const livres = pessoas.filter(c => !ehPai(c.t));
    const ref = [pais.pai, pais.mae].filter(Boolean);
    let melhor = null, nm = -1;
    if (ref.length) livres.forEach((c, j) => {   // com pais conhecidos: o que divide sobrenome com eles
      const v = c.n + (ref.some(x => divideSobrenome(c.t, x)) ? 4 : 0) - j * 0.25;
      if (v > nm) { nm = v; melhor = c; }
    });
    else melhor = livres.find(c => c.n >= 2) || livres[0];   // sem pistas: a ordem do documento (o nome vem antes da filiação)
    if (melhor) nome = melhor.t;
  }
  if (nome) r.nome = limpaNome(nome);
  /* só sobraram nomes sem par (ex.: RG com um genitor e sem rótulo): depois do nome, o próximo é pai ou mãe */
  if (semRotFil && !pais.pai && !pais.mae && r.nome) {
    const iN = pessoas.findIndex(c => mesmo(c.t, r.nome)); const prox = pessoas[iN + 1];
    if (iN >= 0 && prox && prox.n >= 2 && prox.i - pessoas[iN].i <= 3) pais = filiacao([prox.t]);
  }
  if (pais.pai) r.pai = pais.pai; if (pais.mae) r.mae = pais.mae;
  if (r.nome && r.mae && mesmo(r.mae, r.nome)) delete r.mae;
  if (r.nome && r.pai && mesmo(r.pai, r.nome)) delete r.pai;

  /* naturalidade: "BOA VIAGEM-CE" / "BOA VIAGEM/CE" depois do rótulo (no RG vem na mesma linha da data) */
  const iNat = acha(N, /NATURALIDADE|PLACE OF BIRTH/);
  if (iNat >= 0) {
    const limpa = s => consertaNumeros(s).replace(/\d{1,2}\s?[\/.\-]\s?\d{1,2}\s?[\/.\-]\s?\d{2,4}/g, ' ')
      .replace(/natural\w*|place\s*of\s*\w*|data\s*de\s*nasc\w*|date\s*of\s*\w*|nasciment\w*|\bdata\b|\bbirth\w*/ig, ' ').replace(/[^A-Za-zÀ-ÿ\/\- ]/g, ' ').replace(/\s+/g, ' ').trim();
    const ok = s => { const t = limpa(s); return t.replace(/[^A-Za-zÀ-ÿ]/g, '').length >= 3 && !/\b(DOC|ORIGEM|CPF|ORGAO|EXPEDIDOR|FILIACAO|SEXO|PLACE|BIRTH\w*|LOCAL|EMISSAO)\b/.test(norm(t)); };
    const v = aposRotulo(L, N, iNat, /(naturalidade|place of birth)/, ok, 2);
    if (v) r.naturalidade = limpa(v).replace(/\s*[-\/]\s*([A-Za-z]{2})$/, '/$1').replace(/^[-\/ ]+|[-\/ ]+$/g, '');
  }

  if (!r.naturalidade) {
    const k = L.findIndex((l, i) => new RegExp(`^[A-Za-zÀ-ÿ ]{3,}\\s?[-/]\\s?(${UFS})$`).test(l.trim()) && !/^(SSP|SDS|SSPDS|PC|PCCE|DETRAN|DIC|IIRGD|SESP|POLICIA)\b/.test(N[i]) && !/EMISS|EXPED/.test(N[i - 1] || ''));
    if (k >= 0) r.naturalidade = L[k].trim().replace(/\s*[-\/]\s*([A-Za-z]{2})$/, '/$1');
  }
  /* último recurso: cidade do cartório na linha DOC. ORIGEM (C.NASC=… LV=… FL=… CIDADE-UF) */
  if (!r.naturalidade) {
    const k = N.findIndex(l => /C\.? ?NAS|CERT|\bLV\b|\bFL\b|ORIGEM/.test(l));
    const m = k >= 0 && L[k].match(new RegExp(`([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ ]{2,}?)\\s?[-/]\\s?(${UFS})\\s*$`));
    if (m) r.naturalidade = (m[1].replace(/^.*?\b(FL|LV|TERMO|MATR\w*)\s*=?\s*[\w\-]*\s+/i, '').trim() + '/' + m[2]);
  }
  /* sexo: rótulo SEXO/SEX com F/M na mesma linha ou na de baixo; senão a MRZ */
  const iSx = acha(N, /\bSEXO\b|\bSEX\b/);
  if (iSx >= 0) {
    const resto = N[iSx].replace(/^.*?\bSEX[O]?\b[\s:\/]*(SEX\b)?[\s:]*/, '');
    const pega = s => { const m = s.match(/^(FEMININO|MASCULINO|FEM|MASC|F|M)\b/); return m ? (m[1][0] === 'F' ? 'Feminino' : 'Masculino') : null; };
    r.sexo = pega(resto) || pega(N[iSx + 1] || '') || undefined;
  }
  /* CIN sem o rótulo: sobra "M   BRA" (sexo e nacionalidade lado a lado; às vezes o M vira "Mo") */
  if (!r.sexo) N.forEach((l, i) => { if (r.sexo) return; const m = l.match(/^(M|F)[O0]?(\s+BRA\b|$)/); if (m && (m[2] || /^BRA\b/.test(N[i + 1] || ''))) r.sexo = m[1] === 'F' ? 'Feminino' : 'Masculino'; });
  if (!r.sexo && mrz.sexo) r.sexo = mrz.sexo;
  for (const k of ['nome', 'pai', 'mae', 'naturalidade']) if (r[k]) r[k] = r[k].toUpperCase();
  for (const k in r) if (r[k] === undefined || r[k] === '') delete r[k];
  return r;
}

/* ======================================================================
 *  COMPROVANTE DE RESIDÊNCIA
 * ====================================================================== */
const EMPRESA = /\b(ENEL|COELCE|CAGECE|SAAE|CNPJ|INSCRICAO ESTADUAL|DISTRIBUI\w*|S\.?\/?A\.?|LTDA|EIRELI|CENTRAL DE|ATENDIMENTO|WWW|HTTP|\.COM|OUVIDORIA|ANEEL|ARCE|AGENCIA|CLARO|VIVO|TIM|BRISANET|NET SERVICOS|SAC|0800|CAIXA POSTAL|SEDE)\b/;
const LOGRADOURO = /^(RUA|R|AV|AVENIDA|TRAVESSA|TV|TRAV|SITIO|FAZENDA|FAZ|DISTRITO|LOCALIDADE|LOC|VILA|CONJUNTO|CONJ|CJ|ALAMEDA|AL|ESTRADA|EST|ROD|RODOVIA|LOTEAMENTO|LOT|PRACA|PCA|BECO|AGROVILA|ASSENTAMENTO|POVOADO|COMUNIDADE|QUADRA|QD|SERRA)\b/;
const CEP_RE = /(?<!\d)(\d{2})\s?\.?\s?(\d{3})\s?-?\s?(\d{3})(?!\d)/;
const UFS = 'AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO';

function distancia(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
/** bairro da lista que aparece no texto (mesmas palavras, com tolerância a erro de leitura) */
export function acharBairro(textoSo, bairros) {
  const P = String(textoSo).split(' ').filter(Boolean);
  for (const b of bairros || []) {
    const alvo = so(b); const n = alvo.split(' ').length; if (alvo.length < 3) continue;
    const tol = alvo.replace(/ /g, '').length >= 10 ? 2 : alvo.replace(/ /g, '').length >= 5 ? 1 : 0;
    for (let i = 0; i + n <= P.length; i++) if (distancia(P.slice(i, i + n).join(' '), alvo) <= tol) return b.toUpperCase();
  }
  return null;
}
export function interpretarComprovante(texto, bairrosCota = [], cidadePadrao = 'BOA VIAGEM') {
  const L = linhasDe(texto), N = L.map(norm), r = {};
  const ehEmpresa = i => EMPRESA.test(N[i] || '');
  const cidN = so(cidadePadrao);
  const temCep = i => { const m = consertaNumeros(L[i] || '').match(CEP_RE); return m && /CEP/.test(N[i]) || (m && new RegExp(`\\b(${UFS})\\b`).test(N[i])) ? m : (m && /^\D*\d{2}\.?\d{3}-\d{3}/.test(consertaNumeros(L[i] || '')) ? m : null); };
  const rotEnd = /^(ENDERECO|END|LOGRADOURO|ENDERECO DE ENTREGA|ENDERECO DA UNIDADE CONSUMIDORA|LOCAL DE CONSUMO|ENDERECO DO IMOVEL)\b/;

  /* 1) escolhe a linha do endereço do cliente: tem logradouro (ou rótulo ENDEREÇO), número, CEP/cidade por perto,
        um nome de pessoa logo acima e NENHUM sinal da empresa (CNPJ, 0800, site…) */
  let melhor = -1, nota = -99;
  N.forEach((l, i) => {
    const corpo = l.replace(rotEnd, '').replace(/^[\s:.\-]+/, '');
    const ehLog = LOGRADOURO.test(corpo) || (rotEnd.test(l) && corpo.length > 4);
    if (!ehLog) return;
    let s = 2;
    if (rotEnd.test(l)) s += 2;
    if (/\d/.test(corpo) || /\bS\.?\/?N\b/.test(corpo)) s += 2;
    for (let k = i; k <= i + 3 && k < N.length; k++) { if (temCep(k)) s += 2; if (cidN && so(N[k]).includes(cidN)) s += 3; }
    for (let k = Math.max(0, i - 3); k < i; k++) if (ehNome(L[k]) && !ehEmpresa(k)) s += 2;
    for (let k = Math.max(0, i - 1); k <= i + 1; k++) if (ehEmpresa(k)) s -= 6;
    if (/FORTALEZA/.test(l) && !cidN.includes('FORTALEZA')) s -= 3;
    if (s > nota) { nota = s; melhor = i; }
  });
  /* sem logradouro: usa a linha acima do CEP que fica perto da cidade padrão */
  if (melhor < 0) {
    const iC = N.findIndex((l, i) => temCep(i) && !ehEmpresa(i) && (!cidN || so(l).includes(cidN)));
    if (iC > 0) melhor = iC - 1;
  }
  if (melhor >= 0) {
    let e = L[melhor].replace(/^\s*(endere[çc]o( de entrega| da unidade consumidora| do im[óo]vel)?|end\.?|logradouro|local de consumo)\s*[:\-]?\s*/i, '');
    /* "Rua: SITIO BOA ESPERANÇA" -> o rótulo "Rua:" sai quando o valor já começa com outro tipo de logradouro */
    const sl = e.match(/^\s*(rua|avenida|av\.?)\s*[:;]\s*(.*)$/i); if (sl) e = LOGRADOURO.test(norm(sl[2])) ? sl[2] : sl[1] + ' ' + sl[2];
    e = e.replace(/\bCEP\b.*$/i, '').trim();
    /* "RUA X, 123 - BAIRRO" -> separa o bairro */
    const partes = e.split(/\s+[-–]\s+|\s{2,}/);
    if (partes.length > 1 && !/^\d+\w?$/.test(partes[1]) && !/^(CASA|APTO?|AP|BLOCO|BL|LOTE|QD|FUNDOS|ANEXO)\b/i.test(partes[1])) {
      e = partes[0]; const b = partes.slice(1).find(p => p.replace(/[^A-Za-zÀ-ÿ]/g, '').length >= 3 && !new RegExp(`^(${UFS})$`, 'i').test(p.trim()) && !so(p).includes(cidN));
      if (b) r.bairro = b.replace(/[^A-Za-zÀ-ÿ0-9 ]/g, ' ').trim();
    }
    r.endereco = e.replace(/[|_]/g, ' ').replace(/\s+/g, ' ').replace(/[\s,\-–]+$/, '').trim();
  }

  /* 2) CEP e cidade: a linha com CEP mais perto do endereço (abaixo dele), senão a que tem a cidade padrão */
  let iCep = -1;
  if (melhor >= 0) for (let k = melhor; k <= melhor + 4 && k < N.length; k++) if (temCep(k) && !ehEmpresa(k)) { iCep = k; break; }
  if (iCep < 0) iCep = N.findIndex((l, i) => temCep(i) && !ehEmpresa(i) && cidN && so(l).includes(cidN));
  if (iCep < 0) iCep = N.findIndex((l, i) => temCep(i) && !ehEmpresa(i));
  if (iCep >= 0) {
    const f = consertaNumeros(L[iCep]), m = f.match(CEP_RE);
    r.cep = `${m[1]}${m[2]}-${m[3]}`;
    /* o que sobra na linha do CEP: cidade (e às vezes o bairro) */
    const resto = f.replace(m[0], ' ').replace(/\bCEP\b[:.]?/i, ' ').replace(/\b(cidade|munic[íi]pio|uf|bairro)\s*[:.]/ig, '  ').replace(/^[\s\-–:,]+/, '');
    const pedacos = resto.split(/\s+[-–]\s+|\s*\/\s*|\s{2,}|,\s*/).map(p => p.trim()).filter(p => p.replace(/[^A-Za-zÀ-ÿ]/g, '').length >= 2 && !new RegExp(`^(${UFS})$`, 'i').test(p));
    const cid = pedacos.find(p => cidN && so(p).includes(cidN)) || pedacos[pedacos.length - 1];
    if (cid) r.cidade = cid.replace(new RegExp(`[\\s\\-/]+(${UFS})$`, 'i'), '').replace(/[^A-Za-zÀ-ÿ ]/g, ' ').replace(/\s+/g, ' ').trim();
    const outro = pedacos.find(p => p !== cid && !so(p).includes(cidN));
    if (!r.bairro && outro) r.bairro = outro.replace(/[^A-Za-zÀ-ÿ0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
    /* bairro numa linha entre o endereço e o CEP */
    if (!r.bairro && melhor >= 0) for (let k = melhor + 1; k < iCep; k++) {
      const t = L[k].replace(/^\s*bairro\s*[:\-]?\s*/i, '');
      if (!ehEmpresa(k) && t.replace(/[^A-Za-zÀ-ÿ]/g, '').length >= 3 && !/\d{3}/.test(t)) { r.bairro = t.replace(/[^A-Za-zÀ-ÿ0-9 ]/g, ' ').replace(/\s+/g, ' ').trim(); break; }
    }
  }
  /* rótulo BAIRRO explícito ganha de tudo */
  const iB = N.findIndex(l => /^B[A-Z]{1,2}R?R[O0]\b\s*:?/.test(l) && !/^BARRO\b/.test(l));
  if (iB >= 0) { const v = aposRotulo(L, N, iB, /b\w{1,2}r?r[o0]/, s => s.replace(/[^A-Za-zÀ-ÿ]/g, '').length >= 3, 1); if (v) r.bairro = v.split(/\s{2,}|\bCEP\b|\bCIDADE\b|\bMUNIC/i)[0].replace(/[^A-Za-zÀ-ÿ0-9 ]/g, ' ').replace(/\s+/g, ' ').trim(); }
  const iCid = N.findIndex(l => /^(CIDADE|MUNICIPIO)\b/.test(l));
  if (iCid >= 0) { const v = aposRotulo(L, N, iCid, /(cidade|munic[íi]pio)/, s => s.replace(/[^A-Za-zÀ-ÿ]/g, '').length >= 3, 1); if (v) r.cidade = v.split(new RegExp(`\\s{2,}|[-/]\\s*(${UFS})\\b|\\bUF\\b|\\bCEP\\b`, 'i'))[0].replace(/[^A-Za-zÀ-ÿ ]/g, ' ').replace(/\s+/g, ' ').trim(); }

  /* 3) titular: rótulo (NOME, CLIENTE, TITULAR…) ou o nome de pessoa logo acima do endereço */
  const rotNome = /^(NOME DO CLIENTE|NOME DO TITULAR|NOME|CLIENTE|TITULAR|CONSUMIDOR|DECLARANTE|PROPRIETARIO|RESPONSAVEL)\b/;
  const iT = N.findIndex((l, i) => rotNome.test(l) && !ehEmpresa(i) && !/SOCIAL|FANTASIA/.test(l));
  let tit = aposRotulo(L, N, iT, /(nome do cliente|nome do titular|nome|cliente|titular|consumidor|declarante|propriet[áa]rio|respons[áa]vel)/, ehNome, 1);
  /* declaração: "Eu, FULANO DE TAL, portador(a) do CPF…" */
  if (!tit) { const m = L.join(' ').match(/\bEu,?\s+([A-ZÀ-Ú][A-ZÀ-Ú' ]{5,}?)\s*,?\s+(portador|portadora|brasileir|inscrit|residente|declaro|rg|cpf)/i); if (m && ehNome(m[1])) tit = m[1]; }
  if (!tit && melhor >= 0) {   /* o nome de pessoa mais "provável" logo acima do endereço (o mais perto desempata) */
    let nt = 0;
    for (let k = melhor - 1; k >= Math.max(0, melhor - 4); k--) { const v = ehEmpresa(k) ? 0 : notaNome(L[k]) - (melhor - 1 - k) * 0.5; if (v > nt) { nt = v; tit = L[k]; } }
  }
  if (!tit) { const k = L.findIndex((l, i) => ehNome(l) && !ehEmpresa(i) && l === l.toUpperCase() && limpaNome(l).split(' ').length >= 3); if (k >= 0) tit = L[k]; }
  if (tit) r.titular = limpaNome(tit);

  /* 4) telefone do cliente (celular), nunca 0800 nem o da empresa */
  L.forEach((l, i) => { if (r.telefone || ehEmpresa(i)) return; const m = consertaNumeros(l).match(/\(?\b(\d{2})\)?\s?(9\s?\d{4})[\s\-.]?(\d{4})\b/); if (m) r.telefone = `(${m[1]}) ${m[2].replace(/\s/g, '')}-${m[3]}`; });

  /* 5) cota de bairro: procura os bairros da cota no texto, aceitando pequenos erros de leitura (COMAB = COHAB) */
  const perto = so((r.bairro || '') + ' ' + (r.endereco || '') + ' ' + (melhor >= 0 ? L.slice(melhor, melhor + 4).join(' ') : ''));
  const achado = acharBairro(perto, bairrosCota) || acharBairro(so(texto), bairrosCota);
  if (achado) { if (!r.bairro || acharBairro(so(r.bairro), [achado])) r.bairro = achado; r.cota_bairro = true; }
  for (const k of ['titular', 'endereco', 'bairro', 'cidade']) if (r[k]) r[k] = r[k].toUpperCase();
  for (const k in r) if (r[k] === undefined || r[k] === '') delete r[k];
  return r;
}

/** compatível com o formato antigo: tenta identidade e comprovante e junta */
export function interpretarDocumento(texto, bairrosCota) {
  const a = interpretarIdentidade(texto), b = interpretarComprovante(texto, bairrosCota || []);
  const r = { ...b, ...a };
  const em = String(texto).match(/[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/); if (em) r.email = em[0].toLowerCase();
  const esc = linhasDe(texto).find(l => /\b(ESCOLA|E\.?E\.?F|EMEF|COLEGIO|E\.?M\.?E\.?F)\b/.test(norm(l)) && !/VENCESLAU|PROFISSIONAL/.test(norm(l)));
  if (esc) r.escola_origem = esc.replace(/^.*?(escola|col[ée]gio)\b/i, m => m.match(/(escola|col[ée]gio)/i)[0]).trim();
  return r;
}

/** quantos campos importantes foram achados (para decidir se vale ler de novo com outro tratamento da foto) */
export function pontos(tipo, r) {
  const campos = tipo === 'doc' ? ['nome', 'nascimento', 'mae', 'naturalidade'] : ['titular', 'endereco', 'cep', 'bairro', 'cidade'];
  return campos.filter(k => r[k]).length + (tipo === 'doc' && r.cpf && !r.cpf_duvida ? 1 : 0);
}
export const PONTOS_MAX = { doc: 5, end: 5 };

/* ======================================================================
 *  NOTAS (histórico e boletim)
 * ====================================================================== */
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
  String(texto).split(/\n/).forEach(l => {
    const n = norm(l).replace(/[^A-Z0-9 .,]/g, ' ');
    const d = DISC.find(([re]) => re.test(n)); if (!d) return;
    const resto = consertaNumeros(l.replace(/^[^0-9]*?(?=\d)/, ''));   // números depois do nome
    let v = numeros(resto); if (!v.length) return;
    if (modo === '68') { v = v.length >= 3 ? v.slice(-3) : v; while (v.length < 3) v.unshift(null); }
    else v = v.slice(0, 4);
    if (!r[d[1]]) r[d[1]] = v;
  });
  return r;
}
