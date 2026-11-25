<?php
/* Lista de candidatos da seleção */
require __DIR__ . '/includes/base.php';
$u = exigir_login();
$ano = sel_ano(); $cursos = sel_cursos();
$fc = (string)($_GET['curso'] ?? ''); $fb = trim((string)($_GET['b'] ?? '')); $ft = (string)($_GET['tipo'] ?? '');
$w = ['ano = ?']; $p = [$ano];
if (isset($cursos[$fc])) { $w[] = 'curso = ?'; $p[] = $fc; }
if ($ft === 'pcd') $w[] = 'pcd = 1'; elseif ($ft === 'bairro') $w[] = 'cota_bairro = 1'; elseif ($ft === 'sem_notas') $w[] = 'media IS NULL';
if ($fb !== '') { $w[] = '(nome LIKE ? OR cpf LIKE ? OR mae LIKE ?)'; $l = '%' . $fb . '%'; array_push($p, $l, '%' . (so_digitos($fb) ? cpf_fmt($fb) : $fb) . '%', $l); }
$lista = q_todos('SELECT id, nome, cpf, nascimento, curso, cota_bairro, pcd, media, bairro, criado_em FROM sel_candidatos WHERE ' . implode(' AND ', $w) . ' ORDER BY nome', $p);

if (($_GET['baixar'] ?? '') === 'csv') {
    registrar('baixou', 'lista de candidatos');
    header('Content-Type: text/csv; charset=UTF-8'); header('Content-Disposition: attachment; filename="candidatos_' . $ano . '.csv"');
    $o = fopen('php://output', 'w'); fwrite($o, "\xEF\xBB\xBF");
    fputcsv($o, ['Nome', 'CPF', 'Nascimento', 'Mãe', 'Pai', 'Telefone', 'E-mail', 'Endereço', 'Bairro', 'Cidade', 'Escola de origem', 'Curso', 'Cota bairro', 'PCD', 'Média'], ';');
    foreach (q_todos('SELECT * FROM sel_candidatos WHERE ' . implode(' AND ', $w) . ' ORDER BY curso, nome', $p) as $x)
        fputcsv($o, [$x['nome'], $x['cpf'], $x['nascimento'] ? date('d/m/Y', strtotime($x['nascimento'])) : '', $x['mae'], $x['pai'], $x['telefone'], $x['email'], $x['endereco'], $x['bairro'], $x['cidade'], $x['escola_origem'], $x['curso'], $x['cota_bairro'] ? 'Sim' : 'Não', $x['pcd'] ? 'Sim' : 'Não', $x['media'] === null ? '' : number_format((float)$x['media'], 3, ',', '')], ';');
    exit;
}

$tot = q_um("SELECT COUNT(*) t, SUM(pcd) pcd, SUM(cota_bairro) bairro, SUM(CASE WHEN media IS NULL THEN 1 ELSE 0 END) sem FROM sel_candidatos WHERE ano = ?", [$ano]);
$porCurso = []; foreach (q_todos('SELECT curso, COUNT(*) n FROM sel_candidatos WHERE ano = ? GROUP BY curso', [$ano]) as $r) $porCurso[$r['curso']] = (int)$r['n'];
$titulo = 'Candidatos';
$subtitulo = 'Seleção ' . $ano . ' · ' . count($cursos) . ' cursos';
$acoes_cab = '<a class="btn btn-light" href="?' . e(http_build_query(array_merge($_GET, ['baixar' => 'csv']))) . '"><i class="bi bi-download me-1"></i>Planilha</a><a class="btn btn-primary" href="candidato.php"><i class="bi bi-person-plus me-1"></i>Novo candidato</a>';
require __DIR__ . '/includes/topo.php';
$ver = (int)($_GET['ver'] ?? 0);
?>
<div class="sl-resumo">
    <div class="sl-res"><small>Inscritos</small><b><?= (int)$tot['t'] ?></b><span><?= implode(' · ', array_map(fn($c) => e($c) . ' ' . ($porCurso[$c] ?? 0), array_keys($cursos))) ?></span></div>
    <div class="sl-res"><small>Cota de bairro</small><b><?= (int)$tot['bairro'] ?></b><span><?= e(implode(', ', sel_bairros())) ?></span></div>
    <div class="sl-res"><small>PCD</small><b><?= (int)$tot['pcd'] ?></b><span>com laudo</span></div>
    <div class="sl-res"><small>Sem notas</small><b><?= (int)$tot['sem'] ?></b><span>ainda sem média</span></div>
</div>
<div class="sl-card">
    <form class="sl-card-cab sl-filtros" method="get">
        <input class="form-control sl-busca" type="search" name="b" value="<?= e($fb) ?>" placeholder="Buscar por nome, CPF ou mãe">
        <select class="form-select" name="curso" onchange="this.form.submit()"><option value="">Todos os cursos</option><?php foreach (array_keys($cursos) as $c): ?><option<?= $fc === $c ? ' selected' : '' ?>><?= e($c) ?></option><?php endforeach; ?></select>
        <select class="form-select" name="tipo" onchange="this.form.submit()"><option value="">Todos</option><option value="bairro"<?= $ft === 'bairro' ? ' selected' : '' ?>>Cota de bairro</option><option value="pcd"<?= $ft === 'pcd' ? ' selected' : '' ?>>PCD</option><option value="sem_notas"<?= $ft === 'sem_notas' ? ' selected' : '' ?>>Sem notas</option></select>
        <button class="btn btn-light"><i class="bi bi-search"></i></button>
    </form>
    <?php if (!$lista): ?>
    <div class="sl-vazio"><i class="bi bi-people"></i><?= $tot['t'] ? 'Ninguém encontrado com esse filtro.' : 'Nenhum candidato cadastrado ainda.' ?><br><a class="btn btn-primary mt-3" href="candidato.php"><i class="bi bi-person-plus me-1"></i>Cadastrar o primeiro</a></div>
    <?php else: ?>
    <div class="sl-tab-rolar"><table class="sl-tab cartoes">
        <thead><tr><th>Nome</th><th>CPF</th><th>Curso</th><th>Concorre</th><th class="num">Média</th></tr></thead>
        <tbody>
        <?php foreach ($lista as $x): ?>
            <tr<?= $x['id'] == $ver ? ' style="background:#fff8d6"' : '' ?>>
                <td><a class="sl-nome" href="candidato.php?id=<?= $x['id'] ?>"><?= e($x['nome']) ?></a></td>
                <td data-c="CPF"><?= e($x['cpf']) ?></td>
                <td data-c="Curso"><?= e($x['curso']) ?></td>
                <td><span class="sl-selo ampla">Ampla</span> <?= $x['cota_bairro'] ? '<span class="sl-selo bairro">Bairro</span>' : '' ?> <?= $x['pcd'] ? '<span class="sl-selo pcd">PCD</span>' : '' ?></td>
                <td class="num"><?= $x['media'] === null ? '<span class="sl-selo espera">sem notas</span>' : '<span class="sl-media">' . nota_fmt($x['media'], 3) . '</span>' ?></td>
            </tr>
        <?php endforeach; ?>
        </tbody>
    </table></div>
    <?php endif; ?>
</div>
<?php require __DIR__ . '/includes/rodape.php';
