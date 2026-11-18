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
            klasse();
            melding(a.naam + " · druk op Terug voor Rust TV");
          }, fout(a.naam), ["0px", "0px", "1920px", "1080px"], "MAIN");
        }, fout(a.naam), "MAIN");
      }, fout(a.naam));
    } catch (e) { fout(a.naam)(e); }
  }
  function sluitIngang() {
    try { tizen.tvwindow.hide(function () {}, function () {}, "MAIN"); } catch (e) {}
    hdmiActief = false;
    klasse();
    teken();
  }

  // ---------- meldingen en de klasse op <body> ----------
  var meldTimer = null;
  function melding(t) {
    var m = $("melding"); m.textContent = t; m.hidden = false;
    clearTimeout(meldTimer); meldTimer = setTimeout(function () { m.hidden = true; }, 5000);
  }
  var avond = false, rust = false;
  function klasse() {
    var k = [];
    if (hdmiActief) k.push("hdmi");
    if (avond) k.push("avond");
    if (rust) k.push("rust");
    document.body.className = k.join(" ");
  }
  function lees(sleutel, standaard) { try { var v = JSON.parse(localStorage.getItem(sleutel)); return v === null || v === undefined ? standaard : v; } catch (e) { return standaard; } }
  function schrijf(sleutel, v) { try { localStorage.setItem(sleutel, JSON.stringify(v)); } catch (e) {} }

  // ---------- verborgen apps ----------
  // Samsung-apps die bijna niemand gebruikt staan meteen bij "Verborgen". Je kunt ze altijd terughalen.
  var STANDAARD_VERBORGEN = /e-manual|e-handleiding|handleiding|smartthings|universal guide|galer|gallery|health|bixby|alexa|tv plus|art store|kids|tutorial|fitness|game launcher|gaming hub|ambient|workout|apps$/i;
  var verborgen = [];
  function laadVerborgen() {
    verborgen = lees("rusttv.verborgen", null);
    if (!verborgen) {
      verborgen = apps.filter(function (a) { return !a.poort && STANDAARD_VERBORGEN.test(a.naam) && favorieten.indexOf(a.id) < 0; })
        .map(function (a) { return a.id; });
      schrijf("rusttv.verborgen", verborgen);
    }
  }
  function isVerborgen(id) { return verborgen.indexOf(id) >= 0; }

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
  var zone = "tegels";      // op het startscherm: tegels | muziek
  var muziekFocus = 1;      // 0 vorige, 1 afspelen/pauze, 2 volgende
  function tekenThuis() {
    var r = $("tegels"); r.innerHTML = "";
    var lijst = favorieten.map(app).concat([{ id: "_alle", naam: "Alle apps", icoon: "" }]);
    if (focus >= lijst.length) focus = lijst.length - 1;
    lijst.forEach(function (a, i) {
      r.appendChild(tegel(a, (i === focus && zone === "tegels" ? " focus" : "") + (i === bewegen ? " beweeg" : "")));
    });
    $("bewerk").hidden = bewegen < 0;
    if (bewegen >= 0) $("bewerkNaam").textContent = app(favorieten[bewegen]).naam;
    tekenMuziekFocus();
  }

  // ---------- Alle apps: drie groepen ----------
  var PER_RIJ = 7;
  var toonVerborgen = false;
  var rijen = [];           // [{kop, items:[...]}], items: app of {soort}
  var fr = 0, fk = 0;       // focus: rij en kolom
  function bouwAlle() {
    rijen = [];
    function blok(kop, lijst) {
      for (var i = 0; i < lijst.length; i += PER_RIJ) rijen.push({ kop: i === 0 ? kop : null, items: lijst.slice(i, i + PER_RIJ) });
    }
    rijen.push({ kop: null, items: [{ soort: "inst", naam: "Instellingen" }], knoppen: true });
    var op = favorieten.map(app).filter(Boolean);
    var andere = apps.filter(function (a) { return favorieten.indexOf(a.id) < 0 && !isVerborgen(a.id); });
    var weg = apps.filter(function (a) { return favorieten.indexOf(a.id) < 0 && isVerborgen(a.id); });
    blok("Op je startscherm · " + op.length, op);
    if (andere.length) blok("Andere apps · " + andere.length, andere);
    rijen.push({ kop: "Verborgen · " + weg.length, items: [{ soort: "toon", naam: toonVerborgen ? "Verborgen apps sluiten" : "Verborgen apps tonen" }], knoppen: true });
    if (toonVerborgen) blok(null, weg);
    if (fr >= rijen.length) fr = rijen.length - 1;
    if (fk >= rijen[fr].items.length) fk = rijen[fr].items.length - 1;
  }
  function huidigItem() { return rijen[fr] && rijen[fr].items[fk]; }
  function tekenAlle() {
    bouwAlle();
    var r = $("raster"); r.innerHTML = "";
    var focusEl = null;
    rijen.forEach(function (rij, ri) {
      if (rij.kop) { var h = document.createElement("div"); h.className = "groep"; h.textContent = rij.kop; r.appendChild(h); }
      var rd = document.createElement("div"); rd.className = rij.knoppen ? "knoprij" : "apprij";
      rij.items.forEach(function (a, ki) {
        var f = ri === fr && ki === fk, d;
        if (a.soort) { d = document.createElement("div"); d.className = "knop" + (f ? " focus" : ""); d.textContent = a.naam; }
        else {
          d = tegel(a, " klein" + (f ? " focus" : "") + (isVerborgen(a.id) ? " grijs" : ""));
        }
        if (f) focusEl = d;
        rd.appendChild(d);
      });
      r.appendChild(rd);
    });
    // in beeld schuiven
    if (focusEl) { var y = focusEl.offsetTop - 260; r.scrollTop = Math.max(0, y); }
  }

  // ---------- klein menu (OK ingedrukt houden) ----------
  var menu = null;          // {opties:[{t, doe}], i}
  function openMenu(opties, x, y) {
    menu = { opties: opties.concat([{ t: "Annuleren", doe: function () {} }]), i: 0, x: x, y: y };
    tekenMenu();
  }
  function tekenMenu() {
    var m = $("menu");
    if (!menu) { m.hidden = true; return; }
    m.innerHTML = "";
    menu.opties.forEach(function (o, i) { var d = document.createElement("div"); d.className = "optie" + (i === menu.i ? " focus" : ""); d.textContent = o.t; m.appendChild(d); });
    m.style.left = menu.x + "px"; m.style.bottom = menu.y + "px";
    m.hidden = false;
  }
  function sluitMenu() { menu = null; tekenMenu(); }
  function menuThuis() {
    var a = app(favorieten[focus]); if (!a) return;
    var el = $("tegels").children[focus], x = el ? el.offsetLeft + el.offsetWidth / 2 - 190 : 760;
    openMenu([
      { t: "Verplaatsen", doe: function () { bewegen = focus; } },
      { t: "Van startscherm halen", doe: function () { favorieten.splice(focus, 1); bewaar(); melding(a.naam + " van je startscherm gehaald"); } },
      { t: "Verbergen", doe: function () { favorieten.splice(focus, 1); bewaar(); if (!a.poort && !isVerborgen(a.id)) { verborgen.push(a.id); schrijf("rusttv.verborgen", verborgen); } melding(a.naam + " verborgen"); } }
    ], Math.max(40, Math.min(1500, x)), 370);
  }
  function menuAlle() {
    var a = huidigItem(); if (!a || a.soort) return;
    var op = favorieten.indexOf(a.id) >= 0, weg = isVerborgen(a.id);
    var o = [];
    o.push(op ? { t: "Van startscherm halen", doe: function () { favorieten.splice(favorieten.indexOf(a.id), 1); bewaar(); } }
              : { t: "Op startscherm zetten", doe: function () { favorieten.push(a.id); bewaar(); if (weg) { verborgen.splice(verborgen.indexOf(a.id), 1); schrijf("rusttv.verborgen", verborgen); } } });
    if (!a.poort && !op) o.push(weg ? { t: "Weer tonen", doe: function () { verborgen.splice(verborgen.indexOf(a.id), 1); schrijf("rusttv.verborgen", verborgen); } }
                                    : { t: "Verbergen", doe: function () { verborgen.push(a.id); schrijf("rusttv.verborgen", verborgen); } });
    openMenu(o, 770, 420);
  }

  function teken() {
    $("alle").hidden = scherm !== "alle";
    $("inst").hidden = scherm !== "inst";
    $("thuis").style.visibility = scherm === "thuis" ? "visible" : "hidden";
    if (scherm === "alle") tekenAlle();
    else if (scherm === "inst") tekenInst();
    else tekenThuis();
    tekenMenu();
  }

  // ---------- rust-stand: na 30 s niets doen schuiven de apps weg ----------
  var laatsteToets = Date.now();
  setInterval(function () {
    if (!rust && scherm === "thuis" && !menu && bewegen < 0 && !hdmiActief && !document.hidden && Date.now() - laatsteToets > 30000) { rust = true; klasse(); }
  }, 1000);
  function wekOp() { laatsteToets = Date.now(); if (rust) { rust = false; klasse(); return true; } return false; }

  // ---------- afstandsbediening ----------
  var TERUG = [10009, 8, 27], KLAAR = [65376], STOP = [65385];
  var okNeer = 0, okLang = null, okVerwerkt = false;
  function kort() {
    if (menu) { var o = menu.opties[menu.i]; sluitMenu(); o.doe(); return teken(); }
    if (scherm === "inst") return instOk();
    if (scherm === "alle") {
      var a = huidigItem(); if (!a) return;
      if (a.soort === "inst") { scherm = "inst"; instSectie = 0; instKolom = 0; instI = 0; return teken(); }
      if (a.soort === "toon") { toonVerborgen = !toonVerborgen; return teken(); }
      return open(a);
    }
    if (zone === "muziek") return muziekKnop(muziekFocus);
    if (bewegen >= 0) { bewegen = -1; bewaar(); return teken(); }
    if (focus === favorieten.length) { scherm = "alle"; fr = 1; fk = 0; return teken(); }
    open(app(favorieten[focus]));
  }
  function lang() {
    if (menu || scherm === "inst" || zone === "muziek") return;
    if (scherm === "alle") return menuAlle();
    if (bewegen < 0 && focus < favorieten.length) menuThuis();
  }
  function isTerug(k) { return TERUG.indexOf(k) >= 0; }
  document.addEventListener("keydown", function (e) {
    var k = e.keyCode;
    // tekst typen in een invulveld: de tv-toetsenbord regelt dat zelf
    if (document.activeElement && document.activeElement.tagName === "INPUT") {
      if (k === 13 || KLAAR.indexOf(k) >= 0) { e.preventDefault(); bewaarInvoer(); }
      else if (STOP.indexOf(k) >= 0 || isTerug(k)) { e.preventDefault(); stopInvoer(); }
      return;
    }
    if (hdmiActief) {
      if (isTerug(k)) { e.preventDefault(); sluitIngang(); }
      return;
    }
    if (wekOp()) { e.preventDefault(); if (k === 13) okNeer = -1; return; }   // eerste knop: alleen de apps terugbrengen
    if (k === 13) {
      e.preventDefault();
      if (okNeer <= 0) { okNeer = Date.now(); okVerwerkt = false; okLang = setTimeout(function () { okVerwerkt = true; lang(); }, 700); }
      return;
    }
    if (isTerug(k)) {
      e.preventDefault();
      if (menu) sluitMenu();
      else if (koppel) { stopKoppel(); }
      else if (scherm === "inst") { scherm = "alle"; }
      else if (scherm === "alle") { scherm = "thuis"; }
      else if (bewegen >= 0) { bewegen = -1; bewaar(); }
      else if (zone === "muziek") { zone = "tegels"; }
      return teken(); // op het startscherm doet Terug verder niets
    }
    if (menu) {
      if (k === 38) menu.i = Math.max(0, menu.i - 1);
      if (k === 40) menu.i = Math.min(menu.opties.length - 1, menu.i + 1);
      return tekenMenu();
    }
    if (scherm === "inst") return instToets(k);
    if (scherm === "alle") {
      if (k === 37) fk = Math.max(0, fk - 1);
      if (k === 39) fk = Math.min(rijen[fr].items.length - 1, fk + 1);
      if (k === 38 && fr > 0) { fr--; fk = Math.min(fk, rijen[fr].items.length - 1); }
      if (k === 40 && fr < rijen.length - 1) { fr++; fk = Math.min(fk, rijen[fr].items.length - 1); }
      return teken();
    }
    var max = favorieten.length;
    if (bewegen >= 0) {
      if (k === 37 && bewegen > 0) { var t = favorieten[bewegen - 1]; favorieten[bewegen - 1] = favorieten[bewegen]; favorieten[bewegen] = t; bewegen--; focus = bewegen; }
      if (k === 39 && bewegen < max - 1) { var u = favorieten[bewegen + 1]; favorieten[bewegen + 1] = favorieten[bewegen]; favorieten[bewegen] = u; bewegen++; focus = bewegen; }
      return teken();
    }
    if (zone === "muziek") {
      if (k === 37) muziekFocus = Math.max(0, muziekFocus - 1);
      if (k === 39) muziekFocus = Math.min(2, muziekFocus + 1);
      if (k === 40) zone = "tegels";
      return teken();
    }
    if (k === 38 && muziekZichtbaar()) { zone = "muziek"; muziekFocus = 1; return teken(); }
    if (k === 37) focus = Math.max(0, focus - 1);
    if (k === 39) focus = Math.min(max, focus + 1);
    teken();
  });
  document.addEventListener("keyup", function (e) {
    if (e.keyCode !== 13 || hdmiActief) return;
    if (document.activeElement && document.activeElement.tagName === "INPUT") return;
    if (okNeer === -1) { okNeer = 0; return; }
    clearTimeout(okLang);
    if (okNeer > 0 && !okVerwerkt) kort();
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
  // kiest elke dag(deel) een andere foto; "Andere foto" schuift één plaats op; "Nooit meer" valt weg
  function kies(lijst, d) {
    lijst = lijst.filter(function (f) { var u = f.thumburl || f.url; return fotoInst.nooit.indexOf(u) < 0; });
    return lijst.length ? lijst[(dagNr(d) * 7 + d.getFullYear() + fotoInst.extra + dagdeelNr(d)) % lijst.length] : null;
  }
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
  function zetAvond(d) {
    var dd = dagdeel(d), nu = dd === "avond" || dd === "nacht";
    if (nu !== avond) { avond = nu; klasse(); }
  }
  function dagdeelNr(d) { return { ochtend: 0, dag: 1, avond: 2, nacht: 3 }[dagdeel(d)]; }

  // ---------- foto's: online, eigen album, of afwisselend ----------
  // Alles wordt alleen op deze tv bewaard (niet op GitHub).
  var fotoInst = lees("rusttv.fotoinst", null) || {};
  if (!fotoInst.bron) fotoInst.bron = "online";
  fotoInst.vaker = fotoInst.vaker || []; fotoInst.nooit = fotoInst.nooit || []; fotoInst.extra = fotoInst.extra || 0; fotoInst.album = fotoInst.album || "";
  function bewaarFotoInst() { schrijf("rusttv.fotoinst", fotoInst); }
  var huidigeFoto = null;
  function toonFoto(f) {
    var img = new Image();
    img.onload = function () {
      huidigeFoto = f;
      $("foto").style.backgroundImage = "url(\"" + f.url + "\")";
      $("foto").className = "zichtbaar";
      $("bron").textContent = f.eigen ? "" : "Foto: " + (f.maker ? f.maker.slice(0, 60) : "onbekend") + (f.licentie ? " · " + f.licentie : "");
    };
    img.src = f.url;
  }
  function hash(t) { var h = 0; for (var i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0; return Math.abs(h); }

  // Gedeeld Google Foto's-album: de openbare albumpagina lezen en de foto-adressen eruit halen
  var albumLijst = lees("rusttv.albumlijst", null);
  function laadAlbum(ok, fout) {
    var vandaag = new Date().toDateString();
    if (albumLijst && albumLijst.link === fotoInst.album && albumLijst.dag === vandaag && albumLijst.lijst.length) return ok(albumLijst.lijst);
    if (!fotoInst.album) return fout("Nog geen album gekoppeld");
    var x = new XMLHttpRequest();
    x.open("GET", fotoInst.album); x.timeout = 20000;
    x.onload = function () {
      var re = /\["(https:\/\/lh3\.googleusercontent\.com\/pw\/[^"\\]+)",(\d+),(\d+)/g, m, gezien = {}, l = [];
      while ((m = re.exec(x.responseText))) { if (!gezien[m[1]]) { gezien[m[1]] = 1; l.push({ u: m[1], w: +m[2], h: +m[3] }); } }
      var breed = l.filter(function (f) { return f.w >= f.h; });
      if (breed.length >= 3) l = breed;              // liefst liggende foto's
      var lijst = l.map(function (f) { return f.u; });
      if (!lijst.length) return fout(x.status === 200 ? "Geen foto's gevonden in het album" : "Album niet bereikbaar");
      albumLijst = { link: fotoInst.album, dag: vandaag, lijst: lijst }; schrijf("rusttv.albumlijst", albumLijst);
      ok(lijst);
    };
    x.onerror = x.ontimeout = function () { albumLijst && albumLijst.link === fotoInst.album && albumLijst.lijst.length ? ok(albumLijst.lijst) : fout("Album niet bereikbaar"); };
    x.send();
  }
  function kiesAlbum(lijst, sleutel) {
    var pot = [];
    lijst.forEach(function (u) { if (fotoInst.nooit.indexOf(u) < 0) pot.push(u); });
    fotoInst.vaker.forEach(function (u) { if (lijst.indexOf(u) >= 0) { pot.push(u); pot.push(u); } });   // vaker = 3 keer zoveel kans
    if (!pot.length) return null;
    var u = pot[(hash(sleutel) + fotoInst.extra) % pot.length];
    return { url: u + "=w1920-h1080", sleutel: u, eigen: true };
  }
  function fotoOnline(d, q, klaar) {
    // ook een online foto die je "vaker" wil zien, komt soms terug
    var fav = fotoInst.vaker.filter(function (u) { return u.indexOf("googleusercontent") < 0; });
    if (fav.length && hash(q + d.toDateString()) % 4 === 0) return klaar({ url: fav[(dagNr(d) + fotoInst.extra) % fav.length], maker: "", licentie: "" });
    zoekOpenverse(q, d, klaar, function () {
      zoekCommons(q, d, klaar, function () {
        zoekCommons(seizoen(d.getMonth()) + " landscape", d, klaar, function () {});
      });
    });
  }
  function foto(nu) {
    var d = new Date(), q = fotoZoekterm(d), sleutel = d.toDateString() + "|" + q + "|" + fotoInst.bron + "|" + fotoInst.extra;
    if (!nu && sleutel === fotoSleutel) return;
    fotoSleutel = sleutel;
    var b = lees("rusttv.foto", null);
    if (!nu && b && b.sleutel === sleutel && b.foto) return toonFoto(b.foto);
    function klaar(f) { schrijf("rusttv.foto", { sleutel: sleutel, foto: f }); toonFoto(f); }
    var bron = fotoInst.bron;
    if (bron === "mix") bron = hash(d.toDateString()) % 4 + dagdeelNr(d) & 1 ? "album" : "online";
    if (bron === "album") {
      laadAlbum(function (lijst) { var f = kiesAlbum(lijst, sleutel); f ? klaar(f) : fotoOnline(d, q, klaar); },
        function () { fotoOnline(d, q, klaar); });   // geen album: dan toch een online foto
    } else fotoOnline(d, q, klaar);
  }
  function fotoActie(soort) {
    if (!huidigeFoto) return melding("Er is nog geen foto");
    var u = huidigeFoto.sleutel || huidigeFoto.url;
    if (soort === "vaker") { if (fotoInst.vaker.indexOf(u) < 0) fotoInst.vaker.push(u); melding("Deze foto komt vaker terug"); }
    if (soort === "nooit") { if (fotoInst.nooit.indexOf(u) < 0) fotoInst.nooit.push(u); fotoInst.extra++; melding("Deze foto zie je niet meer"); }
    if (soort === "andere") fotoInst.extra++;
    bewaarFotoInst(); foto(true);
  }

  // ---------- Spotify ----------
  // Koppelen: op je gsm de koppelpagina openen, inloggen, de code kopiëren en hier plakken.
  // De sleutel wordt alleen op deze tv bewaard.
  var sp = lees("rusttv.spotify", null);   // {client, refresh, access, tot}
  var nuSpeelt = null, spTimer = null, spBezig = false;
  function bewaarSp() { schrijf("rusttv.spotify", sp); }
  function spVraag(methode, pad, ok, fout, opnieuw) {
    if (!sp) return fout && fout("niet gekoppeld");
    if (!sp.access || Date.now() > sp.tot - 60000) return vernieuwToken(function () { spVraag(methode, pad, ok, fout, true); }, fout);
    var x = new XMLHttpRequest();
    x.open(methode, "https://api.spotify.com/v1" + pad); x.timeout = 8000;
    x.setRequestHeader("Authorization", "Bearer " + sp.access);
    x.onload = function () {
      if (x.status === 401 && !opnieuw) { sp.access = null; return spVraag(methode, pad, ok, fout, true); }
      if (x.status >= 200 && x.status < 300) { var j = null; try { j = x.responseText ? JSON.parse(x.responseText) : null; } catch (e) {} ok && ok(j, x.status); }
      else fout && fout(x.status === 403 ? "Spotify Premium nodig of geen toestel actief" : "fout " + x.status);
    };
    x.onerror = x.ontimeout = function () { fout && fout("geen verbinding"); };
    x.send();
  }
  function vernieuwToken(ok, fout) {
    var x = new XMLHttpRequest();
    x.open("POST", "https://accounts.spotify.com/api/token"); x.timeout = 8000;
    x.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
    x.onload = function () {
      try {
        var j = JSON.parse(x.responseText);
        if (!j.access_token) throw 0;
        sp.access = j.access_token; sp.tot = Date.now() + j.expires_in * 1000;
        if (j.refresh_token) sp.refresh = j.refresh_token;
        bewaarSp(); ok();
      } catch (e) { fout && fout("koppeling verlopen: opnieuw koppelen"); }
    };
    x.onerror = x.ontimeout = function () { fout && fout("geen verbinding"); };
    x.send("grant_type=refresh_token&refresh_token=" + encodeURIComponent(sp.refresh) + "&client_id=" + encodeURIComponent(sp.client));
  }
  function haalSpeler() {
    if (!sp || hdmiActief || document.hidden || spBezig) return;
    spBezig = true;
    spVraag("GET", "/me/player?additional_types=episode", function (j, st) {
      spBezig = false;
      nuSpeelt = st === 204 || !j || !j.item ? null : {
        titel: j.item.name, artiest: j.item.artists ? j.item.artists.map(function (a) { return a.name; }).join(", ") : (j.item.show ? j.item.show.name : ""),
        hoes: (j.item.album && j.item.album.images && j.item.album.images.length ? j.item.album.images[j.item.album.images.length > 1 ? 1 : 0].url : (j.item.images && j.item.images[0] ? j.item.images[0].url : "")),
        speelt: j.is_playing, pos: j.progress_ms || 0, duur: j.item.duration_ms || 1, toen: Date.now(), toestel: j.device ? j.device.name : ""
      };
      tekenMuziek();
    }, function () { spBezig = false; nuSpeelt = null; tekenMuziek(); });
  }
  function muziekZichtbaar() { return !!nuSpeelt; }
  function tekenMuziek() {
    var w = $("muziek");
    if (!nuSpeelt) { w.hidden = true; if (zone === "muziek") { zone = "tegels"; teken(); } return; }
    w.hidden = false;
    $("mTitel").textContent = nuSpeelt.titel;
    $("mArtiest").textContent = nuSpeelt.artiest;
    $("mBron").textContent = "SPOTIFY" + (nuSpeelt.toestel ? " · " + nuSpeelt.toestel.toUpperCase() : "");
    if ($("mHoes").getAttribute("src") !== nuSpeelt.hoes) $("mHoes").setAttribute("src", nuSpeelt.hoes);
    $("mSpeel").className = "mk" + (nuSpeelt.speelt ? " pauze" : " speel");
    tekenBalk(); tekenMuziekFocus();
  }
  function tekenBalk() {
    if (!nuSpeelt) return;
    var p = nuSpeelt.pos + (nuSpeelt.speelt ? Date.now() - nuSpeelt.toen : 0);
    $("mVoort").style.width = Math.min(100, p / nuSpeelt.duur * 100) + "%";
  }
  function tekenMuziekFocus() {
    var w = $("muziek"); if (!w) return;
    w.className = zone === "muziek" ? "focus" : "";
    var k = [$("mVorige"), $("mSpeel"), $("mVolgende")];
    k.forEach(function (el, i) { el.className = el.className.replace(" gekozen", "") + (zone === "muziek" && i === muziekFocus ? " gekozen" : ""); });
  }
  function muziekKnop(i) {
    if (!nuSpeelt) return;
    var pad = i === 0 ? ["POST", "/me/player/previous"] : i === 2 ? ["POST", "/me/player/next"] : nuSpeelt.speelt ? ["PUT", "/me/player/pause"] : ["PUT", "/me/player/play"];
    if (i === 1) { nuSpeelt.pos += nuSpeelt.speelt ? Date.now() - nuSpeelt.toen : 0; nuSpeelt.toen = Date.now(); nuSpeelt.speelt = !nuSpeelt.speelt; tekenMuziek(); }
    spVraag(pad[0], pad[1], function () { setTimeout(haalSpeler, 700); }, function (f) { melding("Spotify: " + f); setTimeout(haalSpeler, 700); });
  }
  function startSpotify() {
    clearInterval(spTimer);
    if (!sp) { nuSpeelt = null; tekenMuziek(); return; }
    haalSpeler();
    spTimer = setInterval(function () { if (!rust || Date.now() % 15000 < 5000) haalSpeler(); }, 5000);
  }
  setInterval(tekenBalk, 1000);
  function koppelSpotify(code) {
    var t = (code || "").replace(/\s+/g, ""), i = t.indexOf(":");
    if (i < 10) return melding("Die code klopt niet. Kopieer hem opnieuw op je gsm.");
    sp = { client: t.slice(0, i), refresh: t.slice(i + 1), access: null, tot: 0 };
    vernieuwToken(function () { bewaarSp(); melding("Spotify is gekoppeld"); startSpotify(); teken(); },
      function (f) { sp = null; melding("Koppelen lukt niet: " + f); teken(); });
  }

  // ---------- instellingen ----------
  var SECTIES = ["Foto's", "Spotify", "Wachter", "Over Rust TV"];
  var instSectie = 0, instKolom = 0, instI = 0, wachterStatus = "onbekend";
  var invoerDoel = null;
  function instItems() {
    if (instSectie === 0) return [
      { t: "Online, volgens seizoen en weer", s: "Elke dag een nieuwe foto die past bij het weer in Wevelgem", keuze: "online" },
      { t: "Mijn album", s: "Alleen foto's uit je gedeelde Google Foto's-album", keuze: "album" },
      { t: "Afwisselend", s: "Je eigen foto's en online foto's door elkaar", keuze: "mix" },
      koppel && koppel.doel === "album"
        ? { t: "Album koppelen met je gsm", s: "Open op je gsm " + KOPPELADRES + " en typ deze code:", code: koppel.code, doe: function () {} }
        : { t: "Album koppelen met je gsm", s: fotoInst.album ? "Gekoppeld: " + fotoInst.album + " · OK om te wijzigen" : "Nog niet ingesteld · druk op OK", doe: function () { startKoppel("album"); } },
      { t: "Albumlink typen", s: "Alleen als je een toetsenbord aan de tv hebt hangen", invoer: "album" },
      { t: "Andere foto", s: "Nu een andere foto tonen", doe: function () { fotoActie("andere"); } },
      { t: "Vaker tonen", s: "De foto van nu komt vaker terug", doe: function () { fotoActie("vaker"); } },
      { t: "Nooit meer tonen", s: "De foto van nu zie je niet meer", doe: function () { fotoActie("nooit"); } }
    ];
    if (instSectie === 1) return sp ? [
      { t: "Gekoppeld", s: nuSpeelt ? "Nu: " + nuSpeelt.titel + " · " + nuSpeelt.artiest : "Er speelt nu niets" },
      { t: "Ontkoppelen", s: "Spotify loskoppelen van deze tv", doe: function () { sp = null; schrijf("rusttv.spotify", null); startSpotify(); melding("Spotify losgekoppeld"); } }
    ] : [
      koppel && koppel.doel === "spotify"
        ? { t: "Spotify koppelen met je gsm", s: "Open op je gsm " + KOPPELADRES + " en typ deze code:", code: koppel.code, doe: function () {} }
        : { t: "Spotify koppelen met je gsm", s: "Druk op OK. Je krijgt een code om op je gsm in te typen.", doe: function () { startKoppel("spotify"); } },
      { t: "Code plakken", s: "Alleen als je een toetsenbord aan de tv hebt hangen", invoer: "spotify" }
    ];
    if (instSectie === 2) return [
      { t: "Wachter " + (wachterStatus === "actief" ? "actief" : wachterStatus === "uit" ? "niet actief" : "…"), s: "Opent Rust TV vanzelf als de tv aangaat", status: true },
      { t: "Wachter opnieuw starten", s: "Als hij niet actief is", doe: function () { startWachter(); setTimeout(checkWachter, 1500); } }
    ];
    return [{ t: "Rust TV", s: "Versie 1.6 · haalt updates zelf van GitHub" }];
  }
  function tekenInst() {
    var inv = $("invoer");
    if (invoerDoel && document.activeElement === inv) return;   // niet storen tijdens het typen
    document.body.appendChild(inv);
    var m = $("instMenu"); m.innerHTML = "";
    SECTIES.forEach(function (t, i) { var d = document.createElement("div"); d.className = "sectie" + (i === instSectie ? " gekozen" : "") + (instKolom === 0 && i === instSectie ? " focus" : ""); d.textContent = t; m.appendChild(d); });
    var p = $("instPaneel"); p.innerHTML = "";
    var h = document.createElement("h2"); h.textContent = instSectie === 0 ? "Waar komen de foto's vandaan?" : SECTIES[instSectie]; p.appendChild(h);
    var items = instItems(); if (instI >= items.length) instI = items.length - 1;
    items.forEach(function (it, i) {
      var d = document.createElement("div");
      d.className = "item" + (instKolom === 1 && i === instI ? " focus" : "") + (it.status ? (wachterStatus === "actief" ? " groen" : " rood") : "");
      if (it.keuze) { var r = document.createElement("span"); r.className = "rond" + (fotoInst.bron === it.keuze ? " aan" : ""); d.appendChild(r); }
      var tx = document.createElement("div"); tx.className = "tekst";
      var a = document.createElement("div"); a.className = "t"; a.textContent = it.t; tx.appendChild(a);
      if (it.s) { var b = document.createElement("div"); b.className = "s"; b.textContent = it.s; tx.appendChild(b); }
      if (it.code) { var c = document.createElement("div"); c.className = "code"; c.textContent = it.code.slice(0, 4) + " " + it.code.slice(4); tx.appendChild(c); }
      d.appendChild(tx);
      if (it.invoer && invoerDoel === it.invoer) { tx.appendChild($("invoer")); }
      p.appendChild(d);
    });
    $("wachterLampje").className = wachterStatus === "actief" ? "aan" : "";
  }
  function instToets(k) {
    if (k === 37) instKolom = 0;
    if (k === 39) { instKolom = 1; instI = 0; }
    if (k === 38) { if (instKolom === 0) instSectie = Math.max(0, instSectie - 1); else instI = Math.max(0, instI - 1); }
    if (k === 40) { if (instKolom === 0) instSectie = Math.min(SECTIES.length - 1, instSectie + 1); else instI = Math.min(instItems().length - 1, instI + 1); }
    if (instKolom === 0) instI = 0;
    if (instSectie === 2) checkWachter();
    teken();
  }
  function instOk() {
    if (instKolom === 0) { instKolom = 1; instI = 0; return teken(); }
    var it = instItems()[instI]; if (!it) return;
    if (it.keuze) { fotoInst.bron = it.keuze; fotoInst.extra = 0; bewaarFotoInst(); foto(true); return teken(); }
    if (it.invoer) return startInvoer(it.invoer);
    if (it.doe) { it.doe(); return teken(); }
  }
  function startInvoer(doel) {
    invoerDoel = doel; teken();
    var i = $("invoer"); i.hidden = false;
    i.value = doel === "album" ? fotoInst.album : "";
    i.placeholder = doel === "album" ? "https://photos.app.goo.gl/…" : "plak hier de code van je gsm";
    setTimeout(function () { i.focus(); }, 50);
  }
  function bewaarInvoer() {
    var i = $("invoer"), v = i.value.trim(), doel = invoerDoel;
    stopInvoer();
    if (doel === "album") zetAlbum(v);
    if (doel === "spotify" && v) koppelSpotify(v);
    teken();
  }
  function zetAlbum(v) {
    v = (v || "").trim();
    if (v && !/^https:\/\/(photos\.app\.goo\.gl|photos\.google\.com|goo\.gl)\//.test(v)) { melding("Dat lijkt geen link van Google Foto's"); return teken(); }
    fotoInst.album = v; albumLijst = null; bewaarFotoInst();
    if (v) { melding("Album gekoppeld, de foto's worden geladen…"); laadAlbum(function (l) { melding(l.length + " foto's gevonden"); if (fotoInst.bron === "online") fotoInst.bron = "mix"; bewaarFotoInst(); foto(true); teken(); }, function (f) { melding(f); }); }
    teken();
  }

  // ---------- koppelen met je gsm (zonder SmartThings) ----------
  // De tv toont een code van 8 tekens. Je gsm stuurt de gegevens via ntfy.sh naar een kanaal met die code.
  // Er wordt niets bewaard: alleen de tv die op dat moment luistert, krijgt het bericht.
  var KOPPELADRES = "jitsevanhauwaert.github.io/rust-tv/koppel.html";
  var koppel = null;   // {doel, code, xhr, tot}
  function nieuweCode() {
    var t = "ABCDEFGHJKMNPQRSTUVWXYZ23456789", c = "";
    for (var i = 0; i < 8; i++) c += t[Math.floor(Math.random() * t.length)];
    return c;
  }
  function startKoppel(doel) {
    stopKoppel();
    koppel = { doel: doel, code: nieuweCode(), tot: Date.now() + 15 * 60000 };
    luister(koppel);
    teken();
  }
  function stopKoppel() {
    if (koppel && koppel.xhr) { try { koppel.xhr.abort(); } catch (e) {} }
    koppel = null;
  }
  function luister(k) {
    if (koppel !== k) return;
    if (Date.now() > k.tot) { stopKoppel(); melding("De koppelcode is verlopen. Druk opnieuw op OK."); return teken(); }
    var x = new XMLHttpRequest(), gelezen = 0;
    k.xhr = x;
    x.open("GET", "https://ntfy.sh/rusttv-" + k.code.toLowerCase() + "/json");
    function verwerk() {
      var tekst = x.responseText || "", nl;
      while ((nl = tekst.indexOf("\n", gelezen)) >= 0) {
        var regel = tekst.slice(gelezen, nl); gelezen = nl + 1;
        try {
          var m = JSON.parse(regel);
          if (m.event !== "message") continue;
          var d = JSON.parse(m.message);
          if (koppel !== k) return;
          if (d.soort !== k.doel) continue;
          stopKoppel();
          if (d.soort === "album") zetAlbum(d.waarde);
          if (d.soort === "spotify") koppelSpotify(d.waarde);
          return teken();
        } catch (e) {}
      }
    }
    x.onprogress = verwerk;
    x.onload = x.onerror = function () { verwerk(); if (koppel === k) setTimeout(function () { luister(k); }, 2000); };
    x.send();
  }

  function stopInvoer() {
    var i = $("invoer"); i.blur(); i.hidden = true; document.body.appendChild(i);
    invoerDoel = null; teken();
  }

  // ---------- wachter ----------
  var WACHTER = "RustTVjvh1.Wachter";
  function startWachter() {
    if (!window.tizen || !tizen.application || !tizen.ApplicationControl) return;
    try {
      tizen.application.launchAppControl(
        new tizen.ApplicationControl("http://tizen.org/appcontrol/operation/service"), WACHTER,
        function () { wachterStatus = "actief"; },
        function (e) { wachterStatus = "uit"; melding("Wachter start niet: " + (e && e.message ? e.message : e)); });
    } catch (e) { wachterStatus = "uit"; melding("Wachter start niet: " + (e && e.message ? e.message : e)); }
  }
  function checkWachter() {
    if (!window.tizen || !tizen.application) return;
    try {
      tizen.application.getAppsContext(function (l) {
        var aan = l.some(function (c) { return c.appId === WACHTER; });
        wachterStatus = aan ? "actief" : "uit";
        if (!aan) startWachter();
        if (scherm === "inst") tekenInst();
      }, function () {});
    } catch (e) {}
  }

  // ---------- start ----------
  startWachter();
  setTimeout(checkWachter, 3000);
  setInterval(checkWachter, 60000);      // elke minuut: draait de wachter nog? anders opnieuw starten
  laadApps(function () { laadFavorieten(); laadVerborgen(); teken(); });
  klok(); setInterval(klok, 15000);
  weer(); setInterval(weer, 30 * 60000);
  startSpotify();
  // Komt de app terug in beeld (na Netflix bv.): lijst en klok vernieuwen
  document.addEventListener("visibilitychange", function () {
    if (document.hidden && hdmiActief) sluitIngang();
    if (!document.hidden) { laatsteToets = Date.now(); rust = false; klasse(); startWachter(); klok(); haalSpeler(); laadApps(function () { laadFavorieten(); teken(); }); }
  });
})();
