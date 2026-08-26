(() => {
  "use strict";

  const payload = window.DASHBOARD_DATA || { generated_at: "", source_files: 0, records: [] };
  const records = Array.isArray(payload.records) ? payload.records : [];
  const PAGE_SIZE = 12;

  const STATUS = {
    NATIVE_SUPPORTED: { label: "原生支持", color: "#16a36a", css: "status-native" },
    NATIVE_UNSUPPORTED: { label: "原生不支持", color: "#ed5d67", css: "status-unsupported" },
    ADAPTED_SUPPORTED: { label: "修改后支持", color: "#7867e8", css: "status-adapted" },
    PENDING_VERIFICATION: { label: "待确定", color: "#e9a33a", css: "status-pending" }
  };
  const STATUS_ORDER = Object.keys(STATUS);
  const MODULE_ORDER = ["Core and API", "分布式", "图模式", "社区生态"];

  const $ = (id) => document.getElementById(id);
  const state = {
    view: "overview",
    start: "",
    end: "",
    version: "",
    module: "",
    status: "",
    search: "",
    page: 1
  };

  const dates = records.map(r => r.commit_date).filter(Boolean).sort();
  const minDate = payload.min_date || dates[0] || "";
  const maxDate = payload.max_date || dates[dates.length - 1] || "";
  state.start = minDate;
  state.end = maxDate;

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[ch]));
  }

  function formatDate(value) {
    if (!value) return "时间待补全";
    const d = new Date(`${value}T00:00:00`);
    if (Number.isNaN(d.getTime())) return value;
    return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  }

  function formatDateTime(value) {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(d);
  }

  function percentage(count, total) {
    return total ? `${(count * 100 / total).toFixed(count === total ? 0 : 1)}%` : "0%";
  }

  function getRangeRecords() {
    return records.filter(r => {
      if (state.start && r.commit_date && r.commit_date < state.start) return false;
      if (state.end && r.commit_date && r.commit_date > state.end) return false;
      if (state.version && r.version !== state.version) return false;
      if (state.module && r.module !== state.module) return false;
      return true;
    });
  }

  function getTableRecords(rangeRecords) {
    const query = state.search.trim().toLowerCase();
    return rangeRecords.filter(r => {
      if (state.status === "SUPPORTED") {
        if (!["NATIVE_SUPPORTED", "ADAPTED_SUPPORTED"].includes(r.status)) return false;
      } else if (state.status && r.status !== state.status) {
        return false;
      }
      if (!query) return true;
      const haystack = [r.pr_number, r.title, r.module, r.version, r.summary].join(" ").toLowerCase();
      return haystack.includes(query);
    });
  }

  function countStatuses(rows) {
    const counts = Object.fromEntries(STATUS_ORDER.map(key => [key, 0]));
    rows.forEach(r => { if (counts[r.status] !== undefined) counts[r.status] += 1; });
    return counts;
  }

  function populateFilters() {
    $("startDate").value = state.start;
    $("endDate").value = state.end;
    $("startDate").min = minDate;
    $("startDate").max = maxDate;
    $("endDate").min = minDate;
    $("endDate").max = maxDate;

    const versions = [...new Set(records.map(r => r.version).filter(Boolean))].sort((a, b) => b.localeCompare(a, "zh-CN", { numeric: true }));
    const availableModules = new Set(records.map(r => r.module).filter(Boolean));
    const modules = MODULE_ORDER.filter(module => availableModules.has(module));
    $("versionFilter").insertAdjacentHTML("beforeend", versions.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join(""));
    $("moduleFilter").insertAdjacentHTML("beforeend", modules.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join(""));

    $("syncTime").textContent = payload.generated_at ? `更新于 ${formatDateTime(payload.generated_at)}` : "数据时间未知";
    $("sourceCount").textContent = `${payload.source_files || 0} 个分析文件`;
  }

  function renderMetrics(rangeRows, counts) {
    const total = rangeRows.length;
    $("rangePrCount").textContent = total.toLocaleString("zh-CN");
    $("sidebarPrCount").textContent = total.toLocaleString("zh-CN");
    $("sidebarSupportedCount").textContent = (counts.NATIVE_SUPPORTED + counts.ADAPTED_SUPPORTED).toLocaleString("zh-CN");
    $("sidebarUnanalyzedCount").textContent = counts.PENDING_VERIFICATION.toLocaleString("zh-CN");
    $("sidebarUnsupportedCount").textContent = counts.NATIVE_UNSUPPORTED.toLocaleString("zh-CN");

    const fields = {
      NATIVE_SUPPORTED: ["nativeCount", "nativeShare"],
      NATIVE_UNSUPPORTED: ["unsupportedCount", "unsupportedShare"],
      ADAPTED_SUPPORTED: ["adaptedCount", "adaptedShare"],
      PENDING_VERIFICATION: ["pendingCount", "pendingShare"]
    };
    Object.entries(fields).forEach(([status, ids]) => {
      $(ids[0]).textContent = counts[status].toLocaleString("zh-CN");
      $(ids[1]).textContent = percentage(counts[status], total);
    });

    document.querySelectorAll("[data-card-status]").forEach(card => card.classList.toggle("selected", card.dataset.cardStatus === state.status));
  }

  function getWeekStart(dateStr) {
    const date = new Date(`${dateStr}T00:00:00`);
    const day = (date.getDay() + 6) % 7;
    date.setDate(date.getDate() - day);
    return date.toISOString().slice(0, 10);
  }

  function renderTrend(rows) {
    const container = $("trendChart");
    const withDates = rows.filter(r => r.commit_date);
    if (!withDates.length) {
      container.innerHTML = `<div class="empty-state"><strong>暂无时间数据</strong><span>补全 commit_time 后显示趋势</span></div>`;
      return;
    }

    const buckets = new Map();
    withDates.forEach(r => {
      const key = getWeekStart(r.commit_date);
      if (!buckets.has(key)) buckets.set(key, { date: key, ...Object.fromEntries(STATUS_ORDER.map(s => [s, 0])) });
      buckets.get(key)[r.status] += 1;
    });
    let points = [...buckets.values()].sort((a, b) => a.date.localeCompare(b.date));
    if (points.length > 12) points = points.slice(-12);

    const width = 760, height = 205, left = 34, right = 8, top = 10, bottom = 28;
    const plotW = width - left - right, plotH = height - top - bottom;
    const max = Math.max(1, ...points.map(p => STATUS_ORDER.reduce((sum, s) => sum + p[s], 0)));
    const roundedMax = Math.max(4, Math.ceil(max / 4) * 4);
    const slot = plotW / points.length;
    const barW = Math.min(32, slot * .56);
    let svg = `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">`;
    for (let i = 0; i <= 4; i++) {
      const y = top + plotH - plotH * i / 4;
      svg += `<line class="chart-grid" x1="${left}" y1="${y}" x2="${width-right}" y2="${y}"/>`;
      svg += `<text class="chart-axis-label" x="${left-8}" y="${y+3}" text-anchor="end">${Math.round(roundedMax*i/4)}</text>`;
    }
    points.forEach((p, index) => {
      const x = left + slot * index + (slot - barW) / 2;
      let yCursor = top + plotH;
      STATUS_ORDER.forEach(status => {
        const value = p[status];
        if (!value) return;
        const h = value / roundedMax * plotH;
        yCursor -= h;
        svg += `<rect class="trend-segment" data-date="${p.date}" data-status="${status}" data-value="${value}" x="${x}" y="${yCursor}" width="${barW}" height="${Math.max(1,h)}" fill="${STATUS[status].color}" rx="2"/>`;
      });
      const label = p.date.slice(5).replace("-", "/");
      svg += `<text class="chart-axis-label" x="${x+barW/2}" y="${height-8}" text-anchor="middle">${label}</text>`;
    });
    svg += `</svg><div id="chartTooltip" class="chart-tooltip"></div>`;
    container.innerHTML = svg;

    const tooltip = $("chartTooltip");
    container.querySelectorAll(".trend-segment").forEach(rect => {
      rect.addEventListener("mousemove", event => {
        tooltip.style.display = "block";
        tooltip.style.left = `${event.clientX + 12}px`;
        tooltip.style.top = `${event.clientY + 12}px`;
        tooltip.innerHTML = `${rect.dataset.date}<br><strong>${STATUS[rect.dataset.status].label}：${rect.dataset.value}</strong>`;
      });
      rect.addEventListener("mouseleave", () => { tooltip.style.display = "none"; });
    });
  }

  function renderDistribution(counts, total) {
    $("donutTotal").textContent = total.toLocaleString("zh-CN");
    let cursor = 0;
    const parts = [];
    STATUS_ORDER.forEach(status => {
      const start = cursor;
      cursor += total ? counts[status] * 100 / total : 0;
      parts.push(`${STATUS[status].color} ${start}% ${cursor}%`);
    });
    if (cursor < 100) parts.push(`#e8ebf1 ${cursor}% 100%`);
    $("donutChart").style.background = `conic-gradient(${parts.join(",")})`;
    $("distributionList").innerHTML = STATUS_ORDER.map(status => {
      const pct = total ? counts[status] * 100 / total : 0;
      return `<div class="distribution-item" style="color:${STATUS[status].color}">
        <i style="background:${STATUS[status].color}"></i>
        <span>${STATUS[status].label}</span>
        <strong>${counts[status]} · ${pct.toFixed(1)}%</strong>
        <small><b style="width:${pct}%"></b></small>
      </div>`;
    }).join("");
  }

  function ciMarkup(record) {
    if (record.ci_status === "是") return `<span class="ci-pill ci-success">验证通过</span>`;
    if (record.ci_status === "否") return `<span class="ci-pill ci-failure">验证失败</span>`;
    return `<span class="ci-pill ci-empty">暂无结果</span>`;
  }

  function renderTable(rows) {
    const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    state.page = Math.min(state.page, totalPages);
    const start = (state.page - 1) * PAGE_SIZE;
    const pageRows = rows.slice(start, start + PAGE_SIZE);
    $("prTableBody").innerHTML = pageRows.map(r => {
      const priority = ["high", "medium", "low"].includes(r.priority) ? r.priority : "low";
      const priorityLabel = { high: "高", medium: "中", low: "低" }[priority];
      return `<tr data-pr="${r.pr_number}">
        <td><div class="pr-cell"><span class="pr-number">#${r.pr_number}</span><span class="pr-title" title="${escapeHtml(r.title)}">${escapeHtml(r.title || "未命名 PR")}</span></div></td>
        <td class="date-cell">${escapeHtml(formatDate(r.commit_date))}<small>${escapeHtml(r.version || "版本待定")}</small></td>
        <td><span class="module-pill">${escapeHtml(r.module || "未分类")}</span></td>
        <td><span class="impact-pill">${escapeHtml(r.impact_tag || "—")}</span></td>
        <td><span class="status-pill ${STATUS[r.status].css}">${STATUS[r.status].label}</span></td>
        <td>${ciMarkup(r)}</td>
        <td><span class="priority-pill priority-${priority}">${priorityLabel}</span></td>
        <td><span class="row-arrow">›</span></td>
      </tr>`;
    }).join("");

    $("emptyState").hidden = rows.length !== 0;
    $("tableRange").textContent = rows.length ? `显示 ${start + 1}–${Math.min(start + PAGE_SIZE, rows.length)}，共 ${rows.length} 条` : "显示 0 条";
    $("pageInfo").textContent = `${state.page} / ${totalPages}`;
    $("prevPage").disabled = state.page <= 1;
    $("nextPage").disabled = state.page >= totalPages;

    $("prTableBody").querySelectorAll("tr").forEach(row => row.addEventListener("click", () => openDrawer(Number(row.dataset.pr))));
  }

  function openDrawer(prNumber) {
    const r = records.find(item => item.pr_number === prNumber);
    if (!r) return;
    $("drawerPr").textContent = `PR #${r.pr_number}`;
    $("drawerContent").innerHTML = `
      <h3 class="drawer-title">${escapeHtml(r.title || "未命名 PR")}</h3>
      <div class="drawer-badges">
        <span class="status-pill ${STATUS[r.status].css}">${STATUS[r.status].label}</span>
        <span class="module-pill">${escapeHtml(r.module || "未分类")}</span>
        <span class="impact-pill">${escapeHtml(r.impact_tag || "—")}</span>
      </div>
      <div class="detail-grid">
        <div class="detail-stat"><span>合入时间</span><strong>${escapeHtml(formatDate(r.commit_date))}</strong></div>
        <div class="detail-stat"><span>目标版本</span><strong>${escapeHtml(r.version || "待定")}</strong></div>
        <div class="detail-stat"><span>是否需要适配</span><strong>${escapeHtml(r.need_adaptation || "待确认")}</strong></div>
        <div class="detail-stat"><span>是否需要验证</span><strong>${escapeHtml(r.need_verification || "待确认")}</strong></div>
        <div class="detail-stat"><span>NPU CI</span><strong>${r.ci_status === "是" ? "通过" : r.ci_status === "否" ? "失败" : "暂无结果"}</strong></div>
        <div class="detail-stat"><span>CANN 依赖</span><strong>${escapeHtml(r.cann_dependency || "未评估")}</strong></div>
      </div>
      <section class="detail-section"><h3>AI 摘要</h3><p>${escapeHtml(r.summary || "暂无摘要")}</p></section>
      <section class="detail-section"><h3>影响分析</h3><p>${escapeHtml(r.impact_analysis || "暂无影响分析")}</p></section>
      ${r.ci_error_reason ? `<section class="detail-section"><h3>验证失败原因</h3><p>${escapeHtml(r.ci_error_reason)}</p></section>` : ""}
      ${r.ci_env ? `<section class="detail-section"><h3>验证环境</h3><p>${escapeHtml(r.ci_env)}</p></section>` : ""}
      <section class="detail-section"><h3>数据来源</h3><p>${escapeHtml(r.source_file || "归档库")}</p>
        ${r.pr_url ? `<a class="detail-link" href="${escapeHtml(r.pr_url)}" target="_blank" rel="noopener">打开 PyTorch PR ↗</a>` : ""}
        ${r.ci_run_url ? `<a class="detail-link" href="${escapeHtml(r.ci_run_url)}" target="_blank" rel="noopener" style="margin-left:7px">查看 NPU CI ↗</a>` : ""}
      </section>`;
    $("drawerBackdrop").hidden = false;
    $("detailDrawer").classList.add("open");
    $("detailDrawer").setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closeDrawer() {
    $("detailDrawer").classList.remove("open");
    $("detailDrawer").setAttribute("aria-hidden", "true");
    $("drawerBackdrop").hidden = true;
    document.body.style.overflow = "";
  }

  const VIEW_CONFIG = {
    overview: {
      title: "原生支持看板",
      subtitle: "跟踪上游 PR 在 NPU 上的原生支持、适配与验证状态",
      ledger: "",
      status: ""
    },
    all: {
      title: "全部 PR",
      subtitle: "查看进入 PyTorch master 的全部归档 PR",
      ledger: "全部 PR",
      status: ""
    },
    supported: {
      title: "支持 PR",
      subtitle: "最新一次 NPU 运行结果成功的 PR",
      ledger: "NPU 运行成功",
      status: "SUPPORTED"
    },
    unsupported: {
      title: "不支持 PR",
      subtitle: "最新一次 NPU 运行结果为失败的 PR",
      ledger: "NPU 运行失败",
      status: "NATIVE_UNSUPPORTED"
    },
    unanalyzed: {
      title: "未分析 PR",
      subtitle: "尚未获得 NPU 验证结果的 PR",
      ledger: "未分析 PR",
      status: "PENDING_VERIFICATION"
    }
  };

  function applyView() {
    const config = VIEW_CONFIG[state.view];
    $("pageTitle").textContent = config.title;
    $("pageSubtitle").textContent = config.subtitle;
    $("ledgerTitle").textContent = config.ledger || "全部 PR";
    document.querySelectorAll(".overview-only").forEach(section => { section.hidden = state.view !== "overview"; });
    $("prLedger").hidden = state.view === "overview";
    $("statusFilter").hidden = state.view !== "all";
    document.querySelectorAll("[data-view]").forEach(button => button.classList.toggle("active", button.dataset.view === state.view));
  }

  function setView(view, optionalStatus = null) {
    state.view = view;
    state.status = optionalStatus ?? VIEW_CONFIG[view].status;
    state.page = 1;
    $("statusFilter").value = STATUS_ORDER.includes(state.status) ? state.status : "";
    applyView();
    render();
  }

  function render() {
    const rangeRows = getRangeRecords();
    const counts = countStatuses(rangeRows);
    renderMetrics(rangeRows, counts);
    if (state.view === "overview") {
      renderTrend(rangeRows);
      renderDistribution(counts, rangeRows.length);
    } else {
      renderTable(getTableRecords(rangeRows));
    }
  }

  function resetFilters() {
    Object.assign(state, { start: minDate, end: maxDate, version: "", module: "", status: VIEW_CONFIG[state.view].status, search: "", page: 1 });
    $("startDate").value = state.start;
    $("endDate").value = state.end;
    $("versionFilter").value = "";
    $("moduleFilter").value = "";
    $("statusFilter").value = "";
    $("searchInput").value = "";
    render();
  }

  function bindEvents() {
    [["startDate", "start"], ["endDate", "end"], ["versionFilter", "version"], ["moduleFilter", "module"]].forEach(([id, key]) => {
      $(id).addEventListener("change", event => { state[key] = event.target.value; state.page = 1; render(); });
    });
    $("statusFilter").addEventListener("change", event => { state.status = event.target.value; state.page = 1; render(); });
    $("searchInput").addEventListener("input", event => { state.search = event.target.value; state.page = 1; renderTable(getTableRecords(getRangeRecords())); });
    $("resetFilters").addEventListener("click", resetFilters);
    $("prevPage").addEventListener("click", () => { if (state.page > 1) { state.page -= 1; renderTable(getTableRecords(getRangeRecords())); } });
    $("nextPage").addEventListener("click", () => { state.page += 1; renderTable(getTableRecords(getRangeRecords())); });
    $("closeDrawer").addEventListener("click", closeDrawer);
    $("drawerBackdrop").addEventListener("click", closeDrawer);
    document.addEventListener("keydown", event => { if (event.key === "Escape") closeDrawer(); });

    document.querySelectorAll("[data-card-status]").forEach(card => card.addEventListener("click", () => {
      setView("all", card.dataset.cardStatus);
    }));
    document.querySelectorAll("[data-view]").forEach(button => button.addEventListener("click", () => setView(button.dataset.view)));
  }

  populateFilters();
  bindEvents();
  applyView();
  render();
})();
