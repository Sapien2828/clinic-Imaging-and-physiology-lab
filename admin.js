window.addEventListener('DOMContentLoaded', () => {

    if (!document.querySelector('.admin-container')) {
        return; // 管理者画面でなければ何もしない
    }

    // ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
    // 【重要】あなた自身のFirebase設定をここに貼り付けてください
  const firebaseConfig = {

  apiKey: "AIzaSyCsk7SQQY58yKIn-q4ps1gZ2BRbc2k6flE",

  authDomain: "clinic-imaging-and-physiology.firebaseapp.com",

  projectId: "clinic-imaging-and-physiology",

  storageBucket: "clinic-imaging-and-physiology.firebasestorage.app",

  messagingSenderId: "568457688933",

  appId: "1:568457688933:web:2eee210553b939cf39538c"

    };
    // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

    // Firebaseの初期化
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

    function listenToPatients() {
        patientsCollection.orderBy("order").onSnapshot(snapshot => {
            registeredPatients = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    receptionTime: data.receptionTime.toDate(),
                    awayTime: data.awayTime ? data.awayTime.toDate() : null,
                    inRoomSince: data.inRoomSince ? data.inRoomSince.toDate() : null,
                };
            });
            renderAll();
        }, error => {
            console.error("Firestoreからのデータ取得に失敗しました:", error);
        });
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
                const card = target.closest('.patient-card');
                if (!card) return;

                if (target.matches('.away-btn')) handleAwayButtonClick(card.dataset.id);
                if (target.matches('.edit-btn')) handleEditButtonClick(card.dataset.id);
                if (target.matches('.up-btn')) handleMove(card.dataset.id, 'up');
                if (target.matches('.down-btn')) handleMove(card.dataset.id, 'down');
                if (container.id === 'registered-list-container' && target.matches('.cancel-btn')) handleCancelButtonClick(card.dataset.id);
                if (container.id === 'lab-waiting-list-container') {
                    if (target.matches('.exam-btn')) handleExamButtonClick(card.dataset.id);
                    if (target.matches('.finish-exam-btn')) handleFinishExamButtonClick(card.dataset.id);
                    if (target.matches('.change-room-btn')) handleRoomChangeClick(card.dataset.id);
                    if (target.matches('.cancel-btn')) handleCancelLabReception(card.dataset.id);
                }
            });
            let draggedItem = null;
            container.addEventListener('dragstart', (e) => {
                const target = e.target.closest('.patient-card');
                if (target) { draggedItem = target; setTimeout(() => { if (draggedItem) draggedItem.classList.add('dragging'); }, 0); }
            });
            container.addEventListener('dragend', () => { if (draggedItem) { draggedItem.classList.remove('dragging'); draggedItem = null; } });
            container.addEventListener('dragover', (e) => { e.preventDefault(); const afterElement = getDragAfterElement(container, e.clientY); const currentlyDragged = document.querySelector('.dragging'); if (currentlyDragged) { if (afterElement == null) { container.appendChild(currentlyDragged); } else { container.insertBefore(currentlyDragged, afterElement); } } });
            container.addEventListener('drop', (e) => {
                e.preventDefault();
                if (draggedItem) draggedItem.classList.remove('dragging');
                const newOrderedIds = Array.from(container.querySelectorAll('.patient-card')).map(card => card.dataset.id);
                const batch = db.batch();
                newOrderedIds.forEach((id, index) => {
                    const patientRef = patientsCollection.doc(id);
                    batch.update(patientRef, { order: index });
                });
                batch.commit();
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
    
    function showModal(title, bodyHtml, okCallback, showCancel = true) {
        if(!modalContainer) return;
        modalTitle.innerHTML = title;
        modalBody.innerHTML = bodyHtml;
        modalOkBtn.onclick = okCallback;
        modalCancelBtn.onclick = closeModal;
        modalCancelBtn.style.display = showCancel ? 'inline-block' : 'none';
        modalOkBtn.textContent = showCancel ? '決定' : 'OK';
        modalContainer.classList.add('is-visible');
    }
    function closeModal() { if(modalContainer) modalContainer.classList.remove('is-visible'); modalOkBtn.onclick = null; modalCancelBtn.onclick = null; }
    
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
    
    function handleExamButtonClick(e) {
        const patientId = e.target.closest('.patient-card')?.dataset.id;
        const selectedPatient = registeredPatients.find(p => p.id === patientId);
        if (!selectedPatient) return;
        if (selectedPatient.isExamining) { alert(`この患者は、現在「${selectedPatient.assignedExamRoom}」で検査中です。`); return; }
        const groupName = labRoomSelect.value;
        const specificRooms = roomConfiguration[groupName];
        if (specificRooms && specificRooms.length > 0) {
            const bodyHtml = `<p><strong>${groupName}</strong>のどの検査室で検査を開始しますか？</p><select id="specific-room-select" class="form-control">${specificRooms.map(r => `<option value="${r}">${r}</option>`).join('')}</select>`;
            showModal(`番号: ${selectedPatient.ticketNumber} の検査室を選択`, bodyHtml, () => {
                const specificRoom = document.getElementById('specific-room-select').value;
                setPatientToExamining(selectedPatient, specificRoom);
                closeModal();
            });
        } else { setPatientToExamining(selectedPatient, groupName); }
    }
    
    async function handleFinishExamButtonClick(e) {
        const patientId = e.target.closest('.patient-card')?.dataset.id;
        const patientRef = patientsCollection.doc(patientId);
        const doc = await patientRef.get();
        if (!doc.exists) return;
        const selectedPatient = { id: doc.id, ...doc.data() };
        const finishedRoom = selectedPatient.assignedExamRoom;
        const finishedGroup = Object.keys(roomConfiguration).find(key => roomConfiguration[key]?.includes(finishedRoom)) || finishedRoom;
        const remainingLabs = selectedPatient.labs.filter(lab => lab !== finishedGroup);
        await patientRef.update({
            isExamining: false,
            assignedExamRoom: null,
            inRoomSince: null,
            labs: remainingLabs
        });
        if (remainingLabs.length > 0) {
            const bodyHtml = `<p><strong>${finishedRoom}</strong> での検査は終了しました。</p><p>この患者にはまだ次の検査が残っています:<br><strong>${remainingLabs.join(', ')}</strong></p>`;
            showModal('次の検査があります', bodyHtml, closeModal, false);
        } else { showModal('全検査完了', `<p>番号: <strong>${selectedPatient.ticketNumber}</strong> の全検査が完了しました。</p>`, closeModal, false); }
    }

    function handleRoomChangeClick(e) {
        const patientId = e.target.closest('.patient-card')?.dataset.id;
        const selectedPatient = registeredPatients.find(p => p.id === patientId);
        if (!selectedPatient || !selectedPatient.isExamining) return;
        const currentAssignedRoom = selectedPatient.assignedExamRoom;
        const groupName = Object.keys(roomConfiguration).find(key => roomConfiguration[key]?.includes(currentAssignedRoom));
        if (groupName && roomConfiguration[groupName]) {
            const specificRoomsInGroup = roomConfiguration[groupName];
            const bodyHtml = `<p><strong>${selectedPatient.ticketNumber}番</strong>を<strong>${groupName}</strong>内で移動させます。</p><select id="specific-room-select" class="form-control">${specificRoomsInGroup.map(r => `<option value="${r}" ${r === currentAssignedRoom ? 'selected' : ''}>${r}</option>`).join('')}</select>`;
            showModal('検査室を移動', bodyHtml, () => {
                const newSpecificRoom = document.getElementById('specific-room-select').value;
                setPatientToExamining(selectedPatient, newSpecificRoom);
                closeModal();
            });
        }
    }

    async function setPatientToExamining(patient, specificRoom) {
        const querySnapshot = await patientsCollection.where("isExamining", "==", true).where("assignedExamRoom", "==", specificRoom).get();
        let proceed = true;
        if (!querySnapshot.empty) {
            const existingDoc = querySnapshot.docs[0];
            if (existingDoc.id !== patient.id) {
                if (confirm(`「${specificRoom}」では、番号札 ${existingDoc.data().ticketNumber} の方が検査中です。\nこの検査を中断して、番号札 ${patient.ticketNumber} の方の検査を開始しますか？`)) {
                    await patientsCollection.doc(existingDoc.id).update({ isExamining: false, inRoomSince: null });
                } else { proceed = false; }
            }
        }
        if (proceed) {
            await patientsCollection.doc(patient.id).update({ isExamining: true, assignedExamRoom: specificRoom, inRoomSince: new Date() });
        }
    }
    
    async function handleRegistration() {
        const newPatientData = getCurrentFormData();
        if (!newPatientData.patientId || !newPatientData.ticketNumber) { alert('患者IDと番号札は必須です。'); return; }
        const querySnapshot = await patientsCollection.where("ticketNumber", "==", newPatientData.ticketNumber).get();
        if (!querySnapshot.empty) { alert('エラー: この番号札は既に使用されています。'); return; }
        newPatientData.order = registeredPatients.length;
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
    
    async function handleEditButtonClick(e) {
        const patientId = e.target.closest('.patient-card')?.dataset.id;
        if(!patientId) return;
        const docRef = patientsCollection.doc(patientId);
        const doc = await docRef.get();
        if (doc.exists) {
            const patientToEdit = { id: doc.id, ...doc.data() };
            tabButtons.forEach(btn => { if (btn.dataset.tab === 'reception-tab') btn.click(); });
            setTimeout(() => {
                editMode.active = true;
                editMode.patientId = patientId;
                populateForm(patientToEdit);
                registerBtn.textContent = '更新';
                registerBtn.classList.remove('btn-success');
                registerBtn.classList.add('btn-info');
                patientIdInput.focus();
                window.scrollTo(0, 0);
            }, 100);
        }
    }
        
    function populateForm(patient) {
        resetReceptionForm(false);
        patientIdInput.value = patient.patientId;
        ticketNumberInput.value = patient.ticketNumber;
        specialNotesInput.value = patient.specialNotes;
        allReceptionCards.forEach(card => {
            const cardValue = card.dataset.value;
            const isGroupCard = card.dataset.isGroup === 'true';
            let isSelected = false;
            if(isGroupCard) { if (patient.labs.includes(cardValue)) { isSelected = true; } }
            else { isSelected = patient.labs.includes(cardValue) || patient.statuses.includes(cardValue); }
            if (isSelected) {
                if (card.parentElement.id === 'status-selection' && cardValue === '至急対応') card.classList.add('selected-urgent');
                else card.classList.add('selected');
            }
        });
        updatePreview();
    }

    async function handleAwayButtonClick(e) {
        const patientId = e.target.closest('.patient-card')?.dataset.id;
        if (!patientId) return;
        const doc = await patientsCollection.doc(patientId).get();
        if (!doc.exists) return;
        const isCurrentlyAway = doc.data().isAway;
        await patientsCollection.doc(patientId).update({ isAway: !isCurrentlyAway, awayTime: !isCurrentlyAway ? new Date() : null });
    }

    async function handleCancelButtonClick(e) {
        if (confirm('この受付を本当取り消しますか？（すべての検査がキャンセルされます）')) {
            const patientId = e.target.closest('.patient-card')?.dataset.id;
            if (patientId) await patientsCollection.doc(patientId).delete();
        }
    }

    async function handleCancelLabReception(e) {
        const patientId = e.target.closest('.patient-card')?.dataset.id;
        if (!patientId) return;
        const patientRef = patientsCollection.doc(patientId);
        const doc = await patientRef.get();
        if (!doc.exists) return;
        const patient = doc.data();
        const currentLabGroup = labRoomSelect.value;
        if (!currentLabGroup) return;
        if (confirm(`「${currentLabGroup}」の受付のみを取り消しますか？`)) {
            const newLabs = patient.labs.filter(lab => lab !== currentLabGroup);
            if (newLabs.length === 0) { await patientRef.delete(); } 
            else {
                const updateData = { labs: newLabs };
                if (patient.isExamining && (Object.keys(roomConfiguration).find(key => roomConfiguration[key]?.includes(patient.assignedExamRoom)) || patient.assignedExamRoom) === currentLabGroup) {
                    updateData.isExamining = false;
                    updateData.assignedExamRoom = null;
                    updateData.inRoomSince = null;
                }
                await patientRef.update(updateData);
            }
        }
    }
    
    function renderRegisteredList() {
        if (!registeredListContainer) return;
        const listScrollTop = registeredListContainer.scrollTop;
        registeredListContainer.innerHTML = '';
        if (registeredPatients.length === 0) { registeredListContainer.innerHTML = '<p class="no-patients">現在登録されている患者はいません。</p>'; return; }
        registeredPatients.forEach(patient => {
            const cardHtml = renderPatientCardHTML(patient, 'reception');
            registeredListContainer.insertAdjacentHTML('beforeend', cardHtml);
        });
        registeredListContainer.scrollTop = listScrollTop;
    }
    
    function renderLabWaitingList() {
        if (!labWaitingListContainer) return;
        const selectedRoomOrGroup = labRoomSelect.value;
        labWaitingListTitle.textContent = selectedRoomOrGroup ? `${selectedRoomOrGroup} 待機患者リスト` : '待機患者リスト';
        labWaitingListContainer.innerHTML = '';
        if (!selectedRoomOrGroup) { labWaitingListContainer.innerHTML = '<p class="no-patients">検査室を選択してください。</p>'; return; }
        const waitingPatients = registeredPatients.filter(p => p.labs.includes(selectedRoomOrGroup));
        if (waitingPatients.length === 0) { labWaitingListContainer.innerHTML = `<p class="no-patients">${selectedRoomOrGroup}の待機患者はいません。</p>`; return; }
        waitingPatients.forEach(patient => {
            const cardHtml = renderPatientCardHTML(patient, 'lab');
            labWaitingListContainer.insertAdjacentHTML('beforeend', cardHtml);
        });
    }

    function renderWaitingDisplay() { /* ... full function ... */ }
    function renderPatientCardHTML(patientData, viewType, context = {}) { /* ... full function ... */ }
    function populateLabRoomSelect() { /* ... full function ... */ }
    function startCamera(context) { /* ... full function ... */ }
    function stopCamera() { /* ... full function ... */ }
    function scanQrCodeLoop() { /* ... full function ... */ }
    async function handleMove(e, direction) { /* ... full function ... */ }
    function getDragAfterElement(container, y) { /* ... full function ... */ }
    function toggleCardSelection(card) { /* ... full function ... */ }
    function handlePatientIdInput(event, focusableElements) { /* ... full function ... */ }
    function handlePatientIdBlur(event) { /* ... full function ... */ }
    function handleNumericInput(event) { /* ... full function ... */ }
    function handleTicketNumberEnter(event) { /* ... full function ... */ }
    function handleArrowKeyNavigation(e, focusableElements) { /* ... full function ... */ }
    function updatePreview() { /* ... full function ... */ }
    function getCurrentFormData() { /* ... full function ... */ }
    function resetReceptionForm(shouldFocus = true) { /* ... full function ... */ }
        
    initialize();
});