import {createWorker} from "tesseract.js";


function preprocessImage(image) {
    return new Promise((resolve, reject) => {
        const img = new Image();

        img.onload = () => {
            const canvas = document.createElement("canvas");
            const scale = 2;

            canvas.width = img.width * scale;
            canvas.height = img.height * scale;

            const ctx = canvas.getContext("2d");

            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = "high";

            ctx.drawImage(
                img,
                0,
                0,
                canvas.width,
                canvas.height
            );

            resolve(canvas);
        };

        img.onerror = () => {
            reject(new Error("Could not load screenshot for preprocessing."));
        };

        img.src = image;
    });
}

async function recogniseText(image){
    const worker = await createWorker("eng", 1, {
        workerPath: chrome.runtime.getURL("ocr-assets/worker.min.js"),
        corePath: chrome.runtime.getURL("ocr-assets/tesseract-core-simd.js"),
        langPath: chrome.runtime.getURL("ocr-assets"),
        workerBlobURL: false,
        gzip: true
    });

    try {
        const processedImage = await preprocessImage(image);
        const result = await worker.recognize(processedImage, {}, {
            text: true,
            tsv: true
        });
        console.log("TESSERACT RESULT:", result);
        console.log("TESSERACT DATA:", result.data);
        return result.data;
    } finally {
        await worker.terminate();
    }
}


function extractOCRWords(tsv) {
    const lines = tsv.split("\n");
    const words = [];

    for (const line of lines.slice(1)) {
        const columns = line.split("\t");

        if (columns.length < 12) continue;

        const level = Number(columns[0]);
        if (level !== 5) continue;

        const word = columns[11]?.trim();
        const confidence = Number(columns[10]);

        if (!word || confidence < 40) continue;

        words.push({
            text: word,
            confidence,
            x: Number(columns[6])/2,
            y: Number(columns[7])/2,
            width: Number(columns[8])/2,
            height: Number(columns[9])/2,
            linekey: columns.slice(1, 5).join("-")
        });
    }

    return words;
}

function groupOCRWords(words) {
    const lines = new Map();
    for (const word of words) {
        if (!lines.has(word.linekey)) {
            lines.set(word.linekey, []);
        }
        lines.get(word.linekey).push(word);
    }

    return Array.from(lines.values()).map(lineWords => {
        lineWords.sort((a, b) => a.x-b.x);
        return {
            text: lineWords.map(word => word.text).join(" "),
            words: lineWords
        };
    });
}

export {recogniseText, extractOCRWords, groupOCRWords};