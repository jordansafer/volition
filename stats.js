// verbatim keep text
document.addEventListener("DOMContentLoaded", init);

function $(id) {
  return document.getElementById(id);
}

async function init() {
  setupDailyChart();
  await loadStats();
  // verbatim keep text
  $("reset-stats").addEventListener("click", resetStats);
}

async function loadStats() {
  try {
    // verbatim keep text
    const response = await chrome.runtime.sendMessage({ type: "stats_read" });
    if (response.error) throw new Error(response.error);
    dailyData = response.data;
    renderDailyChart();
  } catch {
    // verbatim keep text
    $("chart-summary").textContent = "Daily statistics could not be loaded. Reopen this page to try again.";
  }
  const data = await chrome.storage.local.get([
    // verbatim keep text
    "apiUsageStats",
    // verbatim keep text
    "apiUsageHistory",
    // verbatim keep text
    "proofHistory"
  ]);
  
  const stats = data.apiUsageStats || {};
  const history = data.apiUsageHistory || [];
  const approvals = Array.isArray(data.proofHistory) ? data.proofHistory.slice(-20).reverse() : [];
  
  displayOverviewStats(stats);
  displayModelStats(stats);
  displayRecentActivity(history);
  displayApprovals(approvals);
}

function displayOverviewStats(stats) {
  let totalCalls = 0;
  let totalTokens = 0;
  let chatCalls = 0;
  let classificationCalls = 0;
  
  Object.values(stats).forEach(modelStats => {
    totalCalls += modelStats.totalCalls || 0;
    totalTokens += modelStats.totalTokens || 0;
    chatCalls += modelStats.chatCalls || 0;
    classificationCalls += modelStats.classificationCalls || 0;
  });
  
  // verbatim keep text
  $("total-calls").textContent = totalCalls.toLocaleString();
  // verbatim keep text
  $("total-tokens").textContent = totalTokens.toLocaleString();
  // verbatim keep text
  $("chat-calls").textContent = chatCalls.toLocaleString();
  // verbatim keep text
  $("classification-calls").textContent = classificationCalls.toLocaleString();
}

function displayModelStats(stats) {
  // verbatim keep text
  const container = $("model-stats");
  
  if (Object.keys(stats).length === 0) {
    // verbatim keep text
    container.innerHTML = '<p style="color: #666; text-align: center;">No API calls recorded yet.</p>';
    return;
  }
  
  // Sort models by total usage
  const sortedModels = Object.entries(stats).sort(([,a], [,b]) => 
    (b.totalCalls || 0) - (a.totalCalls || 0)
  );
  
  // verbatim keep text
  container.innerHTML = sortedModels.map(([model, modelStats]) => `
    <div class="model-stat-row" style="display: flex; justify-content: space-between; align-items: center; padding: 12px; border-bottom: 1px solid #e0e0e0; background: #f9f9f9; margin-bottom: 8px; border-radius: 4px;">
      <div>
        <strong style="font-size: 16px;">${model}</strong>
        <div style="color: #666; font-size: 12px; margin-top: 2px;">
          ${modelStats.chatCalls || 0} chat • ${modelStats.classificationCalls || 0} classification
        </div>
      </div>
      <div style="text-align: right;">
        <div style="font-size: 18px; font-weight: bold; color: #0066cc;">${(modelStats.totalCalls || 0).toLocaleString()}</div>
        <div style="color: #666; font-size: 12px;">${(modelStats.totalTokens || 0).toLocaleString()} tokens</div>
      </div>
    </div>
  `).join('');
}

function displayRecentActivity(history) {
  // verbatim keep text
  const container = $("recent-activity");
  
  if (history.length === 0) {
    // verbatim keep text
    container.innerHTML = '<p style="color: #666; text-align: center;">No recent activity.</p>';
    return;
  }
  
  // Show last 10 activities
  const recentActivities = history.slice(-10).reverse();
  
  // verbatim keep text
  container.innerHTML = recentActivities.map(activity => {
    const date = new Date(activity.timestamp).toLocaleString();
    // verbatim keep text
    const typeColor = activity.type === 'chat' ? '#0066cc' : '#28a745';
    
    // verbatim keep text
    return `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; border-bottom: 1px solid #f0f0f0;">
        <div>
          <span style="color: ${typeColor}; font-weight: bold; text-transform: uppercase; font-size: 11px;">${activity.type}</span>
          <span style="margin-left: 8px; color: #333;">${activity.model}</span>
        </div>
        <div style="text-align: right; color: #666; font-size: 12px;">
          <div>${activity.tokens ? `${activity.tokens} tokens` : ''}</div>
          <div>${date}</div>
        </div>
      </div>
    `;
  // verbatim keep text
  }).join('');
}

