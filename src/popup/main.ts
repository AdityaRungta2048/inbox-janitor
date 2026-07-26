document.getElementById('open-btn')?.addEventListener('click', () => {
  // Open the side panel for the current tab
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tabId = tabs[0]?.id;
    if (tabId !== undefined) {
      void chrome.sidePanel.open({ tabId });
    }
    window.close();
  });
});
