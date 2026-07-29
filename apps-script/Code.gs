/**
 * Blueprint — Process Catalogue: Google Sheets + Apps Script backend.
 *
 * Bound directly to a spreadsheet (attach via that Sheet's Extensions >
 * Apps Script menu, not as a standalone script). Serves a single-page web
 * app (Index.html) with role-scoped views for L1, L2, L3, L4 and Admin,
 * backed entirely by three sheets this script manages: Users, Processes,
 * AuditLog.
 *
 * See apps-script/README.md for the one-time setup and deployment steps.
 */

var SHEET_USERS = 'Users';
var SHEET_PROCESSES = 'Processes';
var SHEET_AUDIT = 'AuditLog';

var USERS_HEADERS = ['Username', 'Name', 'Email', 'Level', 'SubFunction', 'PasswordHash', 'Salt', 'Active', 'CreatedAt', 'LastLogin'];
var PROCESSES_HEADERS = ['Id', 'Title', 'Description', 'SubFunction', 'OwnerUsername', 'OwnerName', 'OwnerEmail', 'OwnerLevel', 'Status', 'LastUpdated', 'CompletenessScore', 'EffortRating', 'RepetitivenessRating', 'VolumeRating', 'ErrorSensitivityRating', 'AutomationSuitability', 'Category', 'IsCandidateForAI', 'ProblemStatement', 'AIOpportunity', 'StepsAgenticCount', 'StepsAutomationCount', 'StepsHumanCount', 'Gaps', 'IsShared'];
var AUDIT_HEADERS = ['Timestamp', 'Username', 'Action', 'Details'];

var LEVELS = ['L1', 'L2', 'L3', 'L4', 'Admin'];
var TOKEN_TTL_MINUTES = 480; // 8 hours
var HASH_ITERATIONS = 2000;

/* =========================== Web app entry =========================== */

function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Blueprint — Process Catalogue')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/* ============================ Sheet plumbing =========================== */

/** Uses the spreadsheet this script is bound to — no hardcoded ID needed. */
function ss_() {
  var active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active) throw new Error('This script must be attached to a spreadsheet (Extensions > Apps Script from within the Sheet).');
  return active;
}

function getOrCreateSheet_(name, headers) {
  var ss = ss_();
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  var firstRow = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  var hasHeaders = headers.every(function (h, i) { return firstRow[i] === h; });
  if (!hasHeaders) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  }
  return sheet;
}

function usersSheet_() { return getOrCreateSheet_(SHEET_USERS, USERS_HEADERS); }
function processesSheet_() { return getOrCreateSheet_(SHEET_PROCESSES, PROCESSES_HEADERS); }
function auditSheet_() { return getOrCreateSheet_(SHEET_AUDIT, AUDIT_HEADERS); }

/** Reads all data rows into objects keyed by header name. __row is the 1-based sheet row. */
function readAll_(sheet, headers) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  return values.map(function (row, idx) {
    var obj = {};
    headers.forEach(function (h, i) { obj[h] = row[i]; });
    obj.__row = idx + 2;
    return obj;
  });
}

function findByField_(sheet, headers, field, value) {
  var rows = readAll_(sheet, headers);
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][field]).toLowerCase() === String(value).toLowerCase()) return rows[i];
  }
  return null;
}

function appendRow_(sheet, headers, obj) {
  sheet.appendRow(headers.map(function (h) { return obj[h] !== undefined ? obj[h] : ''; }));
}

function updateRow_(sheet, headers, rowNumber, obj) {
  sheet.getRange(rowNumber, 1, 1, headers.length)
    .setValues([headers.map(function (h) { return obj[h] !== undefined ? obj[h] : ''; })]);
}

function isActive_(u) { return u.Active !== false && u.Active !== 'FALSE'; }

function logAudit_(username, action, details) {
  appendRow_(auditSheet_(), AUDIT_HEADERS, { Timestamp: new Date(), Username: username, Action: action, Details: details || '' });
}

