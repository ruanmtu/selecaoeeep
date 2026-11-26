<?php
/* Leitura das fotos/PDFs por IA, só com serviços GRATUITOS, em cascata:
 *   1º Gemini (Google, plano gratuito)  →  2º Groq (plano gratuito, sem cartão)
 * Se um serviço estoura o limite (por minuto ou do dia), fica "em pausa" e as próximas leituras vão direto
 * para o outro, sem perder tempo. Se todos falharem, a tela oferece a leitura no próprio aparelho.
 * Nada é gravado aqui: nem a imagem, nem o texto lido. */
require __DIR__ . '/includes/base.php';
header('Content-Type: application/json; charset=utf-8');
/* a resposta é sempre JSON: avisos do PHP não podem sujar a saída, e um erro fatal vira mensagem legível */
ini_set('display_errors', '0');
ob_start();
register_shutdown_function(function () {
    $e = error_get_last();
    if (!$e || !in_array($e['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) return;
    while (ob_get_level()) ob_end_clean();
    $msg = 'Erro no servidor: ' . $e['message'] . ' (linha ' . $e['line'] . ')';
    try { cfg_gravar('leitura_ultimo_erro', date('d/m/Y H:i') . ' · ' . mb_substr($msg, 0, 300)); } catch (Throwable $t) {}
    if (!headers_sent()) { http_response_code(500); header('Content-Type: application/json; charset=utf-8'); }
    echo json_encode(['erro' => $msg], JSON_UNESCAPED_UNICODE);
});
$INICIO = microtime(true);
$u = usuario();
$resp = function (array $x, int $cod = 200) { while (ob_get_level()) ob_end_clean(); http_response_code($cod); echo json_encode($x, JSON_UNESCAPED_UNICODE); exit; };
if (!$u) $resp(['erro' => 'Sua sessão expirou. Entre de novo.'], 401);
if (!eh_post() || !hash_equals(csrf_token(), (string)($_POST['csrf'] ?? ''))) $resp(['erro' => 'Formulário expirado. Recarregue a página.'], 400);
if (!ia_configurada()) $resp(['erro' => 'Falta a chave de um serviço de leitura (GEMINI_API_KEY ou GROQ_API_KEY) no config.php.'], 400);
if (!function_exists('curl_init')) $resp(['erro' => 'O servidor não tem a extensão cURL do PHP.'], 500);

$tipo = (string)($_POST['tipo'] ?? '');
if (!in_array($tipo, ['doc', 'end', 'h68', 'h9', 'teste'], true)) $resp(['erro' => 'Tipo de leitura inválido.'], 400);
if ($tipo !== 'teste' && !ia_ativa()) $resp(['erro' => 'A leitura automática está desligada nas configurações.'], 400);
/* libera a sessão: sem isso, enquanto a IA pensa, todas as outras páginas do mesmo usuário ficam travadas
   esperando (e o servidor devolve 504) */
session_write_close();
/* prazo total da leitura: termina antes do limite do servidor (uns 60 s), nunca deixa a página pendurada */
const PRAZO_TOTAL = 42;
function resta(): float { return PRAZO_TOTAL - (microtime(true) - $GLOBALS['INICIO']); }
@set_time_limit(PRAZO_TOTAL + 10);

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

/* ---------- o que chegou: textos (PDF com texto) e arquivos (fotos; PDF escaneado de navegador antigo) ---------- */
$TEXTOS = []; $ARQS = [];
if ($tipo !== 'teste') {
    $total = 0; $f = $_FILES['arq'] ?? ['name' => []];
    /* PDF com texto: o aparelho já manda o TEXTO do PDF (muito mais rápido e exato que a imagem) */
    foreach ((array)($_POST['texto'] ?? []) as $tx) {
        $tx = trim(mb_substr((string)$tx, 0, 60000));
        if ($tx !== '') $TEXTOS[] = $tx;
    }
    if (!$TEXTOS && empty($f['name'])) $resp(['erro' => 'Nenhum arquivo chegou ao servidor (pode ser grande demais).'], 400);
    foreach ((array)$f['name'] as $i => $nome) {
        if ($i >= 6) break;
        if (($f['error'][$i] ?? 1) !== UPLOAD_ERR_OK) $resp(['erro' => 'O arquivo "' . $nome . '" não chegou inteiro (erro ' . (int)$f['error'][$i] . '). Tente uma foto menor.'], 400);
        $tmp = $f['tmp_name'][$i]; $mime = tipo_arquivo($tmp);
        if ($mime === '') $resp(['erro' => 'O arquivo "' . $nome . '" não é foto (JPG/PNG/HEIC) nem PDF.'], 400);
        $total += filesize($tmp);
        if ($total > 18 * 1024 * 1024) $resp(['erro' => 'Arquivos grandes demais (máximo 18 MB somados).'], 400);
        $ARQS[] = [$mime, base64_encode(file_get_contents($tmp))];
    }
}

/* ---------- o que pedir em cada parte do formulário ---------- */
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
[$INSTR, $SCHEMA] = $cfgs[$tipo];

/* ---------- controle de uso: histórico, contador do dia e pausa automática ---------- */
/** últimas chamadas (só serviço/modelo, resposta e tempo; nenhum dado do candidato) */
function hist_leitura(string $modelo, int $cod, float $seg): void
{
    $h = json_decode((string)cfg('gemini_historico'), true) ?: [];
    array_unshift($h, [date('d/m H:i:s'), $GLOBALS['tipo'] ?? '', $modelo, $cod, round($seg, 1)]);
    cfg_gravar('gemini_historico', json_encode(array_slice($h, 0, 20)));
}
function contar(string $chave): void
{
    $c = leituras_hoje(); $c[$chave] = (int)($c[$chave] ?? 0) + 1;
    cfg_gravar('leituras_dia', json_encode($c));
}
/** pausa um serviço até um horário (limite estourado): as próximas leituras vão direto para o outro */
function pausar(string $motor, int $ate, string $motivo): void
{
    $p = json_decode((string)cfg('leitura_pausas'), true) ?: [];
    $p[$motor] = [$ate, $motivo];
    cfg_gravar('leitura_pausas', json_encode($p, JSON_UNESCAPED_UNICODE));
}
function despausar(string $motor): void
{
    $p = json_decode((string)cfg('leitura_pausas'), true) ?: [];
    if (isset($p[$motor])) { unset($p[$motor]); cfg_gravar('leitura_pausas', json_encode($p, JSON_UNESCAPED_UNICODE)); }
}
/** a cota diária gratuita do Google volta à meia-noite do Pacífico (umas 5h em Fortaleza) */
function proximas_5h(): int { $t = strtotime('today 05:00'); return time() >= $t ? strtotime('tomorrow 05:00') : $t; }
function limpar_json(string $txt): ?array
{
    $txt = preg_replace('#<think>.*?</think>#s', '', $txt);
    $txt = trim(preg_replace('/^```(?:json)?|```$/m', '', $txt));
    $d = json_decode($txt, true);
    if (!is_array($d) && preg_match('/\{.*\}/s', $txt, $m)) $d = json_decode($m[0], true);
    return is_array($d) ? $d : null;
}
/** esquema -> exemplo de JSON (para serviços que não aceitam o esquema direto) */
function esqueleto(array $s)
{
    return match ($s['type'] ?? '') {
        'OBJECT' => (object)array_map('esqueleto', $s['properties'] ?? []),
        'ARRAY' => [esqueleto($s['items'] ?? ['type' => 'STRING'])],
        'NUMBER' => 'número ou null',
        default => !empty($s['nullable']) ? 'texto ou null' : 'texto',
    };
}

/* ======================================================================
 *  GEMINI (Google) — retorna ['ok'=>true,'dados'=>…,'modelo'=>…] ou ['ok'=>false,'msg'=>…]
 * ====================================================================== */
function gemini_post(string $base, string $modelo, string $chave, string $corpo, float $reserva): array
{
    $ch = curl_init($base . rawurlencode($modelo) . ':generateContent');
    curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => $corpo, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => (int)max(4, min(40, resta() - $reserva)), CURLOPT_CONNECTTIMEOUT => 8,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'x-goog-api-key: ' . $chave]]);
    $t0 = microtime(true);
    $b = curl_exec($ch); $c = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE); $e = curl_error($ch);
    if ($c === 400) {   // modelo que não aceita algum ajuste de velocidade: tira só esse ajuste e repete
        $j = json_decode($corpo, true); $g = &$j['generationConfig']; $msg = (string)$b;
        if (preg_match('/thinking/i', $msg) && ($g['thinkingConfig']['thinkingLevel'] ?? '') === 'minimal') { $g['thinkingConfig']['thinkingLevel'] = 'low'; return gemini_post($base, $modelo, $chave, json_encode($j), $reserva); }
        if (preg_match('/thinking/i', $msg) && isset($g['thinkingConfig'])) { unset($g['thinkingConfig']); return gemini_post($base, $modelo, $chave, json_encode($j), $reserva); }
        if (preg_match('/media.?resolution/i', $msg) && isset($g['mediaResolution'])) { unset($g['mediaResolution']); return gemini_post($base, $modelo, $chave, json_encode($j), $reserva); }
    }
    hist_leitura($modelo, $c, microtime(true) - $t0);
    return [$b, $c, $e];
}
function gemini_modelos(string $base, string $chave): array
{
    $ch = curl_init(rtrim($base, '/') . '?pageSize=1000');
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 8, CURLOPT_HTTPHEADER => ['x-goog-api-key: ' . $chave]]);
    $j = json_decode((string)curl_exec($ch), true);
    $r = [];
    foreach ((array)($j['models'] ?? []) as $m) {
        $n = preg_replace('#^models/#', '', (string)($m['name'] ?? ''));
        if (in_array('generateContent', (array)($m['supportedGenerationMethods'] ?? []), true)) $r[] = $n;
    }
    return $r;
}
/** o modelo "gemini-X-flash" estável mais novo da conta (sem lite, preview, image…) */
function gemini_descobrir(string $base, string $chave, string $dica = ''): ?string
{
    if ($dica !== '') return $dica;
    $opc = [];
    foreach (gemini_modelos($base, $chave) as $n) if (preg_match('/^gemini-([\d.]+)-flash$/', $n, $v)) $opc[$n] = (float)$v[1];
    if (!$opc) return null;
    arsort($opc); return array_key_first($opc);
}
/** outros modelos flash da conta (os mais novos primeiro), para quando o principal está sobrecarregado */
function gemini_alternativos(string $base, string $chave, string $atual): array
{
    $opc = [];
    foreach (gemini_modelos($base, $chave) as $n) {
        if ($n === $atual || !preg_match('/^gemini-([\d.]+)-flash(-lite)?$/', $n, $v)) continue;
        if (!empty($v[2]) && ($GLOBALS['tipo'] ?? '') !== 'doc') continue;   // "lite" erra mais em comprovante e histórico
        $opc[$n] = (float)$v[1] - (empty($v[2]) ? 0 : 0.05);   // o "lite" fica depois do normal da mesma versão
    }
    arsort($opc);
    return array_slice(array_keys($opc), 0, 2);
}
/** lê o erro 429 do Google: qual limite estourou (por minuto ou por dia) e quanto tempo esperar */
function gemini_cota(string $bruto): array
{
    $j = json_decode($bruto, true); $dia = false; $espera = 0.0;
    foreach ((array)($j['error']['details'] ?? []) as $d) {
        if (isset($d['retryDelay'])) $espera = (float)rtrim((string)$d['retryDelay'], 's');
        foreach ((array)($d['violations'] ?? []) as $v) if (stripos((string)($v['quotaId'] ?? ''), 'PerDay') !== false) $dia = true;
    }
    if (!$espera && preg_match('/retry in ([\d.]+)s/i', (string)($j['error']['message'] ?? ''), $m)) $espera = (float)$m[1];
    return ['dia' => $dia, 'espera' => $espera];
}
function ler_gemini(float $reserva): array
{
    global $tipo, $TEXTOS, $ARQS, $INSTR, $SCHEMA;
    $partes = [];
    foreach ($TEXTOS as $tx) $partes[] = ['text' => "Texto do documento:\n" . $tx];
    foreach ($ARQS as [$mime, $b64]) $partes[] = ['inline_data' => ['mime_type' => $mime, 'data' => $b64]];
    $corpo = json_encode([
        'system_instruction' => ['parts' => [['text' => $INSTR]]],
        'contents' => [['role' => 'user', 'parts' => array_merge($partes, [['text' => $tipo === 'teste' ? 'Devolva {"ok":"sim"}.' : 'Extraia os dados destes arquivos.']])]],
        'generationConfig' => ['responseMimeType' => 'application/json', 'responseSchema' => $SCHEMA,
            'thinkingConfig' => ['thinkingLevel' => in_array($tipo, ['doc', 'teste'], true) ? 'minimal' : 'low'],
            'mediaResolution' => $tipo === 'doc' ? 'MEDIA_RESOLUTION_MEDIUM' : 'MEDIA_RESOLUTION_HIGH'],
    ]);
    unset($partes);
    /* modelo: o do config.php, senão o último que funcionou, senão o mais novo "flash" da conta.
       O Google aposenta modelos de tempos em tempos: se o modelo sumir, o sistema descobre outro sozinho. */
    $base = defined('GEMINI_URL') ? GEMINI_URL : 'https://generativelanguage.googleapis.com/v1beta/models/';
    $chave = trim((string)GEMINI_API_KEY);
    $modelo = defined('GEMINI_MODELO') ? GEMINI_MODELO : (cfg('gemini_modelo') ?: 'gemini-3.8-flash');
    [$bruto, $cod, $erroCurl] = gemini_post($base, $modelo, $chave, $corpo, $reserva);
    /* sobrecarga do Google (503/500): espera 1 s e tenta de novo; depois tenta outro modelo flash da conta */
    if (in_array($cod, [500, 503], true) && resta() - $reserva > 15) { sleep(1); [$bruto, $cod, $erroCurl] = gemini_post($base, $modelo, $chave, $corpo, $reserva); }
    /* limite por minuto (429): se a espera pedida for curta, espera; senão usa outro modelo flash (cota separada) */
    $cota = $cod === 429 ? gemini_cota((string)$bruto) : null;
    if ($cota && !$cota['dia'] && $cota['espera'] > 0 && $cota['espera'] <= 6 && resta() - $reserva > 20) { sleep((int)ceil($cota['espera'])); [$bruto, $cod, $erroCurl] = gemini_post($base, $modelo, $chave, $corpo, $reserva); }
    if (in_array($cod, [429, 500, 503], true) && resta() - $reserva > 15) {
        foreach (gemini_alternativos($base, $chave, $modelo) as $alt) {
            if (resta() - $reserva < 12) break;
            [$b2, $c2, $e2] = gemini_post($base, $alt, $chave, $corpo, $reserva);
            if ($c2 === 200) { [$bruto, $cod, $erroCurl, $modelo] = [$b2, $c2, $e2, $alt]; $reservaModelo = true; break; }
        }
    }
    if ($cod === 404 || ($cod === 400 && preg_match('/not (found|supported)|no longer available/i', (string)$bruto))) {
        preg_match('#use (?:models/)?(gemini-[\w.\-]+)#i', (string)(json_decode((string)$bruto, true)['error']['message'] ?? ''), $sug);
        $novo = gemini_descobrir($base, $chave, $sug[1] ?? '');
        if ($novo && $novo !== $modelo) { $modelo = $novo; [$bruto, $cod, $erroCurl] = gemini_post($base, $modelo, $chave, $corpo, $reserva); }
    }
    if ($cod === 200 && empty($reservaModelo)) cfg_gravar('gemini_modelo', $modelo);   // o modelo de reserva (sobrecarga) não fica gravado
    if ($bruto === false || $cod === 0) return ['ok' => false, 'msg' => stripos($erroCurl, 'timed out') !== false || resta() < 5
        ? 'demorou demais para responder (o plano gratuito está lento agora).' : 'não foi possível conectar (' . $erroCurl . ').'];
    $j = json_decode($bruto, true);
    if ($cod !== 200) {
        $msg = (string)($j['error']['message'] ?? 'sem detalhe');
        if ($cod === 429) {
            $c4 = gemini_cota((string)$bruto);
            if ($c4['dia']) { pausar('gemini', proximas_5h(), 'cota do dia'); return ['ok' => false, 'msg' => 'a cota diária gratuita acabou (volta por volta das 5h).']; }
            pausar('gemini', time() + (int)max(20, min(120, $c4['espera'] ?: 60)), 'limite por minuto');
            return ['ok' => false, 'msg' => 'limite por minuto atingido (muitas leituras seguidas).'];
        }
        if ($cod === 503 || $cod === 500) return ['ok' => false, 'msg' => 'está sobrecarregado agora (muita gente usando).'];
        if (($cod === 400 && stripos($msg, 'API key') !== false) || $cod === 403) return ['ok' => false, 'msg' => 'a chave foi recusada: confira GEMINI_API_KEY no config.php. (' . $msg . ')'];
        return ['ok' => false, 'msg' => 'respondeu com erro ' . $cod . ': ' . $msg];
    }
    /* junta o texto das partes (o modelo pode mandar mais de uma) */
    $txt = '';
    foreach ((array)($j['candidates'][0]['content']['parts'] ?? []) as $p) if (empty($p['thought']) && isset($p['text'])) $txt .= $p['text'];
    $dados = limpar_json($txt);
    if ($dados === null) {
        $motivo = $j['candidates'][0]['finishReason'] ?? ($j['promptFeedback']['blockReason'] ?? '');
        return ['ok' => false, 'msg' => 'não devolveu os dados' . ($motivo ? ' (' . $motivo . ')' : '') . '.'];
    }
    despausar('gemini');
    return ['ok' => true, 'dados' => $dados, 'modelo' => $modelo];
}

