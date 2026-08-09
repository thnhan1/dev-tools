let globalSchemas = [];

document.addEventListener('DOMContentLoaded', async () => {
  const container = document.getElementById('container');
  const schemaCountBadge = document.getElementById('schemaCount');
  const copyAllBtn = document.getElementById('copyAllBtn');

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab) {
      showEmptyState("Cannot access active tab.");
      return;
    }

    if (tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:')) {
      showEmptyState("Extensions cannot run on browser internal pages.");
      return;
    }

    // Try sending message to existing content script
    chrome.tabs.sendMessage(tab.id, { action: 'getSchemas' }, (response) => {
      if (chrome.runtime.lastError || !response || !response.schemas) {
        // Fallback: Inject content script if not already injected
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["src/content/content.js"]
        }).then(() => {
          chrome.tabs.sendMessage(tab.id, { action: 'getSchemas' }, (res) => {
            handleSchemas(res?.schemas, container, schemaCountBadge, copyAllBtn);
          });
        }).catch(e => {
          showEmptyState("An error occurred: " + e.message);
        });
      } else {
        handleSchemas(response.schemas, container, schemaCountBadge, copyAllBtn);
      }
    });

  } catch (error) {
    showEmptyState("An error occurred: " + error.message);
  }

  copyAllBtn.addEventListener('click', () => {
    const rawData = globalSchemas.map(s => s.error ? s.raw : s.content);
    navigator.clipboard.writeText(JSON.stringify(rawData, null, 2)).then(() => {
      showToast("Copied all schemas to clipboard!");
    });
  });
});

function handleSchemas(schemas, container, badge, btn) {
  if (!schemas || schemas.length === 0) {
    showEmptyState("No LD+JSON schema found on this page.");
    return;
  }
  globalSchemas = schemas;
  badge.textContent = schemas.length;
  btn.disabled = false;
  renderSchemas(schemas, container);
}

function showEmptyState(message) {
  const container = document.getElementById('container');
  container.innerHTML = `
    <div class="empty-state">
      <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:16px; opacity:0.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
      <p>${message}</p>
    </div>
  `;
}

function renderSchemas(schemas, container) {
  container.innerHTML = '';
  
  schemas.forEach(schema => {
    const block = document.createElement('div');
    block.className = 'schema-block';
    
    const header = document.createElement('div');
    header.className = 'schema-header';
    
    let schemaType = "Unknown Type";
    if (schema.content && schema.content['@type']) {
      const t = schema.content['@type'];
      schemaType = Array.isArray(t) ? t.join(', ') : t;
    }

    // Header content with Copy button
    header.innerHTML = `
      <div style="display:flex; gap:8px; align-items:center;">
        <span>Schema #${schema.index}</span>
        <span class="schema-type">${schemaType}</span>
      </div>
    `;
    
    const actions = document.createElement('div');
    actions.className = 'schema-actions';
    
    const copyBtn = document.createElement('button');
    copyBtn.className = 'btn-icon';
    copyBtn.title = "Copy this schema";
    copyBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
    copyBtn.onclick = () => {
      const rawData = schema.error ? schema.raw : schema.content;
      navigator.clipboard.writeText(JSON.stringify(rawData, null, 2)).then(() => {
        showToast(`Copied Schema #${schema.index}!`);
      });
    };
    actions.appendChild(copyBtn);
    header.appendChild(actions);
    
    const body = document.createElement('div');
    body.className = 'schema-body';
    
    if (schema.error) {
      body.innerHTML = `<div style="color:#ef4444">${schema.error}</div><pre style="margin-top:8px; opacity:0.7">${escapeHtml(schema.raw)}</pre>`;
    } else {
      body.appendChild(createJsonTree(schema.content));
    }
    
    block.appendChild(header);
    block.appendChild(body);
    container.appendChild(block);
  });
}

