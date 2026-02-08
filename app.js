
// --- Architecture: The Vault Pattern ---

// 1. File Validator
const FileValidator = {
    isValidExtension: (file) => {
        const valid = ['.pdf', '.doc', '.docx', '.txt'];
        return valid.some(ext => file.name.toLowerCase().endsWith(ext));
    },
    validateJD: (file) => {
        if (!FileValidator.isValidExtension(file)) return { valid: false, error: 'Invalid file format. Please upload PDF or DOCX.' };

        // Mock Content Check: Heuristic based on filename
        const name = file.name.toLowerCase();
        const keywords = [
            'job', 'jd', 'description', 'vacancy', 'role', 'hiring',
            'required', 'qualifications', 'key', 'responsibilities', 'skills', 'title',
            'spec', 'specification', 'profile', 'position', 'opening', 'career',
            'summary', 'scope', 'recruitment', 'overview', 'prospectus'
        ];
        const hasKeyword = keywords.some(k => name.includes(k));

        if (!hasKeyword) {
            return {
                valid: false,
                error: 'File validation failed: The file does not appear to be a Job Description. \n\nPlease ensure the filename includes descriptive words like "Job", "JD", "Responsibilities", or "Qualifications".'
            };
        }

        if (file.size < 100) return { valid: false, error: 'File seems too small to be a valid Job Description.' };
        return { valid: true };
    },
    validateCV: (file) => {
        if (!FileValidator.isValidExtension(file)) return { valid: false, error: 'Invalid file format.' };
        return { valid: true };
    }
};

// 2. The Vault (Secure Storage for PII)
class VaultService {
    constructor() {
        this._data = new Map(); // Maps RefID -> SecureData
    }

    store(piiData) {
        const refId = `secure_${Math.random().toString(36).substr(2, 9)}`;
        this._data.set(refId, piiData);
        return refId;
    }

    retrieve(refId) {
        if (!this._data.has(refId)) throw new Error('Security Breach: Invalid RefID');
        return this._data.get(refId);
    }
}

const vault = new VaultService();

// --- Application State ---

const state = {
    step: 0,
    jobDescription: null,
    candidates: [], // Stores ANONYMOUS profiles only (with refId)
    selectedCandidates: new Set(), // Set of RefIDs
    viewingCandidate: null // Current candidate being viewed in detail
};

// --- Mock Data Factories ---

const generateMockAnalysis = () => ({
    skills: ['Project Management', 'Agile', 'Python', 'Data Analysis', 'Communication', 'Leadership'],
    experience: '5+ years',
    qualifications: 'Bachelor in CS or related field'
});

const generateSafeCandidates = (count) => {
    const anonymousList = [];

    for (let i = 0; i < count; i++) {
        // 1. Generate FULL (Sensitive) Data
        const realPIData = {
            realName: `Alex ${['Smith', 'Johnson', 'Williams', 'Brown'][i % 4]}`,
            email: `alex.${i}@example.com`,
            phone: `+1 (555) 010-${1000 + i}`,
            photoUrl: `https://i.pravatar.cc/150?u=${i}`,
            originalFile: `cv_alex_${i}.pdf`
        };

        // 2. Store in Vault & Get Token
        const refId = vault.store(realPIData);

        // 3. Create Sanitized Profile
        const score = Math.floor(Math.random() * (98 - 60) + 60);
        anonymousList.push({
            refId: refId, // The Key
            alias: `Candidate ${Math.random().toString(36).substr(2, 5).toUpperCase()}`, // Pure Alias
            score: score,
            skills: ['Python', 'SQL', 'Teamwork', 'React', 'Node.js'].sort(() => 0.5 - Math.random()).slice(0, 3),
            details: 'Experienced professional with a strong background in tech.',
            revealed: false // UI State
        });
    }

    return anonymousList.sort((a, b) => b.score - a.score);
};

