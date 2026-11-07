<?php
declare(strict_types=1);
require dirname(__DIR__,3).'/matchthis-independent/auth/mt41-auth.php';
mt41_session_start();
$account=mt41_authenticated();
if(!$account){header('Location: /',true,303);exit;}
$error='';
if($_SERVER['REQUEST_METHOD']==='POST'){
 $csrf=(string)($_POST['csrf']??'');
 $current=(string)($_POST['current_password']??'');
 $next=(string)($_POST['new_password']??'');
 $confirm=(string)($_POST['new_password_confirm']??'');
 if(!hash_equals(mt41_csrf(),$csrf)){http_response_code(403);$error='Nieprawidłowa sesja formularza.';}
 elseif((int)($_SESSION['mt41_failed_until']??0)>time()){http_response_code(429);$error='Zbyt wiele prób. Spróbuj za 15 minut.';}
 elseif($next!==$confirm){http_response_code(400);$error='Hasła nie są identyczne.';}
 elseif(strlen($next)<12||strlen($next)>72){http_response_code(400);$error='Nowe hasło musi mieć minimum 12 znaków i maksymalnie 72 bajty.';}
 elseif($next===$current){http_response_code(400);$error='Nowe hasło musi być inne niż stare.';}
 else{
  try{
   if(mt41_change_password($account['username'],$current,$next)){
    unset($_SESSION['mt41_failed_count'],$_SESSION['mt41_failed_until']);
    header('Location: /change-password.php?changed=1',true,303);exit;
   }
   $_SESSION['mt41_failed_count']=(int)($_SESSION['mt41_failed_count']??0)+1;
   if($_SESSION['mt41_failed_count']>=5){$_SESSION['mt41_failed_until']=time()+900;$_SESSION['mt41_failed_count']=0;}
   http_response_code(400);$error='Aktualne hasło jest nieprawidłowe.';
  }catch(Throwable $e){error_log('MT41 update failed');http_response_code(503);$error='Nie udało się zapisać zmiany.';}
 }
}elseif($_SERVER['REQUEST_METHOD']!=='GET'){http_response_code(405);exit;}
$changed=$_SERVER['REQUEST_METHOD']==='GET'&&($_GET['changed']??'')==='1';
$csrf=htmlspecialchars(mt41_csrf(),ENT_QUOTES,'UTF-8');
$user=htmlspecialchars($account['username'],ENT_QUOTES,'UTF-8');
?><!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>MatchThis MT-41 — Zmiana hasła</title>
<style>
body{margin:0;background:#f4f4f4;color:#292c32;font:15px/1.5 system-ui,Arial,sans-serif;padding:20px}
main{max-width:420px;margin:5vh auto;border:1px solid #ddd;border-top:4px solid #e96609;border-radius:8px;background:#fff;padding:24px}
h1{font-size:22px;margin:0 0 12px}label{display:block;margin:12px 0 4px;font-weight:700}
input{display:block;width:100%;box-sizing:border-box;padding:11px;font:inherit;border:1px solid #afb4ba;border-radius:4px}
button,a.back{display:inline-block;padding:11px 14px;margin:16px 8px 0 0;font:inherit;font-weight:700;text-decoration:none;cursor:pointer;border-radius:4px}
button{color:#fff;border:0;background:#e96609}a.back{border:1px solid #888;color:#292c32}.error{color:#a2121c}.ok{color:#186136}
</style></head><body><main><h1>MatchThis MT-41 — Zmiana hasła</h1><p>Konto: <b><?= $user ?></b></p>
<?php if($changed): ?><p class="ok" role="status">Hasło zostało zmienione. Przy kolejnym logowaniu użyj nowego hasła.</p>
<?php else: ?><p role="alert" class="error"><?= htmlspecialchars($error,ENT_QUOTES,'UTF-8') ?></p>
<form method="post" action="/change-password.php">
<input type="hidden" name="csrf" value="<?= $csrf ?>">
<label for="current">Aktualne hasło</label><input id="current" type="password" name="current_password" autocomplete="current-password" required>
<label for="new">Nowe hasło</label><input id="new" type="password" name="new_password" autocomplete="new-password" minlength="12" maxlength="72" required>
<label for="confirm">Potwierdź nowe hasło</label><input id="confirm" type="password" name="new_password_confirm" autocomplete="new-password" minlength="12" maxlength="72" required>
<button type="submit">Zapisz nowe hasło</button>
</form><?php endif; ?><a class="back" href="/panel.php">Wróć do panelu</a></main></body></html>
