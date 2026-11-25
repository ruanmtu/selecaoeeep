<?php
/* Configurações da seleção (só administrador) */
require __DIR__ . '/includes/base.php';
$u = exigir_admin();
if (eh_post()) {
    csrf_verificar();
    $ano = (int)($_POST['ano'] ?? 2027); if ($ano < 2026 || $ano > 2100) $ano = 2027;
    $cursos = [];
    foreach ((array)($_POST['cnome'] ?? []) as $i => $n) {
        $n = mb_substr(trim((string)$n), 0, 60); if ($n === '') continue;
        $t = max(0, (int)($_POST['ctotal'][$i] ?? 0)); $pcd = max(0, (int)($_POST['cpcd'][$i] ?? 0)); $b = max(0, (int)($_POST['cbairro'][$i] ?? 0));
        if ($pcd + $b > $t) { flash('erro', "Em $n, as vagas de cota passam do total."); redirecionar('configuracoes.php'); }
        $cursos[$n] = [$t, $pcd, $b];
    }
    if (!$cursos) { flash('erro', 'Deixe pelo menos um curso.'); redirecionar('configuracoes.php'); }
    $bairros = array_values(array_filter(array_map(fn($x) => mb_substr(trim($x), 0, 80), preg_split('/[\n,;]+/', (string)($_POST['bairros'] ?? '')))));
    cfg_gravar('ano', (string)$ano);
    cfg_gravar('cursos', json_encode($cursos, JSON_UNESCAPED_UNICODE));
    cfg_gravar('bairros', json_encode($bairros, JSON_UNESCAPED_UNICODE));
    cfg_gravar('desempate', array_key_exists($_POST['desempate'] ?? '', sel_desempates()) ? $_POST['desempate'] : 'idade');
    cfg_gravar('sobra_ampla', !empty($_POST['sobra_ampla']) ? '1' : '0');
    registrar('configurou');
    flash('ok', 'Configurações salvas.');
    redirecionar('configuracoes.php');
}
$cursos = sel_cursos();
$titulo = 'Configurações';
$subtitulo = 'Cursos, vagas, bairros da cota e desempate';
require __DIR__ . '/includes/topo.php';
?>
<form method="post"><?= csrf_campo() ?>
<div class="sl-card"><div class="sl-card-cab"><h2><i class="bi bi-mortarboard"></i>Cursos e vagas</h2></div>
    <div class="sl-card-corpo">
        <div class="row g-2 mb-3"><div class="col-6 col-md-3"><label class="form-label" for="ano">Ano da seleção</label><input class="form-control" id="ano" name="ano" type="number" value="<?= sel_ano() ?>"></div></div>
        <div class="sl-tab-rolar"><table class="sl-notas" id="tCursos"><thead><tr><th>Curso</th><th>Total de vagas</th><th>Vagas PCD</th><th>Vagas bairro</th><th>Ampla</th><th></th></tr></thead><tbody>
        <?php foreach ($cursos as $n => [$t, $p, $b]): ?>
            <tr><td><input class="form-control" name="cnome[]" value="<?= e($n) ?>"></td><td><input class="form-control" type="number" min="0" name="ctotal[]" value="<?= (int)$t ?>"></td><td><input class="form-control" type="number" min="0" name="cpcd[]" value="<?= (int)$p ?>"></td><td><input class="form-control" type="number" min="0" name="cbairro[]" value="<?= (int)$b ?>"></td><td class="text-center fw-bold amp"><?= (int)$t - (int)$p - (int)$b ?></td><td><button class="sl-rm" type="button" onclick="this.closest('tr').remove()" aria-label="Tirar o curso"><i class="bi bi-x-lg"></i></button></td></tr>
        <?php endforeach; ?>
        </tbody></table></div>
        <button class="btn btn-light btn-sm mt-2" type="button" onclick="const t=document.querySelector('#tCursos tbody'),r=t.rows[0].cloneNode(true);r.querySelectorAll('input').forEach(i=>i.value=i.type==='number'?0:'');t.appendChild(r)"><i class="bi bi-plus-lg me-1"></i>Curso</button>
    </div></div>
<div class="sl-card"><div class="sl-card-cab"><h2><i class="bi bi-geo-alt"></i>Cota de bairro</h2></div>
    <div class="sl-card-corpo"><label class="form-label" for="bairros">Bairros que entram na cota <small class="text-secondary">(um por linha)</small></label>
        <textarea class="form-control" id="bairros" name="bairros" rows="4"><?= e(implode("\n", sel_bairros())) ?></textarea>
        <p class="small text-secondary mt-2 mb-0">Quando o endereço ou o bairro do candidato tem um desses nomes, a cota de bairro é marcada sozinha (dá para desmarcar).</p></div></div>
<div class="sl-card"><div class="sl-card-cab"><h2><i class="bi bi-sort-down"></i>Classificação</h2></div>
    <div class="sl-card-corpo vstack gap-3">
        <div style="max-width:420px"><label class="form-label" for="desempate">Desempate (médias iguais)</label><select class="form-select" id="desempate" name="desempate"><?php foreach (sel_desempates() as $k => $r): ?><option value="<?= $k ?>"<?= cfg('desempate', 'idade') === $k ? ' selected' : '' ?>><?= e($r) ?></option><?php endforeach; ?></select></div>
        <label class="form-check"><input class="form-check-input" type="checkbox" name="sobra_ampla" value="1"<?= cfg('sobra_ampla', '1') === '1' ? ' checked' : '' ?>> <span class="form-check-label">Vaga de cota sem candidato passa para a ampla concorrência</span></label>
    </div></div>
<div class="sl-salvar"><button class="btn btn-primary px-4"><i class="bi bi-check2 me-1"></i>Salvar configurações</button></div>
</form>
<script>document.getElementById('tCursos').addEventListener('input',e=>{const r=e.target.closest('tr'),v=[...r.querySelectorAll('input[type=number]')].map(i=>+i.value||0);r.querySelector('.amp').textContent=v[0]-v[1]-v[2];});</script>
<?php require __DIR__ . '/includes/rodape.php';
