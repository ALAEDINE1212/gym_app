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
// Views
const trackerSection = document.getElementById('tracker-section');
const analyticsSection = document.getElementById('analytics-section');
const historySection = document.getElementById('history-section');
const bodyweightSection = document.getElementById('bodyweight-section');
// Nav Buttons
const trackerBtn = document.getElementById('tracker-view-btn');
const analyticsBtn = document.getElementById('analytics-view-btn');
const historyBtn = document.getElementById('history-view-btn');
const bodyweightBtn = document.getElementById('bodyweight-view-btn');
// Workout Tracker
const addExerciseBtn = document.getElementById('add-exercise-btn');
const workoutTableBody = document.getElementById('workout-table-body');
const totalPowerSpan = document.getElementById('total-power');
const totalVolumeSpan = document.getElementById('total-volume');
const saveSessionBtn = document.getElementById('save-session-btn');
const sessionNameInput = document.getElementById('session-name');
const exerciseDataList = document.getElementById('exercise-list');
// Analytics
const chartsContainer = document.getElementById('charts-container');
const prContainer = document.getElementById('pr-container');
// History
const historyContainer = document.getElementById('history-container');
// Bodyweight
const bodyweightInput = document.getElementById('bodyweight-input');
const saveBodyweightBtn = document.getElementById('save-bodyweight-btn');
const bodyweightHistoryList = document.getElementById('bodyweight-history-list');
const bodyweightChartCanvas = document.getElementById('bodyweight-chart').getContext('2d');
// Timer
const timerDisplay = document.getElementById('timer-display');
const timerStartBtn = document.getElementById('timer-start-btn');
const timerResetBtn = document.getElementById('timer-reset-btn');
const timerPlus15Btn = document.getElementById('timer-plus-15-btn');
const timerMinus15Btn = document.getElementById('timer-minus-15-btn');
// Modal
const detailsModal = document.getElementById('details-modal');
const modalCloseBtn = document.getElementById('modal-close-btn');
const modalTitle = document.getElementById('modal-title');
const modalBody = document.getElementById('modal-body');

// Global state
let bodyweightChart;
let allExerciseNames = new Set();

// ===============================================
//  CALCULATION LOGIC
// ===============================================
const calculatePower = (weight, sets, reps) => {
    const w = parseFloat(weight) || 0;
    const s = parseFloat(sets) || 1;
    const r = parseFloat(reps) || 1;
    // Simplified power formula based on volume
    return Math.round((w * s * r) / 100);
};

const calculateVolume = (weight, sets, reps) => {
    const w = parseFloat(weight) || 0;
    const s = parseFloat(sets) || 0;
    const r = parseFloat(reps) || 0;
    return w * s * r;
};

// ===============================================
//  WORKOUT TRACKER
// ===============================================
const updateRowCalculations = (row) => {
    const weight = row.querySelector('.weight').value;
    const sets = row.querySelector('.sets').value;
    const reps = row.querySelector('.reps').value;
    
    const power = calculatePower(weight, sets, reps);
    const volume = calculateVolume(weight, sets, reps);

    row.querySelector('.power-score').textContent = power;
    row.querySelector('.volume-score').textContent = volume;
    updateTotalScores();
};

