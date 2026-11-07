<?php
declare(strict_types=1);
/* MT-41: protected PHP credential store. This hosting has open_basedir to public_html. */
function mt41_session_start(): void {
 ini_set('session.use_strict_mode','1');
 ini_set('session.use_only_cookies','1');
 session_name('MATCHTHIS29');
 session_set_cookie_params(['lifetime'=>0,'path'=>'/','secure'=>true,'httponly'=>true,'samesite'=>'Strict']);
 session_start();
 header('Cache-Control: no-store, no-cache, must-revalidate');
 header('Pragma: no-cache');
 header('X-Content-Type-Options: nosniff');
 header('X-Frame-Options: DENY');
 header('Referrer-Policy: no-referrer');
}
function mt41_users_file(): string { return __DIR__.'/users.php'; }
function mt41_read_users(): array {
 $path=mt41_users_file();
 if(!is_file($path)||is_link($path))throw new RuntimeException('Brak prywatnego magazynu kont');
 if(filesize($path)>25000)throw new RuntimeException('Magazyn kont jest za duży');
 if(!defined('MATCHTHIS_AUTH_INTERNAL'))define('MATCHTHIS_AUTH_INTERNAL',true);
 $users=require $path;
 if(!is_array($users))throw new RuntimeException('Nieprawidłowe konta');
 foreach($users as $username=>$record) {
  if(!is_string($username)||!is_array($record)||!isset($record['role'],$record['hash'])
    ||!in_array($record['role'],['admin','judge'],true)||!is_string($record['hash'])
    ||!password_get_info($record['hash'])['algo'])throw new RuntimeException('Nieprawidłowe dane kont');
 }
 return $users;
}
function mt41_authenticated(): ?array {
 $username=$_SESSION['matchthis_user']??null;
 $role=$_SESSION['matchthis_role']??null;
 $authTag=$_SESSION['mt41_auth_tag']??null;
 if(!is_string($username)||!is_string($role)||!is_string($authTag))return null;
 try {$record=mt41_read_users()[$username]??null;}catch(Throwable $e){return null;}
 if(!is_array($record)||!hash_equals($record['role'],$role)
   ||!hash_equals(hash('sha256',$record['hash']),$authTag))return null;
 return ['username'=>$username,'role'=>$role];
}
function mt41_begin_login(string $username,array $record): void {
 session_regenerate_id(true);
 $_SESSION['matchthis_role']=$record['role'];
 $_SESSION['matchthis_user']=$username;
 $_SESSION['mt41_auth_tag']=hash('sha256',$record['hash']);
 $_SESSION['mt41_csrf']=bin2hex(random_bytes(32));
 unset($_SESSION['mt41_failed_count'],$_SESSION['mt41_failed_until']);
}
function mt41_csrf(): string {
 if(!isset($_SESSION['mt41_csrf'])||!is_string($_SESSION['mt41_csrf']))
   $_SESSION['mt41_csrf']=bin2hex(random_bytes(32));
 return $_SESSION['mt41_csrf'];
}
function mt41_change_password(string $username,string $current,string $next): bool {
 $lockPath=__DIR__.'/users.lock';
 if(is_link($lockPath))throw new RuntimeException('Nieprawidłowa blokada magazynu');
 $handle=fopen($lockPath,'c');
 if(!$handle)throw new RuntimeException('Brak dostępu do blokady');
 try {
  if(!flock($handle,LOCK_EX))throw new RuntimeException('Nie można zablokować magazynu');
  $users=mt41_read_users();
  $record=$users[$username]??null;
  if(!$record||!password_verify($current,$record['hash']))return false;
  $hash=password_hash($next,PASSWORD_DEFAULT);
  if(!$hash)throw new RuntimeException('Nie można zapisać hasła');
  $users[$username]['hash']=$hash;
  $payload='<?php if (!defined("MATCHTHIS_AUTH_INTERNAL")) {http_response_code(404);exit;} return '.var_export($users,true).";\\n";
  $temp=__DIR__.'/.users-'.bin2hex(random_bytes(12)).'.php';
  try {
   if(file_put_contents($temp,$payload,LOCK_EX)!==strlen($payload))throw new RuntimeException('Niepełny zapis');
   chmod($temp,0600);
   if(!rename($temp,mt41_users_file()))throw new RuntimeException('Błąd zapisu hasła');
  }finally{if(is_file($temp))unlink($temp);}
  $_SESSION['mt41_auth_tag']=hash('sha256',$hash);
  $_SESSION['mt41_csrf']=bin2hex(random_bytes(32));
  session_regenerate_id(true);
  return true;
 }finally{flock($handle,LOCK_UN);fclose($handle);}
}
