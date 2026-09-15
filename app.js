(() => {
  const ADMIN_PIN = "0000";
  const LS_EMPLOYEES = "rc_employees";
  const LS_RECORDS = "rc_records";

  let employees = JSON.parse(localStorage.getItem(LS_EMPLOYEES) || "[]");
  let records = JSON.parse(localStorage.getItem(LS_RECORDS) || "[]");
  let currentEmpId = null;
  let currentRole = "employee";
  let todayTimer = null;

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  function save() {
    localStorage.setItem(LS_EMPLOYEES, JSON.stringify(employees));
    localStorage.setItem(LS_RECORDS, JSON.stringify(records));
  }

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
    const ms = end - new Date(clockIn);
    return ms / 3600000;
  }

  function fmtHours(h) {
    const hrs = Math.floor(h);
    const mins = Math.round((h - hrs) * 60);
    if (mins === 0) return `${hrs} 個鐘`;
    return `${hrs} 小時 ${mins} 分鐘`;
  }

  function showScreen(id) {
    $$(".screen").forEach((s) => s.classList.remove("active"));
    $(`#${id}`).classList.add("active");
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
      btn.textContent = emp.name;
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
      currentRole = "employee";
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
      currentRole = "admin";
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
      delBtn.onclick = () => {
        if (confirm(`確定要刪除「${emp.name}」？`)) {
          employees = employees.filter((e) => e.id !== emp.id);
          records = records.filter((r) => r.employeeId !== emp.id);
          save();
          renderAdminList();
        }
      };
      div.appendChild(delBtn);
      list.appendChild(div);
    });
  }

  $("#add-employee").onclick = () => {
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

    employees.push({ id: Date.now().toString(), name, pin });
    save();
    renderAdminList();
    $("#new-name").value = "";
    $("#new-pin").value = "";
    err.classList.add("hidden");
  };

  $("#admin-logout").onclick = () => {
    showScreen("login-screen");
  };

  $("#back-to-login").onclick = () => {
    showScreen("login-screen");
  };

  // ---- CSV EXPORT ----
  $("#export-csv").onclick = () => {
    if (records.length === 0) {
      alert("暫時冇記錄可以匯出");
      return;
    }

    const sorted = [...records].sort((a, b) => {
      const cmp = a.date.localeCompare(b.date);
      if (cmp !== 0) return cmp;
      return (a.clockIn || "").localeCompare(b.clockIn || "");
    });

    const header = "日期,員工,上班時間,下班時間,工時(小時)";
    const rows = sorted.map((r) => {
      const emp = employees.find((e) => e.id === r.employeeId);
      const name = emp ? emp.name : "已刪除";
      let hours = "";
      if (r.clockIn && r.clockOut) {
        hours = calcHours(r.clockIn, r.clockOut).toFixed(2);
      }
      const clockInTime = r.clockIn ? fmtTime(r.clockIn) : "";
      const clockOutTime = r.clockOut ? fmtTime(r.clockOut) : "";
      return `${r.date},${name},${clockInTime},${clockOutTime},${hours}`;
    });

    const csv = "\uFEFF" + header + "\n" + rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `打卡記錄_${todayStr()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ---- MAIN APP ----
  function loginAs(emp) {
    currentEmpId = emp.id;
    showScreen("main-screen");
    $("#greeting").textContent = emp.name;
    switchTab("today");
  }

  $("#logout-btn").onclick = () => {
    currentEmpId = null;
    clearInterval(todayTimer);
    showScreen("login-screen");
  };

  // Tabs
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
  function renderToday() {
    const today = todayStr();
    const d = new Date();
    const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
    $("#today-summary-date").textContent =
      `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 星期${weekdays[d.getDay()]}`;

    const todayRecs = records.filter((r) => r.date === today);
    const container = $("#today-employees");
    const noRec = $("#no-today");
    container.innerHTML = "";

    if (todayRecs.length === 0) {
      noRec.classList.remove("hidden");
      return;
    }
    noRec.classList.add("hidden");

    const empMap = {};
    employees.forEach((e) => { empMap[e.id] = e.name; });

    const nameSorted = todayRecs.sort((a, b) => {
      const na = empMap[a.employeeId] || "";
      const nb = empMap[b.employeeId] || "";
      return na.localeCompare(nb, "zh-Hant");
    });

    nameSorted.forEach((r) => {
      const name = empMap[r.employeeId] || "已刪除";
      const card = document.createElement("div");
      card.className = "today-card";

      const left = document.createElement("div");
      left.className = "today-card-left";

      const nameEl = document.createElement("div");
      nameEl.className = "today-card-name";
      nameEl.textContent = name;
      left.appendChild(nameEl);

      const timesEl = document.createElement("div");
      timesEl.className = "today-card-times";
      if (r.clockIn && r.clockOut) {
        timesEl.textContent = `${fmtTime(r.clockIn)} → ${fmtTime(r.clockOut)}`;
      } else if (r.clockIn) {
        timesEl.textContent = `${fmtTime(r.clockIn)} → 處理中…`;
      } else {
        timesEl.textContent = "尚未打卡";
      }
      left.appendChild(timesEl);

      const right = document.createElement("div");
      right.className = "today-card-right";

      const hoursEl = document.createElement("div");
      hoursEl.className = "today-hours";

      const statusEl = document.createElement("div");

      if (r.clockIn && !r.clockOut) {
        const h = calcHours(r.clockIn, null);
        hoursEl.textContent = fmtHours(h);
        hoursEl.classList.add("working");
        statusEl.className = "today-status st-working";
        statusEl.textContent = "返緊工";
      } else if (r.clockIn && r.clockOut) {
        const h = calcHours(r.clockIn, r.clockOut);
        hoursEl.textContent = fmtHours(h);
        hoursEl.classList.add("done");
        statusEl.className = "today-status st-done";
        statusEl.textContent = "已完成";
      } else {
        hoursEl.textContent = "—";
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
  function renderClockTab() {
    const today = todayStr();
    const weekday = ["日", "一", "二", "三", "四", "五", "六"];
    const d = new Date();
    $("#today-date").textContent = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 星期${weekday[d.getDay()]}`;

    const todayRec = records.find(
      (r) => r.employeeId === currentEmpId && r.date === today
    );

    const btn = $("#clock-btn");
    const btnText = $("#clock-btn-text");
    const status = $("#clock-status");
    const time = $("#clock-time");
    const msg = $("#clock-msg");

    btn.classList.remove("clocked-in", "done");

    if (!todayRec) {
      status.textContent = "尚未打卡";
      time.textContent = "—";
      btnText.textContent = "上班";
      msg.textContent = "撳下面個掣開始返工";
    } else if (todayRec.clockIn && !todayRec.clockOut) {
      status.textContent = "已上班";
      const h = calcHours(todayRec.clockIn, null);
      time.innerHTML = `${fmtTime(todayRec.clockIn)}<br><span style="font-size:20px;color:var(--success)">已做 ${fmtHours(h)}</span>`;
      btnText.textContent = "下班";
      btn.classList.add("clocked-in");
      msg.textContent = "撳下面個掣放工";
    } else {
      status.textContent = "今日已完成打卡";
      const h = calcHours(todayRec.clockIn, todayRec.clockOut);
      time.innerHTML = `${fmtTime(todayRec.clockIn)} → ${fmtTime(todayRec.clockOut)}<br><span style="font-size:20px">共 ${fmtHours(h)}</span>`;
      btnText.textContent = "已完成";
      btn.classList.add("done");
      msg.textContent = "聽日再見！";
    }
  }

  $("#clock-btn").onclick = () => {
    const today = todayStr();
    let todayRec = records.find(
      (r) => r.employeeId === currentEmpId && r.date === today
    );

    if (!todayRec) {
      records.push({
        employeeId: currentEmpId,
        date: today,
        clockIn: new Date().toISOString(),
        clockOut: null,
      });
      $("#clock-msg").textContent = "✅ 已打上班卡！";
    } else if (todayRec.clockIn && !todayRec.clockOut) {
      todayRec.clockOut = new Date().toISOString();
      $("#clock-msg").textContent = "✅ 已打下班卡！辛苦了！";
    } else {
      return;
    }

    save();
    setTimeout(renderClockTab, 800);
  };

  // ---- RECORDS TAB ----
  function renderRecords(period) {
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

    const empRecs = records
      .filter(
        (r) =>
          r.employeeId === currentEmpId &&
          r.date >= fromStr &&
          r.date <= toStr
      )
      .sort((a, b) => b.date.localeCompare(a.date));

    const tbody = $("#records-body");
    const noRec = $("#no-records");
    tbody.innerHTML = "";

    if (empRecs.length === 0) {
      noRec.classList.remove("hidden");
      return;
    }
    noRec.classList.add("hidden");

    empRecs.forEach((r) => {
      const tr = document.createElement("tr");
      let hours = "—";
      if (r.clockIn && r.clockOut) {
        const h = calcHours(r.clockIn, r.clockOut);
        hours = fmtHours(h);
      }
      tr.innerHTML = `
        <td>${fmtDate(r.date)}</td>
        <td>${fmtTime(r.clockIn)}</td>
        <td>${fmtTime(r.clockOut)}</td>
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

  // ---- INIT ----
  renderEmployees();
  showScreen("login-screen");
})();
