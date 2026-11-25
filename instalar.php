<?php
/* Primeiro acesso: cria o administrador da seleção.
 * Só funciona enquanto não existe nenhum usuário e pede a chave de instalação do config.php. */
require __DIR__ . '/includes/base.php';
if (q_valor('SELECT COUNT(*) FROM sel_usuarios')) redirecionar('index.php');
$erro = '';
$chave = defined('SEL_CHAVE_INSTALACAO') ? (string)SEL_CHAVE_INSTALACAO : '';
if (eh_post()) {
    csrf_verificar();
    $nome = nome_proprio(mb_substr(trim((string)($_POST['nome'] ?? '')), 0, 120));
    $email = mb_strtolower(trim((string)($_POST['email'] ?? ''))); $senha = (string)($_POST['senha'] ?? '');
    if ($chave === '' || strlen($chave) < 12 || str_starts_with($chave, 'troque-por')) $erro = 'Defina SEL_CHAVE_INSTALACAO no includes/config.php do servidor antes de ativar.';
    elseif (!hash_equals($chave, (string)($_POST['chave'] ?? ''))) { $erro = 'A chave de instalação não confere.'; usleep(800000); }
    elseif (mb_strlen($nome) < 3 || !filter_var($email, FILTER_VALIDATE_EMAIL)) $erro = 'Preencha seu nome e um e-mail válido.';
    elseif (mb_strlen($senha) < 8) $erro = 'A senha precisa ter pelo menos 8 caracteres.';
    else {
        q('INSERT INTO sel_usuarios (nome, email, senha_hash, papel, ativo, criado_em) VALUES (?, ?, ?, ?, 1, ?)', [$nome, $email, password_hash($senha, PASSWORD_DEFAULT), 'admin', agora()]);
        session_regenerate_id(true);
        $_SESSION['sel_uid'] = (int)db()->lastInsertId(); $_SESSION['sel_visto'] = time();
        registrar('instalou', $email);
        flash('ok', 'Pronto! Você é o administrador da seleção. Confira as vagas e cadastre a equipe em Usuários.');
        redirecionar('configuracoes.php');
    }
}
?><!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow">
<title>Primeiro acesso · Seleção</title>
<link href="assets/vendor/bootstrap/bootstrap.min.css" rel="stylesheet"><link href="assets/vendor/icons/bootstrap-icons.min.css" rel="stylesheet"><link href="assets/css/selecao.css?v=<?= SEL_VERSAO ?>" rel="stylesheet"></head>
<body class="sl-login"><div class="sl-login-wrap">
<div class="sl-login-logo"><img src="assets/img/logo-branca.png" alt="EEEP Venceslau Vieira Batista" width="1400" height="451"></div>
<form method="post" class="sl-login-caixa"><?= csrf_campo() ?>
    <h1>Primeiro <b>acesso</b></h1>
    <p class="sl-sub">Crie a conta do administrador da seleção. Use a chave de instalação que está no arquivo de configuração do servidor.</p>
    <?php if ($erro): ?><div class="sl-aviso erro"><i class="bi bi-exclamation-octagon"></i><span><?= e($erro) ?></span></div><?php endif; ?>
    <div class="mb-3"><label class="form-label" for="chave">Chave de instalação</label><input class="form-control" id="chave" name="chave" type="password" required></div>
    <div class="mb-3"><label class="form-label" for="nome">Seu nome</label><input class="form-control" id="nome" name="nome" required value="<?= e($_POST['nome'] ?? '') ?>"></div>
    <div class="mb-3"><label class="form-label" for="email">E-mail</label><input class="form-control" id="email" name="email" type="email" required value="<?= e($_POST['email'] ?? '') ?>"></div>
    <div class="mb-3"><label class="form-label" for="senha">Senha <small class="text-secondary">(mínimo 8 caracteres)</small></label><input class="form-control" id="senha" name="senha" type="password" minlength="8" required autocomplete="new-password"></div>
    <button class="btn btn-primary w-100 py-2">Criar administrador</button>
</form></div></body></html>
