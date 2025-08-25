console.log("AI Email Assistant - Content Script Loaded");

// Find the original email content from the reply/compose view
function getEmailContent(composeView) {
  // Try multiple selectors to find the quoted email content
  const selectors = [
    '.gmail_quote',
    '[aria-label="Original message"]',
    '.gmail_extra',
    '.gmail_signature',
    '.gmail_attr'
  ];
  
  for (const selector of selectors) {
    const quote = composeView.querySelector(selector);
    if (quote) {
      return quote.innerText.trim();
    }
  }
  
  return ""; // Return empty if it's a new email
}

// Get the subject of the email
function getEmailSubject() {
  const subjectSelectors = [
    'h2[data-legacy-thread-id]',
    'h2[data-thread-perm-id]',
    '[data-test-id="message-subject"]',
    '.h7'
  ];
  
  for (const selector of subjectSelectors) {
    const subjectElement = document.querySelector(selector);
    if (subjectElement) {
      return subjectElement.innerText.trim();
    }
  }
  
  return 'No Subject';
}

// Create and inject styles for the button
function injectStyles() {
  if (document.getElementById('ai-reply-styles')) return;
  
  const styles = `
    .ai-reply-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background-color: #1a73e8;
      color: white;
      border: none;
      border-radius: 4px;
      padding: 8px 16px;
      margin-right: 8px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      transition: background-color 0.2s, box-shadow 0.2s;
    }
    
    .ai-reply-button:hover {
      background-color: #1967d2;
      box-shadow: 0 1px 2px rgba(0,0,0,0.3);
    }
    
    .ai-reply-button:disabled {
      background-color: #6b9fe6;
      cursor: not-allowed;
    }
    
    .ai-reply-button.success {
      background-color: #0f9d58;
    }
    
    .ai-reply-button.error {
      background-color: #ea4335;
    }
    
    .ai-reply-button svg {
      margin-right: 6px;
    }
    
    .loading-spinner {
      display: inline-block;
      width: 14px;
      height: 14px;
      border: 2px solid rgba(255,255,255,0.3);
      border-radius: 50%;
      border-top-color: white;
      animation: spin 1s ease-in-out infinite;
      margin-right: 6px;
    }
    
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `;
  
  const styleSheet = document.createElement('style');
  styleSheet.id = 'ai-reply-styles';
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);
}

// Find the compose toolbar using multiple selectors
function findComposeToolbar(composeView) {
  const toolbarSelectors = [
    '.btC', // Gmail's common toolbar class
    '[aria-label="Send"], [aria-label="Send"]', // Near send button
    '.dC', // Div containing buttons
    '.J-J5-Ji', // Button container
    '.J-JN-M-I-Jm' // Another button container
  ];
  
  for (const selector of toolbarSelectors) {
    const toolbar = composeView.querySelector(selector);
    if (toolbar) {
      return toolbar;
    }
  }
  
  return null;
}

// Find compose windows using multiple selectors
function findComposeWindows() {
  const composeSelectors = [
    '.AD', // Original selector
    '.aoI', // Compose window
    '.nH > .nH', // Nested divs that often contain compose
    '[role="dialog"]', // Gmail uses dialogs for compose
    '[aria-label="Message Body"]', // Near message body
    '.aoT' // Subject line container
  ];
  
  const composeWindows = [];
  for (const selector of composeSelectors) {
    const elements = document.querySelectorAll(selector);
    elements.forEach(el => {
      // Check if this looks like a compose window
      if (el.querySelector('[aria-label="Message Body"]') || 
          el.querySelector('[role="textbox"]') ||
          el.querySelector('[aria-label="To"]')) {
        composeWindows.push(el);
      }
    });
  }
  
  return composeWindows;
}

