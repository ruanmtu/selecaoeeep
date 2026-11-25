<?php
/* Leitura das fotos/PDFs com o Gemini (Google). Recebe as imagens, pede ao Gemini os dados
 * em JSON e devolve para o formulário. Nada é gravado aqui: nem a imagem, nem o texto lido. */
require __DIR__ . '/includes/base.php';
header('Content-Type: application/json; charset=utf-8');
$u = usuario();
$resp = function (array $x, int $cod = 200) { http_response_code($cod); echo json_encode($x, JSON_UNESCAPED_UNICODE); exit; };
if (!$u) $resp(['erro' => 'Sua sessão expirou. Entre de novo.'], 401);
if (!eh_post() || !hash_equals(csrf_token(), (string)($_POST['csrf'] ?? ''))) $resp(['erro' => 'Formulário expirado. Recarregue a página.'], 400);
if (!gemini_configurado()) $resp(['erro' => 'Falta GEMINI_API_KEY no config.php.'], 400);
if (!function_exists('curl_init')) $resp(['erro' => 'O servidor não tem a extensão cURL do PHP.'], 500);

$tipo = (string)($_POST['tipo'] ?? '');
if (!in_array($tipo, ['doc', 'end', 'h68', 'h9', 'teste'], true)) $resp(['erro' => 'Tipo de leitura inválido.'], 400);
if ($tipo !== 'teste' && !gemini_ativo()) $resp(['erro' => 'A leitura com o Gemini está desligada nas configurações.'], 400);

/* tipo do arquivo pelos primeiros bytes (não depende de extensão do PHP) */
function tipo_arquivo(string $tmp): string
{
    $h = (string)file_get_contents($tmp, false, null, 0, 16);
    if (str_starts_with($h, "\xFF\xD8\xFF")) return 'image/jpeg';
    if (str_starts_with($h, "\x89PNG")) return 'image/png';
    if (str_starts_with($h, '%PDF')) return 'application/pdf';
    if (substr($h, 0, 4) === 'RIFF' && substr($h, 8, 4) === 'WEBP') return 'image/webp';
    if (substr($h, 4, 4) === 'ftyp' && preg_match('/heic|heix|hevc|mif1|msf1|heif/', substr($h, 8, 8))) return 'image/heic';
    return '';
}

$partes = [];
if ($tipo !== 'teste') {
    $total = 0; $f = $_FILES['arq'] ?? null;
    if (!$f || !is_array($f['name'])) $resp(['erro' => 'Nenhum arquivo chegou ao servidor (pode ser grande demais).'], 400);
    foreach ($f['name'] as $i => $nome) {
        if ($i >= 6) break;
        if (($f['error'][$i] ?? 1) !== UPLOAD_ERR_OK) $resp(['erro' => 'O arquivo "' . $nome . '" não chegou inteiro (erro ' . (int)$f['error'][$i] . '). Tente uma foto menor.'], 400);
        $tmp = $f['tmp_name'][$i]; $mime = tipo_arquivo($tmp);
        if ($mime === '') $resp(['erro' => 'O arquivo "' . $nome . '" não é foto (JPG/PNG/HEIC) nem PDF.'], 400);
        $total += filesize($tmp);
        if ($total > 18 * 1024 * 1024) $resp(['erro' => 'Arquivos grandes demais (máximo 18 MB somados).'], 400);
        $partes[] = ['inline_data' => ['mime_type' => $mime, 'data' => base64_encode(file_get_contents($tmp))]];
    }
}

$S = fn() => ['type' => 'STRING', 'nullable' => true];
$N = fn() => ['type' => 'NUMBER', 'nullable' => true];
$disc = 'Liste TODAS as disciplinas que aparecem. Use estes nomes quando corresponderem: Língua Portuguesa, Matemática, Ciências, Biologia, Física, Química, História, Geografia, Arte, Educação Física, Língua Inglesa, Língua Espanhola, Ensino Religioso, Redação. '
      . 'Notas de 0 a 100 devem ser convertidas para 0 a 10 (85 vira 8.5). Ignore carga horária, faltas e situação (aprovado). Se não conseguir ler uma nota com certeza, use null. Nunca invente valores.';