function initializeSheets_() {
  usersSheet_();
  processesSheet_();
  auditSheet_();
  getSigningSecret_();
}

/* ============================== Passwords ============================== */

function bytesToHex_(bytes) {
  return bytes.map(function (b) {
    var v = (b < 0 ? b + 256 : b).toString(16);
    return v.length === 1 ? '0' + v : v;
  }).join('');
}

/** Deliberately slow (iterated SHA-256) so a leaked Users sheet isn't trivially crackable. */
function hashPassword_(password, salt) {
  var value = String(password) + ':' + salt;
  for (var i = 0; i < HASH_ITERATIONS; i++) {
    value = bytesToHex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value + salt));
  }
  return value;
}

function generateTempPassword_() {
  var chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'; // no 0/O/1/l/I
  var pwd = '';
  for (var i = 0; i < 10; i++) pwd += chars.charAt(Math.floor(Math.random() * chars.length));
  return pwd;
}

function generateUsername_(email) {
  var base = String(email).split('@')[0].toLowerCase().replace(/[^a-z0-9.]/g, '');
  var existing = readAll_(usersSheet_(), USERS_HEADERS).map(function (u) { return String(u.Username).toLowerCase(); });
  var candidate = base, n = 1;
  while (existing.indexOf(candidate) !== -1) { candidate = base + (++n); }
  return candidate;
}

function createUser_(name, email, level, subFunction) {
  if (LEVELS.indexOf(level) === -1) throw new Error('Level must be one of: ' + LEVELS.join(', '));
  var username = generateUsername_(email);
  var tempPassword = generateTempPassword_();
  var salt = Utilities.getUuid();
  appendRow_(usersSheet_(), USERS_HEADERS, {
    Username: username, Name: name, Email: email, Level: level, SubFunction: subFunction || 'All',
    PasswordHash: hashPassword_(tempPassword, salt), Salt: salt,
    Active: true, CreatedAt: new Date(), LastLogin: ''
  });
  logAudit_('SYSTEM', 'CREATE_USER', username + ' (' + level + ')');
  return { username: username, tempPassword: tempPassword };
}

function resetPassword_(username) {
  var sheet = usersSheet_();
  var user = findByField_(sheet, USERS_HEADERS, 'Username', username);
  if (!user) throw new Error('No user with that username.');
  var tempPassword = generateTempPassword_();
  var salt = Utilities.getUuid();
  user.Salt = salt;
  user.PasswordHash = hashPassword_(tempPassword, salt);
  updateRow_(sheet, USERS_HEADERS, user.__row, user);
  logAudit_('SYSTEM', 'RESET_PASSWORD', username);
  return tempPassword;
}

/* ============================ Session tokens ============================ */
/* Stateless signed tokens (HMAC-SHA256) — Apps Script web apps have no server
   session, so the client holds this like a JWT and sends it with every call. */

function getSigningSecret_() {
  var props = PropertiesService.getScriptProperties();
  var secret = props.getProperty('SIGNING_SECRET');
  if (!secret) {
    secret = Utilities.getUuid() + Utilities.getUuid();
    props.setProperty('SIGNING_SECRET', secret);
  }
  return secret;
}

function hmac_(text) {
  return bytesToHex_(Utilities.computeHmacSha256Signature(text, getSigningSecret_()));
}

function issueToken_(user) {
  var payload = { u: user.Username, n: user.Name, lvl: user.Level, sub: user.SubFunction, exp: Date.now() + TOKEN_TTL_MINUTES * 60 * 1000 };
  var payloadB64 = Utilities.base64EncodeWebSafe(JSON.stringify(payload));
  return payloadB64 + '.' + hmac_(payloadB64);
}

function verifyToken_(token) {
  if (!token || token.indexOf('.') === -1) throw new Error('Not signed in.');
  var parts = token.split('.');
  if (parts[1] !== hmac_(parts[0])) throw new Error('Invalid session, please sign in again.');
  var payload = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString());
  if (Date.now() > payload.exp) throw new Error('Session expired, please sign in again.');
  return payload;
}