/* ======================================================================
 *  GROQ (plano gratuito, sem cartão; API no padrão da OpenAI)
 *  Fotos: modelo de visão (GROQ_MODELO, padrão qwen/qwen3.8-27b, até 3 imagens por pedido).
 *  Só texto (PDF com texto): modelo de texto (GROQ_MODELO_TEXTO, padrão openai/gpt-oss-120b), que tem cota separada.
 * ====================================================================== */
function groq_post(array $req, float $reserva): array
{
    $url = defined('GROQ_URL') ? GROQ_URL : 'https://api.groq.com/openai/v1/chat/completions';
    $ch = curl_init($url);
    $hdr = [];
    curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => json_encode($req), CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => (int)max(4, min(35, resta() - $reserva)), CURLOPT_CONNECTTIMEOUT => 8,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Authorization: Bearer ' . trim((string)GROQ_API_KEY)],
        CURLOPT_HEADERFUNCTION => function ($c, $l) use (&$hdr) { $p = explode(':', $l, 2); if (count($p) === 2) $hdr[strtolower(trim($p[0]))] = trim($p[1]); return strlen($l); }]);
    $t0 = microtime(true);
    $b = curl_exec($ch); $c = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE); $e = curl_error($ch);
    if ($c === 400) {   // modelo que não aceita algum ajuste (raciocínio): tira o ajuste e repete
        $msg = (string)$b;
        if (preg_match('/reasoning|include_reasoning/i', $msg) && (isset($req['reasoning_effort']) || isset($req['include_reasoning']) || isset($req['reasoning_format']))) {
            unset($req['reasoning_effort'], $req['include_reasoning'], $req['reasoning_format']); return groq_post($req, $reserva);
        }
    }
    hist_leitura('groq · ' . $req['model'], $c, microtime(true) - $t0);
    return [$b, $c, $e, $hdr];
}
/** "2m59.5s", "7.66s", "120" -> segundos */
function groq_segundos(string $s): float
{
    if (is_numeric($s)) return (float)$s;
    $t = 0.0;
    if (preg_match('/([\d.]+)h/', $s, $m)) $t += 3600 * (float)$m[1];
    if (preg_match('/([\d.]+)m(?!s)/', $s, $m)) $t += 60 * (float)$m[1];
    if (preg_match('/([\d.]+)s/', $s, $m)) $t += (float)$m[1];
    return $t;
}
function ler_groq(float $reserva): array
{
    global $tipo, $TEXTOS, $ARQS, $INSTR, $SCHEMA;
    $imgs = array_values(array_filter($ARQS, fn($a) => $a[0] !== 'application/pdf'));
    if (count($ARQS) && !$imgs && !$TEXTOS) return ['ok' => false, 'msg' => 'não lê PDF escaneado direto. Recarregue a página (Ctrl+F5) para o aparelho converter o PDF em imagens.'];
    $visao = (bool)$imgs;
    $modelo = $visao ? (defined('GROQ_MODELO') ? GROQ_MODELO : 'qwen/qwen3.8-27b') : (defined('GROQ_MODELO_TEXTO') ? GROQ_MODELO_TEXTO : 'openai/gpt-oss-120b');
    $conteudo = [];
    foreach ($TEXTOS as $tx) $conteudo[] = ['type' => 'text', 'text' => "Texto do documento:\n" . $tx];
    foreach (array_slice($imgs, 0, 3) as [$mime, $b64]) $conteudo[] = ['type' => 'image_url', 'image_url' => ['url' => 'data:' . $mime . ';base64,' . $b64]];
    $conteudo[] = ['type' => 'text', 'text' => $tipo === 'teste' ? 'Devolva {"ok":"sim"}.' : 'Extraia os dados destes arquivos.'];
    $req = [
        'model' => $modelo,
        'messages' => [
            ['role' => 'system', 'content' => $INSTR . "\nResponda SOMENTE com um objeto JSON válido, exatamente neste formato (use null onde não houver valor; números com ponto decimal):\n"
                . json_encode(esqueleto($SCHEMA), JSON_UNESCAPED_UNICODE)],
            ['role' => 'user', 'content' => $visao ? $conteudo : implode("\n\n", array_column($conteudo, 'text'))],
        ],
        'response_format' => ['type' => 'json_object'],
        'temperature' => 0.1,
        'max_completion_tokens' => 3000,
    ];
    if (str_starts_with($modelo, 'qwen/')) { $req['reasoning_effort'] = 'none'; $req['reasoning_format'] = 'hidden'; }
    elseif (str_starts_with($modelo, 'openai/gpt-oss')) { $req['reasoning_effort'] = 'low'; $req['include_reasoning'] = false; }

    [$bruto, $cod, $erroCurl, $hdr] = groq_post($req, $reserva);
    if ($cod === 429) {   // limite: espera curta → espera e repete uma vez
        $espera = groq_segundos((string)($hdr['retry-after'] ?? '0'));
        if ($espera > 0 && $espera <= 8 && resta() - $reserva > $espera + 10) { sleep((int)ceil($espera)); [$bruto, $cod, $erroCurl, $hdr] = groq_post($req, $reserva); }
    }
    if ($bruto === false || $cod === 0) return ['ok' => false, 'msg' => stripos($erroCurl, 'timed out') !== false ? 'demorou demais para responder.' : 'não foi possível conectar (' . $erroCurl . ').'];
    $j = json_decode((string)$bruto, true);
    if ($cod !== 200) {
        $msg = (string)($j['error']['message'] ?? 'sem detalhe'); $code = (string)($j['error']['code'] ?? '');
        if ($cod === 400 && $code === 'json_validate_failed' && ($d = limpar_json((string)($j['error']['failed_generation'] ?? '')))) return ['ok' => true, 'dados' => $d, 'modelo' => $modelo];
        if ($cod === 429) {
            $espera = groq_segundos((string)($hdr['retry-after'] ?? '60'));
            $dia = $espera > 300 || preg_match('/per day|\bRPD\b|\bTPD\b/i', $msg);
            pausar('groq', time() + (int)max(20, min(86400, $espera ?: 60)), $dia ? 'cota do dia' : 'limite por minuto');
            return ['ok' => false, 'msg' => $dia ? 'a cota diária gratuita acabou.' : 'limite por minuto atingido (muitas leituras seguidas).'];
        }
        if ($cod === 401 || $cod === 403) return ['ok' => false, 'msg' => 'a chave foi recusada: confira GROQ_API_KEY no config.php.'];
        if ($cod === 404 || preg_match('/decommissioned|does not exist|not found/i', $msg)) return ['ok' => false, 'msg' => 'o modelo "' . $modelo . '" não existe mais. Troque GROQ_MODELO' . ($visao ? '' : '_TEXTO') . ' no config.php (veja console.groq.com/docs/models).'];
        if ($cod === 413) return ['ok' => false, 'msg' => 'arquivos grandes demais para o Groq.'];
        if ($cod >= 500) return ['ok' => false, 'msg' => 'está sobrecarregado agora.'];
        return ['ok' => false, 'msg' => 'respondeu com erro ' . $cod . ': ' . $msg];
    }
    $dados = limpar_json((string)($j['choices'][0]['message']['content'] ?? ''));
    if ($dados === null) return ['ok' => false, 'msg' => 'não devolveu os dados.'];
    despausar('groq');
    return ['ok' => true, 'dados' => $dados, 'modelo' => $modelo];
}

