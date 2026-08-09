const DEFAULT_ESP_HOST = "192.168.4.1";
const STATUS_INTERVAL_MS = 1500;
const REQUEST_TIMEOUT_MS = 3500;

const state = {
  user: null,
  role: null,
  doorState: "INCONNU",
  wifiState: "ESP8266 non détecté",
  cameraState: "Non disponible",
  cameraPreviewStatus: "ESP8266 : pas de caméra intégrée",
  todayOpenings: 0,
  todayClosures: 0,
  activeUsers: 0,
  presenceAlerts: 0,
  sensorDistance: 0,
  radarAngle: 0,
  radarDistance: 0,
  radarObjectDetected: false,
  commandPending: false,
  devices: [],
  selectedDeviceId: null,
  notifications: [],
  history: [],
  users: [
    { id: 1, name: "Admin", role: "administrator", email: "admin@gmail.com", password: "admin123" },
    { id: 2, name: "Utilisateur simple", role: "user", email: "user@gmail.com", password: "user123" }
  ],
  reconnectDelay: 1000,
  reconnectTimer: null,
  pollingTimer: null,
  lastEvent: ""
};

const elements = {};
["loginScreen", "appShell", "loginForm", "loginUsername", "loginPassword", "navMenu", "navUserRole", "profileName", "profileInitial", "topbarSubtitle",
  "doorState", "cameraState", "wifiState", "doorLabel", "todayOpenings", "todayClosures", "activeUsers", "presenceAlerts", "sensorDistance", "notificationsList", "historyTableBody", "cameraPreviewStatus", "userList", "cameraModal", "radarCanvas", "radarAngle", "radarDistance", "radarObject", "radarDetectionStatus",
  "addDeviceBtn", "deviceModal", "closeDeviceModal", "addDeviceForm", "modalDeviceName", "modalDeviceId", "modalDeviceApSsid", "scanApsBtn", "modalPairingCode", "modalDeviceDescription", "registeredDevicesList",
  "deviceNameLabel", "deviceConnectionLabel", "deviceServerLabel", "deviceStatusBadge", "deviceNetworkBadge", "deviceServerBadge", "deviceName", "deviceId", "deviceStatus", "deviceLastSeen", "deviceFirmware", "deviceUptime", "deviceWifiSsid", "deviceLocalIp", "deviceRssi", "deviceInternetStatus", "deviceServerStatus", "deviceLastSync", "deviceDoorHardware", "deviceRfidStatus", "deviceFingerprintStatus", "deviceUltrasonicStatus", "deviceCameraStatus",
  "testConnectionBtn", "restartDeviceBtn", "removeDeviceBtn", "connectDeviceBtn", "saveDeviceConfigBtn", "deviceFormName", "deviceFormId", "deviceFormPairingCode", "deviceFormDescription", "configGateOpenDuration", "configGateAutoClose", "configGateMode", "configUltrasonicDistance", "configWifiSsid", "configWifiPassword", "configDeviceLocalIp", "configUltrasonicNotifyDelay", "configNotificationsEnabled", "toastMessage"].forEach((id) => { elements[id] = document.getElementById(id); });

function showToast(message) { elements.toastMessage.textContent = message; elements.toastMessage.classList.add("active"); window.setTimeout(() => elements.toastMessage.classList.remove("active"), 3200); }
function getSelectedDevice() { return state.devices.find((device) => device.id === state.selectedDeviceId) || null; }
function normaliseHost(value) { return value.trim().replace(/^https?:\/\//, "").replace(/\/$/, ""); }
function endpoint(device, path) { return `http://${normaliseHost(device.host)}${path}`; }
function localTime() { return new Date().toLocaleTimeString("fr-FR", { hour12: false }); }
function localDate() { return new Date().toLocaleDateString("fr-FR"); }

async function espRequest(device, path, options = {}) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const headers = { ...(options.headers || {}) };
    if (options.authorized) headers["X-SAMS-Key"] = device.apiKey;
    const response = await fetch(endpoint(device, path), { ...options, headers, signal: controller.signal });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || data.message || `Erreur HTTP ${response.status}`);
    return data;
  } finally { window.clearTimeout(timeout); }
}