function requireAuth_(token) { return verifyToken_(token); }
function requireAdmin_(token) {
  var payload = verifyToken_(token);
  if (payload.lvl !== 'Admin') throw new Error('Admin access required.');
  return payload;
}

/* ================================ Auth API =============================== */

function apiLogin(username, password) {
  username = String(username || '').trim();
  var sheet = usersSheet_();
  var user = findByField_(sheet, USERS_HEADERS, 'Username', username);
  var genericError = 'Incorrect username or password.';
  if (!user || !isActive_(user)) throw new Error(genericError);
  if (hashPassword_(password, user.Salt) !== user.PasswordHash) throw new Error(genericError);
  user.LastLogin = new Date();
  updateRow_(sheet, USERS_HEADERS, user.__row, user);
  logAudit_(username, 'LOGIN', '');
  return {
    token: issueToken_(user),
    user: { username: user.Username, name: user.Name, level: user.Level, subFunction: user.SubFunction }
  };
}

function apiChangePassword(token, oldPassword, newPassword) {
  var payload = requireAuth_(token);
  var sheet = usersSheet_();
  var user = findByField_(sheet, USERS_HEADERS, 'Username', payload.u);
  if (!user) throw new Error('User not found.');
  if (hashPassword_(oldPassword, user.Salt) !== user.PasswordHash) throw new Error('Current password is incorrect.');
  if (!newPassword || String(newPassword).length < 8) throw new Error('New password must be at least 8 characters.');
  var salt = Utilities.getUuid();
  user.Salt = salt;
  user.PasswordHash = hashPassword_(newPassword, salt);
  updateRow_(sheet, USERS_HEADERS, user.__row, user);
  logAudit_(payload.u, 'CHANGE_PASSWORD', '');
  return { ok: true };
}

/* ============================= Dashboard API ============================= */

function apiGetDashboard(token) {
  var payload = requireAuth_(token);
  var me = { username: payload.u, name: payload.n, level: payload.lvl, subFunction: payload.sub };
  switch (payload.lvl) {
    case 'Admin': return { me: me, view: 'admin', data: buildAdminDashboard_() };
    case 'L1':
    case 'L2': return { me: me, view: 'directorate', data: buildDirectorateDashboard_() };
    case 'L3': return { me: me, view: 'team', data: buildTeamDashboard_(payload) };
    case 'L4': return { me: me, view: 'personal', data: buildPersonalDashboard_(payload) };
    default: throw new Error('Unknown role: ' + payload.lvl);
  }
}

