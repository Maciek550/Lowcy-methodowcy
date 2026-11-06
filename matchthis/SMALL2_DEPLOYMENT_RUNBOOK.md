# MatchThis SMALL2 — confirmed deployment MT-23 (2026-11-06)

## Live address and deployment
- Public HTTPS URL: https://matchthis.lowcymethodowcy.smallhost.pl/
- Version: MT-23. Exact original source in this isolated GitHub branch: `matchthis/MatchThis_MT-23.html`.
- Original source SHA-256: `54623846f96c7a1f684dae116394f9acb9aca667958b89bc40d4c37d55c03c97`.
- SMALL2 website type: `php` serving standalone static HTML at `/home/lowcymethodowcy/domains/matchthis.lowcymethodowcy.smallhost.pl/public_html/index.html`.
- Independent private copy: `/home/lowcymethodowcy/matchthis-independent/mt-23/MatchThis_MT-23.html`.
- Provider-generated landing page backed up at `index.html.before-matchthis` *inside the new website only*.
- Ownership marker: `/home/lowcymethodowcy/matchthis-independent/MT23-OWNED`.
- TLS: own Let's Encrypt certificate, issued 2026-11-06, expires 2027-02-04. Check renewal before expiry.

## Proof (successful GitHub Actions runs)
1. Deployment + public HTTP content check: https://github.com/Maciek550/Lowcy-methodowcy/actions/runs/42254555189
2. Dedicated TLS issuance and public HTTPS verification: https://github.com/Maciek550/Lowcy-methodowcy/actions/runs/42254822678
3. LIVE Playwright Chromium browser smoke: https://github.com/Maciek550/Lowcy-methodowcy/actions/runs/42255341828

Live smoke passed at viewports 390 and 1366 px. Tested site title and version bar; archives, cycles, events; Foto FB JPEG download; PDF download (PDF signature; no /Subtype /Image in sampled file); ADMIN/VIEWER UI switch; localStorage persistence across reload; no console errors.

## Hosting access (never reveal secrets)
- Host: `s3.small.pl`
- SSH user: `lowcymethodowcy`
- Use GitHub Actions secret `SMALL2_SSH_PASSWORD` (present and working); do not fetch, echo, copy or publish its value.
- Pinned SSH host fingerprint is checked in workflows. Never use `StrictHostKeyChecking=no` to bypass a mismatch.
- No TinyFish connection was used.

## Isolation and immutable boundaries
- Łowcy S1: `https://lowcymethodowcy.smallhost.pl/`.
- Its unchanged DB: `p1828_lowcy_kop` on `pgsql3.small.pl`. Run logs showed it before and after deploy.
- Do not change, restart, delete, migrate or otherwise touch Łowcy website, source files, database, SSL or Railway.
- MatchThis is an independent WWW vhost and filesystem directory, **but both websites run under the same SMALL2 Unix hosting account**; this is logical project separation rather than OS-account isolation.
- Source branch lives in the Lowcy GitHub repository temporarily due existing connector permissions; it does not change Lowcy production branches.

## CRITICAL: not yet a multiuser production backend
- MT-23 is a standalone browser application whose edits are stored in each browser's **localStorage**, not in PostgreSQL.
- The switch `ADMIN / OGLĄDACZ` controls UI appearance only. It is not authenticated/authorized on the server.
- **No separate MatchThis PostgreSQL database has been created or connected yet.**
- Do not use this as authenticated central data entry or claim that records are synchronized between phones/computers.
- The 2025 competition archive was not imported into the hosted version merely by deployment.
- Firefox was not tested; verified browser was Chromium.

## Next safe development/release procedure
1. Establish the true current version and preserve MT-23; next version is MT-24 only after actual code changes and tests.
2. Preserve HTML backups and JSON exports of relevant browser-local data; make a separate DB backup once a backend exists.
3. Work only within MatchThis-owned paths and branch. Add independent PostgreSQL DB and server auth as a new, separately validated change.
4. For each new release: verify filename / HTML `<title>` / top bar / app version match and source hash; stage to new private path; atomic publish into MatchThis public_html only; smoke test on HTTPS and mobile/desktop; never touch Lowcy.
5. Check real vector PDF exports and independently downloaded FB JPG files; verify no regressions in historic results and classification.
6. Update this runbook and the Word record after verified changes.
