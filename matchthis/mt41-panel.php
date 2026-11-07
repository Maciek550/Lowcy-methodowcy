<?php
declare(strict_types=1);
require __DIR__.'/.mt41-private/mt41-auth.php';
mt41_session_start();
$account=mt41_authenticated();
if($account===null){header('Location: /',true,303);exit;}
$target=$account['role']==='admin'?__DIR__.'/role-pages/mt41-admin.php':__DIR__.'/role-pages/mt41-sedzia.php';
if(!is_file($target)||is_link($target)){http_response_code(503);exit('Panel niedostępny');}
header('Content-Type: text/html; charset=UTF-8');
define('MATCHTHIS_AUTHED',true);
require $target;
