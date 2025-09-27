// Entry point that wires together the Amazon injector modules
(function () {
    'use strict';

    const Amazon = window.ripextensionAmazon = window.ripextensionAmazon || {};

    function injectSharedStorage() {
        if (document.getElementById('cryptoinsure-shared-storage-script')) {
            return;
        }

        const script = document.createElement('script');
        script.id = 'cryptoinsure-shared-storage-script';
        script.src = chrome.runtime.getURL('shared-storage.js');
        script.type = 'text/javascript';
        document.documentElement.appendChild(script);
    }

    function init() {
        console.log('ripextension: Content script loaded');

        injectSharedStorage();

        if (!Amazon.isOrderHistoryPage()) {
            console.log('ripextension: Not an order history page, skipping injection');
            return;
        }

        console.log('ripextension: Order history page detected');

        setTimeout(() => {
            const injected = Amazon.injectInsureButtons();
            console.log(`ripextension: Injected ${injected} buttons`);
        }, 1000);

        const observer = new MutationObserver(() => {
            Amazon.injectInsureButtons();
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        console.log('ripextension: Watching for dynamic content changes');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
