<?php
declare(strict_types=1);
ini_set('session.use_strict_mode','1');
session_name('MATCHTHIS29');
session_set_cookie_params(['lifetime'=>0,'path'=>'/','secure'=>true,'httponly'=>true,'samesite'=>'Strict']);
session_start();
header('Cache-Control: no-store');
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {http_response_code(405);exit;}
$_SESSION=[];
if (ini_get('session.use_cookies')) {
 setcookie(session_name(),'', ['expires'=>time()-3600,'path'=>'/','secure'=>true,'httponly'=>true,'samesite'=>'Strict']);
}
session_destroy();header('Location: /',true,303);exit;
