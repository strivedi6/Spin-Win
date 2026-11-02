// =====================================================================
//  Together & Co. — Spin & Win  ·  Google Sheet backend (GitHub Pages edition)
//
//  1. Extensions → Apps Script → replace everything with this file → Save
//  2. Choose "setup" in the toolbar → ▶ Run → allow access
//  3. Deploy → Manage deployments → ✏️ → Version: New version → Deploy
//     (first time: Deploy → New deployment → Web app · Execute as: Me · Access: Anyone)
//  4. Put the Web app URL (…/exec) in config.js on GitHub
// =====================================================================

// ---- Who may edit what directly in the Sheet (everyone else: view only, F&B: Status column) ----
var AWARD_EDITORS = [];      // e.g. ['manager@gmail.com'] — may edit the Spin awards tab
var SLIDE_EDITORS = [];      // may edit Order / Seconds / Show in the Slideshow tab
var DEFAULT_PIN   = '2468';  // first admin PIN (change it in admin.html → Settings)

var GUEST_HEAD = ['Voucher Code','Date','Time','First Name','Last Name','Mobile','Email','Prize',
                  'Valid Until','Marketing Opt-in','Status','Redeemed On'];
var SPIN_HEAD  = ['Spin ID','Date','Time','Result','Bonus Spin'];
var AWARD_HEAD = ['Award','Type','Wheel Line 1','Wheel Line 2','Title','Subtitle','Colour',
                  'Slices','Chance','Voucher Condition','Active'];
var SLIDE_HEAD = ['Order','File Name','Type','Seconds','Show','File ID'];
var SET_HEAD   = ['Setting','Value','What it does'];
var STATUS_COL = 11, REDEEMED_COL = 12, VALID_COL = 9, EMAIL_COL = 7;
var FOLDER_NAME = 'Spin & Win Slideshow', BRAND_FOLDER = 'Spin & Win Branding';
var MAX_SCREEN_MB = 45, MAX_UPLOAD_MB = 25, CHUNK = 5 * 1024 * 1024;
var LOCK_TAG = 'Spin & Win lock';

var SETTINGS = [
  ['validDays',        '15',   'Days a voucher stays valid'],
  ['onePerDay',        'Yes',  'One voucher per email address per day (Yes / No)'],
  ['spinSeconds',      '7',    'Length of each spin in seconds'],
  ['standbySpeed',     '6',    'Standby wheel speed (degrees per second, 6 = one turn a minute)'],
  ['idleSeconds',      '15',   'Return to the home screen after no touch for … seconds'],
  ['voucherSeconds',   '60',   'How long the voucher stays on screen (seconds)'],
  ['sound',            'Yes',  'Sound effects (Yes / No)'],
  ['slideImageSeconds','8',    'Default seconds per slideshow photo'],
  ['slideFit',         'Fill', 'Photos: Fill (crop to screen) or Fit (show whole photo)'],
  ['videoSound',       'No',   'Play slideshow video sound (Yes / No)'],
  ['wheelEvery',       '3',    'Show the Spin & Win wheel after every … slideshow items (0 = never)'],
  ['wheelSeconds',     '15',   '…and keep it on screen for … seconds'],
  ['scheduleOn',       'No',   'Only offer Spin & Win on the days/times below (Yes / No)'],
  ['scheduleDays',     'Mon,Tue,Wed,Thu,Fri,Sat,Sun', 'Days Spin & Win is available'],
  ['scheduleFrom',     '10:00','Available from (24h)'],
  ['scheduleTo',       '22:00','Available until (24h). Same as From = all day; earlier than From = past midnight'],
  ['text.kicker',      'Tap · Spin · Win', 'Small heading above the title'],
  ['text.title',       'Spin & Win', 'Main title'],
  ['text.footer',      'One spin per guest per day · Prizes valid for {days} days · T&Cs apply', 'Footer line ({days} = validity)'],
  ['text.swipeHint',   'Tap spin or swipe the wheel', 'Hint under the Spin button'],
  ['text.winEyebrow',  'Congratulations, you won', 'Win pop-up heading'],
  ['text.winNote',     'Claim your personal voucher now. Valid for {days} days.', 'Win pop-up note'],
  ['text.loseNote',    'Come back tomorrow for another spin.', 'No-prize pop-up note'],
  ['text.formTitle',   "You won! *Let's* make it yours.", 'Claim form heading (*word* = olive italic)'],
  ['text.formLead',    "Add your details and we'll create your personal voucher.", 'Claim form intro'],
  ['text.consent',     'I agree to the voucher terms & conditions and to Together & Co. storing my details to issue this voucher.', 'Consent checkbox'],
  ['text.optin',       'Send me news and offers from Together & Co. (optional)', 'Marketing opt-in checkbox'],
  ['text.photoHint',   'Take a photo of your voucher and show it to our team on your next visit.', 'Voucher screen instruction'],
  ['text.closedText',  'Spin & Win is available {schedule}. See you then!', 'Message outside Spin & Win hours'],
  ['terms', [
    'Valid for one-time use within {days} days of issue, until the date shown above.',
    'Valid at Together & Co. only. Please show this voucher before ordering.',
    "Issued in the guest's name; non-transferable and not exchangeable for cash.",
    'Cannot be combined with any other offer, promotion or discount.',
    'Lost, expired or altered vouchers cannot be replaced or honoured.',
    'Together & Co. reserves the right to amend or withdraw this offer.'].join('\n'), 'Voucher T&Cs — one per line']
];

