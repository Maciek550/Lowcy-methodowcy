export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/health') {
      return Response.json({ ok: true, app: 'MatchThis', version: '0.1.0' });
    }

    return env.ASSETS.fetch(request);
  }
};