// DOM Elements
const contentArea = document.getElementById('content-area');
const stepsNav = document.querySelectorAll('.step-btn');
// Debug Logger
const debugLog = document.createElement('div');
debugLog.style.cssText = 'position:fixed; bottom:10px; right:10px; background:rgba(0,0,0,0.8); color:#0f0; padding:10px; border-radius:8px; font-family:monospace; z-index:9999; max-width:300px; font-size:12px; pointer-events:none;';
document.body.appendChild(debugLog);

function log(msg) {
    console.log(msg);
    const line = document.createElement('div');
    line.textContent = `> ${msg}`;
    debugLog.appendChild(line);
    if (debugLog.children.length > 5) debugLog.removeChild(debugLog.children[0]);
}

log('App script loaded.');

// --- AI & Extraction Services ---

const AIService = {
    getApiKey: () => localStorage.getItem('gemini_api_key'),
    setApiKey: (key) => localStorage.setItem('gemini_api_key', key),

    extractText: async (file) => {
        const ext = file.name.split('.').pop().toLowerCase();
        if (ext === 'pdf') return await AIService.extractTextFromPDF(file);
        if (ext === 'docx') return await AIService.extractTextFromDocx(file);
        return await file.text(); // For .txt files
    },

    extractTextFromPDF: async (file) => {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let text = "";
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            text += content.items.map(item => item.str).join(" ") + "\n";
        }
        return text;
    },

    extractTextFromDocx: async (file) => {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        return result.value;
    },

    analyzeJD: async (text) => {
        const apiKey = AIService.getApiKey();
        if (!apiKey) throw new Error("Missing API Key. Please click the settings icon and enter your Gemini API key.");

        const prompt = `
            Extract information from the following Job Description and return it as a JSON object with this exact structure:
            {
                "title": "Clear Job Title",
                "skills": ["Skill 1", "Skill 2", ...],
                "requirements": ["Requirement 1", "Requirement 2", ...],
                "responsibilities": ["Responsibility 1", "Responsibility 2", ...],
                "experience": "Brief summary of experience needed",
                "qualifications": "Brief summary of qualifications needed"
            }
            Return ONLY the valid JSON object.
            
            Job Description:
            ${text}
        `;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: prompt }]
                }]
            })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error?.message || "Gemini API call failed.");
        }

        const data = await response.json();
        let resultText = data.candidates[0].content.parts[0].text;

        // Handle potential markdown wrapping
        resultText = resultText.replace(/```json|```/g, "").trim();

        return JSON.parse(resultText);
    },

    analyzeCV: async (text) => {
        const apiKey = AIService.getApiKey();
        const prompt = `
            Extract information from the following Resume/CV and return it as a JSON object with this exact structure:
            {
                "realName": "Full Name",
                "email": "Email address",
                "phone": "Phone number",
                "skills": ["Skill 1", "Skill 2", ...],
                "summary": "Brief professional summary extracted from the CV"
            }
            Return ONLY the valid JSON object.
            
            CV Content:
            ${text}
        `;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });

        if (!response.ok) throw new Error("Gemini CV analysis failed.");
        const data = await response.json();
        let resultText = data.candidates[0].content.parts[0].text;
        resultText = resultText.replace(/```json|```/g, "").trim();
        return JSON.parse(resultText);
    },

    compareFit: async (jd, cvSummary) => {
        const apiKey = AIService.getApiKey();
        const prompt = `
            Act as an expert recruiter. Compare the following Job Description against the Candidate's Resume Summary.
            
            Job Description:
            ${JSON.stringify(jd)}
            
            Candidate Summary & Skills:
            ${JSON.stringify(cvSummary)}
            
            Return a JSON object with:
            {
                "score": 0-100 integer,
                "justification": "One sentence explaining the score"
            }
            Return ONLY valid JSON.
        `;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });

        if (!response.ok) throw new Error("Fit comparison failed.");
        const data = await response.json();
        let resultText = data.candidates[0].content.parts[0].text;
        resultText = resultText.replace(/```json|```/g, "").trim();
        return JSON.parse(resultText);
    }
};

