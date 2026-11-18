#!/usr/bin/env python3
"""Generate guarded MT93 UI-only deploy/rollback from audited MT92 release scripts.

Old files remain unchanged. SHA checks are transformed together with version.
No database or results mutation is added.
"""
from pathlib import Path
import re,subprocess
root=Path("matchthis")
old_admin="6f00c1717e3a500e052a4f667630ecf17e454c1327365ed081b33ded73184fd7"
old_viewer="49960517aeabfaa132c8072466f300ca719b5db652e9e4c4c69a5058c0739316"
old_judge="6b4866d0719be45fccb2e94f4fcf8bf94bdb775a327e7ed70277957086e920ec"
new_admin="a73377ce9efc974543f8f67d43098001d002250eb8b0c0cb12e69d3e4bb29700"
new_viewer="d685396a243d55bf56ea18580144b2909d31544e5af81f012bc786c33384de9e"
new_judge="118673fee882c13090d1f1bf00a210d8a514e80d1d2931542225fd97734bdfb2"
transform={
 "d40ede0022d7c44fb98289dc631810de2cef6a8955437fbf473ec56b1ce9a69b":old_admin,
 "ba7521d6877d9d0552a315c655ea4fd3175827df02c8f4e65f43c5df6222e2d4":old_viewer,
 "8f2c4fbf23f7b2c4198529bbce266ffc6e6d9ff8fdf022273bc3594a0064cfda":old_judge,
 old_admin:new_admin,
 old_viewer:new_viewer,
 old_judge:new_judge,
 "MT-92":"MT-93","MT92":"MT93","MT91":"MT92",
 "mt92":"mt93","mt91":"mt92","panel92":"panel93"
}
pattern=re.compile("|".join(re.escape(x) for x in sorted(transform,key=len,reverse=True)))
for filename in ("deploy","rollback"):
 base=root/f"mt92-{filename}-small2.sh"
 assert base.is_file(),base
 text=base.read_text("utf-8")
 assert 'mt92-mobile-20261118' in text
 out=pattern.sub(lambda m: transform[m.group(0)],text)
 assert 'mt93-mobile-20261118' in out
 assert 'mt92-mobile-20261118' not in out
 assert new_viewer in out and old_viewer in out
 assert "mt93" in out and "MT93" in out
 if filename=="deploy":
  assert old_admin in out and old_judge in out
  assert 'mt92-admin.php' in out and 'mt92-sedzia.php' in out
  assert 'mt93-admin.php' in out and 'mt93-sedzia.php' in out
  assert 'mt93-release/MatchThis_MT-93_OGLADACZ.html' in out
  assert 'MT93_UI_ONLY_DEPLOYED_SMALL2_MT92_BACKUP_PRESENT' in out
 else:
  assert 'MT93_ROLLBACK_UI_MT92_RESTORED_NO_DATA_CHANGED' in out
 dest=root/f"mt93-{filename}-small2.sh"
 dest.write_text(out,"utf-8")
 subprocess.run(["bash","-n",str(dest)],check=True)
 print("MT93_GUARDED_RELEASE_SCRIPT_VALID",dest,flush=True)
