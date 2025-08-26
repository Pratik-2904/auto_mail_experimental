// Background service worker for AI Email Assistant
console.log('AI Email Assistant - Background Script Loaded');

// On installation, set up the default state in chrome.storage
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.get('state', (result) => {
        if (!result.state) {
            chrome.storage.local.set({
                state: {
                    isEnabled: true,
                    currentTone: 'Professional',
                    replyHistory: []
                }
            });
        }
    });
});

// Main listener for messages from other scripts (content.js, popup.js)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'GENERATE_REPLY') {
        handleGenerateReply(request.data, sendResponse);
        return true; // Indicates an asynchronous response
    }
    if (request.type === 'GET_STATS') {
        handleGetStats(sendResponse);
        return true; // Indicates an asynchronous response
    }
});

// Handles the API call to your backend
async function handleGenerateReply(data, sendResponse) {
    try {
        const { state } = await chrome.storage.local.get('state');

        // Add debugging to see what data is being sent
        console.log('Sending data to backend:', {
            emailBody: data.emailBody,
            emailBodyLength: data.emailBody ? data.emailBody.length : 0,
            tone: state.currentTone || 'Professional',
            subject: data.subject
        });

        const response = await fetch('http://3.90.38.82:8080/api/email/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            },
            // FIXED: The backend expects 'emailBody', not 'emailContent'
            body: JSON.stringify({
                emailBody: data.emailBody,
                tone: state.currentTone || 'Professional',
                timestamp: Date.now() // Add timestamp to prevent caching
            })
        });

        if (!response.ok) {
            throw new Error(`API request failed: ${response.status}`);
        }

        // FIXED: The backend returns JSON, not plain text
        const responseData = await response.json();
        const generatedReply = responseData.generatedResponse;

        // Add debugging to see the response
        console.log('Backend response:', responseData);
        console.log('Generated reply:', generatedReply);

        // Save the new reply to the history in storage
        const newHistoryEntry = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            subject: data.subject,
            originalEmail: data.emailBody.substring(0, 500), // Truncate for storage
            generatedReply: generatedReply,
            tone: state.currentTone
        };

        state.replyHistory.unshift(newHistoryEntry);
        if (state.replyHistory.length > 50) { // Keep history limited to 50 entries
            state.replyHistory.pop();
        }
        await chrome.storage.local.set({ state });

        sendResponse({ success: true, reply: generatedReply });

    } catch (error) {
        console.error('Error generating reply in background:', error);
        sendResponse({ success: false, error: error.message });
    }
}

// Handles the API call to your backend's /stats endpoint
async function handleGetStats(sendResponse) {
    try {
        const response = await fetch('http://3.90.38.82:8080/stats');
        if (!response.ok) {
            throw new Error(`Server responded with status: ${response.status}`);
        }
        const serverStats = await response.json();
        sendResponse({ success: true, stats: serverStats });
    } catch (error) {
        console.error('Failed to fetch stats from background:', error);
        sendResponse({ success: false, error: error.message });
    }
}