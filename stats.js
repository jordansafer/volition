document.addEventListener("DOMContentLoaded", init);

function $(id) {
  return document.getElementById(id);
}

async function init() {
  await loadStats();
  $("reset-stats").addEventListener("click", resetStats);
}

async function loadStats() {
  const data = await chrome.storage.local.get([
    "apiUsageStats",
    "apiUsageHistory"
  ]);
  
  const stats = data.apiUsageStats || {};
  const history = data.apiUsageHistory || [];
  
  displayOverviewStats(stats);
  displayModelStats(stats);
  displayRecentActivity(history);
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
  
  $("total-calls").textContent = totalCalls.toLocaleString();
  $("total-tokens").textContent = totalTokens.toLocaleString();
  $("chat-calls").textContent = chatCalls.toLocaleString();
  $("classification-calls").textContent = classificationCalls.toLocaleString();
}

function displayModelStats(stats) {
  const container = $("model-stats");
  
  if (Object.keys(stats).length === 0) {
    container.innerHTML = '<p style="color: #666; text-align: center;">No API calls recorded yet.</p>';
    return;
  }
  
  // Sort models by total usage
  const sortedModels = Object.entries(stats).sort(([,a], [,b]) => 
    (b.totalCalls || 0) - (a.totalCalls || 0)
  );
  
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
  const container = $("recent-activity");
  
  if (history.length === 0) {
    container.innerHTML = '<p style="color: #666; text-align: center;">No recent activity.</p>';
    return;
  }
  
  // Show last 10 activities
  const recentActivities = history.slice(-10).reverse();
  
  container.innerHTML = recentActivities.map(activity => {
    const date = new Date(activity.timestamp).toLocaleString();
    const typeColor = activity.type === 'chat' ? '#0066cc' : '#28a745';
    
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
  }).join('');
}

async function resetStats() {
  const confirmed = confirm("Are you sure you want to reset all usage statistics? This cannot be undone.");
  
  if (confirmed) {
    await chrome.storage.local.set({
      apiUsageStats: {},
      apiUsageHistory: []
    });
    
    // Refresh the display
    await loadStats();
    
    // Show confirmation
    const resetBtn = $("reset-stats");
    const originalText = resetBtn.textContent;
    resetBtn.textContent = "Stats Reset!";
    resetBtn.style.background = "#28a745";
    
    setTimeout(() => {
      resetBtn.textContent = originalText;
      resetBtn.style.background = "#dc3545";
    }, 2000);
  }
} 