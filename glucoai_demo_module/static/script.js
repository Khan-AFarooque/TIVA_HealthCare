let cgmChart = null;
let currentDetectionResult = null;

const defaultReadings = [
    110, 112, 115, 118, 122, 126,
    130, 135, 141, 146, 152, 157,
    162, 166, 170, 173, 175, 178,
    180, 182, 183, 185, 186, 187
];

document.addEventListener("DOMContentLoaded", () => {
    buildInputsGrid(defaultReadings);
    initChart(defaultReadings, null, null);

    const form = document.getElementById("glucose-form");
    if (form) {
        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            await runPrediction();
        });
    }

    setupDropzone();
});

function switchTab(tabName) {
    const tabs = ["vision", "readings", "clinical"];
    tabs.forEach(t => {
        const btn = document.getElementById(`tab-${t}`);
        const sec = document.getElementById(`section-${t}`);
        if (btn && sec) {
            if (t === tabName) {
                btn.classList.add("active");
                sec.classList.remove("hidden");
                sec.classList.add("active");
            } else {
                btn.classList.remove("active");
                sec.classList.add("hidden");
                sec.classList.remove("active");
            }
        }
    });
}

function setupDropzone() {
    const dz = document.getElementById("dropzone");
    if (!dz) return;

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dz.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dz.addEventListener(eventName, () => dz.classList.add('dragover'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dz.addEventListener(eventName, () => dz.classList.remove('dragover'), false);
    });

    dz.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files && files.length > 0) {
            uploadImageFile(files[0]);
        }
    });
}

function handleFileUpload(event) {
    const files = event.target.files;
    if (files && files.length > 0) {
        uploadImageFile(files[0]);
    }
}

async function uploadImageFile(file) {
    showDetectionLoading();
    const formData = new FormData();
    formData.append("file", file);

    try {
        const res = await fetch("/api/detect-image", {
            method: "POST",
            body: formData
        });
        if (!res.ok) throw new Error("Image detection request failed");
        const data = await res.json();
        displayDetectionData(data);
    } catch (err) {
        console.error("Upload error:", err);
        alert("Failed to analyze image file. Please try again.");
        hideDetectionLoading();
    }
}

async function runImageDetection(sampleKey) {
    showDetectionLoading();
    try {
        const res = await fetch("/api/detect-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sample_key: sampleKey })
        });
        if (!res.ok) throw new Error("Detection preset request failed");
        const data = await res.json();
        displayDetectionData(data);
    } catch (err) {
        console.error("Preset detection error:", err);
        alert("Failed to run preset detection!");
        hideDetectionLoading();
    }
}

function showDetectionLoading() {
    const card = document.getElementById("detection-result-card");
    const laser = document.getElementById("scanner-laser");
    if (card) {
        card.classList.remove("hidden");
    }
    if (laser) {
        laser.style.display = "block";
    }
    document.getElementById("detection-title").innerText = "🔍 AI Scanning Image...";
    document.getElementById("detection-confidence").innerText = "Analyzing...";
    document.getElementById("detection-carbs").innerText = "...";
    document.getElementById("detection-type").innerText = "...";
    document.getElementById("detection-msg").innerText = "Extracting meal carbohydrates and screen OCR readings...";
}

function hideDetectionLoading() {
    const laser = document.getElementById("scanner-laser");
    if (laser) laser.style.display = "none";
}

