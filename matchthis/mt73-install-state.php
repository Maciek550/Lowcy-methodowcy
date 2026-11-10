<?php
declare(strict_types=1);
[$script,$web,$stage]=$argv;
require $web.'/mt73-store.php';
if(is_file(mt73_path()))throw new RuntimeException('State already exists; do not overwrite');
$db=json_decode(file_get_contents($stage.'/mt73-seed.json'),true,512,JSON_THROW_ON_ERROR);
// Preserve existing published assignments when initializing the authoritative database.
$draws=json_decode(file_get_contents($web.'/.mt41-private/mt60-published-draws.json'),true,512,JSON_THROW_ON_ERROR);
foreach($draws as $draw){
 foreach(['events'=>'rounds','cycles'=>'tours'] as $group=>$key){
  foreach($db[$group] as &$event){if($event['id']!==$draw['eventId'])continue;
   $index=$draw['roundIndex'];if(!isset($event[$key][$index]))continue;
   $t=&$event[$key][$index];$t['drawPublished']=true;
   if(empty($t['results']))$t['mt55Entries']=array_map(fn($r)=>$r+['weightG'=>null],$draw['rows']);
   unset($t);
  }unset($event);
 }
}
mt73_validate($db);
mt73_atomic(mt73_path(),mt73_json(['revision'=>1,'seeded'=>true,'updatedAt'=>gmdate('c'),'data'=>$db]));
echo 'MT73_STATE_INITIALIZED events='.count($db['events']).' cycles='.count($db['cycles']).' players='.count($db['players']).PHP_EOL;