function renderStatus() {
  elements.doorState.textContent = state.doorState;
  elements.cameraState.textContent = state.cameraState;
  elements.wifiState.textContent = state.wifiState;
  elements.doorLabel.textContent = state.doorState;
  elements.todayOpenings.textContent = state.todayOpenings;
  elements.todayClosures.textContent = state.todayClosures;
  elements.activeUsers.textContent = state.activeUsers;
  elements.presenceAlerts.textContent = state.presenceAlerts;
  elements.sensorDistance.textContent = state.sensorDistance ? `${(state.sensorDistance / 100).toFixed(2)} m` : "-- m";
  elements.cameraPreviewStatus.textContent = state.cameraPreviewStatus;
}
function renderRadar() {
  const detected = state.radarObjectDetected;
  setText("radarAngle", `${Math.round(state.radarAngle)}°`);
  setText("radarDistance", state.radarDistance ? `${state.radarDistance.toFixed(1)} cm` : "-- cm");
  setText("radarObject", detected ? "Oui" : "Non");
  setText("radarDetectionStatus", detected ? "OBJET DÉTECTÉ" : "BALAYAGE ACTIF");
  const canvas = elements.radarCanvas;
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const width = canvas.width, height = canvas.height, hudHeight = 76;
  const centerX = width / 2, centerY = height - hudHeight - 20, radius = Math.min(width / 2 - 42, centerY - 34);
  const radians = Math.PI - state.radarAngle * Math.PI / 180;
  const maxDistance = 400;
  ctx.clearRect(0, 0, width, height);

  const background = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius * 1.2);
  background.addColorStop(0, "#0a2b1d"); background.addColorStop(0.58, "#05170f"); background.addColorStop(1, "#010705");
  ctx.fillStyle = background; ctx.fillRect(0, 0, width, height);
  ctx.save(); ctx.beginPath(); ctx.rect(14, 14, width - 28, height - 28); ctx.clip();

  ctx.strokeStyle = "rgba(89, 255, 166, .28)"; ctx.lineWidth = 1;
  [0.2, 0.4, 0.6, 0.8, 1].forEach((part) => { ctx.beginPath(); ctx.arc(centerX, centerY, radius * part, Math.PI, 0); ctx.stroke(); });
  for (let angle = 0; angle <= 180; angle += 15) {
    const lineRadians = Math.PI - angle * Math.PI / 180;
    ctx.beginPath(); ctx.moveTo(centerX, centerY); ctx.lineTo(centerX + Math.cos(lineRadians) * radius, centerY - Math.sin(lineRadians) * radius); ctx.stroke();
  }

  // Faisceau réel du servo, avec une traînée verte qui s'estompe derrière lui.
  for (let trail = 28; trail >= 1; trail--) {
    const trailRadians = radians + trail * 0.018 * (state.radarAngle < 90 ? 1 : -1);
    ctx.strokeStyle = `rgba(80, 255, 156, ${(29 - trail) / 105})`;
    ctx.lineWidth = 2 + (29 - trail) / 8;
    ctx.beginPath(); ctx.moveTo(centerX, centerY); ctx.lineTo(centerX + Math.cos(trailRadians) * radius, centerY - Math.sin(trailRadians) * radius); ctx.stroke();
  }
  const beam = ctx.createLinearGradient(centerX, centerY, centerX + Math.cos(radians) * radius, centerY - Math.sin(radians) * radius);
  beam.addColorStop(0, "rgba(135, 255, 191, .15)"); beam.addColorStop(1, "rgba(123, 255, 181, 1)");
  ctx.strokeStyle = beam; ctx.lineWidth = 3; ctx.shadowColor = "#51ff9c"; ctx.shadowBlur = 18;
  ctx.beginPath(); ctx.moveTo(centerX, centerY); ctx.lineTo(centerX + Math.cos(radians) * radius, centerY - Math.sin(radians) * radius); ctx.stroke();
  ctx.shadowBlur = 0;

  if (detected) {
    const objectRadius = Math.min(state.radarDistance, maxDistance) / maxDistance * radius;
    const objectX = centerX + Math.cos(radians) * objectRadius, objectY = centerY - Math.sin(radians) * objectRadius;
    ctx.fillStyle = "#bbffda"; ctx.shadowColor = "#31ff83"; ctx.shadowBlur = 24;
    ctx.beginPath(); ctx.arc(objectX, objectY, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#53ff9c"; ctx.beginPath(); ctx.arc(objectX, objectY, 3, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
  }

  ctx.fillStyle = "rgba(172, 255, 209, .72)"; ctx.font = "15px system-ui, sans-serif";
  [80, 160, 240, 320, 400].forEach((distance, index) => ctx.fillText(`${distance} cm`, centerX + 7, centerY - radius * ((index + 1) / 5) + 5));
  ctx.fillText("0°", 28, centerY + 20); ctx.fillText("90°", centerX - 16, 32); ctx.fillText("180°", width - 72, centerY + 20);
  ctx.restore();

  ctx.fillStyle = "rgba(1, 13, 8, .94)"; ctx.fillRect(14, height - hudHeight - 14, width - 28, hudHeight);
  ctx.strokeStyle = "rgba(85, 255, 158, .42)"; ctx.strokeRect(14.5, height - hudHeight - 13.5, width - 29, hudHeight - 1);
  ctx.fillStyle = "#7affb5"; ctx.font = "600 19px system-ui, sans-serif";
  ctx.fillText(`ANGLE : ${Math.round(state.radarAngle)}°`, 38, height - 46);
  ctx.fillText(`DISTANCE : ${state.radarDistance ? state.radarDistance.toFixed(1) : "--"} cm`, width / 2 + 26, height - 46);
  ctx.fillStyle = detected ? "#8dffb7" : "rgba(172, 255, 209, .62)"; ctx.font = "13px system-ui, sans-serif";
  ctx.fillText(detected ? "● OBJET DÉTECTÉ" : "● BALAYAGE EN COURS", 38, height - 24);
}
function renderNotifications() { elements.notificationsList.innerHTML = state.notifications.length ? state.notifications.slice(0, 5).map((entry) => `<div class="notification-item"><p>${entry.message}</p><time>${entry.time}</time></div>`).join("") : '<p class="placeholder-text">Les événements réels de l’ESP apparaîtront ici.</p>'; }
function renderHistory() { elements.historyTableBody.innerHTML = state.history.map((item) => `<tr><td>${item.date}</td><td>${item.time}</td><td>${item.type}</td><td>${item.method}</td><td>${item.user}</td><td>${item.status}</td></tr>`).join(""); }
function renderUsers() { if (elements.userList) elements.userList.innerHTML = state.users.map((user) => `<div class="user-item"><div><p class="user-name">${user.name}</p><p class="user-role">${user.role === "administrator" ? "Administrateur" : "Utilisateur simple"}</p></div></div>`).join(""); }

