<?php
/* Cadastro / edição de candidato: dados lidos da foto do documento + notas do 6º ao 9º ano */
require __DIR__ . '/includes/base.php';
$u = exigir_login();
$ano = sel_ano(); $cursos = sel_cursos();
$id = (int)($_GET['id'] ?? $_POST['id'] ?? 0);
$c = $id ? q_um('SELECT * FROM sel_candidatos WHERE id = ? AND ano = ?', [$id, $ano]) : null;
if ($id && !$c) { flash('erro', 'Candidato não encontrado.'); redirecionar('candidatos.php'); }

$nota = function ($v) {
    $v = trim(str_replace(',', '.', (string)$v)); if ($v === '' || !is_numeric($v)) return null;
    $v = (float)$v; if ($v > 10 && $v <= 100) $v /= 10;
    return $v < 0 || $v > 10 ? false : round($v, 2);
};

if (eh_post()) {
    csrf_verificar();
    if (($_POST['acao'] ?? '') === 'excluir' && $c) {
        if (!eh_admin()) { flash('erro', 'Só o administrador pode excluir candidatos.'); redirecionar('candidato.php?id=' . $id); }
        q('DELETE FROM sel_candidatos WHERE id = ?', [$id]); registrar('excluiu', $c['nome'] . ' · ' . $c['cpf']);
        flash('ok', $c['nome'] . ' foi excluído(a) da seleção.'); redirecionar('candidatos.php');
    }
    $f = fn($k, $n = 160) => mb_substr(trim((string)($_POST[$k] ?? '')), 0, $n);
    $M = fn($k, $n = 160) => mb_strtoupper($f($k, $n));   // nomes e endereço sempre em letra maiúscula
    $d = ['nome' => $M('nome'), 'cpf' => cpf_fmt($f('cpf', 20)), 'nascimento' => preg_match('/^\d{4}-\d{2}-\d{2}$/', $f('nascimento')) ? $f('nascimento') : null,
          'pai' => $M('pai'), 'mae' => $M('mae'), 'email' => mb_strtolower($f('email')), 'telefone' => $f('telefone', 30),
          'endereco' => $M('endereco', 255), 'bairro' => $M('bairro', 120), 'cidade' => $M('cidade', 120), 'escola_origem' => $M('escola_origem'),
          'naturalidade' => $M('naturalidade', 120), 'sexo' => in_array($f('sexo', 20), ['Feminino', 'Masculino'], true) ? $f('sexo', 20) : null,
          'titular' => $M('titular'), 'cep' => $f('cep', 10),
          'curso' => $f('curso', 60), 'cota_bairro' => !empty($_POST['cota_bairro']) ? 1 : 0, 'pcd' => !empty($_POST['pcd']) ? 1 : 0, 'obs' => $f('obs', 500)];
    $erros = [];
    if (mb_strlen($d['nome']) < 5) $erros[] = 'Preencha o nome completo do candidato.';
    if (!isset($cursos[$d['curso']])) $erros[] = 'Escolha o curso.';
    if ($d['cpf'] !== '' && !cpf_valido($d['cpf'])) $erros[] = 'O CPF ' . $d['cpf'] . ' não é válido. Confira os números.';
    if ($d['cpf'] === '') $erros[] = 'Preencha o CPF do candidato.';
    if ($d['email'] !== '' && !filter_var($d['email'], FILTER_VALIDATE_EMAIL)) $erros[] = 'O e-mail não parece válido.';
    if (!$erros && ($dup = q_um('SELECT id, nome FROM sel_candidatos WHERE ano = ? AND cpf = ? AND id <> ?', [$ano, $d['cpf'], $id]))) $erros[] = 'Já existe um candidato com esse CPF: ' . $dup['nome'] . '.';
    // notas
    $notas = ['6' => [], '7' => [], '8' => [], '9' => []];
    foreach ((array)($_POST['d68'] ?? []) as $i => $disc) {
        $disc = mb_substr(trim((string)$disc), 0, 60); if ($disc === '') continue;
        foreach (['6', '7', '8'] as $a) { $v = $nota($_POST['n' . $a][$i] ?? ''); if ($v === false) $erros[] = "Nota inválida em $disc ({$a}º ano): use de 0 a 10."; elseif ($v !== null) $notas[$a][$disc] = $v; }
    }
    foreach ((array)($_POST['d9'] ?? []) as $i => $disc) {
        $disc = mb_substr(trim((string)$disc), 0, 60); if ($disc === '') continue;
        $b = [];
        foreach ([1, 2, 3, 4] as $k) { $v = $nota($_POST['b' . $k][$i] ?? ''); if ($v === false) $erros[] = "Nota inválida em $disc (9º ano, {$k}º bimestre)."; $b[] = $v === false ? null : $v; }
        if (array_filter($b, fn($x) => $x !== null)) $notas['9'][$disc] = $b;
    }
    $m = notas_media($notas);
    if ($erros) {
        foreach (array_unique($erros) as $e1) flash('erro', $e1);
        $_SESSION['sel_form'] = $_POST;
        redirecionar('candidato.php' . ($id ? '?id=' . $id : ''));
    }
    $extra = ['notas' => json_encode($notas, JSON_UNESCAPED_UNICODE), 'media' => $m['media']];
    if ($c) {
        $cols = $d + $extra + ['atualizado_por' => $u['id'], 'atualizado_em' => agora()];
        q('UPDATE sel_candidatos SET ' . implode(', ', array_map(fn($k) => "$k = ?", array_keys($cols))) . ' WHERE id = ?', [...array_values($cols), $id]);
        registrar('editou', $d['nome']);
        flash('ok', $d['nome'] . ' atualizado(a). Média: ' . nota_fmt($m['media'], 3) . '.');
    } else {
        $cols = $d + $extra + ['criado_por' => $u['id'], 'criado_em' => agora(), 'ano' => $ano, 'situacao' => 'ativo'];
        q('INSERT INTO sel_candidatos (' . implode(', ', array_keys($cols)) . ') VALUES (' . implode(', ', array_fill(0, count($cols), '?')) . ')', array_values($cols));
        $id = (int)db()->lastInsertId();
        registrar('cadastrou', $d['nome']);
        flash('ok', $d['nome'] . ' cadastrado(a). Média: ' . nota_fmt($m['media'], 3) . '.');
    }
    if (($_POST['depois'] ?? '') === 'novo') redirecionar('candidato.php');
    redirecionar('candidatos.php?ver=' . $id);
}

