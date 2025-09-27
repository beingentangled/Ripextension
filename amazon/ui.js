// UI helpers and interaction logic for the Amazon injector
(function () {
    'use strict';

    const Amazon = window.ripextensionAmazon = window.ripextensionAmazon || {};
    const CONFIG = Amazon.CONFIG;

    function calculateInsurancePremium(orderTotal) {
        if (!orderTotal) {
            return 'N/A';
        }

        const numericMatch = orderTotal.match(/([\d,]+\.?\d*)/);
        if (!numericMatch) {
            return 'N/A';
        }

        const orderValue = parseFloat(numericMatch[1].replace(/,/g, ''));
        if (Number.isNaN(orderValue)) {
            return 'N/A';
        }

        const premiumAmount = orderValue * 0.025;
        const currencyMatch = orderTotal.match(/([\$£€¥₹])/);
        const currencySymbol = currencyMatch ? currencyMatch[1] : '$';

        return `${currencySymbol}${premiumAmount.toFixed(2)}`;
    }

    function createInsureButton() {
        const buttonSpan = document.createElement('span');
        buttonSpan.className = CONFIG.BUTTON_CLASSES;
        buttonSpan.id = 'cryptoinsure-button-' + Date.now();

        const buttonInner = document.createElement('span');
        buttonInner.className = CONFIG.BUTTON_INNER_CLASSES;

        const buttonLink = document.createElement('a');
        buttonLink.className = CONFIG.BUTTON_TEXT_CLASSES;
        buttonLink.href = '#';
        buttonLink.setAttribute('role', 'button');
        buttonLink.textContent = '🛡️ Insure by Crypto';
        buttonLink.style.textDecoration = 'none';

        buttonLink.addEventListener('click', async function (event) {
            event.preventDefault();
            await handleInsureClick(buttonSpan);
        });

        buttonInner.appendChild(buttonLink);
        buttonSpan.appendChild(buttonInner);

        return buttonSpan;
    }

    async function handleInsureClick(buttonElement) {
        console.log('CryptoInsure: Insure button clicked');

        try {
            const orderContainer = buttonElement.closest('.order-card, .a-box-group, .yohtmlc-order, .order-item, .a-fixed-left-grid') || null;

            const orderInfo = Amazon.extractOrderInfo(orderContainer);
            console.log('CryptoInsure: Extracted order info:', orderInfo);

            const invoiceUrl = await Amazon.fetchInvoicePdfLink(orderContainer);
            if (invoiceUrl) {
                orderInfo.invoiceUrl = invoiceUrl;
                console.log('CryptoInsure: Found invoice URL, attempting to parse PDF...');
                const invoiceDetails = await Amazon.parseInvoicePdf(invoiceUrl);
                if (invoiceDetails) {
                    orderInfo.invoiceDetails = invoiceDetails;
                    console.log('CryptoInsure: Successfully extracted invoice details:', invoiceDetails);
                } else {
                    console.log('CryptoInsure: PDF parsing failed, but order processing will continue');
                }
            } else {
                console.log('CryptoInsure: No invoice PDF URL found, continuing without invoice details');
            }

            createInsuranceModal(orderInfo);

            try {
                chrome.runtime.sendMessage({
                    action: 'openInsurance',
                    orderInfo: orderInfo,
                    source: 'amazon-page'
                });
            } catch (error) {
                console.log('CryptoInsure: Could not send message to extension:', error);
            }
        } catch (error) {
            console.log('CryptoInsure: Error during insurance button handling:', error.message);
        }
    }

    function escapeHtml(value) {
        if (value == null) {
            return '';
        }
        return String(value).replace(/[&<>'"]/g, (char) => {
            switch (char) {
                case '&':
                    return '&amp;';
                case '<':
                    return '&lt;';
                case '>':
                    return '&gt;';
                case '"':
                    return '&quot;';
                case "'":
                    return '&#39;';
                default:
                    return char;
            }
        });
    }

    function renderInvoiceDetails(details) {
        if (!details) {
            return '';
        }

        const fields = [
            { key: 'orderDate', label: 'Order Date' },
            { key: 'unitPrice', label: 'Unit Price' },
            { key: 'orderNumber', label: 'Order Number' },
            { key: 'invoiceNumber', label: 'Invoice Number' },
            { key: 'paymentTransactionId', label: 'Payment Transaction ID' }
        ];

        const items = fields
            .map(field => {
                if (!details[field.key]) {
                    return null;
                }
                const safeValue = escapeHtml(details[field.key]);
                return `<li><strong>${field.label}:</strong> ${safeValue}</li>`;
            })
            .filter(Boolean);

        if (!items.length) {
            return '';
        }

        return `
            <div class="cryptoinsure-invoice-details">
                <h3>Invoice Snapshot</h3>
                <ul>
                    ${items.join('')}
                </ul>
            </div>
        `;
    }

    function parsePriceToUsd(value) {
        if (!value) {
            return null;
        }

        const numberOnly = String(value)
            .replace(/[^0-9.,]/g, '')
            .replace(/,/g, '');

        if (!numberOnly) {
            return null;
        }

        const parsed = parseFloat(numberOnly);
        return Number.isFinite(parsed) ? parsed : null;
    }

    function resolvePurchaseDate(orderInfo) {
        const dateCandidates = [
            orderInfo?.invoiceDetails?.orderDate,
            orderInfo?.orderDate,
            orderInfo?.orderItems?.[0]?.orderDate
        ].filter(Boolean);

        for (const candidate of dateCandidates) {
            const parsed = new Date(candidate);
            if (!Number.isNaN(parsed.getTime())) {
                return parsed.toISOString().split('T')[0];
            }
        }

        return new Date().toISOString().split('T')[0];
    }

    function buildInvoicePayload(orderInfo) {
        const priceSources = [
            orderInfo?.invoiceDetails?.unitPrice,
            orderInfo?.orderTotal,
            orderInfo?.orderItems?.[0]?.price
        ];

        let purchasePrice = null;
        for (const source of priceSources) {
            const parsed = parsePriceToUsd(source);
            if (parsed !== null) {
                purchasePrice = parsed;
                break;
            }
        }

        const orderNumber = orderInfo.orderId || orderInfo?.invoiceDetails?.orderNumber || `ORDER_${Date.now()}`;
        const productId = (orderInfo.asin || orderInfo?.orderItems?.[0]?.asin || 'UNKNOWN_PRODUCT').toString();
        const description = orderInfo.productName || orderInfo?.orderItems?.[0]?.name || 'Default invoice data for policy purchase testing';

        return {
            orderNumber,
            purchasePriceUsd: (purchasePrice ?? 0).toFixed(2),
            purchaseDate: resolvePurchaseDate(orderInfo),
            productId,
            description
        };
    }

    function buildInvoiceQrData(invoicePayload) {
        const jsonString = JSON.stringify(invoicePayload);
        const encoded = encodeURIComponent(jsonString);
        const size = 180;

        return {
            jsonString,
            src: `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encoded}`
        };
    }

    function createInsuranceModal(orderInfo) {
        const existingModal = document.getElementById('cryptoinsure-modal');
        if (existingModal) {
            existingModal.remove();
        }

        const modal = document.createElement('div');
        modal.id = 'cryptoinsure-modal';
        modal.className = 'cryptoinsure-modal-overlay';

        const invoiceDetailsMarkup = renderInvoiceDetails(orderInfo.invoiceDetails);
        const safeInvoiceUrl = orderInfo.invoiceUrl ? escapeHtml(orderInfo.invoiceUrl) : null;
        const invoicePayload = buildInvoicePayload(orderInfo);
        const qrImageId = `cryptoinsure-qr-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

        modal.innerHTML = `
            <div class="cryptoinsure-modal-content">
                <div class="cryptoinsure-modal-header">
                    <h2>🛡️ Rip - Remorse Insurance Protocol</h2>
                    <button class="cryptoinsure-close-btn" id="cryptoinsure-close">&times;</button>
                </div>
                <div class="cryptoinsure-modal-body">
                    <div class="cryptoinsure-order-info">
                        <h3>Order Information</h3>
                        <p><strong>Order ID:</strong> ${orderInfo.orderId || 'Not found'}</p>
                        <p><strong>Product:</strong> ${orderInfo.productName || 'Product from Amazon'}</p>
                        <p><strong>Order Total:</strong> ${orderInfo.orderTotal || 'N/A'}</p>
                        ${safeInvoiceUrl ? `<p><strong>Invoice:</strong> <a href="${safeInvoiceUrl}" target="_blank" rel="noopener noreferrer">Download Invoice</a></p>` : ''}
                        ${invoiceDetailsMarkup}
                        ${orderInfo.orderDate ? `<p><strong>Order Date:</strong> ${orderInfo.orderDate}</p>` : ''}
                        ${orderInfo.orderStatus ? `<p><strong>Status:</strong> ${orderInfo.orderStatus}</p>` : ''}
                        ${orderInfo.seller && orderInfo.seller !== 'Amazon' ? `<p><strong>Seller:</strong> ${orderInfo.seller}</p>` : ''}
                        ${orderInfo.asin ? `<p><strong>ASIN:</strong> ${orderInfo.asin}</p>` : ''}
                        ${orderInfo.quantity && orderInfo.quantity !== '1' ? `<p><strong>Quantity:</strong> ${orderInfo.quantity}</p>` : ''}
                        ${orderInfo.orderItems && orderInfo.orderItems.length > 1 ? `
                            <details>
                                <summary><strong>Multiple Items (${orderInfo.orderItems.length})</strong></summary>
                                <ul style="margin-top: 8px;">
                                    ${orderInfo.orderItems.map(item => `<li>${item.name}</li>`).join('')}
                                </ul>
                            </details>
                        ` : ''}
                    </div>
                    <div class="cryptoinsure-insurance-calculation">
                        <div class="cryptoinsure-premium-box">
                            <h3>Insurance Premium Calculation</h3>
                            <div class="cryptoinsure-premium-details">
                                <p><strong>Order Value:</strong> ${orderInfo.orderTotal || 'N/A'}</p>
                                <p><strong>Insurance Coverage:</strong> 100% of order value</p>
                                <p><strong>Premium Rate:</strong> 2.5% of order value</p>
                                <hr style="margin: 12px 0; border: none; border-top: 1px solid #ddd;">
                                <p class="cryptoinsure-premium-total">
                                    <strong>Insurance Premium: ${calculateInsurancePremium(orderInfo.orderTotal)}</strong>
                                </p>
                            </div>
                            <div class="cryptoinsure-coverage-info">
                                <small>
                                    <strong>Coverage for</strong> Price drops
                                </small>
                            </div>
                        </div>
                    </div>
                    <div class="cryptoinsure-crypto-info">
                        <p>💰 <strong>Pay with Crypto:</strong> ETH, BTC, USDC accepted</p>
                        <p>⚡ <strong>Instant Claims:</strong> Smart contract automation</p>
                        <p>🌍 <strong>Global Coverage:</strong> Worldwide protection</p>
                    </div>
                    <div class="cryptoinsure-qr-section">
                        <h3>Mobile Checkout</h3>
                        <div class="cryptoinsure-qr-wrapper">
                            <img id="${qrImageId}" class="cryptoinsure-qr-image" alt="ripextension mobile checkout QR" />
                        </div>
                        <p class="cryptoinsure-qr-info">Scan to continue using mobile.</p>
                    </div>
                </div>
                <div class="cryptoinsure-modal-footer">
                    <button class="cryptoinsure-btn-secondary" id="cryptoinsure-cancel">Cancel</button>
                    <button class="cryptoinsure-btn-primary" id="cryptoinsure-get-quote">Get Quote Via Webapp</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        document.getElementById('cryptoinsure-close').addEventListener('click', closeModal);
        document.getElementById('cryptoinsure-cancel').addEventListener('click', closeModal);
        document.getElementById('cryptoinsure-get-quote').addEventListener('click', function () {
            handleGetQuote(orderInfo);
        });

        const qrImageElement = document.getElementById(qrImageId);
        if (qrImageElement) {
            const qrData = buildInvoiceQrData(invoicePayload);
            qrImageElement.src = qrData.src;
            qrImageElement.dataset.invoiceJson = qrData.jsonString;
            console.log('ripextension: Generated invoice payload for QR:', invoicePayload);
        }

        modal.addEventListener('click', function (event) {
            if (event.target === modal) {
                closeModal();
            }
        });
    }

    function closeModal() {
        const modal = document.getElementById('cryptoinsure-modal');
        if (modal) {
            modal.remove();
        }
    }

    async function handleGetQuote(orderInfo) {
        const insuranceType = 'comprehensive';
        const premium = calculateInsurancePremium(orderInfo.orderTotal);

        console.log('CryptoInsure: Getting quote for comprehensive insurance', orderInfo);

        closeModal();

        try {
            if (orderInfo.asin && typeof chrome !== 'undefined' && chrome.runtime) {
                await chrome.runtime.sendMessage({
                    action: 'setSessionData',
                    data: {
                        currentAsin: orderInfo.asin,
                        currentOrderInfo: orderInfo,
                        lastUpdateTime: Date.now()
                    }
                });
                console.log('CryptoInsure: Order data stored in shared storage:', orderInfo.asin);

                const notification = document.createElement('div');
                notification.style.cssText = `
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    background: #28a745;
                    color: white;
                    padding: 10px 15px;
                    border-radius: 4px;
                    z-index: 10000;
                    font-size: 14px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
                `;
                notification.textContent = '✅ Order data captured for insurance';
                document.body.appendChild(notification);

                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 3000);
            } else if (!orderInfo.asin) {
                console.log('CryptoInsure: No ASIN found in order info, skipping storage');
            } else {
                console.log('CryptoInsure: Chrome runtime not available, using fallback');
            }

            const response = await chrome.runtime.sendMessage({
                action: 'openExternalSite',
                data: {
                    url: CONFIG.EXTERNAL_SITE_URL,
                    orderInfo: orderInfo,
                    insuranceType: insuranceType,
                    premium: premium
                }
            });

            console.log('CryptoInsure: Background script response:', response);

            if (!response.success) {
                console.error('CryptoInsure: Failed to open external site:', response.error);
                const fallbackUrl = buildInsuranceUrl(orderInfo, premium);
                window.open(fallbackUrl, '_blank');
            } else {
                console.log('CryptoInsure: External site opened with session:', response.sessionId);
            }
        } catch (error) {
            console.log('CryptoInsure: Background script communication failed, using fallback:', error.message);
            const fallbackUrl = buildInsuranceUrl(orderInfo, premium);
            window.open(fallbackUrl, '_blank');
        }
    }

    function buildInsuranceUrl(orderInfo, premium) {
        const baseUrl = CONFIG.EXTERNAL_SITE_URL;
        const params = new URLSearchParams();

        if (orderInfo.orderId) params.set('orderId', orderInfo.orderId);
        if (orderInfo.productName) params.set('productName', orderInfo.productName);
        if (orderInfo.orderTotal) params.set('orderTotal', orderInfo.orderTotal);
        if (orderInfo.orderDate) params.set('orderDate', orderInfo.orderDate);
        if (orderInfo.orderStatus) params.set('orderStatus', orderInfo.orderStatus);
        if (orderInfo.seller) params.set('seller', orderInfo.seller);
        if (orderInfo.asin) params.set('asin', orderInfo.asin);
        if (orderInfo.quantity) params.set('quantity', orderInfo.quantity);
        if (orderInfo.shipmentId) params.set('shipmentId', orderInfo.shipmentId);
        if (orderInfo.trackingId) params.set('trackingId', orderInfo.trackingId);
        if (orderInfo.invoiceUrl) params.set('invoiceUrl', orderInfo.invoiceUrl);

        if (orderInfo.invoiceDetails && orderInfo.invoiceDetails.unitPrice) {
            params.set('unitPrice', orderInfo.invoiceDetails.unitPrice);
        }

        params.set('insuranceType', 'comprehensive');
        if (premium) params.set('premium', premium);

        if (orderInfo.orderItems && orderInfo.orderItems.length > 0) {
            params.set('orderItems', JSON.stringify(orderInfo.orderItems));
        }

        params.set('source', 'amazon-extension');
        params.set('timestamp', Date.now().toString());

        return `${baseUrl}?${params.toString()}`;
    }

    function injectInsureButtons() {
        let buttonsInjected = 0;

        CONFIG.ORDER_ACTION_SELECTORS.forEach(selector => {
            const containers = document.querySelectorAll(selector);

            containers.forEach(container => {
                if (container.querySelector('.cryptoinsure-button')) {
                    return;
                }

                const insureButton = createInsureButton();
                const listItem = document.createElement('li');
                listItem.appendChild(insureButton);
                container.appendChild(listItem);
                buttonsInjected += 1;

                console.log('CryptoInsure: Injected button into', selector);
            });
        });

        return buttonsInjected;
    }

    Amazon.calculateInsurancePremium = calculateInsurancePremium;
    Amazon.createInsureButton = createInsureButton;
    Amazon.handleInsureClick = handleInsureClick;
    Amazon.createInsuranceModal = createInsuranceModal;
    Amazon.closeInsuranceModal = closeModal;
    Amazon.handleGetQuote = handleGetQuote;
    Amazon.buildInsuranceUrl = buildInsuranceUrl;
    Amazon.injectInsureButtons = injectInsureButtons;
})();
