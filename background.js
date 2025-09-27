// Background Script for ripextension Extension
// Handles communication between extension and external websites

chrome.runtime.onInstalled.addListener(() => {
    console.log('ripextension: Extension installed');
});

// Handle messages from content scripts and popups
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('ripextension: Background received message:', message);

    switch (message.action) {
        case 'getWalletState':
            handleGetWalletState(sendResponse);
            return true; // Keep message channel open for async response

        case 'setWalletState':
            handleSetWalletState(message.data, sendResponse);
            return true;

        case 'clearWalletState':
            handleClearWalletState(sendResponse);
            return true;

        case 'getSessionData':
            handleGetSessionData(sendResponse);
            return true;

        case 'setSessionData':
            handleSetSessionData(message.data, sendResponse);
            return true;

        case 'addInsurancePolicy':
            handleAddInsurancePolicy(message.data, sendResponse);
            return true;

        case 'getInsurancePolicies':
            handleGetInsurancePolicies(sendResponse);
            return true;

        case 'openExternalSite':
            handleOpenExternalSite(message.data, sendResponse);
            return true;

        default:
            console.log('ripextension: Unknown action:', message.action);
            sendResponse({ error: 'Unknown action' });
    }
});

// Handle wallet state operations
async function handleGetWalletState(sendResponse) {
    try {
        const result = await chrome.storage.local.get('cryptoinsure_wallet_state');
        const walletState = result.cryptoinsure_wallet_state || {
            address: null,
            isConnected: false,
            network: null,
            chainId: null,
            sessionId: null,
            lastActivity: null,
            connectedAt: null
        };
        sendResponse({ success: true, data: walletState });
    } catch (error) {
        console.error('ripextension: Error getting wallet state:', error);
        sendResponse({ success: false, error: error.message });
    }
}

async function handleSetWalletState(data, sendResponse) {
    try {
        const updatedState = {
            ...data,
            lastActivity: Date.now()
        };

        await chrome.storage.local.set({
            cryptoinsure_wallet_state: updatedState
        });

        // Broadcast to all tabs
        broadcastToAllTabs('walletStateChanged', updatedState);

        sendResponse({ success: true, data: updatedState });
    } catch (error) {
        console.error('ripextension: Error setting wallet state:', error);
        sendResponse({ success: false, error: error.message });
    }
}

async function handleClearWalletState(sendResponse) {
    try {
        await chrome.storage.local.remove('cryptoinsure_wallet_state');

        const defaultState = {
            address: null,
            isConnected: false,
            network: null,
            chainId: null,
            sessionId: null,
            lastActivity: null,
            connectedAt: null
        };

        broadcastToAllTabs('walletDisconnected', defaultState);
        sendResponse({ success: true, data: defaultState });
    } catch (error) {
        console.error('ripextension: Error clearing wallet state:', error);
        sendResponse({ success: false, error: error.message });
    }
}

// Handle session data operations
async function handleGetSessionData(sendResponse) {
    try {
        const result = await chrome.storage.local.get('cryptoinsure_session_data');
        const sessionData = result.cryptoinsure_session_data || {};
        console.log('ripextension: Background returning session data:', JSON.stringify(sessionData, null, 2));
        sendResponse({ success: true, data: sessionData });
    } catch (error) {
        console.error('ripextension: Error getting session data:', error);
        sendResponse({ success: false, error: error.message });
    }
}

async function handleSetSessionData(data, sendResponse) {
    try {
        console.log('ripextension: Background storing session data:', JSON.stringify(data, null, 2));
        await chrome.storage.local.set({
            cryptoinsure_session_data: data
        });
        console.log('ripextension: Session data stored successfully');
        sendResponse({ success: true, data: data });
    } catch (error) {
        console.error('ripextension: Error setting session data:', error);
        sendResponse({ success: false, error: error.message });
    }
}

// Handle insurance policy operations
async function handleGetInsurancePolicies(sendResponse) {
    try {
        const result = await chrome.storage.local.get('cryptoinsure_policies');
        sendResponse({ success: true, data: result.cryptoinsure_policies || [] });
    } catch (error) {
        console.error('ripextension: Error getting policies:', error);
        sendResponse({ success: false, error: error.message });
    }
}

async function handleAddInsurancePolicy(policy, sendResponse) {
    try {
        const result = await chrome.storage.local.get('cryptoinsure_policies');
        const policies = result.cryptoinsure_policies || [];

        const newPolicy = {
            id: Date.now().toString(),
            createdAt: Date.now(),
            ...policy
        };

        policies.push(newPolicy);

        await chrome.storage.local.set({
            cryptoinsure_policies: policies
        });

        // Broadcast policy update
        broadcastToAllTabs('policyAdded', newPolicy);

        sendResponse({ success: true, data: newPolicy });
    } catch (error) {
        console.error('ripextension: Error adding policy:', error);
        sendResponse({ success: false, error: error.message });
    }
}

// Handle external site opening with data
async function handleOpenExternalSite(data, sendResponse) {
    try {
        const { url } = data;
        const sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const finalUrl = `${url}?sessionId=${sessionId}&source=extension`;

        chrome.tabs.create({ url: finalUrl });

        sendResponse({ success: true, sessionId });
    } catch (error) {
        console.error('ripextension: Error opening external site:', error);
        sendResponse({ success: false, error: error.message });
    }
}

// Broadcast message to all tabs
function broadcastToAllTabs(type, data) {
    chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, {
                source: 'cryptoinsure-extension',
                type: type,
                data: data
            }).catch(() => {
                // Ignore errors for tabs that don't have content script
            });
        });
    });
}

console.log('ripextension: Background script loaded');
