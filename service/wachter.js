// Rust TV-wachter (v1.6): draait op de achtergrond.
// - Start mee met de tv (als de tv dat toelaat) en opent dan Rust TV.
// - Merkt wanneer de tv uit de slaapstand komt (de klok stond even stil) en opent dan meteen Rust TV.
var APP = "RustTVjvh1.RustTV";
var TIK = 1000;        // elke seconde kijken
var SPRONG = 8000;     // meer dan 8 s stil = de tv sliep
var vorige = Date.now();
var laatsteStart = 0;
var timer = null;

function openRust() {
  var nu = Date.now();
  if (nu - laatsteStart < 8000) return;   // niet twee keer na elkaar
  laatsteStart = nu;
  var pogingen = 0;
  (function probeer() {
    pogingen++;
    try {
      tizen.application.launch(APP, function () {}, function () {
        if (pogingen < 10) setTimeout(probeer, 700);   // de tv is soms nog niet klaar
      });
    } catch (e) { if (pogingen < 10) setTimeout(probeer, 700); }
  })();
}

function tik() {
  var nu = Date.now();
  if (nu - vorige > SPRONG) openRust();
  vorige = nu;
}
function zekerAan() {
  vorige = Date.now();
  if (!timer) timer = setInterval(tik, TIK);
}

module.exports.onStart = function () {
  zekerAan();
  // net gestart: bij het opstarten van de tv meteen Rust TV openen
  // (als Rust TV zelf de wachter start, staat Rust TV al open en verandert er niets)
  // Alleen als Rust TV nog niet draait (dus echt na het opstarten), anders zouden we Netflix onderbreken.
  setTimeout(function () {
    try {
      tizen.application.getAppsContext(function (l) {
        var draait = l.some(function (c) { return c.appId === APP; });
        if (!draait) openRust();
      }, function () {});
    } catch (e) {}
  }, 1500);
};
module.exports.onRequest = function () { zekerAan(); };
module.exports.onExit = function () {
  if (timer) clearInterval(timer);
  timer = null;
};
