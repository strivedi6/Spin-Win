/* Together & Co. — Spin & Win · shared code for index.html (screen) and admin.html */
(function (W) {
"use strict";
const T = W.TCO = {};

/* ---------------- server (Google Apps Script web app) ---------------- */
T.API = ((W.SPIN_CONFIG && W.SPIN_CONFIG.API) || "").trim();
function withTimeout(ms){ const c = new AbortController(); const t = setTimeout(() => c.abort(), ms); return { signal: c.signal, done: () => clearTimeout(t) }; }
T.get = async function (data, ms) {
  if (!T.API) throw new Error("noapi");
  const t = withTimeout(ms || 25000);
  try {
    const r = await fetch(T.API + "?d=" + encodeURIComponent(JSON.stringify(data)), { signal: t.signal, cache: "no-store", redirect: "follow" });
    if (!r.ok) throw new Error("http" + r.status);
    return await r.json();
  } catch (e) { throw new Error(e.name === "AbortError" ? "timeout" : (e.message || "unreachable")); }
  finally { t.done(); }
};
T.post = async function (data, ms) {
  if (!T.API) throw new Error("noapi");
  const t = withTimeout(ms || 30000);
  try {
    // text/plain body = no CORS pre-flight, works with Apps Script
    const r = await fetch(T.API, { method: "POST", body: JSON.stringify(data), signal: t.signal, redirect: "follow" });
    if (!r.ok) throw new Error("http" + r.status);
    return await r.json();
  } catch (e) { throw new Error(e.name === "AbortError" ? "timeout" : (e.message || "unreachable")); }
  finally { t.done(); }
};
T.errText = function (e) {
  const m = e && e.message || String(e);
  if (m === "noapi") return "The Google Sheet link is missing in config.js.";
  if (m === "timeout") return "Google took too long to answer. Please try again.";
  if (/^http|Failed to fetch|NetworkError|unreachable|Load failed/i.test(m)) return "Can't reach the Google Sheet. Check the internet connection and the web app link in config.js.";
  return m;
};

/* ---------------- helpers ---------------- */
const pad = n => String(n).padStart(2, "0");
T.pad = pad;
T.isoDay = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
T.today = () => T.isoDay(new Date());
T.addDays = (iso, n) => { const [y,m,d] = iso.split("-").map(Number); return T.isoDay(new Date(y, m-1, d + n)); };
T.niceDate = (iso, long) => { if (!iso) return ""; const [y,m,d] = String(iso).slice(0,10).split("-").map(Number); if (!y) return iso; return new Date(y, m-1, d).toLocaleDateString("en-GB", long ? {weekday:"long", day:"numeric", month:"long", year:"numeric"} : {day:"numeric", month:"short", year:"numeric"}); };
T.esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
T.yes = v => /^(yes|y|true|1|on)$/i.test(String(v == null ? "" : v).trim());
T.lum = hex => { const n = parseInt(String(hex).slice(1),16); const c = [n>>16, n>>8&255, n&255].map(v => { v/=255; return v <= .03928 ? v/12.92 : Math.pow((v+.055)/1.055, 2.4); }); return .2126*c[0] + .7152*c[1] + .0722*c[2]; };
T.inkFor = hex => T.lum(hex) > .28 ? "#211F1B" : "#EEEAE9";
T.PALETTE = [["Olive","#B0AA54"],["Blush","#D0A9A0"],["Sand","#D6CFBC"],["Mist","#D7D8D4"],["Linen","#EEEAE9"],["Ink","#211F1B"]];
T.COLOR_NAMES = { olive:"#B0AA54", blush:"#D0A9A0", sand:"#D6CFBC", mist:"#D7D8D4", linen:"#EEEAE9", ink:"#211F1B", black:"#211F1B", pink:"#D0A9A0", beige:"#D6CFBC", grey:"#D7D8D4", gray:"#D7D8D4", green:"#B0AA54" };
T.colorName = hex => { const p = T.PALETTE.find(x => x[1].toLowerCase() === String(hex).toLowerCase()); return p ? p[0] : hex; };

/* ---------------- settings (Settings tab: key → text) ---------------- */
T.DEFAULT_SETTINGS = {
  validDays:"15", onePerDay:"Yes", spinSeconds:"7", standbySpeed:"6", idleSeconds:"15", voucherSeconds:"60", sound:"Yes",
  slideImageSeconds:"8", slideFit:"Fill", videoSound:"No", wheelEvery:"3", wheelSeconds:"15",
  scheduleOn:"No", scheduleDays:"Mon,Tue,Wed,Thu,Fri,Sat,Sun", scheduleFrom:"10:00", scheduleTo:"22:00",
  "text.kicker":"Tap · Spin · Win", "text.title":"Spin & Win",
  "text.footer":"One spin per guest per day · Prizes valid for {days} days · T&Cs apply",
  "text.swipeHint":"Tap spin or swipe the wheel", "text.winEyebrow":"Congratulations, you won",
  "text.winNote":"Claim your personal voucher now. Valid for {days} days.", "text.loseNote":"Come back tomorrow for another spin.",
  "text.formTitle":"You won! *Let's* make it yours.", "text.formLead":"Add your details and we'll create your personal voucher.",
  "text.consent":"I agree to the voucher terms & conditions and to Together & Co. storing my details to issue this voucher.",
  "text.optin":"Send me news and offers from Together & Co. (optional)",
  "text.photoHint":"Take a photo of your voucher and show it to our team on your next visit.",
  "text.closedText":"Spin & Win is available {schedule}. See you then!",
  terms:["Valid for one-time use within {days} days of issue, until the date shown above.",
    "Valid at Together & Co. only. Please show this voucher before ordering.",
    "Issued in the guest's name; non-transferable and not exchangeable for cash.",
    "Cannot be combined with any other offer, promotion or discount.",
    "Lost, expired or altered vouchers cannot be replaced or honoured.",
    "Together & Co. reserves the right to amend or withdraw this offer."].join("\n")
};
T.TEXT_KEYS = [
  ["kicker","Small heading above the title"],["title","Main title (an & is styled automatically)"],["footer","Footer line"],
  ["swipeHint","Hint under the Spin button"],["winEyebrow","Win pop-up — heading"],["winNote","Win pop-up — note"],
  ["loseNote","No-prize pop-up — note"],["formTitle","Claim form — heading (*word* = olive italic)"],["formLead","Claim form — intro"],
  ["consent","Consent checkbox"],["optin","Marketing opt-in checkbox"],["photoHint","Voucher screen — photo instruction"],
  ["closedText","Message outside Spin & Win hours ({schedule} = days & times)"]
];
const DAY_NAMES = T.DAY_NAMES = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const num = (v, d, lo, hi) => { const n = parseFloat(v); return isNaN(n) ? d : Math.max(lo, Math.min(hi, n)); };
const hhmm = v => { const m = String(v || "").match(/(\d{1,2}):(\d{2})/); return m ? pad(+m[1]) + ":" + m[2] : "00:00"; };
T.parseSettings = function (raw) {
  const s = Object.assign({}, T.DEFAULT_SETTINGS, raw || {});
  const daysTxt = String(s.scheduleDays || "").toLowerCase();
  const text = {}; T.TEXT_KEYS.forEach(([k]) => text[k] = s["text." + k] != null ? String(s["text." + k]) : "");
  return {
    validDays: num(s.validDays, 15, 1, 365), onePerDay: T.yes(s.onePerDay), spinSeconds: num(s.spinSeconds, 7, 3, 15),
    standbySpeed: num(s.standbySpeed, 6, 0, 60), idleSeconds: num(s.idleSeconds, 15, 5, 300), voucherSeconds: num(s.voucherSeconds, 60, 15, 600),
    sound: T.yes(s.sound),
    slideshow: { imageSeconds: num(s.slideImageSeconds, 8, 2, 120), fit: /fit|contain|whole/i.test(s.slideFit) ? "contain" : "cover",
                 sound: T.yes(s.videoSound), wheelEvery: num(s.wheelEvery, 3, 0, 50), wheelSeconds: num(s.wheelSeconds, 15, 5, 300) },
    schedule: { enabled: T.yes(s.scheduleOn), days: DAY_NAMES.map(d => daysTxt.includes(d.toLowerCase())), from: hhmm(s.scheduleFrom), to: hhmm(s.scheduleTo) },
    text, terms: String(s.terms || "").split(/\r?\n/).map(x => x.trim()).filter(Boolean)
  };
};
T.settingsToRaw = function (c) {
  const r = {
    validDays: c.validDays, onePerDay: c.onePerDay ? "Yes" : "No", spinSeconds: c.spinSeconds, standbySpeed: c.standbySpeed,
    idleSeconds: c.idleSeconds, voucherSeconds: c.voucherSeconds, sound: c.sound ? "Yes" : "No",
    slideImageSeconds: c.slideshow.imageSeconds, slideFit: c.slideshow.fit === "contain" ? "Fit" : "Fill", videoSound: c.slideshow.sound ? "Yes" : "No",
    wheelEvery: c.slideshow.wheelEvery, wheelSeconds: c.slideshow.wheelSeconds,
    scheduleOn: c.schedule.enabled ? "Yes" : "No", scheduleDays: DAY_NAMES.filter((d, i) => c.schedule.days[i]).join(","),
    scheduleFrom: c.schedule.from, scheduleTo: c.schedule.to, terms: c.terms.join("\n")
  };
  T.TEXT_KEYS.forEach(([k]) => r["text." + k] = c.text[k] || "");
  Object.keys(r).forEach(k => r[k] = String(r[k]));
  return r;
};

/* ---------------- schedule ---------------- */
const toMin = t => { const [h, m] = String(t || "0:0").split(":").map(Number); return (h||0)*60 + (m||0); };
T.inSchedule = function (sc, at) {
  if (!sc || !sc.enabled) return true;
  const d = at || new Date(), day = d.getDay(), mins = d.getHours()*60 + d.getMinutes(), f = toMin(sc.from), t = toMin(sc.to);
  if (f === t) return !!sc.days[day];
  if (f < t) return !!sc.days[day] && mins >= f && mins < t;
  if (mins >= f) return !!sc.days[day];
  if (mins < t) return !!sc.days[(day + 6) % 7];
  return false;
};
T.scheduleText = function (sc) {
  if (!sc || !sc.enabled) return "all day, every day";
  const order = [1,2,3,4,5,6,0], on = order.filter(i => sc.days[i]);
  let days;
  if (on.length === 7) days = "every day";
  else if (!on.length) days = "on no days";
  else {
    const runs = []; let run = [];
    order.forEach(i => { if (sc.days[i]) run.push(i); else if (run.length){ runs.push(run); run = []; } }); if (run.length) runs.push(run);
    days = runs.map(r => r.length > 2 ? `${DAY_NAMES[r[0]]}–${DAY_NAMES[r[r.length-1]]}` : r.map(i => DAY_NAMES[i]).join(", ")).join(", ");
  }
  return `${days}, ${toMin(sc.from) === toMin(sc.to) ? "all day" : `${sc.from}–${sc.to}`}`;
};

/* ---------------- awards (Spin awards tab rows ⇄ wheel prizes) ---------------- */
T.DEFAULT_AWARD_ROWS = [
  { name:"50% Off", type:"Prize", w1:"50% OFF", w2:"TOTAL BILL", title:"50% off", sub:"your total bill", color:"Olive", slices:"2", odds:"5", term:"The 50% discount applies to the total food and beverage bill for the voucher holder's table.", active:"Yes" },
  { name:"Free Coffee", type:"Prize", w1:"FREE COFFEE", w2:"WITH ANY PASTRY", title:"Free coffee", sub:"when you order any pastry", color:"Sand", slices:"2", odds:"30", term:"One complimentary regular coffee with the purchase of any pastry.", active:"Yes" },
  { name:"Better Luck", type:"No Prize", w1:"BETTER LUCK", w2:"NEXT TIME", title:"So close!", sub:"Better luck next time", color:"Ink", slices:"2", odds:"35", term:"", active:"Yes" },
  { name:"25% Off", type:"Prize", w1:"25% OFF", w2:"TOTAL BILL", title:"25% off", sub:"your total bill", color:"Blush", slices:"2", odds:"15", term:"The 25% discount applies to the total food and beverage bill for the voucher holder's table.", active:"Yes" },
  { name:"Free Spin", type:"Free Spin", w1:"FREE SPIN", w2:"SPIN AGAIN", title:"One more spin", sub:"on the house", color:"Mist", slices:"2", odds:"15", term:"", active:"Yes" }
];
T.validatePrizes = function (P) {
  const live = P.filter(p => p.active !== false && (p.slices|0) > 0);
  const n = live.reduce((s,p) => s + (p.slices|0), 0);
  if (live.length < 2) return "At least two awards need slices on the wheel.";
  if (n < 4 || n > 20) return `Use between 4 and 20 slices in total (now ${n}).`;
  if (!live.some(p => +p.odds > 0)) return "At least one award needs a chance above 0.";
  for (const p of P) if (!String(p.title).trim() || !String(p.w1).trim()) return "Every award needs a title and wheel text.";
  return "";
};
T.typeOf = t => { t = String(t || "").toLowerCase().trim(); return t.includes("spin") ? "again" : (t.startsWith("no") || t.includes("lose") || t.includes("better")) ? "lose" : "win"; };
T.TYPE_LABEL = { win: "Prize", again: "Free Spin", lose: "No Prize" };
T.colorHex = c => { c = String(c || "").trim(); return T.COLOR_NAMES[c.toLowerCase()] || (/^#?[0-9a-f]{6}$/i.test(c) ? (c[0] === "#" ? c : "#" + c) : ""); };
// all rows (incl. inactive) → prizes; inactive ones keep active:false
T.rowsToPrizes = function (rows) {
  const used = new Set(), problems = [];
  const prizes = (rows || []).map((r, i) => {
    let color = T.colorHex(r.color);
    if (!color){ if (r.color) problems.push(`Row ${i+2}: colour "${r.color}" not recognised — used Sand`); color = "#D6CFBC"; }
    const title = String(r.title || r.name || "").trim();
    let id = "S-" + String(r.name || title).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    while (used.has(id)) id += "x"; used.add(id);
    const sl = parseInt(r.slices, 10), od = parseFloat(String(r.odds).replace("%", ""));
    return { id, name: String(r.name || title), type: T.typeOf(r.type), w1: String(r.w1 || title).slice(0, 16), w2: String(r.w2 || "").slice(0, 20),
      title: title.slice(0, 24), sub: String(r.sub || "").slice(0, 44), color, slices: isNaN(sl) ? 1 : Math.max(0, Math.min(4, sl)),
      odds: isNaN(od) ? 0 : Math.max(0, od), term: String(r.term || ""), active: !/^(no|n|false|0|off)$/i.test(String(r.active || "yes").trim()) };
  });
  return { prizes, problems };
};
T.prizesToRows = P => P.map(p => ({ name: p.name || p.title, type: T.TYPE_LABEL[p.type], w1: p.w1, w2: p.w2, title: p.title, sub: p.sub,
  color: T.colorName(p.color), slices: p.slices, odds: p.odds, term: p.type === "win" ? p.term : "", active: p.active !== false }));
T.buildSegments = function (prizes) {
  const list = prizes.filter(p => p.active !== false && (p.slices|0) > 0), left = list.map(p => p.slices|0), seq = [];
  let more = true;
  while (more){ more = false; list.forEach((p,i) => { if (left[i] > 0){ seq.push(p.id); left[i]--; more = true; } }); }
  return seq;
};

/* ---------------- wheel drawing ---------------- */
function fitText(c, txt, x, y, maxW, size, weight, spacing){
  let s = size; const fam = "Jost, 'Century Gothic', sans-serif";
  const measure = () => { c.font = `${weight} ${s}px ${fam}`; return c.measureText(txt).width + spacing*s*(txt.length-1); };
  while (measure() > maxW && s > 14) s -= 2;
  if (!spacing){ c.fillText(txt, x, y); return; }
  let cx = x; for (let i = txt.length - 1; i >= 0; i--){ c.fillText(txt[i], cx, y); cx -= c.measureText(txt[i]).width + spacing*s; }
}
T.drawWheel = function (canvas, prizes, segs) {
  const byId = {}; prizes.forEach(p => byId[p.id] = p);
  const c = canvas.getContext("2d"), S = canvas.width, R = S/2, k = S/1800, n = segs.length || 1, sg = 360/n;
  c.clearRect(0,0,S,S); c.save(); c.translate(R,R);
  segs.forEach((id, i) => {
    const p = byId[id]; if (!p) return;
    const a0 = (i*sg - 90) * Math.PI/180, a1 = ((i+1)*sg - 90) * Math.PI/180;
    c.beginPath(); c.moveTo(0,0); c.arc(0,0,R,a0,a1); c.closePath(); c.fillStyle = p.color; c.fill();
    c.strokeStyle = "rgba(255,255,255,.55)"; c.lineWidth = 4*k; c.stroke();
    c.save(); c.rotate(((i+0.5)*sg - 90) * Math.PI/180);
    c.fillStyle = T.inkFor(p.color); c.textAlign = "right"; c.textBaseline = "middle";
    const maxH = 2 * (R*0.62) * Math.tan(sg/2*Math.PI/180);
    const s1 = Math.min(74*k, maxH*0.42), s2 = Math.min(40*k, maxH*0.24);
    fitText(c, (p.w1||"").toUpperCase(), R - 100*k, (p.w2 ? -s1*0.4 : 0), 560*k, s1, "600", 0);
    if (p.w2){ c.globalAlpha = .82; fitText(c, p.w2.toUpperCase(), R - 102*k, s1*0.62, 520*k, s2, "500", .14); }
    c.restore();
  });
  c.beginPath(); c.arc(0,0,R*0.24,0,Math.PI*2); c.fillStyle = "rgba(33,31,27,.08)"; c.fill();
  for (let i = 0; i < n; i++){   // pegs on the slice boundaries
    const a = (i*sg - 90) * Math.PI/180, x = Math.cos(a)*R*0.93, y = Math.sin(a)*R*0.93;
    c.beginPath(); c.arc(x + 3*k, y + 5*k, 19*k, 0, Math.PI*2); c.fillStyle = "rgba(0,0,0,.28)"; c.fill();
    const g = c.createRadialGradient(x - 6*k, y - 6*k, 2*k, x, y, 19*k); g.addColorStop(0, "#fffdf6"); g.addColorStop(.6, "#d9d2bd"); g.addColorStop(1, "#8d8672");
    c.beginPath(); c.arc(x, y, 18*k, 0, Math.PI*2); c.fillStyle = g; c.fill(); c.lineWidth = 3*k; c.strokeStyle = "#211F1B"; c.stroke();
  }
  c.restore();
};

/* ---------------- voucher card ---------------- */
// r: {code, first, last, prizeTitle, prizeSub, prizeTerm, prizeColor, day, time, expiry, status}
T.voucherHTML = function (r, logo, terms, days) {
  const esc = T.esc, acc = /^#[0-9a-f]{6}$/i.test(r.prizeColor || "") ? r.prizeColor : "#B0AA54";
  const ampCol = T.lum(acc) > .45 ? "#9b9474" : acc;
  const list = [r.prizeTerm].concat((terms || []).map(t => String(t).replace(/\{days\}/g, days || 15))).filter(Boolean);
  const name = `${r.first} ${r.last}`, t = r.prizeTitle || "", tSize = t.length > 14 ? 84 : t.length > 10 ? 104 : 128;
  const stamp = r.status === "Redeemed" ? "REDEEMED" : r.status === "Expired" ? "EXPIRED" : "";
  return `<div class="vcard" style="position:relative">
    <div class="vtop"><div class="vbar" style="background:${acc}"></div>
      <img class="vlogo" src="${esc(logo)}" alt="">
      <div class="vgift">A GIFT FOR</div>
      <div class="vname" style="${name.length > 20 ? "font-size:58px" : ""}">${esc(name)}</div>
      <div class="vamp"><span></span><i style="color:${ampCol}">&amp;</i><span></span></div>
      <div class="vtitle" style="font-size:${tSize}px">${esc(t)}</div>
      <div class="vsub">${esc(r.prizeSub || "")}</div>
    </div>
    <div class="vperf"></div>
    <div class="vbot">
      <div class="vlabel">VOUCHER CODE</div>
      <div class="vcode">${esc(r.code)}</div>
      <div class="vvalid">Valid until ${T.niceDate(r.expiry)}</div>
      <div class="vissued">Issued ${T.niceDate(r.day)}${r.time ? ` at ${esc(String(r.time).slice(0,5))}` : ""}</div>
      ${list.length ? `<div class="vterms"><b>TERMS &amp; CONDITIONS</b><ul>${list.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>` : ""}
    </div>
    ${stamp ? `<div class="vstamp">${stamp}</div>` : ""}
  </div>`;
};
})(window);
