// Rust TV-wachter: draait op de achtergrond.
// Als de tv uit "Snel inschakelen" wakker wordt, stond de klok een tijd stil.
// Die sprong in de tijd merken we op, en dan openen we Rust TV.
var APP = "RustTVjvh1.RustTV";
var TIK = 2000;        // elke 2 seconden kijken
var SPRONG = 20000;    // meer dan 20 s stil = de tv sliep
var vorige = Date.now();
var laatsteStart = 0;
var timer = null;

function openRust() {
  var nu = Date.now();
  if (nu - laatsteStart < 10000) return;   // niet twee keer na elkaar
  laatsteStart = nu;
  var pogingen = 0;
  (function probeer() {
    pogingen++;
    try {
      tizen.application.launch(APP, function () {}, function () {
        if (pogingen < 5) setTimeout(probeer, 1500);   // tv is soms nog niet klaar
      });
    } catch (e) { if (pogingen < 5) setTimeout(probeer, 1500); }
  })();
}

function tik() {
  var nu = Date.now();
  if (nu - vorige > SPRONG) setTimeout(openRust, 1500);
  vorige = nu;
}

module.exports.onStart = function () {
  vorige = Date.now();
  if (!timer) timer = setInterval(tik, TIK);
};
module.exports.onRequest = function () {
  vorige = Date.now();
  if (!timer) timer = setInterval(tik, TIK);
};
module.exports.onExit = function () {
  if (timer) clearInterval(timer);
  timer = null;
};
