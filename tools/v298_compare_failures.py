from pathlib import Path
import re
import sys


def failures(path):
    text = Path(path).read_text(encoding='utf-8', errors='replace')
    out=[]
    for m in re.finditer(r'^not ok\s+\d+\s+-\s+(.+)$', text, re.M):
        name=m.group(1).strip()
        if name.startswith('tests/competition-rounds-v298.test.cjs'):
            continue
        out.append(name)
    return set(out)

baseline=failures('v298-baseline.log')
after=failures('v298-after.log')
new=sorted(after-baseline)
resolved=sorted(baseline-after)
print('BASELINE_FAILURES', len(baseline))
print('AFTER_FAILURES', len(after))
if resolved:
    print('RESOLVED_EXISTING_FAILURES')
    for x in resolved: print(' -',x)
if new:
    print('NEW_REGRESSIONS')
    for x in new: print(' -',x)
    sys.exit(1)
print('NO_NEW_REGRESSIONS')