/* valores do formulário (volta com o que foi digitado se deu erro) */
$v = $_SESSION['sel_form'] ?? null; unset($_SESSION['sel_form']);
$notas = $c ? (json_decode((string)$c['notas'], true) ?: []) : [];
if ($v) {
    $notas = ['6' => [], '7' => [], '8' => [], '9' => []];
    foreach ((array)($v['d68'] ?? []) as $i => $disc) if (trim($disc) !== '') foreach (['6', '7', '8'] as $a) $notas[$a][$disc] = $v['n' . $a][$i] ?? '';
    foreach ((array)($v['d9'] ?? []) as $i => $disc) if (trim($disc) !== '') $notas['9'][$disc] = [$v['b1'][$i] ?? '', $v['b2'][$i] ?? '', $v['b3'][$i] ?? '', $v['b4'][$i] ?? ''];
}
$val = fn($k) => $v[$k] ?? ($c[$k] ?? '');
$disc68 = array_values(array_unique(array_merge(array_keys($notas['6'] ?? []), array_keys($notas['7'] ?? []), array_keys($notas['8'] ?? []))));
if (!$disc68) $disc68 = SEL_DISC_PADRAO;
$disc9 = array_keys($notas['9'] ?? []) ?: SEL_DISC_PADRAO;
$fmt = fn($x) => $x === null || $x === '' ? '' : str_replace('.', ',', (string)$x);

$titulo = $c ? 'Editar candidato' : 'Novo candidato';
$subtitulo = $c ? $c['nome'] : 'Tire foto dos documentos: o celular lê os dados e as notas. Depois é só conferir.';
$acoes_cab = $c ? '<a class="btn btn-light" href="candidatos.php"><i class="bi bi-arrow-left me-1"></i>Voltar</a>' : '';
require __DIR__ . '/includes/topo.php';
?>
<form method="post" id="fCand" autocomplete="off" novalidate>
<?= csrf_campo() ?><input type="hidden" name="id" value="<?= (int)($c['id'] ?? 0) ?>">

<p class="sl-motor"><i class="bi bi-phone"></i>Leitura dos documentos <b>neste aparelho</b>. As fotos não são enviadas nem guardadas.</p>

