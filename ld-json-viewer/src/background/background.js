chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'updateBadge' && sender.tab) {
    const count = message.count;
    const text = count > 0 ? count.toString() : '';
    
    chrome.action.setBadgeText({
      text: text,
      tabId: sender.tab.id
    });
    
    chrome.action.setBadgeBackgroundColor({
      color: '#6366f1',
      tabId: sender.tab.id
    });
  }
});