// =====================================================================  web app
function doGet(e) {
  // Pressing ▶ Run on doGet in the editor just runs setup.
  if (!e || !e.parameter) { setup(); return ContentService.createTextOutput('Setup complete'); }
  var out = route(parse(e.parameter.d));
  var cb = e.parameter.callback ? String(e.parameter.callback).replace(/[^\w$]/g, '') : '';
  if (cb) return ContentService.createTextOutput(cb + '(' + JSON.stringify(out) + ')').setMimeType(ContentService.MimeType.JAVASCRIPT);
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}
function doPost(e) {
  var out = route(parse(e && e.postData ? e.postData.contents : '{}'));
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}
function parse(s) { try { return JSON.parse(s || '{}'); } catch (x) { return {}; } }

function route(d) {
  try {
    switch (d.type) {
      // ---- screen (public) ----
      case 'ping':   return { ok: true, sheet: SpreadsheetApp.getActiveSpreadsheet().getName() };
      case 'pull':   return pull(d.rev);
      case 'media':  return mediaPart(d.id, Number(d.part) || 0);
      case 'spin':   return withLock(function () { return addSpin(d); });
      case 'guest':  return withLock(function () { return addGuest(d, false); });
      case 'claim':  return withLock(function () { return addGuest(d, true); });
      case 'redeem': return withLock(function () { return setStatus(d.code, d.redeemed ? 'Redeemed' : 'Active', d.redeemedAt); });
      case 'login':  return login(d.pin);
    }
    // ---- admin (PIN token required) ----
    if (String(d.type || '').indexOf('admin.') === 0) {
      if (!authOk(d.token)) return { ok: false, auth: false, error: 'Please sign in again.' };
      switch (d.type) {
        case 'admin.data':     return adminData();
        case 'admin.export':   return adminExport(d.from, d.to);
        case 'admin.status':   return withLock(function () { return setStatus(d.code, d.status); });
        case 'admin.awards':   return withLock(function () { return saveAwards(d.awards || []); });
        case 'admin.settings': return withLock(function () { return saveSettings(d.settings || {}); });
        case 'admin.slides':   return withLock(function () { return saveSlides(d.rows || []); });
        case 'admin.upload':   return upload(d);
        case 'admin.remove':   return removeSlide(d.id);
        case 'admin.thumb':    return thumb(d.id);
        case 'admin.logoReset':return logoReset();
        case 'admin.pin':      return changePin(d.pin);
        case 'admin.logout':   CacheService.getScriptCache().remove('tok_' + d.token); return { ok: true };
      }
    }
    return { ok: false, error: 'Unknown request' };
  } catch (err) {
    return { ok: false, error: String(err && err.message || err) };
  }
}
function withLock(fn) {
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}

// =====================================================================  screen
function pull(clientRev) {
  var cache = CacheService.getScriptCache();
  cache.put('seen', String(Date.now()), 21600);
  if (!cache.get('expChk')) { cache.put('expChk', '1', 600); try { expireVouchers(); } catch (e) {} }
  var rev = getRev();
  if (clientRev && String(clientRev) === rev) return { ok: true, same: true, rev: rev };
  var res = { ok: true, rev: rev, sheet: SpreadsheetApp.getActiveSpreadsheet().getName(),
              settings: readSettings(), awards: null, media: null, logo: logoInfo() };
  var a = readAwards(); res.awards = a.rows; if (a.error) res.awardsError = a.error;
  try { var m = syncSlides(); if (m) { res.media = m.items; res.mediaFolder = m.url; } }
  catch (e) { res.mediaError = String(e && e.message || e); }
  return res;
}

