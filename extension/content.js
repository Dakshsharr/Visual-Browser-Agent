
function scanPage() {
    const sensitiveElements = [];
    const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
    const phonePattern = /\b(?:\+91[-\s]?)?[6-9]\d{9}\b/i;
    
    const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT
    );

    let node;

    while ((node = walker.nextNode())) {
        const text = node.textContent.trim();

        if (emailPattern.test(text)) {
            const element = node.parentElement;

            sensitiveElements.push({
                category: "Email Address",
                tag: element?.tagName,
                type: "text",
                element: element
            });
        }

        if (phonePattern.test(text)){
            const element = node.parentElement;

            sensitiveElements.push({
                category: "Phone Number",
                tag: element?.tagName,
                type: "text",
                element: element
            });
        }
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
            /phone|mobile|telephone/.test(metadata)
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
                field: input.name || input.id || "Unnamed field"
            });
        }
    });

    return sensitiveElements;
}

chrome.runtime.onMessage.addListener(
    (message, sender, sendResponse) => {
        if (message.action === "SCAN_PAGE") {
            const results = scanPage();
            sendResponse({
                total: results.length,
                results
            });
        }
    }
);
