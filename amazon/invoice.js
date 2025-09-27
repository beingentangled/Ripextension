// Invoice discovery and PDF parsing helpers for the Amazon injector
(function () {
    'use strict';

    const Amazon = window.ripextensionAmazon = window.ripextensionAmazon || {};

    const PDFJS_MODULE_URL = typeof chrome !== 'undefined' && chrome.runtime
        ? chrome.runtime.getURL('libs/pdfjs/pdf.min.mjs')
        : null;
    const PDFJS_WORKER_URL = typeof chrome !== 'undefined' && chrome.runtime
        ? chrome.runtime.getURL('libs/pdfjs/pdf.worker.min.mjs')
        : null;

    const INVOICE_FIELD_CONFIG = [
        { key: 'orderDate', label: 'Order Date' },
        { key: 'unitPrice', label: 'Unit Price' },
        { key: 'orderNumber', label: 'Order Number' },
        { key: 'invoiceNumber', label: 'Invoice Number' },
        { key: 'paymentTransactionId', label: 'Payment Transaction ID' }
    ];

    const INVOICE_BOUNDARY_LABELS = Array.from(new Set([
        ...INVOICE_FIELD_CONFIG.map(field => field.label),
        'Invoice Details',
        'Invoice Date',
        'Invoice Value',
        'Date & Time',
        'Mode of Payment',
        'Sold By',
        'Description',
        'Qty',
        'Net Amount',
        'Tax Rate',
        'Tax Type',
        'Tax Amount',
        'Total Amount',
        'Marketplace Fees',
        'CGST',
        'SGST',
        'IGST',
        'GST',
        'Sl.'
    ]));

    function findInvoiceTrigger(scope) {
        const invoiceSelectors = [
            'a[href*="invoice"]',
            'a[data-a-popover*="invoice"]',
            '.yohtmlc-invoice-button',
            'a.yohtmlc-order-details-button'
        ];

        for (const selector of invoiceSelectors) {
            const element = scope.querySelector(selector);
            if (element) {
                return element;
            }
        }

        const invoiceButtons = Array.from(scope.querySelectorAll('a, button')).filter(el => {
            const text = el.textContent?.toLowerCase() || '';
            return text.includes('invoice') || text.includes('receipt');
        });

        return invoiceButtons.length > 0 ? invoiceButtons[0] : null;
    }

    function extractInvoiceUrlFromDom() {
        const popover = document.querySelector('.a-popover-wrapper[aria-hidden="false"]') ||
            document.querySelector('.a-popover-wrapper');

        if (!popover) {
            return null;
        }

        const downloadLink = popover.querySelector('a[href*="invoice"], a[href*="pdf"], a[href*="tax"]');
        if (downloadLink?.href) {
            return downloadLink.href;
        }

        const firstLink = popover.querySelector('ul.invoice-list a[href]');
        return firstLink ? firstLink.href : null;
    }

    function closeInvoicePopover() {
        const activePopover = document.querySelector('.a-popover-wrapper[aria-hidden="false"]');
        if (!activePopover) {
            return;
        }

        const closeButton = activePopover.querySelector('button[data-action="a-popover-close"]');
        if (closeButton) {
            closeButton.click();
        }
    }

    function waitForInvoicePopover(timeoutMs = 5000) {
        return new Promise(resolve => {
            const existingUrl = extractInvoiceUrlFromDom();
            if (existingUrl) {
                resolve(existingUrl);
                return;
            }

            const observer = new MutationObserver(() => {
                const url = extractInvoiceUrlFromDom();
                if (url) {
                    cleanup();
                    resolve(url);
                }
            });

            const cleanup = () => {
                observer.disconnect();
                clearTimeout(timerId);
            };

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });

            const timerId = setTimeout(() => {
                cleanup();
                resolve(null);
            }, timeoutMs);
        });
    }

    async function fetchInvoicePdfLink(scope) {
        try {
            const trigger = findInvoiceTrigger(scope || document);
            if (!trigger) {
                console.log('ripextension: No invoice trigger found for this order');
                return null;
            }

            try {
                trigger.click();
            } catch (clickError) {
                console.warn('ripextension: trigger.click() failed, dispatching synthetic click', clickError);
            }

            trigger.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));

            const invoiceUrl = await waitForInvoicePopover();

            if (invoiceUrl) {
                console.log('ripextension: Found invoice PDF URL:', invoiceUrl);
            } else {
                console.log('ripextension: Invoice PDF URL not found within timeout');
            }

            closeInvoicePopover();
            return invoiceUrl;
        } catch (error) {
            console.log('ripextension: Could not fetch invoice PDF link (this is optional):', error.message);
            return null;
        }
    }

    function ensurePdfJsLoaded() {
        const state = Amazon.state;
        if (state.pdfJsLoaderPromise) {
            return state.pdfJsLoaderPromise;
        }

        state.pdfJsLoaderPromise = (async () => {
            try {
                if (window.pdfjsLib) {
                    configurePdfJs(window.pdfjsLib);
                    return window.pdfjsLib;
                }

                if (!PDFJS_MODULE_URL) {
                    throw new Error('PDF.js module URL unavailable');
                }

                const pdfjsModule = await import(PDFJS_MODULE_URL);
                const pdfjsLib = pdfjsModule?.default || pdfjsModule;

                if (!pdfjsLib) {
                    throw new Error('PDF.js module did not provide a library export');
                }

                window.pdfjsLib = pdfjsLib;
                configurePdfJs(pdfjsLib);
                return pdfjsLib;
            } catch (error) {
                console.error('ripextension: Failed to load PDF.js library:', error);
                throw error;
            }
        })();

        state.pdfJsLoaderPromise.catch(() => {
            state.pdfJsLoaderPromise = null;
        });

        return state.pdfJsLoaderPromise;
    }

    function configurePdfJs(pdfjsLib) {
        if (!pdfjsLib) {
            throw new Error('pdfjsLib is not available');
        }
        const workerOptions = pdfjsLib.GlobalWorkerOptions || (pdfjsLib.GlobalWorkerOptions = {});
        if (PDFJS_WORKER_URL) {
            workerOptions.workerSrc = PDFJS_WORKER_URL;
            workerOptions.workerType = 'module';
        } else {
            workerOptions.workerSrc = null;
        }
    }

    function resolveInvoiceUrl(invoiceUrl) {
        if (!invoiceUrl) {
            return null;
        }
        try {
            const absolute = new URL(invoiceUrl, window.location.origin);
            return absolute.href;
        } catch (error) {
            console.warn('ripextension: Could not resolve invoice URL:', invoiceUrl, error);
            return invoiceUrl;
        }
    }

    function normalizePdfText(rawText) {
        if (!rawText) return '';
        return rawText
            .replace(/\u00a0/g, ' ')
            .replace(/\r\n?/g, '\n')
            .replace(/[ \t]{2,}/g, ' ')
            .replace(/\n{2,}/g, '\n')
            .trim();
    }

    function cleanDetailValue(value) {
        if (!value) return null;

        let cleaned = value;
        const newlineIndex = cleaned.indexOf('\n');
        if (newlineIndex !== -1) {
            cleaned = cleaned.slice(0, newlineIndex);
        }

        cleaned = cleaned
            .replace(/^[:\-\s]+/, '')
            .replace(/\s{2,}/g, ' ')
            .trim();

        cleaned = cleaned.replace(/[,:;\-]+$/, '').trim();

        for (const boundary of INVOICE_BOUNDARY_LABELS) {
            const boundaryPattern = new RegExp(`\\b${escapeRegex(boundary)}$`, 'i');
            if (boundaryPattern.test(cleaned)) {
                cleaned = cleaned.replace(boundaryPattern, '').trim();
            }
        }

        if (cleaned.length > 120) {
            cleaned = cleaned.slice(0, 120).trim();
        }

        return cleaned || null;
    }

    function escapeRegex(value) {
        return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function findFieldBoundary(rest) {
        let end = rest.length;

        for (const boundary of INVOICE_BOUNDARY_LABELS) {
            const boundaryPattern = new RegExp(`\\b${escapeRegex(boundary).replace(/\s+/g, '\\s+')}\\b(\n|\s*[:\-])?`, 'i');
            const match = boundaryPattern.exec(rest);
            if (match && match.index > 0 && match.index < end) {
                end = match.index;
            }
        }

        const newlineIndex = rest.indexOf('\n');
        if (newlineIndex !== -1 && newlineIndex < end) {
            end = newlineIndex;
        }

        return end;
    }

    function extractFieldValue(text, label) {
        if (!text) return null;

        const labelPattern = new RegExp(`${escapeRegex(label).replace(/\s+/g, '\\s+')}\s*[:\-]?\s*`, 'i');
        const match = labelPattern.exec(text);
        if (!match) {
            return null;
        }

        const startIndex = match.index + match[0].length;
        const rest = text.slice(startIndex);
        const endIndex = findFieldBoundary(rest);
        const rawValue = rest.slice(0, endIndex);

        return cleanDetailValue(rawValue);
    }

    function extractInvoiceDetailsFromText(text) {
        if (!text) return null;

        const details = {};

        for (const field of INVOICE_FIELD_CONFIG) {
            details[field.key] = extractFieldValue(text, field.label);
        }

        if (!details.orderNumber) {
            const match = text.match(/(\d{3}-\d{7}-\d{7})/);
            if (match) {
                details.orderNumber = match[1];
            }
        }

        if (details.orderDate) {
            const dateMatch = details.orderDate.match(/\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{4}/);
            if (dateMatch) {
                details.orderDate = dateMatch[0];
            }
        } else {
            const dateFallback = text.match(/\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{4}/);
            if (dateFallback) {
                details.orderDate = dateFallback[0];
            }
        }

        if (details.unitPrice) {
            const amountMatch = details.unitPrice.match(/(?:₹|Rs\.?|INR|USD|EUR|GBP|\$)\s*[\d,.]+|[\d,.]+/i);
            if (amountMatch) {
                details.unitPrice = amountMatch[0].replace(/\s+/g, ' ').trim();
            }
        }

        if (details.invoiceNumber) {
            const invoiceMatch = details.invoiceNumber.match(/[A-Z0-9\-]+/i);
            if (invoiceMatch) {
                details.invoiceNumber = invoiceMatch[0];
            }
        }

        if (details.paymentTransactionId) {
            const txnMatch = details.paymentTransactionId.match(/[A-Za-z0-9\-]+/);
            if (txnMatch) {
                details.paymentTransactionId = txnMatch[0];
            }
        }

        const hasValues = Object.values(details).some(value => !!value);
        return hasValues ? details : null;
    }

    async function parseInvoicePdf(invoiceUrl) {
        try {
            const pdfjsLib = await ensurePdfJsLoaded();
            const absoluteUrl = resolveInvoiceUrl(invoiceUrl);
            if (!absoluteUrl) {
                console.log('ripextension: Could not resolve PDF URL:', invoiceUrl);
                return null;
            }

            const loadingTask = pdfjsLib.getDocument({
                url: absoluteUrl,
                withCredentials: true
            });

            const pdfDocument = await loadingTask.promise;
            const maxPages = Math.min(pdfDocument.numPages || 1, 5);
            let combinedText = '';

            for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
                const page = await pdfDocument.getPage(pageNumber);
                const textContent = await page.getTextContent();
                let pageText = '';
                textContent.items.forEach(item => {
                    if (!item.str) return;
                    pageText += item.str;
                    pageText += item.hasEOL ? '\n' : ' ';
                });
                combinedText += '\n' + pageText;
            }

            const normalizedText = normalizePdfText(combinedText);
            return extractInvoiceDetailsFromText(normalizedText);
        } catch (error) {
            console.log('ripextension: Invoice PDF parsing not available (this is optional):', error.message);
            return null;
        }
    }

    Amazon.fetchInvoicePdfLink = fetchInvoicePdfLink;
    Amazon.parseInvoicePdf = parseInvoicePdf;
})();