function createJsonTree(data, isLast = true) {
  const wrapper = document.createElement('span');
  
  if (data === null) {
    wrapper.innerHTML = `<span class="json-null">null</span>${isLast ? '' : ','}`;
    return wrapper;
  }
  
  if (typeof data === 'boolean') {
    wrapper.innerHTML = `<span class="json-boolean">${data}</span>${isLast ? '' : ','}`;
    return wrapper;
  }
  
  if (typeof data === 'number') {
    wrapper.innerHTML = `<span class="json-number">${data}</span>${isLast ? '' : ','}`;
    return wrapper;
  }
  
  if (typeof data === 'string') {
    wrapper.innerHTML = `<span class="json-string">"${escapeHtml(data)}"</span>${isLast ? '' : ','}`;
    return wrapper;
  }
  
  const blockWrapper = document.createElement('div');
  blockWrapper.style.display = 'inline-block';
  blockWrapper.style.verticalAlign = 'top';
  
  if (Array.isArray(data)) {
    if (data.length === 0) {
      blockWrapper.innerHTML = `[]${isLast ? '' : ','}`;
      return blockWrapper;
    }
    
    const container = document.createElement('div');
    container.className = 'collapsible'; // Intentionally NO 'collapsed' class -> Expanded by default
    
    const bracketOpen = document.createElement('span');
    bracketOpen.innerHTML = `<span class="toggle-icon">▼</span>[`;
    
    const childrenContainer = document.createElement('div');
    childrenContainer.className = 'tree-children tree-node';
    
    data.forEach((item, index) => {
      const childLine = document.createElement('div');
      const child = createJsonTree(item, index === data.length - 1);
      childLine.appendChild(child);
      childrenContainer.appendChild(childLine);
    });
    
    const bracketClose = document.createElement('div');
    bracketClose.textContent = `]${isLast ? '' : ','}`;
    
    container.appendChild(bracketOpen);
    container.appendChild(childrenContainer);
    container.appendChild(bracketClose);
    
    bracketOpen.addEventListener('click', (e) => {
      e.stopPropagation();
      container.classList.toggle('collapsed');
      const icon = bracketOpen.querySelector('.toggle-icon');
      icon.textContent = container.classList.contains('collapsed') ? '▶' : '▼';
    });
    
    blockWrapper.appendChild(container);
    return blockWrapper;
  }
  
  if (typeof data === 'object') {
    const keys = Object.keys(data);
    if (keys.length === 0) {
      blockWrapper.innerHTML = `{}${isLast ? '' : ','}`;
      return blockWrapper;
    }
    
    const container = document.createElement('div');
    container.className = 'collapsible'; // Intentionally NO 'collapsed' class -> Expanded by default
    
    const braceOpen = document.createElement('span');
    braceOpen.innerHTML = `<span class="toggle-icon">▼</span>{`;
    
    const childrenContainer = document.createElement('div');
    childrenContainer.className = 'tree-children tree-node';
    
    keys.forEach((key, index) => {
      const isLastItem = index === keys.length - 1;
      const line = document.createElement('div');
      
      const keySpan = document.createElement('span');
      keySpan.className = 'json-key';
      keySpan.textContent = `"${key}"`;
      
      const colon = document.createElement('span');
      colon.textContent = ': ';
      
      const val = createJsonTree(data[key], isLastItem);
      
      line.appendChild(keySpan);
      line.appendChild(colon);
      line.appendChild(val);
      
      childrenContainer.appendChild(line);
    });
    
    const braceClose = document.createElement('div');
    braceClose.textContent = `}${isLast ? '' : ','}`;
    
    container.appendChild(braceOpen);
    container.appendChild(childrenContainer);
    container.appendChild(braceClose);
    
    braceOpen.addEventListener('click', (e) => {
      e.stopPropagation();
      container.classList.toggle('collapsed');
      const icon = braceOpen.querySelector('.toggle-icon');
      icon.textContent = container.classList.contains('collapsed') ? '▶' : '▼';
    });
    
    blockWrapper.appendChild(container);
    return blockWrapper;
  }
  
  return wrapper;
}

function escapeHtml(unsafe) {
  return (unsafe || '').toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function showToast(message) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  
  toast.textContent = message;
  toast.classList.add('show');
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 2500);
}