function buildDirectorateDashboard_() {
  var processes = readAll_(processesSheet_(), PROCESSES_HEADERS);
  var users = readAll_(usersSheet_(), USERS_HEADERS).filter(isActive_);

  var byStatus = {};
  var classificationMix = { agentic: 0, automation: 0, human: 0 };
  var bySubFunction = {};
  var ownerCounts = {};
  var contributors = {};

  processes.forEach(function (p) {
    byStatus[p.Status] = (byStatus[p.Status] || 0) + 1;
    classificationMix.agentic += Number(p.StepsAgenticCount) || 0;
    classificationMix.automation += Number(p.StepsAutomationCount) || 0;
    classificationMix.human += Number(p.StepsHumanCount) || 0;

    var sf = p.SubFunction || 'Unspecified';
    if (!bySubFunction[sf]) bySubFunction[sf] = { count: 0, completenessSum: 0 };
    bySubFunction[sf].count++;
    bySubFunction[sf].completenessSum += Number(p.CompletenessScore) || 0;

    var owner = p.OwnerName || p.OwnerUsername;
    ownerCounts[owner] = (ownerCounts[owner] || 0) + 1;
    contributors[p.OwnerUsername] = true;
  });

  var subFunctionSummary = Object.keys(bySubFunction).map(function (sf) {
    var d = bySubFunction[sf];
    return { subFunction: sf, count: d.count, avgCompleteness: Math.round(d.completenessSum / d.count) };
  }).sort(function (a, b) { return b.count - a.count; });

  var champions = Object.keys(ownerCounts).map(function (name) {
    return { name: name, processCount: ownerCounts[name] };
  }).sort(function (a, b) { return b.processCount - a.processCount; }).slice(0, 5);

  var topCandidates = processes
    .filter(function (p) { return p.AutomationSuitability !== '' && p.AutomationSuitability !== undefined; })
    .sort(function (a, b) { return (Number(b.AutomationSuitability) || 0) - (Number(a.AutomationSuitability) || 0); })
    .slice(0, 10)
    .map(function (p) { return { title: p.Title, owner: p.OwnerName, subFunction: p.SubFunction, suitability: Number(p.AutomationSuitability) || 0, status: p.Status }; });

  return {
    totalProcesses: processes.length,
    totalActiveUsers: users.length,
    submissionRatePercent: users.length ? Math.round((Object.keys(contributors).length / users.length) * 100) : 0,
    byStatus: byStatus,
    classificationMix: classificationMix,
    subFunctionSummary: subFunctionSummary,
    champions: champions,
    topCandidates: topCandidates
  };
}

function buildTeamDashboard_(payload) {
  var sub = payload.sub;
  var processes = readAll_(processesSheet_(), PROCESSES_HEADERS).filter(function (p) { return p.SubFunction === sub; });
  var teamUsers = readAll_(usersSheet_(), USERS_HEADERS).filter(function (u) { return u.SubFunction === sub && isActive_(u); });

  var countByOwner = {}, scoresByOwner = {};
  processes.forEach(function (p) {
    countByOwner[p.OwnerUsername] = (countByOwner[p.OwnerUsername] || 0) + 1;
    (scoresByOwner[p.OwnerUsername] = scoresByOwner[p.OwnerUsername] || []).push(Number(p.CompletenessScore) || 0);
  });

  var completionTracker = teamUsers.map(function (u) {
    var count = countByOwner[u.Username] || 0;
    var scores = scoresByOwner[u.Username] || [];
    var avg = scores.length ? Math.round(scores.reduce(function (a, b) { return a + b; }, 0) / scores.length) : 0;
    return { name: u.Name, username: u.Username, level: u.Level, processCount: count, avgCompleteness: avg, hasSubmitted: count > 0 };
  });

  var highEffortFlags = processes
    .filter(function (p) { return (Number(p.EffortRating) || 0) >= 4 || (Number(p.VolumeRating) || 0) >= 4; })
    .sort(function (a, b) { return (Number(b.EffortRating) || 0) - (Number(a.EffortRating) || 0); })
    .map(function (p) { return { title: p.Title, owner: p.OwnerName, effort: Number(p.EffortRating) || 0, volume: Number(p.VolumeRating) || 0, status: p.Status }; });

  var guidanceTracker = processes
    .filter(function (p) { return (Number(p.CompletenessScore) || 0) < 50; })
    .sort(function (a, b) { return (Number(a.CompletenessScore) || 0) - (Number(b.CompletenessScore) || 0); })
    .map(function (p) { return { title: p.Title, owner: p.OwnerName, completeness: Number(p.CompletenessScore) || 0, status: p.Status }; });

  return { subFunction: sub, completionTracker: completionTracker, highEffortFlags: highEffortFlags, guidanceTracker: guidanceTracker };
}

