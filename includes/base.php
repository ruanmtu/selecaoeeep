<?php
/* ======================================================================
 *  Sistema da Seleção de Estudantes — EEEP Venceslau Vieira Batista
 *  selecao.eeepvenceslau.com.br · sistema interno (só com login)
 *  Site próprio, com banco de dados e contas de usuário próprios.
 * ====================================================================== */
declare(strict_types=1);

const SEL_VERSAO = '8';
const SEL_RAIZ_ESCOLA = 'https://eeepvenceslau.com.br/';
const SEL_DISC_PADRAO = ['Língua Portuguesa', 'Matemática', 'Ciências', 'História', 'Geografia', 'Arte', 'Educação Física', 'Língua Inglesa', 'Ensino Religioso'];

/* ---------- configuração: includes/config.php (fica só no servidor; modelo em config.exemplo.php) ---------- */
if (is_file(__DIR__ . '/config.php')) require_once __DIR__ . '/config.php';
ini_set('display_errors', (defined('EXIBIR_ERROS') && EXIBIR_ERROS) || getenv('SELECAO_SQLITE') ? '1' : '0');
date_default_timezone_set('America/Fortaleza');

header('X-Frame-Options: DENY');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: same-origin');
header('X-Robots-Tag: noindex, nofollow');

session_name('SELECAO');
session_set_cookie_params(['lifetime' => 0, 'path' => '/', 'httponly' => true, 'samesite' => 'Lax', 'secure' => !empty($_SERVER['HTTPS'])]);
session_start();

