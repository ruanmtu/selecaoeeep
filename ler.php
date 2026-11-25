<?php
/* Leitura das fotos/PDFs com o Gemini (Google). Recebe as imagens, pede ao Gemini os dados
 * em JSON e devolve para o formulário. Nada é gravado aqui: nem a imagem, nem o texto lido. */
require __DIR__ . '/includes/base.php';
header('Content-Type: application/json; charset=utf-8');
$u = usuario();
$resp = function (array $x, int $cod = 200) { http_response_code($cod); echo json_encode($x, JSON_UNESCAPED_UNICODE); exit; };
if (!$u) $resp(['erro' => 'Sua sessão expirou. Entre de novo.'], 401);
if (!eh_post() || !hash_equals(csrf_token(), (string)($_POST['csrf'] ?? ''))) $resp(['erro' => 'Formulário expirado. Recarregue a página.'], 400);
if (!gemini_ativo()) $resp(['erro' => 'A leitura com o Gemini está desligada.'], 400);

$tipo = (string)($_POST['tipo'] ?? '');
if (!in_array($tipo, ['doc', 'h68', 'h9'], true)) $resp(['erro' => 'Tipo de leitura inválido.'], 400);

/* arquivos: até 6, só imagem ou PDF, no máximo 15 MB somados */
$partes = []; $total = 0;
$f = $_FILES['arq'] ?? null;
if (!$f || !is_array($f['name'])) $resp(['erro' => 'Nenhum arquivo enviado.'], 400);
foreach ($f['name'] as $i => $nome) {
    if ($i >= 6 || ($f['error'][$i] ?? 1) !== UPLOAD_ERR_OK) continue;
    $tmp = $f['tmp_name'][$i]; $mime = (new finfo(FILEINFO_MIME_TYPE))->file($tmp) ?: '';
    if (!in_array($mime, ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'], true)) continue;
    $total += filesize($tmp);
    if ($total > 15 * 1024 * 1024) $resp(['erro' => 'Arquivos grandes demais (máximo 15 MB somados).'], 400);
    $partes[] = ['inline_data' => ['mime_type' => $mime, 'data' => base64_encode(file_get_contents($tmp))]];
}
if (!$partes) $resp(['erro' => 'Envie foto (JPG/PNG) ou PDF.'], 400);

$disc = 'Use estes nomes de disciplina quando corresponderem: Língua Portuguesa, Matemática, Ciências, Biologia, Física, Química, História, Geografia, Arte, Educação Física, Língua Inglesa, Língua Espanhola, Ensino Religioso, Redação. '
      . 'Notas de 0 a 100 devem ser convertidas para 0 a 10 (85 vira 8.5). Ignore carga horária, faltas e situação (aprovado). Se não conseguir ler uma nota com certeza, use null. Nunca invente valores.';
$cfgs = [
    'doc' => ['Você extrai dados de documentos brasileiros de um estudante (RG/CIN, certidão de nascimento, comprovante de residência, ficha de inscrição). '
            . 'Devolva somente o que estiver escrito. Datas no formato AAAA-MM-DD. CPF no formato 000.000.000-00. Nomes completos, sem abreviar. '
            . 'Em "filiação" de RG, o primeiro nome costuma ser o pai e o segundo a mãe. Campos que não aparecem: null.',
        ['type' => 'OBJECT', 'properties' => array_fill_keys(['nome', 'cpf', 'nascimento', 'pai', 'mae', 'email', 'telefone', 'endereco', 'bairro', 'cidade', 'escola_origem'], ['type' => 'STRING', 'nullable' => true])]],
    'h68' => ['Você lê o histórico escolar do ensino fundamental de um estudante. Quero só as notas finais do 6º, 7º e 8º ano de cada disciplina (o histórico pode ter colunas do 1º ao 8º ano: ignore do 1º ao 5º). ' . $disc,
        ['type' => 'OBJECT', 'properties' => ['disciplinas' => ['type' => 'ARRAY', 'items' => ['type' => 'OBJECT', 'properties' => ['nome' => ['type' => 'STRING'], 'n6' => ['type' => 'NUMBER', 'nullable' => true], 'n7' => ['type' => 'NUMBER', 'nullable' => true], 'n8' => ['type' => 'NUMBER', 'nullable' => true]], 'required' => ['nome']]]]]],
    'h9' => ['Você lê o boletim ou histórico parcial do 9º ano de um estudante. Quero as notas de cada bimestre (1º ao 4º) de cada disciplina; bimestre ainda sem nota fica null. ' . $disc,
        ['type' => 'OBJECT', 'properties' => ['disciplinas' => ['type' => 'ARRAY', 'items' => ['type' => 'OBJECT', 'properties' => ['nome' => ['type' => 'STRING'], 'b1' => ['type' => 'NUMBER', 'nullable' => true], 'b2' => ['type' => 'NUMBER', 'nullable' => true], 'b3' => ['type' => 'NUMBER', 'nullable' => true], 'b4' => ['type' => 'NUMBER', 'nullable' => true]], 'required' => ['nome']]]]]],
];
[$instr, $schema] = $cfgs[$tipo];
$corpo = json_encode([
    'system_instruction' => ['parts' => [['text' => $instr]]],
    'contents' => [['role' => 'user', 'parts' => array_merge($partes, [['text' => 'Extraia os dados destes arquivos.']])]],
    'generationConfig' => ['temperature' => 0, 'responseMimeType' => 'application/json', 'responseSchema' => $schema],
]);
unset($partes);

$modelo = defined('GEMINI_MODELO') ? GEMINI_MODELO : 'gemini-2.5-flash';
$url = (defined('GEMINI_URL') ? GEMINI_URL : 'https://generativelanguage.googleapis.com/v1beta/models/') . rawurlencode($modelo) . ':generateContent';
$ch = curl_init($url);
curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => $corpo, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 90, CURLOPT_CONNECTTIMEOUT => 10,
    CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'x-goog-api-key: ' . GEMINI_API_KEY]]);