function buildPersonalDashboard_(payload) {
  var processes = readAll_(processesSheet_(), PROCESSES_HEADERS).filter(function (p) { return p.OwnerUsername === payload.u; });
  var mix = { agentic: 0, automation: 0, human: 0 };
  processes.forEach(function (p) {
    mix.agentic += Number(p.StepsAgenticCount) || 0;
    mix.automation += Number(p.StepsAutomationCount) || 0;
    mix.human += Number(p.StepsHumanCount) || 0;
  });
  var avgCompleteness = processes.length
    ? Math.round(processes.reduce(function (s, p) { return s + (Number(p.CompletenessScore) || 0); }, 0) / processes.length)
    : 0;
  return {
    processes: processes.map(function (p) {
      return { id: p.Id, title: p.Title, status: p.Status, completeness: Number(p.CompletenessScore) || 0, suitability: Number(p.AutomationSuitability) || 0, lastUpdated: p.LastUpdated, subFunction: p.SubFunction };
    }),
    summary: { count: processes.length, avgCompleteness: avgCompleteness, classificationMix: mix }
  };
}

function buildAdminDashboard_() {
  var users = readAll_(usersSheet_(), USERS_HEADERS).map(function (u) {
    return { username: u.Username, name: u.Name, email: u.Email, level: u.Level, subFunction: u.SubFunction, active: isActive_(u), lastLogin: u.LastLogin };
  });
  var processes = readAll_(processesSheet_(), PROCESSES_HEADERS);

  var byLevel = {};
  users.forEach(function (u) { byLevel[u.level] = (byLevel[u.level] || 0) + 1; });

  var dataQuality = processes.map(function (p) {
    var missing = [];
    if (!p.Description) missing.push('Description');
    if (!p.ProblemStatement) missing.push('ProblemStatement');
    if (!Number(p.CompletenessScore)) missing.push('CompletenessScore');
    return { id: p.Id, title: p.Title, owner: p.OwnerName, missing: missing };
  }).filter(function (p) { return p.missing.length > 0; });

  var bySF = {};
  processes.forEach(function (p) {
    var sf = p.SubFunction || 'Unspecified';
    if (!bySF[sf]) bySF[sf] = { total: 0, approved: 0 };
    bySF[sf].total++;
    if (p.Status === 'Approved') bySF[sf].approved++;
  });
  var readiness = Object.keys(bySF).map(function (sf) {
    var d = bySF[sf];
    return { subFunction: sf, total: d.total, approved: d.approved, readinessPercent: Math.round((d.approved / d.total) * 100) };
  });

  return { userCounts: byLevel, totalUsers: users.length, users: users, totalProcesses: processes.length, dataQuality: dataQuality, readiness: readiness };
}

/* ============================== Process API =============================== */

function clamp1to5_(v) { v = Number(v) || 1; return Math.min(5, Math.max(1, Math.round(v))); }

/**
 * High volume/repetitiveness/error-sensitivity favour automation; heavy manual
 * effort is a mild penalty since very effortful steps often hide exceptions a
 * simple bot can't handle. Deliberately simple — meant as a triage signal, not
 * a substitute for the app's AI-driven suitability score.
 */
function computeSuitability_(effort, repetitiveness, volume, errorSensitivity) {
  var raw = ((repetitiveness + volume + errorSensitivity) / 15) * 100 - (effort * 3);
  return Math.max(0, Math.min(100, Math.round(raw)));
}

