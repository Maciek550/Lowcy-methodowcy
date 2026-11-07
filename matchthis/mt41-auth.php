<?php
declare(strict_types=1);
/* MT-41: private credential store. Deploy outside public_html. */
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
function mt41_users_file(): string { return __DIR__.'/users.json'; }
function mt41_read_users(): array {
 $path=mt41_users_file();
 if(!is_file($path)||is_link($path))throw new RuntimeException('Brak prywatnego magazynu kont');
 $raw=file_get_contents($path);
 if($raw===false||strlen($raw)>20000)throw new RuntimeException('Nie można odczytać magazynu kont');
 $users=json_decode($raw,true,16,JSON_THROW_ON_ERROR);
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
  $json=json_encode($users,JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
  $temp=tempnam(__DIR__,'.users-');
  if(!$temp)throw new RuntimeException('Nie można zapisać hasła');
  try {
   chmod($temp,0600);
   if(file_put_contents($temp,$json,LOCK_EX)!==strlen($json))throw new RuntimeException('Niepełny zapis');
   if(!rename($temp,mt41_users_file()))throw new RuntimeException('Błąd zapisu hasła');
  }finally{if(is_file($temp))unlink($temp);}
  $_SESSION['mt41_auth_tag']=hash('sha256',$hash);
  $_SESSION['mt41_csrf']=bin2hex(random_bytes(32));
  session_regenerate_id(true);
  return true;
 }finally{flock($handle,LOCK_UN);fclose($handle);}
}
