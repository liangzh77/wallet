const state = {
  token: localStorage.getItem("token") || "",
  user: null,
  people: [],
  transactions: [],
  undonePersonIds: [],
  activePersonId: 0,
  mode: "login",
  view: "wallet",
  amountDraft: "0",
  editingPersonId: 0,
  showPasswordDialog: false,
  adminUsers: [],
  notice: "",
};

const app = document.getElementById("app");
const BEIJING_TIME_ZONE = "Asia/Shanghai";

const byId = (id) => document.getElementById(id);
const money = (value) => `¥${Number(value || 0).toLocaleString("zh-CN", { maximumFractionDigits: 2 })}`;
const moneyPlain = (value) => Number(value || 0).toLocaleString("zh-CN", { maximumFractionDigits: 2 });
const activePerson = () => state.people.find((p) => p.id === state.activePersonId) || state.people[0];
const activeTransactions = () => state.transactions.filter((tx) => tx.personId === (activePerson()?.id || 0));

async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  const res = await fetch(path, { ...options, headers });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "请求失败");
  return data;
}

async function boot() {
  if (!state.token) {
    renderAuth();
    return;
  }
  try {
    state.user = await api("/api/auth/me");
    clearAdminStateIfNeeded();
    if (state.user.isAdmin) {
      state.view = "admin";
      await loadAdminUsers(false);
      return;
    }
    await loadWallet(true);
  } catch {
    localStorage.removeItem("token");
    state.token = "";
    renderAuth();
  }
}

async function loadWallet(checkWages = false) {
  const [people, txResult] = await Promise.all([
    api("/api/persons"),
    api("/api/transactions?personId=all"),
  ]);
  state.people = Array.isArray(people) ? people : [];
  state.transactions = txResult.transactions || [];
  state.undonePersonIds = txResult.undonePersonIds || [];
  if (!state.people.some((p) => p.id === state.activePersonId)) {
    state.activePersonId = state.people[0]?.id || 0;
  }
  if (checkWages) {
    const wage = await api("/api/wages/check", { method: "POST", body: "{}" });
    if (wage.payments?.length) {
      state.notice = formatWageNotice(wage.payments);
      return loadWallet(false);
    }
  }
  renderApp();
}

function clearAdminStateIfNeeded() {
  if (!state.user?.isAdmin) {
    state.adminUsers = [];
  }
}

function renderAuth() {
  app.innerHTML = `
    <main class="phone auth-screen">
      <section class="auth-card">
        <img class="auth-mark" src="/favicon.svg" alt="" aria-hidden="true">
        <h1>家庭记账本</h1>
        <form id="auth-form" class="auth-form">
          <label>用户名<input id="username" autocomplete="username" required></label>
          <label>密码<input id="password" type="password" autocomplete="current-password" required></label>
          <button class="blue-button" type="submit">${state.mode === "login" ? "登录" : "注册"}</button>
        </form>
        <button class="text-link" id="switch-auth" type="button">
          ${state.mode === "login" ? "没有账号，去注册" : "已有账号，去登录"}
        </button>
      </section>
    </main>`;
  byId("switch-auth").addEventListener("click", () => {
    state.mode = state.mode === "login" ? "register" : "login";
    renderAuth();
  });
  byId("auth-form").addEventListener("submit", submitAuth);
}

async function submitAuth(event) {
  event.preventDefault();
  try {
    const data = await api(`/api/auth/${state.mode}`, {
      method: "POST",
      body: JSON.stringify({
        username: byId("username").value.trim(),
        password: byId("password").value,
      }),
    });
    state.token = data.token;
    state.user = data.user;
    clearAdminStateIfNeeded();
    localStorage.setItem("token", data.token);
    if (state.user.isAdmin) {
      state.view = "admin";
      await loadAdminUsers(false);
      return;
    }
    state.view = "wallet";
    await loadWallet(true);
  } catch (err) {
    alert(err.message);
  }
}

function renderApp() {
  if (state.view === "admin") {
    renderAdminOnly();
    return;
  }
  if (state.view === "settings") {
    renderSettings();
    return;
  }
  renderWallet();
}

