/* ============================================================
 * 本地存储层：对应需求文档中的 SQLite 三张表
 *   salary_config  薪资配置表（只存 1 条全局配置，id = 1）
 *   work_record    工时主记录表（核心表）
 *   work_month_stat 月度统计表（加速首页统计，秒加载）
 * 数据全部保存在设备本地（localStorage），不联网、不上传。
 * ========================================================== */
(function (global) {
  'use strict';

  var STORE_KEY = 'worktime_db_v1';

  var DEFAULT_CONFIG = {
    id: 1,
    hour_wage: 20,            // 基础时薪
    overtime_rate15: 1.5,     // 平日加班倍率
    overtime_rate20: 2.0,     // 周末加班倍率
    night_subsidy: 30,        // 夜班补贴金额
    night_subsidy_mode: 'day',// 补贴模式：day 按天 / hour 按时
    rest_hour_per_day: 1,     // 每日默认休息扣减时长
    standard_work_hour: 8,    // 每日标准工时（正常/加班分界）
    round_half: 1             // 工时精度：1 = 精确到 0.5 小时
  };

  var db = {
    salary_config: [Object.assign({}, DEFAULT_CONFIG)],
    work_record: [],
    work_month_stat: [],
    seq: 1
  };

  function persist() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(db));
      return true;
    } catch (e) {
      return false;
    }
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          db.salary_config = Array.isArray(parsed.salary_config) && parsed.salary_config.length
            ? parsed.salary_config : [Object.assign({}, DEFAULT_CONFIG)];
          db.work_record = Array.isArray(parsed.work_record) ? parsed.work_record : [];
          db.work_month_stat = Array.isArray(parsed.work_month_stat) ? parsed.work_month_stat : [];
          db.seq = Number(parsed.seq) || 1;
        }
      }
    } catch (e) {
      console.warn('数据读取失败，使用默认库', e);
    }
    // 配置补全（兼容旧版本备份缺少新字段的情况）
    var cfg = db.salary_config[0];
    if (!cfg) {
      cfg = Object.assign({}, DEFAULT_CONFIG);
      db.salary_config = [cfg];
    }
    Object.keys(DEFAULT_CONFIG).forEach(function (k) {
      if (cfg[k] === undefined || cfg[k] === null) cfg[k] = DEFAULT_CONFIG[k];
    });
    cfg.id = 1;
    // 修复自增游标
    var maxId = db.work_record.reduce(function (m, r) { return Math.max(m, Number(r.id) || 0); }, 0);
    if (db.seq <= maxId) db.seq = maxId + 1;
  }

  load();

  function nextId() {
    var id = db.seq;
    db.seq += 1;
    return id;
  }

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  var DB = {
    /* ---------- salary_config ---------- */
    config: {
      get: function () { return clone(db.salary_config[0]); },
      save: function (cfg) {
        var old = db.salary_config[0];
        var merged = Object.assign({}, old, cfg);
        merged.id = 1;
        ['hour_wage', 'overtime_rate15', 'overtime_rate20', 'night_subsidy',
          'rest_hour_per_day', 'standard_work_hour'].forEach(function (k) {
            merged[k] = Number(merged[k]) || 0;
          });
        merged.round_half = merged.round_half ? 1 : 0;
        db.salary_config[0] = merged;
        persist();
        return clone(merged);
      }
    },

    /* ---------- work_record ---------- */
    records: {
      all: function () {
        return clone(db.work_record).sort(function (a, b) {
          if (a.record_date === b.record_date) return String(b.create_time || '').localeCompare(String(a.create_time || ''));
          return String(a.record_date) < String(b.record_date) ? 1 : -1;
        });
      },
      get: function (id) {
        var r = db.work_record.filter(function (x) { return x.id === Number(id); })[0];
        return r ? clone(r) : null;
      },
      byDate: function (date) {
        return clone(db.work_record.filter(function (x) { return x.record_date === date; }))
          .sort(function (a, b) { return String(a.start_time).localeCompare(String(b.start_time)); });
      },
      byMonth: function (monthKey) {
        return DB.records.all().filter(function (x) {
          return String(x.record_date || '').slice(0, 7) === monthKey;
        });
      },
      insert: function (rec) {
        rec.id = nextId();
        rec.create_time = rec.create_time || new Date().toISOString();
        db.work_record.push(rec);
        persist();
        return clone(rec);
      },
      update: function (id, patch) {
        var idx = -1;
        db.work_record.forEach(function (r, i) { if (r.id === Number(id)) idx = i; });
        if (idx < 0) return null;
        Object.assign(db.work_record[idx], patch);
        persist();
        return clone(db.work_record[idx]);
      },
      remove: function (id) {
        db.work_record = db.work_record.filter(function (r) { return r.id !== Number(id); });
        persist();
        return true;
      },
      count: function () { return db.work_record.length; },
      clear: function () { db.work_record = []; persist(); }
    },

    /* ---------- work_month_stat ---------- */
    stats: {
      /** 依据 work_record 全量重建 work_month_stat */
      rebuild: function () {
        var map = {};
        db.work_record.forEach(function (r) {
          var key = String(r.record_date || '').slice(0, 7);
          if (!key) return;
          if (!map[key]) {
            map[key] = { month_key: key, total_day: 0, total_normal_hour: 0, total_overtime_hour: 0, total_income: 0, _dates: {} };
          }
          var m = map[key];
          m.total_normal_hour += Number(r.normal_hour) || 0;
          m.total_overtime_hour += Number(r.overtime_hour) || 0;
          m.total_income += Number(r.day_income) || 0;
          m._dates[r.record_date] = 1;
        });
        db.work_month_stat = Object.keys(map).sort().map(function (k, i) {
          var m = map[k];
          return {
            id: i + 1,
            month_key: m.month_key,
            total_day: Object.keys(m._dates).length,
            total_normal_hour: round2(m.total_normal_hour),
            total_overtime_hour: round2(m.total_overtime_hour),
            total_income: round2(m.total_income)
          };
        });
        persist();
        return clone(db.work_month_stat);
      },
      get: function (monthKey) {
        var s = db.work_month_stat.filter(function (x) { return x.month_key === monthKey; })[0];
        return s ? clone(s) : { month_key: monthKey, total_day: 0, total_normal_hour: 0, total_overtime_hour: 0, total_income: 0 };
      },
      all: function () { return clone(db.work_month_stat); }
    },

    /* ---------- 全量重算（配置变更后调用） ---------- */
    recalcAll: function (calc) {
      var cfg = DB.config.get();
      db.work_record.forEach(function (r) {
        var res = calc.compute(r, cfg);
        r.total_work_hour = res.total_work_hour;
        r.valid_work_hour = res.valid_work_hour;
        r.normal_hour = res.normal_hour;
        r.overtime_hour = res.overtime_hour;
        r.day_income = res.day_income;
      });
      persist();
      DB.stats.rebuild();
    },

    /* ---------- 备份 / 恢复 ---------- */
    exportJSON: function () {
      return JSON.stringify({
        app: '工时记录助手',
        version: 1,
        exported_at: new Date().toISOString(),
        salary_config: db.salary_config,
        work_record: db.work_record,
        work_month_stat: db.work_month_stat
      }, null, 2);
    },
    importJSON: function (text, mode) {
      var data = JSON.parse(text);
      if (!data || !Array.isArray(data.work_record)) throw new Error('文件格式不正确，缺少 work_record');
      if (mode === 'merge') {
        var exist = {};
        db.work_record.forEach(function (r) { exist[r.record_date + '|' + r.start_time + '|' + r.end_time] = 1; });
        data.work_record.forEach(function (r) {
          var k = r.record_date + '|' + r.start_time + '|' + r.end_time;
          if (!exist[k]) { r.id = nextId(); db.work_record.push(r); }
        });
      } else {
        db.work_record = data.work_record.map(function (r) {
          if (!r.id) r.id = nextId();
          return r;
        });
        if (Array.isArray(data.salary_config) && data.salary_config.length) {
          db.salary_config = data.salary_config;
        }
      }
      var maxId = db.work_record.reduce(function (m, r) { return Math.max(m, Number(r.id) || 0); }, 0);
      db.seq = Math.max(db.seq, maxId + 1);
      persist();
      DB.stats.rebuild();
      return db.work_record.length;
    },
    clearAll: function () {
      db.work_record = [];
      db.work_month_stat = [];
      db.salary_config = [Object.assign({}, DEFAULT_CONFIG)];
      db.seq = 1;
      persist();
    },
    usage: function () {
      try { return (localStorage.getItem(STORE_KEY) || '').length; } catch (e) { return 0; }
    }
  };

  function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }

  global.DB = DB;
})(typeof window !== 'undefined' ? window : globalThis);
