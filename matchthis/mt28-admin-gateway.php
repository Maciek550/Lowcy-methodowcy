<?php
declare(strict_types=1);
// MatchThis MT-28: isolated administrator gateway. The admin HTML stays outside public_html.
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: no-referrer');
$expectedUser = 'mt-admin';
$hash = '$2y$12$DO.HEWC75.xgLzb8KGEanuT9M1jc0cFePHOUMfjpkZ4n1jmIMX6Ji';
$user = $_SERVER['PHP_AUTH_USER'] ?? '';
$pass = $_SERVER['PHP_AUTH_PW'] ?? '';
if (!$user && !empty($_SERVER['HTTP_AUTHORIZATION'])) {
    $auth = (string) $_SERVER['HTTP_AUTHORIZATION'];
    if (stripos($auth, 'Basic ') === 0) {
        $decoded = base64_decode(substr($auth, 6), true);
        if ($decoded !== false && str_contains($decoded, ':')) {
            [$user, $pass] = explode(':', $decoded, 2);
        }
    }
}
if (!hash_equals($expectedUser, (string) $user) || !password_verify((string) $pass, $hash)) {
    header('WWW-Authenticate: Basic realm="MatchThis MT-28 ADMIN", charset="UTF-8"');
    http_response_code(401);
    echo 'Panel administratora MatchThis wymaga logowania.';
    exit;
}
$file = '/home/lowcymethodowcy/matchthis-independent/mt-28/MatchThis_MT-28.html';
if (!is_file($file) || is_link($file)) {
    http_response_code(503);
    echo 'Panel administratora jest niedostępny.';
    exit;
}
header('Content-Type: text/html; charset=UTF-8');
readfile($file);