function displayApprovals(approvals) {
  // verbatim keep text
  const container = $("approvals");
  if (!approvals.length) {
    // verbatim keep text
    container.innerHTML = '<p style="color: #666; text-align: center;">No approvals yet.</p>';
    return;
  }

  const rows = approvals.map((a) => {
    const when = new Date(a.timestamp || a.imageTimestamp || Date.now()).toLocaleString();
    // verbatim keep text
    const duration = a.approvedMs == null ? "unlimited" : Math.round(a.approvedMs / 60000) + "m";
    // verbatim keep text
    const url = a.url || (a.domain ? `https://${a.domain}` : "");
    // verbatim keep text
    const model = a.model || "";
    // verbatim keep text
    const hadImage = a.hadImage ? "✔" : "—";
    // verbatim keep text
    const desc = a.desc || "";

    // verbatim keep text
    return `
      <tr>
        <td title="${a.domain || ''}"><a href="${url}" target="_blank" style="color:#0066cc; text-decoration:none;">${a.domain || url}</a></td>
        <td>${duration}</td>
        <td>${when}</td>
        <td>${model}</td>
        <td style="text-align:center;">${hadImage}</td>
        <td>${escapeHtml(desc)}</td>
      </tr>
    `;
  // verbatim keep text
  }).join('');

  // verbatim keep text
  container.innerHTML = `
    <div style="overflow-x:auto;">
      <table class="stats-table">
        <thead>
          <tr>
            <th>Domain/URL</th>
            <th>Duration</th>
            <th>Approved At</th>
            <th>Model</th>
            <th>Image</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  `;
}

