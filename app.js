// ===============================================
//  IMPORTS & FIREBASE CONFIG
// ===============================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getDatabase, ref, push, get, set, query, orderByChild, serverTimestamp, remove } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyB9KjyooiY6sURBSY78iLytMuVb_3x_gb0",
    authDomain: "gym-b5822.firebaseapp.com",
    databaseURL: "https://gym-b5822-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "gym-b5822",
    storageBucket: "gym-b5822.appspot.com",
    messagingSenderId: "1025702546035",
    appId: "1:1025702546035:web:038b244f8c7bdd23b3b806",
    measurementId: "G-P8HTCXFKTS"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app, firebaseConfig.databaseURL);

// Firebase Refs
const sessionsRef = ref(db, 'sessions');
const exerciseNamesRef = ref(db, 'exerciseNames');
const prsRef = ref(db, 'personalRecords');
const bodyweightRef = ref(db, 'bodyweight');

// ===============================================
//  DOM ELEMENTS
// ===============================================
const trackerSection = document.getElementById('tracker-section');
const analyticsSection = document.getElementById('analytics-section');
const historySection = document.getElementById('history-section');
const bodyweightSection = document.getElementById('bodyweight-section');
const trackerBtn = document.getElementById('tracker-view-btn');
const analyticsBtn = document.getElementById('analytics-view-btn');
const historyBtn = document.getElementById('history-view-btn');
const bodyweightBtn = document.getElementById('bodyweight-view-btn');
const addExerciseBtn = document.getElementById('add-exercise-btn');
const workoutTableBody = document.getElementById('workout-table-body');
const totalPowerSpan = document.getElementById('total-power');
const totalVolumeSpan = document.getElementById('total-volume');
const saveSessionBtn = document.getElementById('save-session-btn');
const sessionNameInput = document.getElementById('session-name');
const exerciseDataList = document.getElementById('exercise-list');
const chartsContainer = document.getElementById('charts-container');
const prContainer = document.getElementById('pr-container');
const historyContainer = document.getElementById('history-container');
const bodyweightInput = document.getElementById('bodyweight-input');
const saveBodyweightBtn = document.getElementById('save-bodyweight-btn');
const bodyweightHistoryList = document.getElementById('bodyweight-history-list');
const bodyweightChartCanvas = document.getElementById('bodyweight-chart').getContext('2d');
const timerDisplay = document.getElementById('timer-display');
const timerStartBtn = document.getElementById('timer-start-btn');
const timerResetBtn = document.getElementById('timer-reset-btn');
const timerPlus15Btn = document.getElementById('timer-plus-15-btn');
const timerMinus15Btn = document.getElementById('timer-minus-15-btn');
const detailsModal = document.getElementById('details-modal');
const modalCloseBtn = document.getElementById('modal-close-btn');
const modalTitle = document.getElementById('modal-title');
const modalBody = document.getElementById('modal-body');

let bodyweightChart;
let allExerciseNames = new Set();

// ===============================================
//  CALCULATION LOGIC
// ===============================================
const calculatePower = (weight, sets, reps) => ((parseFloat(weight) || 0) * (parseFloat(sets) || 1) * (parseFloat(reps) || 1)) / 100;
const calculateVolume = (weight, sets, reps) => (parseFloat(weight) || 0) * (parseFloat(sets) || 0) * (parseFloat(reps) || 0);

// ===============================================
//  WORKOUT TRACKER
// ===============================================
const updateRowCalculations = (row) => {
    const weight = row.querySelector('.weight').value;
    const sets = row.querySelector('.sets').value;
    const reps = row.querySelector('.reps').value;
    row.querySelector('.power-score').textContent = calculatePower(weight, sets, reps).toFixed(2);
    row.querySelector('.volume-score').textContent = calculateVolume(weight, sets, reps);
    updateTotalScores();
};

const updateTotalScores = () => {
    let totalPower = 0, totalVolume = 0;
    workoutTableBody.querySelectorAll('tr').forEach(row => {
        totalPower += parseFloat(row.querySelector('.power-score').textContent) || 0;
        totalVolume += parseFloat(row.querySelector('.volume-score').textContent) || 0;
    });
    totalPowerSpan.textContent = totalPower.toFixed(2);
    totalVolumeSpan.textContent = totalVolume;
};

