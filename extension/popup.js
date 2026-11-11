
import {
    recogniseText,
    extractOCRWords,
    groupOCRWords
} from "./ocr.bundle.js";

document.getElementById("scan").addEventListener(
    "click",
    async () => {
        const resultdiv = document.getElementById("results");
        resultdiv.textContent = "Scanning...";

        try {
            const [tab] = await chrome.tabs.query({
                active: true,
                currentWindow: true
            });

            // 1. Capture screenshot
            const screenshot = await chrome.tabs.captureVisibleTab(
                tab.windowId,
                { format: "png" }
            );

            const screenshotImage = new Image();
            screenshotImage.src = screenshot;

            await new Promise((resolve, reject) => {
                screenshotImage.onload = resolve;
                screenshotImage.onerror = reject;
            });

            console.log("SCREENSHOT DIMENSIONS:", {
                width: screenshotImage.naturalWidth,
                height: screenshotImage.naturalHeight,
                devicePixelRatio: window.devicePixelRatio
            });

            // 2. Run OCR
            const ocr_res = await recogniseText(screenshot);

            console.log("OCR RAW TEXT:", ocr_res.text);

            const tsv = ocr_res.tsv;

            if (typeof tsv !== "string") {
                throw new Error("OCR TSV is not a string.");
            }

            // 3. Extract and group OCR words
            const ocrWords = extractOCRWords(tsv);
            const ocrLines = groupOCRWords(ocrWords);

            console.log("OCR WORD COUNT:", ocrWords.length);

            console.table(
                ocrLines.map((line, index) => ({
                    index,
                    text: line.text,
                    wordCount: line.words.length
                }))
            );

            // 4. Detect sensitive information
            const contextualDetections =
                detectContextualOCRValues(ocrLines);

            console.log(
                "CONTEXTUAL OCR DETECTIONS:",
                contextualDetections
            );

            // 5. Collect unique redaction boxes
            const contextualBoxes = Array.from(
                new Map(
                    contextualDetections
                        .flatMap(detection => detection.words)
                        .map(word => [
                            `${word.x}-${word.y}-${word.width}-${word.height}`,
                            word
                        ])
                ).values()
            );

            console.log("SENSITIVE BOXES:", contextualBoxes);

            // 6. Redact screenshot
            const redactedScreenshot = await redactScreenshot(
                screenshot,
                contextualBoxes
            );

            // 7. Scan DOM across all frames
            const frames = await chrome.webNavigation.getAllFrames({
                tabId: tab.id
            });

            let allResults = [];

            for (const frame of frames) {
                try {
                    const response = await chrome.tabs.sendMessage(
                        tab.id,
                        { action: "SCAN_PAGE" },
                        { frameId: frame.frameId }
                    );

                    if (response?.results) {
                        allResults.push(...response.results);
                    }
                } catch (error) {
                    console.warn(
                        "Could not scan frame:",
                        frame.frameId,
                        error
                    );
                }
            }

            // 8. Display results
            resultdiv.replaceChildren();

            const heading = document.createElement("h3");
            heading.textContent = `DOM Detected: ${allResults.length}`;
            resultdiv.appendChild(heading);

            allResults.forEach(item => {
                const div = document.createElement("div");
                div.className = "item";
                div.textContent = `${item.category} (${item.tag})`;
                resultdiv.appendChild(div);
            });

            const ocrHeading = document.createElement("h3");
            ocrHeading.textContent =
                `Visual detections: ${contextualDetections.length}`;

            resultdiv.appendChild(ocrHeading);

            contextualDetections.forEach(item => {
                const div = document.createElement("div");
                div.className = "item";
                div.textContent = item.category;
                resultdiv.appendChild(div);
            });

            const preview = document.createElement("img");
            preview.src = redactedScreenshot;
            preview.style.width = "100%";
            preview.style.marginTop = "15px";

            resultdiv.appendChild(preview);

        } catch (error) {
            console.error("SCAN ERROR:", error);
            resultdiv.textContent = "Scan failed: " + error.message;
        }
    }
);


// --------------------------------------------------
// SCREENSHOT REDACTION
// --------------------------------------------------

async function redactScreenshot(screenshot, boxes) {
    const img = new Image();
    img.src = screenshot;

    await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
    });

    const canvas = document.createElement("canvas");

    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);

    ctx.fillStyle = "black";

    for (const box of boxes) {
        const padding = 4;

        ctx.fillRect(
            Math.max(0, box.x - padding),
            Math.max(0, box.y - padding),
            box.width + padding * 2,
            box.height + padding * 2
        );
    }

    return canvas.toDataURL("image/png");
}


// --------------------------------------------------
// OCR DETECTION
// --------------------------------------------------

