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
  const DEFAULTS = { name: "", xp: 0, shells: 0, lessons: {}, stickers: {}, days: [], settings: { sound: true, autoSpeak: true, allOpen: false }, chests: 0 };
  let state;
  const load = () => { try { state = Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem(STORE) || "{}")); state.settings = Object.assign({}, DEFAULTS.settings, state.settings || {}); } catch (e) { state = JSON.parse(JSON.stringify(DEFAULTS)); } };
  const save = () => { try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) {} };
  const today = () => new Date().toISOString().slice(0, 10);
  const level = (xp) => Math.floor(Math.sqrt(xp / 50)) + 1;
  const xpForLevel = (l) => (l - 1) * (l - 1) * 50;
  const streak = () => {
    const days = new Set(state.days); let n = 0; const d = new Date();
    if (!days.has(today())) d.setDate(d.getDate() - 1);
    while (days.has(d.toISOString().slice(0, 10))) { n++; d.setDate(d.getDate() - 1); }
    return n;
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
    nav.hidden = screen === "lesson";
    if (screen === "pfad") renderPath();
    else if (screen === "sammlung") renderCollection();
    else if (screen === "ich") renderMe();
    else if (screen === "lesson") renderLesson(arg);
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
        <span title="Serie">🔥 ${streak()}</span>
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
      const shells = { gold: rnd(40, 60), silber: rnd(20, 35), bronze: rnd(8, 15) }[tier];
      const stickerChance = { gold: 1, silber: 0.6, bronze: 0.3 }[tier];
      let sticker = null;
      if (Math.random() < stickerChance) {
        const pool = STICKERS.filter((s) => tier === "gold" ? true : tier === "silber" ? s.rarity <= 2 : s.rarity === 1);
        const missing = pool.filter((s) => !state.stickers[s.id]);
        sticker = missing.length && Math.random() < 0.8 ? pick(missing) : pick(pool);
      }
      state.xp += xpGained; state.shells += shells; state.chests++;
      if (sticker) state.stickers[sticker.id] = (state.stickers[sticker.id] || 0) + 1;
      const rec = state.lessons[lesson.id] || { count: 0, best: 99 };
      rec.count++; rec.best = Math.min(rec.best, mistakes); rec.last = today();
      state.lessons[lesson.id] = rec;
      if (!state.days.includes(today())) state.days.push(today());
      save();
      stage.innerHTML = "";
      const card = h("div", "chestcard", `
        <h2>Lektion geschafft!</h2>
        <div class="summary">${firstTry} von ${tasks.length} direkt richtig<br>+${xpGained} XP</div>
        <div class="chest ${tier}"><div class="lid"></div><div class="box"></div><div class="glow"></div></div>
        <div class="chestname">${tier === "gold" ? "Goldene Kiste" : tier === "silber" ? "Silberne Kiste" : "Bronze-Kiste"}</div>
        <button class="primary open" type="button">Kiste öffnen</button>
        <div class="loot" hidden></div>
        <button class="primary back" type="button" hidden>Zurück zum Pfad</button>`);
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
      $(".back", card).addEventListener("click", () => go("pfad"));
    };
    intro();
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

  /* ------------------------------------------------------------------ me */
  const renderMe = () => {
    app.innerHTML = "";
    const done = Object.keys(state.lessons).length, total = allLessons().length;
    app.appendChild(h("header", "pagehead", `<h2>${state.name ? esc(state.name) : "Ich"}</h2><p>Level ${level(state.xp)}, ${fmt(state.xp)} XP, ${fmt(state.shells)} Muscheln</p>`));
    const stats = h("div", "mestats", `
      <div><b>${done}/${total}</b><span>Lektionen</span></div>
      <div><b>${streak()}</b><span>Tage Serie</span></div>
      <div><b>${state.chests}</b><span>Kisten</span></div>`);
    app.appendChild(stats);
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
    $("input", imp).addEventListener("change", (e) => { const f = e.target.files[0]; if (!f) return; f.text().then((t) => { try { const s = JSON.parse(t); if (!("xp" in s)) throw 0; state = Object.assign({}, DEFAULTS, s); save(); render(); alert("Geladen."); } catch (err) { alert("Das war keine Lernkiste-Datei."); } }); });
    const reset = h("button", "ghost danger", "Alles zurücksetzen"); reset.type = "button";
    reset.addEventListener("click", () => { if (confirm("Wirklich alles löschen? XP, Sticker, alles.")) { localStorage.removeItem(STORE); load(); render(); } });
    sets.appendChild(nameBtn); sets.appendChild(exp); sets.appendChild(imp); sets.appendChild(reset);
    app.appendChild(sets);
    app.appendChild(h("p", "note", "Der Fortschritt liegt nur auf diesem Gerät. Zum Wechseln aufs neue Handy: hier sichern, dort laden."));
  };

  load();
  render();
})(window.LK);