function addSpin(d) {
  var s = tab('Spin Log', SPIN_HEAD);
  if (!find(s, d.id)) s.appendRow(["'" + d.id, d.day, d.time, d.result, d.bonus ? 'Yes' : 'No']);
  return { ok: true };
}

function addGuest(d, checkDup) {
  var g = tab('Guests', GUEST_HEAD);
  if (find(g, d.code)) return { ok: true, existed: true };
  if (checkDup && yes(readSettings().onePerDay) && g.getLastRow() > 1) {
    var email = String(d.email || '').toLowerCase(), day = String(d.day);
    var rows = g.getRange(2, 1, g.getLastRow() - 1, EMAIL_COL).getValues();
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i][EMAIL_COL - 1]).toLowerCase() === email && dayStr(rows[i][1]) === day)
        return { ok: false, dup: true, error: 'This email address has already played today.' };
    }
  }
  g.appendRow([d.code, d.day, d.time, d.first, d.last, "'" + d.mobile, d.email, d.prize,
               d.expiry, d.optin ? 'Yes' : 'No', d.status || 'Active', d.redeemedAt || '']);
  g.getRange(g.getLastRow(), STATUS_COL).setDataValidation(statusRule());
  bumpRev();
  return { ok: true };
}

function setStatus(code, status, when) {
  var g = tab('Guests', GUEST_HEAD), hit = find(g, code);
  if (!hit) return { ok: false, error: 'Voucher ' + code + ' not found' };
  if (['Active', 'Redeemed', 'Expired'].indexOf(status) < 0) return { ok: false, error: 'Bad status' };
  var stamp = status === 'Redeemed' ? (when || now('yyyy-MM-dd HH:mm')) : '';
  g.getRange(hit.getRow(), STATUS_COL, 1, 2).setValues([[status, stamp]]);
  bumpRev();
  return { ok: true, status: status, redeemedAt: stamp };
}

// =====================================================================  admin
function login(pin) {
  var cache = CacheService.getScriptCache(), fails = Number(cache.get('fails') || 0);
  if (fails >= 10) return { ok: false, error: 'Too many attempts. Try again in 15 minutes.' };
  var real = PropertiesService.getScriptProperties().getProperty('ADMIN_PIN') || DEFAULT_PIN;
  if (String(pin) !== real) { cache.put('fails', String(fails + 1), 900); return { ok: false, error: 'Wrong PIN' }; }
  var t = Utilities.getUuid(); cache.put('tok_' + t, '1', 21600);
  return { ok: true, token: t };
}
function authOk(t) { return !!t && CacheService.getScriptCache().get('tok_' + t) === '1'; }
function changePin(pin) {
  if (!/^\d{4,12}$/.test(String(pin))) return { ok: false, error: 'PIN must be 4–12 digits' };
  PropertiesService.getScriptProperties().setProperty('ADMIN_PIN', String(pin));
  return { ok: true };
}

function adminData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), cache = CacheService.getScriptCache();
  try { expireVouchers(); } catch (e) {}
  var folder = slideFolder(false), slides = [];
  try { syncSlides(); } catch (e) {}
  var st = ss.getSheetByName('Slideshow');
  if (st && st.getLastRow() > 1) {
    slides = st.getRange(2, 1, st.getLastRow() - 1, SLIDE_HEAD.length).getValues()
      .filter(function (r) { return r[5]; })
      .map(function (r) { return { order: r[0], name: r[1], type: r[2], seconds: r[3], show: String(r[4] || 'Yes'), id: r[5] }; });
  }
  var spinsToday = {}, today = now('yyyy-MM-dd'), spinTotal = 0;
  var sl = ss.getSheetByName('Spin Log');
  if (sl && sl.getLastRow() > 1) {
    var v = sl.getRange(2, 2, sl.getLastRow() - 1, 3).getValues();
    spinTotal = v.length;
    v.forEach(function (r) { if (dayStr(r[0]) === today) spinsToday[r[2]] = (spinsToday[r[2]] || 0) + 1; });
  }
  return { ok: true, sheet: ss.getName(), sheetUrl: ss.getUrl(), today: today,
           guests: readGuests(), spinsToday: spinsToday, spinTotal: spinTotal,
           settings: readSettings(), awards: readAwards().rows || [], slides: slides,
           folderUrl: folder ? folder.getUrl() : '', logo: logoInfo(),
           seen: Number(cache.get('seen') || 0), serverTime: Date.now() };
}