/* ======================================================================
 *  cascata
 * ====================================================================== */
$MOTORES = ['gemini' => ['Gemini', 'ler_gemini', gemini_ativo() || ($tipo === 'teste' && gemini_configurado())],
            'groq'   => ['Groq', 'ler_groq', groq_configurado()]];
$falha = function (string $msg, int $cod = 502) use ($resp, $tipo) { cfg_gravar('leitura_ultimo_erro', date('d/m/Y H:i') . ' · ' . $tipo . ' · ' . mb_substr($msg, 0, 300)); $resp(['erro' => $msg], $cod); };

if ($tipo === 'teste') {   // testa cada serviço configurado, um por um
    $res = []; $algum = false;
    foreach ($MOTORES as $k => [$nome, $fn, $ok]) {
        if (!$ok) continue;
        $x = $fn(0.0); $algum = $algum || $x['ok'];
        $res[$k] = $x['ok'] ? ['ok' => true, 'texto' => $nome . ' funcionando (' . $x['modelo'] . ')'] : ['ok' => false, 'texto' => $nome . ': ' . $x['msg']];
    }
    if ($algum) cfg_gravar('leitura_ultimo_erro', null);
    $resp(['ok' => $algum, 'motores' => $res, 'erro' => $algum ? null : implode(' · ', array_column($res, 'texto'))]);
}