function renderDeviceList() {
  if (!state.devices.length) { elements.registeredDevicesList.innerHTML = '<p class="placeholder-text">Aucun ESP8266 connecté. Connectez-vous d’abord au Wi-Fi SAMS puis ajoutez-le.</p>'; return; }
  elements.registeredDevicesList.innerHTML = state.devices.map((device) => `<div class="device-item ${device.id === state.selectedDeviceId ? "device-item--active" : ""}"><div class="device-item-info"><strong>${device.name}</strong><span>${device.deviceId || "Détection en cours"} · ${device.online ? "Connecté" : "Hors ligne"}</span></div><div class="device-item-actions"><button class="ghost-button" data-select="${device.id}">Sélectionner</button><button class="secondary-button" data-remove="${device.id}">Supprimer</button></div></div>`).join("");
  elements.registeredDevicesList.querySelectorAll("[data-select]").forEach((button) => button.onclick = () => { state.selectedDeviceId = button.dataset.select; renderAllDevices(); pollSelectedDeviceStatus(); });
  elements.registeredDevicesList.querySelectorAll("[data-remove]").forEach((button) => button.onclick = () => removeDevice(button.dataset.remove));
}
function setText(id, value) { if (elements[id]) elements[id].textContent = value; }
function renderSelectedDevice() {
  const device = getSelectedDevice();
  if (!device) { ["deviceNameLabel", "deviceConnectionLabel", "deviceServerLabel", "deviceName", "deviceId", "deviceLastSeen", "deviceFirmware", "deviceUptime", "deviceWifiSsid", "deviceLocalIp", "deviceRssi", "deviceInternetStatus", "deviceServerStatus", "deviceLastSync", "deviceDoorHardware", "deviceRfidStatus", "deviceFingerprintStatus", "deviceUltrasonicStatus", "deviceCameraStatus"].forEach((id) => setText(id, "-")); setText("deviceStatus", "Déconnecté"); setText("deviceStatusBadge", "Déconnecté"); setText("deviceNetworkBadge", "En attente"); setText("deviceServerBadge", "Hors ligne"); return; }
  setText("deviceNameLabel", device.name); setText("deviceConnectionLabel", `${device.apSsid || "Réseau local"} · ${device.host}`); setText("deviceServerLabel", device.online ? "API locale active" : "API locale indisponible"); setText("deviceStatusBadge", device.online ? "ESP8266 connecté" : "Hors ligne"); setText("deviceNetworkBadge", device.online ? "CONNECTÉ" : "DÉCONNECTÉ"); setText("deviceServerBadge", device.online ? "LOCAL" : "HORS LIGNE");
  setText("deviceName", device.name); setText("deviceId", device.deviceId || "Détection en cours"); setText("deviceStatus", device.online ? "ONLINE" : "HORS LIGNE"); setText("deviceLastSeen", device.lastSeen || "-"); setText("deviceFirmware", device.firmware || "-"); setText("deviceUptime", device.uptime || "-"); setText("deviceWifiSsid", device.apSsid || "-"); setText("deviceLocalIp", device.host); setText("deviceRssi", device.rssi ?? "-"); setText("deviceInternetStatus", "NON REQUIS"); setText("deviceServerStatus", device.online ? "API LOCALE CONNECTÉE" : "NON CONNECTÉ"); setText("deviceLastSync", device.lastSync || "-"); setText("deviceDoorHardware", device.doorState || "-"); setText("deviceRfidStatus", "Non câblé"); setText("deviceFingerprintStatus", "Non câblé"); setText("deviceUltrasonicStatus", device.online ? "Actif" : "-"); setText("deviceCameraStatus", "Non câblée");
}
function renderAllDevices() { renderDeviceList(); renderSelectedDevice(); }
function addEvent(message, type = "info") {
  state.notifications.unshift({ message, time: localTime().slice(0, 5), type });
  state.notifications = state.notifications.slice(0, 20);
  // persist notifications for this session so they're available until tab closed
  try { sessionStorage.setItem("sams-notifications", JSON.stringify(state.notifications)); } catch (_) {}
  renderNotifications();
}
function addHistory(action) { state.history.unshift({ date: localDate(), time: localTime(), type: action === "open" ? "Ouverture" : "Fermeture", method: "Interface Web", user: state.user?.name || "Utilisateur", status: action === "open" ? "Ouvert" : "Fermé" }); renderHistory(); }

