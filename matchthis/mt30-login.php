<?php
declare(strict_types=1);
ini_set('session.use_strict_mode','1');
ini_set('session.use_only_cookies','1');
session_name('MATCHTHIS29');
session_set_cookie_params(['lifetime'=>0,'path'=>'/','secure'=>true,'httponly'=>true,'samesite'=>'Strict']);
session_start();
header('Cache-Control: no-store, no-cache, must-revalidate');
header('X-Content-Type-Options: nosniff');
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {http_response_code(405);exit;}
$users = [
 'mt-admin'=>['hash'=>'$2y$12$vXt1KxMNIlUQqgrr4wJMGOiEqpL58eK7yWGhAxXzW9DXrwunJsBCy','role'=>'admin'],
 'mt-sedzia'=>['hash'=>'$2y$12$/ge8MB54DJsk.Qx21HkXUuyOuMsVWpXDFmA3w1L7AgwUAdtHNCPru','role'=>'judge']
];
$user=trim((string)($_POST['username']??''));
$pass=(string)($_POST['password']??'');
if (strlen($user)>48||strlen($pass)>200) {http_response_code(400);exit;}
$record=$users[$user]??null;
if ($record===null || !password_verify($pass,$record['hash'])) {usleep(250000);header('Location: /?login_error=1',true,303);exit;}
session_regenerate_id(true);
$_SESSION['matchthis_role']=$record['role'];
$_SESSION['matchthis_user']=$user;
header('Location: /panel.php',true,303);exit;
