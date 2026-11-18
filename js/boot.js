// Rust TV-opstarter (v1.5)
// Haalt bij elke start de nieuwste versie van Rust TV van GitHub.
// Lukt dat niet (geen internet), dan de laatst bewaarde versie, en anders de ingebouwde.
(function () {
  var GITHUB = "https://raw.githubusercontent.com/jitsevanhauwaert/rust-tv/main/";
  var WACHT = 3500;                      // langer dan 3,5 s wachten we niet op GitHub
  var OPSLAG = "rusttv.code";

  function haal(url, ok, fout) {
    var x = new XMLHttpRequest(), klaar = false;
    x.open("GET", url);
    x.timeout = WACHT;
    x.onload = function () { if (klaar) return; klaar = true; (x.status === 200 || (x.status === 0 && x.responseText)) ? ok(x.responseText) : fout(); };
    x.onerror = x.ontimeout = function () { if (!klaar) { klaar = true; fout(); } };
    x.send();
  }
  function lichaam(html) {
    var a = html.indexOf("<!--rust-begin-->"), b = html.indexOf("<!--rust-einde-->");
    return a >= 0 && b > a ? html.slice(a + 17, b) : null;
  }
  function vingerafdruk(c) { var s = c.html + c.css + c.js, h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return String(h); }
  function bewaard() { try { return JSON.parse(localStorage.getItem(OPSLAG) || "null"); } catch (e) { return null; } }

  function start(code, nieuw) {
    if (code.html !== null) document.getElementById("rust").innerHTML = code.html;
    var st = document.createElement("style"); st.textContent = code.css; document.head.appendChild(st);
    document.body.style.visibility = "visible";
    var sc = document.createElement("script"); sc.textContent = code.js; document.body.appendChild(sc);
    if (nieuw) setTimeout(function () {
      var m = document.getElementById("melding");
      if (m) { m.textContent = "Rust TV is bijgewerkt"; m.hidden = false; setTimeout(function () { m.hidden = true; }, 4000); }
    }, 1500);
  }
  function ingebouwd() {
    // de bestanden die mee geïnstalleerd zijn
    haal("css/stijl.css", function (css) {
      haal("js/app.js", function (js) { start({ html: null, css: css, js: js }, false); },
        function () { document.body.style.visibility = "visible"; });
    }, function () { document.body.style.visibility = "visible"; });
  }
  function terugval() {
    var c = bewaard();
    if (c && c.js && c.css && c.html) start(c, false); else ingebouwd();
  }

  // GitHub proberen (met ?t= zodat we nooit een oude kopie krijgen)
  var t = "?t=" + Date.now(), html, css, js, mis = false, teller = 0;
  function stuk(zet) { return function (v) { zet(v); if (++teller === 3 && !mis) verder(); }; }
  function faal() { if (!mis) { mis = true; terugval(); } }
  function verder() {
    var b = lichaam(html);
    if (!b || js.indexOf("Rust TV") < 0) return faal();   // vreemd antwoord: niet gebruiken
    var code = { html: b, css: css, js: js }, oud = bewaard();
    code.id = vingerafdruk(code);
    var nieuw = !!(oud && oud.id && oud.id !== code.id);
    try { localStorage.setItem(OPSLAG, JSON.stringify(code)); } catch (e) {}
    start(code, nieuw);
  }
  // De tv slaapt vaak dagen in plaats van uit te gaan. Daarom ook kijken als Rust TV
  // terug in beeld komt (hooguit om de 10 minuten); is er een nieuwe versie, dan herladen.
  var laatsteCheck = Date.now();
  document.addEventListener("visibilitychange", function () {
    if (document.hidden || Date.now() - laatsteCheck < 600000) return;
    laatsteCheck = Date.now();
    var q = "?t=" + Date.now(), h2, c2, j2, n = 0, kapot = false;
    function deel(zet) { return function (v) { zet(v); if (++n === 3 && !kapot) {
      var b = lichaam(h2); if (!b || j2.indexOf("Rust TV") < 0) return;
      var code = { html: b, css: c2, js: j2 }; code.id = vingerafdruk(code);
      var oud = bewaard();
      if (!oud || oud.id !== code.id) { try { localStorage.setItem(OPSLAG, JSON.stringify(code)); } catch (e) {} location.reload(); }
    } }; }
    function stop() { kapot = true; }
    haal(GITHUB + "index.html" + q, deel(function (v) { h2 = v; }), stop);
    haal(GITHUB + "css/stijl.css" + q, deel(function (v) { c2 = v; }), stop);
    haal(GITHUB + "js/app.js" + q, deel(function (v) { j2 = v; }), stop);
  });

  haal(GITHUB + "index.html" + t, stuk(function (v) { html = v; }), faal);
  haal(GITHUB + "css/stijl.css" + t, stuk(function (v) { css = v; }), faal);
  haal(GITHUB + "js/app.js" + t, stuk(function (v) { js = v; }), faal);
})();
