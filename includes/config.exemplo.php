<?php
/* Copie este arquivo para includes/config.php NO SERVIDOR e preencha.
 * O config.php nunca vai para o GitHub (está no .gitignore). */
define('DB_HOST', 'localhost');
define('DB_NAME', 'nome_do_banco');
define('DB_USER', 'usuario_do_banco');
define('DB_PASS', 'senha_do_banco');
/* Chave do primeiro acesso: invente uma frase longa. Ela é pedida uma única vez,
 * para criar o administrador da seleção. Depois pode apagar esta linha. */
define('SEL_CHAVE_INSTALACAO', 'troque-por-uma-frase-longa-e-secreta');
define('EXIBIR_ERROS', false);
