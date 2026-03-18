var GAS_URL = 'https://script.google.com/macros/s/AKfycbyIzTJUg-_tbWNChTrzb-5hIUfomFIuOz1-kmeedcxkgnnxJLmIdgmc2uPx0dOzi39n/exec';

var DAYS = ['\u65e5','\u6708','\u706b','\u6c34','\u6728','\u91d1','\u571f'];
var HOURS = ['09:00','09:30','10:00','10:30','11:00','11:30','12:00','12:30','13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30','18:00','18:30'];
var ROOMS = {
  entrance: {name:'C \u2014 ENTRANCE BOOTH', cap:'\u6765\u5ba2\u5bfe\u5fdc'},
  large:    {name:'D \u2014 \u4f1a\u8b70\u5ba4\uff08\u5927\uff09', cap:'\u6700\u592720\u540d'},
  medium:   {name:'E \u2014 \u4f1a\u8b70\u5ba4\uff08\u4e2d\uff09', cap:'4\uff5e6\u540d'},
  web1:     {name:'WEB BOOTH', cap:'1\u540d'}
};
var calViewYear, calViewMonth;
var schedViewYear, schedViewMonth;
var cancelTargetIdx = -1;

var S = {
  room: null, date: null, times: [], co: 'hifive', sDate: null,
  bookings: []
};

// ── 日付ユーティリティ ──
function dateToStr(d) {
  return d.getFullYear() + '-' +
    String(d.getMonth()+1).padStart(2,'0') + '-' +
    String(d.getDate()).padStart(2,'0');
}

// スプレッドシートから来た日付を正規化（様々な形式に対応）
function normalizeDate(raw) {
  if (!raw) return '';
  var s = String(raw).trim();
  // すでに YYYY-MM-DD 形式
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // Date オブジェクト的な文字列 or スラッシュ区切り
  var d = new Date(s);
  if (!isNaN(d.getTime())) return dateToStr(d);
  return s;
}

function fmtDate(s) {
  var parts = s.split('-');
  var y = parseInt(parts[0]), m = parseInt(parts[1]), d = parseInt(parts[2]);
  var dow = new Date(y, m-1, d).getDay();
  return m + '\u6708' + d + '\u65e5\uff08' + DAYS[dow] + '\uff09';
}

function addMinutes(hhmm, min) {
  var p = hhmm.trim().split(':');
  var total = parseInt(p[0]) * 60 + parseInt(p[1]) + min;
  return String(Math.floor(total/60)).padStart(2,'0') + ':' + String(total%60).padStart(2,'0');
}

function getTimes(b) {
  if (!b.times) return [];
  return Array.isArray(b.times) ? b.times : String(b.times).split(',');
}

// ── スプレッドシート連携 ──
function loadBookings(callback) {
  showLoading(true);
  fetch(GAS_URL + '?action=getBookings')
    .then(function(r) { return r.json(); })
    .then(function(data) {
      showLoading(false);
      if (data.status === 'ok') {
        // 日付を正規化してから保存
        S.bookings = data.bookings.map(function(b) {
          b.date = normalizeDate(b.date);
          return b;
        });
      }
      if (callback) callback();
    })
    .catch(function(err) {
      showLoading(false);
      console.error('load error', err);
      if (callback) callback();
    });
}

function saveBooking(booking, callback) {
  showLoading(true);
  fetch(GAS_URL + '?action=addBooking&data=' + encodeURIComponent(JSON.stringify(booking)))
    .then(function(r) { return r.json(); })
    .then(function(data) {
      showLoading(false);
      if (data.status === 'ok') {
        booking.id = data.id;
        S.bookings.push(booking);
      }
      if (callback) callback(data);
    })
    .catch(function(err) {
      showLoading(false);
      console.error('save error', err);
      if (callback) callback(null);
    });
}