$bruto = curl_exec($ch); $cod = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE); $erroCurl = curl_error($ch); curl_close($ch);
unset($corpo);
if ($bruto === false) { error_log('[selecao] gemini: ' . $erroCurl); $resp(['erro' => 'Não foi possível falar com o Gemini agora.'], 502); }
$j = json_decode($bruto, true);
if ($cod !== 200) {
    $msg = $j['error']['message'] ?? ''; error_log('[selecao] gemini HTTP ' . $cod . ': ' . mb_substr($msg, 0, 300));
    $resp(['erro' => $cod === 429 ? 'Limite gratuito do Gemini atingido por agora. Espere um minuto ou use a leitura no aparelho.' : ($cod === 400 || $cod === 403 ? 'A chave do Gemini foi recusada. Confira GEMINI_API_KEY no config.php.' : 'O Gemini não respondeu (erro ' . $cod . ').'), 'limite' => $cod === 429], 502);
}
$txt = $j['candidates'][0]['content']['parts'][0]['text'] ?? '';
$dados = json_decode($txt, true);
if (!is_array($dados)) $resp(['erro' => 'O Gemini não conseguiu ler esse arquivo.'], 502);
registrar('leitura gemini', $tipo);   // só o tipo: nenhum dado do candidato vai para o registro

/* devolve no mesmo formato da leitura no aparelho */
$n = fn($v) => is_numeric($v) ? round(((float)$v > 10 && (float)$v <= 100 ? (float)$v / 10 : (float)$v), 2) : null;
if ($tipo === 'doc') {
    $r = array_map(fn($v) => is_string($v) ? trim($v) : null, $dados);
    if (!empty($r['nascimento']) && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $r['nascimento'])) $r['nascimento'] = null;
    if (!empty($r['cpf']) && !cpf_valido($r['cpf'])) $r['cpf_duvida'] = $r['cpf'];
    if (!empty($r['cpf'])) $r['cpf'] = cpf_fmt($r['cpf']);
    foreach (['nome', 'pai', 'mae'] as $k) if (!empty($r[$k])) $r[$k] = nome_proprio($r[$k]);
    $r['cota_bairro'] = eh_bairro_cota($r['bairro'] ?? '', $r['endereco'] ?? '');
    $resp(['ok' => true, 'dados' => array_filter($r, fn($v) => $v !== null && $v !== '')]);
}
$notas = [];
foreach ((array)($dados['disciplinas'] ?? []) as $d) {
    $nome = trim((string)($d['nome'] ?? '')); if ($nome === '') continue;
    $notas[$nome] = $tipo === 'h68' ? [$n($d['n6'] ?? null), $n($d['n7'] ?? null), $n($d['n8'] ?? null)] : [$n($d['b1'] ?? null), $n($d['b2'] ?? null), $n($d['b3'] ?? null), $n($d['b4'] ?? null)];
}
$resp(['ok' => true, 'notas' => $notas]);
