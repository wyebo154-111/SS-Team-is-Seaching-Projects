let all = [];
let filtered = [];
let state = { page: 1, pageSize: 20, pages: 1 };

const SYNONYMS = {
  project_name: ["项目名称", "项目", "交易", "Matter", "Project"],
  year: ["年份", "年度", "年", "Year"],
  role: ["角色", "团队角色", "Role"],
  industry: ["行业", "所属行业", "企业所属行业", "Industry"],
  listing_type: ["上市类型", "上市类别", "IPO类型", "上市方式", "Listing Type", "Listing"],
};

function el(id) { return document.getElementById(id); }

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normStr(v) {
  return String(v ?? "").trim().replace(/\s+/g, " ");
}

function findField(obj, wantedKey) {
  const keys = Object.keys(obj || {});
  for (const syn of SYNONYMS[wantedKey] || []) {
    for (const k of keys) if (k === syn) return k;
  }
  for (const syn of SYNONYMS[wantedKey] || []) {
    for (const k of keys) if (k.includes(syn)) return k;
  }
  return null;
}

function getCanonical(item) {
  const raw = item.raw || item;
  const kProject = findField(raw, "project_name");
  const kYear = findField(raw, "year");
  const kRole = findField(raw, "role");
  const kIndustry = findField(raw, "industry");
  const kListing = findField(raw, "listing_type");
  return {
    project_name: normStr(kProject ? raw[kProject] : item.project_name),
    year: normStr(kYear ? raw[kYear] : item.year),
    role: normStr(kRole ? raw[kRole] : item.role),
    industry: normStr(kIndustry ? raw[kIndustry] : item.industry),
    listing_type: normStr(kListing ? raw[kListing] : item.listing_type),
    raw,
  };
}

function setOptions(selectEl, values) {
  const current = selectEl.value;
  selectEl.innerHTML = "";
  const optAll = document.createElement("option");
  optAll.value = "";
  optAll.textContent = "全部";
  selectEl.appendChild(optAll);
  for (const v of values) {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = v;
    selectEl.appendChild(opt);
  }
  if ([...selectEl.options].some((o) => o.value === current)) selectEl.value = current;
}

function buildFacets(items) {
  const years = new Set();
  const roles = new Set();
  const industries = new Set();
  const listings = new Set();
  for (const it of items) {
    const c = getCanonical(it);
    if (c.year) years.add(c.year);
    if (c.role) roles.add(c.role);
    if (c.industry) industries.add(c.industry);
    if (c.listing_type) listings.add(c.listing_type);
  }
  const sortCN = (a, b) => String(a).localeCompare(String(b), "zh-CN");
  setOptions(el("year"), [...years].sort((a, b) => String(b).localeCompare(String(a), "zh-CN")));
  setOptions(el("role"), [...roles].sort(sortCN));
  setOptions(el("industry"), [...industries].sort(sortCN));
  setOptions(el("listing_type"), [...listings].sort(sortCN));
}

function updatePager() {
  el("pageInfo").textContent = `${state.page} / ${state.pages}`;
  el("prevBtn").disabled = state.page <= 1;
  el("nextBtn").disabled = state.page >= state.pages;
}

function renderKV(raw) {
  const keys = Object.keys(raw || {});
  if (!keys.length) return `<div class="muted">无</div>`;
  keys.sort((a, b) => String(a).localeCompare(String(b), "zh-CN"));
  const rows = keys.map((k) => `<div class="k">${escapeHtml(k)}</div><div class="v">${escapeHtml(raw[k])}</div>`);
  return `<div class="kv">${rows.join("")}</div>`;
}

function renderPage() {
  const start = (state.page - 1) * state.pageSize;
  const pageItems = filtered.slice(start, start + state.pageSize);
  const tbody = el("rows");
  tbody.innerHTML = "";

  for (let i = 0; i < pageItems.length; i++) {
    const item = pageItems[i];
    const c = getCanonical(item);
    const id = `d_${start + i}`;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><div style="font-weight:600;">${escapeHtml(c.project_name)}</div></td>
      <td><span class="badge">${escapeHtml(c.year)}</span></td>
      <td>${escapeHtml(c.role)}</td>
      <td>${escapeHtml(c.industry)}</td>
      <td>${escapeHtml(c.listing_type)}</td>
      <td><button class="secondary" data-toggle="${id}">查看</button></td>
    `;
    tbody.appendChild(tr);

    const tr2 = document.createElement("tr");
    tr2.id = id;
    tr2.style.display = "none";
    tr2.innerHTML = `
      <td colspan="6">
        <div class="muted">全部信息（来自 Excel 该行所有字段）</div>
        ${renderKV(c.raw)}
      </td>
    `;
    tbody.appendChild(tr2);
  }

  tbody.querySelectorAll("button[data-toggle]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-toggle");
      const row = document.getElementById(id);
      const open = row.style.display !== "none";
      row.style.display = open ? "none" : "";
      btn.textContent = open ? "查看" : "收起";
    });
  });

  el("empty").style.display = pageItems.length ? "none" : "block";
  el("stats").textContent = `共 ${filtered.length} 条结果（已加载 ${all.length} 条）`;
  updatePager();
}

function applyFilters() {
  const q = normStr(el("q").value);
  const year = el("year").value;
  const role = el("role").value;
  const industry = el("industry").value;
  const listing_type = el("listing_type").value;

  filtered = all.filter((item) => {
    const c = getCanonical(item);
    if (year && c.year !== year) return false;
    if (role && c.role !== role) return false;
    if (industry && c.industry !== industry) return false;
    if (listing_type && c.listing_type !== listing_type) return false;
    if (!q) return true;

    const hay = JSON.stringify(c.raw || {}).toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  state.pages = Math.max(1, Math.ceil(filtered.length / state.pageSize));
  state.page = Math.min(state.page, state.pages);
  renderPage();
}

function reset() {
  el("q").value = "";
  el("year").value = "";
  el("role").value = "";
  el("industry").value = "";
  el("listing_type").value = "";
  state.page = 1;
  applyFilters();
}

function bind() {
  el("searchBtn").addEventListener("click", () => { state.page = 1; applyFilters(); });
  el("resetBtn").addEventListener("click", reset);
  el("prevBtn").addEventListener("click", () => { state.page = Math.max(1, state.page - 1); renderPage(); });
  el("nextBtn").addEventListener("click", () => { state.page = Math.min(state.pages, state.page + 1); renderPage(); });
  el("q").addEventListener("keydown", (e) => { if (e.key === "Enter") { state.page = 1; applyFilters(); } });
}

async function loadData() {
  const isFile = location.protocol === "file:";
  if (isFile) el("hintCard").style.display = "";

  const res = await fetch("./data.json", { cache: "no-store" });
  if (!res.ok) throw new Error("无法读取 data.json（建议运行 run-local.ps1）");
  const data = await res.json();
  all = Array.isArray(data.items) ? data.items : (Array.isArray(data) ? data : []);
}

async function init() {
  bind();
  await loadData();
  buildFacets(all);
  filtered = all.slice();
  state.pages = Math.max(1, Math.ceil(filtered.length / state.pageSize));
  renderPage();
}

init().catch((err) => {
  el("stats").textContent = `错误：${err.message}`;
});

