// Utilities to extract order level information from Amazon DOM
(function () {
    'use strict';

    const Amazon = window.ripextensionAmazon = window.ripextensionAmazon || {};
    const CONFIG = Amazon.CONFIG;

    function extractOrderInfo(container = null) {
        const orderInfo = {
            orderId: null,
            shipmentId: null,
            trackingId: null,
            productName: null,
            orderTotal: null,
            orderDate: null,
            orderStatus: null,
            seller: null,
            asin: null,
            quantity: null,
            orderItems: [],
            invoiceUrl: null,
            invoiceDetails: null
        };

        const searchScope = container || document;

        orderInfo.orderId = extractOrderId(searchScope);

        const urlParams = new URLSearchParams(window.location.search);
        orderInfo.shipmentId = urlParams.get('shipmentId');
        orderInfo.trackingId = urlParams.get('trackingId');

        const productInfo = extractProductInfo(searchScope);
        orderInfo.productName = productInfo.name;
        orderInfo.asin = productInfo.asin;
        orderInfo.quantity = productInfo.quantity;
        orderInfo.orderItems = productInfo.items;

        orderInfo.orderTotal = extractOrderTotal(searchScope);
        orderInfo.orderDate = extractOrderDate(searchScope);
        orderInfo.orderStatus = extractOrderStatus(searchScope);
        orderInfo.seller = extractSellerInfo(searchScope);

        console.log('ripextension: Extracted order info:', orderInfo);
        return orderInfo;
    }

    function extractOrderId(scope) {
        const orderIdSelectors = [
            () => new URLSearchParams(window.location.search).get('orderID') || new URLSearchParams(window.location.search).get('orderId'),
            () => {
                const orderDiv = scope.querySelector('.yohtmlc-order-id');
                if (orderDiv) {
                    const orderSpan = orderDiv.querySelector('span.a-color-secondary[dir="ltr"], span.a-color-secondary:not(.a-text-caps)');
                    if (orderSpan) {
                        return orderSpan.textContent.trim();
                    }

                    const spans = orderDiv.querySelectorAll('span');
                    for (const span of spans) {
                        const text = span.textContent.trim();
                        if (text.match(/^\d{3}-\d{7}-\d{7}$/)) {
                            return text;
                        }
                    }
                }
                return null;
            },
            () => {
                const element = scope.querySelector('[data-order-id]');
                return element ? element.getAttribute('data-order-id') : null;
            },
            () => {
                const element = scope.querySelector('.a-box-group .a-box-inner .a-row .a-column:first-child bdi, .order-info bdi');
                return element ? element.textContent.trim().replace(/Order #?/, '') : null;
            },
            () => {
                const element = scope.querySelector('.order-card [class*="order"] bdi, .yohtmlc-order-id bdi, .yohtmlc-order-id span');
                return element ? element.textContent.trim().replace(/Order #?/, '') : null;
            },
            () => {
                const element = scope.querySelector('.a-spacing-small bdi, .order-number bdi');
                return element ? element.textContent.trim().replace(/Order #?/, '') : null;
            },
            () => {
                const orderElements = scope.querySelectorAll('*');
                for (const element of orderElements) {
                    const text = element.textContent;
                    const match = text.match(/Order #?(\d{3}-\d{7}-\d{7})/);
                    if (match) return match[1];
                }
                return null;
            }
        ];

        for (const extractor of orderIdSelectors) {
            const result = extractor();
            if (result) return result;
        }
        return null;
    }

    function extractProductInfo(scope) {
        const productInfo = {
            name: null,
            asin: null,
            quantity: null,
            items: []
        };

        const productNameSelectors = [
            '.a-link-normal[title]',
            '.product-title',
            '.a-size-medium.a-color-base',
            '.a-size-base-plus',
            '.yohtmlc-product-title',
            '[data-asin] .a-link-normal',
            '.a-row .a-column .a-link-normal'
        ];

        for (const selector of productNameSelectors) {
            const element = scope.querySelector(selector);
            if (element) {
                productInfo.name = element.textContent.trim() || element.getAttribute('title');
                if (productInfo.name) break;
            }
        }

        const asinSelectors = [
            () => {
                const element = scope.querySelector('[data-asin]');
                return element ? element.getAttribute('data-asin') : null;
            },
            () => {
                const link = scope.querySelector('a[href*="/dp/"], a[href*="/gp/product/"]');
                if (link) {
                    const match = link.href.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/);
                    return match ? match[1] : null;
                }
                return null;
            }
        ];

        for (const extractor of asinSelectors) {
            const result = extractor();
            if (result) {
                productInfo.asin = result;
                break;
            }
        }

        const quantitySelectors = [
            '.a-dropdown-prompt',
            '.quantity-label',
            '[class*="quantity"]'
        ];

        for (const selector of quantitySelectors) {
            const element = scope.querySelector(selector);
            if (element) {
                const qtyMatch = element.textContent.match(/(\d+)/);
                if (qtyMatch) {
                    productInfo.quantity = qtyMatch[1];
                    break;
                }
            }
        }

        const itemElements = scope.querySelectorAll('.a-fixed-left-grid, .yohtmlc-item, .order-item');
        itemElements.forEach(item => {
            const itemName = item.querySelector('.a-link-normal, .product-title');
            if (itemName) {
                productInfo.items.push({
                    name: itemName.textContent.trim(),
                    asin: item.querySelector('[data-asin]')?.getAttribute('data-asin') || null
                });
            }
        });

        return productInfo;
    }

    function extractOrderTotal(scope) {
        const priceSelectors = [
            '.a-color-price.a-size-medium',
            '.a-color-price',
            '.a-price-whole',
            '.grand-total-price',
            '.a-color-secondary.a-text-right',
            '[class*="price"] .a-size-medium',
            '.yohtmlc-order-total'
        ];

        for (const selector of priceSelectors) {
            const element = scope.querySelector(selector);
            if (element) {
                const price = element.textContent.trim();
                if (price.match(/[\$£€¥₹][\d,.]/) || price.match(/[\d,.]+\s*[\$£€¥₹]/)) {
                    return price;
                }
            }
        }

        const allElements = scope.querySelectorAll('*');
        for (const element of allElements) {
            const text = element.textContent.trim();
            const priceMatch = text.match(/([\$£€¥₹][\d,]+\.?\d*)/);
            if (priceMatch && text.length < 20) {
                return priceMatch[1];
            }
        }

        return null;
    }

    function extractOrderDate(scope) {
        const dateSelectors = [
            '.a-color-secondary.a-text-normal',
            '.order-date',
            '.a-size-base.a-color-secondary',
            '[class*="date"]'
        ];

        for (const selector of dateSelectors) {
            const elements = scope.querySelectorAll(selector);
            for (const element of elements) {
                const text = element.textContent.trim();
                if (text.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/) ||
                    text.match(/\d{1,2}\/\d{1,2}\/\d{4}/) ||
                    text.match(/\d{4}-\d{2}-\d{2}/)) {
                    return text;
                }
            }
        }

        return null;
    }

    function extractOrderStatus(scope) {
        const statusSelectors = [
            '.a-color-state',
            '.a-color-success',
            '.delivery-status',
            '.order-status',
            '[class*="status"]'
        ];

        for (const selector of statusSelectors) {
            const element = scope.querySelector(selector);
            if (element) {
                const text = element.textContent.trim();
                if (text) {
                    return text;
                }
            }
        }

        return null;
    }

    function extractSellerInfo(scope) {
        const sellerSelectors = [
            '.yohtmlc-seller-name',
            '.a-size-small.a-color-secondary',
            '.a-row .a-column .a-color-secondary',
            '.seller-info',
            '[class*="seller"]'
        ];

        for (const selector of sellerSelectors) {
            const elements = scope.querySelectorAll(selector);
            for (const element of elements) {
                const text = element.textContent.trim();
                if (text && text.length < 50 && text.toLowerCase().includes('sold')) {
                    return text.replace('Sold by', '').trim();
                }
            }
        }

        return 'Amazon';
    }

    Amazon.extractOrderInfo = extractOrderInfo;
    Amazon.extractOrderId = extractOrderId;
    Amazon.extractOrderTotal = extractOrderTotal;
    Amazon.extractOrderDate = extractOrderDate;
    Amazon.extractOrderStatus = extractOrderStatus;
    Amazon.extractSellerInfo = extractSellerInfo;
    Amazon.extractProductInfo = extractProductInfo;
})();
