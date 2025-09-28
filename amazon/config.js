// Amazon injector configuration and shared namespace
(function () {
    'use strict';

    const Amazon = window.ripextensionAmazon = window.ripextensionAmazon || {};

    const CONFIG = {
        EXTERNAL_SITE_URL: 'https://rip-sandy.vercel.app',
        // EXTERNAL_SITE_URL: 'http://localhost:3002',
        ORDER_HISTORY_PATTERNS: [
            /\/gp\/your-account\/order-history/,
            /\/gp\/css\/order-details/,
            /\/gp\/your-account\/ship-track/,
            /\/progress-tracker\/package/,
            /\/order-history/
        ],
        ORDER_ACTION_SELECTORS: [
            'ul.yohtmlc-shipment-level-connections',
            'ul[class*="shipment-level-connections"]',
            '.a-box-group .a-button-group',
            '.order-card .a-button-group'
        ],
        BUTTON_CLASSES: 'a-button a-button-normal a-spacing-mini a-button-base cryptoinsure-button',
        BUTTON_INNER_CLASSES: 'a-button-inner',
        BUTTON_TEXT_CLASSES: 'a-button-text'
    };

    Amazon.CONFIG = CONFIG;
    Amazon.state = Amazon.state || {
        pdfJsLoaderPromise: null
    };

    Amazon.isOrderHistoryPage = function isOrderHistoryPage() {
        const currentUrl = window.location.href;
        const currentPath = window.location.pathname;

        return CONFIG.ORDER_HISTORY_PATTERNS.some(pattern =>
            pattern.test(currentUrl) || pattern.test(currentPath)
        );
    };
})();
