<?php
/* Cabeçalho das páginas internas. Antes de incluir: $titulo, $menu (opcional), $u = usuário logado */
$_menu = [
    ['candidatos.php', 'people', 'Candidatos'],
    ['candidato.php', 'person-plus', 'Novo candidato'],
    ['classificacao.php', 'trophy', 'Classificação'],
];
if (($u['papel'] ?? '') === 'admin') { $_menu[] = ['configuracoes.php', 'sliders', 'Configurações']; $_menu[] = ['usuarios.php', 'person-gear', 'Usuários']; }
$_aqui = basename($_SERVER['SCRIPT_NAME']);
?><!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="#0b4a20">
<title><?= e($titulo ?? 'Seleção') ?> · Seleção <?= sel_ano() ?> · EEEP Venceslau</title>
<link href="assets/vendor/bootstrap/bootstrap.min.css" rel="stylesheet">
<link href="assets/vendor/icons/bootstrap-icons.min.css" rel="stylesheet">
<link href="assets/css/selecao.css?v=<?= SEL_VERSAO ?>" rel="stylesheet">
<link rel="icon" href="assets/img/favicon.png" type="image/png">
</head>
<body class="sl-corpo">
<header class="sl-topo">
    <div class="sl-topo-in">
        <a class="sl-marca" href="candidatos.php"><img src="assets/img/logo-branca.png" alt="EEEP Venceslau Vieira Batista" width="1400" height="451"><span>Seleção <b><?= sel_ano() ?></b></span></a>
        <nav class="sl-nav" aria-label="Menu">
            <?php foreach ($_menu as [$_h, $_i, $_r]): ?><a href="<?= $_h ?>" class="<?= $_aqui === $_h ? 'ativo' : '' ?>"><i class="bi bi-<?= $_i ?>"></i><span><?= $_r ?></span></a><?php endforeach; ?>
        </nav>
        <div class="dropdown sl-eu">
            <button class="sl-eu-bt" type="button" data-bs-toggle="dropdown" aria-expanded="false"><span class="sl-av"><?= e(mb_strtoupper(mb_substr($u['nome'], 0, 1))) ?></span><span class="sl-eu-n"><?= e(explode(' ', $u['nome'])[0]) ?></span><i class="bi bi-chevron-down"></i></button>
            <div class="dropdown-menu dropdown-menu-end shadow">
                <span class="dropdown-item-text small text-secondary"><?= e($u['email']) ?><br><?= $u['papel'] === 'admin' ? 'Administrador da seleção' : 'Digitador' ?></span>
                <a class="dropdown-item" href="senha.php"><i class="bi bi-key me-2"></i>Trocar minha senha</a>
                <form method="post" action="sair.php"><?= csrf_campo() ?><button class="dropdown-item text-danger"><i class="bi bi-box-arrow-right me-2"></i>Sair</button></form>
            </div>
        </div>
    </div>
</header>
<nav class="sl-nav-cel" aria-label="Menu">
    <?php foreach ($_menu as [$_h, $_i, $_r]): ?><a href="<?= $_h ?>" class="<?= $_aqui === $_h ? 'ativo' : '' ?>"><i class="bi bi-<?= $_i ?>"></i><span><?= $_r === 'Novo candidato' ? 'Novo' : ($_r === 'Configurações' ? 'Ajustes' : $_r) ?></span></a><?php endforeach; ?>
</nav>
<main class="sl-main">
    <div class="sl-cab">
        <div><h1><?= e($titulo ?? '') ?></h1><?php if (!empty($subtitulo)): ?><p><?= e($subtitulo) ?></p><?php endif; ?></div>
        <?php if (!empty($acoes_cab)) echo '<div class="sl-cab-acoes">' . $acoes_cab . '</div>'; ?>
    </div>
    <?= flash_html() ?>
