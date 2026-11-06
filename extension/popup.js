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

            const frames = await chrome.webNavigation.getAllFrames({
                tabId: tab.id
            });

            console.log("ALL FRAMES:", frames);

            let allResults = [];
            for (const frame of frames) {
                const response = await chrome.tabs.sendMessage(
                    tab.id,
                    {action: "SCAN_PAGE"},
                    {frameId: frame.frameId}
                );
                allResults.push(...response.results);
            }

            console.log("RES: ", allResults);

            resultdiv.replaceChildren();

            const heading = document.createElement("h3");
            heading.textContent = `Detected: ${allResults.length}`;
            resultdiv.appendChild(heading);

            allResults.forEach((item) => {
                const div = document.createElement("div");
                div.className = "item";
                div.textContent = `${item.category} (${item.tag})`;
                resultdiv.appendChild(div);
            });

            if (allResults.length === 0){
                resultdiv.append("No sensitive fields detected.");
            }
        } catch (error){
            console.error("SCAN ERROR:", error);

            resultdiv.textContent = "Scan failed: "+ error.message;
        }
    }
);