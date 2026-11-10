/* Vocabulary trainer: spaced repetition with flip cards (taken over from
   VocabFlow), plus mixed exercise types for reviews. The word lists are book
   material, so they ship encrypted (vocab/*.bin, see tools/build_vocab.py) and
   are decrypted in the browser with a key derived from the parent's password.
   Progress lives in the shared app state under state.vocab. */
(function (LK) {
  "use strict";
  const { esc, shuffle, pick } = LK;
  let A; // LK.app, set when the app is ready
  const KEYSTORE = "lernkiste-schluessel";
  const CONFIG = { maxReviews: 40, desiredRetention: 0.85 };
  const VDEFAULTS = { on: [], cards: {}, day: { date: "", neu: 0, wdh: 0 }, autoplay: true, mix: true, neuProTag: 8, runden: 0 };

  LK.screens = LK.screens || {};
  LK.fullscreen = (LK.fullscreen || []).concat(["vlearn"]);
  LK.onAppReady = LK.onAppReady || [];
  LK.onAppReady.push((app) => { A = app; });

  const V = () => {
    const s = A.state;
    if (!s.vocab) s.vocab = {};
    for (const k in VDEFAULTS) if (!(k in s.vocab)) s.vocab[k] = JSON.parse(JSON.stringify(VDEFAULTS[k]));
    const t = A.today();
    if (s.vocab.day.date !== t) s.vocab.day = { date: t, neu: 0, wdh: 0 };
    return s.vocab;
  };

  /* ------------------------------------------------------------ FSRS
     Same scheduler as VocabFlow (simplified FSRS, 4 ratings). */
  const addDays = (dateStr, days) => { const d = new Date(dateStr + "T12:00:00"); d.setDate(d.getDate() + days); return A.ymd(d); };
  const fresh = () => ({ stability: 0, difficulty: 5, repetitions: 0, interval: 0, nextReview: null, lastReview: null, lastRating: null, lapses: 0 });
  const FSRS = {
    w: [0.4, 1.0, 3.0, 8.0],
    growth: 1.6,
    schedule(card, rating) {
      if (card.repetitions === 0) {
        card.stability = this.w[rating - 1];
        card.difficulty = Math.max(1, Math.min(10, 5.5 - (rating - 3) * 1.2));
      } else if (rating === 1) {
        card.stability = Math.max(0.4, card.stability * 0.2);
        card.difficulty = Math.min(10, card.difficulty + 1.0);
        card.lapses = (card.lapses || 0) + 1;
      } else {
        const df = 1 + (10 - card.difficulty) * 0.05;
        const rb = [0, 0, 0.8, 1.0, 1.4][rating];
        card.stability = card.stability * this.growth * df * rb;
        card.difficulty = Math.max(1, card.difficulty - (rating - 2) * 0.15);
      }
      card.repetitions = (card.repetitions || 0) + 1;
      card.interval = Math.max(1, Math.round(card.stability * Math.log(CONFIG.desiredRetention) / Math.log(0.9)));
      card.nextReview = addDays(A.today(), card.interval);
      card.lastReview = A.today();
      card.lastRating = rating;
      return card;
    },
    preview(card) { return [1, 2, 3, 4].map((r) => this.schedule(JSON.parse(JSON.stringify(card)), r).interval); },
  };
  const fmtInterval = (d) => d <= 1 ? "1 Tag" : d < 30 ? d + " Tage" : d < 365 ? Math.round(d / 30) + " Mon." : (d / 365).toFixed(1).replace(".", ",") + " J.";
  /* Five visible boxes (Leitner picture) on top of the FSRS interval. */
  const box = (cs) => !cs || !cs.repetitions ? 0 : cs.interval <= 1 ? 1 : cs.interval <= 4 ? 2 : cs.interval <= 10 ? 3 : cs.interval <= 30 ? 4 : 5;

  /* ---------------------------------------------------------- crypto */
  const b64 = { to: (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))), from: (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0)) };
  const hex = (s) => new Uint8Array(s.match(/../g).map((h) => parseInt(h, 16)));
  let aesKey = null, DATA = null, loading = null;
  const getStored = () => { try { return localStorage.getItem(KEYSTORE); } catch (e) { return null; } };
  const importKey = (raw) => crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["decrypt"]);
  const decrypt = async (buf) => new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: new Uint8Array(buf, 0, 12) }, aesKey, new Uint8Array(buf, 12)));
  const fetchBin = async (url, fresh) => { const r = await fetch(url, fresh ? { cache: "no-cache" } : {}); if (!r.ok) throw new Error("HTTP " + r.status); return r.arrayBuffer(); };
  const deriveKey = async (password) => {
    const meta = await (await fetch("vocab/key.json", { cache: "no-cache" })).json();
    const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(password.trim()), "PBKDF2", false, ["deriveBits"]);
    return crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: hex(meta.salt), iterations: meta.iter }, base, 256);
  };
  const loadData = async () => {
    if (DATA) return DATA;
    if (loading) return loading;
    loading = (async () => {
      const stored = getStored();
      if (!stored) throw new Error("nokey");
      aesKey = await importKey(b64.from(stored));
      let plain;
      try { plain = await decrypt(await fetchBin("vocab/data.bin", true)); }
      catch (e) { if (e.name === "OperationError") { try { localStorage.removeItem(KEYSTORE); } catch (x) {} throw new Error("nokey"); } throw e; }
      DATA = JSON.parse(new TextDecoder().decode(plain));
      DATA.byId = {};
      DATA.setById = {};
      for (const b of DATA.buecher) for (const s of b.sets) { DATA.setById[s.id] = s; for (const c of s.karten) { c.setId = s.id; DATA.byId[c.id] = c; } }
      return DATA;
    })();
    try { return await loading; } finally { loading = null; }
  };
  const unlock = async (password) => {
    const raw = await deriveKey(password);
    aesKey = await importKey(raw);
    await decrypt(await fetchBin("vocab/data.bin", true)); // throws on a wrong password
    try { localStorage.setItem(KEYSTORE, b64.to(raw)); } catch (e) {}
  };

  /* Media are decrypted on demand and kept as object URLs. */
  const mediaCache = new Map();
  const media = (name, type) => {
    if (!name) return Promise.resolve(null);
    if (!mediaCache.has(name)) {
      mediaCache.set(name, fetchBin(`vocab/m/${name}.bin`).then(decrypt).then((b) => URL.createObjectURL(new Blob([b], { type })))
        .catch((e) => { mediaCache.delete(name); console.warn("media", e); return null; }));
    }
    return mediaCache.get(name);
  };
  const prefetch = (c) => { if (!c) return; media(c.a, "audio/mpeg"); media(c.s, "audio/mpeg"); media(c.i, "image/webp"); };

  /* ----------------------------------------------------------- audio */
  let player = null, enVoice = null;
  const pickVoice = () => { const vs = speechSynthesis.getVoices(); enVoice = vs.find((v) => v.lang === "en-GB" && /Daniel|Kate|Serena|Google UK/i.test(v.name)) || vs.find((v) => v.lang === "en-GB") || vs.find((v) => v.lang.startsWith("en")) || null; };
  if ("speechSynthesis" in window) { pickVoice(); speechSynthesis.addEventListener("voiceschanged", pickVoice); }
  /* iOS only lets an audio element play after it was started inside a tap.
     Call this from a click handler; later plays on the same element work. */
  const SILENT = "data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQxAADB8AhSmxhIIEVCSiJrDCQBTcu3UrAIwUdkRgQbFAZC1CQEwTJ9mjRvBA4UOLD8nKVOWfh+UlK3z/177OXrfOdKl7pyn3Xf//WreyTRUoAWgBgkOAGbZHBgG1OF6zM82DWbZaUmMBptgQhGjsyYqc9ae9XFz280948NMBWInljyzsNRFLPWdnZGWrddDsjK1unuSrVN9jJsK8KuQtQCtMBjCEtImISdNKJOopIpBFpNSMbIHCSRpRR5iakjTiyzLhchUUBwCgyKiweBv/7UsQbg8isVNoMPMjAAAA0gAAABEVFGmgqK////9bP/6XCykxBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq";
  const unlockAudio = () => {
    try {
      player = player || new Audio();
      player.src = SILENT; player.play().catch(() => {});
      if ("speechSynthesis" in window) speechSynthesis.speak(new SpeechSynthesisUtterance(""));
    } catch (e) {}
  };
  const stopAudio = () => { if (player) { player.onended = null; player.pause(); } try { speechSynthesis.cancel(); } catch (e) {} };
  /* Play the clip, or speak the text with the device voice if there is none. */
  const play = async (name, text) => {
    stopAudio();
    const url = await media(name, "audio/mpeg");
    return new Promise((resolve) => {
      if (url) {
        player = player || new Audio();
        player.src = url; player.onended = () => resolve(); player.onerror = () => resolve();
        player.play().catch(() => resolve());
      } else if (text && "speechSynthesis" in window) {
        const u = new SpeechSynthesisUtterance(text); u.lang = "en-GB"; u.rate = 0.9; if (enVoice) u.voice = enVoice;
        u.onend = () => resolve(); u.onerror = () => resolve(); speechSynthesis.speak(u);
      } else resolve();
    });
  };
  const sayWord = (c) => play(c.a, c.say || c.en);
  const saySentence = (c) => play(c.s, c.ex);
  const speakDe = (text) => A.speak(text);

  /* ----------------------------------------------------- queue logic */
  const activeCards = () => {
    const v = V(), out = [];
    for (const b of DATA.buecher) for (const s of b.sets) if (v.on.includes(s.id)) out.push(...s.karten);
    return out;
  };
  const counts = () => {
    const v = V(), t = A.today(), c = { total: 0, neu: 0, due: 0, boxes: [0, 0, 0, 0, 0, 0] };
    for (const k of activeCards()) {
      const cs = v.cards[k.id]; c.total++;
      const b = box(cs); c.boxes[b]++;
      if (!b) c.neu++; else if (cs.nextReview <= t) c.due++;
    }
    return c;
  };
  const dueOn = (date) => activeCards().filter((k) => { const cs = V().cards[k.id]; return cs && cs.repetitions && cs.nextReview <= date; }).length;
  const overdue = () => { const t = A.today(); return activeCards().filter((k) => { const cs = V().cards[k.id]; return cs && cs.repetitions && cs.nextReview < t; }).length; };
  const buildQueue = (bonus) => {
    const v = V(), t = A.today(), cards = activeCards();
    const reviews = cards.filter((k) => { const cs = v.cards[k.id]; return cs && cs.repetitions && cs.nextReview <= t; })
      .sort((a, b) => v.cards[a.id].nextReview.localeCompare(v.cards[b.id].nextReview)).slice(0, CONFIG.maxReviews);
    // Backlog brake (as in VocabFlow): too many overdue reviews, no new words today.
    const brake = !bonus && overdue() > v.neuProTag * 1.5;
    const maxNew = brake ? 0 : Math.max(0, v.neuProTag - v.day.neu) + (bonus || 0);
    // New words in book order, so they follow the class.
    const fresh = cards.filter((k) => !box(v.cards[k.id])).slice(0, maxNew);
    // Reviews first, new words mixed into the second half so a round ends on known ground.
    const q = shuffle(reviews);
    fresh.forEach((k, i) => q.splice(Math.min(q.length, Math.floor(q.length / 2) + i * 2), 0, k));
    return q;
  };

  /* ------------------------------------------------- answer checking */
  const norm = (s) => String(s).toLowerCase().replace(/[’‘`´]/g, "'").replace(/[.,!?;:"()…]/g, " ").replace(/\s+/g, " ").trim();
  const answers = (c) => {
    const base = (c.say || c.en).replace(/\s*\(=[^)]*\)/g, "");
    const forms = new Set([base]);
    base.split(/\s*[,;]\s*/).forEach((p) => p && forms.add(p));
    for (const f of [...forms]) { if (/^to /i.test(f)) forms.add(f.replace(/^to /i, "")); else if (c.de && /en\b/.test(c.de.split(/[;,]/)[0]) && !/ /.test(f)) forms.add("to " + f); }
    return [...forms].map(norm).filter(Boolean);
  };
  const lev = (a, b) => {
    const m = a.length, n = b.length, d = Array.from({ length: m + 1 }, (_, i) => [i]);
    for (let j = 1; j <= n; j++) d[0][j] = j;
    for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[m][n];
  };
  const typable = (c) => { const a = answers(c)[0] || ""; return a.split(" ").length <= 4 && a.length <= 24; };
  /* Distractor cards: other meanings, preferably from the same set. */
  const others = (c, n, filter) => {
    const pool = activeCards().filter((k) => k.id !== c.id && k.de !== c.de && norm(k.en) !== norm(c.en) && (!filter || filter(k)));
    const same = shuffle(pool.filter((k) => k.setId === c.setId));
    const rest = shuffle(pool.filter((k) => k.setId !== c.setId));
    return same.concat(rest).slice(0, n);
  };
  const bold = (ex, c) => {
    const html = esc(ex).replace(/\n/g, "<br>");
    const w = (c.say || c.en).replace(/^to /i, "").replace(/[.!?…]/g, "").split(/[,;]/)[0].trim();
    if (w.length < 2) return html;
    const re = new RegExp("\\b(" + w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\w{0,3})\\b", "i");
    return html.replace(re, "<b>$1</b>");
  };
  const firstDe = (de) => de.split(/;/)[0].trim();
  /* Gap sentences only for short headwords inside a longer sentence. */
  const gapOk = (c) => {
    if (!c.ex) return false;
    const w = (c.say || c.en).replace(/^to /i, "");
    const m = bold(c.ex, c).match(/<b>(.*?)<\/b>/);
    return !!m && w.split(" ").length <= 2 && c.ex.split(/\s+/).length >= w.split(" ").length + 3;
  };

  /* --------------------------------------------------------- screens */
  const h = (...a) => A.h(...a);
  const $ = (...a) => A.$(...a);
  const appEl = () => document.getElementById("app");

  const renderLock = (err) => {
    const app = appEl(); app.innerHTML = "";
    const card = h("div", "vlock", `
      <div class="uemoji big">🔐</div>
      <h2>Englisch-Vokabeln</h2>
      <p>Die Vokabeln aus dem Schulbuch sind geschützt. Ein Elternteil gibt hier einmal das Passwort ein, danach bleibt die Kiste auf diesem Gerät offen.</p>
      <input class="vinput" type="password" autocomplete="current-password" placeholder="Passwort" aria-label="Passwort">
      <p class="verr" ${err ? "" : "hidden"}>${esc(err || "")}</p>
      <button class="primary" type="button">Öffnen</button>`);
    app.appendChild(card);
    const inp = $("input", card), btn = $("button", card), msg = $(".verr", card);
    const go = async () => {
      if (!inp.value.trim()) return;
      btn.disabled = true; btn.textContent = "Moment …"; msg.hidden = true;
      try { await unlock(inp.value); DATA = null; renderHome(); }
      catch (e) { btn.disabled = false; btn.textContent = "Öffnen"; msg.hidden = false; msg.textContent = /OperationError/.test(e.name) ? "Das Passwort stimmt nicht." : "Das hat nicht geklappt: " + e.message; LK.sfx.bad(); }
    };
    btn.addEventListener("click", go);
    inp.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
  };

  const renderHome = async () => {
    const app = appEl();
    if (!getStored()) return renderLock();
    if (!DATA) {
      app.innerHTML = `<div class="vloading">Vokabeln werden geladen …</div>`;
      try { await loadData(); } catch (e) { return e.message === "nokey" ? renderLock("Das Passwort wurde geändert. Bitte neu eingeben.") : (app.innerHTML = `<div class="vloading">Laden hat nicht geklappt (${esc(e.message)}). Bist du online?</div>`); }
      if (A && document.querySelector("#nav .on") && document.querySelector("#nav .on").dataset.s !== "vokabeln") return;
    }
    const v = V(), c = counts(), book = DATA.buecher[0];
    app.innerHTML = "";
    const lv = A.level(A.state.xp);
    app.appendChild(h("header", "hero vhero", `
      <div class="greet">Englisch</div>
      <div class="stats"><span title="Serie">🔥 ${streakDays()}</span><span title="Muscheln">🐚 ${LK.fmt(A.state.shells)}</span><span title="Level">⭐ Level ${lv}</span></div>`));

    // today
    const today = h("section", "vtoday");
    const newToday = Math.min(c.neu, Math.max(0, v.neuProTag - v.day.neu));
    if (!v.on.length) {
      today.innerHTML = `<h3>Los geht's</h3><p>Schalte unten eine Unit ein. Fang mit <b>Welcome</b> und <b>Unit 1</b> an.</p>`;
    } else if (c.due + newToday > 0) {
      const brake = overdue() > v.neuProTag * 1.5;
      today.innerHTML = `<h3>Heute dran</h3>
        <div class="vnums"><div><b>${c.due}</b><span>wiederholen</span></div><div><b>${brake ? 0 : newToday}</b><span>neue Wörter</span></div></div>
        ${brake ? `<p class="vhint">Heute keine neuen Wörter: Erst die alten wiederholen, sonst wird der Stapel zu groß.</p>` : ""}
        <button class="primary vstart" type="button">Vokabeln üben</button>`;
      $(".vstart", today).addEventListener("click", () => { LK.sfx.tap(); unlockAudio(); A.go("vlearn", {}); });
    } else {
      const tom = dueOn(addDays(A.today(), 1));
      today.innerHTML = `<h3>Alles geschafft für heute! 🎉</h3><p>${tom ? `Morgen ${tom === 1 ? "ist 1 Wort" : "sind " + tom + " Wörter"} dran.` : "Morgen ist nichts fällig."}</p>
        ${c.neu ? `<button class="ghost vbonus" type="button">Noch ${Math.min(5, c.neu)} neue Wörter lernen</button>` : ""}`;
      const bonus = $(".vbonus", today);
      if (bonus) bonus.addEventListener("click", () => { unlockAudio(); A.go("vlearn", { bonus: 5 }); });
    }
    app.appendChild(today);

    // boxes
    if (v.on.length) {
      const boxes = h("section", "vboxes");
      boxes.innerHTML = `<h3>Deine Kisten</h3><div class="vboxrow">${[0, 1, 2, 3, 4, 5].map((i) => `
        <div class="vbox b${i}"><div class="vbox-n">${c.boxes[i]}</div><div class="vbox-l">${i === 0 ? "neu" : "Kiste " + i}</div></div>`).join("")}</div>
        <p class="note">Jedes Mal, wenn du ein Wort weißt, wandert es eine Kiste weiter und kommt seltener dran. In Kiste 5 sitzt es richtig fest. Vergisst du es, fängt es wieder vorne an.</p>`;
      app.appendChild(boxes);
    }

    // sets
    const sets = h("section", "vsets");
    sets.appendChild(h("h3", null, `${esc(book.titel)}`));
    for (const s of book.sets) {
      const on = v.on.includes(s.id);
      const known = s.karten.filter((k) => box(v.cards[k.id]) >= 1).length;
      const row = h("div", "vset" + (on ? " on" : ""), `
        <button class="vset-main" type="button"><span class="uemoji">${s.emoji}</span><span class="vset-t">${esc(s.titel)}<small>${s.karten.length} Wörter${known ? `, ${known} schon gelernt` : ""}</small><i class="vbar"><i style="width:${Math.round(known / s.karten.length * 100)}%"></i></i></span></button>
        <label class="switch" aria-label="${esc(s.titel)} einschalten"><input type="checkbox" ${on ? "checked" : ""}><span></span></label>`);
      $("input", row).addEventListener("change", (e) => {
        if (e.target.checked) { if (!v.on.includes(s.id)) v.on.push(s.id); } else v.on = v.on.filter((x) => x !== s.id);
        A.save(); renderHome();
      });
      $(".vset-main", row).addEventListener("click", () => { LK.sfx.tap(); A.go("vliste", { setId: s.id }); });
      sets.appendChild(row);
    }
    app.appendChild(sets);

    // settings
    const st = h("details", "vsettings", `<summary>Einstellungen</summary>`);
    const toggle = (key, label, hint) => {
      const row = h("label", "row", `<span>${label}<small>${hint}</small></span><input type="checkbox" ${v[key] ? "checked" : ""}>`);
      $("input", row).addEventListener("change", (e) => { v[key] = e.target.checked; A.save(); });
      st.appendChild(row);
    };
    toggle("autoplay", "Englisch automatisch vorlesen", "Wort und Beispielsatz werden abgespielt");
    toggle("mix", "Übungen mischen", "Beim Wiederholen auch hören, Bilder wählen und tippen");
    const sel = h("label", "row", `<span>Neue Wörter pro Tag<small>Lieber jeden Tag ein paar als selten viele</small></span>
      <select>${[3, 5, 8, 10, 15].map((n) => `<option ${n === v.neuProTag ? "selected" : ""}>${n}</option>`).join("")}</select>`);
    $("select", sel).addEventListener("change", (e) => { v.neuProTag = +e.target.value; A.save(); renderHome(); });
    st.appendChild(sel);
    const lock = h("button", "ghost", "Kiste wieder abschließen (Passwort vergessen)"); lock.type = "button";
    lock.addEventListener("click", () => { if (confirm("Passwort auf diesem Gerät vergessen? Der Lernstand bleibt erhalten.")) { try { localStorage.removeItem(KEYSTORE); } catch (e) {} DATA = null; renderLock(); } });
    st.appendChild(lock);
    app.appendChild(st);
  };
  const streakDays = () => {
    const days = new Set(A.state.days); let n = 0; const d = new Date();
    if (!days.has(A.today())) d.setDate(d.getDate() - 1);
    while (days.has(A.ymd(d))) { n++; d.setDate(d.getDate() - 1); }
    return n;
  };

  /* word list of one set */
  const renderList = async ({ setId }) => {
    const app = appEl();
    if (!DATA) { try { await loadData(); } catch (e) { return renderLock(); } }
    const s = DATA.setById[setId], v = V();
    app.innerHTML = "";
    const top = h("div", "lessontop", `<button class="close" type="button" aria-label="Zurück">←</button><h3>${s.emoji} ${esc(s.titel)}</h3>`);
    $(".close", top).addEventListener("click", () => A.go("vokabeln"));
    app.appendChild(top);
    const list = h("div", "vlist");
    let sec = null;
    for (const c of s.karten) {
      if (c.sec && c.sec !== sec) { sec = c.sec; list.appendChild(h("div", "vsec", esc(sec))); }
      const b = box(v.cards[c.id]);
      const row = h("button", "vrow", `<span class="vrow-en">${esc(c.en)}</span><span class="vrow-de">${esc(c.de)}</span><span class="vkiste k${b}">${b ? b : "·"}</span>`);
      row.type = "button";
      row.addEventListener("click", () => sayWord(c));
      list.appendChild(row);
    }
    app.appendChild(list);
    app.appendChild(h("p", "note", "Tippe auf ein Wort, um es zu hören. Die Zahl rechts zeigt, in welcher Kiste das Wort liegt."));
  };

  /* ------------------------------------------------------ the session */
  const renderLearn = async ({ bonus }) => {
    const app = appEl();
    if (!DATA) { try { await loadData(); } catch (e) { return renderLock(); } }
    const v = V();
    const queue = buildQueue(bonus);
    if (!queue.length) return A.go("vokabeln");
    let idx = 0, xp = 0;
    const stats = { total: 0, neu: 0, right: 0 };
    const seenInRound = new Set();
    app.innerHTML = "";
    const top = h("div", "lessontop", `<button class="close" type="button" aria-label="Aufhören">✕</button><div class="progress"><i></i></div>
      <button class="vauto ${v.autoplay ? "on" : ""}" type="button" aria-label="Automatisch vorlesen">${v.autoplay ? "🔊" : "🔇"}</button>`);
    app.appendChild(top);
    $(".close", top).addEventListener("click", () => { if (!stats.total || confirm("Aufhören? Was du schon geübt hast, ist gespeichert.")) { stopAudio(); finish(true); } });
    $(".vauto", top).addEventListener("click", (e) => { v.autoplay = !v.autoplay; A.save(); e.currentTarget.textContent = v.autoplay ? "🔊" : "🔇"; e.currentTarget.classList.toggle("on", v.autoplay); });
    const stage = h("div", "stage"); app.appendChild(stage);
    const setProgress = () => { $(".progress i", top).style.width = Math.max(4, (idx / queue.length) * 100) + "%"; };

    const grade = (c, rating) => {
      const cs = v.cards[c.id] || fresh();
      const wasNew = !cs.repetitions;
      // A word seen again in the same round only counts once for scheduling.
      if (!seenInRound.has(c.id)) {
        FSRS.schedule(cs, rating);
        v.cards[c.id] = cs;
        if (wasNew) { v.day.neu++; stats.neu++; } else v.day.wdh++;
      } else if (rating === 1) {
        FSRS.schedule(cs, 1); v.cards[c.id] = cs;
      }
      seenInRound.add(c.id);
      stats.total++;
      if (rating >= 2) stats.right++;
      const g = rating >= 3 ? 10 : rating === 2 ? 5 : 2;
      xp += g; A.state.xp += g;
      if (rating === 1) queue.push(c); // comes back at the end of the round
      if (!A.state.days.includes(A.today())) A.state.days.push(A.today());
      A.save();
      if (LK.vocabSync) LK.vocabSync(v);
      return g;
    };
    const floatXp = (el, g) => { const f = h("div", "floatxp", `+${g} XP`); el.appendChild(f); setTimeout(() => f.remove(), 1200); };

    const next = () => {
      stopAudio();
      setProgress();
      if (idx >= queue.length) return finish(false);
      const c = queue[idx];
      LK.vocabTest.current = c;
      prefetch(queue[idx + 1]); prefetch(queue[idx + 2]);
      const cs = v.cards[c.id];
      const isNew = !cs || !cs.repetitions || seenInRound.has(c.id) && cs.lastRating === 1;
      let type = "karte";
      if (v.mix && !isNew) {
        const opts = [["karte", 3], ["hoeren", 2]];
        if (c.i && activeCards().filter((k) => k.i && k.id !== c.id).length >= 3) opts.push(["bild", 2]);
        if (typable(c) && cs.interval >= 2) opts.push(["tippen", 2]);
        if (gapOk(c) && others(c, 3).length >= 3) opts.push(["luecke", 1]);
        const total = opts.reduce((a, o) => a + o[1], 0);
        let r = Math.random() * total;
        type = opts.find((o) => (r -= o[1]) < 0)[0];
      }
      stage.innerHTML = "";
      const el = h("div", "task vtask"); stage.appendChild(el);
      const done = () => { idx++; next(); };
      ({ karte: flipCard, hoeren: listenChoice, bild: pictureChoice, tippen: typeIt, luecke: gapFill })[type](el, c, isNew, grade, done, floatXp);
    };

    const finish = (early) => {
      stopAudio();
      v.runden++;
      A.save();
      const tom = dueOn(addDays(A.today(), 1));
      const summary = `${stats.total} Wörter geübt${stats.neu ? `, davon ${stats.neu} neu` : ""}<br>+${xp} XP<br><small>${tom ? `Morgen ${tom === 1 ? "ist 1 Wort" : "sind " + tom + " Wörter"} dran.` : "Morgen ist nichts fällig."}</small>`;
      if (stats.total >= 5) {
        const acc = stats.right / stats.total;
        const tier = acc >= 0.9 ? "gold" : acc >= 0.7 ? "silber" : "bronze";
        A.showChest(stage, { tier, title: early ? "Gut geübt!" : "Runde geschafft!", summary, onBack: () => A.go("vokabeln"), backLabel: "Zurück zu den Vokabeln" });
        $(".progress i", top).style.width = "100%";
      } else {
        stage.innerHTML = "";
        const card = h("div", "chestcard", `<h2>${stats.total ? "Gut gemacht!" : "Bis später!"}</h2><div class="summary">${summary}</div><p class="note">Ab 5 Wörtern pro Runde gibt es eine Kiste.</p><button class="primary" type="button">Zurück zu den Vokabeln</button>`);
        $(".primary", card).addEventListener("click", () => A.go("vokabeln"));
        stage.appendChild(card);
      }
    };
    next();
  };

  /* --------------------------------------------------- task: flip card */
  function badges(c, isNew) {
    const cs = V().cards[c.id], b = box(cs);
    return `<div class="vbadges"><span class="vb-set">${esc(DATA.setById[c.setId].titel.split(":")[0])}</span>${isNew ? '<span class="vb-new">NEU</span>' : `<span class="vb-box k${b}">Kiste ${b}</span>`}</div>`;
  }
  function backHtml(c) {
    return `
      <div class="vde">${esc(c.de)}</div>
      <div class="vimg-slot"></div>
      <div class="vplay"><button class="vsnd vsnd-w" type="button">🔊 ${esc(c.en)}</button>${c.ex ? `<button class="vsnd vsnd-s" type="button">🔊 Satz</button>` : ""}</div>
      ${c.ex ? `<div class="vex">${bold(c.ex, c)}${c.exDe ? `<small>${esc(c.exDe)}</small>` : ""}</div>` : ""}
      ${c.note ? `<div class="vnote">💡 ${esc(c.note)}</div>` : ""}`;
  }
  function wireBack(root, c) {
    const w = $(".vsnd-w", root), s = $(".vsnd-s", root);
    if (w) w.addEventListener("click", (e) => { e.stopPropagation(); sayWord(c); });
    if (s) s.addEventListener("click", (e) => { e.stopPropagation(); saySentence(c); });
    const slot = $(".vimg-slot", root);
    if (slot && c.i) media(c.i, "image/webp").then((u) => { if (u) slot.innerHTML = `<img class="vimg" src="${u}" alt="">`; });
  }
  function flipCard(el, c, isNew, grade, done, floatXp) {
    const v = V();
    const cs = v.cards[c.id] || fresh();
    const iv = FSRS.preview(cs);
    el.innerHTML = `
      <div class="vcard-wrap"><div class="vcard" role="button" tabindex="0">
        <div class="vface vfront">${badges(c, isNew)}
          <div class="ven">${esc(c.en)}</div>
          <button class="vsnd vsnd-front" type="button" aria-label="Anhören">🔊</button>
          <div class="vtap">${isNew ? "Neues Wort! Tippe, um es aufzudecken." : "Was heißt das? Denk kurz nach, dann tippe."}</div>
        </div>
        <div class="vface vback"><div class="ven small vback-en">${esc(c.en)}</div>${backHtml(c)}</div>
      </div></div>
      <div class="vrate" hidden>
        <p class="vrate-q">${isNew ? "Kanntest du das Wort schon?" : "Wie gut wusstest du es?"}</p>
        <div class="vrate-btns">
          <button class="vr r1" type="button" data-r="1"><b>Nicht gewusst</b><small>${fmtInterval(iv[0])}</small></button>
          <button class="vr r2" type="button" data-r="2"><b>Knapp</b><small>${fmtInterval(iv[1])}</small></button>
          <button class="vr r3" type="button" data-r="3"><b>Gewusst</b><small>${fmtInterval(iv[2])}</small></button>
          <button class="vr r4" type="button" data-r="4"><b>Ganz leicht</b><small>${fmtInterval(iv[3])}</small></button>
        </div>
      </div>`;
    const card = $(".vcard", el), rate = $(".vrate", el);
    wireBack(el, c);
    $(".vsnd-front", el).addEventListener("click", (e) => { e.stopPropagation(); sayWord(c); });
    let flipped = false;
    const flip = () => {
      card.classList.toggle("flipped");
      if (!flipped) {
        flipped = true; rate.hidden = false; LK.sfx.tap();
        if (v.autoplay && c.ex) setTimeout(() => saySentence(c), 350);
      }
    };
    card.addEventListener("click", flip);
    card.addEventListener("keydown", (e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); flip(); } });
    el.querySelectorAll(".vr").forEach((b) => b.addEventListener("click", () => {
      const r = +b.dataset.r;
      const g = grade(c, r);
      if (r >= 3) LK.sfx.tick();
      floatXp(el, g);
      setTimeout(done, 250);
    }));
    if (v.autoplay) setTimeout(() => sayWord(c), 250);
  }

  /* -------------------------------------------- shared choice + reveal */
  /* Two tries, then the solution (same rule as the math lessons).
     Rating: right at once 3, right on the second try 2, else 1. */
  function choiceTask(el, c, { question, sub, options, isRight, render, onShow }, grade, done, floatXp) {
    el.innerHTML = `<div class="question"><button class="speak" type="button" aria-label="Anhören">🔊</button><div class="qtext">${question}${sub ? `<div class="sub">${sub}</div>` : ""}</div></div>
      <div class="options ${options.some((o) => o.img) ? "imgopts" : ""}"></div>
      <div class="vsolution" hidden></div>
      <div class="bar"><div class="msg"></div><button class="primary" type="button" disabled>Prüfen</button></div>`;
    const box = $(".options", el), bar = $(".bar", el), btn = $(".primary", el), msg = $(".msg", el), sol = $(".vsolution", el);
    $(".speak", el).addEventListener("click", () => sayWord(c));
    let sel = null, tries = 0, state = "select";
    options.forEach((o) => {
      const b = h("button", "opt" + (o.img ? " imgopt" : ""), render(o)); b.type = "button"; o.el = b;
      b.addEventListener("click", () => { if (state !== "select") return; LK.sfx.tap(); options.forEach((x) => x.el.classList.remove("sel")); b.classList.add("sel"); sel = o; btn.disabled = false; });
      box.appendChild(b);
      if (o.img) media(o.img, "image/webp").then((u) => { if (u) $(".oimg", b).src = u; });
    });
    const reveal = (ok) => {
      sol.hidden = false;
      sol.innerHTML = `<div class="ven small">${esc(c.en)}</div>${backHtml(c)}`;
      wireBack(sol, c);
      const g = grade(c, ok ? (tries === 0 ? 3 : 2) : 1);
      if (ok) floatXp(el, g);
      state = "done"; btn.textContent = "Weiter"; btn.disabled = false;
      sayWord(c);
    };
    btn.addEventListener("click", () => {
      if (state === "done") return done();
      if (state === "retry") { state = "select"; bar.classList.remove("bad"); msg.innerHTML = ""; options.forEach((x) => x.el.classList.remove("sel", "wrong")); btn.textContent = "Prüfen"; btn.disabled = true; return; }
      if (!sel) return;
      if (isRight(sel)) {
        sel.el.classList.add("right"); bar.classList.add("ok"); msg.innerHTML = tries ? "Jetzt stimmt es!" : LK.praise(); LK.sfx.ok();
        reveal(true);
      } else {
        sel.el.classList.add("wrong"); bar.classList.add("bad"); LK.sfx.bad(); el.classList.add("shake"); setTimeout(() => el.classList.remove("shake"), 500);
        tries++;
        if (tries < 2) { state = "retry"; msg.innerHTML = "Noch nicht. Versuch es noch einmal."; btn.textContent = "Nochmal"; }
        else { options.find(isRight).el.classList.add("right"); msg.innerHTML = "So heißt es richtig:"; reveal(false); }
      }
    });
    if (onShow) onShow();
  }

  /* hear English, pick the German meaning */
  function listenChoice(el, c, isNew, grade, done, floatXp) {
    const wrong = others(c, 3).map((k) => ({ t: firstDe(k.de) }));
    const options = shuffle([{ t: firstDe(c.de), ok: true }, ...wrong]);
    choiceTask(el, c, {
      question: "Hör zu. Was bedeutet das Wort?", sub: "Tippe auf 🔊, um es nochmal zu hören.",
      options, isRight: (o) => o.ok, render: (o) => esc(o.t),
      onShow: () => setTimeout(() => sayWord(c), 250),
    }, grade, done, floatXp);
  }
  /* hear (and see) English, pick the picture */
  function pictureChoice(el, c, isNew, grade, done, floatXp) {
    const wrong = others(c, 3, (k) => !!k.i).map((k) => ({ img: k.i }));
    const options = shuffle([{ img: c.i, ok: true }, ...wrong]);
    choiceTask(el, c, {
      question: `Welches Bild passt zu <b class="ven-inline">${esc(c.en)}</b>?`,
      options, isRight: (o) => o.ok, render: () => `<img class="oimg" alt="">`,
      onShow: () => { if (V().autoplay) setTimeout(() => sayWord(c), 250); },
    }, grade, done, floatXp);
  }
  /* sentence with a gap, pick the missing word */
  function gapFill(el, c, isNew, grade, done, floatXp) {
    const sent = esc(c.ex).replace(/\n/g, "<br>");
    const marked = bold(c.ex, c);
    const word = (marked.match(/<b>(.*?)<\/b>/) || [])[1] || c.en;
    const gap = marked.replace(/<b>.*?<\/b>/, `<span class="vgap">______</span>`);
    const wrong = others(c, 3).map((k) => ({ t: (k.say || k.en).replace(/^to /i, "") }));
    const options = shuffle([{ t: word, ok: true }, ...wrong]);
    choiceTask(el, c, {
      question: "Welches Wort fehlt?", sub: `<div class="vex">${gap}</div>`,
      options, isRight: (o) => o.ok, render: (o) => esc(o.t),
    }, grade, done, floatXp);
    void sent;
  }

  /* ------------------------------------------- task: type the English */
  function typeIt(el, c, isNew, grade, done, floatXp) {
    const ok = answers(c);
    el.innerHTML = `<div class="question"><button class="speak" type="button" aria-label="Vorlesen">🔊</button><div class="qtext">Wie heißt das auf Englisch?<div class="vde-q">${esc(c.de)}</div></div></div>
      <div class="vimg-slot small"></div>
      <input class="vinput vtype" type="text" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="done" placeholder="Englisch tippen">
      <div class="vsolution" hidden></div>
      <div class="bar"><div class="msg"></div><button class="primary" type="button" disabled>Prüfen</button></div>`;
    const inp = $(".vtype", el), btn = $(".primary", el), bar = $(".bar", el), msg = $(".msg", el), sol = $(".vsolution", el);
    if (c.i) media(c.i, "image/webp").then((u) => { if (u) $(".vimg-slot", el).innerHTML = `<img class="vimg" src="${u}" alt="">`; });
    $(".speak", el).addEventListener("click", () => speakDe(c.de.replace(/;/g, ",")));
    let tries = 0, state = "select";
    inp.addEventListener("input", () => { btn.disabled = !inp.value.trim(); if (state === "retry") { state = "select"; bar.classList.remove("bad"); msg.innerHTML = ""; btn.textContent = "Prüfen"; } });
    inp.addEventListener("keydown", (e) => { if (e.key === "Enter" && !btn.disabled) btn.click(); });
    const reveal = (good) => {
      sol.hidden = false;
      sol.innerHTML = `<div class="ven small">${esc(c.en)}</div>${backHtml(c)}`;
      wireBack(sol, c);
      const g = grade(c, good ? (tries === 0 ? 3 : 2) : 1);
      if (good) floatXp(el, g);
      state = "done"; btn.textContent = "Weiter"; btn.disabled = false; inp.disabled = true;
      sayWord(c);
    };
    btn.addEventListener("click", () => {
      if (state === "done") return done();
      const got = norm(inp.value);
      if (!got) return;
      if (ok.includes(got)) {
        bar.classList.add("ok"); msg.innerHTML = tries ? "Jetzt stimmt es!" : LK.praise(); LK.sfx.ok(); inp.classList.add("right"); reveal(true); return;
      }
      tries++;
      const close = ok.some((a) => a.length >= 4 && lev(a, got) <= 1);
      bar.classList.add("bad"); LK.sfx.bad(); el.classList.add("shake"); setTimeout(() => el.classList.remove("shake"), 500);
      if (tries < 2) {
        state = "retry"; btn.textContent = "Nochmal";
        const a = ok[0];
        msg.innerHTML = close ? "Fast! Schau genau auf die Buchstaben." : `Noch nicht. Tipp: Es fängt mit <b>${esc(a.slice(0, a.startsWith("to ") ? 4 : 1))}</b> an und hat ${a.replace(/ /g, "").length} Buchstaben.`;
        inp.select();
      } else {
        inp.classList.add("wrong"); msg.innerHTML = "So schreibt man es:"; reveal(false);
      }
    });
    setTimeout(() => { try { inp.focus(); } catch (e) {} }, 50);
  }

  /* ---------------------------------------------------- registration */
  LK.screens.vokabeln = () => renderHome();
  LK.screens.vliste = (arg) => renderList(arg);
  LK.screens.vlearn = (arg) => renderLearn(arg || {});
  // Test hooks for the scripted walkthrough.
  LK.vocabTest = { FSRS, box, answers, norm, loadData, buildQueue: (b) => buildQueue(b) };
  void pick;
})(window.LK);