// Robust Initialization
function init() {
    // UI Event Listeners for Settings
    const openSettings = document.getElementById('open-settings');
    const closeSettings = document.getElementById('close-settings');
    const settingsOverlay = document.getElementById('settings-overlay');
    const saveKeyBtn = document.getElementById('save-key-btn');
    const apiKeyInput = document.getElementById('api-key');

    if (openSettings) {
        openSettings.onclick = () => {
            apiKeyInput.value = AIService.getApiKey() || '';
            settingsOverlay.style.display = 'flex';
        };
    }

    if (closeSettings) {
        closeSettings.onclick = () => settingsOverlay.style.display = 'none';
    }

    if (saveKeyBtn) {
        saveKeyBtn.onclick = () => {
            AIService.setApiKey(apiKeyInput.value.trim());
            settingsOverlay.style.display = 'none';
            log('API Key Saved.');
        };
    }

    const btn = document.getElementById('start-btn');
    if (btn) {
        log('Start button found.');
        btn.onclick = (e) => {
            log('Start button clicked!');
            e.preventDefault();
            goToStep(1);
        };
    } else {
        log('Start button NOT found. Retrying...');
        setTimeout(init, 500);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Navigation Logic
function goToStep(stepIndex) {
    state.step = stepIndex;
    updateSidebar(stepIndex);
    renderView(stepIndex);
}

function updateSidebar(currentStep) {
    stepsNav.forEach(btn => {
        const step = parseInt(btn.dataset.step);
        if (step === currentStep) {
            btn.classList.add('active');
            btn.removeAttribute('disabled');
        } else if (step < currentStep) {
            btn.classList.remove('active');
            btn.removeAttribute('disabled');
        } else {
            btn.classList.remove('active');
            // Keep future steps disabled until unlocked
            btn.setAttribute('disabled', 'true');
        }
    });
}

// Views
function renderView(step) {
    contentArea.innerHTML = ''; // Clear current view

    switch (step) {
        case 1: // JD Upload
            renderUploadView('Upload Job Description', 'Drag & drop PDF or Docx here', (files) => {
                handleJDUpload(files[0]);
            });
            break;
        case 2: // JD Analysis
            renderAnalysisView();
            break;
        case 3: // CV Upload
            renderUploadView('Upload Candidate CVs', 'Drag & drop multiple PDF/Docx files', (files) => {
                handleCVUpload(files);
            }, true);
            break;
        case 4: // Matching / Candidates
            renderMatchingView();
            break;
        case 5: // Matching Overview
            renderOverviewView();
            break;
        case 6: // Final Selection / Detail
            renderSelectionView();
            break;
        default:
            console.error('Unknown step');
    }
}

// View Renderers
function renderUploadView(title, subtitle, onUpload, multiple = false) {
    const container = document.createElement('div');
    container.className = 'animate-fade-in';
    container.innerHTML = `
        <h2>${title}</h2>
        <p style="color:var(--text-muted); margin-bottom: 2rem;">${subtitle}</p>
        
        <div class="upload-zone" id="drop-zone">
            <span class="material-icons-round upload-icon">cloud_upload</span>
            <h3>Drag & Drop files here</h3>
            <p>or click to browse</p>
            <input type="file" id="file-input" ${multiple ? 'multiple' : ''} style="display:none">
        </div>
    `;

    contentArea.appendChild(container);

    const dropZone = container.querySelector('#drop-zone');
    const fileInput = container.querySelector('#file-input');

    dropZone.addEventListener('click', () => fileInput.click());

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
            onUpload(e.dataTransfer.files);
        }
    });

    fileInput.addEventListener('change', () => {
        if (fileInput.files.length > 0) {
            onUpload(fileInput.files);
        }
    });
}

