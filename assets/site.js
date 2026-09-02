/* Open-now badge and closure banner, computed from the hours embedded in the page. No network. */
(function () {
  var el = document.getElementById("hours-data");
  if (!el) return;
  var H;
  try { H = JSON.parse(el.textContent); } catch (e) { return; }
  var DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  var tz = H.timezone || "America/New_York";

  function nowParts() {
    var f = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
    var p = {};
    f.formatToParts(new Date()).forEach(function (x) { p[x.type] = x.value; });
    var hour = parseInt(p.hour, 10); if (hour === 24) hour = 0;
    return { day: p.weekday.toLowerCase().slice(0, 3), date: p.year + "-" + p.month + "-" + p.day, mins: hour * 60 + parseInt(p.minute, 10) };
  }
  function addDays(iso, n) {
    var d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }
  function dayOf(iso) { return DAYS[new Date(iso + "T12:00:00Z").getUTCDay()]; }
  function toMins(t) { var a = t.split(":"); return parseInt(a[0], 10) * 60 + parseInt(a[1], 10); }
  function fmt(t) {
    var m = toMins(t), h = Math.floor(m / 60), mm = m % 60, ap = h >= 12 ? "pm" : "am"; h = h % 12; if (h === 0) h = 12;
    return h + (mm ? ":" + (mm < 10 ? "0" : "") + mm : "") + " " + ap;
  }
  function scheduleFor(iso) {
    var c = (H.closures || []).filter(function (x) { return x.date === iso; })[0];
    if (c) return { closed: true, note: c.note };
    var o = (H.overrides || []).filter(function (x) { return x.date === iso; })[0];
    if (o) return { open: o.open, close: o.close, note: o.note };
    var r = H.regular[dayOf(iso)];
    return r ? { open: r.open, close: r.close } : { closed: true };
  }

  var n = nowParts();
  var today = scheduleFor(n.date);
  var text, cls;
  if (!today.closed && n.mins >= toMins(today.open) && n.mins < toMins(today.close)) {
    var left = toMins(today.close) - n.mins;
    text = "Open now · " + (left <= 60 ? "closes in " + left + " min" : "closes " + fmt(today.close));
    cls = "is-open";
  } else if (!today.closed && n.mins < toMins(today.open)) {
    text = "Closed · opens " + fmt(today.open) + " today";
    cls = "is-closed";
  } else {
    var next = null, label = "";
    for (var i = 1; i <= 7; i++) {
      var iso = addDays(n.date, i), s = scheduleFor(iso);
      if (!s.closed) { next = s; label = i === 1 ? "tomorrow" : dayOf(iso).charAt(0).toUpperCase() + dayOf(iso).slice(1); break; }
    }
    text = next ? "Closed · opens " + fmt(next.open) + " " + label : "Closed";
    cls = "is-closed";
  }
  Array.prototype.forEach.call(document.querySelectorAll(".open-badge"), function (b) {
    b.textContent = text; b.classList.remove("is-open", "is-closed"); b.classList.add(cls);
  });

  var banner = document.getElementById("closure-banner");
  if (banner) {
    var t0 = scheduleFor(n.date), t1 = scheduleFor(addDays(n.date, 1));
    var msg = "";
    if (t0.closed && t0.note) msg = t0.note + " today.";
    else if (t0.note) msg = "Today: " + t0.note + " — open " + fmt(t0.open) + " to " + fmt(t0.close) + ".";
    else if (t1.closed && t1.note) msg = "Tomorrow: " + t1.note.replace(/^Closed /i, "closed ") + ".";
    else if (t1.note) msg = "Tomorrow: " + t1.note + " — open " + fmt(t1.open) + " to " + fmt(t1.close) + ".";
    if (msg) { banner.textContent = msg; banner.hidden = false; }
  }
})();