function displayDetectionData(data) {
    currentDetectionResult = data;
    hideDetectionLoading();

    const card = document.getElementById("detection-result-card");
    const imgPreview = document.getElementById("detection-img-preview");
    const titleElem = document.getElementById("detection-title");
    const confElem = document.getElementById("detection-confidence");
    const carbsElem = document.getElementById("detection-carbs");
    const typeElem = document.getElementById("detection-type");
    const msgElem = document.getElementById("detection-msg");
    const overlay = document.getElementById("detection-bbox-overlay");

    if (card) card.classList.remove("hidden");
    if (imgPreview) imgPreview.src = data.image_url;

    titleElem.innerText = data.title;
    confElem.innerText = `${Math.round(data.confidence * 100)}% Confidence`;
    
    if (data.detected_type.includes("MEAL")) {
        carbsElem.innerText = `${data.estimated_carbs}g Carbs`;
        typeElem.innerText = "Food Meal";
    } else {
        carbsElem.innerText = `${data.extracted_glucose || 168} mg/dL`;
        typeElem.innerText = "Meter OCR Screen";
    }

    msgElem.innerText = data.suggested_action;

    // Render Bounding Boxes
    if (overlay) {
        overlay.innerHTML = "";
        if (data.detected_items && data.detected_items.length > 0) {
            data.detected_items.forEach(item => {
                const box = item.box || [20, 20, 60, 60];
                const tag = document.createElement("div");
                tag.className = "bbox-tag";
                tag.style.left = `${box[0]}%`;
                tag.style.top = `${box[1]}%`;
                tag.style.width = `${box[2]}%`;
                tag.style.height = `${box[3]}%`;
                tag.innerHTML = `<span>${item.label} (${Math.round(item.confidence * 100)}%)</span>`;
                overlay.appendChild(tag);
            });
        }
    }
}

async function applyDetectionResult() {
    if (!currentDetectionResult) return;

    if (currentDetectionResult.estimated_carbs > 0) {
        const carbsInput = document.getElementById("input-carbs");
        if (carbsInput) {
            carbsInput.value = currentDetectionResult.estimated_carbs;
        }
    }

    if (currentDetectionResult.extracted_glucose) {
        // Update current reading in 24-hr input grid
        const lastInput = document.getElementById("input-23");
        if (lastInput) {
            lastInput.value = currentDetectionResult.extracted_glucose;
        }
    }

    // Run prediction automatically
    await runPrediction();

    // Switch to readings or keep on vision tab with success indicator
    const btn = document.getElementById("btn-apply-detection");
    if (btn) {
        btn.innerText = "✅ Forecast Updated!";
        setTimeout(() => {
            btn.innerText = "⚡ Apply to Forecast & Run LSTM";
        }, 2500);
    }
}

function buildInputsGrid(readings) {
    const container = document.getElementById("inputs-container");
    container.innerHTML = "";

    readings.forEach((val, idx) => {
        const timeOffset = (24 - idx) * 5;
        const group = document.createElement("div");
        group.className = "input-group";
        
        group.innerHTML = `
            <label>-${timeOffset}m</label>
            <input type="number" step="0.1" id="input-${idx}" value="${val}" required>
        `;
        container.appendChild(group);
    });
}

function getInputsArray() {
    const arr = [];
    for (let i = 0; i < 24; i++) {
        const val = parseFloat(document.getElementById(`input-${i}`).value);
        arr.push(isNaN(val) ? 120.0 : val);
    }
    return arr;
}

async function loadPreset(presetKey) {
    try {
        const res = await fetch("/api/presets");
        const presets = await res.json();
        if (presets[presetKey]) {
            buildInputsGrid(presets[presetKey]);
            await runPrediction();
        }
    } catch (err) {
        console.error("Error loading presets:", err);
    }
}