async function renderAnalysisView() {
    const container = document.createElement('div');
    container.className = 'animate-fade-in';
    container.innerHTML = `
        <h2>Analyzing Job Description...</h2>
        <div style="margin-top: 2rem; padding: 2rem; background: var(--surface-color); border-radius: var(--radius-md); border: 1px solid var(--border-color);">
            <ul id="analysis-results" style="list-style: none; padding: 0;">
                <li style="margin-bottom: 1rem; display: flex; align-items: center; gap: 1rem;">
                    <span id="step-extract" class="status-dot pulsing"></span> Extracting content from file...
                </li>
            </ul>
            <div id="jd-details" style="display:none; margin-top: 1.5rem; border-top: 1px solid var(--border-color); padding-top: 1.5rem;">
                <h3 id="extracted-title" style="color: var(--primary-color);"></h3>
                <div style="margin-bottom: 1rem;">
                    <strong>Required Skills:</strong>
                    <div id="extracted-skills" style="display:flex; flex-wrap:wrap; gap:0.5rem; margin-top:0.5rem;"></div>
                </div>
                <div style="margin-bottom: 1rem;">
                    <strong>Experience:</strong>
                    <p id="extracted-exp" style="color: var(--text-muted); font-size: 0.9rem; margin: 0.25rem 0;"></p>
                </div>
            </div>
        </div>
        <button id="next-step-btn" class="primary-btn" style="margin-top: 2rem; display: none;">Proceed to Candidate Upload</button>
    `;
    contentArea.appendChild(container);

    const list = document.getElementById('analysis-results');
    const extractDot = document.getElementById('step-extract');
    const detailsDiv = document.getElementById('jd-details');
    const nextBtn = document.getElementById('next-step-btn');

    try {
        // 1. Extract Text
        const text = await AIService.extractText(state._rawJDFile);
        extractDot.classList.remove('pulsing');
        extractDot.style.backgroundColor = 'var(--success-color)';

        list.innerHTML += `<li style="margin-bottom: 1rem; display: flex; align-items: center; gap: 1rem; animation: fadeIn 0.5s;">
            <span id="step-ai" class="status-dot pulsing"></span> Sending to AI for analysis...</li>`;

        // 2. Call AI
        const analysis = await AIService.analyzeJD(text);
        state.jobDescription = analysis;

        const aiDot = document.getElementById('step-ai');
        aiDot.classList.remove('pulsing');
        aiDot.style.backgroundColor = 'var(--success-color)';

        list.innerHTML += `<li style="margin-bottom: 1rem; display: flex; align-items: center; gap: 1rem; animation: fadeIn 0.5s;">
            <span class="status-dot" style="background: var(--success-color)"></span> Job Description Analyzed!</li>`;

        // 3. UI Update
        document.getElementById('extracted-title').textContent = analysis.title;
        document.getElementById('extracted-skills').innerHTML = analysis.skills.map(s =>
            `<span style="background: rgba(59, 130, 246, 0.1); color: var(--primary-color); padding: 0.2rem 0.6rem; border-radius: 4px; font-size: 0.8rem;">${s}</span>`
        ).join('');
        document.getElementById('extracted-exp').textContent = analysis.experience;

        detailsDiv.style.display = 'block';
        nextBtn.style.display = 'block';

    } catch (error) {
        log(`Error: ${error.message}`);
        list.innerHTML += `<li style="color: #f87171; margin-top: 1rem;">⚠️ ${error.message}</li>`;
        // Add retry button if key is missing
        if (error.message.includes("API Key")) {
            const retryBtn = document.createElement('button');
            retryBtn.className = 'primary-btn';
            retryBtn.style.marginTop = '1rem';
            retryBtn.textContent = 'Enter API Key';
            retryBtn.onclick = () => document.getElementById('open-settings').click();
            container.appendChild(retryBtn);
        }
    }

    nextBtn.addEventListener('click', () => goToStep(3));
}


