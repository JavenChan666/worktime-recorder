/* ============================================================
 * 工时记录助手 · 应用主逻辑
 * 页面：首页 / 新增编辑 / 日历 / 全部记录 / 薪资配置 / 备份导出
 * ========================================================== */
(function () {
  'use strict';

  var TYPES = [[1, '正常班'], [2, '平日加班'], [3, '周末加班'], [4, '夜班']];
  var NAV = [
    { r: 'home', ic: 'home', t: '首页' },
    { r: 'calendar', ic: 'cal', t: '日历' },
    { r: 'records', ic: 'list', t: '记录' },
    { r: 'settings', ic: 'gear', t: '薪资' },
    { r: 'backup', ic: 'db', t: '数据' }
  ];

  function icon(name, sz) {
    sz = sz || 20;
    var P = {
      home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/>',
      cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
      list: '<path d="M9 6h12M9 12h12M9 18h12"/><circle cx="4.5" cy="6" r="1.2"/><circle cx="4.5" cy="12" r="1.2"/><circle cx="4.5" cy="18" r="1.2"/>',
      gear: '<path d="M4 8h9M19 8h1M4 16h1M11 16h9"/><circle cx="16" cy="8" r="2.5"/><circle cx="8" cy="16" r="2.5"/>',
      db: '<ellipse cx="12" cy="5.5" rx="8" ry="3"/><path d="M4 5.5V18.5c0 1.66 3.58 3 8 3s8-1.34 8-3V5.5"/><path d="M4 12c0 1.66 3.58 3 8 3s8-1.34 8-3"/>',
      edit: '<path d="M4 20h4L19.5 8.5a2.12 2.12 0 0 0-3-3L5 17l-1 4z"/><path d="M13.5 6.5l3 3"/>',
      trash: '<path d="M4 7h16M9.5 7V4h5v3M6.5 7l1 13h9l1-13"/><path d="M10 11v5.5M14 11v5.5"/>',
      close: '<path d="M6 6l12 12M18 6 6 18"/>'
    }[name];
    return '<svg width="' + sz + '" height="' + sz + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + P + '</svg>';
  }

  var state = {
    route: 'home',
    month: '',
    editId: null,
    editDate: '',
    search: '',
    type: 0,
    sheetDate: null,
    form: null,
    back: 'home'
  };

  var el = {};
  var isTablet = false;

  /* ---------------- 工具函数 ---------------- */
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function fmtDate(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function todayStr() { return fmtDate(new Date()); }
  function shiftDay(dateStr, delta) {
    var p = dateStr.split('-');
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    d.setDate(d.getDate() + delta);
    return fmtDate(d);
  }
  function monthOf(dateStr) { return String(dateStr).slice(0, 7); }
  function addMonth(mk, delta) {
    var p = mk.split('-');
    var d = new Date(+p[0], +p[1] - 1 + delta, 1);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1);
  }
  function daysInMonth(mk) {
    var p = mk.split('-');
    return new Date(+p[0], +p[1], 0).getDate();
  }
  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function money(n) { return '¥' + (Math.round((+n || 0) * 100) / 100).toFixed(2); }
  function hour(n) { return (Math.round((+n || 0) * 100) / 100).toFixed(1) + 'h'; }
  function typeTag(t) { return '<span class="tag t' + t + '">' + (Calc.TYPE_LABEL[t] || '正常班') + '</span>'; }
  function weekdayCn(dateStr) {
    var w = new Date(dateStr + 'T00:00:00').getDay();
    return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][w];
  }

  var toastTimer = null;
  function toast(msg) {
    el.toast.textContent = msg;
    el.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.toast.classList.remove('show'); }, 1900);
  }

  function go(route, opt) {
    state.route = route;
    if (opt) Object.assign(state, opt);
    if (route !== 'edit') state.editId = null;
    try { history.replaceState(null, '', '#' + route); } catch (e) {}
    render();
    window.scrollTo(0, 0);
  }

  /* ---------------- SVG 图表：当月每日工时 ---------------- */
  function chartSvg(records, mk) {
    var p = mk.split('-'), y = +p[0], m = +p[1];
    var days = daysInMonth(mk);
    var byDay = {};
    records.forEach(function (r) {
      var d = parseInt(String(r.record_date).slice(8, 10), 10);
      if (!byDay[d]) byDay[d] = { n: 0, o: 0 };
      byDay[d].n += (+r.normal_hour || 0);
      byDay[d].o += (+r.overtime_hour || 0);
    });
    var max = 8;
    Object.keys(byDay).forEach(function (d) { max = Math.max(max, byDay[d].n + byDay[d].o); });
    max = Math.ceil(max / 2) * 2;

    var W = 720, H = 210, padL = 30, padR = 10, padT = 12, padB = 26;
    var plotW = W - padL - padR, plotH = H - padT - padB;
    var step = plotW / days, bw = Math.max(2.5, step * 0.6);
    var s = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="当月每日工时柱状图">';
    // 网格与刻度
    [0, 0.5, 1].forEach(function (f) {
      var yy = padT + plotH * (1 - f);
      s += '<line x1="' + padL + '" y1="' + yy + '" x2="' + (W - padR) + '" y2="' + yy + '" stroke="currentColor" stroke-opacity=".12" stroke-width="1"/>';
      s += '<text x="' + (padL - 6) + '" y="' + (yy + 4) + '" font-size="10" fill="currentColor" fill-opacity=".55" text-anchor="end">' + Math.round(max * f) + '</text>';
    });
    for (var d = 1; d <= days; d++) {
      var v = byDay[d];
      var x = padL + (d - 1) * step + (step - bw) / 2;
      if (v) {
        var hn = (v.n / max) * plotH, ho = (v.o / max) * plotH;
        if (hn > 0) s += '<rect x="' + x.toFixed(1) + '" y="' + (padT + plotH - hn).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + hn.toFixed(1) + '" rx="2" fill="#2563eb"/>';
        if (ho > 0) s += '<rect x="' + x.toFixed(1) + '" y="' + (padT + plotH - hn - ho).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + ho.toFixed(1) + '" rx="2" fill="#f59e0b"/>';
      }
      if (d === 1 || d % 5 === 0 || d === days) {
        s += '<text x="' + (padL + (d - 1) * step + step / 2).toFixed(1) + '" y="' + (H - 8) + '" font-size="10" fill="currentColor" fill-opacity=".55" text-anchor="middle">' + d + '</text>';
      }
    }
    s += '</svg>';
    return s;
  }

  /* ---------------- 记录条目（卡片） ---------------- */
  function recItem(r) {
    return '<div class="rec">' +
      '<div class="main">' +
        '<div class="line1"><span class="mono">' + esc(r.record_date) + '</span>' + typeTag(r.work_type) +
          (r.night_flag == 1 && r.work_type != 4 ? '<span class="tag night">夜班</span>' : '') +
          '<span class="line2">' + weekdayCn(r.record_date) + '</span></div>' +
        '<div class="line2"><span class="mono">' + esc(r.start_time) + '–' + esc(r.end_time) + '</span>' +
          ' · 有效 ' + hour(r.valid_work_hour) + (r.overtime_hour > 0 ? ' · 加班 ' + hour(r.overtime_hour) : '') +
          (r.remark ? ' · ' + esc(r.remark) : '') + '</div>' +
      '</div>' +
      '<div class="money">' + money(r.day_income) + '</div>' +
      '<div class="ops">' +
        '<button class="iconbtn" data-act="edit" data-id="' + r.id + '" title="编辑">' + icon('edit', 16) + '</button>' +
        '<button class="iconbtn" data-act="del" data-id="' + r.id + '" title="删除">' + icon('trash', 16) + '</button>' +
      '</div>' +
    '</div>';
  }

  /* ---------------- 各页面 ---------------- */
  var views = {};

  views.home = function () {
    var mk = state.month;
    var list = DB.records.byMonth(mk);
    var s = Calc.summarize(list);
    var cfg = DB.config.get();
    var today = todayStr(), yest = shiftDay(today, -1);
    var tRec = DB.records.byDate(today), yRec = DB.records.byDate(yest);

    var h = '<div class="stat-grid">' +
      '<div class="stat hero"><div class="label">当月总收入（预估）</div><div class="value">' + money(s.total_income) + '</div>' +
        '<div class="label">平均每日 ' + s.avg_hour + ' 小时 · 时薪 ¥' + cfg.hour_wage + '</div></div>' +
      '<div class="stat"><div class="label">出勤天数</div><div class="value">' + s.total_days + '<span class="unit">天</span></div></div>' +
      '<div class="stat"><div class="label">总有效工时</div><div class="value">' + s.total_valid + '<span class="unit">h</span></div></div>' +
      '<div class="stat ot"><div class="label">总加班工时</div><div class="value">' + s.total_overtime + '<span class="unit">h</span></div></div>' +
      '<div class="stat"><div class="label">平均每日工时</div><div class="value">' + s.avg_hour + '<span class="unit">h</span></div></div>' +
    '</div>';

    h += '<div class="card"><div class="card-title">当月每日工时<span class="sub">蓝=正常 · 橙=加班</span></div>' +
      chartSvg(list, mk) +
      '<div class="legend"><span><i style="background:#2563eb"></i>正常工时 ' + hour(s.total_normal) + '</span>' +
      '<span><i style="background:#f59e0b"></i>加班工时 ' + hour(s.total_overtime) + '</span></div></div>';

    // 今日 / 昨日
    h += '<div class="card"><div class="card-title">快捷记录</div>';
    if (tRec.length) {
      tRec.forEach(function (r) {
        h += '<div class="row-between"><div><b>今日</b> <span class="mono">' + esc(r.start_time) + '–' + esc(r.end_time) + '</span> ' +
          typeTag(r.work_type) + '<div class="hint">有效 ' + hour(r.valid_work_hour) + ' · 收入 ' + money(r.day_income) + '</div></div>' +
          '<button class="btn" data-act="edit" data-id="' + r.id + '">修改</button></div>';
      });
    } else {
      h += '<div class="row-between"><div><b>今日</b><div class="hint">还没有记录，点右侧开始记工时</div></div>' +
        '<button class="btn primary" data-act="new" data-date="' + today + '">记今日工时</button></div>';
    }
    h += '<div class="divider"></div>';
    if (yRec.length) {
      yRec.forEach(function (r) {
        h += '<div class="row-between"><div><b>昨日</b> <span class="mono">' + esc(r.start_time) + '–' + esc(r.end_time) + '</span> ' +
          typeTag(r.work_type) + '<div class="hint">有效 ' + hour(r.valid_work_hour) + ' · 收入 ' + money(r.day_income) + '</div></div>' +
          '<button class="btn" data-act="edit" data-id="' + r.id + '">修改</button></div>';
      });
    } else {
      h += '<div class="row-between"><div><b>昨日</b><div class="hint">无记录，可补录</div></div>' +
        '<button class="btn" data-act="new" data-date="' + yest + '">补录昨日</button></div>';
    }
    h += '</div>';

    // 最近记录
    h += '<div class="card"><div class="card-title">最近记录<span class="sub">共 ' + DB.records.count() + ' 条</span></div>';
    if (!DB.records.all().length) {
      h += '<div class="empty"><span class="big">🕒</span>还没有任何工时记录<br>点击下方“+”开始记录</div>';
    } else {
      h += DB.records.all().slice(0, 5).map(recItem).join('');
    }
    h += '</div>';

    h += '<button class="fab" data-act="new" data-date="' + today + '" title="新增工时">＋</button>';
    return h;
  };

  views.edit = function () {
    var cfg = DB.config.get();
    var rec = state.editId ? DB.records.get(state.editId) : null;
    var f = state.form || (rec ? {
      record_date: rec.record_date, start_time: rec.start_time, end_time: rec.end_time,
      rest_hour: rec.rest_hour, work_type: rec.work_type, night_flag: rec.night_flag, remark: rec.remark
    } : {
      record_date: state.editDate || todayStr(), start_time: '09:00', end_time: '18:00',
      rest_hour: cfg.rest_hour_per_day, work_type: 1, night_flag: 0, remark: ''
    });
    state.form = f;

    var h = '<div class="card"><div class="card-title">' + (rec ? '编辑工时记录' : '新增工时记录') + '</div>' +
      '<div class="field"><label>日期</label><input type="date" id="f_date" value="' + esc(f.record_date) + '"></div>' +
      '<div class="grid2">' +
        '<div class="field"><label>上班时间</label><input type="time" id="f_start" value="' + esc(f.start_time) + '"></div>' +
        '<div class="field"><label>下班时间</label><input type="time" id="f_end" value="' + esc(f.end_time) + '"></div>' +
      '</div>' +
      '<div class="field"><label>休息扣除时长（小时）</label><input type="number" id="f_rest" step="0.5" min="0" inputmode="decimal" value="' + (f.rest_hour === '' ? 0 : f.rest_hour) + '"></div>' +
      '<div class="field"><label>工作类型</label><div class="segment" id="f_type">' +
        TYPES.map(function (t) {
          return '<button type="button" data-act="type" data-type="' + t[0] + '" class="' + (+f.work_type === t[0] ? 'on' : '') + '">' + t[1] + '</button>';
        }).join('') + '</div></div>' +
      '<div class="switch-row"><div>夜班补贴<div class="desc">勾选后按配置 ' +
        (cfg.night_subsidy_mode === 'hour' ? '每小时 ¥' + cfg.night_subsidy : '每天 ¥' + cfg.night_subsidy) + ' 计入</div></div>' +
        '<label class="switch"><input type="checkbox" id="f_night"' + (f.night_flag == 1 ? ' checked' : '') + '><span class="track"></span></label></div>' +
      '<div class="field"><label>备注（项目 / 班组 / 内容）</label><textarea id="f_remark" placeholder="例如：3号厂房布线">' + esc(f.remark) + '</textarea></div>' +
      '<div class="btn-row"><button class="btn" data-act="copy-last">复制上次记录</button>' +
        '<button class="btn" data-act="today">设为今天</button></div>' +
    '</div>';

    h += '<div class="card" id="preview">' + previewHtml(f, cfg) + '</div>';

    h += '<div class="btn-row"><button class="btn primary block" data-act="save">保存记录</button></div>';
    if (rec) h += '<div class="btn-row"><button class="btn danger block" data-act="del" data-id="' + rec.id + '">删除这条记录</button></div>';
    h += '<div class="btn-row"><button class="btn block" data-act="cancel">返回</button></div>';
    h += '<div class="hint" style="margin-top:10px">计算规则：有效工时 = 下班−上班−休息；超过每日标准 ' + cfg.standard_work_hour + ' 小时的部分计入加班。</div>';
    return h;
  };

  function previewHtml(f, cfg) {
    var r = Calc.compute(f, cfg);
    return '<div class="card-title">自动结算预览</div>' +
      '<div class="kv"><span>总在岗时长</span><b>' + hour(r.total_work_hour) + '</b></div>' +
      '<div class="kv"><span>有效工时（扣休息）</span><b>' + hour(r.valid_work_hour) + '</b></div>' +
      '<div class="kv"><span>正常工时</span><b>' + hour(r.normal_hour) + ' × ¥' + cfg.hour_wage + '</b></div>' +
      '<div class="kv"><span>加班工时</span><b>' + hour(r.overtime_hour) + ' × ¥' + cfg.hour_wage + ' × ' + r.overtime_rate + '</b></div>' +
      (r.night_subsidy > 0 ? '<div class="kv"><span>夜班补贴</span><b>' + money(r.night_subsidy) + '</b></div>' : '') +
      '<div class="kv"><span>当日工资</span><b style="color:var(--income);font-size:18px">' + money(r.day_income) + '</b></div>';
  }

  views.calendar = function () {
    var mk = state.month, p = mk.split('-'), y = +p[0], m = +p[1];
    var days = daysInMonth(mk);
    var first = new Date(y, m - 1, 1).getDay();
    var list = DB.records.byMonth(mk);
    var byDay = {};
    list.forEach(function (r) {
      var d = parseInt(String(r.record_date).slice(8, 10), 10);
      byDay[d] = byDay[d] || { h: 0, o: 0 };
      byDay[d].h += (+r.valid_work_hour || 0);
      byDay[d].o += (+r.overtime_hour || 0);
    });
    var s = Calc.summarize(list);
    var today = todayStr();

    var h = '<div class="card"><div class="cal-head">' +
      ['日', '一', '二', '三', '四', '五', '六'].map(function (w) { return '<div>' + w + '</div>'; }).join('') + '</div>' +
      '<div class="cal-grid">';
    for (var i = 0; i < first; i++) h += '<div class="cal-cell empty"></div>';
    for (var d = 1; d <= days; d++) {
      var ds = mk + '-' + pad(d);
      var v = byDay[d];
      var wk = new Date(y, m - 1, d).getDay();
      var cls = 'cal-cell' + (v ? ' has' : '') + (ds === today ? ' today' : '') +
        (state.sheetDate === ds ? ' sel' : '') + (wk === 0 || wk === 6 ? ' weekend' : '');
      h += '<div class="' + cls + '" data-act="cal-day" data-date="' + ds + '">' +
        '<span class="d">' + d + '</span>' +
        (v ? '<span class="h">' + (Math.round(v.h * 10) / 10) + 'h</span>' : '') +
        (v && v.o > 0 ? '<span class="dot"></span>' : '') +
      '</div>';
    }
    h += '</div>' +
      '<div class="divider"></div>' +
      '<div class="kv"><span>本月出勤</span><b>' + s.total_days + ' 天</b></div>' +
      '<div class="kv"><span>本月有效工时</span><b>' + hour(s.total_valid) + '</b></div>' +
      '<div class="kv"><span>本月收入</span><b style="color:var(--income)">' + money(s.total_income) + '</b></div>' +
      '</div>';
    h += '<button class="fab" data-act="new" data-date="' + (state.sheetDate || today) + '">＋</button>';
    return h;
  };

  views.records = function () {
    var all = DB.records.byMonth(state.month);
    var kw = state.search.trim().toLowerCase();
    var list = all.filter(function (r) {
      if (state.type && +r.work_type !== +state.type) return false;
      if (!kw) return true;
      return (String(r.record_date) + ' ' + (r.remark || '') + ' ' + (Calc.TYPE_LABEL[r.work_type] || '')).toLowerCase().indexOf(kw) >= 0;
    });

    var h = '<div class="card">' +
      '<div class="searchbar"><input id="q" type="search" placeholder="搜索日期 / 备注 / 类型" value="' + esc(state.search) + '">' +
      '<button class="iconbtn" data-act="clear-search">' + icon('close', 16) + '</button></div>' +
      '<div class="chips"><button class="chip ' + (state.type === 0 ? 'on' : '') + '" data-act="ftype" data-type="0">全部</button>' +
      TYPES.map(function (t) {
        return '<button class="chip ' + (state.type === t[0] ? 'on' : '') + '" data-act="ftype" data-type="' + t[0] + '">' + t[1] + '</button>';
      }).join('') + '</div>' +
      '<div id="recList">' + (isTablet ? tableHtml(list) : listHtml(list)) + '</div>' +
      '</div>';
    h += '<button class="fab" data-act="new" data-date="' + todayStr() + '">＋</button>';
    return h;
  };

  function listHtml(list) {
    if (!list.length) return '<div class="empty"><span class="big">🔍</span>没有符合条件的记录</div>';
    return list.map(recItem).join('');
  }

  function tableHtml(list) {
    if (!list.length) return '<div class="empty"><span class="big">🔍</span>没有符合条件的记录</div>';
    var h = '<div class="table-wrap"><table class="grid"><thead><tr>' +
      '<th>日期</th><th>星期</th><th>上班</th><th>下班</th><th>类型</th><th>休息</th>' +
      '<th>在岗</th><th>有效</th><th>正常</th><th>加班</th><th>当日工资</th><th>备注</th><th>操作</th>' +
      '</tr></thead><tbody>';
    list.forEach(function (r) {
      h += '<tr>' +
        '<td>' + esc(r.record_date) + '</td>' +
        '<td>' + weekdayCn(r.record_date) + '</td>' +
        '<td>' + esc(r.start_time) + '</td>' +
        '<td>' + esc(r.end_time) + '</td>' +
        '<td>' + (Calc.TYPE_LABEL[r.work_type] || '') + (r.night_flag == 1 && r.work_type != 4 ? '·夜' : '') + '</td>' +
        '<td>' + (+r.rest_hour || 0) + '</td>' +
        '<td>' + (+r.total_work_hour || 0) + '</td>' +
        '<td>' + (+r.valid_work_hour || 0) + '</td>' +
        '<td>' + (+r.normal_hour || 0) + '</td>' +
        '<td>' + (+r.overtime_hour || 0) + '</td>' +
        '<td class="money">' + money(r.day_income) + '</td>' +
        '<td>' + esc(r.remark || '') + '</td>' +
        '<td><button class="iconbtn" data-act="edit" data-id="' + r.id + '">' + icon('edit', 16) + '</button> ' +
        '<button class="iconbtn" data-act="del" data-id="' + r.id + '">' + icon('trash', 16) + '</button></td>' +
      '</tr>';
    });
    return h + '</tbody></table></div>';
  }

  views.settings = function () {
    var c = DB.config.get();
    var h = '<div class="card"><div class="card-title">薪资与规则配置<span class="sub">配置一次，全部记录自动套用</span></div>' +
      '<div class="field"><label>日常时薪（元 / 小时）</label><input type="number" id="c_wage" step="0.5" inputmode="decimal" value="' + c.hour_wage + '"></div>' +
      '<div class="grid2">' +
        '<div class="field"><label>平时加班倍率</label><input type="number" id="c_r15" step="0.1" inputmode="decimal" value="' + c.overtime_rate15 + '"></div>' +
        '<div class="field"><label>周末加班倍率</label><input type="number" id="c_r20" step="0.1" inputmode="decimal" value="' + c.overtime_rate20 + '"></div>' +
      '</div>' +
      '<div class="field"><label>夜班补贴金额（元）</label><input type="number" id="c_night" step="1" inputmode="decimal" value="' + c.night_subsidy + '"></div>' +
      '<div class="field"><label>夜班补贴模式</label><select id="c_nmode">' +
        '<option value="day"' + (c.night_subsidy_mode === 'day' ? ' selected' : '') + '>按天补贴（每出勤日一次）</option>' +
        '<option value="hour"' + (c.night_subsidy_mode === 'hour' ? ' selected' : '') + '>按小时补贴（补贴 × 有效工时）</option>' +
      '</select></div>' +
      '<div class="grid2">' +
        '<div class="field"><label>每日休息扣减（小时）</label><input type="number" id="c_rest" step="0.5" inputmode="decimal" value="' + c.rest_hour_per_day + '"></div>' +
        '<div class="field"><label>每日标准工时（小时）</label><input type="number" id="c_std" step="0.5" inputmode="decimal" value="' + c.standard_work_hour + '"></div>' +
      '</div>' +
      '<div class="switch-row"><div>工时精确到 0.5 小时<div class="desc">行业通用口径，不足 0.5 小时按 0.5 计</div></div>' +
        '<label class="switch"><input type="checkbox" id="c_round"' + (c.round_half ? ' checked' : '') + '><span class="track"></span></label></div>' +
      '<div class="btn-row"><button class="btn primary block" data-act="save-config">保存并重算全部工资</button></div>' +
      '</div>';

    h += '<div class="card"><div class="card-title">当前计算口径</div>' +
      '<div class="hint">总在岗时长 = 下班 − 上班（跨零点自动 +24 小时）<br>' +
      '有效工时 = 总在岗时长 − 休息扣除时长<br>' +
      '有效工时 ≤ ' + c.standard_work_hour + 'h 全部算正常工时；超出部分算加班<br>' +
      '日工资 = 正常工时×时薪 + 加班工时×时薪×倍率 + 夜班补贴</div></div>';
    return h;
  };

  views.backup = function () {
    var n = DB.records.count();
    var all = DB.records.all();
    var first = all.length ? all[all.length - 1].record_date : '—';
    var last = all.length ? all[0].record_date : '—';
    var size = DB.usage();
    var h = '<div class="card"><div class="card-title">数据概况</div>' +
      '<div class="kv"><span>记录条数</span><b>' + n + ' 条</b></div>' +
      '<div class="kv"><span>记录区间</span><b>' + first + ' ~ ' + last + '</b></div>' +
      '<div class="kv"><span>占用空间</span><b>' + (size / 1024).toFixed(1) + ' KB</b></div>' +
      '<div class="hint" style="margin-top:8px">全部数据仅保存在本机浏览器 / 应用内，不联网、不上传任何服务器。</div>' +
      '</div>';

    h += '<div class="card"><div class="card-title">备份与恢复</div>' +
      '<div class="btn-row"><button class="btn primary block" data-act="export-json">导出备份文件（JSON）</button></div>' +
      '<div class="btn-row"><button class="btn block" data-act="import-json">从备份文件恢复</button></div>' +
      '<input type="file" id="fileInput" accept="application/json,.json" style="display:none">' +
      '<div class="hint" style="margin-top:8px">换手机、清缓存前请先导出备份；恢复时可选择“覆盖”或“合并”。</div>' +
      '</div>';

    h += '<div class="card"><div class="card-title">导出对账文件<span class="sub">可发给老板 / 人事</span></div>' +
      '<div class="btn-row"><button class="btn primary block" data-act="export-xlsx">导出 Excel（.xlsx）</button></div>' +
      '<div class="btn-row"><button class="btn block" data-act="export-csv">导出 CSV（Excel 可直接打开）</button></div>' +
      '<div class="grid2" style="margin-top:10px">' +
        '<div class="field"><label>导出月份</label><select id="exp_month">' + monthOptions() + '</select></div>' +
        '<div class="field"><label>或导出全部</label><select id="exp_all"><option value="0">按上面月份</option><option value="1">全部记录</option></select></div>' +
      '</div>' +
      '</div>';

    h += '<div class="card"><div class="card-title">危险操作</div>' +
      '<div class="btn-row"><button class="btn danger block" data-act="clear-all">清空全部数据</button></div>' +
      '<div class="hint" style="margin-top:8px">清空前建议先导出备份，此操作不可撤销。</div>' +
      '</div>';
    return h;
  };

  function monthOptions() {
    var months = {};
    DB.records.all().forEach(function (r) { months[monthOf(r.record_date)] = 1; });
    months[state.month] = 1;
    return Object.keys(months).sort().reverse().map(function (m) {
      return '<option value="' + m + '"' + (m === state.month ? ' selected' : '') + '>' + m + '</option>';
    }).join('');
  }

  /* ---------------- 顶部栏 / 底部导航 ---------------- */
  function topbarHtml() {
    var r = state.route;
    var title = { home: '工时记录助手', edit: '工时录入', calendar: '日历记录', records: '全部记录', settings: '薪资配置', backup: '备份与导出' }[r];
    var h = '';
    if (r === 'home' || r === 'calendar' || r === 'records') {
      h += '<div class="month-switch">' +
        '<button class="iconbtn" data-act="m-prev">‹</button>' +
        '<span class="m-title">' + state.month + '</span>' +
        '<button class="iconbtn" data-act="m-next">›</button></div>';
      h += '<div class="spacer"></div>';
      h += '<button class="iconbtn txt" data-act="m-today" title="回到本月">本月</button>';
    } else {
      h += '<h1>' + title + '</h1>';
      if (r === 'edit') h += '<button class="iconbtn" data-act="cancel">' + icon('close', 18) + '</button>';
    }
    return h;
  }

  function tabbarHtml() {
    var h = '<div class="brand" style="display:none">工时记录助手</div>';
    NAV.forEach(function (n) {
      h += '<a href="#' + n.r + '" class="' + (state.route === n.r ? 'on' : '') + '" data-act="nav" data-route="' + n.r + '">' +
        '<span class="ic">' + icon(n.ic, 19) + '</span><span>' + n.t + '</span></a>';
    });
    return h;
  }

  /* ---------------- 日历日详情弹层 ---------------- */
  function sheetHtml() {
    var d = state.sheetDate;
    var list = DB.records.byDate(d);
    var h = '<div class="backdrop" data-act="close-sheet"><div class="sheet" data-stop="1">' +
      '<h3>' + esc(d) + ' ' + weekdayCn(d) + '</h3>';
    if (!list.length) {
      h += '<div class="empty"><span class="big">😴</span>这天没有工时记录</div>';
    } else {
      h += list.map(recItem).join('');
      h += '<div class="divider"></div><div class="kv"><span>当日合计</span><b>' +
        hour(list.reduce(function (a, r) { return a + (+r.valid_work_hour || 0); }, 0)) + ' · ' +
        money(list.reduce(function (a, r) { return a + (+r.day_income || 0); }, 0)) + '</b></div>';
    }
    h += '<div class="btn-row"><button class="btn primary" data-act="new" data-date="' + d + '">新增这天记录</button>' +
      '<button class="btn" data-act="close-sheet">关闭</button></div>' +
      '</div></div>';
    return h;
  }

  /* ---------------- 渲染 ---------------- */
  function render() {
    el.topbar.innerHTML = topbarHtml();
    el.app.innerHTML = views[state.route] ? views[state.route]() : '';
    el.tabbar.innerHTML = tabbarHtml();
    el.layer.innerHTML = state.sheetDate && state.route === 'calendar' ? sheetHtml() : '';
    el.tabbar.querySelector('.brand').style.display = isTablet ? 'block' : 'none';
  }

  function refreshList() {
    var box = document.getElementById('recList');
    if (!box) return;
    var all = DB.records.byMonth(state.month);
    var kw = state.search.trim().toLowerCase();
    var list = all.filter(function (r) {
      if (state.type && +r.work_type !== +state.type) return false;
      if (!kw) return true;
      return (String(r.record_date) + ' ' + (r.remark || '') + ' ' + (Calc.TYPE_LABEL[r.work_type] || '')).toLowerCase().indexOf(kw) >= 0;
    });
    box.innerHTML = isTablet ? tableHtml(list) : listHtml(list);
  }

  function refreshPreview() {
    var box = document.getElementById('preview');
    if (!box) return;
    box.innerHTML = previewHtml(readForm(), DB.config.get());
  }

  function readForm() {
    var g = function (id) { var e = document.getElementById(id); return e ? e.value : ''; };
    var n = document.getElementById('f_night');
    return {
      record_date: g('f_date'), start_time: g('f_start'), end_time: g('f_end'),
      rest_hour: g('f_rest') === '' ? 0 : parseFloat(g('f_rest')),
      work_type: state.form ? state.form.work_type : 1,
      night_flag: (n && n.checked) ? 1 : 0,
      remark: g('f_remark')
    };
  }

  /* ---------------- 保存 / 删除 ---------------- */
  function saveRecord() {
    var f = readForm();
    if (!f.record_date) { toast('请选择日期'); return; }
    if (!f.start_time || !f.end_time) { toast('请填写上下班时间'); return; }
    var cfg = DB.config.get();
    var rec = Calc.build(f, cfg);
    if (state.editId) {
      DB.records.update(state.editId, rec);
      toast('已更新并重算工资');
    } else {
      DB.records.insert(rec);
      toast('已保存：' + money(rec.day_income));
    }
    DB.stats.rebuild();
    state.form = null;
    state.month = monthOf(rec.record_date);
    go(state.back === 'edit' ? 'home' : state.back);
  }

  function delRecord(id) {
    var r = DB.records.get(id);
    if (!r) return;
    if (!confirm('确定删除 ' + r.record_date + ' 的工时记录吗？')) return;
    DB.records.remove(id);
    DB.stats.rebuild();
    toast('已删除');
    if (state.route === 'edit') go('home');
    else if (state.route === 'records') render();
    else if (state.route === 'calendar') { state.sheetDate = null; render(); }
    else render();
  }

  /* ---------------- 导出 ---------------- */
  function exportRows(all) {
    var rows = [['日期', '星期', '上班时间', '下班时间', '工作类型', '夜班', '休息扣除(h)', '总在岗(h)', '有效工时(h)', '正常工时(h)', '加班工时(h)', '当日工资(元)', '备注']];
    all.forEach(function (r) {
      rows.push([
        r.record_date, weekdayCn(r.record_date), r.start_time, r.end_time,
        Calc.TYPE_LABEL[r.work_type] || '', r.night_flag == 1 ? '是' : '否',
        +r.rest_hour || 0, +r.total_work_hour || 0, +r.valid_work_hour || 0,
        +r.normal_hour || 0, +r.overtime_hour || 0, +r.day_income || 0, r.remark || ''
      ]);
    });
    return rows;
  }

  function pickExportList() {
    var allSel = document.getElementById('exp_all');
    var mSel = document.getElementById('exp_month');
    var useAll = allSel && allSel.value === '1';
    var list = useAll ? DB.records.all() : DB.records.byMonth(mSel ? mSel.value : state.month);
    return { list: list, tag: useAll ? '全部' : (mSel ? mSel.value : state.month) };
  }

  function saveFile(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1500);

    // 手机端优先唤起系统分享（可直接发微信/邮件给老板）
    try {
      if (navigator.canShare && navigator.share) {
        var file = new File([blob], filename, { type: blob.type || 'application/octet-stream' });
        if (navigator.canShare({ files: [file] })) {
          navigator.share({ files: [file], title: filename }).catch(function () {});
        }
      }
    } catch (e) {}
  }

  function doExportXlsx() {
    var p = pickExportList();
    if (!p.list.length) { toast('没有可导出的记录'); return; }
    var blob = XLSX.exportFile('', '工时明细', exportRows(p.list));
    saveFile(blob, '工时记录_' + p.tag + '.xlsx');
    toast('已导出 Excel（' + p.list.length + ' 条）');
  }

  function doExportCsv() {
    var p = pickExportList();
    if (!p.list.length) { toast('没有可导出的记录'); return; }
    var rows = exportRows(p.list);
    var csv = rows.map(function (r) {
      return r.map(function (c) {
        var s = String(c === undefined || c === null ? '' : c);
        return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(',');
    }).join('\r\n');
    var blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    saveFile(blob, '工时记录_' + p.tag + '.csv');
    toast('已导出 CSV（' + p.list.length + ' 条）');
  }

  function doExportJson() {
    var text = DB.exportJSON();
    var blob = new Blob([text], { type: 'application/json' });
    saveFile(blob, '工时记录备份_' + todayStr() + '.json');
    toast('备份已导出');
  }

  function doImport(text) {
    var mode = confirm('点“确定”= 覆盖当前数据；点“取消”= 合并追加到现有数据') ? 'overwrite' : 'merge';
    try {
      var n = DB.importJSON(text, mode);
      DB.recalcAll(Calc);
      toast('已恢复 ' + n + ' 条记录');
      render();
    } catch (e) {
      alert('恢复失败：' + e.message);
    }
  }

  /* ---------------- 事件 ---------------- */
  function onClick(e) {
    var t = e.target.closest('[data-act]');
    if (!t) return;
    var act = t.getAttribute('data-act');
    var id = t.getAttribute('data-id');

    switch (act) {
      case 'nav':
        e.preventDefault();
        go(t.getAttribute('data-route'));
        break;
      case 'm-prev': state.month = addMonth(state.month, -1); state.sheetDate = null; render(); break;
      case 'm-next': state.month = addMonth(state.month, 1); state.sheetDate = null; render(); break;
      case 'm-today': state.month = monthOf(todayStr()); state.sheetDate = null; render(); break;
      case 'new':
        state.editId = null; state.form = null;
        state.editDate = t.getAttribute('data-date') || todayStr();
        state.back = state.route === 'edit' ? 'home' : state.route;
        state.sheetDate = null;
        go('edit');
        break;
      case 'edit':
        state.editId = +id; state.form = null;
        state.back = state.route === 'edit' ? 'home' : state.route;
        go('edit');
        break;
      case 'del': delRecord(+id); break;
      case 'save': saveRecord(); break;
      case 'cancel': state.form = null; go(state.back || 'home'); break;
      case 'type':
        state.form = state.form || {};
        state.form.work_type = +t.getAttribute('data-type');
        Array.prototype.forEach.call(document.querySelectorAll('#f_type button'), function (b) {
          b.classList.toggle('on', b === t);
        });
        if (state.form.work_type === 4) {
          var n = document.getElementById('f_night');
          if (n) n.checked = true;
        }
        refreshPreview();
        break;
      case 'copy-last': {
        var last = DB.records.all()[0];
        if (!last) { toast('还没有历史记录'); break; }
        state.form = {
          record_date: document.getElementById('f_date').value || todayStr(),
          start_time: last.start_time, end_time: last.end_time, rest_hour: last.rest_hour,
          work_type: last.work_type, night_flag: last.night_flag, remark: last.remark
        };
        go('edit');
        break;
      }
      case 'today':
        document.getElementById('f_date').value = todayStr();
        state.form.record_date = todayStr();
        toast('已设为今天');
        break;
      case 'cal-day':
        state.sheetDate = t.getAttribute('data-date');
        render();
        break;
      case 'close-sheet':
        if (e.target === t || t.getAttribute('data-stop')) { /* 点击背景或关闭按钮 */ }
        state.sheetDate = null; render();
        break;
      case 'ftype':
        state.type = +t.getAttribute('data-type');
        Array.prototype.forEach.call(document.querySelectorAll('.chips .chip'), function (c) { c.classList.remove('on'); });
        t.classList.add('on');
        refreshList();
        break;
      case 'clear-search':
        state.search = '';
        document.getElementById('q').value = '';
        refreshList();
        break;
      case 'save-config': {
        var cfg = DB.config.save({
          hour_wage: document.getElementById('c_wage').value,
          overtime_rate15: document.getElementById('c_r15').value,
          overtime_rate20: document.getElementById('c_r20').value,
          night_subsidy: document.getElementById('c_night').value,
          night_subsidy_mode: document.getElementById('c_nmode').value,
          rest_hour_per_day: document.getElementById('c_rest').value,
          standard_work_hour: document.getElementById('c_std').value,
          round_half: document.getElementById('c_round').checked ? 1 : 0
        });
        DB.recalcAll(Calc);
        toast('已保存，' + DB.records.count() + ' 条记录已重算');
        render();
        break;
      }
      case 'export-json': doExportJson(); break;
      case 'export-xlsx': doExportXlsx(); break;
      case 'export-csv': doExportCsv(); break;
      case 'import-json':
        document.getElementById('fileInput').click();
        break;
      case 'clear-all':
        if (confirm('确定清空全部工时记录吗？此操作不可撤销，建议先导出备份。')) {
          DB.clearAll();
          toast('已清空');
          render();
        }
        break;
    }
  }

  function onInput(e) {
    if (state.route === 'records' && e.target.id === 'q') {
      state.search = e.target.value;
      refreshList();
      return;
    }
    if (state.route === 'edit') {
      var f = readForm();
      if (state.form) {
        f.work_type = state.form.work_type;
        state.form = f;
      }
      refreshPreview();
    }
  }

  /* ---------------- 启动 ---------------- */
  function boot() {
    el.app = document.getElementById('app');
    el.topbar = document.getElementById('topbar');
    el.tabbar = document.getElementById('tabbar');
    el.layer = document.getElementById('layer');
    el.toast = document.getElementById('toast');

    var mq = window.matchMedia('(min-width: 820px)');
    isTablet = mq.matches;
    var onMq = function () {
      isTablet = window.matchMedia('(min-width: 820px)').matches;
      render();
    };
    if (mq.addEventListener) mq.addEventListener('change', onMq);
    else if (mq.addListener) mq.addListener(onMq);

    state.month = monthOf(todayStr());
    DB.stats.rebuild();

    // 首次使用：写入一条示例？不写入，保持干净
    var hash = (location.hash || '').replace('#', '');
    state.route = ['home', 'calendar', 'records', 'settings', 'backup'].indexOf(hash) >= 0 ? hash : 'home';

    document.addEventListener('click', onClick);
    document.addEventListener('input', onInput);
    document.addEventListener('change', onInput);
    document.addEventListener('change', function (e) {
      if (e.target.id === 'fileInput' && e.target.files && e.target.files[0]) {
        var reader = new FileReader();
        reader.onload = function () { doImport(String(reader.result)); };
        reader.readAsText(e.target.files[0]);
        e.target.value = '';
      }
    });
    window.addEventListener('hashchange', function () {
      var h = (location.hash || '').replace('#', '');
      if (h && h !== state.route && ['home', 'calendar', 'records', 'settings', 'backup'].indexOf(h) >= 0) {
        state.route = h;
        render();
      }
    });

    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
