if (!window.ldJsonViewerInjected) {
  window.ldJsonViewerInjected = true;

  function getSchemas() {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    const schemas = [];
    scripts.forEach((script, index) => {
      try {
        schemas.push({
          index: index + 1,
          content: JSON.parse(script.innerText)
        });
      } catch (e) {
        schemas.push({
          index: index + 1,
          error: "Parse error: " + e.message,
          raw: script.innerText
        });
      }
    });
    return schemas;
  }

  // Update badge on page load
  const schemas = getSchemas();
  chrome.runtime.sendMessage({ action: 'updateBadge', count: schemas.length }).catch(() => {});

  // Listen for requests from popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getSchemas') {
      sendResponse({ schemas: getSchemas() });
    }
  });
}
