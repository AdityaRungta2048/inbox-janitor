// Minimal service worker: open the side panel on toolbar click.
// Auth and Graph calls are handled in the side panel directly.

chrome.runtime.onInstalled.addListener(() => {
  // Set default side panel behavior
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {
    // setPanelBehavior may not exist in all Chrome versions — ignore
  });
});

// Keep alive hack: respond to keepalive pings from the side panel
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && typeof msg === 'object' && (msg as { type?: string }).type === 'KEEPALIVE') {
    sendResponse({ alive: true });
  }
  return false;
});

export {};