$cfgs = [
    'doc' => ['Você extrai dados de um documento de identificação brasileiro de um estudante (RG, CIN - carteira de identidade nacional, ou certidão de nascimento). '
            . 'Copie exatamente como está escrito. nascimento no formato AAAA-MM-DD. cpf com 11 dígitos. Nomes completos, sem abreviar. '
            . 'Na "filiação" do RG/CIN normalmente vêm o pai e a mãe; na certidão há os campos pai e mãe. naturalidade = cidade/UF onde nasceu. sexo = "Masculino" ou "Feminino". Campo que não aparece: null.',
        ['type' => 'OBJECT', 'properties' => ['nome' => $S(), 'cpf' => $S(), 'nascimento' => $S(), 'mae' => $S(), 'pai' => $S(), 'naturalidade' => $S(), 'sexo' => $S()]]],
    'end' => ['Você extrai dados de um comprovante de residência brasileiro (conta de luz, água, telefone, internet, declaração de residência). '
            . 'titular = nome de quem está no comprovante. endereco = logradouro e número (sem bairro e sem cidade). bairro, cidade, cep (8 dígitos) e telefone se houver. Campo que não aparece: null.',
        ['type' => 'OBJECT', 'properties' => ['titular' => $S(), 'telefone' => $S(), 'endereco' => $S(), 'bairro' => $S(), 'cidade' => $S(), 'cep' => $S()]]],
    'h68' => ['Você lê o histórico escolar do ensino fundamental de um estudante. Quero as notas finais do 6º, 7º e 8º ano de cada disciplina (o histórico pode ter colunas do 1º ao 8º ano: ignore do 1º ao 5º). '
            . 'Também devolva o e-mail e o telefone do estudante ou responsável, e o nome da escola, se aparecerem. ' . $disc,
        ['type' => 'OBJECT', 'properties' => ['email' => $S(), 'telefone' => $S(), 'escola' => $S(), 'disciplinas' => ['type' => 'ARRAY', 'items' => ['type' => 'OBJECT', 'properties' => ['nome' => ['type' => 'STRING'], 'n6' => $N(), 'n7' => $N(), 'n8' => $N()], 'required' => ['nome']]]]]],
    'h9' => ['Você lê o boletim ou histórico parcial do 9º ano de um estudante. Quero as notas de cada bimestre (1º ao 4º) de cada disciplina; bimestre ainda sem nota fica null. '
            . 'Também devolva e-mail e telefone se aparecerem. ' . $disc,
        ['type' => 'OBJECT', 'properties' => ['email' => $S(), 'telefone' => $S(), 'disciplinas' => ['type' => 'ARRAY', 'items' => ['type' => 'OBJECT', 'properties' => ['nome' => ['type' => 'STRING'], 'b1' => $N(), 'b2' => $N(), 'b3' => $N(), 'b4' => $N()], 'required' => ['nome']]]]]],
    'teste' => ['Responda em JSON.', ['type' => 'OBJECT', 'properties' => ['ok' => ['type' => 'STRING']]]],
];
[$instr, $schema] = $cfgs[$tipo];
$corpo = json_encode([
    'system_instruction' => ['parts' => [['text' => $instr]]],
    'contents' => [['role' => 'user', 'parts' => array_merge($partes, [['text' => $tipo === 'teste' ? 'Devolva {"ok":"sim"}.' : 'Extraia os dados destes arquivos.']])]],
    'generationConfig' => ['responseMimeType' => 'application/json', 'responseSchema' => $schema, 'thinkingConfig' => ['thinkingLevel' => 'low']],
]);
unset($partes);

/* modelo: o do config.php, senão o último que funcionou, senão o mais novo "flash" da conta.
   O Google aposenta modelos de tempos em tempos: se o modelo sumir, o sistema descobre outro sozinho. */
