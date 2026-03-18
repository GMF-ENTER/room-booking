var USERS = [
  {id:'highfive', pw:'hf2024'},
  {id:'highway',  pw:'hp2024'}
];
function doLogin() {
  var id = document.getElementById('loginId').value.trim();
  var pw = document.getElementById('loginPw').value;
  var ok = USERS.some(function(u){ return u.id === id && u.pw === pw; });
  if (ok) {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('loginErr').textContent = '';
  } else {
    document.getElementById('loginErr').textContent = 'IDまたはパスワードが違います';
    document.getElementById('loginPw').value = '';
    document.getElementById('loginPw').focus();
  }
}

var DAYS = ['日','月','火','水','木','金','土'];
var HOURS = ['09:00','09:30','10:00','10:30','11:00','11:30','12:00','12:30','13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30','18:00','18:30'];
var ROOMS = {
  entrance: {name:'C — ENTRANCE BOOTH', cap:'来客対応'},
  large:    {name:'D — 会議室（大）', cap:'最大20名'},
  medium:   {name:'E — 会議室（中）', cap:'4〜6名'},
  web1:     {name:'WEB BOOTH',          cap:'1名'}
};

// カレンダー用
var calViewYear, calViewMonth;

function dsOffset(n) {
  var d = new Date(); d.setDate(d.getDate() + n);
  return dateToStr(d);
}

var S = {
  room: null, date: null, times: [], co: 'hifive', sDate: null,
  bookings: [
    {room:'large',  date:dsOffset(0), times:['10:00','10:30','11:00'], co:'hifive',  name:'田中', type:'社内会議'},
    {room:'medium', date:dsOffset(0), times:['14:00','14:30'],         co:'highway', name:'鈴木', type:'WEB会議'},
    {room:'web1',   date:dsOffset(0), times:['09:00','09:30'],         co:'hifive',  name:'山田', type:'WEB会議'},
    {room:'large',  date:dsOffset(1), times:['13:00','13:30','14:00'], co:'highway', name:'佐藤', type:'外部MTG'},
    {room:'medium', date:dsOffset(1), times:['10:00','10:30','11:00','11:30'], co:'hifive', name:'伊藤', type:'ブレスト'}
  ]
};

// 日付オブジェクト→'YYYY-MM-DD'文字列（ローカル時間基準）
function dateToStr(d) {
  return d.getFullYear() + '-' +
    String(d.getMonth()+1).padStart(2,'0') + '-' +
    String(d.getDate()).padStart(2,'0');
}
// 'YYYY-MM-DD'→表示文字列
function fmtDate(s) {
  var parts = s.split('-');
  var y = parseInt(parts[0]), m = parseInt(parts[1]), d = parseInt(parts[2]);
  var dow = new Date(y, m-1, d).getDay();
  return m + '月' + d + '日（' + DAYS[dow] + '）';
}

function switchTab(name) {
  var names = ['rooms','booking','schedule','cancel','rules'];
  var tabs = document.querySelectorAll('.tab');
  for (var i = 0; i < tabs.length; i++) tabs[i].classList.toggle('active', names[i] === name);
  var panels = document.querySelectorAll('.panel');
  for (var j = 0; j < panels.length; j++) panels[j].classList.remove('active');
  document.getElementById('panel-' + name).classList.add('active');
  if (name === 'schedule') initSched();
  if (name === 'cancel') renderCancelPanel();
}

// ── グリッドカレンダー描画 ──
function buildGridCal() {
  var today = new Date();
  var maxDate = new Date(today.getFullYear(), today.getMonth() + 2, today.getDate()); // 2ヶ月先

  var label = calViewYear + '年' + (calViewMonth + 1) + '月';
  document.getElementById('calMonthLabel').textContent = label;

  var grid = document.getElementById('calGrid');
  grid.innerHTML = '';

  var firstDay = new Date(calViewYear, calViewMonth, 1).getDay(); // 0=日
  var daysInMonth = new Date(calViewYear, calViewMonth + 1, 0).getDate();

  // 空白セル
  for (var b = 0; b < firstDay; b++) {
    var empty = document.createElement('div');
    empty.className = 'cal-cell cal-empty';
    grid.appendChild(empty);
  }

  for (var d = 1; d <= daysInMonth; d++) {
    (function(day) {
      var date = new Date(calViewYear, calViewMonth, day);
      var dateStr = dateToStr(date);
      var dow = date.getDay();
      var isPast = date < new Date(today.getFullYear(), today.getMonth(), today.getDate());
      var isFuture = date > maxDate;
      var isToday = dateStr === dateToStr(today);
      var isSelected = dateStr === S.date;

      var el = document.createElement('div');
      var cls = 'cal-cell';
      if (isPast || isFuture) cls += ' cal-past';
      if (isToday) cls += ' cal-today';
      if (isSelected) cls += ' cal-selected';
      if (dow === 0) cls += ' cal-sun';
      if (dow === 6) cls += ' cal-sat';
      el.className = cls;
      el.textContent = day;

      if (!isPast && !isFuture) {
        el.onclick = function() {
          S.date = dateStr;
          S.times = [];
          buildTG();
          buildGridCal(); // 再描画で選択反映
          updateSum();
        };
      }
      grid.appendChild(el);
    })(d);
  }
}