function renderWallet() {
  const person = activePerson();
  const txs = activeTransactions();
  app.innerHTML = `
    <main class="phone wallet-screen">
      ${state.notice ? `<div class="toast">${escapeHTML(state.notice)}</div>` : ""}
      ${renderPersonTabs()}
      ${person ? renderWalletContent(person, txs) : renderEmptyWallet()}
      ${renderBottomBar(person, txs)}
    </main>
    ${state.editingPersonId ? renderPersonDialog() : ""}`;
  bindCommon();
}

function renderPersonTabs() {
  if (!state.people.length) return `<section class="tabs-empty">还没有人员</section>`;
  return `
    <section class="person-tabs" aria-label="人员切换">
      ${state.people.map((p) => `
        <button class="${p.id === state.activePersonId ? "active" : ""}" data-person="${p.id}">
          ${escapeHTML(p.name)}
        </button>`).join("")}
    </section>`;
}

function renderWalletContent(person, txs) {
  const draft = Number(state.amountDraft || 0);
  const canApply = draft !== 0;
  return `
    <section class="balance-card">
      <div>
        <p>${escapeHTML(person.name)} 的现金余额</p>
        <h1>${money(person.balance)}</h1>
      </div>
      <span class="card-icon" aria-hidden="true"></span>
    </section>
    <section class="wage-card">
      <div>
        <p>今日薪酬（于设置中修改）</p>
        <strong><span>¥</span> ${moneyPlain(person.dailyWage)}</strong>
      </div>
      <span class="coin-icon" aria-hidden="true"></span>
    </section>
    <section class="adjust-card">
      <div class="adjust-row">
        <input id="amount" inputmode="decimal" value="${escapeAttr(state.amountDraft)}" aria-label="调整金额">
        <button data-action="apply-amount" ${canApply ? "" : "disabled"}>改</button>
      </div>
      <div class="quick-grid">
        <button data-adjust="-10">-10</button>
        <button data-adjust="-1">-1</button>
        <button class="positive" data-adjust="1">+1</button>
        <button class="positive" data-adjust="10">+10</button>
      </div>
    </section>
    <section class="recent-head">
      <h2>最近变动</h2>
      <span>${txs.length}</span>
    </section>
    <section class="tx-list">
      ${txs.length ? txs.map(renderTx).join("") : `<div class="empty-card">还没有变动</div>`}
    </section>`;
}

function renderEmptyWallet() {
  return `
    <section class="balance-card empty-state">
      <h1>欢迎</h1>
      <p>先到设置里添加一个人员</p>
      <button class="blue-button" data-action="settings">添加人员</button>
    </section>`;
}

function renderBottomBar(person, txs) {
  const canRedo = person && state.undonePersonIds.includes(person.id);
  return `
    <nav class="bottom-bar" aria-label="快捷操作">
      <button data-action="undo" ${txs.length ? "" : "disabled"}>
        <span>↶</span><b>后退</b>
      </button>
      <button data-action="redo" ${canRedo ? "" : "disabled"}>
        <span>↷</span><b>前进</b>
      </button>
      <button class="clear" data-action="clear" ${person && person.balance !== 0 ? "" : "disabled"}>
        <span>⌁</span><b>清除</b>
      </button>
      <button data-action="settings">
        <span>⚙</span><b>设置</b>
      </button>
    </nav>`;
}

function renderTx(tx) {
  const isMinus = tx.type === "subtract";
  const isClear = tx.type === "clear";
  const isWage = tx.type === "daily_wage";
  const amountPrefix = isMinus ? "-" : "+";
  const title = tx.description || (isWage ? "日薪发放" : isMinus ? `减少${moneyPlain(tx.amount)}元` : isClear ? "清零" : `增加${moneyPlain(tx.amount)}元`);
  return `
    <article class="tx-card">
      <span class="tx-icon ${isMinus || isClear ? "minus" : "plus"}">${isMinus ? "−" : isClear ? "×" : "¥"}</span>
      <div>
        <p>${escapeHTML(title)}</p>
        <time>${formatDate(tx.createdAt)}</time>
      </div>
      <strong class="${isMinus || isClear ? "minus" : "plus"}">${isClear ? "清零" : `${amountPrefix}${money(tx.amount)}`}</strong>
    </article>`;
}

