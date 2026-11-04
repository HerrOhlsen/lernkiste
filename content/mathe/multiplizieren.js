/* Mathe Klasse 5, Kapitel "Natürliche Zahlen multiplizieren und dividieren"
   (Cornelsen). Jede Lektion liefert mit make() frische, zufällige Aufgaben
   mit kleinen Zahlen. Die intro.text-Felder sind die Sprechtexte für die
   Audio-Erklärungen (tools/make_audio.py). */
(function (LK) {
  const { rnd, pick, shuffle, sample, fmt, numChoice, strChoice } = LK;
  const m = (a, b) => `${fmt(a)} · ${fmt(b)}`;
  const d = (a, b) => `${fmt(a)} : ${fmt(b)}`;

  /* ------------------------------------------------------------ Einheit 1 */
  const einheit1 = {
    id: "woerter",
    titel: "Die Mal-Wörter",
    emoji: "🧩",
    lessons: [
      {
        id: "faktor-produkt",
        titel: "Faktor und Produkt",
        intro: {
          html: `<div class="formel">3 · 4 = 12</div>
                 <div class="formel-labels"><span>Faktor</span><span>Faktor</span><span>Produkt</span></div>`,
          text: "Beim Malrechnen haben die Zahlen Namen. Die Zahlen, die du malnimmst, heißen Faktoren. Bei 3 mal 4 sind 3 und 4 die Faktoren. Das Ergebnis heißt Produkt. 3 mal 4 ist 12, also ist 12 das Produkt. Merk dir: Faktor mal Faktor gleich Produkt. Und noch etwas: Eine Mal-Aufgabe ist nur eine Abkürzung für Plus. 4 plus 4 plus 4 ist dasselbe wie 3 mal 4, denn die 4 kommt dreimal vor.",
        },
        make() {
          const t = [];
          let a = rnd(2, 9), b = rnd(2, 9);
          t.push(strChoice(`Bei <b>${m(a, b)} = ${a * b}</b>: Wie heißt die Zahl <b>${a}</b>?`, "Faktor", ["Produkt", "Summe"], { hint: "Die Zahlen, die du malnimmst, heißen Faktoren." }));
          a = rnd(2, 9); b = rnd(2, 9);
          t.push(strChoice(`Bei <b>${m(a, b)} = ${a * b}</b>: Wie heißt die Zahl <b>${a * b}</b>?`, "Produkt", ["Faktor", "Differenz"], { hint: "Das Ergebnis beim Malrechnen heißt Produkt." }));
          a = rnd(3, 5); b = rnd(2, 6);
          const plus = Array(a).fill(b).join(" + ");
          t.push(strChoice(`Schreibe als Mal-Aufgabe: <b>${plus}</b>`, m(a, b), [m(b, b), `${a} + ${b}`], { hint: `Die ${b} kommt ${a}-mal vor.` }));
          a = rnd(2, 9); b = rnd(2, 9);
          t.push({ type: "input", q: `Berechne das Produkt von <b>${a}</b> und <b>${b}</b>.`, answer: a * b, hint: `Produkt heißt: malnehmen. Also ${m(a, b)}.` });
          a = rnd(2, 6); b = rnd(2, 5);
          t.push(strChoice(`<b>${m(a, b)}</b> bedeutet dasselbe wie …`, Array(a).fill(b).join(" + "), [Array(b).fill(a + 1).join(" + "), `${a} + ${b}`], { hint: `${a} mal ${b} heißt: ${a}-mal die ${b} zusammenzählen.` }));
          a = rnd(2, 9); b = rnd(2, 9);
          t.push({ type: "input", q: `Wie viele Punkte sind das?<div class="dots">${dots(a, b)}</div>`, answer: a * b, hint: `${a} Reihen mit je ${b} Punkten: ${m(a, b)}.` });
          t.push(strChoice(`Wie heißt das Ergebnis beim Malrechnen?`, "Produkt", ["Summe", "Quotient", "Faktor"]));
          return t;
        },
      },
      {
        id: "geteilt-woerter",
        titel: "Geteilt-Wörter",
        intro: {
          html: `<div class="formel">12 : 3 = 4</div>
                 <div class="formel-labels"><span>Dividend</span><span>Divisor</span><span>Quotient</span></div>`,
          text: "Auch beim Teilen haben die Zahlen Namen. Die Zahl, die geteilt wird, heißt Dividend. Die Zahl, durch die geteilt wird, heißt Divisor. Das Ergebnis heißt Quotient. Bei 12 geteilt durch 3 gleich 4 ist 12 der Dividend, 3 der Divisor und 4 der Quotient. Teilen ist die Umkehrung vom Malnehmen. Wenn du 12 geteilt durch 3 rechnest, fragst du dich: 3 mal was ist 12? Und so kannst du jede Geteilt-Aufgabe mit einer Mal-Aufgabe prüfen.",
        },
        make() {
          const t = [];
          let a = rnd(2, 9), b = rnd(2, 9), p = a * b;
          t.push(strChoice(`Bei <b>${d(p, b)} = ${a}</b>: Wie heißt die Zahl <b>${p}</b>?`, "Dividend", ["Divisor", "Quotient"], { hint: "Die Zahl, die geteilt wird, heißt Dividend." }));
          a = rnd(2, 9); b = rnd(2, 9); p = a * b;
          t.push(strChoice(`Bei <b>${d(p, b)} = ${a}</b>: Wie heißt die Zahl <b>${b}</b>?`, "Divisor", ["Dividend", "Quotient"], { hint: "Die Zahl, durch die geteilt wird, heißt Divisor." }));
          a = rnd(2, 9); b = rnd(2, 9); p = a * b;
          t.push(strChoice(`Bei <b>${d(p, b)} = ${a}</b>: Wie heißt die Zahl <b>${a}</b>?`, "Quotient", ["Dividend", "Divisor"], { hint: "Das Ergebnis beim Teilen heißt Quotient." }));
          a = rnd(2, 9); b = rnd(2, 9); p = a * b;
          t.push(strChoice(`Welche Mal-Aufgabe ist die Probe für <b>${d(p, b)} = ${a}</b>?`, `${m(a, b)} = ${p}`, [`${m(p, b)} = ${p * b}`, `${a} + ${b} = ${a + b}`], { hint: "Ergebnis mal Divisor muss den Dividenden ergeben." }));
          a = rnd(2, 9); b = rnd(2, 9); p = a * b;
          t.push({ type: "input", q: `Berechne den Quotienten von <b>${p}</b> und <b>${b}</b>.`, answer: a, hint: `Quotient heißt: teilen. Also ${d(p, b)}. Frag dich: ${b} mal was ist ${p}?` });
          a = rnd(2, 9); b = rnd(2, 9); p = a * b;
          t.push({ type: "input", q: `<b>${d(p, b)} = ?</b>`, answer: a, hint: `${b} mal was ist ${p}?` });
          t.push(strChoice(`Wie heißt das Ergebnis beim Teilen?`, "Quotient", ["Produkt", "Divisor", "Summe"]));
          return t;
        },
      },
      {
        id: "woerter-mix",
        titel: "Wörter-Mix",
        intro: {
          html: `<div class="formel small">Faktor · Faktor = Produkt</div><div class="formel small">Dividend : Divisor = Quotient</div>`,
          text: "Jetzt mischen wir alles. Beim Malrechnen: Faktor mal Faktor gleich Produkt. Beim Teilen: Dividend geteilt durch Divisor gleich Quotient. Ein Tipp zum Merken: Quotient und Produkt sind immer die Ergebnisse. Divisor und Dividend fangen beide mit D an wie Dividieren, das heißt Teilen. Faktor gehört zum Malnehmen.",
        },
        make() {
          const t = [];
          let a = rnd(2, 9), b = rnd(2, 9);
          t.push({ type: "match", q: `Ordne die Fachbegriffe zu: <b>${m(a, b)} = ${a * b}</b>`, pairs: [["1. Faktor", String(a)], ["2. Faktor", String(b)], ["Produkt", String(a * b)]] });
          a = rnd(2, 9); b = rnd(2, 9);
          t.push({ type: "match", q: `Ordne die Fachbegriffe zu: <b>${d(a * b, b)} = ${a}</b>`, pairs: [["Dividend", String(a * b)], ["Divisor", String(b)], ["Quotient", String(a)]] });
          t.push(strChoice(`Welche Wörter gehören zum <b>Teilen</b>?`, "Dividend, Divisor, Quotient", ["Faktor, Faktor, Produkt", "Summand, Summand, Summe"]));
          a = rnd(2, 9); b = rnd(2, 9);
          t.push({ type: "input", q: `Das Produkt von <b>${a}</b> und <b>${b}</b>?`, answer: a * b });
          a = rnd(2, 9); b = rnd(2, 9);
          t.push({ type: "input", q: `Der Quotient von <b>${a * b}</b> und <b>${a}</b>?`, answer: b, hint: `${d(a * b, a)}` });
          a = rnd(2, 9); b = rnd(2, 9);
          t.push(strChoice(`Der 1. Faktor ist ${a}, der 2. Faktor ist ${b}. Wie groß ist das Produkt?`, String(a * b), [String(a + b), String(a * b + a)]));
          a = rnd(2, 9); b = rnd(2, 9);
          t.push(strChoice(`Der Dividend ist ${a * b}, der Divisor ist ${b}. Wie groß ist der Quotient?`, String(a), [String(a * b - b), String(a + 1)]));
          return t;
        },
      },
    ],
  };

  function dots(rows, cols) {
    let s = "";
    for (let r = 0; r < rows; r++) {
      s += `<div class="dotrow">${"<i></i>".repeat(cols)}</div>`;
    }
    return s;
  }

  /* ------------------------------------------------------------ Einheit 2 */
  const einheit2 = {
    id: "mauern",
    titel: "Zahlenmauern",
    emoji: "🧱",
    lessons: [
      {
        id: "mauer-hoch",
        titel: "Mauer nach oben",
        intro: {
          html: `<div class="wall-demo"><div class="row"><span>24</span></div><div class="row"><span>6</span><span>4</span></div><div class="row"><span>3</span><span>2</span><span>2</span></div></div>`,
          text: "In einer Mal-Zahlenmauer werden immer zwei Steine, die nebeneinander liegen, malgenommen. Das Ergebnis steht im Stein darüber. Unten stehen 3, 2 und 2. 3 mal 2 ist 6, und 2 mal 2 ist 4. Darüber: 6 mal 4 ist 24. Die Spitze ist also 24. Du rechnest dich von unten nach oben.",
        },
        make() {
          const t = [];
          for (let i = 0; i < 6; i++) {
            const base = [rnd(1, i < 3 ? 4 : 5), rnd(1, i < 3 ? 4 : 5), rnd(1, i < 3 ? 4 : 5)];
            t.push({ type: "wall", base, hidden: i < 2 ? ["m0", "m1"] : ["m0", "m1", "t0"], q: "Fülle die Mauer. Nebeneinander wird malgenommen." });
          }
          return t;
        },
      },
      {
        id: "mauer-luecke",
        titel: "Mauer mit Lücke",
        intro: {
          html: `<div class="wall-demo"><div class="row"><span>?</span></div><div class="row"><span>12</span><span>?</span></div><div class="row"><span>3</span><span class="gap">?</span><span>5</span></div></div>`,
          text: "Manchmal fehlt ein Stein unten. Dann rechnest du rückwärts, also mit Teilen. Wenn über der 3 und dem leeren Stein eine 12 steht, fragst du dich: 3 mal was ist 12? Das ist 4. Jetzt kennst du den Stein und kannst den Rest wieder von unten nach oben rechnen.",
        },
        make() {
          const t = [];
          for (let i = 0; i < 6; i++) {
            const base = [rnd(2, 5), rnd(2, 5), rnd(2, 5)];
            const gapAt = pick([0, 1, 2]);
            const hidden = [`b${gapAt}`, "t0"];
            if (gapAt === 0) hidden.push("m1"); else if (gapAt === 2) hidden.push("m0");
            t.push({ type: "wall", base, hidden, q: "Ein Stein unten fehlt. Rechne rückwärts mit Geteilt." });
          }
          return t;
        },
      },
    ],
  };

  /* ------------------------------------------------------------ Einheit 3 */
  const einheit3 = {
    id: "vorrang",
    titel: "Punkt vor Strich",
    emoji: "⚡",
    lessons: [
      {
        id: "was-zuerst",
        titel: "Was rechnest du zuerst?",
        intro: {
          html: `<div class="formel">3 + <mark>4 · 2</mark> = 11</div><div class="formel">(<mark>3 + 4</mark>) · 2 = 14</div>`,
          text: "Es gibt zwei Regeln, in welcher Reihenfolge du rechnest. Erste Regel: Klammern zuerst. Was in der Klammer steht, rechnest du immer als Erstes. Zweite Regel: Punkt vor Strich. Mal und Geteilt sind Punktrechnungen, Plus und Minus sind Strichrechnungen. Punktrechnung kommt vor Strichrechnung. Bei 3 plus 4 mal 2 rechnest du also zuerst 4 mal 2, das ist 8, und dann 3 plus 8 gleich 11. Steht aber eine Klammer um 3 plus 4, dann rechnest du die Klammer zuerst: 7 mal 2 gleich 14.",
        },
        make() {
          const t = [];
          for (let i = 0; i < 7; i++) {
            const a = rnd(2, 9), b = rnd(2, 9), c = rnd(2, 9);
            const op = pick(["·", ":"]);
            const bb = op === ":" ? b * c : b;
            const variant = i < 3 ? pick(["pre", "post"]) : pick(["pre", "post", "kl1", "kl2"]);
            if (variant === "pre") t.push({ type: "highlight", q: "Tippe auf das, was du <b>zuerst</b> rechnest.", parts: [`${a}`, "+", `${bb} ${op} ${c}`], correct: 2, hint: "Punkt vor Strich: Mal und Geteilt kommen zuerst." });
            else if (variant === "post") t.push({ type: "highlight", q: "Tippe auf das, was du <b>zuerst</b> rechnest.", parts: [`${bb} ${op} ${c}`, pick(["+", "−"]), `${a}`], correct: 0, hint: "Punkt vor Strich: Mal und Geteilt kommen zuerst." });
            else if (variant === "kl1") t.push({ type: "highlight", q: "Tippe auf das, was du <b>zuerst</b> rechnest.", parts: [`(${a} + ${b})`, "·", `${c}`], correct: 0, hint: "Klammern zuerst." });
            else t.push({ type: "highlight", q: "Tippe auf das, was du <b>zuerst</b> rechnest.", parts: [`${a}`, "·", `(${b} − ${Math.min(b - 1, c)})`], correct: 2, hint: "Klammern zuerst." });
          }
          return t;
        },
      },
      {
        id: "ausrechnen",
        titel: "Jetzt ausrechnen",
        intro: {
          html: `<div class="formel">20 − 2 · 5 = 20 − 10 = 10</div><div class="formel">12 : 3 + 1 = 4 + 1 = 5</div>`,
          text: "Jetzt rechnest du solche Aufgaben ganz aus. Immer in zwei Schritten: Erst die Punktrechnung oder die Klammer, dann den Rest. 20 minus 2 mal 5: Zuerst 2 mal 5 gleich 10. Dann 20 minus 10 gleich 10. Noch eins: 12 geteilt durch 3 plus 1. Zuerst 12 geteilt durch 3 gleich 4, dann 4 plus 1 gleich 5. Wenn du unsicher bist, schreib dir den ersten Schritt auf.",
        },
        make() {
          const t = [];
          for (let i = 0; i < 7; i++) {
            const a = rnd(2, 9), b = rnd(2, 9), c = rnd(2, 9);
            const v = i < 3 ? pick(["plus", "minus"]) : pick(["plus", "minus", "div", "kl"]);
            if (v === "plus") t.push({ type: "input", q: `<b>${a} + ${b} · ${c} = ?</b>`, answer: a + b * c, hint: `Zuerst ${b} · ${c} = ${b * c}, dann ${a} + ${b * c}.` });
            else if (v === "minus") { const big = rnd(b * c + 1, b * c + 20); t.push({ type: "input", q: `<b>${big} − ${b} · ${c} = ?</b>`, answer: big - b * c, hint: `Zuerst ${b} · ${c} = ${b * c}, dann ${big} − ${b * c}.` }); }
            else if (v === "div") t.push({ type: "input", q: `<b>${b * c} : ${c} + ${a} = ?</b>`, answer: b + a, hint: `Zuerst ${b * c} : ${c} = ${b}, dann ${b} + ${a}.` });
            else t.push({ type: "input", q: `<b>(${a} + ${b}) · ${c} = ?</b>`, answer: (a + b) * c, hint: `Klammer zuerst: ${a} + ${b} = ${a + b}, dann ${a + b} · ${c}.` });
          }
          return t;
        },
      },
      {
        id: "klammer-detektiv",
        titel: "Klammer-Detektiv",
        intro: {
          html: `<div class="formel">2 · 3 + 4 = 10</div><div class="formel">2 · (3 + 4) = 14</div>`,
          text: "Eine Klammer kann das Ergebnis komplett verändern. 2 mal 3 plus 4 ist 10, weil du erst 2 mal 3 rechnest. Aber 2 mal Klammer auf 3 plus 4 Klammer zu ist 14, weil du erst die Klammer rechnest: 3 plus 4 ist 7, und 2 mal 7 ist 14. Manchmal darfst du eine Klammer auch weglassen, nämlich wenn sie um eine Punktrechnung steht, die sowieso zuerst dran wäre.",
        },
        make() {
          const t = [];
          for (let i = 0; i < 7; i++) {
            const a = rnd(2, 6), b = rnd(2, 6), c = rnd(2, 6);
            const v = pick(["setze", "weg", "vergleich"]);
            if (v === "setze") {
              const target = a * (b + c);
              t.push(strChoice(`Setze die Klammer so, dass <b>${target}</b> herauskommt: <b>${a} · ${b} + ${c}</b>`, `${a} · (${b} + ${c})`, [`(${a} · ${b}) + ${c}`, `${a} · ${b} + (${c})`], { hint: `Ohne Klammer wäre es ${a * b + c}. Mit Klammer um ${b} + ${c} wird es ${target}.` }));
            } else if (v === "weg") {
              t.push(strChoice(`Welche Klammer kannst du weglassen, ohne dass sich das Ergebnis ändert?`, `(${a} · ${b}) + ${c}`, [`${a} · (${b} + ${c})`, `(${a} + ${b}) · ${c}`], { hint: "Punkt vor Strich gilt sowieso. Eine Klammer um Mal ist überflüssig." }));
            } else {
              t.push(strChoice(`Was ist größer?`, `${a} · (${b} + ${c}) = ${a * (b + c)}`, [`${a} · ${b} + ${c} = ${a * b + c}`], { hint: "Rechne beide aus. Mit Klammer wird mehr malgenommen." }));
            }
          }
          return t;
        },
      },
    ],
  };

  /* ------------------------------------------------------------ Einheit 4 */
  const einheit4 = {
    id: "tricks",
    titel: "Rechentricks",
    emoji: "🪄",
    lessons: [
      {
        id: "vertauschen",
        titel: "Vertauschen und Verbinden",
        intro: {
          html: `<div class="formel">4 · 7 · 25 = 4 · 25 · 7 = 100 · 7 = 700</div>`,
          text: "Beim Malnehmen darfst du die Zahlen vertauschen. 7 mal 3 ist dasselbe wie 3 mal 7. Das heißt Vertauschungsgesetz. Und du darfst dir aussuchen, welche zwei Zahlen du zuerst verbindest. Das heißt Verbindungsgesetz. Das nutzt du für Tricks: 4 mal 7 mal 25 sieht schwer aus. Aber 4 mal 25 ist 100, das ist super einfach. Also: 4 mal 25 mal 7 gleich 100 mal 7 gleich 700. Such immer das Paar, das 10, 100 oder eine glatte Zahl ergibt.",
        },
        make() {
          const t = [];
          const paare = [[2, 5], [4, 25], [5, 20], [2, 50], [4, 5], [25, 8]];
          let a = rnd(2, 9), b = rnd(2, 9);
          t.push(strChoice(`Welche Aufgabe hat das gleiche Ergebnis wie <b>${m(a, b)}</b>?`, m(b, a), [`${a} + ${b}`, m(a, b + 1)], { hint: "Vertauschungsgesetz: Beim Malnehmen darf man die Zahlen tauschen." }));
          for (let i = 0; i < 3; i++) {
            const [p, q] = pick(paare); const c = rnd(3, 9);
            const order = shuffle([p, c, q]);
            t.push(strChoice(`<b>${order.map(fmt).join(" · ")}</b><br>Welche zwei Zahlen rechnest du zuerst?`, `${fmt(p)} · ${fmt(q)} = ${fmt(p * q)}`, [`${fmt(p)} · ${fmt(c)} = ${fmt(p * c)}`, `${fmt(c)} · ${fmt(q)} = ${fmt(c * q)}`], { hint: `${p} · ${q} ergibt eine glatte Zahl.` }));
            t.push({ type: "input", q: `Und jetzt ganz: <b>${order.map(fmt).join(" · ")} = ?</b>`, answer: p * q * c, hint: `${fmt(p * q)} · ${c}` });
          }
          return t;
        },
      },
      {
        id: "zerlegen",
        titel: "Zerlegen beim Malnehmen",
        intro: {
          html: `<div class="formel">6 · 12 = 6 · 10 + 6 · 2</div><div class="formel">= 60 + 12 = 72</div>`,
          text: "Große Zahlen kannst du zerlegen. 6 mal 12 rechnest du so: Die 12 teilst du auf in 10 und 2. Dann rechnest du 6 mal 10, das ist 60, und 6 mal 2, das ist 12. Zusammen 72. Das klappt immer: Zerlege die große Zahl in Zehner und Einer, nimm beide Teile mal und zähle zusammen.",
        },
        make() {
          const t = [];
          for (let i = 0; i < 4; i++) {
            const a = rnd(3, 7), z = rnd(1, 3) * 10, e = rnd(1, 6);
            const b = z + e;
            t.push(strChoice(`Wie zerlegst du <b>${m(a, b)}</b> geschickt?`, `${m(a, z)} + ${m(a, e)}`, [`${m(a, z)} + ${e}`, `${a} + ${z} + ${e}`], { hint: `${b} = ${z} + ${e}.` }));
            t.push({ type: "input", q: `<b>${m(a, b)} = ?</b><div class="sub">${m(a, z)} + ${m(a, e)}</div>`, answer: a * b, hint: `${a * z} + ${a * e}` });
          }
          return t;
        },
      },
      {
        id: "geteilt-kopf",
        titel: "Zerlegen beim Teilen",
        intro: {
          html: `<div class="formel">96 : 6 = 60 : 6 + 36 : 6</div><div class="formel">= 10 + 6 = 16</div>`,
          text: "Auch beim Teilen hilft Zerlegen. 96 geteilt durch 6: Du suchst dir einen Teil, der leicht geht. 60 geteilt durch 6 ist 10. Dann bleiben 36 übrig, und 36 geteilt durch 6 ist 6. Zusammen 16. Such dir immer zuerst den glatten Zehner-Teil, der durch die Zahl geht.",
        },
        make() {
          const t = [];
          for (let i = 0; i < 4; i++) {
            const dv = rnd(3, 7), tens = 10, rest = rnd(2, 9);
            const total = dv * (tens + rest);
            t.push(strChoice(`Wie zerlegst du <b>${d(total, dv)}</b> geschickt?`, `${d(dv * tens, dv)} + ${d(dv * rest, dv)}`, [`${d(total, 10)} + ${d(total, rest)}`, `${total} − ${dv}`], { hint: `${dv * tens} geht glatt durch ${dv}: das sind 10.` }));
            t.push({ type: "input", q: `<b>${d(total, dv)} = ?</b><div class="sub">${d(dv * tens, dv)} + ${d(dv * rest, dv)}</div>`, answer: tens + rest, hint: `10 + ${rest}` });
          }
          return t;
        },
      },
      {
        id: "ausklammern",
        titel: "Ausklammern",
        intro: {
          html: `<div class="formel">7 · 13 + 7 · 7 = 7 · (13 + 7)</div><div class="formel">= 7 · 20 = 140</div>`,
          text: "Wenn in zwei Mal-Aufgaben dieselbe Zahl vorkommt, kannst du sie ausklammern. 7 mal 13 plus 7 mal 7: Beide Male kommt die 7 vor. Also schreibst du 7 mal Klammer auf 13 plus 7 Klammer zu. In der Klammer steht 20, und 7 mal 20 ist 140. So sparst du dir das schwere Rechnen. Das Ganze heißt Verteilungsgesetz.",
        },
        make() {
          const t = [];
          for (let i = 0; i < 4; i++) {
            const f = rnd(3, 9);
            const x = rnd(11, 17), y = 20 - x;
            const parts = shuffle([x, y]);
            t.push(strChoice(`<b>${m(f, parts[0])} + ${m(f, parts[1])}</b><br>Welche Zahl kannst du ausklammern?`, `${f} · (${parts[0]} + ${parts[1]})`, [`${parts[0]} · (${f} + ${parts[1]})`, `${f} + (${parts[0]} · ${parts[1]})`], { hint: `Die ${f} kommt in beiden Aufgaben vor.` }));
            t.push({ type: "input", q: `<b>${f} · (${parts[0]} + ${parts[1]}) = ?</b>`, answer: f * 20, hint: `In der Klammer steht 20. Also ${f} · 20.` });
          }
          return t;
        },
      },
    ],
  };

  /* ------------------------------------------------------------ Einheit 5 */
  const einheit5 = {
    id: "ueberschlag",
    titel: "Überschlag",
    emoji: "🎯",
    lessons: [
      {
        id: "runden",
        titel: "Runden",
        intro: {
          html: `<div class="formel">37 → 40</div><div class="formel">126 → 100</div><div class="formel">250 → 300</div>`,
          text: "Runden heißt: Du machst aus einer krummen Zahl eine glatte Zahl. Beim Runden auf Zehner guckst du auf die Einer. Ist die Einer-Ziffer 0, 1, 2, 3 oder 4, rundest du ab. Ist sie 5, 6, 7, 8 oder 9, rundest du auf. 37 wird zu 40. Beim Runden auf Hunderter guckst du auf die Zehner-Ziffer. 126 wird zu 100, denn die 2 ist klein. 250 wird zu 300, denn die 5 rundet auf.",
        },
        make() {
          const t = [];
          for (let i = 0; i < 4; i++) {
            const n = rnd(11, 99);
            t.push(numChoice(`Runde <b>${n}</b> auf Zehner.`, Math.round(n / 10) * 10, { hint: `Einer-Ziffer ${n % 10}: ${n % 10 >= 5 ? "aufrunden" : "abrunden"}.` }));
          }
          for (let i = 0; i < 4; i++) {
            const n = rnd(101, 999);
            t.push({ type: "input", q: `Runde <b>${n}</b> auf Hunderter.`, answer: Math.round(n / 100) * 100, hint: `Zehner-Ziffer ${Math.floor(n / 10) % 10}: ${Math.floor(n / 10) % 10 >= 5 ? "aufrunden" : "abrunden"}.` });
          }
          return t;
        },
      },
      {
        id: "ueberschlagen",
        titel: "Überschlagen",
        intro: {
          html: `<div class="formel">126 · 7 ≈ 100 · 7 = 700</div><div class="formel">43 · 19 ≈ 40 · 20 = 800</div>`,
          text: "Ein Überschlag ist eine ungefähre Rechnung. Du rundest die Zahlen und rechnest dann im Kopf. 126 mal 7: 126 rundest du auf 100, und 100 mal 7 ist 700. Das echte Ergebnis liegt also ungefähr bei 700. So merkst du, ob du dich beim genauen Rechnen vertan hast. Noch ein Trick: Guck auf die letzte Ziffer. Bei 43 mal 19 ist die letzte Ziffer 3 mal 9 gleich 27, also eine 7. Wenn dein Ergebnis hinten keine 7 hat, ist es falsch.",
        },
        make() {
          const t = [];
          for (let i = 0; i < 3; i++) {
            const a = rnd(101, 399), b = rnd(3, 9);
            const ra = Math.round(a / 100) * 100;
            t.push(numChoice(`Überschlag: <b>${m(a, b)} ≈ ?</b>`, ra * b, { hint: `${a} ≈ ${ra}, also ${m(ra, b)}.` }));
          }
          for (let i = 0; i < 2; i++) {
            const a = rnd(21, 89), b = rnd(11, 29);
            const ra = Math.round(a / 10) * 10, rb = Math.round(b / 10) * 10;
            t.push(strChoice(`Überschlag für <b>${m(a, b)}</b>: Welche Rechnung passt?`, `${m(ra, rb)} = ${fmt(ra * rb)}`, [`${m(a, rb)} = ${fmt(a * rb)}`, `${ra} + ${rb} = ${ra + rb}`], { hint: "Beide Zahlen auf Zehner runden." }));
          }
          for (let i = 0; i < 3; i++) {
            const a = rnd(12, 59), b = rnd(3, 9);
            const real = a * b;
            const wrong = real + pick([1, 2, 3, -1, -2]);
            const shown = pick([real, wrong]);
            const lastOk = shown % 10 === (a % 10 * b) % 10;
            t.push(strChoice(`Stimmt <b>${m(a, b)} = ${shown}</b>? Prüfe die letzte Ziffer: ${a % 10} · ${b} = ${a % 10 * b}.`, lastOk ? "Kann stimmen" : "Falsch, letzte Ziffer passt nicht", [lastOk ? "Falsch, letzte Ziffer passt nicht" : "Kann stimmen"], { hint: `Die letzte Ziffer müsste ${(a % 10 * b) % 10} sein.` }));
          }
          return t;
        },
      },
    ],
  };

  /* ------------------------------------------------------------ Einheit 6 */
  const einheit6 = {
    id: "schriftlich",
    titel: "Schriftlich multiplizieren",
    emoji: "✏️",
    lessons: [
      {
        id: "schriftlich-1",
        titel: "Mal einstellig",
        intro: {
          html: `<div class="formel mono">1 2 6 · 7<br>─────────<br>8 8 2</div>`,
          text: "Jetzt kommt das schriftliche Multiplizieren. Du rechnest Ziffer für Ziffer, immer von rechts nach links. 126 mal 7: Zuerst 7 mal 6, das ist 42. Die 2 schreibst du hin, die 4 merkst du dir. Dann 7 mal 2 ist 14, plus die gemerkte 4 ist 18. Die 8 schreibst du hin, die 1 merkst du dir. Dann 7 mal 1 ist 7, plus 1 ist 8. Die 8 schreibst du hin. Ergebnis: 882. Die App führt dich Schritt für Schritt durch, du musst dir nichts merken, das macht sie für dich.",
        },
        make() {
          const t = [];
          for (let i = 0; i < 4; i++) {
            const a = i < 2 ? rnd(12, 49) : rnd(102, 399);
            const b = rnd(2, 7);
            t.push({ type: "schriftlich", a, b });
          }
          return t;
        },
      },
      {
        id: "schriftlich-2",
        titel: "Mal zweistellig",
        intro: {
          html: `<div class="formel mono">2 3 · 1 4<br>─────────<br>2 3<br>&nbsp;&nbsp;9 2<br>─────────<br>3 2 2</div>`,
          text: "Wenn du mit einer zweistelligen Zahl malnimmst, rechnest du zwei Zeilen. 23 mal 14: Zuerst 23 mal 1, das ist die Zehner-Ziffer. Das ergibt 23. Dann 23 mal 4, die Einer-Ziffer. Das ergibt 92. Die zweite Zeile rückt eine Stelle nach rechts. Zum Schluss zählst du beide Zeilen zusammen: 230 plus 92 ist 322. Die App macht das mit dir Spalte für Spalte.",
        },
        make() {
          const t = [];
          for (let i = 0; i < 3; i++) {
            const a = rnd(12, 49), b = rnd(12, 24);
            t.push({ type: "schriftlich", a, b });
          }
          return t;
        },
      },
      {
        id: "schriftlich-3",
        titel: "Profi-Mix",
        intro: {
          html: `<div class="formel mono">1 2 6 · 3 7</div>`,
          text: "Jetzt wie im Mathebuch: Dreistellige Zahlen mal zweistellige Zahlen. Das sind dieselben Schritte wie vorher, nur ein bisschen mehr davon. Mach vorher immer einen Überschlag, dann merkst du am Ende, ob dein Ergebnis passt.",
        },
        make() {
          const t = [];
          for (let i = 0; i < 3; i++) {
            const a = rnd(102, 299), b = rnd(12, 39);
            t.push({ type: "schriftlich", a, b, ueberschlag: true });
          }
          return t;
        },
      },
    ],
  };

  /* ------------------------------------------------------------ Einheit 7 */
  const einheit7 = {
    id: "sachaufgaben",
    titel: "Sachaufgaben",
    emoji: "🚌",
    lessons: [
      {
        id: "klassenfahrt",
        titel: "Klassenfahrt",
        intro: {
          html: `<div class="formel small">25 Kinder · 3 € = 75 €</div>`,
          text: "Bei einer Sachaufgabe steckt die Rechnung in einer Geschichte. Du suchst zuerst die Zahlen und fragst dich: Muss ich malnehmen oder teilen? Wenn jeder gleich viel bezahlt und du das Ganze wissen willst, nimmst du mal. Wenn du etwas gerecht aufteilst, teilst du. Lies die Frage am Ende genau, da steht, was du ausrechnen sollst.",
        },
        make() {
          const t = [];
          const stories = [
            () => { const k = rnd(20, 30), p = rnd(2, 9); return { q: `${k} Kinder fahren an die Nordsee. Der Eintritt ins Museum kostet ${p} € pro Kind. Wie viel kostet es für alle?`, calc: m(k, p), wrong: [`${k} + ${p}`, d(k, p)], answer: k * p, unit: "€" }; },
            () => { const n = rnd(3, 6), p = rnd(10, 30) * 2; return { q: `Eine Nacht in der Jugendherberge kostet ${p} €. Die Klasse bleibt ${n} Nächte. Wie viel kostet das?`, calc: m(p, n), wrong: [`${p} + ${n}`, d(p, n)], answer: p * n, unit: "€" }; },
            () => { const k = rnd(3, 6), a = rnd(2, 5) * k; return { q: `${a} Äpfel werden gerecht auf ${k} Kinder verteilt. Wie viele bekommt jedes Kind?`, calc: d(a, k), wrong: [m(a, k), `${a} − ${k}`], answer: a / k, unit: "" }; },
            () => { const r = rnd(3, 9), s = rnd(4, 9); return { q: `Am Strand stehen ${r} Reihen mit je ${s} Strandkörben. Wie viele Strandkörbe sind das?`, calc: m(r, s), wrong: [`${r} + ${s}`, d(r * s, s)], answer: r * s, unit: "" }; },
            () => { const k = rnd(4, 8), p = rnd(2, 6) * k; return { q: `${p} Muscheln werden gerecht auf ${k} Freunde verteilt. Wie viele bekommt jeder?`, calc: d(p, k), wrong: [m(p, k), `${p} + ${k}`], answer: p / k, unit: "" }; },
            () => { const b = rnd(2, 5), p = rnd(3, 9); return { q: `Ein Bus hat ${b * 10} Plätze. Es fahren ${b} solche Busse. Wie viele Kinder passen rein?`, calc: m(b * 10, b), wrong: [`${b * 10} + ${b}`, d(b * 10, b)], answer: b * 10 * b, unit: "" }; },
          ];
          for (const mk of sample(stories, 4)) {
            const s = mk();
            t.push(strChoice(`${s.q}<br><br>Welche Rechnung passt?`, s.calc, s.wrong, { hint: "Gleich viel für jeden und das Ganze gesucht: mal. Gerecht aufteilen: geteilt." }));
            t.push({ type: "input", q: `${s.q}`, answer: s.answer, unit: s.unit, hint: `Rechne ${s.calc}.` });
          }
          return t;
        },
      },
    ],
  };

  LK.courses = LK.courses || [];
  LK.courses.push({
    id: "mathe-mult",
    fach: "Mathe",
    titel: "Mal und Geteilt",
    beschreibung: "Klasse 5: Fachbegriffe, Zahlenmauern, Rechengesetze, Überschlag und schriftliches Multiplizieren.",
    units: [einheit1, einheit2, einheit3, einheit4, einheit5, einheit6, einheit7],
  });
})(window.LK);
