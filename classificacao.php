<?php
/* Classificação por curso: ampla concorrência, PCD, cota de bairro e lista de espera */
require __DIR__ . '/includes/base.php';
$u = exigir_login();
$cursos = sel_cursos(); $nomes = array_keys($cursos);
$curso = in_array($_GET['curso'] ?? '', $nomes, true) ? $_GET['curso'] : $nomes[0];
$r = sel_classificar($curso);
$rot = ['ampla' => 'Ampla concorrência', 'pcd' => 'Cota PCD', 'bairro' => 'Cota de bairro'];
if (($_GET['baixar'] ?? '') === 'csv') {
    registrar('baixou', 'classificação ' . $curso);
    header('Content-Type: text/csv; charset=UTF-8'); header('Content-Disposition: attachment; filename="classificacao_' . preg_replace('/\W+/', '_', sem_acento($curso)) . '_' . sel_ano() . '.csv"');
    $o = fopen('php://output', 'w'); fwrite($o, "\xEF\xBB\xBF");
    fputcsv($o, ['Posição', 'Nome', 'CPF', 'Nascimento', 'Média', 'Situação', 'Vaga'], ';');
    foreach ($r['lista'] as $x) fputcsv($o, [$x['pos_geral'], $x['nome'], $x['cpf'], $x['nascimento'] ? date('d/m/Y', strtotime($x['nascimento'])) : '', number_format((float)$x['media'], 3, ',', ''), $x['vaga'] ? 'Classificado' : 'Lista de espera (' . $x['espera'] . 'º)', $x['vaga'] ? $rot[$x['vaga']] : ''], ';');
    exit;
}
$sem = (int)q_valor("SELECT COUNT(*) FROM sel_candidatos WHERE ano = ? AND curso = ? AND media IS NULL", [sel_ano(), $curso]);
$titulo = 'Classificação';
$subtitulo = 'Pela média de todas as disciplinas do 6º ao 9º ano · desempate: ' . sel_desempates()[cfg('desempate', 'idade')];
$acoes_cab = '<button class="btn btn-light" onclick="print()"><i class="bi bi-printer me-1"></i>Imprimir</button><a class="btn btn-light" href="?curso=' . urlencode($curso) . '&baixar=csv"><i class="bi bi-download me-1"></i>Planilha</a>';
require __DIR__ . '/includes/topo.php';
$cl = array_filter($r['lista'], fn($x) => $x['vaga']); $esp = array_filter($r['lista'], fn($x) => !$x['vaga']);
?>
<div class="sl-curso-abas"><?php foreach ($nomes as $n): ?><a href="?curso=<?= urlencode($n) ?>" class="<?= $n === $curso ? 'ativo' : '' ?>"><?= e($n) ?></a><?php endforeach; ?></div>
<?php if ((int)$cursos[$curso][2] === 0): ?><div class="sl-aviso atencao nao-imprimir"><i class="bi bi-exclamation-triangle"></i><span>As vagas da cota de bairro deste curso ainda estão em 0. Defina em <a href="configuracoes.php">Configurações</a>.</span></div><?php endif; ?>
<?php if ($sem): ?><div class="sl-aviso atencao nao-imprimir"><i class="bi bi-exclamation-triangle"></i><span><?= $sem ?> candidato(s) deste curso ainda sem notas não entram na classificação.</span></div><?php endif; ?>
<div class="sl-imprimir-cab"><h2>EEEP Venceslau Vieira Batista · Seleção <?= sel_ano() ?></h2><h3><?= e($curso) ?></h3></div>
<div class="sl-card">
    <div class="sl-card-cab"><h2><i class="bi bi-trophy"></i><?= e($curso) ?></h2>
        <div class="sl-vagas ms-auto">
            <span class="sl-vaga"><b><?= $r['vagas']['total'] ?></b> vagas</span>
            <span class="sl-vaga">Ampla <b><?= $r['usados']['ampla'] ?></b>/<?= $r['vagas']['ampla'] + $r['extra'] ?></span>
            <span class="sl-vaga">PCD <b><?= $r['usados']['pcd'] ?></b>/<?= $r['vagas']['pcd'] ?></span>
            <span class="sl-vaga">Bairro <b><?= $r['usados']['bairro'] ?></b>/<?= $r['vagas']['bairro'] ?></span>
            <span class="sl-vaga">Espera <b><?= count($esp) ?></b></span>
        </div></div>
    <?php if ($r['extra']): ?><div class="px-3 pt-2 small text-secondary"><i class="bi bi-arrow-return-right me-1"></i><?= $r['extra'] ?> vaga(s) de cota sem candidato passaram para a ampla concorrência.</div><?php endif; ?>
    <?php if (!$r['lista']): ?><div class="sl-vazio"><i class="bi bi-trophy"></i>Nenhum candidato com notas neste curso ainda.</div><?php else: ?>
    <div class="sl-tab-rolar"><table class="sl-tab">
        <thead><tr><th class="num">#</th><th>Nome</th><th>Nascimento</th><th>Concorre</th><th class="num">Média</th><th>Resultado</th></tr></thead>
        <tbody>
        <?php $ult = count($cl); $i = 0; foreach ($r['lista'] as $x): $i++; ?>
            <tr class="<?= $x['vaga'] && $i === $ult ? 'sl-corte' : '' ?>">
                <td class="num fw-bold"><?= $x['pos_geral'] ?>º</td>
                <td><a class="sl-nome" href="candidato.php?id=<?= $x['id'] ?>"><?= e($x['nome']) ?></a></td>
                <td><?= $x['nascimento'] ? date('d/m/Y', strtotime($x['nascimento'])) : '—' ?></td>
                <td><?= $x['cota_bairro'] ? '<span class="sl-selo bairro">Bairro</span> ' : '' ?><?= $x['pcd'] ? '<span class="sl-selo pcd">PCD</span>' : '' ?></td>
                <td class="num"><span class="sl-media"><?= nota_fmt($x['media'], 3) ?></span></td>
                <td><?= $x['vaga'] ? '<span class="sl-selo ok"><i class="bi bi-check2"></i>' . $rot[$x['vaga']] . '</span>' : '<span class="sl-selo espera">Espera · ' . $x['espera'] . 'º</span>' ?></td>
            </tr>
        <?php endforeach; ?>
        </tbody>
    </table></div>
    <?php endif; ?>
</div>
<p class="small text-secondary">Como funciona: primeiro as vagas de ampla concorrência são preenchidas pela média, com todos os candidatos. Depois as vagas PCD e de bairro vão para os candidatos dessas cotas que ainda não entraram. <?= cfg('sobra_ampla', '1') === '1' ? 'Vaga de cota sem candidato passa para a ampla concorrência.' : '' ?></p>
<?php require __DIR__ . '/includes/rodape.php';