function renderSettings() {
  app.innerHTML = `
    <main class="phone settings-screen">
      ${renderProfilePanel()}
      <header class="settings-head">
        <h1>人员管理</h1>
      </header>
      <section class="settings-list">
        ${state.people.length ? state.people.map(renderPersonRow).join("") : `<div class="settings-empty">还没有人员</div>`}
      </section>
      <button class="settings-action add" data-action="add-person">+ 添加人员</button>
      <button class="settings-action back" data-action="wallet">返回</button>
      <button class="settings-action logout" data-action="logout">⇱ 退出登录</button>
    </main>
    ${state.editingPersonId ? renderPersonDialog() : ""}
    ${state.showPasswordDialog ? renderPasswordDialog() : ""}`;
  bindCommon();
}

function renderProfilePanel() {
  return `
    <section class="profile-panel">
      <div class="profile-line">
        <span>当前用户</span>
        <strong>${escapeHTML(state.user?.username || "")}</strong>
      </div>
      <button class="profile-password-button" data-action="password-dialog">修改密码</button>
    </section>`;
}

function renderPersonRow(person) {
  return `
    <article class="person-row">
      <button class="person-info" data-person="${person.id}">
        <strong>${escapeHTML(person.name)}</strong>
        <span>日薪: ${money(person.dailyWage)}</span>
      </button>
      <div class="row-actions">
        <button class="edit" data-edit-person="${person.id}" aria-label="编辑 ${escapeAttr(person.name)}">✎</button>
        <button class="delete" data-delete-person="${person.id}" aria-label="删除 ${escapeAttr(person.name)}">🗑</button>
      </div>
    </article>`;
}

function renderAdminPanel() {
  return `
    <section class="admin-panel">
      <div class="admin-title">
        <h2>用户管理</h2>
        <button data-action="refresh-admin">刷新</button>
      </div>
      <div class="admin-list">
        ${state.adminUsers.length ? state.adminUsers.map((u) => `
          <article class="admin-row">
            <div>
              <strong>${escapeHTML(u.username)}</strong>
              <span>${u.isAdmin ? "管理员" : "普通用户"} · ${formatDate(u.createdAt)}</span>
            </div>
            <div class="row-actions">
              <button class="edit" data-reset-user="${u.id}" aria-label="重置 ${escapeAttr(u.username)} 的密码">改密</button>
              <button class="delete" data-delete-user="${u.id}" ${u.username === state.user.username ? "disabled" : ""}>删除</button>
            </div>
          </article>`).join("") : `<div class="settings-empty">点击刷新加载用户</div>`}
      </div>
    </section>`;
}

function renderAdminOnly() {
  app.innerHTML = `
    <main class="phone settings-screen admin-screen">
      <header class="settings-head">
        <h1>用户管理</h1>
        <button data-action="refresh-admin">刷新</button>
      </header>
      <section class="admin-panel standalone">
        <div class="admin-list">
          ${state.adminUsers.length ? state.adminUsers.map((u) => `
            <article class="admin-row">
              <div>
                <strong>${escapeHTML(u.username)}</strong>
                <span>${u.isAdmin ? "管理员" : "普通用户"} · ${formatDate(u.createdAt)}</span>
              </div>
              <div class="row-actions">
                <button class="edit" data-reset-user="${u.id}" aria-label="重置 ${escapeAttr(u.username)} 的密码">改密</button>
                <button class="delete" data-delete-user="${u.id}" ${u.username === state.user.username ? "disabled" : ""}>删除</button>
              </div>
            </article>`).join("") : `<div class="settings-empty">暂无用户</div>`}
        </div>
      </section>
      <button class="settings-action logout" data-action="logout">⇱ 退出登录</button>
      <p class="current-user">当前管理员: ${escapeHTML(state.user?.username || "")}</p>
    </main>`;
  bindCommon();
}

function renderPersonDialog() {
  const person = state.people.find((p) => p.id === state.editingPersonId);
  const isNew = state.editingPersonId === -1;
  return `
    <section class="modal" role="dialog" aria-modal="true">
      <div class="dialog-card">
        <h2>${isNew ? "添加人员" : "修改信息"}</h2>
        <form id="person-dialog-form">
          <label>姓名<input id="dialog-name" value="${escapeAttr(person?.name || "")}" required></label>
          <label>默认日薪<input id="dialog-wage" type="number" step="0.01" value="${person?.dailyWage ?? 100}" required></label>
          <div class="dialog-actions">
            <button type="button" data-action="close-dialog">取消</button>
            <button class="blue-button" type="submit">保存</button>
          </div>
        </form>
      </div>
    </section>`;
}

