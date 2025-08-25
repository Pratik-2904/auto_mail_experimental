document.addEventListener('DOMContentLoaded', () => {
  const extensionToggle = document.getElementById('extension-toggle');
  const statusText = document.getElementById('status-text');
  const toneButtons = document.querySelectorAll('.tone-btn');
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  const clearHistoryBtn = document.getElementById('clear-history');

  // Load initial state from storage and update the UI
  chrome.storage.local.get('state', (result) => {
    const state = result.state || { isEnabled: true, currentTone: 'Professional', replyHistory: [] };
    updateUI(state);
  });

  // Event Listeners
  extensionToggle.addEventListener('change', (e) => {
    updateState({ isEnabled: e.target.checked });
    // Tell content script to remove/add buttons
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'TOGGLE_EXTENSION', isEnabled: e.target.checked });
    });
  });

  toneButtons.forEach(btn => {
    btn.addEventListener('click', () => updateState({ currentTone: btn.dataset.tone }));
  });
  
  clearHistoryBtn.addEventListener('click', () => {
      if (confirm('Are you sure you want to clear all reply history?')) {
          updateState({ replyHistory: [] });
      }
  });

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Functions
  function updateState(newState) {
    chrome.storage.local.get('state', (result) => {
      const updatedState = { ...result.state, ...newState };
      chrome.storage.local.set({ state: updatedState }, () => {
        updateUI(updatedState); // Update UI immediately after state changes
      });
    });
  }

  function updateUI(state) {
    // Update toggle and status text
    extensionToggle.checked = state.isEnabled;
    statusText.textContent = state.isEnabled ? '✓ Extension is active' : '✗ Extension is disabled';
    statusText.style.color = state.isEnabled ? '#28a745' : '#dc3545';

    // Update tone buttons
    toneButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tone === state.currentTone);
    });
    
    // Refresh the current tab's content if it's visible
    const activeTab = document.querySelector('.tab-content.active').id;
    if (activeTab === 'history') loadHistory(state.replyHistory);
  }

  function switchTab(tabName) {
    tabContents.forEach(content => content.classList.remove('active'));
    tabButtons.forEach(button => button.classList.remove('active'));
    
    document.getElementById(tabName).classList.add('active');
    document.querySelector(`[data-tab='${tabName}']`).classList.add('active');

    if (tabName === 'history') {
      chrome.storage.local.get('state', (result) => loadHistory(result.state.replyHistory));
    } else if (tabName === 'stats') {
      loadStats();
    }
  }

  function loadHistory(replyHistory) {
    const historyContainer = document.getElementById('history-list');
    if (!replyHistory || replyHistory.length === 0) {
      historyContainer.innerHTML = '<div class="empty-state"><p>No reply history yet</p></div>';
      return;
    }
    historyContainer.innerHTML = replyHistory.map(item => `
      <div class="history-item">
        <div class="history-header"><div class="history-subject">${escapeHtml(item.subject)}</div></div>
        <div class="history-preview">${escapeHtml(item.generatedReply.substring(0, 150))}...</div>
        <div class="tone-badge">${item.tone}</div>
      </div>
    `).join('');
  }

  function loadStats() {
    const statsGrid = document.getElementById('stats-grid');
    statsGrid.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    
    chrome.runtime.sendMessage({ type: 'GET_STATS' }, (response) => {
      if (response && response.success) {
        statsGrid.innerHTML = `
          <div class="stat-item"><span class="stat-number">${response.stats.objectCount}</span><span class="stat-label">Total Replies</span></div>
          <div class="stat-item"><span class="stat-number">${formatBytes(response.stats.totalSizeInBytes)}</span><span class="stat-label">Total Log Size</span></div>
        `;
      } else {
        document.getElementById('stats-error').textContent = 'Could not load stats.';
      }
    });
  }
  
  function formatBytes(bytes, decimals = 2) {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  }

  function escapeHtml(unsafe) {
    return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
});