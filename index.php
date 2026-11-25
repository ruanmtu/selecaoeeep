<?php
/* Entrada: só login. Quem já entrou vai direto para os candidatos. */
require __DIR__ . '/includes/base.php';
if (usuario()) redirecionar('candidatos.php');
if (!q_valor('SELECT COUNT(*) FROM sel_usuarios')) redirecionar('instalar.php');

$erro = '';
$_SESSION['sel_tent'] = array_values(array_filter($_SESSION['sel_tent'] ?? [], fn($t) => $t > time() - 900));
if (eh_post()) {
    csrf_verificar();
    $email = mb_strtolower(trim((string)($_POST['email'] ?? ''))); $senha = (string)($_POST['senha'] ?? '');
    if (count($_SESSION['sel_tent']) >= 6) $erro = 'Muitas tentativas seguidas. Aguarde 15 minutos e tente de novo.';
    else {
        $x = q_um('SELECT * FROM sel_usuarios WHERE email = ?', [$email]);
        if ($x && $x['ativo'] && password_verify($senha, $x['senha_hash'])) {
            session_regenerate_id(true);
            $_SESSION['sel_uid'] = (int)$x['id']; $_SESSION['sel_visto'] = time(); $_SESSION['sel_tent'] = [];
            q('UPDATE sel_usuarios SET ultimo_acesso = ? WHERE id = ?', [agora(), $x['id']]);
            registrar('entrou', $email);
            redirecionar('candidatos.php');
        }
        $_SESSION['sel_tent'][] = time();
        $erro = 'E-mail ou senha não conferem.';
        usleep(400000);
    }
}
?><!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow"><meta name="theme-color" content="#0b4a20">
<title>Entrar · Seleção <?= sel_ano() ?> · EEEP Venceslau</title>
<link href="assets/vendor/bootstrap/bootstrap.min.css" rel="stylesheet"><link href="assets/vendor/icons/bootstrap-icons.min.css" rel="stylesheet">
<link href="assets/css/selecao.css?v=<?= SEL_VERSAO ?>" rel="stylesheet"><link rel="icon" href="assets/img/favicon.png" type="image/png">
</head>
<body class="sl-login">
<div class="sl-login-wrap">
    <div class="sl-login-logo"><img src="assets/img/logo-branca.png" alt="EEEP Venceslau Vieira Batista" width="1400" height="451"></div>
    <form method="post" class="sl-login-caixa" autocomplete="on">
        <?= csrf_campo() ?>
        <h1>Seleção <b><?= sel_ano() ?></b></h1>
        <p class="sl-sub">Sistema interno da seleção de estudantes.<br>Entre com o seu e-mail e senha.</p>
        <?php if (isset($_GET['expirou'])): ?><div class="sl-aviso atencao"><i class="bi bi-clock"></i><span>Sua sessão expirou. Entre de novo.</span></div><?php endif; ?>
        <?php if ($erro): ?><div class="sl-aviso erro"><i class="bi bi-exclamation-octagon"></i><span><?= e($erro) ?></span></div><?php endif; ?>
        <div class="mb-3"><label class="form-label" for="email">E-mail</label><input class="form-control" id="email" name="email" type="email" required autocomplete="username" value="<?= e($_POST['email'] ?? '') ?>" autofocus></div>
        <div class="mb-3"><label class="form-label" for="senha">Senha</label>
            <div class="position-relative"><input class="form-control pe-5" id="senha" name="senha" type="password" required autocomplete="current-password">
            <button class="btn btn-link position-absolute top-0 end-0 h-100 text-secondary" type="button" onclick="const s=senha;s.type=s.type==='password'?'text':'password';this.firstChild.className='bi bi-'+(s.type==='password'?'eye':'eye-slash')" aria-label="Mostrar a senha"><i class="bi bi-eye"></i></button></div></div>
        <button class="btn btn-primary w-100 py-2"><i class="bi bi-box-arrow-in-right me-1"></i>Entrar</button>
        <div class="sl-selo-int"><i class="bi bi-shield-lock"></i>Acesso restrito à equipe da seleção</div>
    </form>
</div>
</body>
</html>