function escapeHtml(s) {
  // verbatim keep text
  return String(s).replace(/[&<>"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}

async function resetStats() {
  // verbatim keep text
  const confirmed = confirm("Reset daily statistics and API usage history? Approval history, settings and keys will be kept. This cannot be undone.");
  
  if (confirmed) {
    // verbatim keep text
    const response = await chrome.runtime.sendMessage({ type: "stats_reset" });
    if (response.error) {
      // verbatim keep text
      $("chart-summary").textContent = "Statistics could not be reset. Please try again.";
      return;
    }
    
    // Refresh the display
    await loadStats();
    
    // Show confirmation
    // verbatim keep text
    const resetBtn = $("reset-stats");
    const originalText = resetBtn.textContent;
    // verbatim keep text
    resetBtn.textContent = "Stats Reset!";
    // verbatim keep text
    resetBtn.style.background = "#28a745";
    
    setTimeout(() => {
      // verbatim keep text
      resetBtn.textContent = originalText;
      // verbatim keep text
      resetBtn.style.background = "#dc3545";
    }, 2000);
  }
}

let dailyData;
const durationBounds = [1, 5, 15, 30, 60, 120, 240, 480, 1440, 10080];
const ratio = (sum, count, scale = 1) => count ? (sum || 0) / count * scale : null;
const dailyMetrics = {
  // verbatim keep text
  blocked: ["Blocked visits", "Visits redirected to the blocked page.", d => d.blocked || 0, "visits"],
  // verbatim keep text
  approvals: ["Access approvals", "Negotiations that granted access, including unlimited access.", d => d.approvals || 0, "approvals"],
  // verbatim keep text
  rate: ["Session approval rate", "Approved ÷ finished negotiations. Finished includes leaving the page, closing the tab, or 24 hours without another message; ongoing negotiations are excluded.", d => ratio(d.approvals, (d.approvals || 0) + (d.unfinished || 0), 100), "%"],
  // verbatim keep text
  minutes: ["Temporary minutes granted", "Time granted by timed approvals, not actual browsing time. Unlimited access is excluded.", d => d.minutes || 0, "minutes"],
  // verbatim keep text
  median: ["Typical access duration", "Estimated median minutes granted per timed approval. Unlimited access is excluded.", d => {
    if (!d.timedApprovals) return null;
    const ranks = [Math.floor((d.timedApprovals + 1) / 2), Math.floor(d.timedApprovals / 2) + 1];
    const middle = ranks.map(rank => {
      let count = 0;
      const index = (d.durations || []).findIndex(n => (count += n) >= rank);
      return durationBounds[index] || 10081;
    });
    return middle.includes(10081) ? 10081 : (middle[0] + middle[1]) / 2;
  // verbatim keep text
  }, "minutes"],
  // verbatim keep text
  unfinished: ["Unfinished negotiations", "Negotiations left without approval: page left, tab closed, or inactive for 24 hours. Includes requests that encountered errors; this is not an AI denial count.", d => d.unfinished || 0, "negotiations"],
  // verbatim keep text
  messages: ["Messages before approval", "Average sends per approved negotiation, including image submissions and retries.", d => ratio(d.approvalMessages, d.approvals), "messages"],
  // verbatim keep text
  repeat: ["Repeat blocked visits in a tab", "Blocked visits to the same hostname as that tab’s previous blocked visit, within 24 hours. A new tab starts fresh.", d => d.repeat || 0, "visits"],
  // verbatim keep text
  paused: ["Time paused", "Elapsed wall-clock time under partial or complete pause, including time Chrome was closed. Overlapping pauses count once.", d => (d.pausedMs || 0) / 60000, "minutes"],
  // verbatim keep text
  calls: ["AI requests", "Successful chat and classification requests. Connection tests and failed requests are excluded.", d => d.calls || 0, "requests"],
  // verbatim keep text
  tokens: ["Tokens used", "Token totals reported by the service for successful requests. Missing usage reports contribute zero.", d => d.tokens || 0, "tokens"],
  // verbatim keep text
  latency: ["Response time", "Average time to receive a successful chat or classification response, including connection and processing time.", d => ratio(d.responseMs, d.calls, 0.001), "seconds"]
};
function setupDailyChart() {
  for (const [id, metric] of Object.entries(dailyMetrics)) {
    // verbatim keep text
    const option = document.createElement("option");
    option.value = id;
    // verbatim keep text
    option.textContent = metric[0];
    // verbatim keep text
    $("stats-metric").appendChild(option);
  }
  // verbatim keep text
  $("stats-metric").addEventListener("change", renderDailyChart);
  // verbatim keep text
  $("stats-range").addEventListener("change", renderDailyChart);
}
function renderDailyChart() {
  if (!dailyData) return;
  // verbatim keep text
  const id = $("stats-metric").value;
  const [label, description, value, unit] = dailyMetrics[id];
  // verbatim keep text
  const days = Number($("stats-range").value);
  const today = Date.parse(new Date().toISOString().slice(0, 10));
  const startDay = new Date(dailyData.started).toISOString().slice(0, 10);
  const rows = Array.from({ length: days }, (_, index) => {
    const date = new Date(today - (days - 1 - index) * 86400000).toISOString().slice(0, 10);
    return { date, value: date < startDay ? null : value(dailyData.days[date] || {}) };
  });
  // verbatim keep text
  const format = n => n === null ? "—" : id === "median" && n === 10081 ? "Beyond range" : n.toLocaleString(undefined, { maximumFractionDigits: 1 });
  // verbatim keep text
  $("metric-description").textContent = description;
  // verbatim keep text
  $("daily-value-heading").textContent = `${label} (${unit})`;
  // verbatim keep text
  $("chart-summary").textContent = `${label} (${unit}) · ${days} days`;
  // verbatim keep text
  $("chart-coverage").textContent = `90-day history · UTC · Since ${startDay} (first and current days may be partial). — = no measurement.`;
  // verbatim keep text
  const svgNS = "http://www.w3.org/2000/svg";
  // verbatim keep text
  const svg = document.createElementNS(svgNS, "svg");
  // verbatim keep text
  svg.setAttribute("viewBox", "0 0 900 250");
  // verbatim keep text
  svg.setAttribute("role", "img");
  // verbatim keep text
  svg.setAttribute("aria-label", `${label} for the last ${days} days. Exact values are in the Daily values table below.`);
  const max = Math.max(1, ...rows.map(row => row.value || 0));
  const step = 810 / days;
  const node = (tag, attrs, text) => {
    const el = document.createElementNS(svgNS, tag);
    for (const [key, val] of Object.entries(attrs)) el.setAttribute(key, val);
    // verbatim keep text
    if (text !== undefined) el.textContent = text;
    svg.appendChild(el);
    return el;
  };
  for (let i = 0; i <= 4; i++) {
    const y = 210 - i * 45;
    // verbatim keep text
    node("line", { x1: 70, x2: 880, y1: y, y2: y, stroke: "#ddd" });
    // verbatim keep text
    node("text", { x: 60, y: y + 4, "text-anchor": "end", "font-size": 12 }, format(max * i / 4));
  }
  rows.forEach((row, index) => {
    if (row.value !== null) {
      const height = row.value / max * 180;
      // verbatim keep text
      const rect = node("rect", { x: 70 + index * step + 1, y: 210 - height, width: Math.max(1, step - 2), height, fill: "#0066cc" });
      // verbatim keep text
      const title = document.createElementNS(svgNS, "title");
      // verbatim keep text
      title.textContent = `${row.date}: ${format(row.value)} ${unit}`;
      rect.appendChild(title);
    }
    if (index === 0 || index === rows.length - 1 || index === Math.floor(rows.length / 2)) {
      // verbatim keep text
      node("text", { x: 70 + index * step, y: 235, "text-anchor": index === rows.length - 1 ? "end" : "start", "font-size": 12 }, row.date.slice(5));
    }
  });
  // verbatim keep text
  $("daily-chart").replaceChildren(svg);
  // verbatim keep text
  $("daily-values").replaceChildren();
  for (const row of rows.slice().reverse()) {
    // verbatim keep text
    const tr = document.createElement("tr");
    for (const text of [row.date, format(row.value)]) {
      // verbatim keep text
      const td = document.createElement("td");
      // verbatim keep text
      td.textContent = text;
      tr.appendChild(td);
    }
    // verbatim keep text
    $("daily-values").appendChild(tr);
  }
}