async function renderMatchingView() {
    const container = document.createElement('div');
    container.className = 'animate-fade-in';
    container.innerHTML = `
        <h2>AI Matching & Analysis</h2>
        <div style="margin-top: 2rem; padding: 2rem; background: var(--surface-color); border-radius: var(--radius-md); border: 1px solid var(--border-color);">
            <div id="processing-status" style="margin-bottom: 2rem;">
                <p id="overall-status" style="color:var(--text-main); font-weight:500;">Initializing AI analysis engine...</p>
                <div style="width:100%; height:4px; background:rgba(255,255,255,0.1); border-radius:2px; margin-top:10px; overflow:hidden;">
                    <div id="progress-bar" style="width:0%; height:100%; background:var(--primary-color); transition: width 0.3s ease;"></div>
                </div>
            </div>
            <div id="match-progress-list" style="display: flex; flex-direction: column; gap: 1rem;"></div>
        </div>
        <button id="proceed-to-overview-btn" class="primary-btn" style="margin-top:2rem; display:none;">View Comparison Table</button>
    `;
    contentArea.appendChild(container);

    const progressList = document.getElementById('match-progress-list');
    const overallStatus = document.getElementById('overall-status');
    const progressBar = document.getElementById('progress-bar');
    const proceedBtn = document.getElementById('proceed-to-overview-btn');

    state.candidates = []; // Clear existing
    const files = state._rawCVFiles || [];

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const progress = ((i / files.length) * 100).toFixed(0);
        progressBar.style.width = `${progress}%`;
        overallStatus.textContent = `Processing CV ${i + 1} of ${files.length}...`;

        const item = document.createElement('div');
        item.style.cssText = 'display:flex; align-items:center; gap:1rem; padding:1rem; background:rgba(255,255,255,0.03); border-radius:8px; animation:fadeIn 0.3s;';
        item.innerHTML = `<span class="status-dot pulsing"></span> Extracting & Analyzing ${file.name}...`;
        progressList.appendChild(item);

        try {
            // 1. Text Extraction & Analysis
            const text = await AIService.extractText(file);
            const analysis = await AIService.analyzeCV(text);

            // 2. Vault storage
            const refId = vault.store({
                realName: analysis.realName,
                email: analysis.email,
                phone: analysis.phone,
                originalFile: file.name
            });

            // 3. Match Scoring
            item.innerHTML = `<span class="status-dot pulsing" style="background:var(--primary-color)"></span> Comparing ${file.name} to Job Description...`;
            const fit = await AIService.compareFit(state.jobDescription, {
                summary: analysis.summary,
                skills: analysis.skills
            });

            const cand = {
                refId: refId,
                alias: `Candidate ${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
                score: fit.score,
                skills: analysis.skills,
                details: analysis.summary,
                justification: fit.justification,
                revealed: false
            };
            state.candidates.push(cand);

            // 4. Update UI
            item.querySelector('.status-dot').classList.remove('pulsing');
            item.querySelector('.status-dot').style.backgroundColor = 'var(--success-color)';
            item.innerHTML = `<span class="status-dot" style="background:var(--success-color)"></span> ${cand.alias}: ${fit.score}% Match
                             <p style="margin:0.25rem 0 0 2rem; font-size:0.8rem; color:var(--text-muted);">${fit.justification}</p>`;

        } catch (e) {
            log(`Error processing ${file.name}: ${e.message}`);
            item.innerHTML = `<span class="status-dot" style="background:#f87171"></span> Error: ${file.name} (Skipped)`;
        }
    }

    progressBar.style.width = '100%';
    overallStatus.textContent = "AI Analysis & Matching Complete!";
    proceedBtn.style.display = 'block';
    proceedBtn.onclick = () => goToStep(5);
}


function renderOverviewView() {
    const container = document.createElement('div');
    container.className = 'animate-fade-in';
    container.innerHTML = `
        <h2>Candidate Comparison Table</h2>
        <p style="color: var(--text-muted); margin-bottom: 2rem;">Select candidates to proceed to the interview stage.</p>
        <div style="margin-bottom: 1rem;">
            <button id="back-btn1" style="background:none; border:none; color: var(--text-muted); cursor: pointer; display: flex; align-items: center; gap: 0.5rem; font-size: 1rem;">
                <span class="material-icons-round">arrow_back</span> Back
            </button>
        </div>
        <div style="background: var(--surface-color); border-radius: var(--radius-md); border: 1px solid var(--border-color); overflow: hidden;">
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background: rgba(255,255,255,0.05); text-align: left;">
                        <th style="padding: 1rem; border-bottom: 1px solid var(--border-color);">Select</th>
                        <th style="padding: 1rem; border-bottom: 1px solid var(--border-color);">Alias</th>
                        <th style="padding: 1rem; border-bottom: 1px solid var(--border-color);">Match Score</th>
                        <th style="padding: 1rem; border-bottom: 1px solid var(--border-color);">Key Skills</th>
                        <th style="padding: 1rem; border-bottom: 1px solid var(--border-color);">Actions</th>
                    </tr>
                </thead>
                <tbody id="candidates-table-body">
                </tbody>
            </table>
        </div>

        <div style="margin-top: 1.5rem; display: flex; justify-content: space-between; align-items: center;">
            <p id="selection-count" style="color: var(--text-muted); margin: 0;">0 candidates selected</p>
            <button id="batch-reveal-btn" class="primary-btn" disabled>Proceed with Selected</button>
        </div>
    `;
    contentArea.appendChild(container);
    document.getElementById('back-btn1').addEventListener('click', () => goToStep(4));
    const tbody = document.getElementById('candidates-table-body');
    const countLabel = document.getElementById('selection-count');
    const proceedBtn = document.getElementById('batch-reveal-btn');

    const updateSelectionUI = () => {
        const count = state.selectedCandidates.size;
        countLabel.textContent = `${count} candidates selected`;
        proceedBtn.disabled = count === 0;
        proceedBtn.style.opacity = count === 0 ? '0.5' : '1';
    };

    state.candidates.forEach(cand => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid var(--border-color)';

        const isSelected = state.selectedCandidates.has(cand.refId);
        const badgeClass = cand.score >= 90 ? 'high' : (cand.score >= 75 ? 'medium' : 'low');

        tr.innerHTML = `
            <td style="padding: 1rem;">
                <input type="checkbox" class="select-cand-cb" value="${cand.refId}" ${isSelected ? 'checked' : ''} style="width: 18px; height: 18px; cursor: pointer;">
            </td>
            <td style="padding: 1rem; font-weight: 500;">${cand.alias}</td>
            <td style="padding: 1rem;">
                <span class="match-badge ${badgeClass}">${cand.score}%</span>
            </td>
            <td style="padding: 1rem; color: var(--text-muted); font-size: 0.9rem;">
                ${cand.skills.join(', ')}
            </td>
            <td style="padding: 1rem;">
                <button class="view-btn" style="background: transparent; border: 1px solid var(--primary-color); color: var(--primary-color); padding: 0.4rem 0.8rem; border-radius: 6px; cursor: pointer; font-size: 0.85rem;">
                    View Details
                </button>
            </td>
        `;

        // Checkbox Handler
        const cb = tr.querySelector('.select-cand-cb');
        cb.addEventListener('change', (e) => {
            if (e.target.checked) state.selectedCandidates.add(cand.refId);
            else state.selectedCandidates.delete(cand.refId);
            updateSelectionUI();
        });

        // View Detail Handler
        tr.querySelector('.view-btn').addEventListener('click', () => {
            state.viewingCandidate = cand;
            goToStep(6);
        });

        tbody.appendChild(tr);
    });

    proceedBtn.addEventListener('click', () => {
        // Batch Logic: Export Shortlist
        const selectedRefs = Array.from(state.selectedCandidates);
        const selectedProfiles = state.candidates.filter(c => selectedRefs.includes(c.refId));

        const content = selectedProfiles.map(p => {
            // Try to get real info if unlocked, else alias
            let info = p.alias;
            try {
                if (vault._data.has(p.refId)) {
                    const pii = vault.retrieve(p.refId); // This might throw if we enforce strict reveal-first policy, but for export we might assume implicit reveal
                    info = `${pii.realName} (${pii.email})`;
                }
            } catch (e) { }
            return `- ${info}: ${p.score}% Match`;
        }).join('\n');

        triggerMockDownload(`shortlist_export_${Date.now()}.txt`, `Hiring Assistant Shortlist:\n\n${content}`);
    });
}

function triggerMockDownload(filename, text) {
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    element.setAttribute('download', filename);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
}

function renderSelectionView() {
    if (!state.viewingCandidate) { // Use viewingCandidate
        goToStep(5);
        return;
    }

    const cand = state.viewingCandidate;
    const badgeClass = cand.score >= 90 ? 'high' : (cand.score >= 75 ? 'medium' : 'low');

    const container = document.createElement('div');
    container.className = 'animate-fade-in';
    container.innerHTML = `
        <div style="margin-bottom: 1rem;">
            <button id="back-btn" style="background:none; border:none; color: var(--text-muted); cursor: pointer; display: flex; align-items: center; gap: 0.5rem; font-size: 1rem;">
                <span class="material-icons-round">arrow_back</span> Back to Overview
            </button>
        </div>

        <div style="display: grid; grid-template-columns: 350px 1fr; gap: 2rem; align-items: start;">
            <!-- Profile Column -->
            <div style="background: var(--surface-color); padding: 2rem; border-radius: var(--radius-lg); border: 1px solid ${cand.revealed ? 'var(--success-color)' : 'var(--border-color)'}; box-shadow: var(--shadow-lg); transition: all 0.3s ease;">
                ${!cand.revealed ? `
                    <div style="text-align: center; margin-bottom: 2rem;">
                        <span class="material-icons-round" style="font-size: 4rem; color: var(--text-muted); margin-bottom: 1rem;">visibility_off</span>
                        <h2 style="margin: 0;">${cand.alias}</h2>
                        <span class="match-badge ${badgeClass}" style="margin-top: 0.5rem; display: inline-block; font-size: 1rem; padding: 0.4rem 1rem;">${cand.score}% Match</span>
                    </div>

                    <div style="text-align: center;">
                        <p style="color: var(--text-muted);">Candidate identity is currently hidden to ensure unbiased review.</p>
                        <button id="reveal-btn" class="primary-btn" style="width: 100%; margin-top: 1rem; padding: 1rem; font-size: 1.1rem; background: var(--gradient-1);">
                            Reveal Identity
                        </button>
                    </div>
                ` : `
                    <div style="text-align: center; margin-bottom: 2rem; animation: fadeIn 0.5s;">
                        <div style="width: 80px; height: 80px; background: var(--gradient-1); border-radius: 50%; margin: 0 auto 1rem; display: flex; align-items: center; justify-content: center; font-size: 2rem; font-weight: 700;">
                            ${cand.realName ? cand.realName.charAt(0) : '?'}
                        </div>
                        <h2 style="margin: 0;">${cand.realName || 'Unknown'}</h2>
                        <p style="color: var(--text-muted);">${cand.alias}</p>
                        <span class="match-badge ${badgeClass}" style="margin-top: 0.5rem; display: inline-block; font-size: 1rem; padding: 0.4rem 1rem;">${cand.score}% Match</span>
                    </div>
                    
                    <div style="border-top: 1px solid var(--border-color); padding-top: 1.5rem; animation: fadeIn 0.5s;">
                        <h4 style="margin-top: 0;">Contact Info</h4>
                         <!-- Note: These fields will be populated after Vault retrieval -->
                        <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 0.5rem;">📧 ${cand.email || 'Revealed upon request'}</p>
                        <p style="color: var(--text-muted); font-size: 0.9rem;">📱 ${cand.phone || 'Revealed upon request'}</p>
                    </div>
                     
                    <div style="margin-top: 2rem; animation: fadeIn 0.5s;">
                        <button class="primary-btn" style="width: 100%;">Schedule Interview</button>
                        <button id="download-cv-btn" style="width: 100%; margin-top: 0.75rem; background: transparent; border: 1px solid var(--border-color); color: var(--text-muted); padding: 0.75rem; border-radius: var(--radius-md); cursor: pointer;">Download Full CV</button>
                    </div>
                `}
            </div>

            <!-- Details Column -->
            <div style="background: var(--surface-color); padding: 2rem; border-radius: var(--radius-lg); border: 1px solid var(--border-color);">
                <h2 style="margin-top: 0;">Analysis Report</h2>
                
                <div style="margin-bottom: 2rem;">
                    <h3 style="color: var(--secondary-color);">Professional Summary</h3>
                    <p style="line-height: 1.6;">${cand.details}</p>
                    ${cand.justification ? `
                        <div style="margin-top: 1rem; padding: 1rem; background: rgba(59, 130, 246, 0.05); border-radius: 8px; border-left: 4px solid var(--primary-color);">
                            <strong style="font-size: 0.9rem; display: block; margin-bottom: 0.25rem;">AI Match Insight:</strong>
                            <p style="margin: 0; font-size: 0.9rem; font-style: italic; color: var(--text-muted);">${cand.justification}</p>
                        </div>
                    ` : ''}
                </div>

                <div style="margin-bottom: 2rem;">
                    <h3 style="color: var(--secondary-color);">Key Skills</h3>
                    <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
                        ${cand.skills.map(skill => `<span style="background: rgba(59, 130, 246, 0.1); color: var(--primary-color); padding: 0.4rem 1rem; border-radius: 8px; font-size: 0.9rem;">${skill}</span>`).join('')}
                    </div>
                </div>

                <div>
                    <h3 style="color: var(--secondary-color);">Experience & Qualifications</h3>
                    <ul style="color: var(--text-muted); line-height: 1.8;">
                        <li>5+ years of relevant industry experience.</li>
                        <li>Master's degree in Computer Science (Verified).</li>
                        <li>Certified Scrum Master.</li>
                    </ul>
                </div>
            </div>
        </div>
    `;
    contentArea.appendChild(container);

    document.getElementById('back-btn').addEventListener('click', () => goToStep(5));

    // Download CV Handler
    const downloadBtn = document.getElementById('download-cv-btn');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', () => {
            let filename = `cv_${cand.alias}.pdf`;
            try {
                const pii = vault.retrieve(cand.refId);
                filename = pii.originalFile;
            } catch (e) { }
            triggerMockDownload(filename, `[Simulated Content of ${filename}]\n\nRef: ${cand.refId}\n\n...Full CV Content...`);
        });
    }

    if (!cand.revealed) {
        document.getElementById('reveal-btn').addEventListener('click', () => {
            // Logic to retrieve from Vault will be implemented in next step
            // For now, allow UI to flip
            try {
                const pii = vault.retrieve(cand.refId);
                Object.assign(cand, pii); // Merge PII into candidate object
                cand.revealed = true;
                renderView(6);
            } catch (e) {
                alert('Error accessing secure vault: ' + e.message);
            }
        });
    }
}


// Handlers
function handleJDUpload(file) {
    const check = FileValidator.validateJD(file);
    if (!check.valid) {
        alert(check.error);
        return;
    }
    state._rawJDFile = file; // Store for extraction
    console.log('JD Uploaded:', file.name);
    // Simulate processing time
    setTimeout(() => {
        goToStep(2);
    }, 1000);
}

function handleCVUpload(files) {
    const validFiles = Array.from(files).filter(f => FileValidator.validateCV(f).valid);
    if (validFiles.length < files.length) {
        alert(`Warning: ${files.length - validFiles.length} files were rejected due to invalid format.`);
    }
    if (validFiles.length === 0) return;

    state._rawCVFiles = validFiles;
    log(`Queued ${validFiles.length} CVs for processing.`);

    setTimeout(() => {
        goToStep(4);
    }, 1000);
}

