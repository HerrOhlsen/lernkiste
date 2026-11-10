/* App shell: state, screens, lesson flow, rewards, audio. */
(function (LK) {
  const { esc, fmt, rnd, pick } = LK;
  const STORE = "lernkiste-v1";
  const $ = (s, r) => (r || document).querySelector(s);
  const h = (tag, cls, html) => { const el = document.createElement(tag); if (cls) el.className = cls; if (html != null) el.innerHTML = html; return el; };

  /* ------------------------------------------------------------ stickers */
  const STICKERS = [
    ["krabbe", "🦀", "Krabbe", 1], ["muschel", "🐚", "Muschel", 1], ["fisch", "🐠", "Fisch", 1], ["moewe", "🐦", "Möwe", 1],
    ["seestern", "⭐", "Seestern", 1], ["qualle", "🪼", "Qualle", 1], ["krake", "🐙", "Krake", 1], ["schildkroete", "🐢", "Schildkröte", 1],
    ["robbe", "🦭", "Seehund", 2], ["delfin", "🐬", "Delfin", 2], ["wal", "🐳", "Wal", 2], ["hai", "🦈", "Hai", 2],
    ["pinguin", "🐧", "Pinguin", 2], ["schiff", "🚢", "Schiff", 2], ["leuchtturm", "🗼", "Leuchtturm", 2], ["anker", "⚓", "Anker", 2],
    ["kompass", "🧭", "Kompass", 3], ["karte", "🗺️", "Schatzkarte", 3], ["piratenflagge", "🏴‍☠️", "Piratenflagge", 3], ["dreizack", "🔱", "Dreizack", 3],
    ["diamant", "💎", "Diamant", 3], ["krone", "👑", "Krone", 3], ["drache", "🐉", "Seedrache", 3], ["ufo", "🛸", "Ufo überm Meer", 3],
  ].map(([id, emoji, name, rarity]) => ({ id, emoji, name, rarity }));
  const RARITY = { 1: "normal", 2: "selten", 3: "legendär" };

  /* --------------------------------------------------------------- state */
  const DEFAULTS = { name: "", xp: 0, shells: 0, lessons: {}, stickers: {}, days: [], settings: { sound: true, autoSpeak: true, allOpen: false }, chests: 0, badges: [] };
  let state;
  /* Keep only known fields with the expected types. Progress can come from a
     file or the online backup, so nothing in it is trusted before it reaches
     the screen. */
  const num = (v, d) => (typeof v === "number" && isFinite(v) ? v : d || 0);
  const isDate = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
  const ID = /^[a-z0-9:~_-]{1,80}$/;
  const objOf = (o, fn) => { const out = {}; if (o && typeof o === "object" && !Array.isArray(o)) for (const k of Object.keys(o)) { if (ID.test(k)) { const v = fn(o[k]); if (v !== undefined) out[k] = v; } } return out; };
  const sanitize = (raw) => {
    const r = raw && typeof raw === "object" ? raw : {};
    const s = JSON.parse(JSON.stringify(DEFAULTS));
    s.name = typeof r.name === "string" ? r.name.slice(0, 20) : "";
    s.xp = num(r.xp); s.shells = num(r.shells); s.chests = num(r.chests);
    s.lessons = objOf(r.lessons, (v) => v && typeof v === "object" ? { count: num(v.count), best: num(v.best, 99), last: isDate(v.last) ? v.last : undefined } : undefined);
    s.stickers = objOf(r.stickers, (v) => (typeof v === "number" && isFinite(v) ? v : undefined));
    s.days = Array.isArray(r.days) ? [...new Set(r.days.filter(isDate))] : [];
    s.badges = Array.isArray(r.badges) ? r.badges.filter((n) => typeof n === "number" && isFinite(n)) : [];
    const st = r.settings || {};
    for (const k of Object.keys(DEFAULTS.settings)) s.settings[k] = typeof st[k] === "boolean" ? st[k] : DEFAULTS.settings[k];
    const v = r.vocab;
    if (v && typeof v === "object") {
      s.vocab = {
        on: Array.isArray(v.on) ? v.on.filter((x) => typeof x === "string" && ID.test(x)) : [],
        cards: objOf(v.cards, (c) => c && typeof c === "object" ? {
          stability: num(c.stability), difficulty: num(c.difficulty, 5), repetitions: num(c.repetitions), interval: num(c.interval),
          nextReview: isDate(c.nextReview) ? c.nextReview : null, lastReview: isDate(c.lastReview) ? c.lastReview : null,
          lastRating: num(c.lastRating, null), lapses: num(c.lapses) } : undefined),
        day: v.day && isDate(v.day.date) ? { date: v.day.date, neu: num(v.day.neu), wdh: num(v.day.wdh) } : { date: "", neu: 0, wdh: 0 },
        autoplay: typeof v.autoplay === "boolean" ? v.autoplay : true,
        mix: typeof v.mix === "boolean" ? v.mix : true,
        neuProTag: [3, 5, 8, 10, 15].includes(v.neuProTag) ? v.neuProTag : 8,
        runden: num(v.runden),
      };
    }
    return s;
  };
  const load = () => { try { state = sanitize(JSON.parse(localStorage.getItem(STORE) || "{}")); } catch (e) { state = JSON.parse(JSON.stringify(DEFAULTS)); } };
  const save = () => { try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) {} if (LK.sync) LK.sync.schedule(); };
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
  const ymd = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  const today = () => ymd(new Date());
  const level = (xp) => Math.floor(Math.sqrt(xp / 50)) + 1;
  const xpForLevel = (l) => (l - 1) * (l - 1) * 50;
  /* ---------------------------------------------------------- milestones
     Practice days count every day with a finished math lesson or vocabulary
     work; a missed day never resets anything. Milestones are spaced so the
     next one always feels close. */
  const MILESTONES = (() => {
    const base = [[3, "🌱", "Drei Tage"], [7, "🌿", "Eine Woche"], [14, "🌳", "Zwei Wochen"], [21, "⭐", "Drei Wochen"],
      [30, "🏅", "Ein Monat"], [45, "🎖️", "Sechs Wochen"], [60, "🥉", "Zwei Monate"], [90, "🥈", "Drei Monate"],
      [120, "🥇", "Vier Monate"], [150, "🏆", "Fünf Monate"], [200, "💎", "200 Tage"], [250, "🚀", "250 Tage"],
      [300, "🌟", "300 Tage"], [365, "👑", "Ein ganzes Jahr"]];
    const extra = ["🐬", "🐳", "🦈", "🐙", "🐉", "🛸", "🌋", "🪐"];
    for (let n = 450, k = 0; n <= 3000; n += n < 1000 ? 100 : 150, k++) base.push([n, extra[k % extra.length], n + " Tage"]);
    for (const [n, name] of [[730, "Zwei Jahre"], [1095, "Drei Jahre"], [1460, "Vier Jahre"]]) base.push([n, "👑", name]);
    return base.sort((a, b) => a[0] - b[0]).map(([n, emoji, name]) => ({ n, emoji, name }));
  })();
  const practiceDays = () => state.days.length;
  const nextMilestone = () => MILESTONES.find((m) => m.n > practiceDays()) || null;
  const prevMilestone = () => [...MILESTONES].reverse().find((m) => m.n <= practiceDays()) || null;
  const daysWord = (n) => (n === 1 ? "1 Übungstag" : n + " Übungstage");
  /* Show a badge for every milestone reached since the last check. */
  const celebrate = () => {
    const fresh = MILESTONES.filter((m) => m.n <= practiceDays() && !state.badges.includes(m.n));
    if (!fresh.length || document.querySelector(".badgepop")) return;
    fresh.forEach((m) => state.badges.push(m.n)); save();
    const top = fresh[fresh.length - 1], nx = nextMilestone();
    const pop = h("div", "badgepop", `<div class="badgecard" role="dialog" aria-label="Neues Abzeichen">
      <div class="bp-emoji">${top.emoji}</div><div class="bp-kicker">Neues Abzeichen!</div><h2>${esc(top.name)}</h2>
      <p>Du hast an ${practiceDays()} Tagen geübt.</p>
      ${nx ? `<p class="bp-next">Nächstes Abzeichen: ${nx.emoji} ${esc(nx.name)}, noch ${daysWord(nx.n - practiceDays())}.</p>` : ""}
      <button class="primary" type="button">Juhu!</button></div>`);
    document.body.appendChild(pop);
    LK.sfx.chest(); confetti(pop);
    speak(`Neues Abzeichen: ${top.name}! Du hast an ${practiceDays()} Tagen geübt.`);
    $(".primary", pop).addEventListener("click", () => pop.remove());
  };


  /* --------------------------------------------------------------- sound */
  let ac;
  const tone = (f, dur, type, vol) => {
    if (!state.settings.sound) return;
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = type || "sine"; o.frequency.value = f;
      g.gain.setValueAtTime(vol || 0.08, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
      o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime + dur);
    } catch (e) {}
  };
  LK.sfx = {
    tap: () => tone(600, 0.05, "square", 0.03),
    tick: () => { tone(880, 0.08); setTimeout(() => tone(1320, 0.1), 70); },
    ok: () => { tone(660, 0.1); setTimeout(() => tone(880, 0.12), 90); setTimeout(() => tone(1320, 0.18), 180); },
    bad: () => tone(180, 0.25, "sawtooth", 0.05),
    chest: () => [523, 659, 784, 1047, 1319].forEach((f, i) => setTimeout(() => tone(f, 0.35, "triangle", 0.07), i * 110)),
  };

  /* -------------------------------------------------------------- speech */
  let voice = null;
  const pickVoice = () => { const vs = speechSynthesis.getVoices().filter((v) => v.lang.startsWith("de")); voice = vs.find((v) => /Anna|Petra|Markus|Google Deutsch|Helena|Katja/i.test(v.name)) || vs[0] || null; };
  if ("speechSynthesis" in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
  const speak = (text) => {
    if (!state.settings.sound || !("speechSynthesis" in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text); u.lang = "de-DE"; u.rate = 0.95; if (voice) u.voice = voice;
    speechSynthesis.speak(u);
  };
  const stopSpeech = () => { try { speechSynthesis.cancel(); } catch (e) {} };

  /* -------------------------------------------------------------- audio */
  let audioEl = null;
  const playIntro = (lesson, btn) => {
    stopSpeech();
    if (audioEl) { audioEl.pause(); audioEl = null; }
    const src = `audio/${lesson.id}.mp3`;
    audioEl = new Audio(src);
    btn.classList.add("playing"); btn.textContent = "⏸ Pause";
    const fallback = () => { btn.classList.remove("playing"); btn.textContent = "▶ Nochmal hören"; speak(lesson.intro.text); };
    audioEl.onended = () => { btn.classList.remove("playing"); btn.textContent = "▶ Nochmal hören"; };
    audioEl.onerror = fallback;
    audioEl.play().catch(fallback);
  };
  const stopIntro = () => { if (audioEl) { audioEl.pause(); audioEl = null; } stopSpeech(); };

  /* -------------------------------------------------------------- router */
  const app = $("#app");
  const nav = $("#nav");
  let screen = "pfad";
  const go = (s, arg) => { stopIntro(); screen = s; render(arg); window.scrollTo(0, 0); };
  nav.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) { LK.sfx.tap(); go(b.dataset.s); } });

  const render = (arg) => {
    nav.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.s === screen));
    nav.hidden = screen === "lesson" || (LK.fullscreen || []).includes(screen);
    if (LK.screens && LK.screens[screen]) LK.screens[screen](arg);
    else if (screen === "pfad") renderPath();
    else if (screen === "sammlung") renderCollection();
    else if (screen === "ich") renderMe();
    else if (screen === "lesson") renderLesson(arg);
    if (!nav.hidden) setTimeout(celebrate, 400);
  };

  /* --------------------------------------------------------------- path */
  const course = () => LK.courses[0];
  const allLessons = () => course().units.flatMap((u) => u.lessons.map((l) => ({ u, l })));
  const isOpen = (lessonId) => {
    if (state.settings.allOpen) return true;
    const list = allLessons(); const i = list.findIndex((x) => x.l.id === lessonId);
    return i === 0 || !!state.lessons[list[i - 1].l.id];
  };
  const renderPath = () => {
    const c = course();
    const lv = level(state.xp), nextXp = xpForLevel(lv + 1), prevXp = xpForLevel(lv);
    const pct = Math.round(((state.xp - prevXp) / (nextXp - prevXp)) * 100);
    app.innerHTML = "";
    const head = h("header", "hero", `
      <div class="greet">${state.name ? "Hallo " + esc(state.name) + "!" : "Hallo!"}</div>
      <div class="stats">
        <span title="Übungstage">📅 ${practiceDays()}</span>
        <span title="Muscheln">🐚 ${fmt(state.shells)}</span>
        <span title="Level">⭐ Level ${lv}</span>
      </div>
      <div class="lvbar"><i style="width:${pct}%"></i></div>
      <div class="lvtext">${fmt(state.xp)} XP, noch ${fmt(nextXp - state.xp)} bis Level ${lv + 1}</div>`);
    app.appendChild(head);
    const title = h("div", "coursetitle", `<span class="fach">${esc(c.fach)}</span><h2>${esc(c.titel)}</h2>`);
    app.appendChild(title);
    const path = h("div", "path");
    c.units.forEach((u, ui) => {
      const unit = h("section", "unit");
      unit.appendChild(h("h3", null, `<span class="uemoji">${u.emoji}</span>${esc(u.titel)}`));
      u.lessons.forEach((l, li) => {
        const done = state.lessons[l.id];
        const open = isOpen(l.id);
        const node = h("button", "node" + (done ? " done" : open ? " open" : " locked"));
        node.type = "button";
        node.style.setProperty("--shift", ((ui * 3 + li) % 4 === 1 ? 1 : (ui * 3 + li) % 4 === 3 ? -1 : 0));
        node.innerHTML = `<span class="bubble">${done ? (done.best === 0 ? "👑" : "✓") : open ? "▶" : "🔒"}</span><span class="label">${esc(l.titel)}${done ? `<small>${done.count}× gespielt</small>` : ""}</span>`;
        if (open) node.addEventListener("click", () => { LK.sfx.tap(); go("lesson", { unit: u, lesson: l }); });
        unit.appendChild(node);
      });
      path.appendChild(unit);
    });
    app.appendChild(path);
    if (!state.name) setTimeout(askName, 300);
  };
  const askName = () => {
    const name = prompt("Wie heißt du? (Wird nur auf diesem Handy gespeichert)");
    if (name && name.trim()) { state.name = name.trim().slice(0, 20); save(); render(); }
  };

  /* -------------------------------------------------------------- lesson */
  const renderLesson = ({ unit, lesson }) => {
    app.innerHTML = "";
    const tasks = lesson.make();
    let i = -1, firstTry = 0, mistakes = 0, xpGained = 0;
    const top = h("div", "lessontop", `<button class="close" type="button" aria-label="Abbrechen">✕</button><div class="progress"><i></i></div>`);
    app.appendChild(top);
    $(".close", top).addEventListener("click", () => { if (confirm("Lektion abbrechen? Der Fortschritt dieser Lektion geht verloren.")) go("pfad"); });
    const stage = h("div", "stage"); app.appendChild(stage);
    const setProgress = () => { $(".progress i", top).style.width = Math.max(4, ((i + 1) / (tasks.length + 1)) * 100) + "%"; };

    const intro = () => {
      setProgress();
      stage.innerHTML = "";
      const card = h("div", "intro", `
        <div class="uemoji big">${unit.emoji}</div>
        <h2>${esc(lesson.titel)}</h2>
        <div class="example">${lesson.intro.html}</div>
        <button class="play" type="button">▶ Erklärung anhören</button>
        <p class="introtext">${esc(lesson.intro.text)}</p>
        <button class="primary start" type="button">Los geht's</button>`);
      stage.appendChild(card);
      const play = $(".play", card);
      play.addEventListener("click", () => { if (audioEl && !audioEl.paused) { audioEl.pause(); play.textContent = "▶ Weiter hören"; play.classList.remove("playing"); } else if (audioEl && audioEl.paused && audioEl.currentTime > 0) { audioEl.play(); play.textContent = "⏸ Pause"; play.classList.add("playing"); } else playIntro(lesson, play); });
      $(".start", card).addEventListener("click", () => { stopIntro(); next(); });
      const seen = state.lessons[lesson.id];
      if (!seen && state.settings.autoSpeak) setTimeout(() => playIntro(lesson, play), 400);
    };
    const next = () => {
      i++; setProgress();
      if (i >= tasks.length) return finish();
      stage.innerHTML = "";
      const box = h("div", "task"); stage.appendChild(box);
      const t = tasks[i];
      LK.runTask(t, box, {
        speak,
        autoSpeak: state.settings.autoSpeak,
        onCorrect: (clean) => { const g = clean ? 10 : 5; xpGained += g; if (clean) firstTry++; else mistakes++; floatXp(box, g); },
        onDone: (res) => { if (!res.correct) mistakes++; next(); },
      });
      if (state.settings.autoSpeak && t.type !== "schriftlich") setTimeout(() => $(".speak", box).click(), 250);
    };
    const floatXp = (box, g) => { const f = h("div", "floatxp", `+${g} XP`); box.appendChild(f); setTimeout(() => f.remove(), 1200); };
    const finish = () => {
      stopSpeech();
      const tier = mistakes === 0 ? "gold" : mistakes <= 2 ? "silber" : "bronze";
      state.xp += xpGained;
      const rec = state.lessons[lesson.id] || { count: 0, best: 99 };
      rec.count++; rec.best = Math.min(rec.best, mistakes); rec.last = today();
      state.lessons[lesson.id] = rec;
      showChest(stage, { tier, title: "Lektion geschafft!", summary: `${firstTry} von ${tasks.length} direkt richtig<br>+${xpGained} XP`, onBack: () => go("pfad"), backLabel: "Zurück zum Pfad" });
    };
    intro();
  };
  /* --------------------------------------------------------------- chest */
  /* Award shells and maybe a sticker for one finished round, then show the
     chest. Shared by math lessons and vocabulary sessions. */
  const showChest = (stage, { tier, title, summary, onBack, backLabel }) => {
    const shells = { gold: rnd(40, 60), silber: rnd(20, 35), bronze: rnd(8, 15) }[tier];
    const stickerChance = { gold: 1, silber: 0.6, bronze: 0.3 }[tier];
    let sticker = null;
    if (Math.random() < stickerChance) {
      const pool = STICKERS.filter((s) => tier === "gold" ? true : tier === "silber" ? s.rarity <= 2 : s.rarity === 1);
      const missing = pool.filter((s) => !state.stickers[s.id]);
      sticker = missing.length && Math.random() < 0.8 ? pick(missing) : pick(pool);
    }
    state.shells += shells; state.chests++;
    if (sticker) state.stickers[sticker.id] = (state.stickers[sticker.id] || 0) + 1;
    if (!state.days.includes(today())) state.days.push(today());
    save();
    stage.innerHTML = "";
    const card = h("div", "chestcard", `
      <h2>${esc(title)}</h2>
      <div class="summary">${summary}</div>
      <div class="chest ${tier}"><div class="lid"></div><div class="box"></div><div class="glow"></div></div>
      <div class="chestname">${tier === "gold" ? "Goldene Kiste" : tier === "silber" ? "Silberne Kiste" : "Bronze-Kiste"}</div>
      <button class="primary open" type="button">Kiste öffnen</button>
      <div class="loot" hidden></div>
      <button class="primary back" type="button" hidden>${esc(backLabel || "Weiter")}</button>`);
    stage.appendChild(card);
    $(".open", card).addEventListener("click", () => {
      LK.sfx.chest();
      $(".chest", card).classList.add("opened");
      $(".open", card).hidden = true;
      confetti(card);
      setTimeout(() => {
        const loot = $(".loot", card); loot.hidden = false;
        loot.innerHTML = `<div class="lootitem"><span class="lemoji">🐚</span><span>+${shells} Muscheln</span></div>` +
          (sticker ? `<div class="lootitem sticker r${sticker.rarity}"><span class="lemoji">${sticker.emoji}</span><span>Sticker: ${esc(sticker.name)}<small>${RARITY[sticker.rarity]}${state.stickers[sticker.id] > 1 ? ", schon " + state.stickers[sticker.id] + "×" : ", neu!"}</small></span></div>` : `<div class="lootitem dim"><span class="lemoji">🎟️</span><span>Kein Sticker diesmal<small>Goldene Kisten haben immer einen</small></span></div>`);
        $(".back", card).hidden = false;
        speak(`Du hast ${shells} Muscheln bekommen${sticker ? " und den Sticker " + sticker.name : ""}.`);
      }, 700);
    });
    $(".back", card).addEventListener("click", onBack);
  };

  const confetti = (root) => {
    const c = h("div", "confetti");
    for (let k = 0; k < 40; k++) { const p = h("i"); p.style.left = rnd(5, 95) + "%"; p.style.animationDelay = (Math.random() * 0.6) + "s"; p.style.background = pick(["#ffd166", "#59d49b", "#5ec8ff", "#ff7b9c", "#c89bff"]); c.appendChild(p); }
    root.appendChild(c); setTimeout(() => c.remove(), 3000);
  };

  /* ---------------------------------------------------------- collection */
  const renderCollection = () => {
    app.innerHTML = "";
    const have = Object.keys(state.stickers).length;
    app.appendChild(h("header", "pagehead", `<h2>Sammlung</h2><p>${have} von ${STICKERS.length} Stickern, ${state.chests} Kisten geöffnet</p>`));
    const grid = h("div", "stickers");
    STICKERS.forEach((s) => {
      const n = state.stickers[s.id] || 0;
      grid.appendChild(h("div", "stk r" + s.rarity + (n ? "" : " missing"), `<span class="semoji">${n ? s.emoji : "❔"}</span><span class="sname">${n ? esc(s.name) : "???"}</span>${n > 1 ? `<span class="count">${n}×</span>` : ""}`));
    });
    app.appendChild(grid);
    app.appendChild(h("p", "note", "Normale Sticker gibt es in jeder Kiste, seltene ab Silber, legendäre nur in goldenen Kisten (keine Fehler)."));
  };

  /* --------------------------------------------------------------- stats */
  const renderStats = (done, total) => {
    const wrap = h("section", "mestat");
    const d = practiceDays(), nx = nextMilestone(), pv = prevMilestone();
    const from = pv ? pv.n : 0, pct = nx ? Math.round(((d - from) / (nx.n - from)) * 100) : 100;
    wrap.appendChild(h("div", "daysbig", `
      <div class="db-num">${d}</div><div class="db-lbl">${d === 1 ? "Tag" : "Tage"} geübt</div>
      ${nx ? `<div class="db-bar"><i style="width:${Math.max(4, pct)}%"></i></div>
      <div class="db-next">Noch <b>${daysWord(nx.n - d)}</b> bis ${nx.emoji} ${esc(nx.name)}</div>` : ""}`));
    // badge shelf: everything earned plus the next three
    const earned = MILESTONES.filter((m) => m.n <= d);
    const upcoming = MILESTONES.filter((m) => m.n > d).slice(0, 3);
    wrap.appendChild(h("h3", "mehead", "Abzeichen"));
    wrap.appendChild(h("div", "badges", [...earned, ...upcoming].map((m) => `
      <div class="badge${m.n <= d ? " got" : ""}${nx && m.n === nx.n ? " next" : ""}"><span class="b-emoji">${m.n <= d ? m.emoji : "🔒"}</span>
      <span class="b-name">${esc(m.name)}</span><small>${m.n} Tage</small></div>`).join("")));
    // calendar of the last 15 weeks, Monday first
    const set = new Set(state.days), weeks = 15, cells = [];
    const start = new Date(); start.setHours(12, 0, 0, 0);
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7) - (weeks - 1) * 7);
    const t = today();
    for (let w = 0; w < weeks; w++) for (let k = 0; k < 7; k++) {
      const x = new Date(start); x.setDate(start.getDate() + w * 7 + k); const key = ymd(x);
      cells.push(`<i class="${set.has(key) ? "on" : ""}${key === t ? " today" : ""}${key > t ? " future" : ""}" style="grid-column:${w + 2};grid-row:${k + 1}" title="${key}"></i>`);
    }
    const thisWeek = cells.slice(-7).filter((c) => c.includes('"on')).length;
    wrap.appendChild(h("h3", "mehead", "Deine Übungstage"));
    wrap.appendChild(h("div", "cal", ["Mo", "", "Mi", "", "Fr", "", "So"].map((l, k) => `<b style="grid-row:${k + 1}">${l}</b>`).join("") + cells.join("")));
    wrap.appendChild(h("p", "note", `Diese Woche: ${thisWeek} von 7 Tagen. Jeder Tag zählt, auch wenn mal einer fehlt.`));
    // numbers
    const vc = (state.vocab && state.vocab.cards) || {};
    const learned = Object.values(vc).filter((c) => c.repetitions > 0).length;
    const solid = Object.values(vc).filter((c) => c.repetitions > 0 && c.interval > 30).length;
    wrap.appendChild(h("div", "mestats", `
      <div><b>${learned}</b><span>Wörter gelernt</span></div>
      <div><b>${solid}</b><span>Wörter in Kiste 5</span></div>
      <div><b>${done}/${total}</b><span>Mathe-Lektionen</span></div>
      <div><b>${state.chests}</b><span>Kisten geöffnet</span></div>
      <div><b>${Object.keys(state.stickers).length}</b><span>Sticker</span></div>
      <div><b>${fmt(state.xp)}</b><span>XP</span></div>`));
    return wrap;
  };

  /* ------------------------------------------------------------------ me */
  const renderMe = () => {
    app.innerHTML = "";
    const done = Object.keys(state.lessons).length, total = allLessons().length;
    app.appendChild(h("header", "pagehead", `<h2>${state.name ? esc(state.name) : "Ich"}</h2><p>Level ${level(state.xp)}, ${fmt(state.xp)} XP, ${fmt(state.shells)} Muscheln</p>`));
    app.appendChild(renderStats(done, total));
    const sets = h("div", "settings");
    const toggle = (key, label, hint) => {
      const row = h("label", "row", `<span>${label}<small>${hint}</small></span><input type="checkbox" ${state.settings[key] ? "checked" : ""}>`);
      $("input", row).addEventListener("change", (e) => { state.settings[key] = e.target.checked; save(); });
      sets.appendChild(row);
    };
    toggle("sound", "Töne", "Klänge bei richtig und falsch");
    toggle("autoSpeak", "Automatisch vorlesen", "Erklärung und Aufgaben werden vorgelesen");
    toggle("allOpen", "Alle Lektionen offen", "Für Eltern: Reihenfolge frei wählen");
    const nameBtn = h("button", "ghost", "Namen ändern"); nameBtn.type = "button"; nameBtn.addEventListener("click", () => { askName(); render(); });
    const exp = h("button", "ghost", "Fortschritt sichern (Datei)"); exp.type = "button";
    exp.addEventListener("click", () => { const blob = new Blob([JSON.stringify(state)], { type: "application/json" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `lernkiste-${today()}.json`; a.click(); });
    const imp = h("label", "ghost", `Fortschritt laden <input type="file" accept="application/json" hidden>`);
    $("input", imp).addEventListener("change", (e) => { const f = e.target.files[0]; if (!f) return; f.text().then((t) => { try { const s = JSON.parse(t); if (!s || !("xp" in s)) throw 0; state = sanitize(s); save(); render(); alert("Geladen."); } catch (err) { alert("Das war keine Lernkiste-Datei."); } }); });
    const reset = h("button", "ghost danger", "Alles zurücksetzen"); reset.type = "button";
    reset.addEventListener("click", () => { if (confirm("Wirklich alles löschen? XP, Sticker, alles.")) { localStorage.removeItem(STORE); load(); render(); } });
    sets.appendChild(nameBtn); sets.appendChild(exp); sets.appendChild(imp); sets.appendChild(reset);
    app.appendChild(sets);
    if (LK.sync && LK.sync.enabled()) LK.sync.renderInto(app);
    else app.appendChild(h("p", "note", "Der Fortschritt liegt nur auf diesem Gerät. Zum Wechseln aufs neue Handy: hier sichern, dort laden."));
  };

  load();
  /* Shared API for feature modules (e.g. js/vokabeln.js). */
  LK.app = { get state() { return state; }, save, go, render, showChest, confetti, speak, stopSpeech, today, ymd, h, $, level, practiceDays, nextMilestone, daysWord };
  if (LK.onAppReady) LK.onAppReady.forEach((f) => f(LK.app));
  render();
})(window.LK);