function renderPasswordDialog() {
  return `
    <section class="modal" role="dialog" aria-modal="true">
      <div class="dialog-card">
        <h2>修改密码</h2>
        <form id="password-form" class="password-form">
          <label>旧密码<input id="old-password" type="password" autocomplete="current-password" required></label>
          <label>新密码<input id="new-password" type="password" autocomplete="new-password" minlength="6" required></label>
          <label>确认新密码<input id="confirm-password" type="password" autocomplete="new-password" minlength="6" required></label>
          <div class="dialog-actions">
            <button type="button" data-action="close-password-dialog">取消</button>
            <button class="blue-button" type="submit">保存</button>
          </div>
        </form>
      </div>
    </section>`;
}

function bindCommon() {
  document.querySelectorAll("[data-person]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activePersonId = Number(button.dataset.person);
      state.view = "wallet";
      renderApp();
    });
  });
  document.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => runAction(button.dataset.action));
  });
  document.querySelectorAll("[data-adjust]").forEach((button) => {
    button.addEventListener("click", () => adjustDraft(Number(button.dataset.adjust)));
  });
  document.querySelectorAll("[data-edit-person]").forEach((button) => {
    button.addEventListener("click", () => {
      state.editingPersonId = Number(button.dataset.editPerson);
      renderApp();
    });
  });
  document.querySelectorAll("[data-delete-person]").forEach((button) => {
    button.addEventListener("click", () => deletePerson(Number(button.dataset.deletePerson)));
  });
  document.querySelectorAll("[data-reset-user]").forEach((button) => {
    button.addEventListener("click", () => resetPassword(Number(button.dataset.resetUser)));
  });
  document.querySelectorAll("[data-delete-user]").forEach((button) => {
    button.addEventListener("click", () => deleteUser(Number(button.dataset.deleteUser)));
  });
  byId("amount")?.addEventListener("input", (event) => {
    state.amountDraft = event.target.value || "0";
    const applyButton = document.querySelector('[data-action="apply-amount"]');
    if (applyButton) applyButton.disabled = Number(state.amountDraft || 0) === 0;
  });
  byId("person-dialog-form")?.addEventListener("submit", savePersonDialog);
  byId("password-form")?.addEventListener("submit", changePassword);
}

async function runAction(action) {
  try {
    if (action === "logout") return logout();
    if (state.user?.isAdmin && action !== "refresh-admin") {
      return;
    }
    if (action === "settings") return openSettings();
    if (action === "wallet") {
      state.view = "wallet";
      state.editingPersonId = 0;
      return renderApp();
    }
    if (action === "add-person") {
      state.editingPersonId = -1;
      return renderApp();
    }
    if (action === "password-dialog") {
      state.showPasswordDialog = true;
      return renderApp();
    }
    if (action === "close-password-dialog") {
      state.showPasswordDialog = false;
      return renderApp();
    }
    if (action === "close-dialog") {
      state.editingPersonId = 0;
      return renderApp();
    }
    if (action === "refresh-admin") return loadAdminUsers();
    if (action === "undo" || action === "redo") return undoRedo(action);
    if (action === "clear") return clearBalance();
    if (action === "apply-amount") return applyAmount();
  } catch (err) {
    alert(err.message);
  }
}

async function openSettings() {
  state.view = "settings";
  if (state.user?.isAdmin && !state.adminUsers.length) {
    state.adminUsers = await api("/api/admin/users");
  }
  renderApp();
}

function adjustDraft(delta) {
  const next = Number(state.amountDraft || 0) + delta;
  state.amountDraft = String(Number.isInteger(next) ? next : Number(next.toFixed(2)));
  renderApp();
}

async function applyAmount() {
  const person = activePerson();
  const amount = Number(state.amountDraft || 0);
  if (!person || amount === 0) return;
  const type = amount > 0 ? "add" : "subtract";
  const absolute = Math.abs(amount);
  const nextBalance = type === "add" ? person.balance + absolute : person.balance - absolute;
  await api(`/api/persons/${person.id}`, {
    method: "PUT",
    body: JSON.stringify({ balance: nextBalance }),
  });
  await api("/api/transactions", {
    method: "POST",
    body: JSON.stringify({
      personId: person.id,
      type,
      amount: absolute,
      description: type === "add" ? `增加${moneyPlain(absolute)}元` : `减少${moneyPlain(absolute)}元`,
    }),
  });
  state.amountDraft = "0";
  state.notice = "";
  await loadWallet(false);
}