/* ordem: Gemini primeiro; serviço em pausa (limite estourado há pouco) vai para o fim da fila */
$pausas = json_decode((string)cfg('leitura_pausas'), true) ?: [];
$fila = array_keys(array_filter($MOTORES, fn($m) => $m[2]));
usort($fila, fn($a, $b) => (($pausas[$a][0] ?? 0) > time()) <=> (($pausas[$b][0] ?? 0) > time()));
$erros = [];
foreach ($fila as $i => $k) {
    [$nome, $fn] = $MOTORES[$k];
    $ultimo = $i === count($fila) - 1;
    if ($i > 0 && resta() < 10) { $erros[] = $nome . ': sem tempo para tentar.'; break; }
    if (!$ultimo && ($pausas[$k][0] ?? 0) > time() && count($fila) > 1) {   // em pausa e há outro: pula sem gastar tempo
        $erros[] = $nome . ': em pausa até ' . date('H:i', (int)$pausas[$k][0]) . ' (' . $pausas[$k][1] . ').';
        continue;
    }
    $x = $fn($ultimo ? 0.0 : 14.0);   // guarda uns 14 s para o próximo serviço da fila
    if ($x['ok']) { $OK = $x + ['motor' => $k]; break; }
    $erros[] = $nome . ': ' . $x['msg'];
}
if (empty($OK)) {
    contar('falhas');
    $falha('Nenhum serviço gratuito conseguiu ler agora. ' . implode(' · ', $erros) . ' Use "Ler neste aparelho" ou digite.');
}
contar($OK['motor']);
registrar('leitura ' . $OK['motor'], $tipo);   // só o tipo: nenhum dado do candidato vai para o registro
$dados = $OK['dados'];