async function runPrediction() {
    const readings = getInputsArray();
    const carbs = parseFloat(document.getElementById("input-carbs").value) || 0.0;
    const active_insulin = parseFloat(document.getElementById("input-iob").value) || 0.0;
    const isf = parseFloat(document.getElementById("input-isf").value) || 50.0;
    const icr = parseFloat(document.getElementById("input-icr").value) || 15.0;

    const btn = document.getElementById("btn-predict");
    btn.disabled = true;
    btn.innerText = "⏳ Running Keras LSTM & Insulin Advisor...";

    try {
        const res = await fetch("/api/predict", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                readings: readings,
                carbs: carbs,
                active_insulin: active_insulin,
                isf: isf,
                icr: icr
            })
        });

        if (!res.ok) {
            const errData = await res.json();
            alert("Prediction Error: " + (errData.detail || "Server error"));
            return;
        }

        const data = await res.json();

        // Update Metric Boxes
        document.getElementById("val-current").innerText = data.current_glucose;
        document.getElementById("val-30min").innerText = data.pred_30min;
        document.getElementById("val-60min").innerText = data.pred_60min;
        document.getElementById("val-velocity").innerText = (data.velocity > 0 ? "+" : "") + data.velocity;

        // Update Risk Banner
        const banner = document.getElementById("risk-banner");
        const statusElem = document.getElementById("risk-status");
        const msgElem = document.getElementById("risk-message");

        banner.className = "risk-banner";
        if (data.risk_level === "CRITICAL_HYPO" || data.risk_level === "RAPID_FALL") {
            banner.classList.add("hypo");
        } else if (data.risk_level === "WARNING_HYPER") {
            banner.classList.add("hyper");
        } else {
            banner.classList.add("safe");
        }

        statusElem.innerText = data.risk_status;
        msgElem.innerText = data.risk_message;

        // Update Insulin Guidance Card
        const insCard = document.getElementById("insulin-card");
        const insBadge = document.getElementById("insulin-action-badge");
        const insStatus = document.getElementById("insulin-status");
        const insBolus = document.getElementById("val-bolus");
        const pillCorr = document.getElementById("pill-corr");
        const pillCarb = document.getElementById("pill-carb");
        const insMsg = document.getElementById("insulin-message");

        insCard.className = "insulin-card";
        if (data.insulin_action === "INCREASE") {
            insCard.classList.add("increase");
            insBadge.innerText = "INCREASE 💉";
        } else if (data.insulin_action === "DECREASE") {
            insCard.classList.add("decrease");
            insBadge.innerText = "DECREASE 🛑";
        } else {
            insCard.classList.add("maintain");
            insBadge.innerText = "MAINTAIN 🟢";
        }

        insStatus.innerText = data.insulin_status;
        insBolus.innerText = data.suggested_bolus;
        pillCorr.innerText = `Corr: +${data.correction_dose} U`;
        pillCarb.innerText = `Carb: +${data.carb_dose} U`;
        insMsg.innerText = data.insulin_message;

        // Update Chart
        updateChart(readings, data.pred_30min, data.pred_60min);

    } catch (err) {
        console.error("Failed to fetch prediction:", err);
        alert("Failed to connect to FastAPI prediction server!");
    } finally {
        btn.disabled = false;
        btn.innerHTML = "<span>🔮 Predict Forecast & Insulin Dosage</span>";
    }
}

function initChart(historyReadings, pred30, pred60) {
    const ctx = document.getElementById("cgmChart").getContext("2d");

    const historyLabels = Array.from({ length: 24 }, (_, i) => `-${(24 - i) * 5}m`);
    const labels = [...historyLabels, "+30m", "+60m"];

    const historyData = [...historyReadings, null, null];
    const forecastData = Array(23).fill(null);
    forecastData.push(historyReadings[23]); // connect current reading
    forecastData.push(pred30);
    forecastData.push(pred60);

    cgmChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Past 2-Hr CGM History (5-min)',
                    data: historyData,
                    borderColor: '#6366f1',
                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                    fill: true,
                    tension: 0.3,
                    pointRadius: 4,
                    pointHoverRadius: 6
                },
                {
                    label: 'LSTM Predicted Horizon (30 & 60 min)',
                    data: forecastData,
                    borderColor: '#ec4899',
                    borderDash: [6, 6],
                    backgroundColor: 'transparent',
                    tension: 0.2,
                    pointRadius: 6,
                    pointBackgroundColor: '#ec4899',
                    pointHoverRadius: 8
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: { color: '#94a3b8', font: { family: 'Outfit' } }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#94a3b8', font: { family: 'Outfit', size: 10 } }
                },
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#94a3b8', font: { family: 'Outfit' } },
                    title: { display: true, text: 'Glucose (mg/dL)', color: '#94a3b8' }
                }
            }
        }
    });
}

function updateChart(historyReadings, pred30, pred60) {
    if (!cgmChart) return;

    const historyData = [...historyReadings, null, null];
    const forecastData = Array(23).fill(null);
    forecastData.push(historyReadings[23]);
    forecastData.push(pred30);
    forecastData.push(pred60);

    cgmChart.data.datasets[0].data = historyData;
    cgmChart.data.datasets[1].data = forecastData;
    cgmChart.update();
}