function adminExport(from, to) {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), inRange = function (d) { return (!from || d >= from) && (!to || d <= to); };
  var guests = readGuests().filter(function (g) { return inRange(g.day); });
  var spins = [], sl = ss.getSheetByName('Spin Log');
  if (sl && sl.getLastRow() > 1) {
    sl.getRange(2, 1, sl.getLastRow() - 1, 5).getValues().forEach(function (r) {
      var d = dayStr(r[1]); if (inRange(d)) spins.push({ day: d, time: timeStr(r[2]), result: String(r[3]), bonus: String(r[4]) });
    });
  }
  return { ok: true, guests: guests, spins: spins };
}

function readGuests() {
  var g = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Guests');
  if (!g || g.getLastRow() < 2) return [];
  return g.getRange(2, 1, g.getLastRow() - 1, GUEST_HEAD.length).getValues()
    .filter(function (r) { return r[0]; })
    .map(function (r) {
      return { code: String(r[0]), day: dayStr(r[1]), time: timeStr(r[2]), first: String(r[3]), last: String(r[4]),
               mobile: String(r[5]), email: String(r[6]), prize: String(r[7]), expiry: dayStr(r[8]),
               optin: String(r[9]) === 'Yes', status: String(r[10] || 'Active'),
               redeemedAt: r[11] instanceof Date ? now('yyyy-MM-dd HH:mm', r[11]) : String(r[11] || '') };
    });
}

function saveAwards(list) {
  var rows = list.map(function (a) {
    return [a.name || a.title, a.type, a.w1, a.w2, a.title, a.sub, a.color, Number(a.slices) || 0, Number(a.odds) || 0, a.term || '', a.active === false ? 'No' : 'Yes'];
  });
  if (rows.length < 2) return { ok: false, error: 'Keep at least two awards' };
  var a = awardsTab() || SpreadsheetApp.getActiveSpreadsheet().insertSheet('Spin awards');
  if (a.getLastRow() > 1) a.getRange(2, 1, a.getLastRow() - 1, AWARD_HEAD.length).clearContent();
  a.getRange(1, 1, 1, AWARD_HEAD.length).setValues([AWARD_HEAD]).setFontWeight('bold');
  a.getRange(2, 1, rows.length, AWARD_HEAD.length).setValues(rows);
  bumpRev();
  return { ok: true };
}

function saveSettings(obj) {
  var sh = settingsTab(), n = sh.getLastRow() - 1;
  var keys = n > 0 ? sh.getRange(2, 1, n, 1).getValues().map(function (r) { return String(r[0]); }) : [];
  var known = {}; SETTINGS.forEach(function (s) { known[s[0]] = s; });
  Object.keys(obj).forEach(function (k) {
    if (!known[k]) return;
    var i = keys.indexOf(k), val = String(obj[k] == null ? '' : obj[k]);
    if (i >= 0) sh.getRange(i + 2, 2).setValue(val);
    else { sh.appendRow([k, val, known[k][2]]); keys.push(k); }
  });
  bumpRev();
  return { ok: true, settings: readSettings() };
}

function saveSlides(list) {
  var sh = tab('Slideshow', SLIDE_HEAD), n = sh.getLastRow() - 1;
  if (n < 1) return { ok: true };
  var rng = sh.getRange(2, 1, n, SLIDE_HEAD.length), v = rng.getValues(), byId = {};
  list.forEach(function (x) { byId[x.id] = x; });
  v.forEach(function (r) {
    var x = byId[r[5]]; if (!x) return;
    r[0] = Number(x.order) || r[0]; r[3] = x.seconds === '' || x.seconds == null ? '' : Number(x.seconds); r[4] = x.show === 'No' ? 'No' : 'Yes';
  });
  v.sort(function (a, b) { return (Number(a[0]) || 999) - (Number(b[0]) || 999); });
  rng.setValues(v);
  bumpRev();
  return { ok: true };
}

