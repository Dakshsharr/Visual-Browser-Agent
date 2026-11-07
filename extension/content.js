const originalTextMap = new Map();
const originalInputMap = new Map();
function scanPage() {
    const sensitiveElements = [];
    const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
    const phonePattern = /\b(?:\+91[-\s]?)?[6-9]\d{9}\b/gi;
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
        const emailMatches = [...text.matchAll(emailPattern)];
        emailMatches.forEach((match) => {
            sensitiveElements.push({
                category: "Email Address",
                tag: element?.tagName,
                type: "text",
                element: element,
                textNode: node,
                matchedText: match[0]
            });
        });

        const phoneMatches = [...text.matchAll(phonePattern)];

        phoneMatches.forEach((match) => {
            sensitiveElements.push({
                category: "Phone Number",
                tag: element?.tagName,
                type: "text",
                element: element,
                textNode: node,
                matchedText: match[0]
            });
        });
    }

    const inputs = document.querySelectorAll("input");

    inputs.forEach((input) => {
        const type = (input.type || "").toLowerCase();

        const metadata = [
            input.name,
            input.id,
            input.getAttribute("placeholder"),
            input.getAttribute("aria-label"),
            input.getAttribute("autocomplete")
        ].join(" ").toLowerCase();

        let category = null;

        if (type === "password") {
            category = "Password";
        }

        else if (
            type === "email" ||
            /email|e-mail/.test(metadata) ||
            input.getAttribute("autocomplete") === "username"
        ) {
            category = "Email / Username";
        }

        else if (
            type === "tel" ||
            /phone|mobile|telephone|cell|cellno|tel|tellno/.test(metadata)
        ) {
            category = "Phone Number";
        }

        else if (/cc-/.test(metadata)) {
            category = "Payment Information";
        }

        if (category) {
            sensitiveElements.push({
                category,
                tag: input.tagName,
                type,
                element: input,
                field: input.name || input.id || "Unnamed field"
            });
        }
    });

    return sensitiveElements;
}

function redactSensitiveInfo(results) {
    results.forEach((item) => {
        const input = item.element;
        if (input && input.tagName === "INPUT") {
            if (!originalInputMap.has(input)){
                originalInputMap.set(input, input.value);
            }
            input.value = "[REDACTED]";
            return;
        }
        const node = item.textNode;

        if (!node || !node.textContent) return;

        if (!originalTextMap.has(node)) {
            originalTextMap.set(node, node.textContent);
        }

        node.textContent = node.textContent.replace(
            item.matchedText,
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