const addExerciseRow = (exercise = {}) => {
    const row = document.createElement('tr');
    row.innerHTML = `
        <td><input type="text" class="exercise-name" placeholder="e.g., Bench Press" list="exercise-list" value="${exercise.name || ''}"></td>
        <td><input type="number" class="weight" min="0" value="${exercise.weight || ''}"></td>
        <td><input type="number" class="sets" min="1" value="${exercise.sets || ''}"></td>
        <td><input type="number" class="reps" min="1" value="${exercise.reps || ''}"></td>
        <td class="volume-score">0</td>
        <td><input type="text" class="notes-input" placeholder="Notes..." value="${exercise.notes || ''}"></td>
        <td class="power-score">0.00</td>
        <td><button class="delete-row-btn">&times;</button></td>
    `;
    workoutTableBody.appendChild(row);
    row.querySelectorAll('input').forEach(input => input.addEventListener('input', () => updateRowCalculations(row)));
    row.querySelector('.delete-row-btn').addEventListener('click', () => { row.remove(); updateTotalScores(); });
    if (exercise.name) updateRowCalculations(row);
};

const saveSession = async () => {
    const sessionName = sessionNameInput.value.trim();
    if (!sessionName) { alert('Please enter a name for the session.'); return; }
    const exercises = [];
    const rows = workoutTableBody.querySelectorAll('tr');
    if (rows.length === 0) { alert('Please add at least one exercise.'); return; }
    rows.forEach(row => {
        const exerciseName = row.querySelector('.exercise-name').value.trim();
        if (exerciseName) {
            const exerciseData = {
                name: exerciseName,
                weight: parseFloat(row.querySelector('.weight').value) || 0,
                sets: parseFloat(row.querySelector('.sets').value) || 0,
                reps: parseFloat(row.querySelector('.reps').value) || 0,
                volume: parseFloat(row.querySelector('.volume-score').textContent) || 0,
                power: parseFloat(row.querySelector('.power-score').textContent) || 0,
                notes: row.querySelector('.notes-input').value.trim()
            };
            exercises.push(exerciseData);
            updatePR(exerciseData);
            allExerciseNames.add(exerciseName);
        }
    });
    try {
        await push(sessionsRef, { name: sessionName, createdAt: serverTimestamp(), totalPower: parseFloat(totalPowerSpan.textContent), totalVolume: parseFloat(totalVolumeSpan.textContent), exercises });
        await set(exerciseNamesRef, Array.from(allExerciseNames));
        alert('Session saved successfully! 💪');
        sessionNameInput.value = '';
        workoutTableBody.innerHTML = '';
        addExerciseRow();
        updateTotalScores();
    } catch (error) { console.error("FIREBASE ERROR:", error); alert('Error saving session. Check console.'); }
};

// ===============================================
//  ANALYTICS & PRs
// ===============================================
const updatePR = async (exercise) => {
    if (!exercise.name || !exercise.weight) return;
    const prRef = ref(db, `personalRecords/${exercise.name}`);
    const snapshot = await get(prRef);
    if (exercise.weight > (snapshot.val() || 0)) await set(prRef, exercise.weight);
};

const loadPRs = async () => {
    prContainer.innerHTML = 'Loading PRs...';
    const snapshot = await get(prsRef);
    if (!snapshot.exists()) { prContainer.innerHTML = '<p>No personal records set yet.</p>'; return; }
    prContainer.innerHTML = '';
    snapshot.forEach(child => {
        const prCard = document.createElement('div');
        prCard.className = 'pr-card';
        prCard.innerHTML = `<h4>${child.key}</h4><p>${child.val()} kg</p>`;
        prContainer.appendChild(prCard);
    });
};

const deleteExerciseData = async (exNameToDelete) => {
    if (!confirm(`Are you sure you want to delete all data for "${exNameToDelete}"?\nThis will remove its PR and from the autocomplete list.`)) return;
    try {
        await remove(ref(db, `personalRecords/${exNameToDelete}`));
        allExerciseNames.delete(exNameToDelete);
        await set(exerciseNamesRef, Array.from(allExerciseNames));
        alert(`"${exNameToDelete}" data deleted.`);
        loadAnalytics(); // Refresh analytics view
    } catch (error) { console.error("Error deleting exercise data:", error); alert("Could not delete exercise data."); }
};