function upload(d) {
  var bytes = Utilities.base64Decode(d.data || '');
  if (bytes.length > MAX_UPLOAD_MB * 1024 * 1024) return { ok: false, error: 'File too large to upload here (max ' + MAX_UPLOAD_MB + ' MB). Add it to the Drive folder instead.' };
  var blob = Utilities.newBlob(bytes, d.mime || 'application/octet-stream', d.name || 'file');
  if (d.kind === 'logo') {
    var props = PropertiesService.getScriptProperties(), old = props.getProperty('logoId');
    var f = brandFolder().createFile(blob);
    props.setProperty('logoId', f.getId());
    if (old) { try { DriveApp.getFileById(old).setTrashed(true); } catch (e) {} }
    bumpRev();
    return { ok: true, logo: logoInfo() };
  }
  if (!/^(image|video)\//.test(d.mime || '')) return { ok: false, error: 'Only photos and videos can be added' };
  var file = slideFolder(true).createFile(blob);
  syncSlides();
  bumpRev();
  return { ok: true, id: file.getId() };
}

function removeSlide(id) {
  var folder = slideFolder(false); if (!folder || !inFolder(id, folder)) return { ok: false, error: 'File not found in the slideshow folder' };
  DriveApp.getFileById(id).setTrashed(true);
  syncSlides(); bumpRev();
  return { ok: true };
}

function thumb(id) {
  var folder = slideFolder(false); if (!folder || !inFolder(id, folder)) return { ok: false };
  var f = DriveApp.getFileById(id), t = null;
  try { t = f.getThumbnail(); } catch (e) {}
  if (!t) {
    if (/^image\//.test(f.getMimeType()) && f.getSize() < 1500000) t = f.getBlob(); else return { ok: true, data: '' };
  }
  return { ok: true, mime: t.getContentType() || 'image/png', data: Utilities.base64Encode(t.getBytes()) };
}

function logoReset() {
  var props = PropertiesService.getScriptProperties(), id = props.getProperty('logoId');
  if (id) { try { DriveApp.getFileById(id).setTrashed(true); } catch (e) {} props.deleteProperty('logoId'); }
  bumpRev();
  return { ok: true };
}

function logoInfo() {
  var id = PropertiesService.getScriptProperties().getProperty('logoId');
  if (!id) return null;
  try { var f = DriveApp.getFileById(id); if (f.isTrashed()) return null; return { id: id, updated: f.getLastUpdated().getTime(), mime: f.getMimeType() }; }
  catch (e) { return null; }
}

// =====================================================================  sheet readers
function readSettings() {
  var sh = settingsTab(), out = {};
  SETTINGS.forEach(function (s) { out[s[0]] = s[1]; });
  var n = sh.getLastRow() - 1;
  if (n > 0) sh.getRange(2, 1, n, 2).getDisplayValues().forEach(function (r) { if (r[0] && out.hasOwnProperty(r[0])) out[r[0]] = r[1]; });
  return out;
}

function readAwards() {
  var a = awardsTab();
  if (!a) return { rows: null, error: 'No tab called "Spin awards" was found.' };
  if (a.getLastRow() < 2) return { rows: null, error: 'The Spin awards tab has no award rows yet.' };
  var v = a.getDataRange().getDisplayValues();
  var h = v[0].map(function (x) { return String(x).trim().toLowerCase(); });
  var col = function (names) { for (var i = 0; i < names.length; i++) { var k = h.indexOf(names[i]); if (k >= 0) return k; } return -1; };
  var c = {
    name: col(['award', 'award name', 'name']), type: col(['type']),
    w1: col(['wheel line 1', 'wheel text 1']), w2: col(['wheel line 2', 'wheel text 2']),
    title: col(['title']), sub: col(['subtitle']), color: col(['colour', 'color']),
    slices: col(['slices']), odds: col(['chance', 'odds', 'weight']),
    term: col(['voucher condition', 'condition']), active: col(['active'])
  };
  var rows = [];
  for (var r = 1; r < v.length; r++) {
    var row = {}; for (var k in c) row[k] = c[k] >= 0 ? String(v[r][c[k]]).trim() : '';
    if (row.name || row.title) rows.push(row);
  }
  return { rows: rows };
}

// =====================================================================  slideshow (Google Drive)
function slideFolder(create) {
  var props = PropertiesService.getScriptProperties(), id = props.getProperty('slideFolder');
  if (id) { try { var f = DriveApp.getFolderById(id); if (!f.isTrashed()) return f; } catch (e) {} }
  if (!create) return null;
  var folder = siblingFolder(FOLDER_NAME);
  props.setProperty('slideFolder', folder.getId());
  return folder;
}
function brandFolder() {
  var props = PropertiesService.getScriptProperties(), id = props.getProperty('brandFolder');
  if (id) { try { var f = DriveApp.getFolderById(id); if (!f.isTrashed()) return f; } catch (e) {} }
  var folder = siblingFolder(BRAND_FOLDER); props.setProperty('brandFolder', folder.getId());
  return folder;
}
function siblingFolder(name) {
  var parents = DriveApp.getFileById(SpreadsheetApp.getActiveSpreadsheet().getId()).getParents();
  var parent = parents.hasNext() ? parents.next() : DriveApp.getRootFolder();
  var found = parent.getFoldersByName(name);
  return found.hasNext() ? found.next() : parent.createFolder(name);
}
function inFolder(id, folder) {
  var p = DriveApp.getFileById(id).getParents();
  while (p.hasNext()) if (p.next().getId() === folder.getId()) return true;
  return false;
}
function syncSlides() {
  var folder = slideFolder(false); if (!folder) return null;
  var files = {}, list = [], it = folder.getFiles();
  while (it.hasNext()) {
    var f = it.next(), mt = f.getMimeType();
    if (f.isTrashed() || !/^(image|video)\//.test(mt) || /heic|heif/.test(mt)) continue;
    files[f.getId()] = f; list.push(f);
  }
  list.sort(function (a, b) { return a.getName().localeCompare(b.getName()); });
  var sh = tab('Slideshow', SLIDE_HEAD), n = sh.getLastRow() - 1;
  var rows = n > 0 ? sh.getRange(2, 1, n, SLIDE_HEAD.length).getValues() : [];
  var real = rows.filter(function (r) { return String(r[5] || r[1]).trim() !== ''; });
  var keep = real.filter(function (r) { return r[5] && files[r[5]]; }), seen = {}, changed = keep.length !== real.length;
  keep.forEach(function (r) { seen[r[5]] = 1; var f = files[r[5]]; if (r[1] !== f.getName()) { r[1] = f.getName(); changed = true; } });
  var maxO = keep.reduce(function (m, r) { return Math.max(m, Number(r[0]) || 0); }, 0);
  list.forEach(function (f) {
    if (seen[f.getId()]) return;
    keep.push([++maxO, f.getName(), /^video/.test(f.getMimeType()) ? 'Video' : 'Photo', '', 'Yes', f.getId()]);
    changed = true;
  });
  if (changed) {
    if (n > 0) sh.getRange(2, 1, n, SLIDE_HEAD.length).clearContent();
    if (keep.length) sh.getRange(2, 1, keep.length, SLIDE_HEAD.length).setValues(keep);
    sh.getRange(2, 5, Math.max(1, sh.getMaxRows() - 1), 1).setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList(['Yes', 'No'], true).build());
    bumpRev();
  }
  var items = keep.filter(function (r) { return !/^(no|n|false|0)$/i.test(String(r[4]).trim()); })
    .sort(function (a, b) { return (Number(a[0]) || 0) - (Number(b[0]) || 0); })
    .map(function (r) {
      var f = files[r[5]];
      return { id: r[5], name: f.getName(), type: /^video/.test(f.getMimeType()) ? 'video' : 'image',
               dur: Number(r[3]) || 0, size: f.getSize(), updated: f.getLastUpdated().getTime() };
    });
  return { items: items, url: folder.getUrl() };
}
// Sends one 5 MB piece of a slideshow file or the logo
function mediaPart(id, part) {
  var logoId = PropertiesService.getScriptProperties().getProperty('logoId');
  var folder = slideFolder(false);
  if (id !== logoId && !(folder && inFolder(id, folder))) return { ok: false, error: 'File is not in the slideshow folder' };
  var f = DriveApp.getFileById(id), size = f.getSize();
  if (size > MAX_SCREEN_MB * 1024 * 1024) return { ok: false, error: f.getName() + ' is over ' + MAX_SCREEN_MB + ' MB — please compress it' };
  var bytes = f.getBlob().getBytes(), parts = Math.max(1, Math.ceil(bytes.length / CHUNK));
  var piece = bytes.slice(part * CHUNK, Math.min(bytes.length, (part + 1) * CHUNK));
  return { ok: true, mime: f.getMimeType(), parts: parts, part: part, data: Utilities.base64Encode(piece) };
}

// =====================================================================  automation
function expireVouchers() {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), g = ss.getSheetByName('Guests');
  if (!g || g.getLastRow() < 2) return;
  var today = now('yyyy-MM-dd'), n = g.getLastRow() - 1;
  var valid = g.getRange(2, VALID_COL, n, 1).getValues();
  var stat = g.getRange(2, STATUS_COL, n, 1).getValues(), changed = false;
  for (var i = 0; i < n; i++) {
    var day = dayStr(valid[i][0]);
    if (day && day < today && String(stat[i][0]) === 'Active') { stat[i][0] = 'Expired'; changed = true; }
  }
  if (changed) { g.getRange(2, STATUS_COL, n, 1).setValues(stat); bumpRev(); }
}

// Installed by setup: runs on every edit in the Sheet
function onSheetEdit(e) {
  var sh = e.range.getSheet(), name = sh.getName().toLowerCase().replace(/\s+/g, '');
  if (name === 'spinawards' || name === 'slideshow' || name === 'settings') { bumpRev(); return; }
  if (sh.getName() !== 'Guests' || e.range.getColumn() > STATUS_COL || e.range.getColumn() + e.range.getNumColumns() - 1 < STATUS_COL) return;
  bumpRev();
  if (e.range.getRow() < 2 || e.range.getNumRows() > 1) return;
  var cell = sh.getRange(e.range.getRow(), REDEEMED_COL);
  if (e.value === 'Redeemed') { if (!cell.getValue()) cell.setValue(now('yyyy-MM-dd HH:mm')); }
  else cell.setValue('');
}

// =====================================================================  run once
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), props = PropertiesService.getScriptProperties();
  if (!props.getProperty('ADMIN_PIN')) props.setProperty('ADMIN_PIN', DEFAULT_PIN);

  var g = tab('Guests', GUEST_HEAD), sl = tab('Spin Log', SPIN_HEAD);
  g.getRange(1, 1, 1, GUEST_HEAD.length).setValues([GUEST_HEAD]).setFontWeight('bold');
  sl.getRange(1, 1, 1, SPIN_HEAD.length).setValues([SPIN_HEAD]).setFontWeight('bold');
  g.getRange(2, STATUS_COL, g.getMaxRows() - 1, 1).setDataValidation(statusRule());
  var k = g.getRange(2, STATUS_COL, g.getMaxRows() - 1, 1);
  g.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Active').setBackground('#EEF0D8').setRanges([k]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Redeemed').setBackground('#E9E6E3').setRanges([k]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Expired').setBackground('#F6E2DE').setRanges([k]).build()
  ]);

  // Spin awards (filled with the default 5 awards only if empty)
  var a = awardsTab() || ss.insertSheet('Spin awards');
  if (a.getLastRow() === 0 || String(a.getRange(1, 1).getValue()).trim() === '') {
    a.clear();
    a.getRange(1, 1, 1, AWARD_HEAD.length).setValues([AWARD_HEAD]).setFontWeight('bold');
    a.getRange(2, 1, 5, AWARD_HEAD.length).setValues([
      ['50% Off', 'Prize', '50% OFF', 'TOTAL BILL', '50% off', 'your total bill', 'Olive', 2, 5, "The 50% discount applies to the total food and beverage bill for the voucher holder's table.", 'Yes'],
      ['Free Coffee', 'Prize', 'FREE COFFEE', 'WITH ANY PASTRY', 'Free coffee', 'when you order any pastry', 'Sand', 2, 30, 'One complimentary regular coffee with the purchase of any pastry.', 'Yes'],
      ['Better Luck', 'No Prize', 'BETTER LUCK', 'NEXT TIME', 'So close!', 'Better luck next time', 'Ink', 2, 35, '', 'Yes'],
      ['25% Off', 'Prize', '25% OFF', 'TOTAL BILL', '25% off', 'your total bill', 'Blush', 2, 15, "The 25% discount applies to the total food and beverage bill for the voucher holder's table.", 'Yes'],
      ['Free Spin', 'Free Spin', 'FREE SPIN', 'SPIN AGAIN', 'One more spin', 'on the house', 'Mist', 2, 15, '', 'Yes']
    ]);
    a.setFrozenRows(1);
  }
  var list = function (vals) { return SpreadsheetApp.newDataValidation().requireValueInList(vals, true).setAllowInvalid(false).build(); };
  var rows = a.getMaxRows() - 1;
  a.getRange(2, 2, rows, 1).setDataValidation(list(['Prize', 'Free Spin', 'No Prize']));
  a.getRange(2, 7, rows, 1).setDataValidation(SpreadsheetApp.newDataValidation()
    .requireValueInList(['Olive', 'Blush', 'Sand', 'Mist', 'Linen', 'Ink'], true).setAllowInvalid(true).build());
  a.getRange(2, 11, rows, 1).setDataValidation(list(['Yes', 'No']));

  settingsTab();   // creates the Settings tab with defaults

  // Triggers: daily expiry + edit watcher (remove old copies first)
  ScriptApp.getProjectTriggers().forEach(function (t) {
    var f = t.getHandlerFunction();
    if (f === 'expireVouchers' || f === 'onSheetEdit') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('expireVouchers').timeBased().everyDays(1).atHour(0).nearMinute(10).create();
  ScriptApp.newTrigger('onSheetEdit').forSpreadsheet(ss).onEdit().create();

  var folder = slideFolder(true);
  var st = tab('Slideshow', SLIDE_HEAD);
  st.getRange(1, 1, 1, SLIDE_HEAD.length).setValues([SLIDE_HEAD]).setFontWeight('bold');
  st.getRange(1, 8).setValue('Drop photos & videos in this Google Drive folder:');
  st.getRange(2, 8).setValue(folder.getUrl());
  syncSlides();
  expireVouchers();
  lockSheets();
  bumpRev();
  Logger.log('Slideshow folder: ' + folder.getUrl());
  Logger.log('Setup complete. Admin PIN: ' + props.getProperty('ADMIN_PIN'));
}

// Only you can change the Sheet directly, except the F&B Status column on Guests.
function lockSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), me = Session.getEffectiveUser();
  ss.getProtections(SpreadsheetApp.ProtectionType.SHEET).forEach(function (p) { if (p.getDescription() === LOCK_TAG) p.remove(); });
  var lock = function (sh, open, extra) {
    if (!sh) return;
    var p = sh.protect().setDescription(LOCK_TAG);
    p.removeEditors(p.getEditors()); p.addEditor(me);
    if (p.canDomainEdit()) p.setDomainEdit(false);
    if (extra && extra.length) p.addEditors(extra);
    if (open && open.length) p.setUnprotectedRanges(open);
  };
  var g = ss.getSheetByName('Guests');
  lock(g, g ? [g.getRange(2, STATUS_COL, g.getMaxRows() - 1, 1)] : []);
  lock(ss.getSheetByName('Spin Log'));
  lock(awardsTab(), [], AWARD_EDITORS);
  lock(ss.getSheetByName('Slideshow'), [], SLIDE_EDITORS);
  lock(ss.getSheetByName('Settings'));
  Logger.log('Sheets locked. F&B can change Guests → Status only.');
}
function unlockSheets() {
  SpreadsheetApp.getActiveSpreadsheet().getProtections(SpreadsheetApp.ProtectionType.SHEET)
    .forEach(function (p) { if (p.getDescription() === LOCK_TAG) p.remove(); });
  Logger.log('Locks removed.');
}