const updateTotalScores = () => {
    let totalPower = 0, totalVolume = 0;
    const rows = workoutTableBody.querySelectorAll('tr');
    rows.forEach(row => {
        totalPower += parseFloat(row.querySelector('.power-score').textContent) || 0;
        totalVolume += parseFloat(row.querySelector('.volume-score').textContent) || 0;
    });
    totalPowerSpan.textContent = totalPower;
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
        <td class="power-score">0</td>
        <td><button class="delete-row-btn">&times;</button></td>
    `;
    workoutTableBody.appendChild(row);

    row.querySelectorAll('input').forEach(input => {
        input.addEventListener('input', () => updateRowCalculations(row));
    });

    row.querySelector('.delete-row-btn').addEventListener('click', () => {
        row.remove();
        updateTotalScores();
    });
    
    if (exercise.name) {
        updateRowCalculations(row);
    }
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
        await push(sessionsRef, {
            name: sessionName,
            createdAt: serverTimestamp(),
            totalPower: parseFloat(totalPowerSpan.textContent),
            totalVolume: parseFloat(totalVolumeSpan.textContent),
            exercises: exercises
        });
        await set(exerciseNamesRef, Array.from(allExerciseNames));
        alert('Session saved successfully! 💪');
        sessionNameInput.value = '';
        workoutTableBody.innerHTML = '';
        updateTotalScores();
        addExerciseRow();
    } catch (error) {
        console.error("FIREBASE ERROR:", error);
        alert('Error saving session. Check console.');
    }
};

// ===============================================
//  ANALYTICS & PRs
// ===============================================
const updatePR = async (exercise) => {
    if (!exercise.name || !exercise.weight) return;
    const prRef = ref(db, `personalRecords/${exercise.name}`);
    const snapshot = await get(prRef);
    const currentPR = snapshot.val() || 0;
    if (exercise.weight > currentPR) {
        await set(prRef, exercise.weight);
    }
};

const loadPRs = async () => {
    prContainer.innerHTML = 'Loading PRs...';
    const snapshot = await get(prsRef);
    if (!snapshot.exists()) {
        prContainer.innerHTML = '<p>No personal records set yet.</p>';
        return;
    }
    prContainer.innerHTML = '';
    snapshot.forEach(childSnapshot => {
        const prCard = document.createElement('div');
        prCard.className = 'pr-card';
        prCard.innerHTML = `<h4>${childSnapshot.key}</h4><p>${childSnapshot.val()} kg</p>`;
        prContainer.appendChild(prCard);
    });
};

const loadAnalytics = async () => {
    chartsContainer.innerHTML = 'Loading data...';
    try {
        loadPRs();
        
        const q = query(sessionsRef, orderByChild('createdAt'));
        const snapshot = await get(q);
        
        if (!snapshot.exists()) {
            chartsContainer.innerHTML = '<p>No data yet for charts.</p>';
            return;
        }

        const exerciseData = {};
        snapshot.forEach(child => {
            const session = child.val();
            const sessionDate = new Date(session.createdAt).toLocaleDateString();

            if (session.exercises) {
                session.exercises.forEach(ex => {
                    if (!exerciseData[ex.name]) {
                        exerciseData[ex.name] = { labels: [], volumes: [], powers: [] };
                    }
                    exerciseData[ex.name].labels.push(sessionDate);
                    exerciseData[ex.name].volumes.push(ex.volume);
                    exerciseData[ex.name].powers.push(ex.power);
                });
            }
        });
        
        chartsContainer.innerHTML = '';
        for (const exName in exerciseData) {
            const data = exerciseData[exName];
            const chartWrapper = document.createElement('div');
            chartWrapper.className = 'chart-wrapper';
            const canvas = document.createElement('canvas');
            chartWrapper.appendChild(canvas);
            chartsContainer.appendChild(chartWrapper);

            new Chart(canvas.getContext('2d'), {
                type: 'line',
                data: {
                    labels: data.labels,
                    datasets: [
                        { label: 'Volume (kg)', data: data.volumes, borderColor: '#00aaff', yAxisID: 'yVolume' },
                        { label: 'Power Score', data: data.powers, borderColor: '#ff4d4d', yAxisID: 'yPower' }
                    ]
                },
                options: {
                    plugins: { title: { display: true, text: exName, color: '#e0e0e0', font: { size: 16 } } },
                    scales: {
                        yVolume: { type: 'linear', display: true, position: 'left', title: { display: true, text: 'Volume (kg)', color: '#e0e0e0' }, ticks: { color: '#e0e0e0' } },
                        yPower: { type: 'linear', display: true, position: 'right', title: { display: true, text: 'Power', color: '#e0e0e0' }, grid: { drawOnChartArea: false }, ticks: { color: '#e0e0e0' } },
                        x: { ticks: { color: '#e0e0e0' } }
                    }
                }
            });
        }
    } catch (error) {
        console.error("ANALYTICS ERROR:", error);
        chartsContainer.innerHTML = '<p>Error loading analytics data. Check console for details.</p>';
    }
};