<?php
require __DIR__ . '/includes/base.php';
if (eh_post()) { csrf_verificar(); registrar('saiu'); }
$_SESSION = []; session_destroy();
redirecionar('index.php');
