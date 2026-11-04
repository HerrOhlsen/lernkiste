/* Small helpers shared by content generators and the engine. */
window.LK = window.LK || {};
(function (LK) {
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  /* Pick n distinct values from arr. */
  const sample = (arr, n) => shuffle(arr).slice(0, n);
  /* Wrong answers close to the right one, all distinct and non-negative. */
  const distractors = (answer, n, spread) => {
    const out = new Set();
    let guard = 0;
    while (out.size < n && guard++ < 200) {
      const d = rnd(1, spread || Math.max(3, Math.round(answer * 0.3)));
      const v = Math.random() < 0.5 ? answer - d : answer + d;
      if (v >= 0 && v !== answer) out.add(v);
    }
    return [...out];
  };
  const fmt = (n) => n.toLocaleString("de-DE");
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  /* Build a multiple-choice task where every option is a number. */
  const numChoice = (q, answer, extra) => ({
    type: "choice",
    q,
    options: shuffle([{ t: fmt(answer), ok: true }, ...distractors(answer, 3).map((v) => ({ t: fmt(v) }))]),
    ...(extra || {}),
  });
  /* Multiple-choice from plain strings; the first one is correct. */
  const strChoice = (q, correct, wrong, extra) => ({
    type: "choice",
    q,
    options: shuffle([{ t: correct, ok: true }, ...wrong.map((t) => ({ t }))]),
    ...(extra || {}),
  });
  Object.assign(LK, { rnd, pick, shuffle, sample, distractors, fmt, esc, numChoice, strChoice });
})(window.LK);