const loadAnalytics = async () => {
    chartsContainer.innerHTML = 'Loading data...';
    try {
        loadPRs();
        const q = query(sessionsRef, orderByChild('createdAt'));
        const snapshot = await get(q);
        if (!snapshot.exists()) { chartsContainer.innerHTML = '<p>No data yet for charts.</p>'; return; }
        const exerciseData = {};
        snapshot.forEach(child => {
            const session = child.val();
            const sessionDate = new Date(session.createdAt).toLocaleDateString();
            if (session.exercises) session.exercises.forEach(ex => {
                if (!exerciseData[ex.name]) exerciseData[ex.name] = { labels: [], volumes: [], powers: [] };
                exerciseData[ex.name].labels.push(sessionDate);
                exerciseData[ex.name].volumes.push(ex.volume);
                exerciseData[ex.name].powers.push(ex.power);
            });
        });
        chartsContainer.innerHTML = '';
        for (const exName in exerciseData) {
            const chartWrapper = document.createElement('div');
            chartWrapper.className = 'chart-wrapper';
            chartWrapper.innerHTML = `<h3><span>${exName}</span><button class="delete-graph-btn" title="Delete all data for ${exName}">&times;</button></h3>`;
            const canvas = document.createElement('canvas');
            chartWrapper.appendChild(canvas);
            chartsContainer.appendChild(chartWrapper);
            chartWrapper.querySelector('.delete-graph-btn').addEventListener('click', () => deleteExerciseData(exName));
            new Chart(canvas.getContext('2d'), {
                type: 'line',
                data: { labels: exerciseData[exName].labels, datasets: [{ label: 'Volume (kg)', data: exerciseData[exName].volumes, borderColor: '#00aaff', yAxisID: 'yVolume' }, { label: 'Power Score', data: exerciseData[exName].powers, borderColor: '#ff4d4d', yAxisID: 'yPower' }] },
                options: { plugins: { title: { display: false } }, scales: { yVolume: { type: 'linear', display: true, position: 'left', title: { display: true, text: 'Volume (kg)' } }, yPower: { type: 'linear', display: true, position: 'right', title: { display: true, text: 'Power' }, grid: { drawOnChartArea: false } } } }
            });
        }
    } catch (error) { console.error("Error loading analytics:", error); chartsContainer.innerHTML = '<p>Could not load analytics data.</p>'; }
};

// ===============================================
//  SESSION HISTORY & MODAL
// ===============================================
const loadHistory = async () => {
    historyContainer.innerHTML = 'Loading history...';
    try {
        const q = query(sessionsRef, orderByChild('createdAt'));
        const snapshot = await get(q);
        if (!snapshot.exists()) { historyContainer.innerHTML = '<p>No sessions saved yet.</p>'; return; }
        historyContainer.innerHTML = '';
        const allSessions = [];
        snapshot.forEach(s => allSessions.push({ id: s.key, ...s.val() }));
        allSessions.reverse().forEach(session => {
            const el = document.createElement('div');
            el.className = 'history-item';
            el.innerHTML = `<div class="history-item-info"><h4>${session.name}</h4><p>${new Date(session.createdAt).toLocaleDateString()}</p></div><div class="history-item-power"><p>Vol: ${session.totalVolume || 0} kg</p><p>Pow: ${session.totalPower || 0}</p></div><div class="history-item-actions"><button class="details-btn">View</button><button class="copy-btn">Copy</button><button class="delete-btn">Delete</button></div>`;
            historyContainer.appendChild(el);
            el.querySelector('.details-btn').addEventListener('click', () => showDetailsModal(session));
            el.querySelector('.copy-btn').addEventListener('click', () => copySession(session));
            el.querySelector('.delete-btn').addEventListener('click', (e) => deleteSession(session.id, e.currentTarget.closest('.history-item')));
        });
    } catch (error) { console.error("Error loading history:", error); historyContainer.innerHTML = '<p>Could not load history.</p>'; }
};

const deleteSession = async (sessionId, elementToRemove) => {
    if (confirm('Are you sure you want to delete this session?')) {
        try {
            await remove(ref(db, `sessions/${sessionId}`));
            elementToRemove.remove(); // Remove from UI instantly
        } catch (error) { console.error("Error deleting session:", error); alert('Could not delete session.'); }
    }
};

const copySession = (session) => {
    if (!session.exercises || !confirm('This will replace your current workout. Continue?')) return;
    switchView(trackerSection, trackerBtn);
    workoutTableBody.innerHTML = '';
    session.exercises.forEach(ex => addExerciseRow(ex));
};

const showDetailsModal = (session) => {
    modalTitle.textContent = `${session.name} - ${new Date(session.createdAt).toLocaleDateString()}`;
    let tableHTML = `<table><thead><tr><th>Exercise</th><th>Weight</th><th>Sets</th><th>Reps</th><th>Volume</th><th>Notes</th><th>Power</th></tr></thead><tbody>`;
    session.exercises.forEach(ex => { tableHTML += `<tr><td>${ex.name}</td><td>${ex.weight}</td><td>${ex.sets}</td><td>${ex.reps}</td><td>${ex.volume}</td><td>${ex.notes || '-'}</td><td>${ex.power.toFixed(2)}</td></tr>`; });
    tableHTML += `</tbody></table>`;
    modalBody.innerHTML = tableHTML;
    detailsModal.classList.remove('hidden');
};

