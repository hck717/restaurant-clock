(() => {
  const ADMIN_PIN = "0000";
  const LS_CONFIG = "rc_supabase_config";
  const LS_SESSION = "rc_session";

  let config = null;
  let supabase = null;
  let employees = [];
  let currentEmpId = null;
  let todayTimer = null;

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  // ---- HELPERS ----
  function todayStr() {
    return new Date().toLocaleDateString("sv-SE");
  }

  function fmtDate(d) {
    const dt = new Date(d + "T00:00:00");
    const m = dt.getMonth() + 1;
    const day = dt.getDate();
    const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
    return `${m}月${day}日（${weekdays[dt.getDay()]}）`;
  }

  function fmtTime(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  }

  function calcHours(clockIn, clockOut) {
    const end = clockOut ? new Date(clockOut) : new Date();
    return (end - new Date(clockIn)) / 3600000;
  }

  function fmtHours(h) {
    const hrs = Math.floor(h);
    const mins = Math.round((h - hrs) * 60);
    if (mins === 0) return `${hrs} 個鐘`;
    return `${hrs} 小時 ${mins} 分鐘`;
  }

  function showScreen(id) {
    $$(".screen").forEach((s) => s.classList.remove("active"));
    const el = $(`#${id}`);
    if (el) el.classList.add("active");
  }

  // ---- CONFIG / SETUP ----
  function loadConfig() {
    try {
      config = JSON.parse(localStorage.getItem(LS_CONFIG) || "null");
    } catch {
      config = null;
    }
    return config;
  }

  function initSupabase() {
    supabase = window.supabase.createClient(config.url, config.anonKey);
  }

  function showSetupScreen() {
    if (config) {
      $("#setup-url").value = config.url;
      $("#setup-key").value = config.anonKey;
    }
    showScreen("setup-screen");
  }

  $("#setup-save").onclick = async () => {
    const url = $("#setup-url").value.trim();
    const key = $("#setup-key").value.trim();
    const err = $("#setup-error");

    if (!url || !key) {
      err.textContent = "請填寫 Supabase URL 同 anon key";
      err.classList.remove("hidden");
      return;
    }

    config = { url, anonKey: key };
    localStorage.setItem(LS_CONFIG, JSON.stringify(config));

    try {
      supabase = window.supabase.createClient(url, key);
      await loadEmployees();
      enterApp();
    } catch (e) {
      err.textContent = "連接唔到 Supabase，請檢查 URL 同 key";
      err.classList.remove("hidden");
    }
  };

  // ---- SUPABASE DATA ----
  async function loadEmployees() {
    const { data, error } = await supabase
      .from("employees")
      .select("id, name, pin")
      .order("name");
    if (error) throw error;
    employees = data || [];
  }

  async function loadMyRecords(empId) {
    const { data, error } = await supabase
      .from("records")
      .select("id, date, clock_in, clock_out")
      .eq("employee_id", empId);
    if (error) throw error;
    return data || [];
  }

  async function upsertClock(empId, date, fields) {
    const { data, error } = await supabase
      .from("records")
      .upsert(
        { employee_id: empId, date, ...fields },
        { onConflict: "employee_id,date" }
      );
    if (error) throw error;
    return data;
  }

  function initial(name) {
    return (name || "?").trim().charAt(0).toUpperCase();
  }

  // ---- LOGIN ----
  function renderEmployees() {
    const grid = $("#employee-list");
    grid.innerHTML = "";
    if (employees.length === 0) {
      grid.innerHTML = '<p style="color:var(--text-secondary)">暫時未有員工，請聯絡管理員</p>';
      return;
    }
    employees.forEach((emp) => {
      const btn = document.createElement("button");
      btn.className = "emp-btn";
      const avatar = document.createElement("div");
      avatar.className = "emp-avatar";
      avatar.textContent = initial(emp.name);
      const label = document.createElement("span");
      label.textContent = emp.name;
      btn.appendChild(avatar);
      btn.appendChild(label);
      btn.onclick = () => selectEmployee(emp);
      grid.appendChild(btn);
    });
  }

  function selectEmployee(emp) {
    currentEmpId = emp.id;
    $("#selected-name").textContent = emp.name;
    $("#employee-list").classList.add("hidden");
    $("#pin-section").classList.remove("hidden");
    $("#admin-entry").classList.add("hidden");
    $("#pin-input").value = "";
    $("#pin-error").classList.add("hidden");
    $("#pin-input").focus();
  }

  $("#pin-cancel").onclick = () => {
    $("#pin-section").classList.add("hidden");
    $("#employee-list").classList.remove("hidden");
    $("#admin-entry").classList.remove("hidden");
    currentEmpId = null;
  };

  $("#pin-confirm").onclick = () => {
    const emp = employees.find((e) => e.id === currentEmpId);
    if (emp && emp.pin === $("#pin-input").value) {
      $("#pin-section").classList.add("hidden");
      $("#employee-list").classList.remove("hidden");
      $("#admin-entry").classList.remove("hidden");
      localStorage.setItem(LS_SESSION, JSON.stringify({ empId: emp.id, role: "employee" }));
      loginAs(emp);
    } else {
      $("#pin-error").classList.remove("hidden");
      $("#pin-input").value = "";
      $("#pin-input").focus();
    }
  };

  $("#pin-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") $("#pin-confirm").click();
  });

  // ---- ADMIN LOGIN ----
  $("#admin-entry").onclick = () => showScreen("admin-login-screen");

  $("#admin-cancel").onclick = () => {
    showScreen("login-screen");
    $("#admin-pin").value = "";
    $("#admin-error").classList.add("hidden");
  };

  $("#admin-confirm").onclick = () => {
    if ($("#admin-pin").value === ADMIN_PIN) {
      showScreen("admin-screen");
      renderAdminList();
      $("#admin-pin").value = "";
      $("#admin-error").classList.add("hidden");
    } else {
      $("#admin-error").classList.remove("hidden");
      $("#admin-pin").value = "";
    }
  };

  $("#admin-pin").addEventListener("keydown", (e) => {
    if (e.key === "Enter") $("#admin-confirm").click();
  });

  // ---- ADMIN PANEL ----
  function renderAdminList() {
    const list = $("#admin-employee-list");
    list.innerHTML = "";
    if (employees.length === 0) {
      list.innerHTML = '<p style="color:var(--text-secondary);padding:8px">未有員工</p>';
      return;
    }
    employees.forEach((emp) => {
      const div = document.createElement("div");
      div.className = "admin-emp-item";
      div.innerHTML = `<span>${emp.name}</span>`;
      const delBtn = document.createElement("button");
      delBtn.className = "btn btn-danger btn-sm";
      delBtn.textContent = "刪除";
      delBtn.onclick = async () => {
        if (confirm(`確定要刪除「${emp.name}」？`)) {
          const { error } = await supabase
            .from("records")
            .delete()
            .eq("employee_id", emp.id);
          if (!error) {
            await supabase.from("employees").delete().eq("id", emp.id);
            employees = employees.filter((e) => e.id !== emp.id);
            renderAdminList();
          }
        }
      };
      div.appendChild(delBtn);
      list.appendChild(div);
    });
  }

  $("#add-employee").onclick = async () => {
    const name = $("#new-name").value.trim();
    const pin = $("#new-pin").value.trim();
    const err = $("#add-error");

    if (!name) {
      err.textContent = "請輸入員工名稱";
      err.classList.remove("hidden");
      return;
    }
    if (!pin || pin.length < 4) {
      err.textContent = "密碼至少4個數字";
      err.classList.remove("hidden");
      return;
    }
    if (employees.some((e) => e.name === name)) {
      err.textContent = "已經有同名員工";
      err.classList.remove("hidden");
      return;
    }

    const { data, error } = await supabase
      .from("employees")
      .insert({ id: Date.now().toString(), name, pin })
      .select();
    if (error) {
      err.textContent = "加唔到，可能有連線問題";
      err.classList.remove("hidden");
      return;
    }
    employees.push(data[0]);
    renderAdminList();
    $("#new-name").value = "";
    $("#new-pin").value = "";
    err.classList.add("hidden");
  };

  $("#admin-logout").onclick = () => {
    localStorage.removeItem(LS_SESSION);
    showScreen("login-screen");
  };

  $("#back-to-login").onclick = () => {
    showScreen("login-screen");
  };

  // ---- CSV EXPORT ----
  $("#export-csv").onclick = async () => {
    try {
      const { data, error } = await supabase
        .from("records")
        .select("date, employee_id, clock_in, clock_out");
      if (error) throw error;

      const allRecs = data || [];
      if (allRecs.length === 0) {
        alert("暫時冇記錄可以匯出");
        return;
      }

      const empMap = {};
      employees.forEach((e) => { empMap[e.id] = e.name; });

      const sorted = [...allRecs].sort((a, b) => {
        const cmp = a.date.localeCompare(b.date);
        if (cmp !== 0) return cmp;
        return (a.clock_in || "").localeCompare(b.clock_in || "");
      });

      const header = "日期,員工,上班時間,下班時間,工時(小時)";
      const rows = sorted.map((r) => {
        const name = empMap[r.employee_id] || "已刪除";
        let hours = "";
        if (r.clock_in && r.clock_out) {
          hours = calcHours(r.clock_in, r.clock_out).toFixed(2);
        }
        return `${r.date},${name},${fmtTime(r.clock_in)},${fmtTime(r.clock_out)},${hours}`;
      });

      const csv = "\uFEFF" + header + "\n" + rows.join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `打卡記錄_${todayStr()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("匯出失敗，請檢查連線");
    }
  };

  // ---- MAIN APP ----
  function loginAs(emp) {
    currentEmpId = emp.id;
    showScreen("main-screen");
    $("#greeting").textContent = emp.name;
    $("#main-avatar").textContent = initial(emp.name);
    switchTab("today");
  }

  $("#logout-btn").onclick = () => {
    currentEmpId = null;
    localStorage.removeItem(LS_SESSION);
    clearInterval(todayTimer);
    showScreen("login-screen");
  };

  $$(".tab").forEach((tab) => {
    tab.onclick = () => switchTab(tab.dataset.tab);
  });

  function switchTab(name) {
    $$(".tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === name));
    $$(".tab-content").forEach((c) => c.classList.remove("active"));
    $(`#tab-${name}`).classList.add("active");

    clearInterval(todayTimer);

    if (name === "today") {
      renderToday();
      todayTimer = setInterval(renderToday, 30000);
    } else if (name === "clock") {
      renderClockTab();
    } else if (name === "records") {
      renderRecords();
    }
  }

  // ---- TODAY OVERVIEW ----
  async function renderToday() {
    const today = todayStr();
    const d = new Date();
    const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
    $("#today-summary-date").textContent =
      `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 星期${weekdays[d.getDay()]}`;

    const container = $("#today-employees");
    const noRec = $("#no-today");
    container.innerHTML = "";

    let todayRecs;
    try {
      const { data } = await supabase
        .from("records")
        .select("employee_id, date, clock_in, clock_out")
        .eq("date", today);
      todayRecs = data || [];
    } catch {
      todayRecs = [];
    }

    if (todayRecs.length === 0) {
      noRec.classList.remove("hidden");
      return;
    }
    noRec.classList.add("hidden");

    const empMap = {};
    employees.forEach((e) => { empMap[e.id] = e.name; });

    const nameSorted = todayRecs.sort((a, b) => {
      const na = empMap[a.employee_id] || "";
      const nb = empMap[b.employee_id] || "";
      return na.localeCompare(nb, "zh-Hant");
    });

    nameSorted.forEach((r) => {
      const name = empMap[r.employee_id] || "已刪除";
      const card = document.createElement("div");
      card.className = "today-card";

      const left = document.createElement("div");
      left.className = "today-card-left";

      const avatar = document.createElement("div");
      avatar.className = "today-avatar";
      avatar.textContent = initial(name);
      left.appendChild(avatar);

      const nameCol = document.createElement("div");

      const nameEl = document.createElement("div");
      nameEl.className = "today-card-name";
      nameEl.textContent = name;
      nameCol.appendChild(nameEl);

      const timesEl = document.createElement("div");
      timesEl.className = "today-card-times";
      if (r.clock_in && r.clock_out) {
        timesEl.textContent = `${fmtTime(r.clock_in)} → ${fmtTime(r.clock_out)}`;
      } else if (r.clock_in) {
        timesEl.textContent = `${fmtTime(r.clock_in)} → 處理中…`;
      } else {
        timesEl.textContent = "尚未打卡";
      }
      nameCol.appendChild(timesEl);

      left.appendChild(nameCol);

      const right = document.createElement("div");
      right.className = "today-card-right";

      const hoursEl = document.createElement("div");
      hoursEl.className = "today-hours";
      const statusEl = document.createElement("div");

      if (r.clock_in && !r.clock_out) {
        const h = calcHours(r.clock_in, null);
        hoursEl.textContent = fmtHours(h);
        hoursEl.classList.add("working");
        card.classList.add("working");
        statusEl.className = "today-status st-working";
        statusEl.textContent = "返緊工";
      } else if (r.clock_in && r.clock_out) {
        const h = calcHours(r.clock_in, r.clock_out);
        hoursEl.textContent = fmtHours(h);
        hoursEl.classList.add("done");
        card.classList.add("done");
        statusEl.className = "today-status st-done";
        statusEl.textContent = "已完成";
      } else {
        hoursEl.textContent = "—";
        card.classList.add("no");
        statusEl.className = "today-status st-no";
        statusEl.textContent = "未打卡";
      }

      right.appendChild(hoursEl);
      right.appendChild(statusEl);

      card.appendChild(left);
      card.appendChild(right);
      container.appendChild(card);
    });
  }

  $("#today-refresh").onclick = renderToday;

  // ---- CLOCK TAB ----
  async function renderClockTab() {
    const today = todayStr();
    const weekday = ["日", "一", "二", "三", "四", "五", "六"];
    const d = new Date();
    $("#today-date").textContent = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 星期${weekday[d.getDay()]}`;

    const btn = $("#clock-btn");
    const btnText = $("#clock-btn-text");
    const status = $("#clock-status");
    const time = $("#clock-time");
    const msg = $("#clock-msg");

    btn.classList.remove("clocked-in", "done");

    let todayRec;
    try {
      const { data } = await supabase
        .from("records")
        .select("id, date, clock_in, clock_out")
        .eq("employee_id", currentEmpId)
        .eq("date", today)
        .single();
      todayRec = data;
    } catch {
      todayRec = null;
    }

    if (!todayRec) {
      status.textContent = "尚未打卡";
      time.textContent = "—";
      btnText.textContent = "上班";
      msg.textContent = "撳下面個掣開始返工";
    } else if (todayRec.clock_in && !todayRec.clock_out) {
      status.textContent = "已上班";
      const h = calcHours(todayRec.clock_in, null);
      time.innerHTML = `${fmtTime(todayRec.clock_in)}<br><span style="font-size:20px;color:var(--success)">已做 ${fmtHours(h)}</span>`;
      btnText.textContent = "下班";
      btn.classList.add("clocked-in");
      msg.textContent = "撳下面個掣放工";
    } else {
      status.textContent = "今日已完成打卡";
      const h = calcHours(todayRec.clock_in, todayRec.clock_out);
      time.innerHTML = `${fmtTime(todayRec.clock_in)} → ${fmtTime(todayRec.clock_out)}<br><span style="font-size:20px">共 ${fmtHours(h)}</span>`;
      btnText.textContent = "已完成";
      btn.classList.add("done");
      msg.textContent = "聽日再見！";
    }
  }

  $("#clock-btn").onclick = async () => {
    const today = todayStr();
    const btn = $("#clock-btn");
    if (btn.classList.contains("done")) return;

    try {
      const { data } = await supabase
        .from("records")
        .select("clock_in, clock_out")
        .eq("employee_id", currentEmpId)
        .eq("date", today)
        .maybeSingle();
      const todayRec = data;

      if (!todayRec) {
        await upsertClock(currentEmpId, today, {
          clock_in: new Date().toISOString(),
          clock_out: null,
        });
        $("#clock-msg").textContent = "✅ 已打上班卡！";
      } else if (todayRec.clock_in && !todayRec.clock_out) {
        await upsertClock(currentEmpId, today, {
          clock_in: todayRec.clock_in,
          clock_out: new Date().toISOString(),
        });
        $("#clock-msg").textContent = "✅ 已打下班卡！辛苦了！";
      } else {
        return;
      }
    } catch (e) {
      $("#clock-msg").textContent = "❌ 打卡失敗，請檢查網絡";
      return;
    }

    setTimeout(renderClockTab, 800);
    switchTab("clock");
  };

  // ---- RECORDS TAB ----
  async function renderRecords(period) {
    if (!period) period = "week";
    const today = new Date();
    let from, to;

    if (period === "week") {
      const day = today.getDay();
      const diff = day === 0 ? 6 : day - 1;
      from = new Date(today);
      from.setDate(today.getDate() - diff);
      to = new Date(today);
    } else if (period === "month") {
      from = new Date(today.getFullYear(), today.getMonth(), 1);
      to = new Date(today);
    } else if (period === "custom") {
      const f = $("#range-from").value;
      const t = $("#range-to").value;
      if (!f || !t) return;
      from = new Date(f + "T00:00:00");
      to = new Date(t + "T00:00:00");
    }

    const fromStr = from.toLocaleDateString("sv-SE");
    const toStr = to.toLocaleDateString("sv-SE");

    const tbody = $("#records-body");
    const noRec = $("#no-records");
    tbody.innerHTML = "";

    let empRecs = [];
    try {
      const { data } = await supabase
        .from("records")
        .select("date, clock_in, clock_out")
        .eq("employee_id", currentEmpId)
        .gte("date", fromStr)
        .lte("date", toStr);
      empRecs = (data || []).sort((a, b) => b.date.localeCompare(a.date));
    } catch {}

    if (empRecs.length === 0) {
      noRec.classList.remove("hidden");
      return;
    }
    noRec.classList.add("hidden");

    empRecs.forEach((r) => {
      const tr = document.createElement("tr");
      let hours = "—";
      if (r.clock_in && r.clock_out) {
        hours = fmtHours(calcHours(r.clock_in, r.clock_out));
      }
      tr.innerHTML = `
        <td>${fmtDate(r.date)}</td>
        <td>${fmtTime(r.clock_in)}</td>
        <td>${fmtTime(r.clock_out)}</td>
        <td>${hours}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  $("#period-week").onclick = () => {
    setActivePeriod("week");
    renderRecords("week");
  };
  $("#period-month").onclick = () => {
    setActivePeriod("month");
    renderRecords("month");
  };
  $("#period-custom").onclick = () => {
    setActivePeriod("custom");
    $("#custom-range").classList.toggle("hidden");
  };
  $("#range-apply").onclick = () => renderRecords("custom");

  function setActivePeriod(p) {
    $("#custom-range").classList.add("hidden");
    $$(".records-filter .btn").forEach((b) => {
      b.classList.remove("btn-primary");
      b.classList.add("btn-secondary");
    });
    $(`#period-${p}`).classList.remove("btn-secondary");
    $(`#period-${p}`).classList.add("btn-primary");
  }

  // ---- ENTRY ----
  async function enterApp() {
    await loadEmployees();
    renderEmployees();

    const session = JSON.parse(localStorage.getItem(LS_SESSION) || "null");
    if (session && session.empId) {
      const emp = employees.find((e) => e.id === session.empId);
      if (emp) {
        loginAs(emp);
        return;
      }
    }
    showScreen("login-screen");
  }

  // ---- INIT ----
  const cfg = loadConfig();
  if (cfg && cfg.url && cfg.anonKey) {
    try {
      supabase = window.supabase.createClient(cfg.url, cfg.anonKey);
      enterApp();
    } catch (e) {
      showSetupScreen();
    }
  } else {
    showSetupScreen();
  }
})();