function calMove(dir) {
  calViewMonth += dir;
  if (calViewMonth > 11) { calViewMonth = 0; calViewYear++; }
  if (calViewMonth < 0)  { calViewMonth = 11; calViewYear--; }
  buildGridCal();
}

// スケジュール用カレンダーは従来のストリップ型を維持
function buildStripCal(id, cb) {
  var wrap = document.getElementById(id);
  wrap.innerHTML = '';
  for (var i = 0; i < 31; i++) {
    (function(idx) {
      var d = new Date(); d.setDate(d.getDate() + idx);
      var str = dateToStr(d);
      var el = document.createElement('div');
      el.className = 'cal-day' + (idx === 0 ? ' today' : '');
      el.innerHTML = '<div class="dn">' + DAYS[d.getDay()] + '</div><div class="dd">' + d.getDate() + '</div>';
      el.onclick = function() {
        var all = wrap.querySelectorAll('.cal-day');
        for (var k = 0; k < all.length; k++) all[k].classList.remove('selected');
        el.classList.add('selected');
        cb(str);
      };
      if (idx === 0) { el.classList.add('selected'); cb(str); }
      wrap.appendChild(el);
    })(i);
  }
}

function buildTG() {
  var g = document.getElementById('timeGrid');
  if (!g) return;
  g.innerHTML = '';
  var booked = [];
  S.bookings.forEach(function(b) {
    if (b.room === S.room && b.date === S.date) booked = booked.concat(b.times);
  });
  HOURS.forEach(function(h) {
    var el = document.createElement('div');
    var iB = booked.indexOf(h) >= 0;
    var iS = S.times.indexOf(h) >= 0;
    el.className = 'tslot' + (iB ? ' booked' : '') + (iS ? ' selected' : '');
    el.textContent = h;
    if (!iB) {
      (function(hour, elem) {
        elem.onclick = function() {
          var idx = S.times.indexOf(hour);
          if (idx >= 0) { S.times.splice(idx, 1); elem.classList.remove('selected'); }
          else { S.times.push(hour); elem.classList.add('selected'); }
          updateSum();
        };
      })(h, el);
    }
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
  buildTG(); updateSum();
}

function setCo(c) {
  S.co = c;
  document.getElementById('co-hf').classList.toggle('active', c === 'hifive');
  document.getElementById('co-hw').classList.toggle('active', c === 'highway');
  updateSum();
}

function updateSum() {
  document.getElementById('s-room').textContent = S.room ? ROOMS[S.room].name : '未選択';
  document.getElementById('s-date').textContent = S.date ? fmtDate(S.date) : '—';
  document.getElementById('s-co').textContent = S.co === 'hifive' ? 'HIGH FIVE' : 'HIGHWAY PLANET';
  var nm = document.getElementById('f-name');
  document.getElementById('s-name').textContent = nm ? (nm.value || '—') : '—';
  var px = document.getElementById('f-pax');
  document.getElementById('s-pax').textContent = (px ? px.value : 3) + '名';
  var ty = document.getElementById('f-type');
  document.getElementById('s-type').textContent = ty ? ty.value : '社内会議';
  var sc = document.getElementById('s-chips');
  var sorted = S.times.slice().sort();
  sc.innerHTML = sorted.length
    ? sorted.map(function(t) { return '<span class="chip">' + t + '</span>'; }).join('')
    : '<span style="font-size:11.5px;color:var(--text3)">未選択</span>';
}

function submitBooking() {
  var nm = document.getElementById('f-name').value.trim();
  var em = document.getElementById('f-email').value.trim();
  if (!S.room)         { alert('部屋を選択してください'); return; }
  if (!S.date)         { alert('日付を選択してください'); return; }
  if (!S.times.length) { alert('時間帯を選択してください'); return; }
  if (!nm)             { alert('お名前を入力してください'); return; }
  if (!em)             { alert('メールアドレスを入力してください'); return; }
  var s = S.times.slice().sort();
  document.getElementById('modalBody').innerHTML =
    '<strong>' + ROOMS[S.room].name + '</strong><br>' +
    '📅 ' + fmtDate(S.date) + '<br>' +
    '⏱ ' + s[0] + ' 〜 ' + s[s.length-1] + '<br>' +
    '🏢 ' + (S.co === 'hifive' ? 'HIGH FIVE' : 'HIGHWAY PLANET') + ' / ' + nm +
    '（' + document.getElementById('f-pax').value + '名）<br>' +
    '📋 ' + document.getElementById('f-type').value;
  document.getElementById('overlay').classList.add('show');
}

function closeModal() { document.getElementById('overlay').classList.remove('show'); }

function confirmBooking() {
  S.bookings.push({
    room: S.room, date: S.date, times: S.times.slice(),
    co: S.co, name: document.getElementById('f-name').value,
    type: document.getElementById('f-type').value
  });
  closeModal(); S.times = []; S.room = null;
  var pills = document.querySelectorAll('.rpill');
  for (var i = 0; i < pills.length; i++) pills[i].classList.remove('active');
  buildTG(); updateSum();
  ['f-name','f-note','f-email'].forEach(function(id) {
    var el = document.getElementById(id); if (el) el.value = '';
  });
  var t = document.getElementById('toast');
  t.textContent = '✅ 予約が完了しました！';
  t.classList.add('show');
  setTimeout(function() { t.classList.remove('show'); }, 3600);
}

// スケジュール用カレンダー
var schedViewYear, schedViewMonth;

function schedCalMove(dir) {
  schedViewMonth += dir;
  if (schedViewMonth > 11) { schedViewMonth = 0; schedViewYear++; }
  if (schedViewMonth < 0)  { schedViewMonth = 11; schedViewYear--; }
  buildSchedGridCal();
}

function buildSchedGridCal() {
  var today = new Date();
  var maxDate = new Date(today.getFullYear(), today.getMonth() + 2, today.getDate());

  document.getElementById('schedMonthLabel').textContent = schedViewYear + '年' + (schedViewMonth + 1) + '月';

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
    (function(day) {
      var date = new Date(schedViewYear, schedViewMonth, day);
      var dateStr = dateToStr(date);
      var dow = date.getDay();
      var isPast = date < new Date(today.getFullYear(), today.getMonth(), today.getDate());
      var isFuture = date > maxDate;
      var isToday = dateStr === dateToStr(today);
      var isSelected = dateStr === S.sDate;

      var el = document.createElement('div');
      var cls = 'cal-cell';
      if (isPast || isFuture) cls += ' cal-past';
      if (isToday) cls += ' cal-today';
      if (isSelected) cls += ' cal-selected';
      if (dow === 0) cls += ' cal-sun';
      if (dow === 6) cls += ' cal-sat';
      el.className = cls;
      el.textContent = day;

      if (!isPast && !isFuture) {
        el.onclick = function() {
          S.sDate = dateStr;
          buildSchedGridCal();
          document.getElementById('schedDateLbl').textContent = fmtDate(dateStr);
          buildTL(dateStr);
        };
      }
      grid.appendChild(el);
    })(d);
  }
}

function initSched() {
  var n = new Date();
  document.getElementById('schedTtl').textContent = n.getFullYear() + '年' + (n.getMonth()+1) + '月';
  schedViewYear  = n.getFullYear();
  schedViewMonth = n.getMonth();
  // 今日を初期選択
  var todayStr = dateToStr(n);
  S.sDate = todayStr;
  document.getElementById('schedDateLbl').textContent = fmtDate(todayStr);
  buildSchedGridCal();
  buildTL(todayStr);
}

function buildTL(dateStr) {
  var wrap = document.getElementById('tlGrid');
  wrap.innerHTML = '';

  var TL_HOURS = ['09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00'];

  // ── ヘッダー行（部屋ラベル列 + 時間軸列） ──
  var header = document.createElement('div');
  header.style.cssText = 'display:contents';

  var corner = document.createElement('div');
  corner.className = 'tl-corner';
  corner.textContent = '部屋';

  var hcell = document.createElement('div');
  hcell.className = 'tl-hcell';
  TL_HOURS.forEach(function(h) {
    var d = document.createElement('div');
    d.className = 'tl-h';
    d.textContent = h;
    hcell.appendChild(d);
  });

  wrap.appendChild(corner);
  wrap.appendChild(hcell);

  // ── 各部屋の行（部屋名 + タイムバー） ──
  Object.keys(ROOMS).forEach(function(rk) {
    var rm = ROOMS[rk];

    // 左セル：部屋名
    var rc = document.createElement('div');
    rc.className = 'tl-rcell';
    rc.innerHTML = '<div class="tl-rname">' + rm.name + '</div><div class="tl-rcap">' + rm.cap + '</div>';

    // 右セル：タイムバー
    var bc = document.createElement('div');
    bc.className = 'tl-bcell';
    var tr = document.createElement('div');
    tr.className = 'tl-track';

    S.bookings.forEach(function(bk) {
      if (bk.room !== rk || bk.date !== dateStr) return;
      var s = bk.times.slice().sort();
      var si = HOURS.indexOf(s[0]);
      var ei = HOURS.indexOf(s[s.length - 1]) + 1;
      if (si < 0) return;
      var bl = document.createElement('div');
      bl.className = 'tl-block ' + (bk.co === 'hifive' ? 'tl-hf' : 'tl-hw');
      bl.style.left  = (si / HOURS.length * 100) + '%';
      bl.style.width = ((ei - si) / HOURS.length * 100) + '%';
      bl.textContent = bk.name + '（' + bk.type + '）';
      bl.title = bk.name + ' / ' + bk.type + ' / ' + s[0] + '〜' + s[s.length - 1];
      tr.appendChild(bl);
    });

    bc.appendChild(tr);
    wrap.appendChild(rc);
    wrap.appendChild(bc);
  });
}

var cancelTargetIdx = -1;

function renderCancelPanel() {
  var list = document.getElementById('myBookingsList');
  if (!list) return;
  var now = new Date();
  var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // 今日以降の予約を元インデックス付きで取得
  var future = [];
  S.bookings.forEach(function(b, i) {
    var parts = b.date.split('-');
    var bd = new Date(parseInt(parts[0]), parseInt(parts[1])-1, parseInt(parts[2]));
    if (bd >= today) future.push({b: b, i: i});
  });

  if (future.length === 0) {
    list.innerHTML = '<div class="cancel-empty">現在の予約はありません</div>';
    return;
  }

  // 日付順ソート
  future.sort(function(a, b) {
    return a.b.date.localeCompare(b.b.date) || a.b.times[0].localeCompare(b.b.times[0]);
  });

  // 月ごとにグループ化
  var months = {};
  future.forEach(function(item) {
    var ym = item.b.date.slice(0, 7); // "YYYY-MM"
    if (!months[ym]) months[ym] = [];
    months[ym].push(item);
  });

  var ymKeys = Object.keys(months).sort();

  // 月タブを生成
  var tabsHtml = '<div class="cancel-month-tabs" id="cancelMonthTabs">';
  ymKeys.forEach(function(ym, i) {
    var parts = ym.split('-');
    var label = parseInt(parts[0]) + '年' + parseInt(parts[1]) + '月 (' + months[ym].length + '件)';
    tabsHtml += '<button class="cancel-month-tab' + (i===0?' active':'') + '" onclick="switchCancelMonth('' + ym + '')">' + label + '</button>';
  });
  tabsHtml += '</div>';

  // 月ごとのリストを生成
  var listsHtml = '';
  ymKeys.forEach(function(ym, i) {
    listsHtml += '<div class="cancel-month-list' + (i===0?'':' hidden') + '" id="cancelList_' + ym.replace('-','_') + '">';
    listsHtml += '<ul class="cancel-list">';
    months[ym].forEach(function(item) {
      var b = item.b;
      var realIdx = item.i;
      var s = b.times.slice().sort();
      var coName = b.co === 'hifive' ? 'HIGH FIVE' : 'HIGHWAY PLANET';
      listsHtml +=
        '<li class="cancel-item">' +
          '<div class="cancel-item-info">' +
            '<div class="cancel-item-room">' + (ROOMS[b.room] ? ROOMS[b.room].name : b.room) + '</div>' +
            '<div class="cancel-item-detail">📅 ' + fmtDate(b.date) + '　⏱ ' + s[0] + ' 〜 ' + s[s.length-1] + '</div>' +
            '<div class="cancel-item-detail">🏢 ' + coName + (b.name ? ' / ' + b.name : '') + '</div>' +
          '</div>' +
          '<button class="cancel-item-btn" data-cancelidx="' + realIdx + '">キャンセル</button>' +
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
  var ymId = ym.replace('-','_');
  var targetList = document.getElementById('cancelList_' + ymId);
  if (targetList) targetList.classList.remove('hidden');
  // 対応するタブをアクティブに
  tabs.forEach(function(t){
    if (t.getAttribute('data-cancelmonth') === ym) t.classList.add('active');
  });
}

function openCancelConfirm(idx) {
  var b = S.bookings[idx];
  if (!b) { alert('予約が見つかりません。画面を更新してください。'); return; }
  cancelTargetIdx = idx;
  var s = b.times.slice().sort();
  var coName = b.co === 'hifive' ? 'HIGH FIVE' : 'HIGHWAY PLANET';
  document.getElementById('cancelConfirmBody').innerHTML =
    '🏢 <strong>' + (ROOMS[b.room] ? ROOMS[b.room].name : b.room) + '</strong><br>' +
    '📅 ' + fmtDate(b.date) + '<br>' +
    '⏱ ' + s[0] + ' 〜 ' + s[s.length-1] + '<br>' +
    '👤 ' + coName + (b.name ? ' / ' + b.name : '');
  var ov = document.getElementById('cancelConfirmOverlay');
  ov.style.opacity = '1';
  ov.style.pointerEvents = 'all';
  document.getElementById('cancelConfirmBox').style.transform = 'scale(1)';
  document.getElementById('cancelConfirmBtn').onclick = executeCancelBooking;
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
  S.bookings.splice(cancelTargetIdx, 1);
  closeCancelConfirm();
  renderCancelPanel();
  var t = document.getElementById('toast');
  t.textContent = '🗑 予約をキャンセルしました';
  t.classList.add('show');
  setTimeout(function(){ t.classList.remove('show'); }, 3000);
}

window.onload = function() {
  // ── 全イベントをここで一括登録（Cloudflare対策） ──
  document.addEventListener('click', function(e) {
    var t = e.target;
    // ログイン
    if (t.classList.contains('login-btn')) { doLogin(); return; }
    // タブ
    if (t.dataset.tab) { switchTab(t.dataset.tab); return; }
    // 部屋カード
    if (t.dataset.room) { pickRoom(t.dataset.room); return; }
    if (t.closest('[data-room]')) { pickRoom(t.closest('[data-room]').dataset.room); return; }
    // 部屋ピル
    if (t.dataset.setroom) { setRoom(t.dataset.setroom); return; }
    // カレンダーナビ
    if (t.dataset.calmove) { calMove(parseInt(t.dataset.calmove)); return; }
    if (t.dataset.schedmove) { schedCalMove(parseInt(t.dataset.schedmove)); return; }
    // 会社選択
    if (t.dataset.setco) { setCo(t.dataset.setco); return; }
    // 予約確定
    if (t.id === 'btnSubmit') { submitBooking(); return; }
    if (t.id === 'btnCloseModal') { closeModal(); return; }
    if (t.id === 'btnConfirm') { confirmBooking(); return; }
    if (t.id === 'btnCloseCancelConfirm') { closeCancelConfirm(); return; }
    if (t.id === 'cancelConfirmBtn') { executeCancelBooking(); return; }
    // キャンセル月タブ
    if (t.dataset.cancelmonth) { switchCancelMonth(t.dataset.cancelmonth); return; }
    // キャンセルボタン
    if (t.dataset.cancelidx !== undefined && t.dataset.cancelidx !== '') {
      openCancelConfirm(parseInt(t.dataset.cancelidx)); return;
    }
  });
  // inputイベント
  document.addEventListener('input', function(e) {
    if (e.target.dataset.updatesum) updateSum();
  });
  // Enterキーでログイン
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && document.getElementById('loginPw') === document.activeElement) {
      doLogin();
    }
  });
  var n = new Date();
  document.getElementById('hdrDate').textContent =
    n.getFullYear() + '/' + String(n.getMonth()+1).padStart(2,'0') + '/' +
    String(n.getDate()).padStart(2,'0') + ' (' + DAYS[n.getDay()] + ')';

  // カレンダー初期表示を今月に
  calViewYear  = n.getFullYear();
  calViewMonth = n.getMonth();
  buildGridCal();
  updateSum();
};