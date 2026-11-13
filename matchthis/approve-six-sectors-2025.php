<?php
declare(strict_types=1);
// 2026-11-13 organizer-approved sector COUNTS only; never fabricate pegs/sectors.
// Usage: php approve-six-sectors-2025.php preview|apply|verify WEBROOT
if (PHP_SAPI !== 'cli' || $argc !== 3 || !in_array($argv[1], ['preview','apply','verify'], true)) {
    fwrite(STDERR, "Usage: php approve-six-sectors-2025.php preview|apply|verify WEBROOT\n");
    exit(2);
}
$mode = $argv[1];
$web = realpath($argv[2]);
if (!$web || !is_dir($web.'/.mt41-private') || !is_file($web.'/mt73-store.php')) {
    throw new RuntimeException('MatchThis private store not found');
}
require_once $web.'/mt73-store.php';
$targets = [
    'mt2025-champions_2025'=>[
        'mt2025-champions_2025-round1'=>['2025-12-13',60],
        'mt2025-champions_2025-round2'=>['2025-12-14',60],
    ],
    'mt2025-mega_final_2025'=>[
        'mt2025-mega_final_2025-round1'=>['2025-10-25',54],
        'mt2025-mega_final_2025-round2'=>['2025-10-26',54],
    ],
];
$lock=$web.'/.mt41-private/mt73.lock';
if (is_link($lock)) throw new RuntimeException('Lock is a symlink');
$fp=fopen($lock,'c'); if (!$fp) throw new RuntimeException('Cannot lock store');
chmod($lock,0600);
if (!flock($fp,LOCK_EX)) throw new RuntimeException('Cannot acquire lock');
try {
    $state=mt73_read(); mt73_validate($state['data']);
    $data=$state['data']; $seen=[]; $rounds=[]; $changed=0;
    foreach ($data['events'] as &$event) {
        $id=$event['id']; if (!isset($targets[$id])) continue;
        if (isset($seen[$id])) throw new RuntimeException('Duplicate target event');
        $seen[$id]=true;
        foreach ($event['rounds']??[] as &$tour) {
            $rid=$tour['id']??'';
            if (!isset($targets[$id][$rid]) || isset($seen[$id.'/'.$rid]))
                throw new RuntimeException('Unexpected or duplicate tour '.$rid);
            $seen[$id.'/'.$rid]=true;
            [$date,$count]=$targets[$id][$rid];
            if (($tour['date']??null)!==$date || ($tour['status']??null)!=='FINAL'
                || count($tour['results']??[])!==$count)
                throw new RuntimeException('Target tour changed '.$rid);
            if (isset($tour['mt55SectorPlan']) && ($tour['mt55SectorPlan']['sectors']??6)!==6)
                throw new RuntimeException('Conflicting draw sector plan '.$rid);
            $prior=$tour['sectorCount']??null;
            if ($prior!==null && $prior!==6) throw new RuntimeException('Conflicting sectorCount '.$rid);
            if ($mode==='verify' && $prior!==6) throw new RuntimeException('Not saved '.$rid);
            if ($mode!=='verify' && $prior!==6) { $tour['sectorCount']=6; $changed++; }
            $rounds[]=['eventId'=>$id,'roundId'=>$rid,'date'=>$date,'rows'=>$count,'old'=>$prior,'new'=>6];
        }
        unset($tour);
    }
    unset($event);
    foreach ($targets as $id=>$tours) {
        if (!isset($seen[$id])) throw new RuntimeException('Target event missing '.$id);
        foreach ($tours as $rid=>$_) if (!isset($seen[$id.'/'.$rid]))
            throw new RuntimeException('Target tour missing '.$rid);
    }
    if (count($rounds)!==4) throw new RuntimeException('Four tours required');
    // Whole database, all results, pegs, sectors, weights and places must remain identical
    // after normalizing only these four approved metadata fields.
    $normalized=$state['data'];
    foreach ($normalized['events'] as &$ev) {
        if (!isset($targets[$ev['id']])) continue;
        foreach ($ev['rounds'] as &$tour) {
            if (isset($targets[$ev['id']][$tour['id']])) $tour['sectorCount']=6;
        }
        unset($tour);
    }
    unset($ev);
    if ($normalized!==$data) throw new RuntimeException('Change outside four sector counts');
    if ($mode==='preview') {
        $output=['status'=>'DRY_RUN','revision'=>$state['revision'],'wouldChange'=>$changed,'rounds'=>$rounds];
    } elseif ($mode==='verify') {
        $output=['status'=>'VERIFIED','revision'=>$state['revision'],'rounds'=>$rounds];
    } elseif ($changed===0) {
        $output=['status'=>'ALREADY_APPLIED','revision'=>$state['revision'],'changed'=>0,'rounds'=>$rounds];
    } else {
        $archive=mt73_archive($state,'before-approved-six-sectors-2025','organizer-approved-2026-11-13');
        $state['data']=$data;
        $state['revision']++;
        $state['seeded']=false;
        $state['updatedAt']=gmdate('c');
        mt73_atomic(mt73_path(),mt73_json($state));
        if (mt73_read()!==$state) throw new RuntimeException('Read-back differs from saved data');
        $output=['status'=>'SAVED_AND_READ_BACK','revision'=>$state['revision'],'changed'=>$changed,'backup'=>$archive,'rounds'=>$rounds];
    }
    echo json_encode($output,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),"\n";
} finally {
    flock($fp,LOCK_UN); fclose($fp);
}
