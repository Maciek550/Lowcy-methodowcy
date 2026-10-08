const FRONTEND = "https://curly-boat-804e.fabio35.workers.dev";

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

async function readJson(request) {
  try { return await request.json(); }
  catch { return null; }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (path === "/api/health") {
        const row = await env.DB.prepare(
          "SELECT COUNT(*) AS athletes FROM athletes"
        ).first();
        return json({
          ok: true,
          app: "MatchThis",
          version: "0.2.0",
          db: "matchthis-db",
          athletes: Number(row?.athletes || 0)
        });
      }

      if (path === "/api/athletes" && request.method === "GET") {
        const { results } = await env.DB.prepare(`
          SELECT id, first_name, last_name, phone, email, club,
                 user_enabled, created_at
          FROM athletes
          ORDER BY last_name COLLATE NOCASE, first_name COLLATE NOCASE
        `).all();
        return json({ ok: true, athletes: results });
      }

      if (path === "/api/athletes" && request.method === "POST") {
        const body = await readJson(request);
        if (!body?.first_name || !body?.last_name) {
          return json({ ok: false, error: "Imię i nazwisko są wymagane." }, 400);
        }

        const result = await env.DB.prepare(`
          INSERT INTO athletes
            (first_name, last_name, phone, email, club, user_enabled)
          VALUES (?, ?, ?, ?, ?, ?)
        `).bind(
          String(body.first_name).trim(),
          String(body.last_name).trim(),
          body.phone ? String(body.phone).trim() : null,
          body.email ? String(body.email).trim() : null,
          body.club ? String(body.club).trim() : null,
          body.user_enabled ? 1 : 0
        ).run();

        return json({ ok: true, id: result.meta.last_row_id }, 201);
      }

      const athleteMatch = path.match(/^\/api\/athletes\/(\d+)$/);
      if (athleteMatch && request.method === "DELETE") {
        const id = Number(athleteMatch[1]);
        await env.DB.prepare("DELETE FROM athletes WHERE id = ?").bind(id).run();
        return json({ ok: true });
      }

      if (path === "/api/cycles" && request.method === "GET") {
        const { results } = await env.DB.prepare(`
          SELECT id, name, season, rounds_count, finalists_count, created_at
          FROM cycles
          ORDER BY created_at DESC
        `).all();
        return json({ ok: true, cycles: results });
      }

      if (path === "/api/cycles" && request.method === "POST") {
        const body = await readJson(request);
        if (!body?.name) return json({ ok: false, error: "Nazwa cyklu jest wymagana." }, 400);

        const result = await env.DB.prepare(`
          INSERT INTO cycles (name, season, rounds_count, finalists_count)
          VALUES (?, ?, ?, ?)
        `).bind(
          String(body.name).trim(),
          body.season ? Number(body.season) : null,
          Math.max(1, Number(body.rounds_count || 6)),
          Math.max(1, Number(body.finalists_count || 45))
        ).run();

        return json({ ok: true, id: result.meta.last_row_id }, 201);
      }

      if (path === "/api/competitions" && request.method === "GET") {
        const { results } = await env.DB.prepare(`
          SELECT c.*, cy.name AS cycle_name
          FROM competitions c
          LEFT JOIN cycles cy ON cy.id = c.cycle_id
          ORDER BY COALESCE(c.event_date, '9999-12-31'), c.id DESC
        `).all();
        return json({ ok: true, competitions: results });
      }

      if (path.startsWith("/api/")) {
        return json({ ok: false, error: "Nieznany endpoint API." }, 404);
      }

      const upstream = new URL(FRONTEND);
      upstream.pathname = path;
      upstream.search = url.search;

      const proxied = new Request(upstream.toString(), request);
      return fetch(proxied);
    } catch (err) {
      return json({
        ok: false,
        error: err instanceof Error ? err.message : String(err)
      }, 500);
    }
  }
};