// ===============================================
//  BODYWEIGHT TRACKER
// ===============================================
const saveBodyweight = async () => {
    const weight = parseFloat(bodyweightInput.value);
    if (!weight || weight <= 0) { alert('Please enter a valid weight.'); return; }
    try {
        await push(bodyweightRef, { weight, createdAt: serverTimestamp() });
        bodyweightInput.value = '';
        loadBodyweight();
    } catch (error) { console.error("Error saving bodyweight:", error); alert('Could not save bodyweight.'); }
};

const loadBodyweight = async () => {
    try {
        const q = query(bodyweightRef, orderByChild('createdAt'));
        const snapshot = await get(q);
        if (!snapshot.exists()) { bodyweightHistoryList.innerHTML = '<ul><li>No entries yet.</li></ul>'; return; }
        const entries = [];
        snapshot.forEach(s => entries.push(s.val()));
        let listHTML = '<ul>';
        entries.slice().reverse().slice(0, 10).forEach(entry => { listHTML += `<li>${new Date(entry.createdAt).toLocaleDateString()} <span>${entry.weight} kg</span></li>`; });
        bodyweightHistoryList.innerHTML = listHTML + '</ul>';
        if (bodyweightChart) bodyweightChart.destroy();
        bodyweightChart = new Chart(bodyweightChartCanvas, {
            type: 'line',
            data: { labels: entries.map(e => new Date(e.createdAt).toLocaleDateString()), datasets: [{ label: 'Bodyweight (kg)', data: entries.map(e => e.weight), borderColor: '#00aaff', tension: 0.1 }] },
            options: { plugins: { legend: { display: false } } }
        });
    } catch (error) { console.error("Error loading bodyweight:", error); }
};

// ===============================================
//  REST TIMER & VIEW SWITCHING
// ===============================================
let timerInterval, timerSeconds = 90;
const updateTimerDisplay = () => { timerDisplay.textContent = `${String(Math.floor(timerSeconds / 60)).padStart(2, '0')}:${String(timerSeconds % 60).padStart(2, '0')}`; };
const startTimer = () => { clearInterval(timerInterval); timerStartBtn.textContent = "Pause"; timerInterval = setInterval(() => { timerSeconds--; if (timerSeconds < 0) { clearInterval(timerInterval); timerDisplay.textContent = "00:00"; } else { updateTimerDisplay(); } }, 1000); };
const pauseTimer = () => { clearInterval(timerInterval); timerStartBtn.textContent = "Start"; };

const switchView = (viewToShow, buttonToActivate) => {
    [trackerSection, analyticsSection, historySection, bodyweightSection].forEach(v => v.classList.add('hidden'));
    [trackerBtn, analyticsBtn, historyBtn, bodyweightBtn].forEach(b => b.classList.remove('active'));
    viewToShow.classList.remove('hidden');
    buttonToActivate.classList.add('active');
    if (viewToShow === analyticsSection) loadAnalytics();
    if (viewToShow === historySection) loadHistory();
    if (viewToShow === bodyweightSection) loadBodyweight();
};

document.addEventListener('DOMContentLoaded', () => {
    trackerBtn.addEventListener('click', () => switchView(trackerSection, trackerBtn));
    analyticsBtn.addEventListener('click', () => switchView(analyticsSection, analyticsBtn));
    historyBtn.addEventListener('click', () => switchView(historySection, historyBtn));
    bodyweightBtn.addEventListener('click', () => switchView(bodyweightSection, bodyweightBtn));
    addExerciseBtn.addEventListener('click', () => addExerciseRow());
    saveSessionBtn.addEventListener('click', saveSession);
    saveBodyweightBtn.addEventListener('click', saveBodyweight);
    modalCloseBtn.addEventListener('click', () => detailsModal.classList.add('hidden'));
    detailsModal.addEventListener('click', e => { if (e.target === detailsModal) detailsModal.classList.add('hidden'); });
    timerStartBtn.addEventListener('click', () => { if (timerStartBtn.textContent === "Start") startTimer(); else pauseTimer(); });
    timerResetBtn.addEventListener('click', () => { pauseTimer(); timerSeconds = 90; updateTimerDisplay(); });
    timerPlus15Btn.addEventListener('click', () => { timerSeconds += 15; updateTimerDisplay(); });
    timerMinus15Btn.addEventListener('click', () => { if (timerSeconds > 15) { timerSeconds -= 15; updateTimerDisplay(); }});
    addExerciseRow();
    updateTimerDisplay();
    loadInitialData();
});