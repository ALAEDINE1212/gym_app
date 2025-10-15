// Step 1: Import Firebase v9+ modular functions for REALTIME DATABASE
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getDatabase, ref, push, get, query, orderByChild, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-database.js";

// Step 2: Your web app's Firebase configuration
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

// Step 3: Initialize Firebase and get a reference to the Realtime Database
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const sessionsRef = ref(db, 'sessions');

// DOM Elements
const trackerSection = document.getElementById('tracker-section');
const analyticsSection = document.getElementById('analytics-section');
const trackerBtn = document.getElementById('tracker-view-btn');
const analyticsBtn = document.getElementById('analytics-view-btn');
const addExerciseBtn = document.getElementById('add-exercise-btn');
const workoutTableBody = document.getElementById('workout-table-body');
const totalPowerSpan = document.getElementById('total-power');
const saveSessionBtn = document.getElementById('save-session-btn');
const sessionNameInput = document.getElementById('session-name');
const chartsContainer = document.getElementById('charts-container');

// ---- Power Calculation Logic (Unchanged) ----
const calculatePower = (sets, addSets, reps, addReps) => {
    const s = parseFloat(sets) || 1;
    const as = parseFloat(addSets) || 1;
    const r = parseFloat(reps) || 1;
    const ar = parseFloat(addReps) || 1;
    const power = (s * as * r * ar) / 100;
    return Math.round(power * 100) / 100;
};

// ---- Update Total Power Score (Unchanged) ----
const updateTotalPower = () => {
    let total = 0;
    const rows = workoutTableBody.querySelectorAll('tr');
    rows.forEach(row => {
        const powerCell = row.querySelector('.power-score');
        total += parseFloat(powerCell.textContent) || 0;
    });
    totalPowerSpan.textContent = Math.round(total * 100) / 100;
};

// ---- Add New Exercise Row to Table (Unchanged) ----
const addExerciseRow = () => {
    const row = document.createElement('tr');
    row.innerHTML = `
        <td><input type="text" class="exercise-name" placeholder="e.g., Bench Press"></td>
        <td><input type="number" class="sets" min="1"></td>
        <td><input type="number" class="add-sets" min="1"></td>
        <td><input type="number" class="reps" min="1"></td>
        <td><input type="number" class="add-reps" min="1"></td>
        <td class="power-score">0</td>
        <td><button class="delete-row-btn">&times;</button></td>
    `;
    workoutTableBody.appendChild(row);

    row.querySelectorAll('input[type="number"]').forEach(input => {
        input.addEventListener('input', () => {
            const currentRow = input.closest('tr');
            const sets = currentRow.querySelector('.sets').value;
            const addSets = currentRow.querySelector('.add-sets').value;
            const reps = currentRow.querySelector('.reps').value;
            const addReps = currentRow.querySelector('.add-reps').value;
            
            const power = calculatePower(sets, addSets, reps, addReps);
            currentRow.querySelector('.power-score').textContent = power;
            updateTotalPower();
        });
    });

    row.querySelector('.delete-row-btn').addEventListener('click', () => {
        row.remove();
        updateTotalPower();
    });
};

