<?php
/* Cabeçalho (igual ao do sistema da escola) + menu lateral. Antes de incluir: $titulo, $u = usuário logado */
$_menu = [
    ['candidatos.php', 'people', 'Candidatos'],
    ['candidato.php', 'person-plus', 'Novo candidato'],
    ['classificacao.php', 'trophy', 'Classificação'],
];
if (($u['papel'] ?? '') === 'admin') { $_menu[] = ['configuracoes.php', 'sliders', 'Configurações']; $_menu[] = ['usuarios.php', 'person-gear', 'Usuários']; }
$_aqui = basename($_SERVER['SCRIPT_NAME']);
if ($_aqui === 'candidato.php' && !empty($_GET['id'])) $_aqui = 'candidatos.php';
$_ini = mb_strtoupper(implode('', array_map(fn($p) => mb_substr($p, 0, 1), array_slice(preg_split('/\s+/', trim($u['nome'])), 0, 2))));
$_cargo = $u['papel'] === 'admin' ? 'Administrador da seleção' : 'Equipe da seleção';
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
<header class="sl-cab">
    <div class="sl-barra">
        <a class="sl-logo" href="candidatos.php" aria-label="Início"><img src="assets/img/logo-branca.png" alt="EEEP Venceslau Vieira Batista" width="1400" height="451"></a>
        <span class="sl-nome-sis">Seleção <b><?= sel_ano() ?></b></span>
        <div class="dropdown ms-auto">
            <button class="sl-usuario" type="button" data-bs-toggle="dropdown" aria-expanded="false" aria-label="Minha conta">
                <span class="sl-av"><?= e($_ini) ?></span>
                <span class="sl-usuario-txt"><strong><?= e($u['nome']) ?></strong><small><?= $_cargo ?></small></span>
                <i class="bi bi-chevron-down"></i>
            </button>
            <div class="dropdown-menu dropdown-menu-end shadow">
                <span class="dropdown-item-text small text-secondary"><?= e($u['email']) ?></span>
                <a class="dropdown-item" href="senha.php"><i class="bi bi-key me-2"></i>Trocar minha senha</a>
                <form method="post" action="sair.php"><?= csrf_campo() ?><button class="dropdown-item text-danger"><i class="bi bi-box-arrow-right me-2"></i>Sair</button></form>
            </div>
        </div>
    </div>
</header>
<div class="sl-casca">
    <aside class="sl-lado" aria-label="Menu">
        <nav>
            <?php foreach ($_menu as [$_h, $_i, $_r]): ?><a href="<?= $_h ?>" class="<?= $_aqui === $_h ? 'ativo' : '' ?>"<?= $_aqui === $_h ? ' aria-current="page"' : '' ?>><i class="bi bi-<?= $_i ?>"></i><span><?= $_r ?></span></a><?php endforeach; ?>
        </nav>
        <form method="post" action="sair.php" class="sl-lado-sair"><?= csrf_campo() ?><button><i class="bi bi-box-arrow-right"></i><span>Sair</span></button></form>
    </aside>
    <nav class="sl-nav-cel" aria-label="Menu">
        <?php foreach ($_menu as [$_h, $_i, $_r]): ?><a href="<?= $_h ?>" class="<?= $_aqui === $_h ? 'ativo' : '' ?>"><i class="bi bi-<?= $_i ?>"></i><span><?= $_r === 'Novo candidato' ? 'Novo' : ($_r === 'Configurações' ? 'Ajustes' : $_r) ?></span></a><?php endforeach; ?>
    </nav>
    <div class="sl-conteudo">
    <main class="sl-main">
        <div class="sl-cab-pag">
            <div><h1><?= e($titulo ?? '') ?></h1><?php if (!empty($subtitulo)): ?><p><?= e($subtitulo) ?></p><?php endif; ?></div>
            <?php if (!empty($acoes_cab)) echo '<div class="sl-cab-acoes">' . $acoes_cab . '</div>'; ?>
        </div>
        <?= flash_html() ?>