<!-- 1 · documento do candidato -->
<section class="sl-card">
    <div class="sl-card-cab"><h2><i class="bi bi-person-vcard"></i>1 · Dados do candidato</h2><small class="text-secondary">RG, CIN ou certidão de nascimento</small></div>
    <div class="sl-card-corpo"><div class="row g-3">
        <div class="col-lg-4"><label class="sl-foto" data-ler="doc"><input type="file" accept="image/*,application/pdf" multiple hidden><i class="bi bi-camera"></i><b>Foto do documento</b><small>Foto ou PDF · pode mandar mais de uma</small></label>
                <div class="sl-miniaturas" data-mini="doc"></div>
                <div class="sl-ler" data-status="doc" hidden></div></div>
        <div class="col-lg-8"><div class="row g-2">
            <div class="col-12"><label class="form-label" for="nome">Nome completo do candidato</label><input class="form-control maiusc" id="nome" name="nome" required maxlength="160" value="<?= e($val('nome')) ?>"></div>
            <div class="col-6 col-md-4"><label class="form-label" for="cpf">CPF</label><input class="form-control" id="cpf" name="cpf" inputmode="numeric" maxlength="14" value="<?= e($val('cpf')) ?>" placeholder="000.000.000-00"><div class="invalid-feedback">CPF inválido</div></div>
            <div class="col-6 col-md-4"><label class="form-label" for="nascimento">Data de nascimento</label><input class="form-control" id="nascimento" name="nascimento" type="date" value="<?= e($val('nascimento')) ?>"></div>
            <div class="col-12 col-md-4"><label class="form-label" for="sexo">Sexo</label><select class="form-select" id="sexo" name="sexo"><option value="">—</option><?php foreach (['Feminino', 'Masculino'] as $sx): ?><option<?= $val('sexo') === $sx ? ' selected' : '' ?>><?= $sx ?></option><?php endforeach; ?></select></div>
            <div class="col-md-6"><label class="form-label" for="mae">Nome da mãe</label><input class="form-control maiusc" id="mae" name="mae" maxlength="160" value="<?= e($val('mae')) ?>"></div>
            <div class="col-md-6"><label class="form-label" for="pai">Nome do pai</label><input class="form-control maiusc" id="pai" name="pai" maxlength="160" value="<?= e($val('pai')) ?>"></div>
            <div class="col-md-6"><label class="form-label" for="naturalidade">Naturalidade</label><input class="form-control maiusc" id="naturalidade" name="naturalidade" maxlength="160" value="<?= e($val('naturalidade')) ?>" placeholder="Cidade - UF"></div>
        </div></div>
    </div></div>
</section>

<!-- 2 · comprovante de residência -->
<section class="sl-card">
    <div class="sl-card-cab"><h2><i class="bi bi-house-door"></i>2 · Comprovante de residência</h2><small class="text-secondary">conta de luz, água, internet ou declaração</small></div>
    <div class="sl-card-corpo"><div class="row g-3">
        <div class="col-lg-4"><label class="sl-foto" data-ler="end"><input type="file" accept="image/*,application/pdf" multiple hidden><i class="bi bi-camera"></i><b>Foto do comprovante</b><small>Foto ou PDF · pode mandar mais de uma</small></label>
                <div class="sl-miniaturas" data-mini="end"></div>
                <div class="sl-ler" data-status="end" hidden></div></div>
        <div class="col-lg-8"><div class="row g-2">
            <div class="col-md-8"><label class="form-label" for="titular">Titular do comprovante de residência</label><input class="form-control maiusc" id="titular" name="titular" maxlength="160" value="<?= e($val('titular')) ?>"></div>
            <div class="col-md-4"><label class="form-label" for="telefone">Telefone</label><input class="form-control" id="telefone" name="telefone" inputmode="tel" maxlength="30" value="<?= e($val('telefone')) ?>"></div>
            <div class="col-md-8"><label class="form-label" for="endereco">Endereço</label><input class="form-control maiusc" id="endereco" name="endereco" maxlength="255" value="<?= e($val('endereco')) ?>" placeholder="Rua, número"></div>
            <div class="col-md-4"><label class="form-label" for="cep">CEP</label><input class="form-control" id="cep" name="cep" inputmode="numeric" maxlength="10" value="<?= e($val('cep')) ?>" placeholder="00000-000"></div>
            <div class="col-md-6"><label class="form-label" for="bairro">Bairro / localidade</label><input class="form-control maiusc" id="bairro" name="bairro" maxlength="120" list="listaBairros" value="<?= e($val('bairro')) ?>"><datalist id="listaBairros"><?php foreach (sel_bairros() as $b): ?><option value="<?= e($b) ?>"><?php endforeach; ?></datalist></div>
            <div class="col-md-6"><label class="form-label" for="cidade">Cidade</label><input class="form-control maiusc" id="cidade" name="cidade" maxlength="120" value="<?= e($val('cidade') ?: 'BOA VIAGEM') ?>"></div>
        </div></div>
    </div></div>
