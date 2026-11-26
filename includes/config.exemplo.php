<?php
/* Copie este arquivo para includes/config.php NO SERVIDOR e preencha.
 * O config.php nunca vai para o GitHub (está no .gitignore). */
define('DB_HOST', 'localhost');
define('DB_NAME', 'u128975241_selecaoeeep');
define('DB_USER', 'u128975241_selecaoeeep');
define('DB_PASS', 'senha_do_banco');   // a senha de verdade só no config.php do servidor
/* Chave do primeiro acesso: invente uma frase longa. Ela é pedida uma única vez,
 * para criar o administrador da seleção. Depois pode apagar esta linha. */
define('SEL_CHAVE_INSTALACAO', 'troque-por-uma-frase-longa-e-secreta');
define('EXIBIR_ERROS', false);
/* Leitura automática dos documentos, só com planos GRATUITOS (nenhum pede cartão).
 * Basta uma chave; com as duas, quando uma estoura o limite do dia ou do minuto, a outra assume sozinha. */
/* 1º Gemini (Google). Crie a chave em https://aistudio.google.com/apikey */
// define('GEMINI_API_KEY', 'cole-a-chave-aqui');
// define('GEMINI_MODELO', 'gemini-3.8-flash');   // opcional: sem esta linha, o sistema escolhe sozinho o modelo flash mais novo
/* 2º Groq (reserva). Crie a chave em https://console.groq.com/keys (conta grátis, sem cartão) */
// define('GROQ_API_KEY', 'cole-a-chave-aqui');
// define('GROQ_MODELO', 'qwen/qwen3.8-27b');            // opcional: modelo que lê FOTOS (veja console.groq.com/docs/vision)
// define('GROQ_MODELO_TEXTO', 'openai/gpt-oss-120b');   // opcional: modelo para PDF com texto