function apiSubmitProcess(token, form) {
  var payload = requireAuth_(token);
  if (!form || !form.title || !form.subFunction) throw new Error('Title and sub-function are required.');
  var effort = clamp1to5_(form.effortRating);
  var repetitiveness = clamp1to5_(form.repetitivenessRating);
  var volume = clamp1to5_(form.volumeRating);
  var errorSensitivity = clamp1to5_(form.errorSensitivityRating);
  var suitability = computeSuitability_(effort, repetitiveness, volume, errorSensitivity);
  var user = findByField_(usersSheet_(), USERS_HEADERS, 'Username', payload.u);

  var record = {
    Id: Utilities.getUuid(),
    Title: form.title,
    Description: form.description || '',
    SubFunction: form.subFunction,
    OwnerUsername: payload.u,
    OwnerName: payload.n,
    OwnerEmail: user ? user.Email : '',
    OwnerLevel: payload.lvl,
    Status: form.status || 'Draft',
    LastUpdated: new Date(),
    CompletenessScore: Number(form.completenessScore) || 0,
    EffortRating: effort,
    RepetitivenessRating: repetitiveness,
    VolumeRating: volume,
    ErrorSensitivityRating: errorSensitivity,
    AutomationSuitability: suitability,
    Category: form.category || '',
    IsCandidateForAI: suitability >= 60,
    ProblemStatement: form.problemStatement || '',
    AIOpportunity: form.aiOpportunity || '',
    StepsAgenticCount: Number(form.stepsAgenticCount) || 0,
    StepsAutomationCount: Number(form.stepsAutomationCount) || 0,
    StepsHumanCount: Number(form.stepsHumanCount) || 0,
    Gaps: form.gaps || '',
    IsShared: !!form.isShared
  };
  appendRow_(processesSheet_(), PROCESSES_HEADERS, record);
  logAudit_(payload.u, 'SUBMIT_PROCESS', record.Id + ' - ' + record.Title);
  return { ok: true, id: record.Id, automationSuitability: suitability };
}

function apiUpdateProcess(token, id, patch) {
  var payload = requireAuth_(token);
  var sheet = processesSheet_();
  var record = findByField_(sheet, PROCESSES_HEADERS, 'Id', id);
  if (!record) throw new Error('Process not found.');
  if (record.OwnerUsername !== payload.u && payload.lvl !== 'Admin') throw new Error('You can only edit your own processes.');
  ['Title', 'Description', 'Status', 'Category', 'ProblemStatement', 'AIOpportunity', 'Gaps'].forEach(function (field) {
    if (patch[field] !== undefined) record[field] = patch[field];
  });
  record.LastUpdated = new Date();
  updateRow_(sheet, PROCESSES_HEADERS, record.__row, record);
  logAudit_(payload.u, 'UPDATE_PROCESS', id);
  return { ok: true };
}

function apiDeleteProcess(token, id) {
  var payload = requireAuth_(token);
  var sheet = processesSheet_();
  var record = findByField_(sheet, PROCESSES_HEADERS, 'Id', id);
  if (!record) throw new Error('Process not found.');
  if (record.OwnerUsername !== payload.u && payload.lvl !== 'Admin') throw new Error('You can only delete your own processes.');
  sheet.deleteRow(record.__row);
  logAudit_(payload.u, 'DELETE_PROCESS', id);
  return { ok: true };
}

/* =============================== Admin API ================================ */

function apiAdminCreateUser(token, form) {
  requireAdmin_(token);
  if (!form || !form.name || !form.email || !form.level) throw new Error('Name, email and level are required.');
  var level = String(form.level).toLowerCase() === 'admin' ? 'Admin' : String(form.level).toUpperCase();
  return createUser_(form.name, form.email, level, form.subFunction || 'All');
}

function apiAdminResetPassword(token, username) {
  requireAdmin_(token);
  return { tempPassword: resetPassword_(username) };
}

function apiAdminSetActive(token, username, active) {
  var payload = requireAdmin_(token);
  var sheet = usersSheet_();
  var user = findByField_(sheet, USERS_HEADERS, 'Username', username);
  if (!user) throw new Error('No user with that username.');
  user.Active = !!active;
  updateRow_(sheet, USERS_HEADERS, user.__row, user);
  logAudit_(payload.u, active ? 'ACTIVATE_USER' : 'DEACTIVATE_USER', username);
  return { ok: true };
}