// =====================================================================  helpers
function tab(name, head) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sh.getLastRow() === 0) { sh.appendRow(head); sh.setFrozenRows(1); sh.getRange(1, 1, 1, head.length).setFontWeight('bold'); }
  return sh;
}
function settingsTab() {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), sh = ss.getSheetByName('Settings');
  if (!sh) {
    sh = ss.insertSheet('Settings');
    sh.getRange(1, 1, 1, 3).setValues([SET_HEAD]).setFontWeight('bold'); sh.setFrozenRows(1);
    sh.getRange(2, 2, SETTINGS.length + 20, 1).setNumberFormat('@');
    sh.getRange(2, 1, SETTINGS.length, 3).setValues(SETTINGS);
    sh.setColumnWidth(1, 170); sh.setColumnWidth(2, 380); sh.setColumnWidth(3, 420);
  }
  return sh;
}
function awardsTab() {
  var all = SpreadsheetApp.getActiveSpreadsheet().getSheets();
  for (var i = 0; i < all.length; i++) if (all[i].getName().toLowerCase().replace(/\s+/g, '') === 'spinawards') return all[i];
  return null;
}
function find(sh, key) { return key ? sh.createTextFinder(String(key)).matchEntireCell(true).findNext() : null; }
function statusRule() { return SpreadsheetApp.newDataValidation().requireValueInList(['Active', 'Redeemed', 'Expired'], true).setAllowInvalid(false).build(); }
function tz() { return SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(); }
function now(fmt, d) { return Utilities.formatDate(d || new Date(), tz(), fmt); }
function dayStr(v) { return v instanceof Date ? now('yyyy-MM-dd', v) : String(v || '').slice(0, 10); }
function timeStr(v) { return v instanceof Date ? now('HH:mm:ss', v) : String(v || ''); }
function yes(v) { return /^(yes|y|true|1|on)$/i.test(String(v).trim()); }
// "rev" changes whenever something the screen shows changes
function bumpRev() {
  var r = String(Date.now());
  PropertiesService.getScriptProperties().setProperty('rev', r);
  CacheService.getScriptCache().put('rev', r, 21600);
}
function getRev() {
  var c = CacheService.getScriptCache(), r = c.get('rev');
  if (!r) { r = PropertiesService.getScriptProperties().getProperty('rev') || '1'; c.put('rev', r, 21600); }
  return r;
}