async function clearBalance() {
  const person = activePerson();
  if (!person || person.balance === 0) return;
  if (!confirm(`清除 ${person.name} 的余额？`)) return;
  await api(`/api/persons/${person.id}`, {
    method: "PUT",
    body: JSON.stringify({ balance: 0 }),
  });
  await api("/api/transactions", {
    method: "POST",
    body: JSON.stringify({
      personId: person.id,
      type: "clear",
      amount: person.balance,
      description: "清零",
    }),
  });
  await loadWallet(false);
}

async function savePersonDialog(event) {
  event.preventDefault();
  const name = byId("dialog-name").value.trim();
  const dailyWage = Number(byId("dialog-wage").value || 0);
  if (state.editingPersonId === -1) {
    const person = await api("/api/persons", {
      method: "POST",
      body: JSON.stringify({ name, dailyWage }),
    });
    state.activePersonId = person.id;
  } else {
    await api(`/api/persons/${state.editingPersonId}`, {
      method: "PUT",
      body: JSON.stringify({ name, dailyWage }),
    });
  }
  state.editingPersonId = 0;
  await loadWallet(false);
}

async function deletePerson(personId) {
  const person = state.people.find((p) => p.id === personId);
  if (!person || !confirm(`删除 ${person.name}？`)) return;
  await api(`/api/persons/${personId}`, { method: "DELETE" });
  state.activePersonId = state.activePersonId === personId ? 0 : state.activePersonId;
  await loadWallet(false);
}

async function undoRedo(action) {
  const person = activePerson();
  if (!person) return;
  await api("/api/undo-redo", {
    method: "POST",
    body: JSON.stringify({ action, personId: person.id }),
  });
  await loadWallet(false);
}

async function loadAdminUsers() {
  state.adminUsers = await api("/api/admin/users");
  renderApp();
}

async function changePassword(event) {
  event.preventDefault();
  const oldPassword = byId("old-password").value;
  const newPassword = byId("new-password").value;
  const confirmPassword = byId("confirm-password").value;
  if (newPassword !== confirmPassword) {
    alert("两次输入的新密码不一致");
    return;
  }
  await api("/api/auth/password", {
    method: "POST",
    body: JSON.stringify({ oldPassword, newPassword }),
  });
  byId("old-password").value = "";
  byId("new-password").value = "";
  byId("confirm-password").value = "";
  state.showPasswordDialog = false;
  renderApp();
  alert("密码已修改");
}

async function resetPassword(userId) {
  const data = await api("/api/admin/reset-password", {
    method: "POST",
    body: JSON.stringify({ userId }),
  });
  alert(`新密码：${data.newPassword}`);
}

async function deleteUser(userId) {
  if (!confirm("确认删除这个用户？")) return;
  await api(`/api/admin/users/${userId}`, { method: "DELETE" });
  state.adminUsers = await api("/api/admin/users");
  renderApp();
}

function logout() {
  localStorage.removeItem("token");
  Object.assign(state, {
    token: "",
    user: null,
    people: [],
    transactions: [],
    undonePersonIds: [],
    activePersonId: 0,
    view: "wallet",
    amountDraft: "0",
    editingPersonId: 0,
    showPasswordDialog: false,
    adminUsers: [],
    notice: "",
  });
  renderAuth();
}

function formatDate(value) {
  const date = parseServerDate(value);
  if (Number.isNaN(date.getTime())) return value || "";
  return date.toLocaleString("zh-CN", {
    timeZone: BEIJING_TIME_ZONE,
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatWageNotice(payments) {
  const days = [...new Set(
    payments
      .map((payment) => Number(payment.days || 0))
      .filter((day) => day > 0)
  )].sort((a, b) => a - b);
  if (!days.length) return "已自动发放日薪";
  return `已自动发放 ${days.map((day) => `${day} 天`).join("、")}日薪`;
}

function parseServerDate(value) {
  const raw = String(value || "").trim();
  if (!raw) return new Date(NaN);
  const normalized = raw.includes("T") ? raw : raw.replace(" ", "T");
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized);
  return new Date(hasZone ? normalized : `${normalized}Z`);
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));
}

function escapeAttr(value) {
  return escapeHTML(value).replace(/`/g, "&#96;");
}

boot();