function apiAdminExportCsv(token) {
  var payload = requireAdmin_(token);
  var range = processesSheet_().getDataRange().getValues();
  var csv = range.map(function (row) {
    return row.map(function (cell) {
      var s = cell instanceof Date ? cell.toISOString() : String(cell);
      if (s.indexOf(',') !== -1 || s.indexOf('"') !== -1 || s.indexOf('\n') !== -1) s = '"' + s.replace(/"/g, '""') + '"';
      return s;
    }).join(',');
  }).join('\n');
  logAudit_(payload.u, 'EXPORT_CSV', '');
  return csv;
}

/* ========================= Spreadsheet custom menu ========================= */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Blueprint Admin')
    .addItem('1. Initialize sheets', 'menuInitialize')
    .addSeparator()
    .addItem('Create user', 'menuCreateUser')
    .addItem('Reset user password', 'menuResetPassword')
    .addItem('Activate / deactivate user', 'menuToggleActive')
    .addSeparator()
    .addItem('Show web app URL', 'menuShowUrl')
    .addToUi();
}

function promptText_(ui, title) {
  var resp = ui.prompt(title, 'Leave blank to cancel.', ui.ButtonSet.OK_CANCEL);
  if (resp.getSelectedButton() !== ui.Button.OK) return null;
  var text = resp.getResponseText().trim();
  return text === '' ? null : text;
}

function menuInitialize() {
  initializeSheets_();
  SpreadsheetApp.getUi().alert('Blueprint sheets are ready: Users, Processes, AuditLog.');
}

function menuCreateUser() {
  var ui = SpreadsheetApp.getUi();
  var name = promptText_(ui, 'New user — full name (e.g. Siti Rahayu)');
  if (name === null) return;
  var email = promptText_(ui, 'New user — work email');
  if (email === null) return;
  var level = promptText_(ui, 'Level — one of: L1, L2, L3, L4, Admin');
  if (level === null) return;
  level = level.trim().toLowerCase() === 'admin' ? 'Admin' : level.trim().toUpperCase();
  if (LEVELS.indexOf(level) === -1) { ui.alert('Level must be one of: ' + LEVELS.join(', ')); return; }
  var subFunction = promptText_(ui, 'Sub-function / line of work (or "All" for L1/L2/Admin)');
  if (subFunction === null) return;
  try {
    var result = createUser_(name, email, level, subFunction);
    ui.alert('User created',
      'Username: ' + result.username + '\nTemporary password: ' + result.tempPassword +
      '\n\nShare these with ' + name + ' privately — this password will not be shown again. ' +
      'They can change it after logging in.', ui.ButtonSet.OK);
  } catch (e) {
    ui.alert('Error: ' + e.message);
  }
}

function menuResetPassword() {
  var ui = SpreadsheetApp.getUi();
  var username = promptText_(ui, 'Username to reset');
  if (!username) return;
  try {
    var tempPassword = resetPassword_(username);
    ui.alert('Password reset', 'New temporary password for ' + username + ': ' + tempPassword, ui.ButtonSet.OK);
  } catch (e) {
    ui.alert('Error: ' + e.message);
  }
}

function menuToggleActive() {
  var ui = SpreadsheetApp.getUi();
  var username = promptText_(ui, 'Username to activate/deactivate');
  if (!username) return;
  var sheet = usersSheet_();
  var user = findByField_(sheet, USERS_HEADERS, 'Username', username);
  if (!user) { ui.alert('No user with that username.'); return; }
  user.Active = !isActive_(user);
  updateRow_(sheet, USERS_HEADERS, user.__row, user);
  logAudit_('SYSTEM', user.Active ? 'ACTIVATE_USER' : 'DEACTIVATE_USER', username);
  ui.alert(username + ' is now ' + (user.Active ? 'ACTIVE' : 'DEACTIVATED') + '.');
}

function menuShowUrl() {
  var ui = SpreadsheetApp.getUi();
  var url;
  try { url = ScriptApp.getService().getUrl(); } catch (e) { url = null; }
  if (!url) {
    ui.alert('Not deployed yet', 'Deploy this project as a web app first (Deploy > New deployment > Web app), then run this again.', ui.ButtonSet.OK);
    return;
  }
  ui.alert('Blueprint web app URL', url, ui.ButtonSet.OK);
}