</section>

<!-- 3 · histórico 6º ao 8º -->
<section class="sl-card">
    <div class="sl-card-cab"><h2><i class="bi bi-journal-text"></i>3 · Histórico escolar · 6º, 7º e 8º ano</h2></div>
    <div class="sl-card-corpo"><div class="row g-3">
        <div class="col-lg-4"><label class="sl-foto" data-ler="h68"><input type="file" accept="image/*,application/pdf" multiple hidden><i class="bi bi-camera"></i><b>Foto ou PDF do histórico</b><small>Foto ou PDF · pode mandar mais de uma</small></label>
                <div class="sl-miniaturas" data-mini="h68"></div>
                <div class="sl-ler" data-status="h68" hidden></div></div>
        <div class="col-lg-8"><div class="row g-2">
            <div class="col-md-6"><label class="form-label" for="email">E-mail</label><input class="form-control" id="email" name="email" type="email" maxlength="160" value="<?= e($val('email')) ?>"></div>
            <div class="col-md-6"><label class="form-label" for="escola_origem">Escola de origem</label><input class="form-control maiusc" id="escola_origem" name="escola_origem" maxlength="160" value="<?= e($val('escola_origem')) ?>"></div>
        </div>
        <p class="small text-secondary mt-2 mb-0">O telefone lido no histórico vai para o campo Telefone da parte 2, se ele estiver vazio.</p></div>
    </div>
    <div class="sl-tab-rolar"><table class="sl-notas" id="t68"><thead><tr><th>Disciplina</th><th>6º ano</th><th>7º ano</th><th>8º ano</th><th></th></tr></thead><tbody>
            <?php foreach ($disc68 as $ds): ?><tr><td><input class="form-control" name="d68[]" value="<?= e($ds) ?>"></td><?php foreach (['6', '7', '8'] as $a): ?><td><input class="form-control nota" name="n<?= $a ?>[]" inputmode="decimal" value="<?= e($fmt($notas[$a][$ds] ?? '')) ?>"></td><?php endforeach; ?><td><button class="sl-rm" type="button" title="Tirar a disciplina" aria-label="Tirar a disciplina"><i class="bi bi-x-lg"></i></button></td></tr><?php endforeach; ?>
        </tbody></table></div>
        <button class="btn btn-light btn-sm mt-2" type="button" data-add="t68"><i class="bi bi-plus-lg me-1"></i>Disciplina</button>
    </div>
</section>

<!-- 4 · 9º ano -->
<section class="sl-card">
    <div class="sl-card-cab"><h2><i class="bi bi-journal-check"></i>4 · Histórico do 9º ano</h2><small class="text-secondary">bimestres que já tiverem nota</small></div>
    <div class="sl-card-corpo"><div class="row g-3 mb-2"><div class="col-lg-4"><label class="sl-foto" data-ler="h9"><input type="file" accept="image/*,application/pdf" multiple hidden><i class="bi bi-camera"></i><b>Foto ou PDF do 9º ano</b><small>Foto ou PDF · pode mandar mais de uma</small></label>
                <div class="sl-miniaturas" data-mini="h9"></div>
                <div class="sl-ler" data-status="h9" hidden></div></div></div>
    <div class="sl-tab-rolar"><table class="sl-notas" id="t9"><thead><tr><th>Disciplina</th><th>1º bim</th><th>2º bim</th><th>3º bim</th><th>4º bim</th><th>Média</th><th></th></tr></thead><tbody>
            <?php foreach ($disc9 as $ds): $b = (array)($notas['9'][$ds] ?? []); ?><tr><td><input class="form-control" name="d9[]" value="<?= e($ds) ?>"></td><?php foreach ([1, 2, 3, 4] as $k): ?><td><input class="form-control nota" name="b<?= $k ?>[]" inputmode="decimal" value="<?= e($fmt($b[$k - 1] ?? '')) ?>"></td><?php endforeach; ?><td class="text-center fw-bold m9">—</td><td><button class="sl-rm" type="button" title="Tirar a disciplina" aria-label="Tirar a disciplina"><i class="bi bi-x-lg"></i></button></td></tr><?php endforeach; ?>
        </tbody></table></div>
        <button class="btn btn-light btn-sm mt-2" type="button" data-add="t9"><i class="bi bi-plus-lg me-1"></i>Disciplina</button>
    </div>
