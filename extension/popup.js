
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

            // 4. Detect sensitive information using OCR
            const contextualDetections =
                detectContextualOCRValues(ocrLines);

            console.log(
                "CONTEXTUAL OCR DETECTIONS:",
                contextualDetections
            );

            // 5. Collect OCR redaction boxes
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

            // 6. Scan DOM across all frames
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
                        allResults.push(
                            ...response.results.map(item => ({
                                ...item,
                                frameId: frame.frameId,
                                viewport: response.viewport
                            }))
                        );
                    }
                } catch (error) {
                    console.warn(
                        "Could not scan frame:",
                        frame.frameId,
                        error
                    );
                }
            }


            // 7. Collect positions of ALL DOM-detected
            // sensitive elements in the top-level frame.
            const domBoxes = [];

            const topFrameResult = allResults.find(
                item =>
                    item.frameId === 0 &&
                    item.bounds &&
                    item.viewport
            );

            if (topFrameResult) {
                const viewport = topFrameResult.viewport;

                const scaleX =
                    screenshotImage.naturalWidth / viewport.width;

                const scaleY =
                    screenshotImage.naturalHeight / viewport.height;

                allResults
                    .filter(item =>
                        item.frameId === 0 &&
                        item.bounds
                    )
                    .forEach(item => {
                        domBoxes.push({
                            x: item.bounds.x * scaleX,
                            y: item.bounds.y * scaleY,
                            width: item.bounds.width * scaleX,
                            height: item.bounds.height * scaleY
                        });
                    });
            }

            console.log("DOM REDACTION BOXES:", domBoxes);

            // 8. Combine OCR and DOM redaction boxes.
            const allBoxes = [
                ...contextualBoxes,
                ...domBoxes
            ];

            const uniqueBoxes = Array.from(
                new Map(
                    allBoxes.map(box => [
                        `${box.x}-${box.y}-${box.width}-${box.height}`,
                        box
                    ])
                ).values()
            );

            console.log("SENSITIVE BOXES:", uniqueBoxes);


            // 9. Redact screenshot
            const redactedScreenshot = await redactScreenshot(
                screenshot,
                uniqueBoxes
            );

            // 10. Display results
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
    const detectedWordKeys = new Set();
    const tableHeaderLines = new Set();

    const labels = [
        // Names
        { words: ["father", "name"], category: "father name" },
        { words: ["fathers", "name"], category: "father name" },
        { words: ["mother", "name"], category: "mother name" },
        { words: ["mothers", "name"], category: "mother name" },
        { words: ["guardian", "name"], category: "guardian name" },
        { words: ["student", "name"], category: "student name" },
        { words: ["full", "name"], category: "full name" },
        { words: ["first", "name"], category: "first name" },
        { words: ["last", "name"], category: "last name" },
        { words: ["middle", "name"], category: "middle name" },
        { words: ["name"], category: "name" },

        // Usernames
        { words: ["user", "name"], category: "username" },
        { words: ["username"], category: "username" },
        { words: ["login", "id"], category: "username" },

        // DOB
        { words: ["date", "of", "birth"], category: "date of birth" },
        { words: ["date", "birth"], category: "date of birth" },
        { words: ["birth", "date"], category: "date of birth" },
        { words: ["dob"], category: "date of birth" },

        // Addresses
        { words: ["current", "address"], category: "address" },
        { words: ["permanent", "address"], category: "address" },
        { words: ["present", "address"], category: "address" },
        { words: ["communication", "address"], category: "address" },
        { words: ["mailing", "address"], category: "address" },
        { words: ["residential", "address"], category: "address" },
        { words: ["correspondence", "address"], category: "address" },
        { words: ["postal", "address"], category: "address" },
        { words: ["address"], category: "address" },
        { words: ["house", "number"], category: "house number" },
        { words: ["house", "no"], category: "house number" },
        { words: ["street"], category: "street" },
        { words: ["locality"], category: "locality" },
        { words: ["district"], category: "district" },
        { words: ["state"], category: "state" },
        { words: ["pin", "code"], category: "pin code" },
        { words: ["pincode"], category: "pin code" },
        { words: ["postal", "code"], category: "pin code" }
    ];

    // Sensitive and non-sensitive table headers.
    // Non-sensitive headers are used ONLY to calculate boundaries.
    const tableHeaders = [
        { label: "first name", category: "Person Name", sensitive: true },
        { label: "last name", category: "Person Name", sensitive: true },
        { label: "email address", category: "Email", sensitive: true },
        { label: "email", category: "Email", sensitive: true },
        { label: "phone", category: "Phone Number", sensitive: true },
        { label: "mobile", category: "Phone Number", sensitive: true },

        { label: "due", sensitive: false },
        { label: "web site", sensitive: false },
        { label: "website", sensitive: false },
        { label: "action", sensitive: false }
    ];

    const normalize = value =>
        value.toLowerCase().replace(/[^a-z0-9]/g, "");

    function wordKey(word) {
        return `${word.x}-${word.y}-${word.width}-${word.height}`;
    }

    function addDetection(category, words) {
        const uniqueWords = words.filter(word => {
            if (!word) return false;
            return !detectedWordKeys.has(wordKey(word));
        });

        if (!uniqueWords.length) return;

        uniqueWords.forEach(word => {
            detectedWordKeys.add(wordKey(word));
        });

        detected.push({
            category,
            value: uniqueWords.map(word => word.text).join(" "),
            words: uniqueWords
        });
    }

    // Supports both { words: [...] } and { label: "..." } definitions.
    function findMatches(line, labelList) {
        const normalized = line.words.map(word =>
            normalize(word.text)
        );

        const matches = [];

        for (const label of labelList) {
            const parts = label.words
                ? label.words
                : label.label.split(/\s+/).map(normalize);

            for (
                let i = 0;
                i <= normalized.length - parts.length;
                i++
            ) {
                const matchesLabel = parts.every(
                    (part, offset) =>
                        normalized[i + offset] === part
                );

                if (!matchesLabel) continue;

                const lastWord = line.words[i + parts.length - 1];

                matches.push({
                    start: i,
                    end: i + parts.length - 1,
                    category: label.category,
                    sensitive: label.sensitive,
                    centerX: (
                        line.words[i].x +
                        lastWord.x +
                        lastWord.width
                    ) / 2
                });
            }
        }

        // Prefer longer labels and avoid overlapping matches.
        matches.sort((a, b) =>
            (b.end - b.start) - (a.end - a.start)
        );

        const accepted = [];
        const occupied = new Set();

        for (const match of matches) {
            let overlaps = false;

            for (let i = match.start; i <= match.end; i++) {
                if (occupied.has(i)) {
                    overlaps = true;
                    break;
                }
            }

            if (overlaps) continue;

            accepted.push(match);

            for (let i = match.start; i <= match.end; i++) {
                occupied.add(i);
            }
        }

        return accepted;
    }

    function getLineTop(line) {
        return Math.min(...line.words.map(word => word.y));
    }

    function getLineBottom(line) {
        return Math.max(
            ...line.words.map(word => word.y + word.height)
        );
    }

    function getLineHeight(line) {
        return line.words.reduce(
            (sum, word) => sum + word.height,
            0
        ) / line.words.length;
    }

    // --------------------------------------------------
    // 1. TABLE COLUMN DETECTION
    // --------------------------------------------------

    for (
        let headerIndex = 0;
        headerIndex < ocrLines.length;
        headerIndex++
    ) {
        const headerLine = ocrLines[headerIndex];

        // Find ALL headers, including non-sensitive boundaries.
        const allHeaders = findMatches(
            headerLine,
            tableHeaders
        );

        const sensitiveHeaders = allHeaders.filter(
            header => header.sensitive
        );

        // Require at least two distinct sensitive columns.
        const sensitiveCategories = new Set(
            sensitiveHeaders.map(header => header.category)
        );

        if (sensitiveCategories.size < 2) continue;

        tableHeaderLines.add(headerIndex);

        // Sort ALL columns horizontally.
        const sortedHeaders = [...allHeaders].sort(
            (a, b) => a.centerX - b.centerX
        );

        const headerBottom = getLineBottom(headerLine);
        const headerHeight = getLineHeight(headerLine);

        let previousBottom = headerBottom;
        let processedRows = 0;

        for (
            let rowIndex = headerIndex + 1;
            rowIndex < ocrLines.length && processedRows < 10;
            rowIndex++
        ) {
            const row = ocrLines[rowIndex];

            if (!row.words.length) continue;

            // Stop if another table header appears.
            const nextHeaders = findMatches(row, tableHeaders);
            const nextSensitiveHeaders = nextHeaders.filter(
                header => header.sensitive
            );

            if (nextSensitiveHeaders.length >= 2) break;

            const rowTop = getLineTop(row);
            const rowBottom = getLineBottom(row);

            const verticalGap = rowTop - previousBottom;

            if (
                verticalGap >
                Math.max(35, headerHeight * 2.5)
            ) {
                break;
            }

            previousBottom = rowBottom;
            processedRows++;

            // Only redact sensitive columns.
            for (
                const header of sensitiveHeaders
            ) {
                const columnIndex = sortedHeaders.indexOf(header);

                const previousHeader =
                    sortedHeaders[columnIndex - 1];

                const nextHeader =
                    sortedHeaders[columnIndex + 1];

                const headerFirstWord =
                    headerLine.words[header.start];

                const headerLastWord =
                    headerLine.words[header.end];

                const leftBoundary = previousHeader
                    ? (
                        previousHeader.centerX +
                        header.centerX
                    ) / 2
                    : headerFirstWord.x - 15;

                const rightBoundary = nextHeader
                    ? (
                        header.centerX +
                        nextHeader.centerX
                    ) / 2
                    : (
                        headerLastWord.x +
                        headerLastWord.width +
                        15
                    );

                const valueWords = row.words.filter(word => {
                    const center = word.x + word.width / 2;

                    return (
                        center >= leftBoundary &&
                        center < rightBoundary
                    );
                });

                if (valueWords.length) {
                    addDetection(header.category, valueWords);
                }
            }
        }
    }

    // --------------------------------------------------
    // 2. FORM LABEL DETECTION
    // --------------------------------------------------

    for (
        let lineIndex = 0;
        lineIndex < ocrLines.length;
        lineIndex++
    ) {
        if (tableHeaderLines.has(lineIndex)) continue;

        const line = ocrLines[lineIndex];
        const matches = findMatches(line, labels);

        if (!matches.length) continue;

        const sortedMatches = [...matches].sort(
            (a, b) => a.centerX - b.centerX
        );

        for (const match of matches) {
            const position = sortedMatches.indexOf(match);

            const leftBoundary = position === 0
                ? -Infinity
                : (
                    sortedMatches[position - 1].centerX +
                    match.centerX
                ) / 2;

            const rightBoundary =
                position === sortedMatches.length - 1
                    ? Infinity
                    : (
                        match.centerX +
                        sortedMatches[position + 1].centerX
                    ) / 2;

            // Look for a value on the same line.
            const sameLineWords = line.words.filter(
                (word, index) => {
                    const center = word.x + word.width / 2;

                    return (
                        index > match.end &&
                        center > match.centerX &&
                        center < rightBoundary
                    );
                }
            );

            if (sameLineWords.length) {
                addDetection(match.category, sameLineWords);
                continue;
            }

            // Otherwise inspect the next line.
            if (lineIndex + 1 >= ocrLines.length) continue;

            const nextLine = ocrLines[lineIndex + 1];

            if (!nextLine.words.length) continue;

            const verticalGap =
                getLineTop(nextLine) - getLineBottom(line);

            const maxGap = Math.max(
                35,
                getLineHeight(line) * 2.5
            );

            if (verticalGap > maxGap) continue;

            const nextLineLabels = findMatches(nextLine, labels);
            const labelIndexes = new Set();

            for (const label of nextLineLabels) {
                for (let i = label.start; i <= label.end; i++) {
                    labelIndexes.add(i);
                }
            }

            const valueWords = nextLine.words.filter(
                (word, index) => {
                    const center = word.x + word.width / 2;

                    return (
                        !labelIndexes.has(index) &&
                        center >= leftBoundary &&
                        center <= rightBoundary
                    );
                }
            );

            if (valueWords.length) {
                addDetection(match.category, valueWords);
            }
        }
    }

    // --------------------------------------------------
    // 3. EMAIL DETECTION
    // --------------------------------------------------

    for (const line of ocrLines) {
        const emailRegex =
            /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

        let match;

        while ((match = emailRegex.exec(line.text)) !== null) {
            const words = findWordsInRange(
                line,
                match.index,
                match.index + match[0].length
            );

            addDetection("email", words);
        }
    }

    // --------------------------------------------------
    // 4. INDIAN PHONE DETECTION
    // --------------------------------------------------

    for (const line of ocrLines) {
        const phoneRegex = /(?:\+91[\s-]?)?[6-9]\d{9}/g;

        let match;

        while ((match = phoneRegex.exec(line.text)) !== null) {
            const words = findWordsInRange(
                line,
                match.index,
                match.index + match[0].length
            );

            addDetection("phone", words);
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