<?php
require __DIR__ . '/includes/base.php';
$u = exigir_login();
if (eh_post()) {
    csrf_verificar();
    $x = q_um('SELECT senha_hash FROM sel_usuarios WHERE id = ?', [$u['id']]);
    $nova = (string)($_POST['nova'] ?? '');
    if (!password_verify((string)($_POST['atual'] ?? ''), $x['senha_hash'])) flash('erro', 'A senha atual não confere.');
    elseif (mb_strlen($nova) < 8) flash('erro', 'A nova senha precisa ter pelo menos 8 caracteres.');
    elseif ($nova !== ($_POST['conf'] ?? '')) flash('erro', 'A confirmação não é igual à nova senha.');
    else { q('UPDATE sel_usuarios SET senha_hash = ? WHERE id = ?', [password_hash($nova, PASSWORD_DEFAULT), $u['id']]); registrar('senha'); flash('ok', 'Senha trocada.'); redirecionar('candidatos.php'); }
    redirecionar('senha.php');
}
$titulo = 'Trocar minha senha';
require __DIR__ . '/includes/topo.php';
?>
<form method="post" class="sl-card" style="max-width:480px"><?= csrf_campo() ?>
    <div class="sl-card-corpo vstack gap-3">
        <div><label class="form-label" for="a">Senha atual</label><input class="form-control" id="a" type="password" name="atual" required autocomplete="current-password"></div>
        <div><label class="form-label" for="n">Nova senha <small class="text-secondary">(mínimo 8 caracteres)</small></label><input class="form-control" id="n" type="password" name="nova" minlength="8" required autocomplete="new-password"></div>
        <div><label class="form-label" for="c">Repita a nova senha</label><input class="form-control" id="c" type="password" name="conf" minlength="8" required autocomplete="new-password"></div>
        <div><button class="btn btn-primary">Salvar</button></div>
    </div>
</form>
<?php require __DIR__ . '/includes/rodape.php';
