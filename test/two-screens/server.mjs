// A local stand-in for the parts of Supabase the console uses, so two browser
// windows can be driven against the real app without leaving this machine.
// It is NOT a Supabase emulator — it implements only the calls the app makes:
// one select, one upsert, postgres_changes on a code, and channel presence.
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';

const APP = process.argv[2];
const PORT = Number(process.argv[3] || 8099);

const rows = new Map();     // code -> { code, state, updated_at }
const revs = new Map();     // code -> integer, bumped on every write
const seen = new Map();     // code -> Map(presenceKey -> lastSeenMs)

const FAKE_CLIENT = `
window.supabase = {
  createClient: function () {
    function api(path, body) {
      return fetch(path, body ? {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body)
      } : undefined).then(function (r) { return r.json(); });
    }
    return {
      from: function () {
        var eqVal = null;
        var q = {
          select: function () { return q; },
          eq: function (_k, v) { eqVal = v; return q; },
          maybeSingle: function () {
            return api('/api/get?code=' + encodeURIComponent(eqVal))
              .then(function (d) { return { data: d.row || null, error: null }; });
          },
          upsert: function (row) {
            return api('/api/put', row).then(function () { return { error: null }; });
          }
        };
        return q;
      },
      channel: function (name, opts) {
        var subs = [], pres = [], stopped = false, rev = -1, peers = {};
        var key = (opts && opts.config && opts.config.presence && opts.config.presence.key) || ('p' + Math.random());
        var code = name.replace('match-', '');
        var ch = {
          on: function (kind, a, b) {
            var fn = typeof a === 'function' ? a : b;
            if (kind === 'postgres_changes') subs.push(fn); else pres.push(fn);
            return ch;
          },
          subscribe: function (cb) {
            (function poll() {
              if (stopped) return;
              api('/api/sync?code=' + encodeURIComponent(code) + '&key=' + encodeURIComponent(key))
                .then(function (d) {
                  var before = Object.keys(peers).length;
                  peers = {};
                  (d.peers || []).forEach(function (k) { peers[k] = [{}]; });
                  if (Object.keys(peers).length !== before) pres.forEach(function (f) { f(); });
                  if (d.rev !== rev) {
                    rev = d.rev;
                    if (d.row) subs.forEach(function (f) { f({ new: d.row }); });
                  }
                })
                .catch(function () {})
                .then(function () { setTimeout(poll, 120); });
            })();
            setTimeout(function () { cb && cb('SUBSCRIBED'); }, 10);
            return ch;
          },
          presenceState: function () { return peers; },
          track: function () { return Promise.resolve(); },
          _stop: function () { stopped = true; }
        };
        return ch;
      },
      removeChannel: function (ch) { ch && ch._stop && ch._stop(); }
    };
  }
};
`;

function json(res, o) {
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify(o));
}

createServer((req, res) => {
  const u = new URL(req.url, 'http://x');

  if (u.pathname === '/api/get') {
    const code = u.searchParams.get('code');
    return json(res, { row: rows.get(code) || null, rev: revs.get(code) || 0 });
  }

  if (u.pathname === '/api/sync') {
    const code = u.searchParams.get('code');
    const key = u.searchParams.get('key');
    const now = Date.now();
    if (!seen.has(code)) seen.set(code, new Map());
    const m = seen.get(code);
    m.set(key, now);
    for (const [k, ts] of m) if (now - ts > 2000) m.delete(k);
    return json(res, { row: rows.get(code) || null, rev: revs.get(code) || 0, peers: [...m.keys()] });
  }

  if (u.pathname === '/api/put') {
    let body = '';
    req.on('data', c => (body += c));
    return req.on('end', () => {
      try {
        const row = JSON.parse(body);
        rows.set(row.code, row);
        revs.set(row.code, (revs.get(row.code) || 0) + 1);
      } catch (e) { /* the app never sends anything else */ }
      json(res, {});
    });
  }

  if (u.pathname === '/api/dump') {
    return json(res, { codes: [...rows.keys()], rows: [...rows.values()] });
  }

  if (u.pathname === '/fake-supabase.js') {
    res.writeHead(200, { 'content-type': 'text/javascript' });
    return res.end(FAKE_CLIENT);
  }

  // the real app, with only its backend address swapped for the local one
  const html = readFileSync(APP, 'utf8')
    .replace(/cdn: "https:\/\/cdn\.jsdelivr\.net[^"]*"/, 'cdn: "/fake-supabase.js"');
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end('<!doctype html><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1">' + html);
}).listen(PORT, '127.0.0.1', () => console.log('harness on http://127.0.0.1:' + PORT));
