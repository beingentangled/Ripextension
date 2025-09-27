// Vercel App Bridge Content Script
// This script runs on the Vercel app (localhost:3002) and handles communication with the extension

(function () {
    'use strict';

    console.log('ripextension: Vercel bridge content script starting...');

    // Inject shared-storage.js to make ripextensionStorage available
    function injectSharedStorage() {
        if (window.ripextensionStorage) {
            console.log('ripextension: Storage already available');
            return;
        }

        try {
            const script = document.createElement('script');
            script.src = chrome.runtime.getURL('shared-storage.js');
            script.onload = function () {
                console.log('ripextension: Shared storage injected successfully');
            };
            script.onerror = function (error) {
                console.error('ripextension: Failed to inject shared storage:', error);
            };
            (document.head || document.documentElement).appendChild(script);
        } catch (error) {
            console.error('ripextension: Error injecting shared storage:', error);
        }
    }

    // Inject shared storage immediately
    injectSharedStorage();

    // Listen for messages from the Vercel app's webpage
    window.addEventListener('message', async (event) => {
        if (event.source !== window) return;

        if (event.data.source === 'cryptoinsure-website') {
            await handleWebsiteMessage(event.data);
        }
    });

    // Automatically provide session data to the webpage
    setTimeout(async () => {
        console.log('ripextension: Auto-requesting session data for Vercel app');
        try {
            // Get session data from extension
            const sessionResponse = await sendToExtension('getSessionData');

            if (sessionResponse && sessionResponse.success && sessionResponse.data) {
                console.log('ripextension: Auto-providing session data to webpage:', sessionResponse.data);

                // Send the data to the webpage
                window.postMessage({
                    source: 'cryptoinsure-extension',
                    action: 'sessionDataResponse',
                    data: sessionResponse.data,
                    sessionId: 'auto-session',
                    autoProvided: true
                }, '*');
            } else {
                console.log('ripextension: No session data available in extension');
            }
        } catch (error) {
            console.error('ripextension: Error auto-requesting session data:', error);
        }
    }, 500); // Wait for page to be ready

    async function handleWebsiteMessage(data) {
        const { action, data: messageData } = data;

        switch (action) {
            case 'getSessionData':
                const sessionId = messageData && messageData.sessionId ? messageData.sessionId : data.sessionId;
                if (sessionId) {
                    await requestSessionDataFromExtension(sessionId);
                } else {
                    console.log('ripextension: No sessionId in getSessionData request');
                }
                break;
            case 'setWalletState':
                if (messageData) {
                    await sendToExtension('setWalletState', messageData);
                }
                break;
            case 'addInsurancePolicy':
                if (messageData) {
                    await sendToExtension('addInsurancePolicy', messageData);
                }
                break;
            default:
                console.log('ripextension: Unknown action from website:', action);
        }
    }

    async function requestSessionDataFromExtension(sessionId) {
        try {
            console.log('ripextension: Requesting session data for sessionId:', sessionId);

            // Get session data from extension storage
            const sessionResponse = await sendToExtension('getSessionData');

            if (sessionResponse && sessionResponse.success && sessionResponse.data) {
                console.log('ripextension: Got session data:', sessionResponse.data);

                window.postMessage({
                    source: 'cryptoinsure-extension',
                    action: 'sessionDataResponse',
                    data: sessionResponse.data,
                    sessionId: sessionId
                }, '*');
            } else {
                console.log('ripextension: No session data found for sessionId:', sessionId);

                // Send empty response to indicate no data found
                window.postMessage({
                    source: 'cryptoinsure-extension',
                    action: 'sessionDataResponse',
                    data: null,
                    sessionId: sessionId,
                    error: 'No data found'
                }, '*');
            }
        } catch (error) {
            console.error('ripextension: Error requesting session data:', error);

            window.postMessage({
                source: 'cryptoinsure-extension',
                action: 'sessionDataResponse',
                data: null,
                sessionId: sessionId,
                error: error.message
            }, '*');
        }
    }

    async function sendToExtension(action, data) {
        return new Promise((resolve, reject) => {
            try {
                chrome.runtime.sendMessage({
                    action: action,
                    data: data
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.error('ripextension: Extension communication error:', chrome.runtime.lastError);
                        reject(chrome.runtime.lastError);
                    } else {
                        console.log('ripextension: Extension response:', response);
                        resolve(response);
                    }
                });
            } catch (error) {
                console.error('ripextension: Error sending message to extension:', error);
                reject(error);
            }
        });
    }

    // Listen for requests from the main page
    window.addEventListener('message', (event) => {
        if (event.data.source === 'cryptoinsure-app' && event.data.action === 'getSessionData') {
            const requestedSessionId = event.data.sessionId;
            console.log('ripextension: App requesting session data for:', requestedSessionId);

            // Use the existing function to request session data
            requestSessionDataFromExtension(requestedSessionId);
        }
    });

    // Make functions available globally for debugging
    window.ripextensionVercelBridge = {
        requestSessionData: requestSessionDataFromExtension,
        sendToExtension: sendToExtension
    };

    // Notify the page that the bridge is ready
    window.postMessage({
        source: 'cryptoinsure-extension',
        action: 'bridgeReady'
    }, '*');

    console.log('ripextension: Vercel bridge content script initialized');
})();