function removeBooking(id, callback) {
  showLoading(true);
  fetch(GAS_URL + '?action=deleteBooking&id=' + encodeURIComponent(id))
    .then(function(r) { return r.json(); })
    .then(function(data) {
      showLoading(false);
      if (callback) callback(data);
    })
    .catch(function(err) {
      showLoading(false);
      if (callback) callback(null);
    });
}

function showLoading(show) {
  var el = document.getElementById('loadingBar');
  if (el) el.style.display = show ? 'block' : 'none';
}

// ── タブ切替 ──
function switchTab(name) {
  var names = ['rooms','booking','schedule','cancel','rules'];
  var tabs = document.querySelectorAll('.tab');
  for (var i = 0; i < tabs.length; i++) {
    tabs[i].classList.toggle('active', names[i] === name);
  }
  var panels = document.querySelectorAll('.panel');
  for (var j = 0; j < panels.length; j++) panels[j].classList.remove('active');
  document.getElementById('panel-' + name).classList.add('active');

  if (name === 'booking') {
    // 予約タブ：最新データを読み込んでから時間帯を更新
    loadBookings(function() { buildTG(); });
  }
  if (name === 'schedule') {
    loadBookings(function() { initSched(); });
  }
  if (name === 'cancel') {
    loadBookings(function() { renderCancelPanel(); });
  }
}

// ── グリッドカレンダー（予約用） ──
function buildGridCal() {
  var today = new Date();
  var maxDate = new Date(today.getFullYear(), today.getMonth() + 2, today.getDate());
  document.getElementById('calMonthLabel').textContent = calViewYear + '\u5e74' + (calViewMonth + 1) + '\u6708';
  var grid = document.getElementById('calGrid');
  grid.innerHTML = '';
  var firstDay = new Date(calViewYear, calViewMonth, 1).getDay();
  var daysInMonth = new Date(calViewYear, calViewMonth + 1, 0).getDate();
  for (var b = 0; b < firstDay; b++) {
    var empty = document.createElement('div');
    empty.className = 'cal-cell cal-empty';
    grid.appendChild(empty);
  }
  for (var d = 1; d <= daysInMonth; d++) {
    var date = new Date(calViewYear, calViewMonth, d);
    var dateStr = dateToStr(date);
    var dow = date.getDay();
    var isPast = date < new Date(today.getFullYear(), today.getMonth(), today.getDate());
    var isFuture = date > maxDate;
    var el = document.createElement('div');
    var cls = 'cal-cell';
    if (isPast || isFuture) cls += ' cal-past';
    if (dateStr === dateToStr(today)) cls += ' cal-today';
    if (dateStr === S.date) cls += ' cal-selected';
    if (dow === 0) cls += ' cal-sun';
    if (dow === 6) cls += ' cal-sat';
    el.className = cls;
    el.textContent = d;
    el.setAttribute('data-datestr', dateStr);
    if (!isPast && !isFuture) el.setAttribute('data-pickdate', '1');
    grid.appendChild(el);
  }
}

function calMove(dir) {
  calViewMonth += dir;
  if (calViewMonth > 11) { calViewMonth = 0; calViewYear++; }
  if (calViewMonth < 0)  { calViewMonth = 11; calViewYear--; }
  buildGridCal();
}

// ── グリッドカレンダー（スケジュール用） ──
function buildSchedGridCal() {
  var today = new Date();
  var maxDate = new Date(today.getFullYear(), today.getMonth() + 2, today.getDate());
  document.getElementById('schedMonthLabel').textContent = schedViewYear + '\u5e74' + (schedViewMonth + 1) + '\u6708';
  var grid = document.getElementById('schedGrid');
  grid.innerHTML = '';
  var firstDay = new Date(schedViewYear, schedViewMonth, 1).getDay();
  var daysInMonth = new Date(schedViewYear, schedViewMonth + 1, 0).getDate();
  for (var b = 0; b < firstDay; b++) {
    var empty = document.createElement('div');
    empty.className = 'cal-cell cal-empty';
    grid.appendChild(empty);
  }
  for (var d = 1; d <= daysInMonth; d++) {
    var date = new Date(schedViewYear, schedViewMonth, d);
    var dateStr = dateToStr(date);
    var dow = date.getDay();
    var isPast = date < new Date(today.getFullYear(), today.getMonth(), today.getDate());
    var isFuture = date > maxDate;
    var el = document.createElement('div');
    var cls = 'cal-cell';
    if (isPast || isFuture) cls += ' cal-past';
    if (dateStr === dateToStr(today)) cls += ' cal-today';
    if (dateStr === S.sDate) cls += ' cal-selected';
    if (dow === 0) cls += ' cal-sun';
    if (dow === 6) cls += ' cal-sat';
    el.className = cls;
    el.textContent = d;
    el.setAttribute('data-datestr', dateStr);
    if (!isPast && !isFuture) el.setAttribute('data-pickscheddate', '1');
    grid.appendChild(el);
  }
}

