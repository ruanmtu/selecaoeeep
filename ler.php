<?php
/* A leitura por serviços externos (Gemini, Groq) foi DESATIVADA: agora toda a leitura dos documentos é feita
 * no próprio aparelho (Tesseract), sem enviar nada para fora. Este arquivo continua existindo só para
 * substituir a versão antiga no servidor (a publicação por FTP não apaga arquivos). */
header('Content-Type: application/json; charset=utf-8');
http_response_code(410);
echo json_encode(['erro' => 'A leitura por serviços externos foi desativada. Recarregue a página (Ctrl+F5): a leitura agora é feita neste aparelho.'], JSON_UNESCAPED_UNICODE);
