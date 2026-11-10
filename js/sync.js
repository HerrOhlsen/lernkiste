/* Online backup of the whole progress (math + vocabulary) to a small private
   Supabase project. Each device gets a random recovery code; the row is only
   reachable through two SECURITY DEFINER functions that need that code
   (see tools/supabase.sql). The child's name never leaves the device.
   Sync stays off while URL/KEY are empty. */
(function (LK) {
  "use strict";
  const URL_ = "https://ltaibnkrtssoqaekjxpg.supabase.co";
  const KEY = "sb_publishable_zJBnWLpd4071TYAFjcy3HQ_92LfoUiT"; // publishable key, meant to be public
  const CODESTORE = "lernkiste-sync";
  const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
  const enabled = () => !!(URL_ && KEY);

  const meta = () => { try { return JSON.parse(localStorage.getItem(CODESTORE) || "{}"); } catch (e) { return {}; } };
  const setMeta = (m) => { try { localStorage.setItem(CODESTORE, JSON.stringify(m)); } catch (e) {} };
  const newCode = () => {
    const a = new Uint32Array(16); crypto.getRandomValues(a);
    const raw = Array.from(a, (x) => ALPHABET[x % ALPHABET.length]).join("");
    return raw.match(/.{4}/g).join("-");
  };
  const code = () => { const m = meta(); if (!m.code) { m.code = newCode(); setMeta(m); } return m.code; };
  const clean = (c) => c.toLowerCase().replace(/[^a-z0-9]/g, "").match(/.{1,4}/g).join("-");

  const rpc = async (fn, body) => {
    const r = await fetch(`${URL_}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.json();
  };

  /* A failed backup must not stay silent. Offline is normal (bus, no wifi)
     and only means "try again later". Two failures in a row while online
     (e.g. the free Supabase project was paused) show a banner, at most once
     a day; the "Ich" screen shows it until a backup works again. */
  const WARN = "Sicherung fehlgeschlagen. Bitte Papa Bescheid sagen: Supabase wieder aktivieren.";
  const showBanner = () => {
    if (document.querySelector(".syncwarn")) return;
    const b = document.createElement("div");
    b.className = "syncwarn"; b.setAttribute("role", "alert");
    b.innerHTML = `<span>⚠️ ${WARN}</span><button type="button">OK</button>`;
    b.querySelector("button").addEventListener("click", () => b.remove());
    document.body.appendChild(b);
  };

  let timer = null, busy = false;
  const push = async () => {
    if (!enabled() || busy || !LK.app) return;
    if (!navigator.onLine) return; // the "online" event retries
    busy = true;
    try {
      const data = Object.assign({}, LK.app.state);
      delete data.name; // stays on the device
      await rpc("lernstand_speichern", { p_code: code(), p_daten: data });
      const m = meta(); m.last = new Date().toISOString(); m.err = null; m.fails = 0; m.dirty = false; setMeta(m);
      const b = document.querySelector(".syncwarn"); if (b) b.remove();
    } catch (e) {
      const m = meta(); m.err = String(e.message || e);
      if (navigator.onLine) m.fails = (m.fails || 0) + 1;
      const today = LK.app.today();
      if (m.fails >= 2 && m.warned !== today) { m.warned = today; showBanner(); }
      setMeta(m);
    } finally { busy = false; }
  };
  /* Called after every save; waits for a quiet moment before uploading. */
  const schedule = () => {
    if (!enabled()) return;
    const m = meta(); if (!m.dirty) { m.dirty = true; setMeta(m); }
    clearTimeout(timer); timer = setTimeout(push, 4000);
  };
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden" && timer) { clearTimeout(timer); push(); } });
  window.addEventListener("online", () => { if (meta().dirty) schedule(); });
  // Unsent changes from last time: try again shortly after start.
  LK.onAppReady = LK.onAppReady || [];
  LK.onAppReady.push(() => { if (enabled() && meta().dirty) setTimeout(push, 3000); });

  const restore = async (input) => {
    const c = clean(input);
    const res = await rpc("lernstand_laden", { p_code: c });
    if (!res || !res.daten) throw new Error("Zu diesem Code gibt es keine Sicherung.");
    return { code: c, data: res.daten, when: res.geaendert };
  };

  const fmtWhen = (iso) => { const d = new Date(iso); return d.toLocaleDateString("de-DE") + ", " + d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) + " Uhr"; };

  /* Section on the "Ich" screen. */
  const renderInto = (root) => {
    if (!enabled()) return;
    const m = meta();
    const box = LK.app.h("div", "syncbox", `
      <h3>Online-Sicherung</h3>
      <p>${m.last ? "Zuletzt gesichert: " + fmtWhen(m.last) : "Noch nicht gesichert."}</p>
      ${m.fails >= 2 ? `<p class="syncerr">⚠️ ${WARN}<br><small>Fehler: ${LK.esc(m.err || "")}</small></p>` : m.err ? `<p class="note">Der letzte Versuch ging nicht, die App versucht es wieder.</p>` : ""}
      <p>Dein Wiederherstellungs-Code:</p>
      <div class="synccode">${LK.esc(code())}</div>
      <p class="note">Schreib den Code auf oder mach ein Foto. Auf einem neuen Handy holst du damit alles zurück.</p>`);
    const now = LK.app.h("button", "ghost", "Jetzt sichern"); now.type = "button";
    now.addEventListener("click", async () => { now.disabled = true; now.textContent = "Sichere …"; await push(); LK.app.render(); });
    const rec = LK.app.h("button", "ghost", "Mit Code wiederherstellen"); rec.type = "button";
    rec.addEventListener("click", async () => {
      const input = prompt("Wiederherstellungs-Code eingeben:");
      if (!input || !input.trim()) return;
      try {
        const r = await restore(input);
        if (!confirm(`Sicherung vom ${fmtWhen(r.when)} gefunden. Der Stand auf diesem Gerät wird dadurch ersetzt. Weiter?`)) return;
        const name = LK.app.state.name;
        localStorage.setItem("lernkiste-v1", JSON.stringify(Object.assign({}, r.data, { name })));
        const mm = meta(); mm.code = r.code; mm.last = r.when; setMeta(mm);
        location.reload();
      } catch (e) { alert(e.message || "Das hat nicht geklappt."); }
    });
    box.appendChild(now); box.appendChild(rec);
    root.appendChild(box);
  };

  LK.sync = { schedule, push, renderInto, enabled, _showBanner: showBanner };
})(window.LK);