function schedCalMove(dir) {
  schedViewMonth += dir;
  if (schedViewMonth > 11) { schedViewMonth = 0; schedViewYear++; }
  if (schedViewMonth < 0)  { schedViewMonth = 11; schedViewYear--; }
  buildSchedGridCal();
}

// ── 時間帯グリッド（予約済みをグレーアウト） ──
function buildTG() {
  var g = document.getElementById('timeGrid');
  if (!g) return;
  g.innerHTML = '';
  // 選択中の部屋・日付に対する予約済み時間帯を収集
  var booked = [];
  S.bookings.forEach(function(bk) {
    if (bk.room === S.room && bk.date === S.date) {
      getTimes(bk).forEach(function(t) { booked.push(t.trim()); });
    }
  });
  HOURS.forEach(function(h) {
    var el = document.createElement('div');
    var iB = booked.indexOf(h) >= 0;
    var iS = S.times.indexOf(h) >= 0;
    el.className = 'tslot' + (iB ? ' booked' : '') + (iS ? ' selected' : '');
    el.textContent = h;
    // 予約済み以外はクリック可能
    if (!iB) el.setAttribute('data-timeslot', h);
    g.appendChild(el);
  });
}

function pickRoom(r) { setRoom(r); switchTab('booking'); }

function setRoom(r) {
  S.room = r; S.times = [];
  var pills = document.querySelectorAll('.rpill');
  for (var i = 0; i < pills.length; i++) pills[i].classList.remove('active');
  var p = document.getElementById('rp-' + r);
  if (p) p.classList.add('active');
  // 部屋選択時も最新データを読み込んで時間帯を更新
  loadBookings(function() { buildTG(); updateSum(); });
}

function setCo(c) {
  S.co = c;
  document.getElementById('co-hf').classList.toggle('active', c === 'hifive');
  document.getElementById('co-hw').classList.toggle('active', c === 'highway');
  updateSum();
}

function updateSum() {
  document.getElementById('s-room').textContent = S.room ? ROOMS[S.room].name : '\u672a\u9078\u629e';
  document.getElementById('s-date').textContent = S.date ? fmtDate(S.date) : '\u2014';
  document.getElementById('s-co').textContent = S.co === 'hifive' ? 'HIGH FIVE' : 'HIGHWAY PLANET';
  var nm = document.getElementById('f-name');
  document.getElementById('s-name').textContent = nm ? (nm.value || '\u2014') : '\u2014';
  var px = document.getElementById('f-pax');
  document.getElementById('s-pax').textContent = (px ? px.value : 3) + '\u540d';
  var ty = document.getElementById('f-type');
  document.getElementById('s-type').textContent = ty ? ty.value : '\u793e\u5185\u4f1a\u8b70';
  var sc = document.getElementById('s-chips');
  var sorted = S.times.slice().sort();
  sc.innerHTML = sorted.length
    ? sorted.map(function(t) { return '<span class="chip">' + t + '</span>'; }).join('')
    : '<span style="font-size:11.5px;color:var(--text3)">\u672a\u9078\u629e</span>';
}

