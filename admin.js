window.addEventListener('DOMContentLoaded', () => {

    if (!document.querySelector('.admin-container')) {
        return;
    }

const firebaseConfig = {

  apiKey: "AIzaSyCsk7SQQY58yKIn-q4ps1gZ2BRbc2k6flE",

  authDomain: "clinic-imaging-and-physiology.firebaseapp.com",

  projectId: "clinic-imaging-and-physiology",

  storageBucket: "clinic-imaging-and-physiology.firebasestorage.app",

  messagingSenderId: "568457688933",

  appId: "1:568457688933:web:2eee210553b939cf39538c"
    };

    firebase.initializeApp(firebaseConfig);
    const db = firebase.firestore();
    const patientsCollection = db.collection('patients');

    const LAST_ACTIVE_DATE_KEY = 'receptionLastActiveDate';
    const roomConfiguration = {
        'レントゲン撮影室': ['レントゲン撮影室(1番)', 'レントゲン撮影室(2番)', '透視室(6番)'],
        '超音波検査室': ['超音波検査室(3番)', '超音波検査室(11番)', '超音波検査室(14番)', '超音波検査室(15番)'],
        '骨密度検査室(4番)': null, 'CT撮影室(5番)': null, '乳腺撮影室(10番)': null, '肺機能検査室(12番)': null, 
        '心電図検査室(13番)': null, '透視室(6番)': null, '聴力検査室(7番)': null, '呼吸機能検査室(8番)': null, '血管脈波検査室(9番)': null,
    };
    const waitingRoomOrder = ['レントゲン撮影室(1番)', 'レントゲン撮影室(2番)', '超音波検査室(3番)', '骨密度検査室(4番)', 'CT撮影室(5番)', '透視室(6番)', '聴力検査室(7番)', '呼吸機能検査室(8番)', '血管脈波検査室(9番)', '乳腺撮影室(10番)', '超音波検査室(11番)', '肺機能検査室(12番)', '心電図検査室(13番)', '超音波検査室(14番)', '超音波検査室(15番)'];
    const specialNoteRooms = ['CT撮影室(5番)', '超音波検査室(3番)', '超音波検査室(11番)', '超音波検査室(14番)', '超音波検査室(15番)'];

    let registeredPatients = []; 
    let editMode = { active: false, patientId: null };
    let mediaStream = null;
    let qrScanContext = null;

    const allTabs = document.querySelectorAll('.tab-content');
    const tabButtons = document.querySelectorAll('.tab-button');
    const receptionTab = document.getElementById('reception-tab');
    const patientIdInput = document.getElementById('patient-id');
    const ticketNumberInput = document.getElementById('ticket-number');
    const specialNotesInput = document.getElementById('special-notes');
    const allReceptionCards = document.querySelectorAll('#reception-tab .card-button');
    const labSelectionCards = document.querySelectorAll('#lab-selection .card-button');
    const statusSelectionCards = document.querySelectorAll('#status-selection .card-button');
    const previewArea = document.getElementById('preview-area');
    const registerBtn = document.getElementById('register-btn');
    const registeredListContainer = document.getElementById('registered-list-container');
    const receptionQrReaderBtn = document.getElementById('reception-qr-reader-btn');
    const labQrReaderBtn = document.getElementById('lab-qr-reader-btn');
    const cameraContainer = document.getElementById('camera-container');
    const videoElement = document.getElementById('camera-video');
    const stopCameraBtn = document.getElementById('stop-camera-btn');
    const canvasElement = document.createElement('canvas');
    const labRoomSelect = document.getElementById('lab-room-select');
    const labWaitingListTitle = document.getElementById('lab-waiting-list-title');
    const labWaitingListContainer = document.getElementById('lab-waiting-list-container');
    const waitingDisplayGrid = document.querySelector('#waiting-tab .waiting-display-grid');
    const modalContainer = document.getElementById('modal-container');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const modalOkBtn = document.getElementById('modal-ok-btn');
    const modalCancelBtn = document.getElementById('modal-cancel-btn');
    const resetAllBtn = document.getElementById('reset-all-btn');

    function checkAndResetDailyData() {
        const today = new Date().toISOString().split('T')[0];
        const lastDate = localStorage.getItem(LAST_ACTIVE_DATE_KEY);
        if (today !== lastDate) {
            handleResetAll(true);
            localStorage.setItem(LAST_ACTIVE_DATE_KEY, today);
        }
    }

    function renderAll() {
        const activeTab = document.querySelector('.tab-content.active');
        if (!activeTab) return;
        const activeTabId = activeTab.id;
        if (activeTabId === 'reception-tab') renderRegisteredList();
        else if (activeTabId === 'lab-tab') renderLabWaitingList();
        else if (activeTabId === 'waiting-tab') renderWaitingDisplay();
    }
    
    function initialize() {
        checkAndResetDailyData();
        setupEventListeners();
        populateLabRoomSelect();
        listenToPatients(); 
        if (previewArea) updatePreview();
    }

    function setupEventListeners() {
        const allFocusableElements = Array.from(receptionTab.querySelectorAll('[tabindex]')).filter(el => el.tabIndex > 0).sort((a, b) => a.tabIndex - b.tabIndex);
        tabButtons.forEach(button => { button.addEventListener('click', (e) => {
            const targetTabId = e.currentTarget.dataset.tab;
            tabButtons.forEach(btn => btn.classList.remove('active'));
            e.currentTarget.classList.add('active');
            allTabs.forEach(tab => { if(tab) tab.id === targetTabId ? tab.classList.add('active') : tab.classList.remove('active'); });
            renderAll();
        }); });
        
        if (registerBtn) { registerBtn.addEventListener('click', () => { if (editMode.active) handleUpdate(); else handleRegistration(); }); }
        
        const setupListEventListeners = (container) => {
            if (!container) return;
            container.addEventListener('click', (e) => {
                const target = e.target.closest('button');
                if (!target) return;
                if (target.matches('.away-btn')) handleAwayButtonClick(e);
                if (target.matches('.edit-btn')) handleEditButtonClick(e);
                if (target.matches('.up-btn')) handleMove(e, 'up');
                if (target.matches('.down-btn')) handleMove(e, 'down');
                if (container.id === 'registered-list-container' && target.matches('.cancel-btn')) handleCancelButtonClick(e);
                if (container.id === 'lab-waiting-list-container') {
                    if (target.matches('.exam-btn')) handleExamButtonClick(e);
                    if (target.matches('.finish-exam-btn')) handleFinishExamButtonClick(e);
                    if (target.matches('.change-room-btn')) handleRoomChangeClick(e);
                    if (target.matches('.cancel-btn')) handleCancelLabReception(e);
                }
            });
            let draggedItem = null;
            container.addEventListener('dragstart', (e) => {
                const target = e.target.closest('.patient-card');
                if (target) { draggedItem = target; setTimeout(() => { if (draggedItem) draggedItem.classList.add('dragging'); }, 0); }
            });
            container.addEventListener('dragend', () => { if (draggedItem) { draggedItem.classList.remove('dragging'); draggedItem = null; } });
            container.addEventListener('dragover', (e) => { e.preventDefault(); const afterElement = getDragAfterElement(container, e.clientY); const currentlyDragged = document.querySelector('.dragging'); if (currentlyDragged) { if (afterElement == null) { container.appendChild(currentlyDragged); } else { container.insertBefore(currentlyDragged, afterElement); } } });
            container.addEventListener('drop', async (e) => {
                e.preventDefault();
                if (draggedItem) draggedItem.classList.remove('dragging');
                const newOrderedIds = Array.from(container.querySelectorAll('.patient-card')).map(card => card.dataset.id);
                const batch = db.batch();
                newOrderedIds.forEach((id, index) => {
                    const patientRef = patientsCollection.doc(id);
                    batch.update(patientRef, { order: index });
                });
                await batch.commit();
            });
        };
        setupListEventListeners(registeredListContainer);
        setupListEventListeners(labWaitingListContainer);

        allReceptionCards.forEach(card => {
            card.addEventListener('click', () => toggleCardSelection(card));
            card.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggleCardSelection(card); } });
        });
        if (patientIdInput) { patientIdInput.addEventListener('input', (e) => handlePatientIdInput(e, allFocusableElements)); patientIdInput.addEventListener('blur', handlePatientIdBlur); }
        if (ticketNumberInput) { ticketNumberInput.addEventListener('input', handleNumericInput); ticketNumberInput.addEventListener('keydown', handleTicketNumberEnter); }
        if (specialNotesInput) { specialNotesInput.addEventListener('input', updatePreview); }
        if (receptionQrReaderBtn) { receptionQrReaderBtn.addEventListener('click', () => startCamera('reception')); }
        if (labQrReaderBtn) { labQrReaderBtn.addEventListener('click', () => startCamera('lab')); }
        if (stopCameraBtn) { stopCameraBtn.addEventListener('click', stopCamera); }
        if (labRoomSelect) { labRoomSelect.addEventListener('change', renderLabWaitingList); }
        if (resetAllBtn) { resetAllBtn.addEventListener('click', () => handleResetAll(false)); }
        if (receptionTab) { receptionTab.addEventListener('keydown', (e) => handleArrowKeyNavigation(e, allFocusableElements)); }
    }
    
    function showModal(title, bodyHtml, okCallback, showCancel = true) { /* ... same as previous correct version ... */ }
    function closeModal() { /* ... same as previous correct version ... */ }
    
    async function handleResetAll(isAutomatic = false) {
        const confirmReset = async () => {
            const snapshot = await patientsCollection.get();
            const batch = db.batch();
            snapshot.docs.forEach(doc => { batch.delete(doc.ref); });
            await batch.commit();
        };
        if (isAutomatic) { confirmReset(); } 
        else { if(confirm('現在の受付情報をすべてリセットしますか？\nこの操作は元に戻せません。')) { confirmReset(); } }
    }
    
    function handleExamButtonClick(e) { /* ... same as previous correct version ... */ }
    async function handleFinishExamButtonClick(e) { /* ... same as previous correct version ... */ }
    async function handleRoomChangeClick(e) { /* ... same as previous correct version ... */ }
    async function setPatientToExamining(patient, specificRoom) { /* ... same as previous correct version ... */ }
    
    async function handleRegistration() {
        const newPatientData = getCurrentFormData();
        if (!newPatientData.patientId || !newPatientData.ticketNumber) { alert('患者IDと番号札は必須です。'); return; }
        const querySnapshot = await patientsCollection.where("ticketNumber", "==", newPatientData.ticketNumber).get();
        if (!querySnapshot.empty) { alert('エラー: この番号札は既に使用されています。'); return; }
        
        const order = registeredPatients.length > 0 ? Math.max(...registeredPatients.map(p => p.order)) + 1 : 0;
        newPatientData.order = order;
        
        await patientsCollection.add(newPatientData);
        resetReceptionForm();
    }

    async function handleUpdate() {
        if (!editMode.active || !editMode.patientId) return;
        const patientRef = patientsCollection.doc(editMode.patientId);
        const newTicketNumber = ticketNumberInput.value;
        const newPatientId = patientIdInput.value;
        if (!newPatientId || !newTicketNumber) { alert('患者IDと番号札は必須です。'); return; }
        
        const querySnapshot = await patientsCollection.where("ticketNumber", "==", newTicketNumber).get();
        const conflictingDoc = querySnapshot.docs.find(doc => doc.id !== editMode.patientId);
        if (conflictingDoc) { alert('エラー: この番号札は他の患者が使用しています。'); return; }

        const updatedData = {
            patientId: newPatientId,
            ticketNumber: newTicketNumber,
            labs: Array.from(labSelectionCards).filter(c => c.classList.contains('selected')).map(c => c.dataset.value),
            statuses: Array.from(statusSelectionCards).filter(c => c.classList.contains('selected') || c.classList.contains('selected-urgent')).map(c => c.dataset.value),
            specialNotes: specialNotesInput.value,
        };
        await patientRef.update(updatedData);
        resetReceptionForm();
    }
    
    async function handleEditButtonClick(e) { /* ... same as previous correct version ... */ }
    function populateForm(patient) { /* ... same as previous correct version ... */ }
    async function handleAwayButtonClick(e) { /* ... same as previous correct version ... */ }
    async function handleCancelButtonClick(e) { /* ... same as previous correct version ... */ }
    async function handleCancelLabReception(e) { /* ... same as previous correct version ... */ }
    
    function renderRegisteredList() { /* ... same as previous correct version ... */ }
    function renderLabWaitingList() { /* ... same as previous correct version ... */ }
    function renderWaitingDisplay() { /* ... same as previous correct version ... */ }
    function renderPatientCardHTML(patientData, viewType, context = {}) { /* ... same as previous correct version ... */ }
    function populateLabRoomSelect() { /* ... same as previous correct version ... */ }
    
    function startCamera(context) { /* ... same as previous correct version ... */ }
    function stopCamera() { /* ... same as previous correct version ... */ }
    function scanQrCodeLoop() { /* ... same as previous correct version ... */ }
    
    async function handleMove(e, direction) {
        const cardElement = e.target.closest('.patient-card');
        if (!cardElement) return;
        const patientId = cardElement.dataset.id;
        const index = registeredPatients.findIndex(p => p.id === patientId);
        if (index === -1) return;

        let otherIndex = -1;
        if (direction === 'up' && index > 0) { otherIndex = index - 1; } 
        else if (direction === 'down' && index < registeredPatients.length - 1) { otherIndex = index + 1; }
        
        if (otherIndex !== -1) {
            const patient1 = registeredPatients[index];
            const patient2 = registeredPatients[otherIndex];
            const batch = db.batch();
            batch.update(patientsCollection.doc(patient1.id), { order: patient2.order });
            batch.update(patientsCollection.doc(patient2.id), { order: patient1.order });
            await batch.commit();
        }
    }
        
    function getDragAfterElement(container, y) { /* ... same as previous correct version ... */ }
    function toggleCardSelection(card) { /* ... same as previous correct version ... */ }
    function handlePatientIdInput(e, focusableElements) { /* ... same as previous correct version ... */ }
    function handlePatientIdBlur(event) { /* ... same as previous correct version ... */ }
    function handleNumericInput(event) { /* ... same as previous correct version ... */ }
    function handleTicketNumberEnter(event) { /* ... same as previous correct version ... */ }
    function handleArrowKeyNavigation(e, focusableElements) { /* ... same as previous correct version ... */ }
    
    function getCurrentFormData() {
        return {
            patientId: patientIdInput.value, ticketNumber: ticketNumberInput.value, receptionTime: firebase.firestore.FieldValue.serverTimestamp(),
            labs: Array.from(labSelectionCards).filter(c => c.classList.contains('selected')).map(c => c.dataset.value),
            statuses: Array.from(statusSelectionCards).filter(c => c.classList.contains('selected') || c.classList.contains('selected-urgent')).map(c => c.dataset.value),
            specialNotes: specialNotesInput.value, isAway: false, awayTime: null, isExamining: false, assignedExamRoom: null, inRoomSince: null
        };
    }

    function updatePreview() {
        if (!previewArea) return;
        const formData = getCurrentFormData();
        if (!formData.patientId && !formData.ticketNumber && formData.labs.length === 0 && formData.statuses.length === 0 && !formData.specialNotes) {
            previewArea.innerHTML = '<p class="no-patients">入力するとここにプレビューが表示されます。</p>'; return;
        }
        // receptionTimeがまだないので、仮の時間を表示
        formData.receptionTime = new Date();
        previewArea.innerHTML = renderPatientCardHTML(formData, 'reception');
    }

    function resetReceptionForm(shouldFocus = true) {
        if (!patientIdInput) return;
        patientIdInput.value = ''; ticketNumberInput.value = ''; specialNotesInput.value = '';
        allReceptionCards.forEach(card => card.classList.remove('selected', 'selected-urgent'));
        if (editMode.active) {
            editMode = { active: false, patientId: null };
            registerBtn.textContent = '受付登録';
            registerBtn.classList.remove('btn-info');
            registerBtn.classList.add('btn-success');
        }
        updatePreview();
        if (shouldFocus) { patientIdInput.focus(); }
    }
        
    initialize();
});