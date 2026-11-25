<?php
/* Usuários do sistema da seleção (contas separadas das da escola) */
require __DIR__ . '/includes/base.php';
$u = exigir_admin();
if (eh_post()) {
    csrf_verificar();
    $acao = (string)($_POST['acao'] ?? ''); $id = (int)($_POST['id'] ?? 0);
    if ($acao === 'criar') {
        $nome = nome_proprio(mb_substr(trim((string)($_POST['nome'] ?? '')), 0, 120)); $email = mb_strtolower(trim((string)($_POST['email'] ?? '')));
        $papel = ($_POST['papel'] ?? '') === 'admin' ? 'admin' : 'digitador';
        if (mb_strlen($nome) < 3 || !filter_var($email, FILTER_VALIDATE_EMAIL)) flash('erro', 'Preencha nome e um e-mail válido.');
        elseif (q_valor('SELECT id FROM sel_usuarios WHERE email = ?', [$email])) flash('erro', 'Esse e-mail já tem conta.');
        else {
            $senha = substr(str_replace(['+', '/', '='], '', base64_encode(random_bytes(9))), 0, 10);
            q('INSERT INTO sel_usuarios (nome, email, senha_hash, papel, ativo, criado_em) VALUES (?, ?, ?, ?, 1, ?)', [$nome, $email, password_hash($senha, PASSWORD_DEFAULT), $papel, agora()]);
            registrar('criou usuário', $email);
            $_SESSION['sel_senha_nova'] = [$nome, $email, $senha];
        }
    } elseif ($id && $id !== (int)$u['id']) {
        $x = q_um('SELECT * FROM sel_usuarios WHERE id = ?', [$id]);
        if ($x && $acao === 'ativo') { q('UPDATE sel_usuarios SET ativo = 1 - ativo WHERE id = ?', [$id]); registrar('ativo usuário', $x['email']); }
        if ($x && $acao === 'papel') q('UPDATE sel_usuarios SET papel = ? WHERE id = ?', [$x['papel'] === 'admin' ? 'digitador' : 'admin', $id]);
        if ($x && $acao === 'senha') {
            $senha = substr(str_replace(['+', '/', '='], '', base64_encode(random_bytes(9))), 0, 10);
            q('UPDATE sel_usuarios SET senha_hash = ? WHERE id = ?', [password_hash($senha, PASSWORD_DEFAULT), $id]); registrar('nova senha', $x['email']);
            $_SESSION['sel_senha_nova'] = [$x['nome'], $x['email'], $senha];
        }
    }
    redirecionar('usuarios.php');
}
$nova = $_SESSION['sel_senha_nova'] ?? null; unset($_SESSION['sel_senha_nova']);
$lista = q_todos('SELECT * FROM sel_usuarios ORDER BY ativo DESC, nome');
$titulo = 'Usuários';
$subtitulo = 'Quem pode entrar no sistema da seleção';
require __DIR__ . '/includes/topo.php';
?>
<?php if ($nova): ?><div class="sl-aviso"><i class="bi bi-key"></i><span>Senha de <b><?= e($nova[0]) ?></b> (<?= e($nova[1]) ?>): <code style="font-size:1.05rem"><?= e($nova[2]) ?></code><br><small>Anote e entregue à pessoa: ela não aparece de novo. Ela pode trocar depois em "Trocar minha senha".</small></span></div><?php endif; ?>
<div class="row g-3">
<div class="col-lg-4"><form method="post" class="sl-card"><?= csrf_campo() ?><input type="hidden" name="acao" value="criar">
    <div class="sl-card-cab"><h2><i class="bi bi-person-plus"></i>Nova conta</h2></div>
    <div class="sl-card-corpo vstack gap-2">
        <div><label class="form-label" for="n">Nome</label><input class="form-control" id="n" name="nome" required></div>
        <div><label class="form-label" for="em">E-mail</label><input class="form-control" id="em" name="email" type="email" required></div>
        <div><label class="form-label" for="p">Papel</label><select class="form-select" id="p" name="papel"><option value="digitador">Digitador (cadastra candidatos)</option><option value="admin">Administrador (tudo)</option></select></div>
        <button class="btn btn-primary mt-1">Criar e gerar senha</button>
    </div></form></div>
<div class="col-lg-8"><div class="sl-card"><div class="sl-tab-rolar"><table class="sl-tab">
    <thead><tr><th>Nome</th><th>Papel</th><th>Último acesso</th><th></th></tr></thead><tbody>
    <?php foreach ($lista as $x): $eu = (int)$x['id'] === (int)$u['id']; ?>
    <tr style="<?= $x['ativo'] ? '' : 'opacity:.5' ?>"><td><b><?= e($x['nome']) ?></b><br><small class="text-secondary"><?= e($x['email']) ?></small></td>
        <td><span class="sl-selo <?= $x['papel'] === 'admin' ? 'ok' : '' ?>"><?= $x['papel'] === 'admin' ? 'Administrador' : 'Digitador' ?></span><?= $x['ativo'] ? '' : ' <span class="sl-selo fora">desativado</span>' ?></td>
        <td class="small text-secondary"><?= $x['ultimo_acesso'] ? date('d/m/Y H:i', strtotime($x['ultimo_acesso'])) : 'nunca' ?></td>
        <td class="text-end text-nowrap"><?php if (!$eu): ?>
            <?php foreach ([['senha', 'key', 'Gerar nova senha'], ['papel', 'arrow-left-right', $x['papel'] === 'admin' ? 'Tornar digitador' : 'Tornar administrador'], ['ativo', $x['ativo'] ? 'person-slash' : 'person-check', $x['ativo'] ? 'Desativar' : 'Reativar']] as [$a, $i, $t]): ?>
            <form method="post" class="d-inline"><?= csrf_campo() ?><input type="hidden" name="acao" value="<?= $a ?>"><input type="hidden" name="id" value="<?= $x['id'] ?>"><button class="btn btn-sm btn-light" title="<?= $t ?>" aria-label="<?= $t ?>"><i class="bi bi-<?= $i ?>"></i></button></form>
            <?php endforeach; ?>
        <?php else: ?><small class="text-secondary">você</small><?php endif; ?></td></tr>
    <?php endforeach; ?>
    </tbody></table></div></div></div>
</div>
<?php require __DIR__ . '/includes/rodape.php';