function submitBooking() {
  var nm = document.getElementById('f-name').value.trim();
  var em = document.getElementById('f-email').value.trim();
  if (!S.room)         { alert('\u90e8\u5c4b\u3092\u9078\u629e\u3057\u3066\u304f\u3060\u3055\u3044'); return; }
  if (!S.date)         { alert('\u65e5\u4ed8\u3092\u9078\u629e\u3057\u3066\u304f\u3060\u3055\u3044'); return; }
  if (!S.times.length) { alert('\u6642\u9593\u5e2f\u3092\u9078\u629e\u3057\u3066\u304f\u3060\u3055\u3044'); return; }
  if (!nm)             { alert('\u304a\u540d\u524d\u3092\u5165\u529b\u3057\u3066\u304f\u3060\u3055\u3044'); return; }
  if (!em)             { alert('\u30e1\u30fc\u30eb\u30a2\u30c9\u30ec\u30b9\u3092\u5165\u529b\u3057\u3066\u304f\u3060\u3055\u3044'); return; }
  var s = S.times.slice().sort();
  document.getElementById('modalBody').innerHTML =
    '<strong>' + ROOMS[S.room].name + '</strong><br>' +
    '\ud83d\udcc5 ' + fmtDate(S.date) + '<br>' +
    '\u23f1 ' + s[0] + ' \u301c ' + addMinutes(s[s.length-1], 30) + '<br>' +
    '\ud83c\udfe2 ' + (S.co === 'hifive' ? 'HIGH FIVE' : 'HIGHWAY PLANET') + ' / ' + nm +
    '\uff08' + document.getElementById('f-pax').value + '\u540d\uff09<br>' +
    '\ud83d\udccb ' + document.getElementById('f-type').value;
  document.getElementById('overlay').classList.add('show');
}

function closeModal() { document.getElementById('overlay').classList.remove('show'); }

function confirmBooking() {
  closeModal();
  var booking = {
    room: S.room, date: S.date,
    times: S.times.slice(),
    co: S.co,
    name: document.getElementById('f-name').value,
    pax: document.getElementById('f-pax').value,
    type: document.getElementById('f-type').value
  };
  saveBooking(booking, function(result) {
    S.times = []; S.room = null;
    var pills = document.querySelectorAll('.rpill');
    for (var i = 0; i < pills.length; i++) pills[i].classList.remove('active');
    buildTG(); updateSum();
    ['f-name','f-note','f-email'].forEach(function(id) {
      var el = document.getElementById(id); if (el) el.value = '';
    });
    var t = document.getElementById('toast');
    t.textContent = (result && result.status === 'ok')
      ? '\u2705 \u4e88\u7d04\u304c\u5b8c\u4e86\u3057\u307e\u3057\u305f\uff01'
      : '\u26a0\ufe0f \u4fdd\u5b58\u306b\u5931\u6557\u3057\u307e\u3057\u305f';
    t.classList.add('show');
    setTimeout(function(){ t.classList.remove('show'); }, 3600);
  });
}