$base = defined('GEMINI_URL') ? GEMINI_URL : 'https://generativelanguage.googleapis.com/v1beta/models/';
$chave = trim((string)GEMINI_API_KEY);
/** últimas chamadas (só modelo, resposta e tempo; nenhum dado do candidato) */
function gemini_historico(string $modelo, int $cod, float $seg): void
{
    $h = json_decode((string)cfg('gemini_historico'), true) ?: [];
    array_unshift($h, [date('d/m H:i:s'), $GLOBALS['tipo'] ?? '', $modelo, $cod, round($seg, 1)]);
    cfg_gravar('gemini_historico', json_encode(array_slice($h, 0, 15)));
}
function gemini_post(string $base, string $modelo, string $chave, string $corpo): array
{
    $ch = curl_init($base . rawurlencode($modelo) . ':generateContent');
    curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => $corpo, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 100, CURLOPT_CONNECTTIMEOUT => 12,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'x-goog-api-key: ' . $chave]]);
    $t0 = microtime(true);
    $b = curl_exec($ch); $c = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE); $e = curl_error($ch); curl_close($ch);
    if ($c === 400 && preg_match('/thinking/i', (string)$b) && str_contains($corpo, 'thinkingConfig')) {   // modelo sem suporte: sem o ajuste
        $j = json_decode($corpo, true); unset($j['generationConfig']['thinkingConfig']);
        return gemini_post($base, $modelo, $chave, json_encode($j));
    }
    gemini_historico($modelo, $c, microtime(true) - $t0);
    return [$b, $c, $e];
}
function gemini_descobrir(string $base, string $chave, string $dica = ''): ?string
{
    if ($dica !== '') return $dica;
    $ch = curl_init(rtrim($base, '/') . '?pageSize=1000');
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 20, CURLOPT_HTTPHEADER => ['x-goog-api-key: ' . $chave]]);
    $j = json_decode((string)curl_exec($ch), true); curl_close($ch);
    $opc = [];
    foreach ((array)($j['models'] ?? []) as $m) {
        $n = preg_replace('#^models/#', '', (string)($m['name'] ?? ''));
        if (!in_array('generateContent', (array)($m['supportedGenerationMethods'] ?? []), true)) continue;
        if (!preg_match('/^gemini-[\d.]+-flash$/', $n)) continue;   // só "gemini-X-flash" estável (sem lite, preview, image…)
        preg_match('/gemini-([\d.]+)-/', $n, $v); $opc[$n] = (float)$v[1];
    }
    if (!$opc) return null;
    arsort($opc); return array_key_first($opc);
}
@set_time_limit(150);
/** outros modelos flash da conta (os mais novos primeiro), para quando o principal está sobrecarregado */
function gemini_alternativos(string $base, string $chave, string $atual): array
{
    $ch = curl_init(rtrim($base, '/') . '?pageSize=1000');
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 20, CURLOPT_HTTPHEADER => ['x-goog-api-key: ' . $chave]]);
    $j = json_decode((string)curl_exec($ch), true); curl_close($ch);
    $opc = [];
    foreach ((array)($j['models'] ?? []) as $m) {
        $n = preg_replace('#^models/#', '', (string)($m['name'] ?? ''));
        if ($n === $atual || !in_array('generateContent', (array)($m['supportedGenerationMethods'] ?? []), true)) continue;
        if (!preg_match('/^gemini-([\d.]+)-flash(-lite)?$/', $n, $v)) continue;
        $opc[$n] = (float)$v[1] - (empty($v[2]) ? 0 : 0.05);   // o "lite" fica depois do normal da mesma versão
    }
    arsort($opc);
    return array_slice(array_keys($opc), 0, 2);
}
$modelo = defined('GEMINI_MODELO') ? GEMINI_MODELO : (cfg('gemini_modelo') ?: 'gemini-3.8-flash');
[$bruto, $cod, $erroCurl] = gemini_post($base, $modelo, $chave, $corpo);
/* sobrecarga do Google (503/500): espera e tenta de novo; depois tenta outro modelo flash da conta */
foreach ([2, 5] as $espera) {
    if (!in_array($cod, [500, 503], true)) break;
    sleep($espera); [$bruto, $cod, $erroCurl] = gemini_post($base, $modelo, $chave, $corpo);
}
if (in_array($cod, [500, 503], true)) {
    foreach (gemini_alternativos($base, $chave, $modelo) as $alt) {
        [$b2, $c2, $e2] = gemini_post($base, $alt, $chave, $corpo);
        if ($c2 === 200) { [$bruto, $cod, $erroCurl, $modelo] = [$b2, $c2, $e2, $alt]; $reserva = true; break; }
    }
}
if ($cod === 404 || ($cod === 400 && preg_match('/not (found|supported)|no longer available/i', (string)$bruto))) {
    preg_match('#use (?:models/)?(gemini-[\w.\-]+)#i', (string)(json_decode((string)$bruto, true)['error']['message'] ?? ''), $sug);
    $novo = gemini_descobrir($base, $chave, $sug[1] ?? '');
    if ($novo && $novo !== $modelo) { $modelo = $novo; [$bruto, $cod, $erroCurl] = gemini_post($base, $modelo, $chave, $corpo); }
}
if ($cod === 200 && empty($reserva)) cfg_gravar('gemini_modelo', $modelo);   // o modelo de reserva (sobrecarga) não fica gravado
$falha = function (string $msg, int $cod = 502) use ($resp, $tipo) { cfg_gravar('gemini_ultimo_erro', date('d/m/Y H:i') . ' · ' . $tipo . ' · ' . mb_substr($msg, 0, 300)); $resp(['erro' => $msg], $cod); };
if ($bruto === false) $falha('Não foi possível falar com o Gemini (' . $erroCurl . ').');
$j = json_decode($bruto, true);
if ($cod !== 200) {
    $msg = (string)($j['error']['message'] ?? 'sem detalhe');
    if ($cod === 429) $falha('Limite gratuito do Gemini atingido por agora. Espere um minuto e clique em "Tentar de novo".');
    if ($cod === 503 || $cod === 500) $falha('O Gemini está sobrecarregado agora (muita gente usando). Espere alguns segundos e clique em "Tentar de novo".');
    if ($cod === 400 && stripos($msg, 'API key') !== false || $cod === 403) $falha('A chave do Gemini foi recusada: confira GEMINI_API_KEY no config.php. (' . $msg . ')');
    $falha('O Gemini respondeu com erro ' . $cod . ': ' . $msg);
}
/* junta o texto das partes (o modelo pode mandar mais de uma) */
$txt = '';
foreach ((array)($j['candidates'][0]['content']['parts'] ?? []) as $p) if (empty($p['thought']) && isset($p['text'])) $txt .= $p['text'];
$txt = trim(preg_replace('/^```(?:json)?|```$/m', '', $txt));
$dados = json_decode($txt, true);
if (!is_array($dados)) {
    $motivo = $j['candidates'][0]['finishReason'] ?? ($j['promptFeedback']['blockReason'] ?? '');
    $falha('O Gemini não devolveu os dados' . ($motivo ? ' (' . $motivo . ')' : '') . '.');
}
if ($tipo === 'teste') { cfg_gravar('gemini_ultimo_erro', null); $resp(['ok' => true, 'modelo' => $modelo]); }
registrar('leitura gemini', $tipo);   // só o tipo: nenhum dado do candidato vai para o registro