function applyStatus(device, data) {
  device.online = true; device.deviceId = data.deviceId; device.name = data.deviceName || device.name; device.apSsid = data.apSsid; device.firmware = data.firmware; device.uptime = data.uptime; device.rssi = data.rssi; device.doorState = data.doorState; device.lastSeen = localTime(); device.lastSync = localTime();
  state.doorState = data.doorState; state.wifiState = `${data.networkMode} · ${data.localIp}`; state.sensorDistance = data.sensorDistanceCm; state.radarAngle = data.radarAngle ?? 0; state.radarDistance = data.radarDistanceCm ?? data.sensorDistanceCm; state.radarObjectDetected = Boolean(data.radarObjectDetected); state.todayOpenings = data.openingCount; state.todayClosures = data.closingCount; state.presenceAlerts = data.presenceCount;
  if (data.lastEvent && data.lastEvent !== state.lastEvent) { state.lastEvent = data.lastEvent; addEvent(data.lastEvent, data.doorState === "OUVERT" ? "success" : "info"); }
  renderStatus(); renderRadar(); renderAllDevices();
}
function markOffline(device) { if (!device) return; const wasOnline = device.online; device.online = false; state.wifiState = "ESP8266 indisponible — reconnexion en cours"; renderStatus(); renderAllDevices(); if (wasOnline) addEvent("Connexion ESP8266 perdue. Nouvelle tentative automatique.", "warning"); scheduleReconnect(); }
function scheduleReconnect() { if (state.reconnectTimer) return; const delay = state.reconnectDelay; state.reconnectTimer = window.setTimeout(async () => { state.reconnectTimer = null; await pollSelectedDeviceStatus(); state.reconnectDelay = getSelectedDevice()?.online ? 1000 : Math.min(state.reconnectDelay * 2, 15000); if (!getSelectedDevice()?.online) scheduleReconnect(); }, delay); }
async function pollSelectedDeviceStatus() { const device = getSelectedDevice(); if (!device) return; try { const data = await espRequest(device, "/api/status"); applyStatus(device, data); state.reconnectDelay = 1000; } catch (_) { markOffline(device); } }