// ── キャンセル ──
function renderCancelPanel() {
  var list = document.getElementById('myBookingsList');
  if (!list) return;
  var now = new Date();
  var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  var future = [];
  S.bookings.forEach(function(b, i) {
    var parts = b.date.split('-');
    var bd = new Date(parseInt(parts[0]), parseInt(parts[1])-1, parseInt(parts[2]));
    if (bd >= today) future.push({b: b, i: i});
  });
  if (future.length === 0) {
    list.innerHTML = '<div class="cancel-empty">\u73fe\u5728\u306e\u4e88\u7d04\u306f\u3042\u308a\u307e\u305b\u3093</div>';
    return;
  }
  future.sort(function(a, b) {
    return a.b.date.localeCompare(b.b.date) || getTimes(a.b)[0].localeCompare(getTimes(b.b)[0]);
  });
  var months = {};
  future.forEach(function(item) {
    var ym = item.b.date.slice(0, 7);
    if (!months[ym]) months[ym] = [];
    months[ym].push(item);
  });
  var ymKeys = Object.keys(months).sort();
  var tabsHtml = '<div class="cancel-month-tabs">';
  ymKeys.forEach(function(ym, i) {
    var parts = ym.split('-');
    var label = parseInt(parts[0]) + '\u5e74' + parseInt(parts[1]) + '\u6708 (' + months[ym].length + '\u4ef6)';
    tabsHtml += '<button class="cancel-month-tab' + (i===0?' active':'') + '" data-cancelmonth="' + ym + '">' + label + '</button>';
  });
  tabsHtml += '</div>';
  var listsHtml = '';
  ymKeys.forEach(function(ym, i) {
    listsHtml += '<div class="cancel-month-list' + (i===0?'':' hidden') + '" id="cancelList_' + ym.replace('-','_') + '">';
    listsHtml += '<ul class="cancel-list">';
    months[ym].forEach(function(item) {
      var b = item.b;
      var realIdx = item.i;
      var times = getTimes(b);
      var s = times.slice().sort();
      var coName = b.co === 'hifive' ? 'HIGH FIVE' : 'HIGHWAY PLANET';
      listsHtml +=
        '<li class="cancel-item">' +
          '<div class="cancel-item-info">' +
            '<div class="cancel-item-room">' + (ROOMS[b.room] ? ROOMS[b.room].name : b.room) + '</div>' +
            '<div class="cancel-item-detail">\ud83d\udcc5 ' + fmtDate(b.date) + '\u3000\u23f1 ' + s[0] + ' \u301c ' + addMinutes(s[s.length-1], 30) + '</div>' +
            '<div class="cancel-item-detail">\ud83c\udfe2 ' + coName + (b.name ? ' / ' + b.name : '') + '</div>' +
          '</div>' +
          '<button class="cancel-item-btn" data-cancelidx="' + realIdx + '">\u30ad\u30e3\u30f3\u30bb\u30eb</button>' +
        '</li>';
    });
    listsHtml += '</ul></div>';
  });
  list.innerHTML = tabsHtml + listsHtml;
}

function switchCancelMonth(ym) {
  var tabs = document.querySelectorAll('.cancel-month-tab');
  var lists = document.querySelectorAll('.cancel-month-list');
  tabs.forEach(function(t){ t.classList.remove('active'); });
  lists.forEach(function(l){ l.classList.add('hidden'); });
  var targetList = document.getElementById('cancelList_' + ym.replace('-','_'));
  if (targetList) targetList.classList.remove('hidden');
  tabs.forEach(function(t){
    if (t.getAttribute('data-cancelmonth') === ym) t.classList.add('active');
  });
}

function openCancelConfirm(idx) {
  var b = S.bookings[idx];
  if (!b) { alert('\u4e88\u7d04\u304c\u898b\u3064\u304b\u308a\u307e\u305b\u3093'); return; }
  cancelTargetIdx = idx;
  var times = getTimes(b);
  var s = times.slice().sort();
  var coName = b.co === 'hifive' ? 'HIGH FIVE' : 'HIGHWAY PLANET';
  document.getElementById('cancelConfirmBody').innerHTML =
    '\ud83c\udfe2 <strong>' + (ROOMS[b.room] ? ROOMS[b.room].name : b.room) + '</strong><br>' +
    '\ud83d\udcc5 ' + fmtDate(b.date) + '<br>' +
    '\u23f1 ' + s[0] + ' \u301c ' + addMinutes(s[s.length-1], 30) + '<br>' +
    '\ud83d\udc64 ' + coName + (b.name ? ' / ' + b.name : '');
  var ov = document.getElementById('cancelConfirmOverlay');
  ov.style.opacity = '1';
  ov.style.pointerEvents = 'all';
  document.getElementById('cancelConfirmBox').style.transform = 'scale(1)';
}