$n = fn($v) => is_numeric($v) ? round(((float)$v > 10 && (float)$v <= 100 ? (float)$v / 10 : (float)$v), 2) : null;
$t = fn($v) => is_string($v) && trim($v) !== '' && !preg_match('/^(null|n\/?a|-+)$/i', trim($v)) ? trim($v) : null;
$tel = function ($v) { $d = so_digitos((string)$v); if (strlen($d) === 11) return '(' . substr($d, 0, 2) . ') ' . substr($d, 2, 5) . '-' . substr($d, 7); if (strlen($d) === 10) return '(' . substr($d, 0, 2) . ') ' . substr($d, 2, 4) . '-' . substr($d, 6); return $v ? trim((string)$v) : null; };
$r = [];
if ($tipo === 'doc') {
    foreach (['nome', 'cpf', 'nascimento', 'mae', 'pai', 'naturalidade', 'sexo'] as $k) $r[$k] = $t($dados[$k] ?? null);
    if ($r['nascimento'] && preg_match('#^(\d{2})/(\d{2})/(\d{4})$#', $r['nascimento'], $m)) $r['nascimento'] = "$m[3]-$m[2]-$m[1]";
    if ($r['nascimento'] && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $r['nascimento'])) $r['nascimento'] = null;
    if ($r['cpf']) { if (!cpf_valido($r['cpf'])) $r['cpf_duvida'] = true; $r['cpf'] = cpf_fmt($r['cpf']); }
    foreach (['nome', 'pai', 'mae'] as $k) if ($r[$k]) $r[$k] = nome_proprio($r[$k]);
    if ($r['sexo']) $r['sexo'] = stripos($r['sexo'], 'f') === 0 ? 'Feminino' : (stripos($r['sexo'], 'm') === 0 ? 'Masculino' : $r['sexo']);
} elseif ($tipo === 'end') {
    foreach (['titular', 'telefone', 'endereco', 'bairro', 'cidade', 'cep'] as $k) $r[$k] = $t($dados[$k] ?? null);
    if ($r['titular']) $r['titular'] = nome_proprio($r['titular']);
    if ($r['telefone']) $r['telefone'] = $tel($r['telefone']);
    if ($r['cep'] && strlen(so_digitos($r['cep'])) === 8) { $c = so_digitos($r['cep']); $r['cep'] = substr($c, 0, 5) . '-' . substr($c, 5); }
    $r['cota_bairro'] = eh_bairro_cota($r['bairro'] ?? '', $r['endereco'] ?? '');
} else {
    $r['email'] = $t($dados['email'] ?? null); if ($r['email'] && !filter_var($r['email'], FILTER_VALIDATE_EMAIL)) $r['email'] = null; if ($r['email']) $r['email'] = mb_strtolower($r['email']);
    $r['telefone'] = $t($dados['telefone'] ?? null) ? $tel($dados['telefone']) : null;
    if ($tipo === 'h68') $r['escola_origem'] = $t($dados['escola'] ?? null);
}
$r = array_filter($r, fn($v) => $v !== null && $v !== '');
$notas = [];
foreach ((array)($dados['disciplinas'] ?? []) as $d) {
    $nome = trim((string)($d['nome'] ?? '')); if ($nome === '') continue;
    $notas[$nome] = $tipo === 'h68' ? [$n($d['n6'] ?? null), $n($d['n7'] ?? null), $n($d['n8'] ?? null)] : [$n($d['b1'] ?? null), $n($d['b2'] ?? null), $n($d['b3'] ?? null), $n($d['b4'] ?? null)];
}
$resp(['ok' => true, 'motor' => 'gemini', 'dados' => $r, 'notas' => $notas]);
