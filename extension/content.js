const originalTextMap = new Map();
const originalInputMap = new Map();
const originalContextMap = new Map();
const inputDetectionRules = globalThis.INPUT_DETECTION_RULES;
const textDetectionRules = globalThis.TEXT_DETECTION_RULES;

function scanPage() {
    const sensitiveElements = [];
    const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT
    );

    let node;

    while ((node = walker.nextNode())) {
        const text = (
            originalTextMap.has(node)
                ? originalTextMap.get(node)
                : node.textContent
        ).trim();
        
        const element = node.parentElement;
        textDetectionRules.forEach((rule) => {
            const matches = text.matchAll(rule.pattern);
            for (const match of matches) {
                sensitiveElements.push({
                    category: rule.category,
                    tag: element?.tagName,
                    type: "text",
                    element: element,
                    textNode: node,
                    matchedText: match[0]
                });
            }
        });
    }

    const inputs = document.querySelectorAll("input, textarea, select");

    inputs.forEach((input) => {
        const tag = input.tagName?.toLowerCase() || "unknown";
        const type = (
            input.getAttribute("type") || tag
        ).toLowerCase();

        const metadata = [
            input.name,
            input.id,
            input.getAttribute("placeholder"),
            input.getAttribute("aria-label"),
            input.getAttribute("autocomplete")
        ].join(" ").toLowerCase();

        const matchedRules = inputDetectionRules.filter((rule) => {
            const typeMatches = rule.types.includes(type);
            const metadatMatches = rule.keywords.some((keyword) => {
                return metadata.includes(keyword)
            });
            return typeMatches || metadatMatches;
        })

        matchedRules.forEach((rule) => {
            sensitiveElements.push({
                category: rule.category,
                tag: input.tagName,
                type: type,
                element: input,
                field: input.name || input.id || "Unnamed field"
            });
        });
    });
    const contextResults = detectContextualData();
    sensitiveElements.push(...contextResults);
    return sensitiveElements;
}

function detectContextualData() {

    const sensitiveElements = [];

    globalThis.CONTEXT_DETECTION_RULES.forEach((rule) => {

        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_ELEMENT
        );

        let element;

        while ((element = walker.nextNode())) {
            if (element.children.length > 0){
                continue;
            }

            const elementText = element.textContent
                .trim()
                .toLowerCase()
                .replace(/['’]/g, "")
                .replace(/[:*]/g, "")
                .replace(/\s+/g, " ");

            const labelMatches = rule.keywords.some((keyword) => {

                const normalizedKeyword = keyword
                    .toLowerCase()
                    .replace(/['’]/g, "")
                    .replace(/[:*]/g, "")
                    .replace(/\s+/g, " ")
                    .trim();

                return elementText === normalizedKeyword;
            });

            if (!labelMatches) continue;

            let valueElement = null;

            if (rule.relationship === "next-cell") {

                const cell = element.closest("td, th");

                if (cell) {
                    valueElement = cell.nextElementSibling;
                }
            }
            else if (rule.relationship === "next-element") {

                valueElement = element.nextElementSibling;
            }
            else if (rule.relationship === "next-cell-or-container") {
                const cell = element.closest("td, th");

                if (cell) {
                    valueElement = cell.nextElementSibling;
                }
                else {
                    const parent = element.parentElement;

                    if (parent) {
                        valueElement = parent.nextElementSibling;
                    }
                }
            }

            if (!valueElement) continue;

            sensitiveElements.push({
                category: rule.category,
                element: valueElement,
                type: "context"
            });

        }
    });

    return sensitiveElements;
}

function redactSensitiveInfo(results) {

    const textMatches = new Map();

    results.forEach((item) => {

        const element = item.element;

       
        if (
            element &&
            ["INPUT", "TEXTAREA", "SELECT"].includes(element.tagName)
        ) {
            if (!originalInputMap.has(element)) {
                originalInputMap.set(element, element.value);
            }

            element.value = "[REDACTED]";
            return;
        }

        if (item.type === "context") {
            if (!element || !element.isConnected) return;
            if (!originalContextMap.has(element)) {
                originalContextMap.set(element, element.innerHTML);
            }
            element.textContent = "[REDACTED]";
            return;
        }
        
        const node = item.textNode;

        if (!node || !node.textContent) return;

        if (!textMatches.has(node)) {
            textMatches.set(node, []);
        }

        textMatches.get(node).push(item.matchedText);

    });

    
    textMatches.forEach((matches, node) => {

        if (!originalTextMap.has(node)) {
            originalTextMap.set(node, node.textContent);
        }

        const originalText = originalTextMap.get(node);

        const uniqueMatches = [...new Set(matches)]
            .filter(Boolean)
            .sort((a, b) => b.length - a.length);

        if (uniqueMatches.length === 0) return;

        const escapedMatches = uniqueMatches.map((value) => {
            return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        });

        const pattern = new RegExp(
            escapedMatches.join("|"),
            "g"
        );

        node.textContent = originalText.replace(
            pattern,
            "[REDACTED]"
        );

    });

}

function restoreOriginalText() {
    originalTextMap.forEach((originalText, node) => {
        if (node && node.isConnected){
            node.textContent = originalText;
        }
    });
    originalTextMap.clear();

    originalContextMap.forEach((originalHTML, element) => {
        if (element && element.isConnected) {
            element.innerHTML = originalHTML;
        }
    });
    originalContextMap.clear();

    originalInputMap.forEach((originalValue, input) => {
        if (input && input.isConnected) {
            input.value = originalValue;
        }
    });
    originalInputMap.clear();
}

chrome.runtime.onMessage.addListener(
    (message, sender, sendResponse) => {
        if (message.action === "SCAN_PAGE") {
            const results = scanPage();
            redactSensitiveInfo(results);
            const safeResults = results.map((item)=>({
                category: item.category,
                tag: item.tag,
                type: item.type
            }));
            sendResponse({
                total: safeResults.length,
                results: safeResults
            });
        }

        if (message.action === "RESTORE_PAGE") {
            restoreOriginalText();
            sendResponse({ success: true });
        }
    }
);