function closeCancelConfirm() {
  var ov = document.getElementById('cancelConfirmOverlay');
  ov.style.opacity = '0';
  ov.style.pointerEvents = 'none';
  document.getElementById('cancelConfirmBox').style.transform = 'scale(.95)';
  cancelTargetIdx = -1;
}

function executeCancelBooking() {
  if (cancelTargetIdx < 0) return;
  var b = S.bookings[cancelTargetIdx];
  if (!b) return;
  removeBooking(b.id, function(result) {
    if (result && result.status === 'ok') {
      S.bookings.splice(cancelTargetIdx, 1);
    }
    closeCancelConfirm();
    renderCancelPanel();
    var t = document.getElementById('toast');
    t.textContent = (result && result.status === 'ok')
      ? '\ud83d\uddd1 \u4e88\u7d04\u3092\u30ad\u30e3\u30f3\u30bb\u30eb\u3057\u307e\u3057\u305f'
      : '\u26a0\ufe0f \u30ad\u30e3\u30f3\u30bb\u30eb\u306b\u5931\u6557\u3057\u307e\u3057\u305f';
    t.classList.add('show');
    setTimeout(function(){ t.classList.remove('show'); }, 3000);
  });
}

// ── スケジュール ──
function initSched() {
  var n = new Date();
  document.getElementById('schedTtl').textContent = n.getFullYear() + '\u5e74' + (n.getMonth()+1) + '\u6708';
  schedViewYear  = n.getFullYear();
  schedViewMonth = n.getMonth();
  var todayStr = dateToStr(n);
  S.sDate = todayStr;
  document.getElementById('schedDateLbl').textContent = fmtDate(todayStr);
  buildSchedGridCal();
  buildTL(todayStr);
}

function buildTL(dateStr) {
  var wrap = document.getElementById('tlGrid');
  wrap.innerHTML = '';
  var TL_START = 9 * 60;    // 09:00
  var TL_END   = 19 * 60 + 30;   // 19:30（バーが19:00でちょうど収まるよう余白）
  var TL_SPAN  = TL_END - TL_START; // 630分
  var TL_LABELS = ['09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00'];

  function toMin(hhmm) {
    var p = hhmm.trim().split(':');
    return parseInt(p[0]) * 60 + parseInt(p[1]);
  }

  var corner = document.createElement('div');
  corner.className = 'tl-corner';
  corner.textContent = '\u90e8\u5c4b';
  wrap.appendChild(corner);

  var hcell = document.createElement('div');
  hcell.className = 'tl-hcell';
  TL_LABELS.forEach(function(h) {
    var d = document.createElement('div');
    d.className = 'tl-h';
    d.textContent = h;
    d.style.left = ((toMin(h) - TL_START) / TL_SPAN * 100).toFixed(4) + '%';
    hcell.appendChild(d);
  });
  wrap.appendChild(hcell);

  Object.keys(ROOMS).forEach(function(rk) {
    var rm = ROOMS[rk];
    var rc = document.createElement('div');
    rc.className = 'tl-rcell';
    rc.innerHTML = '<div class="tl-rname">' + rm.name + '</div><div class="tl-rcap">' + rm.cap + '</div>';
    wrap.appendChild(rc);

    var bc = document.createElement('div'); bc.className = 'tl-bcell';
    var tr = document.createElement('div'); tr.className = 'tl-track';

    S.bookings.forEach(function(bk) {
      if (bk.room !== rk || bk.date !== dateStr) return;
      var times = getTimes(bk).map(function(t){ return t.trim(); }).sort();
      if (!times.length) return;

      var startMin = toMin(times[0]);
      var endMin   = toMin(times[times.length - 1]) + 30; // 最後のスロット+30分

      var leftPct  = ((startMin - TL_START) / TL_SPAN * 100).toFixed(4);
      var widthPct = ((endMin   - startMin) / TL_SPAN * 100).toFixed(4);

      var bl = document.createElement('div');
      bl.className = 'tl-block ' + (bk.co === 'hifive' ? 'tl-hf' : 'tl-hw');
      bl.style.left  = leftPct + '%';
      bl.style.width = widthPct + '%';
      bl.textContent = (bk.name || '') + '\uff08' + (bk.type || '') + '\uff09';
      tr.appendChild(bl);
    });

    bc.appendChild(tr);
    wrap.appendChild(bc);
  });
}