</section>

<!-- 5 · curso e cotas -->
<section class="sl-card">
    <div class="sl-card-cab"><h2><i class="bi bi-mortarboard"></i>5 · Curso e cotas</h2></div>
    <div class="sl-card-corpo"><div class="row g-3">
        <div class="col-lg-6">
                <label class="form-label">Curso <small class="text-secondary">(só um)</small></label>
                <div class="row g-2">
                    <?php foreach (array_keys($cursos) as $cu): ?>
                    <div class="col-6"><label class="sl-cota"><input class="form-check-input" type="radio" name="curso" value="<?= e($cu) ?>" required<?= $val('curso') === $cu ? ' checked' : '' ?>><span><b><?= e($cu) ?></b></span></label></div>
                    <?php endforeach; ?>
                </div>
            </div>
        <div class="col-lg-6">
                <label class="form-label">Concorre também por cota</label>
                <div class="vstack gap-2">
                    <label class="sl-cota"><input class="form-check-input" type="checkbox" name="cota_bairro" id="cotaBairro" value="1"<?= $val('cota_bairro') ? ' checked' : '' ?>><span><b>Cota de bairro</b><small id="cotaDica">Mora em: <?= e(implode(', ', sel_bairros())) ?>. Marcada sozinha quando o bairro bate.</small></span></label>
                    <label class="sl-cota"><input class="form-check-input" type="checkbox" name="pcd" value="1"<?= $val('pcd') ? ' checked' : '' ?>><span><b>Pessoa com deficiência (PCD)</b><small>Com laudo médico.</small></span></label>
                </div>
                <p class="small text-secondary mt-2 mb-0">Quem é de cota disputa as vagas da cota e também as de ampla concorrência.</p>
        </div>
    </div></div>
</section>

<div class="sl-media-viva mb-3">
    <div><span>Média geral (todas as disciplinas, 6º ao 9º)</span><br><b id="mGeral">—</b></div>
    <div class="sl-mv-anos"><?php foreach (['6', '7', '8', '9'] as $a): ?><div><span><?= $a ?>º ano</span><strong id="mA<?= $a ?>">—</strong></div><?php endforeach; ?><div><span>notas</span><strong id="mQtd">0</strong></div></div>
</div>
<div class="sl-card"><div class="sl-card-corpo"><label class="form-label" for="obs">Observações</label><textarea class="form-control" id="obs" name="obs" rows="2" maxlength="500"><?= e($val('obs')) ?></textarea></div></div>

<div class="sl-salvar">
    <?php if ($c && eh_admin()): ?><button class="btn btn-light text-danger me-auto" type="submit" name="acao" value="excluir" formnovalidate onclick="return confirm('Excluir este candidato da seleção?')"><i class="bi bi-trash me-1"></i>Excluir</button><?php endif; ?>
    <?php if (!$c): ?><button class="btn btn-light" name="depois" value="novo"><i class="bi bi-plus-lg me-1"></i>Salvar <span class="d-none d-md-inline">e cadastrar outro</span><span class="d-md-none">e novo</span></button><?php endif; ?>
    <button class="btn btn-primary px-4"><i class="bi bi-check2 me-1"></i>Salvar<span class="d-none d-md-inline"> candidato</span></button>
</div>
</form>
<?php
$scripts = '<script>window.SEL_BAIRROS = ' . json_encode(sel_bairros(), JSON_UNESCAPED_UNICODE) . '; window.SEL_CSRF = ' . json_encode(csrf_token()) . ';</script><script type="module" src="assets/js/candidato.js?v=' . SEL_VERSAO . '"></script>';
require __DIR__ . '/includes/rodape.php';