function detectContextualOCRValues(ocrLines) {
    const detected = [];
    const consumed = new Set();

    const labels = [
        // Names
        { words: ["father", "name"], category: "father name" },
        { words: ["fathers", "name"], category: "father name" },
        { words: ["mother", "name"], category: "mother name" },
        { words: ["mothers", "name"], category: "mother name" },
        { words: ["guardian", "name"], category: "guardian name" },
        { words: ["student", "name"], category: "student name" },
        { words: ["full", "name"], category: "full name" },
        { words: ["name"], category: "name" },

        // Date of birth
        { words: ["date", "of", "birth"], category: "date of birth" },
        { words: ["dob"], category: "date of birth" },
        { words: ["birth", "date"], category: "date of birth" },

        // Addresses
        { words: ["permanent", "address"], category: "address" },
        { words: ["present", "address"], category: "address" },
        { words: ["correspondence", "address"], category: "address" },
        { words: ["residential", "address"], category: "address" },
        { words: ["postal", "address"], category: "address" },
        { words: ["address"], category: "address" },
        { words: ["house", "no"], category: "house number" },
        { words: ["house", "number"], category: "house number" },
        { words: ["street"], category: "street" },
        { words: ["locality"], category: "locality" },
        { words: ["district"], category: "district" },
        { words: ["state"], category: "state" },
        { words: ["pin", "code"], category: "pin code" },
        { words: ["pincode"], category: "pin code" },
        { words: ["postal", "code"], category: "pin code" },

        // Other details
        { words: ["email"], category: "email" },
        { words: ["phone"], category: "phone" },
        { words: ["mobile"], category: "phone" },
        { words: ["contact"], category: "phone" }
    ];

    const normalize = word =>
        word.toLowerCase().replace(/[^a-z0-9]/g, "");

    function addDetection(category, words) {
        const validWords = words.filter(Boolean);

        if (!validWords.length) return;

        const key = validWords.map(word =>
            `${word.x}-${word.y}-${word.width}-${word.height}`
        ).join("|");

        if (consumed.has(key)) return;

        consumed.add(key);

        detected.push({
            category,
            value: validWords.map(word => word.text).join(" "),
            words: validWords
        });
    }

    // 1. Contextual label detection
    for (let lineIndex = 0; lineIndex < ocrLines.length; lineIndex++) {
        const line = ocrLines[lineIndex];
        const words = line.words;

        const normalized = words.map(word => normalize(word.text));

        const matchingLabel = labels.find(label =>
            label.words.every((part, index) =>
                normalized[index] === part
            )
        );

        if (!matchingLabel) continue;

        let valueWords = words.slice(matchingLabel.words.length);

        // If the value is on the next line, use that line.
        if (valueWords.length === 0 && lineIndex + 1 < ocrLines.length) {
            valueWords = ocrLines[lineIndex + 1].words;

            // Avoid consuming another label as a value.
            const nextText = valueWords.map(word => normalize(word.text));

            const isAnotherLabel = labels.some(label =>
                label.words.every((part, index) =>
                    nextText[index] === part
                )
            );

            if (isAnotherLabel) continue;
        }

        addDetection(matchingLabel.category, valueWords);
    }

    // 2. Email detection
    for (const line of ocrLines) {
        const text = line.text;

        const emailRegex =
            /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

        let match;

        while ((match = emailRegex.exec(text)) !== null) {
            const matchedWords = findWordsInRange(
                line,
                match.index,
                match.index + match[0].length
            );

            addDetection("email", matchedWords);
        }
    }

    // 3. Indian phone detection
    for (const line of ocrLines) {
        const text = line.text;

        const phoneRegex =
            /(?:\+91[\s-]?)?[6-9]\d{9}/g;

        let match;

        while ((match = phoneRegex.exec(text)) !== null) {
            const matchedWords = findWordsInRange(
                line,
                match.index,
                match.index + match[0].length
            );

            addDetection("phone", matchedWords);
        }
    }

    console.log("OCR DETECTION DETAILS:", detected);

    return detected;
}


// --------------------------------------------------
// MATCH OCR WORDS TO CHARACTER POSITIONS
// --------------------------------------------------

function findWordsInRange(line, start, end) {
    const matched = [];
    let position = 0;

    for (const word of line.words) {
        const wordStart = position;
        const wordEnd = wordStart + word.text.length;

        if (wordEnd > start && wordStart < end) {
            matched.push(word);
        }

        position = wordEnd + 1;
    }

    return matched;
}


// --------------------------------------------------
// RESTORE ORIGINAL WEBPAGE
// --------------------------------------------------

document.getElementById("restore").addEventListener(
    "click",
    async () => {
        const [tab] = await chrome.tabs.query({
            active: true,
            currentWindow: true
        });

        const frames = await chrome.webNavigation.getAllFrames({
            tabId: tab.id
        });

        for (const frame of frames) {
            try {
                await chrome.tabs.sendMessage(
                    tab.id,
                    { action: "RESTORE_PAGE" },
                    { frameId: frame.frameId }
                );
            } catch (error) {
                console.warn(
                    "Could not restore frame:",
                    frame.frameId,
                    error
                );
            }
        }

        document.getElementById("results").textContent =
            "Original Page text restored";
    }
);