// Injects the AI Reply button into the Gmail toolbar
function injectButton(composeView) {
  const toolbar = findComposeToolbar(composeView);
  if (!toolbar) return;
  
  // Check if button already exists
  if (toolbar.querySelector(".ai-reply-button")) return;
  
  const button = document.createElement("div");
  button.className = "ai-reply-button";
  button.innerHTML = `<span><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2ZM21 9V7L15 1H5C3.9 1 3 1.9 3 3V21C3 22.1 3.9 23 5 23H19C20.1 23 21 22.1 21 21V9H21ZM19 21H5V3H13V9H19V21Z"/></svg>AI Reply</span>`;
  button.setAttribute("data-tooltip", "Generate AI Reply");

  button.addEventListener("click", () => {
    if (button.disabled) return;

    button.innerHTML = `<span><div class="loading-spinner"></div>Generating...</span>`;
    button.disabled = true;

    const emailBody = getEmailContent(composeView);
    const subject = getEmailSubject();

    // Send a message to the background script to handle the API call
    chrome.runtime.sendMessage({ 
      type: 'GENERATE_REPLY', 
      data: { emailBody, subject } 
    }, (response) => {
      if (chrome.runtime.lastError) {
        // Handle error case
        console.error("Extension message error:", chrome.runtime.lastError);
        alert("Error connecting to extension. Please make sure it's properly installed.");
        
        // Restore button state
        button.innerHTML = `<span><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2ZM21 9V7L15 1H5C3.9 1 3 1.9 3 3V21C3 22.1 3.9 23 5 23H19C20.1 23 21 22.1 21 21V9H21ZM19 21H5V3H13V9H19V21Z"/></svg>AI Reply</span>`;
        button.disabled = false;
        return;
      }
      
      if (response && response.success) {
        const composeBox = composeView.querySelector('[role="textbox"][contenteditable="true"], [role="textbox"][g_editable="true"]');
        if (composeBox) {
          composeBox.focus();
          // Insert the generated reply
          document.execCommand("insertHTML", false, response.reply.replace(/\n/g, '<br>'));
        }
        button.classList.add('success');
        setTimeout(() => button.classList.remove('success'), 600);
      } else {
        alert(`Error generating reply: ${response.error}`);
        button.classList.add('error');
        setTimeout(() => button.classList.remove('error'), 500);
      }

      // Restore button state
      button.innerHTML = `<span><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2ZM21 9V7L15 1H5C3.9 1 3 1.9 3 3V21C3 22.1 3.9 23 5 23H19C20.1 23 21 22.1 21 21V9H21ZM19 21H5V3H13V9H19V21Z"/></svg>AI Reply</span>`;
      button.disabled = false;
    });
  });

  // Try to insert before the send button, or just at the beginning
  const sendButton = toolbar.querySelector('[aria-label="Send"][role="button"], [data-tooltip="Send"]');
  if (sendButton) {
    toolbar.insertBefore(button, sendButton);
  } else {
    toolbar.insertBefore(button, toolbar.firstChild);
  }
}

// Check if extension is enabled
function checkExtensionState() {
  return new Promise((resolve) => {
    chrome.storage.local.get('state', (result) => {
      resolve(result.state && result.state.isEnabled);
    });
  });
}

// Main function to initialize the extension
async function initializeExtension() {
  // Inject styles first
  injectStyles();
  
  // Check if extension is enabled
  const isEnabled = await checkExtensionState();
  if (!isEnabled) return;
  
  // Find and process compose windows
  const composeWindows = findComposeWindows();
  composeWindows.forEach(injectButton);
}

// Observer to detect when a compose/reply window appears on the page
const observer = new MutationObserver(() => {
  initializeExtension();
});

// Start observing when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    observer.observe(document.body, { childList: true, subtree: true });
    // Initial check
    setTimeout(initializeExtension, 1000);
  });
} else {
  observer.observe(document.body, { childList: true, subtree: true });
  // Initial check
  setTimeout(initializeExtension, 1000);
}

// Listen for messages from popup to enable/disable button injection
chrome.runtime.onMessage.addListener((request) => {
  if (request.type === 'TOGGLE_EXTENSION') {
    if (!request.isEnabled) {
      document.querySelectorAll(".ai-reply-button").forEach(btn => btn.remove());
    } else {
      // Re-initialize if enabled
      initializeExtension();
    }
  }
});