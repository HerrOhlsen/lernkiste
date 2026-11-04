/* Task engine: renders one task into a container and reports the result.
   Every task type goes through the same bottom bar (Prüfen / Weiter), so the
   interaction feels identical no matter what is asked. */
(function (LK) {
  const { esc, fmt, shuffle } = LK;
  const h = (tag, cls, html) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (html != null) el.innerHTML = html;
    return el;
  };
  const plain = (html) => String(html).replace(/<div class="dots">.*<\/div>/s, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const speakify = (s) => s.replace(/·/g, " mal ").replace(/ : /g, " geteilt durch ").replace(/−/g, " minus ").replace(/≈/g, " ungefähr ").replace(/\?/g, "?");

  /* ----------------------------------------------------------- keypad */
  function Keypad(onKey) {
    const el = h("div", "keypad");
    const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "OK"];
    keys.forEach((k) => {
      const b = h("button", "key" + (k === "OK" ? " ok" : k === "⌫" ? " del" : ""), k);
      b.type = "button";
      b.addEventListener("click", () => { LK.sfx.tap(); onKey(k); });
      el.appendChild(b);
    });
    return el;
  }

  /* ------------------------------------------------------- base runner */
  class Runner {
    constructor(task, root, api) {
      this.task = task; this.root = root; this.api = api; root._runner = this;
      this.mistakes = 0; this.resolved = false; this.state = "select";
      root.innerHTML = "";
      this.qEl = h("div", "question");
      const speak = h("button", "speak", "🔊");
      speak.type = "button"; speak.setAttribute("aria-label", "Vorlesen");
      speak.addEventListener("click", () => api.speak(speakify(plain(this.sayText()))));
      this.qEl.appendChild(speak);
      this.qEl.appendChild(h("div", "qtext", task.q || ""));
      root.appendChild(this.qEl);
      this.body = h("div", "body");
      root.appendChild(this.body);
      this.bar = h("div", "bar");
      this.msg = h("div", "msg");
      this.btn = h("button", "primary", "Prüfen");
      this.btn.type = "button"; this.btn.disabled = true;
      this.btn.addEventListener("click", () => this.onPrimary());
      this.bar.appendChild(this.msg); this.bar.appendChild(this.btn);
      root.appendChild(this.bar);
    }
    sayText() { return this.task.say || this.task.q || ""; }
    ready(v) { this.btn.disabled = !v; }
    onPrimary() {
      if (this.state === "select") this.check();
      else if (this.state === "retry") { this.clearFeedback(); this.state = "select"; this.ready(false); this.onRetry(); }
      else if (this.state === "done") this.api.onDone({ correct: this.correct, mistakes: this.mistakes });
    }
    onRetry() {}
    feedback(ok, text) {
      this.bar.classList.remove("ok", "bad");
      this.bar.classList.add(ok ? "ok" : "bad");
      this.msg.innerHTML = text;
      LK.sfx[ok ? "ok" : "bad"]();
      if (!ok) { this.root.classList.add("shake"); setTimeout(() => this.root.classList.remove("shake"), 500); }
    }
    clearFeedback() { this.bar.classList.remove("ok", "bad"); this.msg.innerHTML = ""; }
    /* Called by subclasses after a complete check. */
    finish(ok, solutionText) {
      if (ok) {
        this.correct = true; this.state = "done";
        this.feedback(true, this.mistakes ? "Jetzt stimmt es!" : LK.praise());
        this.btn.textContent = "Weiter"; this.ready(true);
        this.api.onCorrect(this.mistakes === 0);
      } else {
        this.mistakes++;
        if (this.mistakes < 2) {
          this.state = "retry";
          this.feedback(false, "Noch nicht. " + (this.task.hint ? "<span class='hint'>Tipp: " + esc(this.task.hint) + "</span>" : "Versuch es noch einmal."));
          this.btn.textContent = "Nochmal"; this.ready(true);
          if (this.task.hint) this.api.speak("Tipp: " + speakify(this.task.hint));
        } else {
          this.correct = false; this.state = "done";
          this.feedback(false, "Die Lösung: <b>" + solutionText + "</b>" + (this.task.explain ? "<br>" + esc(this.task.explain) : ""));
          this.reveal();
          this.btn.textContent = "Weiter"; this.ready(true);
        }
      }
    }
    reveal() {}
    /* Sub-step feedback for multi-part tasks: a wrong step counts as a
       mistake but the task continues. */
    stepWrong(hint) {
      this.mistakes++;
      this.feedback(false, hint || "Das passt nicht. Versuch es nochmal.");
      setTimeout(() => this.clearFeedback(), 1800);
    }
    stepOk() { LK.sfx.tick(); }
    stepsDone() {
      this.correct = true;
      this.state = "done"; this.bar.hidden = false;
      this.feedback(true, this.mistakes ? "Geschafft!" : LK.praise());
      this.btn.textContent = "Weiter"; this.ready(true);
      this.api.onCorrect(this.mistakes === 0);
    }
  }

  /* ------------------------------------------------------------ choice */
  class Choice extends Runner {
    constructor(t, r, a) {
      super(t, r, a);
      this.sel = null;
      this.opts = h("div", "options");
      t.options.forEach((o, i) => {
        const b = h("button", "opt", o.t);
        b.type = "button";
        b.addEventListener("click", () => {
          if (this.state !== "select") return;
          LK.sfx.tap();
          this.opts.querySelectorAll(".opt").forEach((x) => x.classList.remove("sel"));
          b.classList.add("sel"); this.sel = i; this.ready(true);
        });
        this.opts.appendChild(b);
      });
      this.body.appendChild(this.opts);
    }
    check() {
      const o = this.task.options[this.sel];
      const b = this.opts.children[this.sel];
      b.classList.add(o.ok ? "right" : "wrong");
      if (!o.ok) b.disabled = true;
      this.finish(!!o.ok, this.task.options.find((x) => x.ok).t);
    }
    onRetry() { this.sel = null; this.opts.querySelectorAll(".opt").forEach((x) => x.classList.remove("sel")); }
    reveal() { this.task.options.forEach((o, i) => { if (o.ok) this.opts.children[i].classList.add("right"); }); }
  }

  /* ------------------------------------------------------------- input */
  class Input extends Runner {
    constructor(t, r, a) {
      super(t, r, a);
      this.val = "";
      this.disp = h("div", "answerbox", `<span class="v"></span><span class="unit">${esc(t.unit || "")}</span>`);
      this.body.appendChild(this.disp);
      this.body.appendChild(Keypad((k) => this.key(k)));
      this.render();
    }
    key(k) {
      if (this.state === "done") return;
      if (this.state === "retry") { this.clearFeedback(); this.state = "select"; this.val = ""; }
      if (k === "OK") { if (this.val) this.check(); return; }
      if (k === "⌫") this.val = this.val.slice(0, -1);
      else if (this.val.length < 7) this.val += k;
      this.render();
    }
    render() { this.disp.querySelector(".v").textContent = this.val ? fmt(Number(this.val)) : ""; this.disp.classList.toggle("empty", !this.val); this.ready(!!this.val); }
    check() { this.finish(Number(this.val) === this.task.answer, fmt(this.task.answer) + (this.task.unit ? " " + this.task.unit : "")); }
    onRetry() { this.val = ""; this.render(); }
    reveal() { this.val = String(this.task.answer); this.render(); }
  }

  /* --------------------------------------------------------- highlight */
  class Highlight extends Runner {
    constructor(t, r, a) {
      super(t, r, a);
      this.sel = null;
      this.row = h("div", "hl-row");
      t.parts.forEach((p, i) => {
        const isOp = p.length === 1 && "+−·:".includes(p);
        const b = h(isOp ? "span" : "button", isOp ? "hl-op" : "hl-part", esc(p));
        if (!isOp) {
          b.type = "button";
          b.addEventListener("click", () => {
            if (this.state !== "select") return;
            LK.sfx.tap();
            this.row.querySelectorAll(".hl-part").forEach((x) => x.classList.remove("sel"));
            b.classList.add("sel"); this.sel = i; this.ready(true);
          });
        }
        this.row.appendChild(b);
      });
      this.body.appendChild(this.row);
    }
    sayText() { return this.task.q + " " + this.task.parts.join(" "); }
    check() {
      const ok = this.sel === this.task.correct;
      const el = [...this.row.children][this.sel];
      el.classList.add(ok ? "right" : "wrong");
      this.finish(ok, esc(this.task.parts[this.task.correct]));
    }
    onRetry() { this.sel = null; this.row.querySelectorAll(".hl-part").forEach((x) => x.classList.remove("sel")); }
    reveal() { [...this.row.children][this.task.correct].classList.add("right"); }
  }

  /* -------------------------------------------------------------- wall */
  class Wall extends Runner {
    constructor(t, r, a) {
      super(t, r, a);
      const [x, y, z] = t.base;
      this.values = { b0: x, b1: y, b2: z, m0: x * y, m1: y * z, t0: x * y * y * z };
      const order = ["b0", "b1", "b2", "m0", "m1", "t0"];
      this.todo = order.filter((k) => t.hidden.includes(k));
      this.cells = {};
      const wall = h("div", "wall");
      [["t0"], ["m0", "m1"], ["b0", "b1", "b2"]].forEach((row) => {
        const re = h("div", "row");
        row.forEach((k) => {
          const c = h("div", "cell", t.hidden.includes(k) ? "" : fmt(this.values[k]));
          if (t.hidden.includes(k)) c.classList.add("hidden");
          this.cells[k] = c; re.appendChild(c);
        });
        wall.appendChild(re);
      });
      this.body.appendChild(wall);
      this.val = "";
      this.body.appendChild(Keypad((k) => this.key(k)));
      this.bar.hidden = true;
      this.next();
    }
    next() {
      this.cur = this.todo.shift();
      if (!this.cur) { this.stepsDone(); return; }
      Object.values(this.cells).forEach((c) => c.classList.remove("active"));
      this.cells[this.cur].classList.add("active");
      this.val = ""; this.render();
    }
    key(k) {
      if (this.state === "done") return;
      if (k === "OK") { if (this.val) this.check(); return; }
      if (k === "⌫") this.val = this.val.slice(0, -1);
      else if (this.val.length < 5) this.val += k;
      this.render();
    }
    render() { this.cells[this.cur].textContent = this.val ? fmt(Number(this.val)) : ""; }
    check() {
      if (Number(this.val) === this.values[this.cur]) {
        this.cells[this.cur].classList.remove("hidden", "active"); this.cells[this.cur].classList.add("solved");
        this.stepOk(); this.next();
      } else {
        this.tries = (this.tries || 0) + 1;
        if (this.tries >= 2) {
          this.cells[this.cur].textContent = fmt(this.values[this.cur]);
          this.cells[this.cur].classList.remove("hidden", "active"); this.cells[this.cur].classList.add("revealed");
          this.stepWrong("Hier gehört " + fmt(this.values[this.cur]) + " hin."); this.tries = 0; this.next();
        } else this.stepWrong(this.cur.startsWith("b") ? "Rechne rückwärts: Was mal dem Nachbarn ergibt den Stein darüber?" : "Die beiden Steine darunter malnehmen.");
      }
    }
    onPrimary() { if (this.state === "done") this.api.onDone({ correct: true, mistakes: this.mistakes }); }
  }

  /* ------------------------------------------------------------- match */
  class Match extends Runner {
    constructor(t, r, a) {
      super(t, r, a);
      this.left = null; this.done = 0;
      const wrap = h("div", "match");
      const L = h("div", "col"), R = h("div", "col");
      shuffle(t.pairs.map((p, i) => ({ t: p[0], i }))).forEach((o) => L.appendChild(this.mk(o, "l")));
      shuffle(t.pairs.map((p, i) => ({ t: p[1], i }))).forEach((o) => R.appendChild(this.mk(o, "r")));
      wrap.appendChild(L); wrap.appendChild(R); this.body.appendChild(wrap);
      this.bar.hidden = true;
    }
    mk(o, side) {
      const b = h("button", "opt small", esc(o.t)); b.type = "button"; b.dataset.i = o.i; b.dataset.side = side;
      b.addEventListener("click", () => this.tap(b)); return b;
    }
    tap(b) {
      if (this.state === "done" || b.classList.contains("right")) return;
      LK.sfx.tap();
      if (!this.left || this.left.dataset.side === b.dataset.side) {
        if (this.left) this.left.classList.remove("sel");
        this.left = b; b.classList.add("sel"); return;
      }
      if (this.left.dataset.i === b.dataset.i) {
        this.left.classList.remove("sel"); this.left.classList.add("right"); b.classList.add("right");
        this.left = null; this.done++; this.stepOk();
        if (this.done === this.task.pairs.length) this.stepsDone();
      } else {
        b.classList.add("wrong"); this.left.classList.add("wrong");
        const l = this.left; setTimeout(() => { b.classList.remove("wrong"); l.classList.remove("wrong", "sel"); }, 600);
        this.left = null; this.stepWrong("Das gehört nicht zusammen.");
      }
    }
    onPrimary() { if (this.state === "done") this.api.onDone({ correct: true, mistakes: this.mistakes }); }
  }

  /* -------------------------------------------------------- schriftlich */
  class Schriftlich extends Runner {
    constructor(t, r, a) {
      t.q = t.q || `Rechne schriftlich: <b>${fmt(t.a)} · ${fmt(t.b)}</b>`;
      super(t, r, a);
      this.a = t.a; this.b = t.b;
      this.ad = String(t.a).split("").map(Number); this.bd = String(t.b).split("").map(Number);
      this.W = this.ad.length + 1 + this.bd.length;
      this.rows = this.bd.map(() => []);     // partial product digits (strings), right-aligned
      this.result = [];
      this.grid = h("div", "sgrid"); this.grid.style.setProperty("--w", this.W);
      this.body.appendChild(this.grid);
      this.prompt = h("div", "sprompt"); this.body.appendChild(this.prompt);
      this.disp = h("div", "answerbox small", `<span class="v"></span>`); this.body.appendChild(this.disp);
      this.body.appendChild(Keypad((k) => this.key(k)));
      this.val = ""; this.bar.hidden = true;
      this.steps = this.buildSteps();
      this.si = 0;
      this.carry = 0;
      this.draw(); this.showStep();
    }
    sayText() { return `Rechne schriftlich: ${this.a} mal ${this.b}.`; }
    buildSteps() {
      const s = [];
      if (this.task.ueberschlag) s.push({ kind: "ue" });
      this.bd.forEach((bdig, ri) => {
        if (bdig === 0) { this.rows[ri] = ["0"]; return; }  // a zero digit needs no steps
        for (let ai = this.ad.length - 1; ai >= 0; ai--) s.push({ kind: "mul", ri, ai, bdig, adig: this.ad[ai], last: ai === 0 });
      });
      if (this.bd.length > 1) {
        const cols = this.W; // addition columns from the right
        for (let c = 0; c < cols; c++) s.push({ kind: "add", c });
      }
      return s;
    }
    draw() {
      this.grid.innerHTML = "";
      const line = (cells) => { const r = h("div", "srow"); cells.forEach((c) => r.appendChild(h("span", "sc" + (c.cls ? " " + c.cls : ""), c.t))); this.grid.appendChild(r); };
      const pad = (digits, rightCol) => { const cells = Array(this.W).fill(null).map(() => ({ t: "" })); digits.forEach((d, i) => { cells[rightCol - (digits.length - 1 - i)] = { t: d, cls: "d" }; }); return cells; };
      const top = Array(this.W).fill(null).map(() => ({ t: "" }));
      this.ad.forEach((d, i) => top[i] = { t: d, cls: "d" }); top[this.ad.length] = { t: "·", cls: "op" };
      this.bd.forEach((d, i) => top[this.ad.length + 1 + i] = { t: d, cls: "d" + (this.curB === i ? " cur" : "") });
      line(top);
      this.grid.appendChild(h("div", "sline"));
      this.rows.forEach((row, ri) => { const cells = pad(row, this.W - this.bd.length + ri); if (this.curRow === ri && this.state !== "done") cells[this.W - this.bd.length + ri - row.length] = { t: "", cls: "d active" }; line(cells); });
      if (this.bd.length > 1) {
        this.grid.appendChild(h("div", "sline"));
        const cells = pad(this.result, this.W - 1);
        if (this.curAdd != null && this.state !== "done") cells[this.W - 1 - this.result.length] = { t: "", cls: "d active" };
        line(cells);
      }
      if (this.carry) this.grid.appendChild(h("div", "scarry", `merke <b>${this.carry}</b>`));
    }
    showStep() {
      const st = this.steps[this.si];
      this.val = ""; this.renderVal();
      if (!st) { this.curRow = null; this.curAdd = null; this.curB = null; this.draw(); this.prompt.innerHTML = `<b>${fmt(this.a)} · ${fmt(this.b)} = ${fmt(this.a * this.b)}</b>`; this.stepsDone(); return; }
      if (st.kind === "ue") {
        this.curRow = null;
        const ra = Math.round(this.a / 100) * 100 || Math.round(this.a / 10) * 10, rb = Math.round(this.b / 10) * 10;
        this.prompt.innerHTML = `Überschlag: <b>${fmt(ra)} · ${fmt(rb)} = ?</b>`;
        this.expected = ra * rb; this.say(`Überschlag: ${ra} mal ${rb}.`);
      } else if (st.kind === "mul") {
        this.curRow = st.ri; this.curAdd = null; this.curB = st.ri;
        const plus = this.carry ? ` + ${this.carry}` : "";
        this.prompt.innerHTML = `<b>${st.bdig} · ${st.adig}${plus} = ?</b>`;
        this.expected = st.bdig * st.adig + this.carry;
        this.say(`${st.bdig} mal ${st.adig}${this.carry ? " plus " + this.carry : ""}`);
      } else {
        this.curRow = null; this.curB = null; this.curAdd = st.c;
        const digits = this.colDigits(st.c);
        const parts = [...digits]; if (this.carry) parts.push(this.carry);
        this.expected = parts.reduce((x, y) => x + y, 0);
        if (parts.length === 0 || (parts.length === 1 && !this.carry && digits.length === 1)) {
          // nothing to add in this column: fill automatically
          this.result.unshift(String(digits[0] ?? ""));
          if (this.result[0] === "") this.result.shift();
          this.si++; this.draw(); this.showStep(); return;
        }
        this.prompt.innerHTML = `Spalte: <b>${parts.join(" + ")} = ?</b>`;
        this.say(`Spalte: ${parts.join(" plus ")}`);
      }
      this.draw();
    }
    colDigits(c) {
      // digits of all partial rows in column (counted from the right, 0 = rightmost)
      const out = [];
      this.rows.forEach((row, ri) => { const rightCol = this.W - this.bd.length + ri; const idx = row.length - 1 - (rightCol - (this.W - 1 - c)); if (idx >= 0 && idx < row.length) out.push(Number(row[idx])); });
      return out;
    }
    say(t) { if (this.api.autoSpeak) this.api.speak(t); }
    renderVal() { this.disp.querySelector(".v").textContent = this.val; this.disp.classList.toggle("empty", !this.val); }
    key(k) {
      if (this.state === "done") return;
      if (k === "OK") { if (this.val) this.check(); return; }
      if (k === "⌫") this.val = this.val.slice(0, -1);
      else if (this.val.length < 6) this.val += k;
      this.renderVal();
    }
    check() {
      const st = this.steps[this.si];
      if (Number(this.val) !== this.expected) {
        this.tries = (this.tries || 0) + 1;
        if (this.tries >= 2) { this.stepWrong(`Richtig wäre ${this.expected}. Weiter geht's.`); this.tries = 0; this.apply(st); }
        else { this.stepWrong(st.kind === "mul" ? "Rechne nochmal: " + this.prompt.textContent.replace(" = ?", "") : "Zähle die Spalte nochmal zusammen."); return; }
      } else { this.tries = 0; this.stepOk(); this.apply(st); }
      this.si++; this.showStep();
    }
    apply(st) {
      const v = this.expected;
      if (st.kind === "ue") return;
      if (st.kind === "mul") {
        if (st.last) {
          String(v).split("").reverse().forEach((d) => this.rows[st.ri].unshift(d)); this.carry = 0;
          // strip leading zeros only once the row is complete
          while (this.rows[st.ri].length > 1 && this.rows[st.ri][0] === "0") this.rows[st.ri].shift();
        } else { this.rows[st.ri].unshift(String(v % 10)); this.carry = Math.floor(v / 10); }
      } else {
        const lastCol = st.c === this.W - 1 || this.colDigits(st.c + 1).length === 0;
        if (lastCol) { String(v).split("").reverse().forEach((d) => this.result.unshift(d)); this.carry = 0; this.si = this.steps.length - 1; }
        else { this.result.unshift(String(v % 10)); this.carry = Math.floor(v / 10); }
      }
    }
    onPrimary() { if (this.state === "done") this.api.onDone({ correct: true, mistakes: this.mistakes }); }
  }

  const types = { choice: Choice, input: Input, highlight: Highlight, wall: Wall, match: Match, schriftlich: Schriftlich };
  LK.runTask = (task, root, api) => new types[task.type](task, root, api);
  LK.praise = () => LK.pick(["Richtig!", "Super!", "Genau so!", "Stark!", "Klasse!", "Treffer!", "Jawoll!"]);
})(window.LK);