// ── ログイン ──
function doLogin() {
  var USERS = [{id:'highfive',pw:'hf2024'},{id:'highway',pw:'hp2024'}];
  var id = document.getElementById('loginId').value.trim();
  var pw = document.getElementById('loginPw').value;
  var ok = USERS.some(function(u){ return u.id === id && u.pw === pw; });
  if (ok) {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('loginErr').textContent = '';
    loadBookings(function() { buildTG(); updateSum(); });
  } else {
    document.getElementById('loginErr').textContent = 'ID\u307e\u305f\u306f\u30d1\u30b9\u30ef\u30fc\u30c9\u304c\u9055\u3044\u307e\u3059';
    document.getElementById('loginPw').value = '';
    document.getElementById('loginPw').focus();
  }
}

// ── イベント登録 ──
window.onload = function() {
  document.addEventListener('click', function(e) {
    var t = e.target;
    if (t.classList.contains('login-btn')) { doLogin(); return; }
    if (t.dataset.tab) { switchTab(t.dataset.tab); return; }
    var roomCard = t.closest('[data-room]');
    if (roomCard) { pickRoom(roomCard.dataset.room); return; }
    if (t.dataset.setroom) { setRoom(t.dataset.setroom); return; }
    if (t.dataset.pickdate) {
      S.date = t.getAttribute('data-datestr');
      S.times = [];
      buildGridCal();
      updateSum();
      // 日付選択時も最新データを読み込んで時間帯を更新
      loadBookings(function() { buildTG(); });
      return;
    }
    if (t.dataset.pickscheddate) {
      S.sDate = t.getAttribute('data-datestr');
      document.getElementById('schedDateLbl').textContent = fmtDate(S.sDate);
      buildSchedGridCal();
      buildTL(S.sDate);
      return;
    }
    if (t.dataset.calmove) { calMove(parseInt(t.dataset.calmove)); return; }
    if (t.dataset.schedmove) { schedCalMove(parseInt(t.dataset.schedmove)); return; }
    if (t.dataset.setco) { setCo(t.dataset.setco); return; }
    if (t.id === 'btnSubmit') { submitBooking(); return; }
    if (t.id === 'btnCloseModal') { closeModal(); return; }
    if (t.id === 'btnConfirm') { confirmBooking(); return; }
    if (t.id === 'btnCloseCancelConfirm') { closeCancelConfirm(); return; }
    if (t.id === 'cancelConfirmBtn') { executeCancelBooking(); return; }
    if (t.dataset.cancelmonth) { switchCancelMonth(t.dataset.cancelmonth); return; }
    if (t.dataset.cancelidx !== undefined && t.dataset.cancelidx !== '') {
      openCancelConfirm(parseInt(t.dataset.cancelidx)); return;
    }
    if (t.dataset.timeslot) {
      var h = t.dataset.timeslot;
      var idx = S.times.indexOf(h);
      if (idx >= 0) { S.times.splice(idx, 1); t.classList.remove('selected'); }
      else { S.times.push(h); t.classList.add('selected'); }
      updateSum();
      return;
    }
  });
  document.addEventListener('input', function(e) {
    if (e.target.dataset.updatesum) updateSum();
  });
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && document.getElementById('loginPw') === document.activeElement) {
      doLogin();
    }
  });
  var n = new Date();
  document.getElementById('hdrDate').textContent =
    n.getFullYear() + '/' + String(n.getMonth()+1).padStart(2,'0') + '/' +
    String(n.getDate()).padStart(2,'0') + ' (' + DAYS[n.getDay()] + ')';
  calViewYear  = n.getFullYear();
  calViewMonth = n.getMonth();
  buildGridCal();
  updateSum();
};