async function handleDoorAction(action) { if (state.commandPending) return; const device = getSelectedDevice(); if (!device || !device.online) { showToast("ESP8266 non connecté : reliez cet appareil au Wi-Fi SAMS puis réessayez."); return; } state.commandPending = true; document.querySelectorAll("button[data-action='open'], button[data-action='close']").forEach((button) => button.disabled = true); try { const result = await espRequest(device, action === "open" ? "/api/open" : "/api/close", { method: "POST", authorized: true }); applyStatus(device, result.status); addHistory(action); showToast(`Commande ${action === "open" ? "d’ouverture" : "de fermeture"} exécutée par l’ESP8266.`); } catch (error) { showToast(`Commande refusée : ${error.message}`); if (error.name === "AbortError" || /fetch/i.test(error.message)) markOffline(device); } finally { state.commandPending = false; document.querySelectorAll("button[data-action='open'], button[data-action='close']").forEach((button) => button.disabled = false); } }

async function connectDevice(host = DEFAULT_ESP_HOST, apiKey = "123456", name = "SAMS Portail") {
  const normalHost = normaliseHost(host) || DEFAULT_ESP_HOST;
  // Enforce single-device session: clear any existing devices before connecting
  state.devices = [];
  const device = { id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`, name, host: normalHost, apiKey, online: false };
  state.devices.push(device);
  state.selectedDeviceId = device.id;
  renderAllDevices();
  await pollSelectedDeviceStatus();
  if (device.online) {
    try { localStorage.setItem("sams-esp-device", JSON.stringify({ host: device.host, apiKey: device.apiKey, name: device.name })); } catch (_) {}
    try { sessionStorage.setItem("sams-session-device", JSON.stringify({ host: device.host, ts: Date.now() })); } catch (_) {}
    showToast("ESP8266 détecté : connexion locale établie.");
    return true;
  }
  showToast("ESP8266 non trouvé. Vérifiez la connexion au Wi-Fi SAMS et l’adresse 192.168.4.1.");
  return false;
}
function removeDevice(id) { state.devices = state.devices.filter((device) => device.id !== id); if (state.selectedDeviceId === id) state.selectedDeviceId = state.devices[0]?.id || null; try { localStorage.removeItem("sams-esp-device"); } catch (_) {} renderAllDevices(); }

function showPage(pageId) { document.querySelectorAll(".content-page").forEach((page) => page.classList.toggle("active", page.id === pageId)); document.querySelectorAll(".nav-item, .mobile-nav-item").forEach((item) => item.classList.toggle("active", item.dataset.page === pageId.replace("Page", ""))); }
function renderUserProfile() { const name = state.user?.name || "Utilisateur"; const role = state.role === "administrator" ? "Administrateur" : "Utilisateur simple"; setText("profileName", name); setText("profileInitial", name.charAt(0)); setText("navUserRole", role); setText("topbarSubtitle", "Contrôle local ESP8266"); document.getElementById("usersMenuItem").style.display = state.role === "administrator" ? "block" : "none"; document.getElementById("mobileUsersMenuItem").style.display = state.role === "administrator" ? "flex" : "none"; }
function handleLogin(event) { event.preventDefault(); const username = elements.loginUsername.value.trim().toLowerCase(); const password = elements.loginPassword.value.trim(); const user = state.users.find((item) => (item.email === username || item.email.split("@")[0] === username) && item.password === password); if (!user) { showToast("Identifiants invalides."); return; } state.user = user; state.role = user.role; try { sessionStorage.setItem("sams-session", JSON.stringify({ userId: user.id, ts: Date.now() })); } catch (_) {} elements.loginScreen.classList.add("hidden"); elements.loginScreen.classList.remove("active"); elements.appShell.classList.remove("hidden"); renderUserProfile(); showPage("dashboardPage"); }

function destroySession() {
  // Clear user and device session data and stop background tasks
  state.user = null;
  state.role = null;
  state.devices = [];
  state.selectedDeviceId = null;
  try { localStorage.removeItem("sams-esp-device"); } catch (_) {}
  try { sessionStorage.removeItem("sams-session"); sessionStorage.removeItem("sams-session-device"); } catch (_) {}
  if (state.pollingTimer) { clearInterval(state.pollingTimer); state.pollingTimer = null; }
  if (state.reconnectTimer) { clearTimeout(state.reconnectTimer); state.reconnectTimer = null; }
  // Reset UI to login
  elements.appShell.classList.add("hidden");
  elements.loginScreen.classList.remove("hidden");
  elements.loginScreen.classList.add("active");
  renderStatus(); renderAllDevices(); renderUsers();
  showToast("Session détruite. Veuillez vous reconnecter.");
}

function initEventListeners() {
  elements.loginForm.addEventListener("submit", handleLogin);
  document.querySelectorAll(".nav-item, .mobile-nav-item").forEach((item) => item.addEventListener("click", () => showPage(`${item.dataset.page}Page`)));
  // Invert open/close mapping to match device behavior (bouton "Ouvrir" -> envoie "close" etc.)
  document.querySelectorAll("button[data-action]").forEach((button) => button.addEventListener("click", () => {
    let action = button.dataset.action;
    if (action === "open") action = "close";
    else if (action === "close") action = "open";
    if (action === "open" || action === "close") handleDoorAction(action);
    else if (action === "deny") { handleDoorAction("close"); elements.cameraModal.classList.remove("active"); }
  }));
  document.getElementById("viewCameraBtn").onclick = () => elements.cameraModal.classList.add("active");
  document.getElementById("closeCameraModal").onclick = () => elements.cameraModal.classList.remove("active");
  document.getElementById("refreshCamera").onclick = pollSelectedDeviceStatus;
  document.getElementById("themeToggle").onclick = () => document.documentElement.classList.toggle("dark-theme");
  // Allow quick logout/destroy session via double-click on profile chip (no UI change)
  const profileChip = document.querySelector('.profile-chip');
  if (profileChip) profileChip.addEventListener('dblclick', () => { destroySession(); });
  elements.addDeviceBtn.onclick = () => { elements.deviceModal.classList.add("active"); elements.modalDeviceApSsid.innerHTML = `<option value="${DEFAULT_ESP_HOST}">AP SAMS (192.168.4.1)</option>`; elements.modalDeviceName.value = "SAMS Portail"; elements.modalDeviceId.value = DEFAULT_ESP_HOST; elements.modalPairingCode.value = ""; };
  elements.closeDeviceModal.onclick = () => elements.deviceModal.classList.remove("active"); elements.scanApsBtn.onclick = () => showToast("Les navigateurs ne peuvent pas scanner le Wi-Fi. Connectez-vous au réseau SAMS puis utilisez l’adresse AP proposée.");
  elements.addDeviceForm.addEventListener("submit", async (event) => { event.preventDefault(); const ok = await connectDevice(elements.modalDeviceId.value || DEFAULT_ESP_HOST, elements.modalPairingCode.value || "123456", elements.modalDeviceName.value || "SAMS Portail"); if (ok) elements.deviceModal.classList.remove("active"); });
  elements.testConnectionBtn.onclick = pollSelectedDeviceStatus;
  elements.connectDeviceBtn.onclick = (event) => { event.preventDefault(); connectDevice(elements.configDeviceLocalIp.value || DEFAULT_ESP_HOST, elements.deviceFormPairingCode.value || getSelectedDevice()?.apiKey || "123456", elements.deviceFormName.value || "SAMS Portail"); };
  elements.removeDeviceBtn.onclick = () => { if (state.selectedDeviceId) { removeDevice(state.selectedDeviceId); showToast("Appareil retiré de cette interface."); } };
  elements.restartDeviceBtn.onclick = async () => { const device = getSelectedDevice(); if (!device?.online) return showToast("ESP8266 non connecté."); try { await espRequest(device, "/api/restart", { method: "POST", authorized: true }); markOffline(device); showToast("Redémarrage demandé à l’ESP8266."); } catch (error) { showToast(error.message); } };
  elements.saveDeviceConfigBtn.onclick = async () => { const device = getSelectedDevice(); if (!device?.online) return showToast("Connectez d’abord l’ESP8266."); try { const status = await espRequest(device, "/api/config", { method: "POST", authorized: true, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ gateAutoClose: elements.configGateAutoClose.value, ultrasonicDistance: elements.configUltrasonicDistance.value, notificationsEnabled: elements.configNotificationsEnabled.value === "true", ssid: elements.configWifiSsid.value.trim(), password: elements.configWifiPassword.value }) }); applyStatus(device, status.status); showToast("Configuration appliquée par l’ESP8266."); } catch (error) { showToast(error.message); } };
}

function init() {
  renderStatus(); renderRadar();
  // Restore notifications from session if present
  try {
    const stored = sessionStorage.getItem("sams-notifications");
    if (stored) state.notifications = JSON.parse(stored);
  } catch (_) {}
  renderNotifications(); renderHistory(); renderUsers(); renderAllDevices(); initEventListeners();
  // Restore session (user) if present
  try {
    const sess = sessionStorage.getItem("sams-session");
    if (sess) {
      const parsed = JSON.parse(sess);
      const user = state.users.find((u) => u.id === parsed.userId);
      if (user) { state.user = user; state.role = user.role; elements.loginScreen.classList.add("hidden"); elements.loginScreen.classList.remove("active"); elements.appShell.classList.remove("hidden"); renderUserProfile(); showPage("dashboardPage"); }
    }
  } catch (_) {}
  // Restore device from session or localStorage (single-session behavior)
  try {
    const devSess = sessionStorage.getItem("sams-session-device");
    if (devSess) {
      const parsed = JSON.parse(devSess);
      connectDevice(parsed.host);
    } else {
      const saved = localStorage.getItem("sams-esp-device");
      if (saved) { const device = JSON.parse(saved); connectDevice(device.host, device.apiKey, device.name); } else connectDevice(DEFAULT_ESP_HOST);
    }
  } catch (_) { connectDevice(DEFAULT_ESP_HOST); }
  if (!state.pollingTimer) state.pollingTimer = window.setInterval(pollSelectedDeviceStatus, STATUS_INTERVAL_MS);
  window.addEventListener("online", pollSelectedDeviceStatus);
}
init();