// ---- Save Session to Realtime Database ----
const saveSession = async () => {
    // --- DEBUG MESSAGE 1 ---
    console.log("Save button clicked. The saveSession function has started.");

    const sessionName = sessionNameInput.value.trim();
    if (!sessionName) {
        alert('Please enter a name for the session.');
        return;
    }

    const exercises = [];
    const rows = workoutTableBody.querySelectorAll('tr');

    if (rows.length === 0) {
        alert('Please add at least one exercise.');
        return;
    }

    rows.forEach(row => {
        const exerciseName = row.querySelector('.exercise-name').value.trim();
        if (exerciseName) {
            exercises.push({
                name: exerciseName,
                sets: parseFloat(row.querySelector('.sets').value) || 0,
                addSets: parseFloat(row.querySelector('.add-sets').value) || 0,
                reps: parseFloat(row.querySelector('.reps').value) || 0,
                addReps: parseFloat(row.querySelector('.add-reps').value) || 0,
                power: parseFloat(row.querySelector('.power-score').textContent) || 0
            });
        }
    });

    const dataToSave = {
        name: sessionName,
        createdAt: serverTimestamp(),
        totalPower: parseFloat(totalPowerSpan.textContent),
        exercises: exercises
    };

    // --- DEBUG MESSAGE 2 ---
    console.log("Preparing to send this data to Firebase:", dataToSave);

    try {
        await push(sessionsRef, dataToSave);
        
        // --- SUCCESS MESSAGE ---
        console.log("Data successfully sent to Firebase!");
        alert('Session saved successfully! 💪');
        
        sessionNameInput.value = '';
        workoutTableBody.innerHTML = '';
        updateTotalPower();
        addExerciseRow();
    } catch (error) {
        // --- ERROR MESSAGE ---
        // This is the most important message. This will tell us the Firebase error.
        console.error("FIREBASE ERROR: An error occurred while saving the session:", error);
        alert('There was an error saving the session. Check the console for details.');
    }
};

// ---- Load Analytics from Realtime Database ----
const loadAnalytics = async () => {
    chartsContainer.innerHTML = 'Loading data...';
    try {
        const q = query(sessionsRef, orderByChild('createdAt'));
        const snapshot = await get(q);
        
        if (!snapshot.exists()) {
            chartsContainer.innerHTML = '<p>No data yet. Save a few sessions to see your progress!</p>';
            return;
        }

        const exerciseData = {};
        const allSessions = snapshot.val(); 

        for (const sessionId in allSessions) {
            const session = allSessions[sessionId];
            const sessionDate = new Date(session.createdAt).toLocaleDateDateString();

            if (session.exercises) {
                session.exercises.forEach(ex => {
                    if (!exerciseData[ex.name]) {
                        exerciseData[ex.name] = { labels: [], powers: [] };
                    }
                    exerciseData[ex.name].labels.push(sessionDate);
                    exerciseData[ex.name].powers.push(ex.power);
                });
            }
        }
        chartsContainer.innerHTML = ''; 

        for (const exerciseName in exerciseData) {
            const data = exerciseData[exerciseName];
            const chartWrapper = document.createElement('div');
            chartWrapper.className = 'chart-wrapper';
            const canvas = document.createElement('canvas');
            chartWrapper.appendChild(canvas);
            chartsContainer.appendChild(chartWrapper);

            new Chart(canvas, {
                type: 'line',
                data: {
                    labels: data.labels,
                    datasets: [{
                        label: `Power Score for ${exerciseName}`,
                        data: data.powers,
                        borderColor: 'rgba(0, 170, 255, 1)',
                        backgroundColor: 'rgba(0, 170, 255, 0.2)',
                        fill: true,
                        tension: 0.2
                    }]
                },
                options: {
                    scales: { y: { beginAtZero: true } },
                    plugins: {
                        legend: { display: false },
                        title: {
                            display: true,
                            text: exerciseName,
                            color: '#e0e0e0',
                            font: { size: 16 }
                        }
                    }
                }
            });
        }
    } catch (error) {
        console.error("Error loading analytics: ", error);
        chartsContainer.innerHTML = '<p>Could not load analytics data.</p>';
    }
};

// ---- View Switching Logic (Unchanged) ----
const showTrackerView = () => {
    trackerSection.classList.remove('hidden');
    analyticsSection.classList.add('hidden');
    trackerBtn.classList.add('active');
    analyticsBtn.classList.remove('active');
};

const showAnalyticsView = () => {
    trackerSection.classList.add('hidden');
    analyticsSection.classList.remove('hidden');
    trackerBtn.classList.remove('active');
    analyticsBtn.classList.add('active');
    loadAnalytics();
};

// ---- Event Listeners ----
addExerciseBtn.addEventListener('click', addExerciseRow);
saveSessionBtn.addEventListener('click', saveSession);
trackerBtn.addEventListener('click', showTrackerView);
analyticsBtn.addEventListener('click', showAnalyticsView);

// ---- Initial Load ----
addExerciseRow();