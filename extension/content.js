
function scanPage() {
    const sensitiveElements = [];
    const pageText = document.body.innerText;
    const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
    const phonePattern = /\b(?:\+91[-\s]?)?[6-9]\d{9}\b/g;
    
    const emails = pageText.match(emailPattern) || [];
    emails.forEach((email) => {
        sensitiveElements.push({
            category: "Email Address",
            tag: "PAGE TEXT",
            type: "text",
            value: email
        });
    });

    const phoneNumbers = pageText.match(phonePattern) || [];
    phoneNumbers.forEach((phone) => {
        sensitiveElements.push({
            category: "Phone Number",
            tag: "PAGE TEXT",
            type: "text",
            value: phone
        });
    })

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
