<?php
declare(strict_types=1);
/* CLI-only: migrate existing password hashes without changing a user's password. */
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
$oldFile=$argv[1]??'';$target=$argv[2]??'';
if(!is_file($oldFile)||is_link($oldFile)||$target==='')exit(11);
if(file_exists($target))exit(12);
$contents=file_get_contents($oldFile);
if($contents===false)exit(13);
$users=[];
foreach(['mt-admin'=>'admin','mt-sedzia'=>'judge'] as $name=>$role) {
 $n=preg_quote($name,'~');$r=preg_quote($role,'~');
 $pattern="~'{$n}'\\s*=>\\s*\\[\\s*'hash'\\s*=>\\s*'([^']+)'\\s*,\\s*'role'\\s*=>\\s*'{$r}'~";
 if(!preg_match($pattern,$contents,$match)||!password_get_info($match[1])['algo'])exit(14);
 $users[$name]=['hash'=>$match[1],'role'=>$role];
}
$payload='<?php if (!defined("MATCHTHIS_AUTH_INTERNAL")) {http_response_code(404);exit;} return '.var_export($users,true).";\\n";
$tmp=$target.'.'.bin2hex(random_bytes(8)).'.php';
if(file_put_contents($tmp,$payload,LOCK_EX)!==strlen($payload))exit(15);
chmod($tmp,0600);
if(!rename($tmp,$target))exit(16);
exit(0);
