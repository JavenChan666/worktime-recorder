/* ============================================================
 * 业务计算引擎 —— 严格按需求文档第三节「业务计算公式」实现
 *  1. 总在岗时长 = 下班时间 - 上班时间（跨夜自动 +24h）
 *  2. 有效工时   = 总在岗时长 - 休息扣除时长
 *  3. 有效工时 ≤ 标准工时(默认8h) → 全部正常工时
 *     有效工时 >  标准工时        → 正常 = 8h，加班 = 有效 - 8h
 *  4. 日工资 = 正常工时×时薪 + 加班工时×时薪×倍率 + 夜班补贴
 *     平日加班 1.5 倍 / 周末加班 2.0 倍 / 夜班按平日倍率并加夜班补贴
 *  5. 工时精度：默认精确到 0.5 小时（可在配置页关闭）
 * ========================================================== */
(function (global) {
  'use strict';

  var TYPE_LABEL = { 1: '正常班', 2: '平日加班', 3: '周末加班', 4: '夜班' };

  function toMinutes(t) {
    if (!t) return 0;
    var p = String(t).split(':');
    return (parseInt(p[0], 10) || 0) * 60 + (parseInt(p[1], 10) || 0);
  }

  function roundHalf(h) { return Math.round((Number(h) || 0) * 2) / 2; }
  function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }

  function isWeekend(dateStr) {
    var d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return false;
    var w = d.getDay();
    return w === 0 || w === 6;
  }

  /** 核心计算：输入一条记录 + 全局配置，输出工时与工资 */
  function compute(rec, cfg) {
    cfg = cfg || {};
    var start = toMinutes(rec.start_time);
    var end = toMinutes(rec.end_time);
    var rest = Number(rec.rest_hour);
    if (isNaN(rest)) rest = Number(cfg.rest_hour_per_day) || 0;

    var total = (end - start) / 60;
    if (total < 0) total += 24;           // 夜班跨零点
    total = Math.max(0, total);

    var valid = Math.max(0, total - rest);
    var std = Number(cfg.standard_work_hour) || 8;

    if (cfg.round_half) {
      total = roundHalf(total);
      valid = roundHalf(valid);
    }

    var normal = Math.min(valid, std);
    var overtime = Math.max(0, round2(valid - std));

    // 加班倍率：由工作类型决定
    var type = Number(rec.work_type) || 1;
    var rate;
    if (type === 3) rate = Number(cfg.overtime_rate20) || 2;
    else rate = Number(cfg.overtime_rate15) || 1.5;

    var wage = Number(cfg.hour_wage) || 0;
    var income;
    if (type === 3) {
      // 周末加班：当日全部有效工时按周末倍率结算
      income = valid * wage * rate;
    } else {
      income = normal * wage + overtime * wage * rate;
    }

    // 夜班补贴：按天 / 按时
    var night = Number(rec.night_flag) === 1 || type === 4;
    var subsidy = 0;
    if (night) {
      var amount = Number(cfg.night_subsidy) || 0;
      subsidy = (cfg.night_subsidy_mode === 'hour') ? amount * valid : amount;
    }
    income += subsidy;

    return {
      total_work_hour: round2(total),
      valid_work_hour: round2(valid),
      normal_hour: round2(normal),
      overtime_hour: round2(overtime),
      overtime_rate: rate,
      night_subsidy: round2(subsidy),
      day_income: round2(income)
    };
  }

  /** 构造一条完整记录对象（含计算结果） */
  function build(form, cfg) {
    var rec = {
      record_date: form.record_date,
      start_time: form.start_time,
      end_time: form.end_time,
      rest_hour: Number(form.rest_hour) || 0,
      work_type: Number(form.work_type) || 1,
      night_flag: (Number(form.work_type) === 4 || Number(form.night_flag) === 1) ? 1 : 0,
      remark: form.remark || ''
    };
    var res = compute(rec, cfg);
    return Object.assign(rec, {
      total_work_hour: res.total_work_hour,
      valid_work_hour: res.valid_work_hour,
      normal_hour: res.normal_hour,
      overtime_hour: res.overtime_hour,
      day_income: res.day_income
    });
  }

  /** 月度汇总（首页 / 统计） */
  function summarize(records) {
    var s = { days: {}, total_valid: 0, total_normal: 0, total_overtime: 0, total_income: 0, count: 0 };
    records.forEach(function (r) {
      s.days[r.record_date] = 1;
      s.total_valid += Number(r.valid_work_hour) || 0;
      s.total_normal += Number(r.normal_hour) || 0;
      s.total_overtime += Number(r.overtime_hour) || 0;
      s.total_income += Number(r.day_income) || 0;
      s.count += 1;
    });
    s.total_days = Object.keys(s.days).length;
    s.avg_hour = s.total_days ? s.total_valid / s.total_days : 0;
    s.total_valid = round2(s.total_valid);
    s.total_normal = round2(s.total_normal);
    s.total_overtime = round2(s.total_overtime);
    s.total_income = round2(s.total_income);
    s.avg_hour = round2(s.avg_hour);
    return s;
  }

  global.Calc = {
    compute: compute,
    build: build,
    summarize: summarize,
    isWeekend: isWeekend,
    roundHalf: roundHalf,
    round2: round2,
    TYPE_LABEL: TYPE_LABEL
  };
})(typeof window !== 'undefined' ? window : globalThis);
