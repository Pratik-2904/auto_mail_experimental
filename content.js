console.log("AI Email Assistant - Content Script Loaded");

// Find the original email content from the reply/compose view
function getEmailContent(composeView) {
  const quote = composeView.querySelector(".gmail_quote");
  if (quote) {
    return quote.innerText.trim();
  }
  return ""; // Return empty if it's a new email, the backend will handle it
}

// Get the subject of the email
function getEmailSubject() {
  const subjectElement = document.querySelector('h2[data-legacy-thread-id]');
  return subjectElement ? subjectElement.innerText.trim() : 'No Subject';
}

// Injects the AI Reply button into the Gmail toolbar
function injectButton(composeView) {
  const toolbar = composeView.querySelector(".btC");
  if (toolbar && !toolbar.querySelector(".ai-reply-button")) {
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
      chrome.runtime.sendMessage({ type: 'GENERATE_REPLY', data: { emailBody, subject } }, (response) => {
        if (response && response.success) {
          const composeBox = composeView.querySelector('[role="textbox"][g_editable="true"]');
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

    toolbar.insertBefore(button, toolbar.firstChild);
  }
}

// Observer to detect when a compose/reply window appears on the page
const observer = new MutationObserver(() => {
  chrome.storage.local.get('state', (result) => {
    if (result.state && result.state.isEnabled) {
      const composeWindows = document.querySelectorAll('.AD');
      composeWindows.forEach(injectButton);
    }
  });
});

observer.observe(document.body, { childList: true, subtree: true });

// Listen for messages from popup to enable/disable button injection
chrome.runtime.onMessage.addListener((request) => {
  if (request.type === 'TOGGLE_EXTENSION') {
    if (!request.isEnabled) {
      document.querySelectorAll(".ai-reply-button").forEach(btn => btn.remove());
    }
  }
});