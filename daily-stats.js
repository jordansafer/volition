// Fixed-size daily counters. Only the service worker writes this state.
globalThis.VolitionStats = (() => {
  const DAY = 86400000;
  const RETENTION = 90;
  const MAX_TABS = 100;
  const DURATION_BOUNDS = [1, 5, 15, 30, 60, 120, 240, 480, 1440, 10080];
  let queue = Promise.resolve();
  const dayKey = time => new Date(time).toISOString().slice(0, 10);
  function serial(task) {
    const result = queue.then(task);
    queue = result.catch(() => {});
    return result;
  }
  function bucket(state, time) {
    const key = dayKey(time);
    return state.days[key] ||= {};
  }
  function add(row, key, amount = 1) {
    if (Number.isFinite(amount) && amount >= 0) row[key] = (row[key] || 0) + amount;
  }
  function finish(state, id, now) {
    const tab = state.tabs[id];
    // verbatim keep text
    if (tab?.messages) add(bucket(state, now), 'unfinished');
    if (tab) tab.messages = 0;
  }
  function settlePause(state, now, until) {
    const start = Math.max(state.pauseCursor || now, Date.parse(dayKey(now - (RETENTION - 1) * DAY)));
    const end = Math.min(now, until || 0);
    for (let t = start; t < end;) {
      const next = Math.min(end, Date.parse(dayKey(t)) + DAY);
      // verbatim keep text
      add(bucket(state, t), 'pausedMs', next - t);
      t = next;
    }
    state.pauseCursor = now;
  }
  async function update(change = () => {}, skip = () => false) {
    return serial(async () => {
      // verbatim keep text
      const data = await chrome.storage.local.get(['dailyStatistics', 'pauseUntil']);
      const now = Date.now();
      const state = data.dailyStatistics || { version: 1, started: now, days: {}, tabs: {}, pauseCursor: now };
      if (skip(state)) return state;
      const cutoff = dayKey(now - (RETENTION - 1) * DAY);
      for (const key of Object.keys(state.days)) if (key < cutoff || key > dayKey(now)) delete state.days[key];
      for (const [id, tab] of Object.entries(state.tabs)) {
        if (now - tab.updated >= DAY) {
          // Attribute timeout to its deadline, not the next time Chrome wakes up.
          const deadline = tab.updated + DAY;
          if (dayKey(deadline) >= cutoff) finish(state, id, deadline);
          delete state.tabs[id];
        }
      }
      settlePause(state, now, data.pauseUntil);
      await change(state, now);
      await chrome.storage.local.set({ dailyStatistics: state });
      return state;
    });
  }
  function tabState(state, id, now) {
    if (id == null) return null;
    if (!state.tabs[id]) {
      const ids = Object.keys(state.tabs);
      if (ids.length >= MAX_TABS) {
        // Bound bookkeeping even with pathological tab counts; never invent an outcome.
        const oldest = ids.sort((a, b) => state.tabs[a].updated - state.tabs[b].updated)[0];
        delete state.tabs[oldest];
      }
      state.tabs[id] = { updated: now, messages: 0 };
    }
    state.tabs[id].updated = now;
    return state.tabs[id];
  }
  return {
    RETENTION, DURATION_BOUNDS, dayKey,
    read: () => update(),
    block: (id, domain) => update((state, now) => {
      const tab = tabState(state, id, now);
      const row = bucket(state, now);
      // verbatim keep text
      add(row, 'blocked');
      // verbatim keep text
      if (tab?.domain === domain && now - tab.blockedAt < DAY) add(row, 'repeat');
      if (tab) { finish(state, id, now); tab.domain = domain.slice(0, 253); tab.blockedAt = now; }
    }),
    message: (id, session) => update((state, now) => {
      const tab = tabState(state, id, now);
      if (tab) {
        if (tab.session !== session) finish(state, id, now);
        // verbatim keep text
        tab.session = String(session || "").slice(0, 64);
        tab.messages++;
      }
    }),
    leave: (id, remove = false) => update((state, now) => {
      finish(state, id, now);
      if (remove) delete state.tabs[id];
    }, state => !state.tabs[id]),
    approve: (id, expiresAt) => update((state, now) => {
      const tab = state.tabs[id];
      if (!tab?.messages) return; // Only negotiated grants, once per conversation.
      const row = bucket(state, now);
      // verbatim keep text
      add(row, 'approvals');
      // verbatim keep text
      add(row, 'approvalMessages', tab.messages);
      tab.messages = 0;
      if (Number.isFinite(expiresAt)) {
        const minutes = Math.max(0, (expiresAt - now) / 60000);
        // verbatim keep text
        add(row, 'minutes', minutes);
        // verbatim keep text
        add(row, 'timedApprovals');
        row.durations ||= Array(DURATION_BOUNDS.length + 1).fill(0);
        const index = DURATION_BOUNDS.findIndex(limit => minutes <= limit);
        row.durations[index < 0 ? DURATION_BOUNDS.length : index]++;
      }
    }),
    api: (tokens, elapsed, type, legacyUpdate) => update(async (state, now) => {
      const row = bucket(state, now);
      // verbatim keep text
      add(row, 'calls');
      // verbatim keep text
      add(row, type === 'classification' ? 'classificationCalls' : 'chatCalls');
      // verbatim keep text
      add(row, 'tokens', tokens);
      // verbatim keep text
      add(row, 'responseMs', elapsed);
      if (legacyUpdate) await legacyUpdate();
    }),
    pause: values => update(async (state, now) => {
      // update() accounts for the previous interval before changing its endpoint.
      if (values) await chrome.storage.local.set(values);
      // verbatim keep text
      else await chrome.storage.local.remove(['pauseUntil', 'pauseMode']);
      state.pauseCursor = now;
    }),
    reset: () => serial(async () => {
      const now = Date.now();
      await chrome.storage.local.set({
        dailyStatistics: { version: 1, started: now, days: {}, tabs: {}, pauseCursor: now },
        apiUsageStats: {}, apiUsageHistory: []
      });
    })
  };
})();
