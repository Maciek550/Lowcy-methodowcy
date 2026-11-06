<?php
declare(strict_types=1);
ini_set('session.use_strict_mode','1');
session_name('MATCHTHIS29');
session_set_cookie_params(['lifetime'=>0,'path'=>'/','secure'=>true,'httponly'=>true,'samesite'=>'Strict']);
session_start();
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: no-referrer');
$role=$_SESSION['matchthis_role']??'';
if ($role!=='admin' && $role!=='judge') {header('Location: /',true,303);exit;}
$target=$role==='admin'?__DIR__.'/role-pages/mt32-admin.php':__DIR__.'/role-pages/mt32-sedzia.php';
if (!is_file($target)||is_link($target)) {http_response_code(503);echo 'Panel niedostępny';exit;}
header('Content-Type: text/html; charset=UTF-8');
define('MATCHTHIS_AUTHED',true);
require $target;