/* ---------- normaliza o que o serviço devolveu ---------- */
$n = fn($v) => is_numeric($v) ? round(((float)$v > 10 && (float)$v <= 100 ? (float)$v / 10 : (float)$v), 2) : null;
$t = fn($v) => is_string($v) && trim($v) !== '' && !preg_match('/^(null|n\/?a|-+|texto ou null)$/i', trim($v)) ? trim($v) : null;
$tel = function ($v) { $d = so_digitos((string)$v); if (strlen($d) === 11) return '(' . substr($d, 0, 2) . ') ' . substr($d, 2, 5) . '-' . substr($d, 7); if (strlen($d) === 10) return '(' . substr($d, 0, 2) . ') ' . substr($d, 2, 4) . '-' . substr($d, 6); return $v ? trim((string)$v) : null; };
$r = [];
if ($tipo === 'doc') {
    foreach (['nome', 'cpf', 'nascimento', 'mae', 'pai', 'naturalidade', 'sexo'] as $k) $r[$k] = $t($dados[$k] ?? null);
    if ($r['nascimento'] && preg_match('#^(\d{2})/(\d{2})/(\d{4})$#', $r['nascimento'], $m)) $r['nascimento'] = "$m[3]-$m[2]-$m[1]";
    if ($r['nascimento'] && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $r['nascimento'])) $r['nascimento'] = null;
    if ($r['cpf']) { if (!cpf_valido($r['cpf'])) $r['cpf_duvida'] = true; $r['cpf'] = cpf_fmt($r['cpf']); }
    foreach (['nome', 'pai', 'mae', 'naturalidade'] as $k) if ($r[$k]) $r[$k] = mb_strtoupper($r[$k]);
    if ($r['sexo']) $r['sexo'] = stripos($r['sexo'], 'f') === 0 ? 'Feminino' : (stripos($r['sexo'], 'm') === 0 ? 'Masculino' : $r['sexo']);
} elseif ($tipo === 'end') {
    foreach (['titular', 'telefone', 'endereco', 'bairro', 'cidade', 'cep'] as $k) $r[$k] = $t($dados[$k] ?? null);
    foreach (['titular', 'endereco', 'bairro', 'cidade'] as $k) if ($r[$k]) $r[$k] = mb_strtoupper($r[$k]);
    if ($r['telefone']) $r['telefone'] = $tel($r['telefone']);
    if ($r['cep'] && strlen(so_digitos($r['cep'])) === 8) { $c = so_digitos($r['cep']); $r['cep'] = substr($c, 0, 5) . '-' . substr($c, 5); }
    $r['cota_bairro'] = eh_bairro_cota($r['bairro'] ?? '', $r['endereco'] ?? '');
} else {
    $r['email'] = $t($dados['email'] ?? null); if ($r['email'] && !filter_var($r['email'], FILTER_VALIDATE_EMAIL)) $r['email'] = null; if ($r['email']) $r['email'] = mb_strtolower($r['email']);
    $r['telefone'] = $t($dados['telefone'] ?? null) ? $tel($dados['telefone']) : null;
    if ($tipo === 'h68' && ($x = $t($dados['escola'] ?? null))) $r['escola_origem'] = mb_strtoupper($x);
}
$r = array_filter($r, fn($v) => $v !== null && $v !== '');
$notas = [];
foreach ((array)($dados['disciplinas'] ?? []) as $d) {
    if (!is_array($d)) continue;
    $nome = trim((string)($d['nome'] ?? '')); if ($nome === '') continue;
    $notas[$nome] = $tipo === 'h68' ? [$n($d['n6'] ?? null), $n($d['n7'] ?? null), $n($d['n8'] ?? null)] : [$n($d['b1'] ?? null), $n($d['b2'] ?? null), $n($d['b3'] ?? null), $n($d['b4'] ?? null)];
}
$resp(['ok' => true, 'motor' => $OK['motor'], 'modelo' => $OK['modelo'], 'segundos' => round(microtime(true) - $INICIO, 1), 'dados' => $r, 'notas' => $notas]);
