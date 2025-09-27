// Shared Storage Utility for ripextension
// Manages wallet state between extension and external website

(function () {
    'use strict';

    // Storage keys
    const STORAGE_KEYS = {
        WALLET_STATE: 'cryptoinsure_wallet_state',
        SESSION_DATA: 'cryptoinsure_session_data',
        INSURANCE_POLICIES: 'cryptoinsure_policies'
    };

    // Default wallet state structure
    const DEFAULT_WALLET_STATE = {
        address: null,
        isConnected: false,
        network: null,
        chainId: null,
        sessionId: null,
        lastActivity: null,
        connectedAt: null
    };

    // Shared Storage Manager
    window.ripextensionStorage = {

        // Get wallet state
        async getWalletState() {
            try {
                if (typeof chrome !== 'undefined' && chrome.storage) {
                    // Extension context
                    const result = await chrome.storage.local.get(STORAGE_KEYS.WALLET_STATE);
                    return result[STORAGE_KEYS.WALLET_STATE] || DEFAULT_WALLET_STATE;
                } else {
                    // Website context - try to communicate with extension
                    return await this.requestFromExtension('getWalletState');
                }
            } catch (error) {
                console.log('ripextension: Error getting wallet state:', error);
                return DEFAULT_WALLET_STATE;
            }
        },

        // Set wallet state
        async setWalletState(state) {
            try {
                const updatedState = {
                    ...DEFAULT_WALLET_STATE,
                    ...state,
                    lastActivity: Date.now()
                };

                if (typeof chrome !== 'undefined' && chrome.storage) {
                    // Extension context
                    await chrome.storage.local.set({
                        [STORAGE_KEYS.WALLET_STATE]: updatedState
                    });

                    // Notify all tabs about the update
                    this.broadcastUpdate('walletStateChanged', updatedState);
                } else {
                    // Website context
                    await this.sendToExtension('setWalletState', updatedState);
                }

                return updatedState;
            } catch (error) {
                console.error('ripextension: Error setting wallet state:', error);
                throw error;
            }
        },

        // Clear wallet state (disconnect)
        async clearWalletState() {
            try {
                if (typeof chrome !== 'undefined' && chrome.storage) {
                    await chrome.storage.local.remove(STORAGE_KEYS.WALLET_STATE);
                    this.broadcastUpdate('walletDisconnected', DEFAULT_WALLET_STATE);
                } else {
                    await this.sendToExtension('clearWalletState');
                }
            } catch (error) {
                console.error('ripextension: Error clearing wallet state:', error);
            }
        },

        // Get session data
        async getSessionData() {
            try {
                if (typeof chrome !== 'undefined' && chrome.storage) {
                    // Direct access to chrome storage (works in both extension and injected contexts)
                    const result = await chrome.storage.local.get(STORAGE_KEYS.SESSION_DATA);
                    console.log('ripextension: Retrieved session data from storage:', result);
                    return result[STORAGE_KEYS.SESSION_DATA] || {};
                } else {
                    // Fallback to message passing
                    console.log('ripextension: Chrome storage not available, using message passing');
                    return await this.requestFromExtension('getSessionData');
                }
            } catch (error) {
                console.log('ripextension: Error getting session data:', error);
                // Try message passing as fallback
                try {
                    return await this.requestFromExtension('getSessionData');
                } catch (fallbackError) {
                    console.log('ripextension: Fallback also failed:', fallbackError);
                    return {};
                }
            }
        },

        // Set session data
        async setSessionData(data) {
            try {
                if (typeof chrome !== 'undefined' && chrome.storage) {
                    await chrome.storage.local.set({
                        [STORAGE_KEYS.SESSION_DATA]: data
                    });
                } else {
                    await this.sendToExtension('setSessionData', data);
                }
            } catch (error) {
                console.error('ripextension: Error setting session data:', error);
            }
        },

        // Get insurance policies
        async getInsurancePolicies() {
            try {
                if (typeof chrome !== 'undefined' && chrome.storage) {
                    const result = await chrome.storage.local.get(STORAGE_KEYS.INSURANCE_POLICIES);
                    return result[STORAGE_KEYS.INSURANCE_POLICIES] || [];
                } else {
                    return await this.requestFromExtension('getInsurancePolicies');
                }
            } catch (error) {
                console.log('ripextension: Error getting policies:', error);
                return [];
            }
        },

        // Add insurance policy
        async addInsurancePolicy(policy) {
            try {
                const policies = await this.getInsurancePolicies();
                const newPolicy = {
                    id: Date.now().toString(),
                    createdAt: Date.now(),
                    ...policy
                };
                policies.push(newPolicy);

                if (typeof chrome !== 'undefined' && chrome.storage) {
                    await chrome.storage.local.set({
                        [STORAGE_KEYS.INSURANCE_POLICIES]: policies
                    });
                } else {
                    await this.sendToExtension('addInsurancePolicy', newPolicy);
                }

                return newPolicy;
            } catch (error) {
                console.error('ripextension: Error adding policy:', error);
                throw error;
            }
        },

        // Communication with extension (for website context)
        async requestFromExtension(action, data = null) {
            return new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Extension communication timeout'));
                }, 5000);

                const messageHandler = (event) => {
                    if (event.source !== window ||
                        !event.data.source ||
                        event.data.source !== 'cryptoinsure-extension') {
                        return;
                    }

                    if (event.data.action === action + '_response') {
                        clearTimeout(timeout);
                        window.removeEventListener('message', messageHandler);
                        resolve(event.data.result);
                    }
                };

                window.addEventListener('message', messageHandler);

                // Send request to extension
                window.postMessage({
                    source: 'cryptoinsure-website',
                    action: action,
                    data: data,
                    timestamp: Date.now()
                }, '*');
            });
        },

        // Send data to extension (for website context)
        async sendToExtension(action, data) {
            window.postMessage({
                source: 'cryptoinsure-website',
                action: action,
                data: data,
                timestamp: Date.now()
            }, '*');
        },

        // Broadcast updates to all tabs (extension context)
        broadcastUpdate(type, data) {
            if (typeof chrome !== 'undefined' && chrome.tabs) {
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
        }

    };

    console.log('ripextension: Shared storage utility loaded');

})();
