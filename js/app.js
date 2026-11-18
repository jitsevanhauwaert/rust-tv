// Rust TV: een rustig startscherm voor de Samsung-tv.
// Lucht die met de dag meekleurt (zelfde idee als Rust op de gsm), klok, weer
// en alleen je eigen tegels. Apps komen uit de echte lijst van de tv.
(function () {
  "use strict";

  var LAT = 50.81, LON = 3.18; // Wevelgem
  var OPSLAG = "rusttv.favorieten";
  var STANDAARD = [/netflix/i, /vtm/i, /goplay/i, /vrt/i, /youtube/i];
  var TOETS = { links: 37, op: 38, rechts: 39, neer: 40, ok: 13, terug: 10009, terug2: 8, terug3: 27 };

  // HDMI-ingangen als tegels (id begint met _hdmi)
  var INGANGEN = [
    { id: "_hdmi1", naam: "PlayStation", poort: 1, wit: true, icoon: [
      "https://cdn.simpleicons.org/playstation/ffffff",
      "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/playstation.svg"] },
    { id: "_hdmi2", naam: "Chromecast", poort: 2, wit: true, icoon: [
      "https://cdn.simpleicons.org/googlecast/ffffff",
      "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/googlecast.svg"] },
  ];
  var hdmiActief = false;
  var apps = [];          // {id, naam, icoon}
  var favorieten = [];    // app-id's in volgorde
  var scherm = "thuis";   // thuis | alle
  var focus = 0, focusAlle = 0;
  var bewegen = -1;       // index van de tegel die verplaatst wordt
  var $ = function (id) { return document.getElementById(id); };
  // Officiële logo's (Simple Icons) voor apps waarvan de tv geen goed logo geeft
  var LOGO = [[/youtube/i, "youtube"], [/netflix/i, "netflix"]];
  function eigenLogo(naam) {
    for (var i = 0; i < LOGO.length; i++) if (LOGO[i][0].test(naam || ""))
      return ["https://cdn.simpleicons.org/" + LOGO[i][1], "https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/" + LOGO[i][1] + ".svg"];
    return null;
  }

  // ---------- apps van de tv ----------
  function laadApps(klaar) {
    if (!window.tizen || !tizen.application) {
      // Voorbeeld in een gewone browser
      apps = ["Netflix", "VTM GO", "GoPlay", "VRT MAX", "YouTube", "Spotify", "Prime Video", "Disney+", "Internet", "SmartThings", "Galerij", "Music"]
        .map(function (n, i) { return { id: "demo" + i, naam: n, icoon: "" }; });
      apps = INGANGEN.slice().concat(apps);
      return klaar();
    }
    try {
      tizen.application.getAppsInfo(function (lijst) {
        var eigen = tizen.application.getCurrentApplication().appInfo.id;
        apps = INGANGEN.slice().concat(lijst.filter(function (a) { return a.show !== false && a.name && a.id !== eigen; })
          .map(function (a) { return { id: a.id, naam: a.name, icoon: eigenLogo(a.name) || a.iconPath || "" }; })
          .sort(function (a, b) { return a.naam.localeCompare(b.naam); }));
        klaar();
      }, function (e) { melding("Kon de lijst met apps niet lezen: " + e.message); klaar(); });
    } catch (e) { melding("Kon de lijst met apps niet lezen: " + e.message); klaar(); }
  }
  function app(id) {
    for (var j = 0; j < INGANGEN.length; j++) if (INGANGEN[j].id === id) return INGANGEN[j];
    for (var i = 0; i < apps.length; i++) if (apps[i].id === id) return apps[i];
    return null;
  }

  function laadFavorieten() {
    try { favorieten = JSON.parse(localStorage.getItem(OPSLAG)) || null; } catch (e) { favorieten = null; }
    if (!favorieten) {
      favorieten = [];
      STANDAARD.forEach(function (re) {
        for (var i = 0; i < apps.length; i++) if (re.test(apps[i].naam) && favorieten.indexOf(apps[i].id) < 0) { favorieten.push(apps[i].id); break; }
      });
    }
    // Eenmalig: de HDMI-tegels toevoegen (ook bij wie al favorieten had)
    try {
      if (!localStorage.getItem("rusttv.hdmi")) {
        INGANGEN.forEach(function (h) { if (favorieten.indexOf(h.id) < 0) favorieten.push(h.id); });
        localStorage.setItem("rusttv.hdmi", "1"); bewaar();
      }
    } catch (e) {}
    favorieten = favorieten.filter(function (id) { return app(id); });
  }
  function bewaar() { try { localStorage.setItem(OPSLAG, JSON.stringify(favorieten)); } catch (e) {} }

  function open(a) {
    if (!a) return;
    if (a.poort) return toonIngang(a);
    if (!window.tizen) return melding("(voorbeeld) " + a.naam + " openen");
    try {
      tizen.application.launch(a.id, function () {}, function (e) { melding("Kan " + a.naam + " niet openen: " + e.message); });
    } catch (e) { melding("Kan " + a.naam + " niet openen: " + e.message); }
  }

  // ---------- HDMI: de ingang schermvullend tonen in Rust TV ----------
  function fout(naam) { return function (e) { melding("Kan " + naam + " niet tonen: " + (e && e.message ? e.message : e)); }; }
  function toonIngang(a) {
    if (!window.tizen || !tizen.tvwindow) return melding("(voorbeeld) " + a.naam + " tonen");
    try {
      tizen.systeminfo.getPropertyValue("VIDEOSOURCE", function (vs) {
        var lijst = (vs.connected || []).concat(vs.disconnected || []), bron = null;
        for (var i = 0; i < lijst.length; i++) if (lijst[i].type === "HDMI" && lijst[i].number === a.poort) { bron = lijst[i]; break; }
        if (!bron) return melding("HDMI " + a.poort + " (" + a.naam + ") niet gevonden");
        tizen.tvwindow.setSource(bron, function () {
          tizen.tvwindow.show(function () {
            hdmiActief = true;
            document.body.className = "hdmi";
            melding(a.naam + " · druk op Terug voor Rust TV");
          }, fout(a.naam), ["0px", "0px", "1920px", "1080px"], "MAIN");
        }, fout(a.naam), "MAIN");
      }, fout(a.naam));
    } catch (e) { fout(a.naam)(e); }
  }
  function sluitIngang() {
    try { tizen.tvwindow.hide(function () {}, function () {}, "MAIN"); } catch (e) {}
    hdmiActief = false;
    document.body.className = "";
    teken();
  }

  var meldTimer = null;
  function melding(t) {
    var m = $("melding"); m.textContent = t; m.hidden = false;
    clearTimeout(meldTimer); meldTimer = setTimeout(function () { m.hidden = true; }, 5000);
  }

  // ---------- tegels ----------
  function tegel(a, extra) {
    var d = document.createElement("div");
    d.className = "tegel" + (extra || "");
    var s = document.createElement("span"); s.className = "naam"; s.textContent = a.naam;
    var bronnen = !a.icoon ? [] : (typeof a.icoon === "string" ? [a.icoon] : a.icoon.slice());
    if (bronnen.length) {
      // Alleen het logo; lukt geen enkel logo, dan toch de naam
      d.className += " logo" + (a.wit ? " wit" : "");
      var img = document.createElement("img");
      img.onerror = function () {
        if (bronnen.length) { var u = bronnen.shift(); if (u.indexOf("jsdelivr") >= 0 && d.className.indexOf(" wit") < 0) d.className += " wit"; img.src = u; }
        else { img.remove(); d.className = d.className.replace(" logo", ""); }
      };
      img.src = bronnen.shift();
      d.appendChild(img);
    }
    d.appendChild(s);
    return d;
  }
  function tekenThuis() {
    var r = $("tegels"); r.innerHTML = "";
    var lijst = favorieten.map(app).concat([{ id: "_alle", naam: "Alle apps", icoon: "" }]);
    if (focus >= lijst.length) focus = lijst.length - 1;
    lijst.forEach(function (a, i) {
      r.appendChild(tegel(a, (i === focus ? " focus" : "") + (i === bewegen ? " beweeg" : "")));
    });
    $("bewerk").hidden = bewegen < 0;
    if (bewegen >= 0) $("bewerkNaam").textContent = app(favorieten[bewegen]).naam;
    $("hint").hidden = bewegen >= 0;
  }
  function tekenAlle() {
    var r = $("raster"); r.innerHTML = "";
    var per = 6, rijen = 4, start = Math.max(0, Math.floor(focusAlle / per) - rijen + 1) * per;
    apps.slice(start, start + per * rijen).forEach(function (a, j) {
      var i = start + j, d = tegel(a, i === focusAlle ? " focus" : "");
      if (favorieten.indexOf(a.id) >= 0) { var st = document.createElement("span"); st.className = "ster"; st.textContent = "★"; d.appendChild(st); }
      r.appendChild(d);
    });
  }
  function teken() {
    $("alle").hidden = scherm !== "alle";
    if (scherm === "alle") tekenAlle(); else tekenThuis();
  }

  // ---------- afstandsbediening ----------
  var okNeer = 0, okLang = null, okVerwerkt = false;
  function kort() {
    if (scherm === "alle") return open(apps[focusAlle]);
    if (bewegen >= 0) { bewegen = -1; bewaar(); return teken(); }
    if (focus === favorieten.length) { scherm = "alle"; focusAlle = 0; return teken(); }
    open(app(favorieten[focus]));
  }
  function lang() {
    if (scherm === "alle") {
      var a = apps[focusAlle], i = favorieten.indexOf(a.id);
      if (i >= 0) favorieten.splice(i, 1); else favorieten.push(a.id);
      bewaar(); melding(i >= 0 ? a.naam + " van je startscherm gehaald" : a.naam + " op je startscherm gezet");
      return teken();
    }
    if (focus < favorieten.length) { bewegen = focus; teken(); }
  }
  document.addEventListener("keydown", function (e) {
    var k = e.keyCode;
    if (hdmiActief) {
      if (k === TOETS.terug || k === TOETS.terug2 || k === TOETS.terug3) { e.preventDefault(); sluitIngang(); }
      return;
    }
    if (k === TOETS.ok) {
      e.preventDefault();
      if (!okNeer) { okNeer = Date.now(); okVerwerkt = false; okLang = setTimeout(function () { okVerwerkt = true; lang(); }, 700); }
      return;
    }
    if (k === TOETS.terug || k === TOETS.terug2 || k === TOETS.terug3) {
      e.preventDefault();
      if (scherm === "alle") { scherm = "thuis"; teken(); }
      else if (bewegen >= 0) { bewegen = -1; bewaar(); teken(); }
      return; // op het startscherm doet Terug niets
    }
    if (scherm === "alle") {
      var n = apps.length;
      if (k === TOETS.links) focusAlle = Math.max(0, focusAlle - 1);
      if (k === TOETS.rechts) focusAlle = Math.min(n - 1, focusAlle + 1);
      if (k === TOETS.op) focusAlle = Math.max(0, focusAlle - 6);
      if (k === TOETS.neer) focusAlle = Math.min(n - 1, focusAlle + 6);
      return teken();
    }
    var max = favorieten.length;
    if (bewegen >= 0) {
      if (k === TOETS.links && bewegen > 0) { var t = favorieten[bewegen - 1]; favorieten[bewegen - 1] = favorieten[bewegen]; favorieten[bewegen] = t; bewegen--; focus = bewegen; }
      if (k === TOETS.rechts && bewegen < max - 1) { var u = favorieten[bewegen + 1]; favorieten[bewegen + 1] = favorieten[bewegen]; favorieten[bewegen] = u; bewegen++; focus = bewegen; }
      if (k === TOETS.neer) { var naam = app(favorieten[bewegen]).naam; favorieten.splice(bewegen, 1); bewegen = -1; bewaar(); melding(naam + " verwijderd"); }
      return teken();
    }
    if (k === TOETS.links) focus = Math.max(0, focus - 1);
    if (k === TOETS.rechts) focus = Math.min(max, focus + 1);
    teken();
  });
  document.addEventListener("keyup", function (e) {
    if (e.keyCode !== TOETS.ok || hdmiActief) return;
    clearTimeout(okLang);
    if (!okVerwerkt) kort();
    okNeer = 0;
  });

  // ---------- klok en weer ----------
  var DAGEN = ["zondag", "maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag"];
  var MAANDEN = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];
  var weerCode = null;
  function twee(n) { return (n < 10 ? "0" : "") + n; }
  function klok() {
    var d = new Date();
    $("klok").textContent = twee(d.getHours()) + ":" + twee(d.getMinutes());
    $("datum").textContent = DAGEN[d.getDay()] + " " + d.getDate() + " " + MAANDEN[d.getMonth()];
    lucht(d);
    zetAvond(d);
    if (weerCode !== null) foto();
  }
  var WEER = { 0: "helder", 1: "vrij helder", 2: "half bewolkt", 3: "bewolkt", 45: "mist", 48: "mist", 51: "motregen", 53: "motregen", 55: "motregen", 61: "regen", 63: "regen", 65: "zware regen", 71: "sneeuw", 73: "sneeuw", 75: "sneeuw", 80: "buien", 81: "buien", 82: "zware buien", 95: "onweer" };
  function weer() {
    var x = new XMLHttpRequest();
    x.open("GET", "https://api.open-meteo.com/v1/forecast?latitude=" + LAT + "&longitude=" + LON + "&current=temperature_2m,weather_code&timezone=Europe%2FBrussels");
    x.onload = function () {
      try {
        var c = JSON.parse(x.responseText).current;
        weerCode = c.weather_code;
        foto();
        $("weer").textContent = Math.round(c.temperature_2m) + "° · " + (WEER[c.weather_code] || "") + " in Wevelgem";
      } catch (e) {}
    };
    x.send();
  }

  // ---------- lucht: kleurverloop met zonnegloed ----------
  function zon(d) {
    var start = new Date(d.getFullYear(), 0, 0), dag = Math.floor((d - start) / 864e5);
    var g = 2 * Math.PI / 365 * (dag - 1);
    var eq = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
    var dc = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
    var la = LAT * Math.PI / 180, x = Math.cos(90.833 * Math.PI / 180) / (Math.cos(la) * Math.cos(dc)) - Math.tan(la) * Math.tan(dc);
    var ha = Math.acos(Math.max(-1, Math.min(1, x))) * 180 / Math.PI, tz = -d.getTimezoneOffset();
    return { op: 720 - 4 * (LON + ha) - eq + tz, middag: 720 - 4 * LON - eq + tz, onder: 720 - 4 * (LON - ha) - eq + tz };
  }
  function lin(c) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  function gam(v) { var c = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055; return Math.round(Math.min(1, Math.max(0, c)) * 255); }
  function lab(h) {
    var n = parseInt(h.slice(1), 16), r = lin(n >> 16 & 255), g = lin(n >> 8 & 255), b = lin(n & 255);
    var l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
  }
  function rgb(c) {
    var l = Math.pow(c[0] + 0.3963377774 * c[1] + 0.2158037573 * c[2], 3), m = Math.pow(c[0] - 0.1055613458 * c[1] - 0.0638541728 * c[2], 3), s = Math.pow(c[0] - 0.0894841775 * c[1] - 1.291485548 * c[2], 3);
    return "rgb(" + gam(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s) + "," + gam(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s) + "," + gam(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s) + ")";
  }
  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function zacht(t) { return t * t * (3 - 2 * t); }
  function lucht(d) {
    var z = zon(d), min = d.getHours() * 60 + d.getMinutes();
    var A = [[z.op - 30, "#3E3466", "#B9636A"], [z.op + 90, "#245E8C", "#5FA3A0"], [z.middag, "#1F6F66", "#4E9157"],
      [Math.max(z.middag + 60, z.onder - 120), "#2F5F86", "#B0834C"], [z.onder - 15, "#6E3757", "#D06F2E"],
      [z.onder + 45, "#1E2252", "#6A3570"], [Math.max(z.onder + 120, 22 * 60), "#090C1E", "#1A1838"]];
    function kl(i) {
      var e = A[0], n = A[A.length - 1];
      if (min >= n[0] || min <= e[0] - 90) return lab(n[i]);
      if (min < e[0]) return mix(lab(n[i]), lab(e[i]), zacht((min - (e[0] - 90)) / 90));
      var j = 0; while (A[j + 1][0] <= min) j++;
      return mix(lab(A[j][i]), lab(A[j + 1][i]), zacht((min - A[j][0]) / (A[j + 1][0] - A[j][0])));
    }
    var boven = kl(1), onder = kl(2);
    if (weerCode !== null && weerCode >= 3) { var grijs = lab("#66717C"), f = weerCode >= 51 ? 0.26 : 0.16; boven = mix(boven, grijs, f); onder = mix(onder, grijs, f); }
    $("lucht").style.background = "linear-gradient(180deg," + rgb(boven) + " 0%," + rgb(mix(boven, onder, 0.55)) + " 55%," + rgb(onder) + " 100%)";
    var p = (min - z.op) / (z.onder - z.op), pc = Math.max(0, Math.min(1, p)), h = Math.sin(pc * Math.PI);
    var zicht = p > -0.05 && p < 1.05, sterkte = zicht ? (weerCode === null || weerCode <= 2 ? 0.45 : weerCode >= 51 ? 0.1 : 0.25) : 0;
    var kleur = h < 0.45 ? (p < 0.5 ? "255,175,150" : "255,165,85") : "255,238,200";
    var x = (-0.08 + p * 1.16) * 1920, y = (0.8 - h * 0.62) * 1080;
    $("zon").style.background = "radial-gradient(circle at " + x + "px " + y + "px,rgba(" + kleur + "," + sterkte + ") 0,rgba(" + kleur + "," + (sterkte * 0.45) + ") 300px,rgba(" + kleur + ",0) 760px)";
  }

  // ---------- dagdeel: 's avonds gedimd (ontwerp C), overdag ontwerp A ----------
  function dagdeel(d) {
    var z = zon(d), min = d.getHours() * 60 + d.getMinutes();
    if (min >= z.op + 30 && min < z.onder - 30) return "dag";
    if (min >= z.onder - 30 && min < Math.max(z.onder + 90, 21 * 60)) return "avond";
    if (min >= z.op - 60 && min < z.op + 30) return "ochtend";
    return "nacht";
  }
  function zetAvond(d) {
    var dd = dagdeel(d), avond = dd === "avond" || dd === "nacht";
    var b = document.body;
    if (b.className.indexOf("hdmi") >= 0) return;
    b.className = avond ? "avond" : "";
  }

  // ---------- foto: elke dag een foto die past bij seizoen, weer en dagdeel ----------
  function seizoen(m) { return m === 11 || m <= 1 ? "winter" : m <= 4 ? "spring" : m <= 7 ? "summer" : "autumn"; }
  function weergroep(c) {
    if (c === null) return "";
    if (c >= 95) return "storm";
    if (c >= 71 && c <= 77 || c === 85 || c === 86) return "snow";
    if (c >= 51) return "rain";
    if (c === 45 || c === 48) return "fog";
    if (c >= 2) return "cloudy";
    return "sunny";
  }
  var DAGWOORD = { ochtend: "morning", dag: "", avond: "sunset", nacht: "night" };
  var fotoSleutel = null;
  function fotoZoekterm(d) {
    var dd = dagdeel(d), w = weergroep(weerCode);
    // bij nacht en avond is het weer minder zichtbaar: dan seizoen + dagdeel
    var t = [seizoen(d.getMonth())];
    if (dd === "dag" || dd === "ochtend") { if (w) t.push(w); } else t.push(DAGWOORD[dd]);
    if (dd === "ochtend") t.push("morning");
    t.push("landscape");
    return t.join(" ");
  }
  function dagNr(d) { return Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 864e5); }
  function haal(url, ok, fout) {
    var x = new XMLHttpRequest();
    x.open("GET", url); x.timeout = 15000;
    x.onload = function () { try { ok(JSON.parse(x.responseText)); } catch (e) { fout(); } };
    x.onerror = x.ontimeout = fout; x.send();
  }
  function kies(lijst, d) { return lijst.length ? lijst[(dagNr(d) * 7 + d.getFullYear()) % lijst.length] : null; }
  function zoekOpenverse(q, d, ok, fout) {
    haal("https://api.openverse.org/v1/images/?q=" + encodeURIComponent(q) + "&category=photograph&aspect_ratio=wide&size=large&mature=false&page_size=30", function (j) {
      var l = (j.results || []).filter(function (r) { return r.url && r.width >= 1600 && r.width <= 4200 && r.width > r.height * 1.3; });
      var f = kies(l, d);
      if (!f) return fout();
      ok({ url: f.url, maker: f.creator || "", licentie: (f.license || "").toUpperCase(), titel: f.title || "" });
    }, fout);
  }
  function zoekCommons(q, d, ok, fout) {
    haal("https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrnamespace=6&gsrlimit=30&gsrsearch=" +
      encodeURIComponent(q + " filetype:bitmap") + "&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=1920", function (j) {
      var p = j.query && j.query.pages, l = [];
      for (var k in p) { var ii = p[k].imageinfo && p[k].imageinfo[0]; if (ii && ii.width > ii.height * 1.3 && ii.width >= 1600) l.push(ii); }
      l.sort(function (a, b) { return a.url < b.url ? -1 : 1; });
      var f = kies(l, d);
      if (!f) return fout();
      var m = f.extmetadata || {}, maker = (m.Artist && m.Artist.value || "").replace(/<[^>]*>/g, "");
      ok({ url: f.thumburl || f.url, maker: maker, licentie: m.LicenseShortName ? m.LicenseShortName.value : "", titel: "" });
    }, fout);
  }
  function toonFoto(f) {
    var img = new Image();
    img.onload = function () {
      $("foto").style.backgroundImage = "url(\"" + f.url + "\")";
      $("foto").className = "zichtbaar";
      $("bron").textContent = "Foto: " + (f.maker ? f.maker.slice(0, 60) : "onbekend") + (f.licentie ? " · " + f.licentie : "");
    };
    img.src = f.url;
  }
  function foto() {
    var d = new Date(), q = fotoZoekterm(d), sleutel = d.toDateString() + "|" + q;
    if (sleutel === fotoSleutel) return;
    fotoSleutel = sleutel;
    try { var b = JSON.parse(localStorage.getItem("rusttv.foto") || "null"); if (b && b.sleutel === sleutel) return toonFoto(b.foto); } catch (e) {}
    function klaar(f) { try { localStorage.setItem("rusttv.foto", JSON.stringify({ sleutel: sleutel, foto: f })); } catch (e) {} toonFoto(f); }
    zoekOpenverse(q, d, klaar, function () {
      zoekCommons(q, d, klaar, function () {
        // ruimer zoeken: alleen seizoen + landschap
        zoekCommons(seizoen(d.getMonth()) + " landscape", d, klaar, function () {});
      });
    });
  }

  // ---------- start ----------
  // De wachter starten (opent Rust TV als de tv wakker wordt)
  function startWachter() {
    if (!window.tizen || !tizen.application || !tizen.ApplicationControl) return;
    try {
      tizen.application.launchAppControl(
        new tizen.ApplicationControl("http://tizen.org/appcontrol/operation/service"),
        "RustTVjvh1.Wachter",
        function () {},
        function (e) { melding("Wachter start niet: " + (e && e.message ? e.message : e)); });
    } catch (e) { melding("Wachter start niet: " + (e && e.message ? e.message : e)); }
  }
  startWachter();
  laadApps(function () { laadFavorieten(); teken(); });
  klok(); setInterval(klok, 15000);
  weer(); setInterval(weer, 30 * 60000);
  // Komt de app terug in beeld (na Netflix bv.): lijst en klok vernieuwen
  document.addEventListener("visibilitychange", function () {
    if (document.hidden && hdmiActief) sluitIngang();
    if (!document.hidden) { startWachter(); klok(); laadApps(function () { laadFavorieten(); teken(); }); } });
})();