/* ---------- banco ---------- */
function db(bool $reconectar = false): PDO
{
    static $pdo = null;
    if ($reconectar) $pdo = null;
    if ($pdo) return $pdo;
    $op = [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC, PDO::ATTR_EMULATE_PREPARES => false];
    if ($sq = getenv('SELECAO_SQLITE')) { $pdo = new PDO('sqlite:' . $sq, null, null, $op); }   // só nos testes locais
    else {
        if (!defined('DB_HOST')) { http_response_code(503); exit('Falta o arquivo includes/config.php no servidor (veja config.exemplo.php).'); }
        try {
            $pdo = new PDO('mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4', DB_USER, DB_PASS, $op);
            $pdo->exec("SET time_zone = '-03:00'");
        } catch (PDOException $e) {
            error_log('[selecao] banco: ' . $e->getMessage());
            http_response_code(503); exit('<!doctype html><meta charset="utf-8"><p style="font-family:sans-serif;margin:20vh auto;max-width:480px">Sistema temporariamente indisponível. Tente novamente em instantes.</p>');
        }
    }
    sel_migrar($pdo);
    return $pdo;
}
function eh_mysql(): bool { return db()->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql'; }
function q(string $sql, array $p = []): PDOStatement
{
    try { $s = db()->prepare($sql); $s->execute($p); return $s; }
    catch (PDOException $e) {
        /* a hospedagem fecha a conexão parada (ex.: enquanto o Gemini lê um documento): reconecta e repete uma vez */
        if (!preg_match('/gone away|Lost connection|2006|2013/i', $e->getMessage())) throw $e;
        $s = db(true)->prepare($sql); $s->execute($p); return $s;
    }
}
function q_um(string $sql, array $p = []): ?array { $r = q($sql, $p)->fetch(); return $r ?: null; }
function q_todos(string $sql, array $p = []): array { return q($sql, $p)->fetchAll(); }
function q_valor(string $sql, array $p = []) { $r = q($sql, $p)->fetchColumn(); return $r === false ? null : $r; }

function sel_migrar(PDO $pdo): void
{
    $my = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql';
    $id = $my ? 'INT UNSIGNED AUTO_INCREMENT PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
    $fim = $my ? ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci' : '';
    $tem = fn($t) => $my ? (bool)$pdo->query("SHOW TABLES LIKE '$t'")->fetch() : (bool)$pdo->query("SELECT name FROM sqlite_master WHERE type='table' AND name='$t'")->fetch();
    if ($tem('sel_candidatos')) { sel_migrar_colunas($pdo, $my); return; }
    $pdo->exec("CREATE TABLE IF NOT EXISTS sel_usuarios (id $id, nome VARCHAR(120) NOT NULL, email VARCHAR(160) NOT NULL UNIQUE, senha_hash VARCHAR(255) NOT NULL,
        papel VARCHAR(20) NOT NULL DEFAULT 'digitador', ativo TINYINT NOT NULL DEFAULT 1, criado_em DATETIME NOT NULL, ultimo_acesso DATETIME NULL)$fim");
    $pdo->exec("CREATE TABLE IF NOT EXISTS sel_config (chave VARCHAR(60) PRIMARY KEY, valor TEXT NULL)$fim");
    $pdo->exec("CREATE TABLE IF NOT EXISTS sel_log (id $id, usuario_id INT NULL, acao VARCHAR(40) NOT NULL, detalhe VARCHAR(255) NULL, criado_em DATETIME NOT NULL)$fim");
    $pdo->exec("CREATE TABLE IF NOT EXISTS sel_candidatos (id $id, ano INT NOT NULL, nome VARCHAR(160) NOT NULL, cpf VARCHAR(14) NULL, nascimento DATE NULL,
        pai VARCHAR(160) NULL, mae VARCHAR(160) NULL, email VARCHAR(160) NULL, telefone VARCHAR(30) NULL, endereco VARCHAR(255) NULL, bairro VARCHAR(120) NULL, cidade VARCHAR(120) NULL,
        escola_origem VARCHAR(160) NULL, curso VARCHAR(60) NOT NULL, cota_bairro TINYINT NOT NULL DEFAULT 0, pcd TINYINT NOT NULL DEFAULT 0,
        notas TEXT NULL, media DECIMAL(6,3) NULL, situacao VARCHAR(20) NOT NULL DEFAULT 'ativo', obs VARCHAR(500) NULL,
        criado_por INT NULL, criado_em DATETIME NOT NULL, atualizado_por INT NULL, atualizado_em DATETIME NULL)$fim");
    $pdo->exec('CREATE UNIQUE INDEX sel_cand_cpf ON sel_candidatos (ano, cpf)');
    $pdo->exec('CREATE INDEX sel_cand_curso ON sel_candidatos (ano, curso)');
    sel_migrar_colunas($pdo, $my);
}
/* v2: naturalidade, sexo, titular do comprovante e CEP */
function sel_migrar_colunas(PDO $pdo, bool $my): void
{
    $cols = $my ? array_column($pdo->query('SHOW COLUMNS FROM sel_candidatos')->fetchAll(), 'Field') : array_column($pdo->query('PRAGMA table_info(sel_candidatos)')->fetchAll(), 'name');
    foreach (['naturalidade' => 'VARCHAR(120) NULL', 'sexo' => 'VARCHAR(20) NULL', 'titular' => 'VARCHAR(160) NULL', 'cep' => 'VARCHAR(10) NULL'] as $c => $t)
        if (!in_array($c, $cols, true)) $pdo->exec("ALTER TABLE sel_candidatos ADD COLUMN $c $t");
}

/* ---------- utilidades ---------- */
function e($v): string { return htmlspecialchars((string)($v ?? ''), ENT_QUOTES, 'UTF-8'); }
function redirecionar(string $u): never { header('Location: ' . $u); exit; }
function eh_post(): bool { return ($_SERVER['REQUEST_METHOD'] ?? '') === 'POST'; }
function agora(): string { return date('Y-m-d H:i:s'); }
function flash(string $tipo, string $msg): void { $_SESSION['flash'][] = [$tipo, $msg]; }
function flash_html(): string
{
    $h = '';
    foreach ($_SESSION['flash'] ?? [] as [$t, $m]) $h .= '<div class="sl-aviso ' . e($t) . '"><i class="bi bi-' . ($t === 'erro' ? 'exclamation-octagon' : ($t === 'atencao' ? 'exclamation-triangle' : 'check-circle')) . '"></i><span>' . e($m) . '</span></div>';
    unset($_SESSION['flash']);
    return $h;
}
function csrf_token(): string { return $_SESSION['csrf'] ??= bin2hex(random_bytes(32)); }
function csrf_campo(): string { return '<input type="hidden" name="csrf" value="' . csrf_token() . '">'; }
function csrf_verificar(): void
{
    $t = $_POST['csrf'] ?? '';
    if (!is_string($t) || !hash_equals(csrf_token(), $t)) { http_response_code(400); exit('Formulário expirado. Volte, recarregue a página e tente de novo.'); }
}
function registrar(string $acao, string $det = ''): void
{
    try { q('INSERT INTO sel_log (usuario_id, acao, detalhe, criado_em) VALUES (?, ?, ?, ?)', [$_SESSION['sel_uid'] ?? null, $acao, mb_substr($det, 0, 255), agora()]); } catch (Throwable $e) {}
}
function so_digitos(?string $s): string { return preg_replace('/\D+/', '', (string)$s); }
function cpf_valido(string $c): bool
{
    $c = so_digitos($c);
    if (strlen($c) !== 11 || preg_match('/^(\d)\1{10}$/', $c)) return false;
    for ($t = 9; $t < 11; $t++) { $s = 0; for ($i = 0; $i < $t; $i++) $s += (int)$c[$i] * ($t + 1 - $i); if ((int)$c[$t] !== ((10 * $s) % 11) % 10) return false; }
    return true;
}
function cpf_fmt(?string $c): string { $c = so_digitos($c); return strlen($c) === 11 ? substr($c, 0, 3) . '.' . substr($c, 3, 3) . '.' . substr($c, 6, 3) . '-' . substr($c, 9) : (string)$c; }
function nome_proprio(string $n): string
{
    $n = trim(preg_replace('/\s+/', ' ', $n)); if ($n === '') return '';
    $min = ['da', 'de', 'do', 'das', 'dos', 'e'];
    return implode(' ', array_map(fn($p, $i) => $i > 0 && in_array(mb_strtolower($p), $min, true) ? mb_strtolower($p) : mb_convert_case(mb_strtolower($p), MB_CASE_TITLE), explode(' ', $n), array_keys(explode(' ', $n))));
}
function sem_acento(string $s): string { return strtolower(strtr($s, ['á'=>'a','à'=>'a','â'=>'a','ã'=>'a','é'=>'e','ê'=>'e','í'=>'i','ó'=>'o','ô'=>'o','õ'=>'o','ú'=>'u','ç'=>'c','Á'=>'a','À'=>'a','Â'=>'a','Ã'=>'a','É'=>'e','Ê'=>'e','Í'=>'i','Ó'=>'o','Ô'=>'o','Õ'=>'o','Ú'=>'u','Ç'=>'c'])); }
function nota_fmt($v, int $c = 2): string { return $v === null || $v === '' ? '—' : number_format((float)$v, $c, ',', '.'); }

/* ---------- configuração da seleção ---------- */
function cfg(string $k, $padrao = null)
{
    static $cache = null;
    if ($cache === null) { $cache = []; foreach (q_todos('SELECT chave, valor FROM sel_config') as $r) $cache[$r['chave']] = $r['valor']; }
    return array_key_exists($k, $cache) ? $cache[$k] : $padrao;
}
function cfg_gravar(string $k, ?string $v): void
{
    if (eh_mysql()) q('INSERT INTO sel_config (chave, valor) VALUES (?, ?) ON DUPLICATE KEY UPDATE valor = VALUES(valor)', [$k, $v]);
    else q('INSERT INTO sel_config (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor', [$k, $v]);
}
function sel_ano(): int { return (int)cfg('ano', '2027'); }
/** cursos: [nome => [total, pcd, bairro]] */
function sel_cursos(): array
{
    $c = json_decode((string)cfg('cursos', ''), true);
    if (!is_array($c) || !$c) $c = ['Enfermagem' => [45, 1, 0], 'Informática' => [45, 1, 0], 'Administração' => [45, 1, 0], 'Inteligência Artificial' => [45, 1, 0]];
    return $c;
}
function sel_bairros(): array
{
    $b = json_decode((string)cfg('bairros', ''), true);
    return is_array($b) && $b ? $b : ['Alto da Queiroz', 'Recreio', 'Cohab'];
}
function eh_bairro_cota(?string $bairro, ?string $endereco = ''): bool
{
    $t = ' ' . preg_replace('/[^a-z0-9]+/', ' ', sem_acento(($bairro ?? '') . ' ' . ($endereco ?? ''))) . ' ';
    foreach (sel_bairros() as $b) { $n = ' ' . preg_replace('/[^a-z0-9]+/', ' ', sem_acento($b)) . ' '; if (trim($n) !== '' && str_contains($t, $n)) return true; }
    return false;
}

/* ---------- notas e média ---------- */
/** notas: {"6": {"disc": nota}, "7": {...}, "8": {...}, "9": {"disc": [b1, b2, b3, b4]}} */
function notas_media(array $n): array
{
    $soma = 0.0; $qtd = 0; $porAno = [];
    foreach (['6', '7', '8', '9'] as $a) {
        $sa = 0.0; $qa = 0;
        foreach ((array)($n[$a] ?? []) as $v) {
            if (is_array($v)) { $b = array_values(array_filter($v, fn($x) => $x !== null && $x !== '' && is_numeric($x))); if (!$b) continue; $v = array_sum($b) / count($b); }
            if ($v === null || $v === '' || !is_numeric($v)) continue;
            $sa += (float)$v; $qa++;
        }
        $porAno[$a] = $qa ? $sa / $qa : null; $soma += $sa; $qtd += $qa;
    }
    return ['media' => $qtd ? round($soma / $qtd, 3) : null, 'qtd' => $qtd, 'anos' => $porAno];
}

/* ---------- login ---------- */
function usuario(): ?array
{
    static $u = false;
    if ($u !== false) return $u;
    $u = empty($_SESSION['sel_uid']) ? null : q_um('SELECT id, nome, email, papel, ativo FROM sel_usuarios WHERE id = ? AND ativo = 1', [$_SESSION['sel_uid']]);
    if (!$u) unset($_SESSION['sel_uid']);
    return $u;
}
function exigir_login(): array
{
    $u = usuario();
    if (!$u) { if (!q_valor('SELECT COUNT(*) FROM sel_usuarios')) redirecionar('instalar.php'); redirecionar('index.php'); }
    if (time() - ($_SESSION['sel_visto'] ?? time()) > 4 * 3600) { session_destroy(); redirecionar('index.php?expirou=1'); }   // 4 h sem uso
    $_SESSION['sel_visto'] = time();
    return $u;
}
function exigir_admin(): array
{
    $u = exigir_login();
    if ($u['papel'] !== 'admin') { flash('erro', 'Só o administrador da seleção pode abrir essa página.'); redirecionar('candidatos.php'); }
    return $u;
}
function eh_admin(): bool { return (usuario()['papel'] ?? '') === 'admin'; }

/* ---------- classificação ----------
 * Para cada curso: (1) ampla concorrência com TODOS os candidatos pela média;
 * (2) vagas PCD entre os PCD que sobraram; (3) vagas de bairro entre os de bairro que sobraram;
 * (4) vaga de cota que ninguém ocupou volta para a ampla (se ligado nas configurações);
 * (5) quem sobra fica na lista de espera, na ordem da média.
 * Desempate: o critério escolhido nas configurações. */
function sel_desempates(): array
{
    return ['idade' => 'Mais velho primeiro', 'nota9' => 'Maior média do 9º ano', 'lpmat' => 'Maior média de Português + Matemática'];
}
function sel_chave_ordem(array $c): array
{
    $n = json_decode((string)$c['notas'], true) ?: []; $m = notas_media($n);
    $lpm = []; foreach (['6', '7', '8', '9'] as $a) foreach ((array)($n[$a] ?? []) as $d => $v) {
        if (!preg_match('/portugu|matem/i', sem_acento((string)$d))) continue;
        if (is_array($v)) { $v = array_filter($v, fn($x) => $x !== null && $x !== ''); if (!$v) continue; $v = array_sum($v) / count($v); }
        if (is_numeric($v)) $lpm[] = (float)$v;
    }
    $crit = cfg('desempate', 'idade');
    $seg = match ($crit) { 'nota9' => (float)($m['anos']['9'] ?? 0), 'lpmat' => $lpm ? array_sum($lpm) / count($lpm) : 0, default => $c['nascimento'] ? -strtotime($c['nascimento']) : -PHP_INT_MAX };
    return [(float)$c['media'], $seg, -(int)$c['id']];
}
function sel_classificar(string $curso): array
{
    $cfgc = sel_cursos()[$curso] ?? [45, 0, 0]; [$total, $vpcd, $vbairro] = array_map('intval', $cfgc);
    $sobra_ampla = cfg('sobra_ampla', '1') === '1';
    $lista = q_todos("SELECT * FROM sel_candidatos WHERE ano = ? AND curso = ? AND situacao = 'ativo' AND media IS NOT NULL", [sel_ano(), $curso]);
    foreach ($lista as &$x) $x['_k'] = sel_chave_ordem($x); unset($x);
    usort($lista, fn($a, $b) => $b['_k'] <=> $a['_k']);
    foreach ($lista as $i => &$x) { $x['pos_geral'] = $i + 1; $x['vaga'] = null; } unset($x);
    $vampla = max(0, $total - $vpcd - $vbairro);
    $usados = ['ampla' => 0, 'pcd' => 0, 'bairro' => 0];
    $ocupa = function (string $tipo, int $vagas, callable $pode) use (&$lista, &$usados) {
        foreach ($lista as &$x) { if ($usados[$tipo] >= $vagas) break; if ($x['vaga'] === null && $pode($x)) { $x['vaga'] = $tipo; $usados[$tipo]++; } } unset($x);
    };
    $ocupa('ampla', $vampla, fn($x) => true);
    $ocupa('pcd', $vpcd, fn($x) => (int)$x['pcd'] === 1);
    $ocupa('bairro', $vbairro, fn($x) => (int)$x['cota_bairro'] === 1);
    $extra = 0;
    if ($sobra_ampla) { $extra = ($vpcd - $usados['pcd']) + ($vbairro - $usados['bairro']); $antes = $usados['ampla']; $ocupa('ampla', $vampla + $extra, fn($x) => true); $extra = $usados['ampla'] - $antes; }
    $esp = 0; foreach ($lista as &$x) if ($x['vaga'] === null) $x['espera'] = ++$esp; unset($x);
    return ['lista' => $lista, 'vagas' => ['total' => $total, 'ampla' => $vampla, 'pcd' => $vpcd, 'bairro' => $vbairro], 'usados' => $usados, 'extra' => $extra];
}

/* ---------- leitura com o Gemini (opcional: precisa de GEMINI_API_KEY no config.php) ---------- */
function gemini_configurado(): bool { return defined('GEMINI_API_KEY') && strlen((string)GEMINI_API_KEY) > 20; }
function gemini_ativo(): bool { return gemini_configurado() && cfg('leitura', 'gemini') === 'gemini' && function_exists('curl_init'); }
