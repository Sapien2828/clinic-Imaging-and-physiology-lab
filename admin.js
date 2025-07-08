// admin.js (最終完成版)
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
    let qrScanContext = null;
    let html5QrCode = null;

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
    const stopCameraBtn = document.getElementById('stop-camera-btn');
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
        if (!document.querySelector('.admin-container')) return;
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
                    receptionTime: data.receptionTime?.toDate(),
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
                const patientId = card.dataset.id;
                if (target.matches('.away-btn')) handleAwayButtonClick(patientId);
                if (target.matches('.edit-btn')) handleEditButtonClick(patientId);
                if (target.matches('.up-btn')) handleMove(patientId, 'up');
                if (target.matches('.down-btn')) handleMove(patientId, 'down');
                if (container.id === 'registered-list-container' && target.matches('.cancel-btn')) handleCancelButtonClick(patientId);
                if (container.id === 'lab-waiting-list-container') {
                    if (target.matches('.exam-btn')) handleExamButtonClick(patientId);
                    if (target.matches('.finish-exam-btn')) handleFinishExamButtonClick(patientId);
                    if (target.matches('.change-room-btn')) handleRoomChangeClick(patientId);
                    if (target.matches('.cancel-btn')) handleCancelLabReception(patientId);
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
                try {
                    await batch.commit();
                } catch (error) {
                    console.error("ドラッグ＆ドロップによる順序更新に失敗: ", error);
                }
            });
        };
        setupListEventListeners(registeredListContainer);
        setupListEventListeners(labWaitingListContainer);

        allReceptionCards.forEach(card => {
            card.addEventListener('click', () => toggleCardSelection(card));
            card.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggleCardSelection(card); } });
        });
        if (patientIdInput) { patientIdInput.addEventListener('input', handlePatientIdInput); patientIdInput.addEventListener('blur', handlePatientIdBlur); }
        if (ticketNumberInput) { ticketNumberInput.addEventListener('input', handleNumericInput); ticketNumberInput.addEventListener('keydown', handleTicketNumberEnter); }
        if (specialNotesInput) { specialNotesInput.addEventListener('input', updatePreview); }
        if (receptionQrReaderBtn) { receptionQrReaderBtn.addEventListener('click', () => startCamera('reception')); }
        if (labQrReaderBtn) { labQrReaderBtn.addEventListener('click', () => startCamera('lab')); }
        if (stopCameraBtn) { stopCameraBtn.addEventListener('click', stopCamera); }
        if (labRoomSelect) { labRoomSelect.addEventListener('change', renderLabWaitingList); }
        if (resetAllBtn) { resetAllBtn.addEventListener('click', () => handleResetAll(false)); }
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
            try {
                const snapshot = await patientsCollection.get();
                if(snapshot.empty) return;
                const batch = db.batch();
                snapshot.docs.forEach(doc => { batch.delete(doc.ref); });
                await batch.commit();
            } catch (error) {
                console.error("一斉リセットに失敗しました: ", error);
                if (!isAutomatic) alert("リセットに失敗しました。");
            }
        };
        if (isAutomatic) { confirmReset(); } 
        else { if(confirm('現在の受付情報をすべてリセットしますか？\nこの操作は元に戻せません。')) { confirmReset(); } }
    }
    
    function handleExamButtonClick(patientId) {
        const selectedPatient = registeredPatients.find(p => p.id === patientId);
        if (!selectedPatient) return;
        if (selectedPatient.isExamining) {
            alert(`この患者は、現在「${selectedPatient.assignedExamRoom}」で検査中です。`);
            return;
        }
        const groupName = labRoomSelect.value;
        const specificRooms = roomConfiguration[groupName];
        if (specificRooms && specificRooms.length > 0) {
            const bodyHtml = `<p><strong>${groupName}</strong>のどの検査室で検査を開始しますか？</p><select id="specific-room-select" class="form-control">${specificRooms.map(r => `<option value="${r}">${r}</option>`).join('')}</select>`;
            showModal(`番号: ${selectedPatient.ticketNumber} の検査室を選択`, bodyHtml, () => {
                const specificRoom = document.getElementById('specific-room-select').value;
                setPatientToExamining(selectedPatient, specificRoom);
                closeModal();
            });
        } else {
            setPatientToExamining(selectedPatient, groupName);
        }
    }
    
    async function handleFinishExamButtonClick(patientId) {
        try {
            const patientRef = patientsCollection.doc(patientId);
            const doc = await patientRef.get();
            if (!doc.exists) return;
            const selectedPatient = {id: doc.id, ...doc.data()};
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
            } else {
                showModal('全検査完了', `<p>番号: <strong>${selectedPatient.ticketNumber}</strong> の全検査が完了しました。</p>`, closeModal, false);
            }
        } catch (error) {
            console.error("検査終了処理に失敗: ", error);
            alert("検査終了処理に失敗しました。");
        }
    }

    function handleRoomChangeClick(patientId) {
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
        try {
            const querySnapshot = await patientsCollection.where("isExamining", "==", true).where("assignedExamRoom", "==", specificRoom).get();
            let proceed = true;
            if (!querySnapshot.empty) {
                const existingDoc = querySnapshot.docs[0];
                if (existingDoc.id !== patient.id) {
                    if (confirm(`「${specificRoom}」では、番号札 ${existingDoc.data().ticketNumber} の方が検査中です。\nこの検査を中断して、番号札 ${patient.ticketNumber} の方の検査を開始しますか？`)) {
                        await patientsCollection.doc(existingDoc.id).update({ isExamining: false, inRoomSince: null, assignedExamRoom: null });
                    } else { proceed = false; }
                }
            }
            if (proceed) {
                const updateData = { isExamining: true, assignedExamRoom: specificRoom, inRoomSince: new Date() };
                await patientsCollection.doc(patient.id).update(updateData);
            }
        } catch (error) {
            console.error("検査開始処理に失敗: ", error);
            alert("検査開始処理に失敗しました。");
        }
    }
    
    async function handleRegistration() {
        const newPatientData = getCurrentFormData();
        if (!newPatientData.patientId || !newPatientData.ticketNumber) { alert('患者IDと番号札は必須です。'); return; }
        if (newPatientData.labs.length === 0) { alert('検査室を一つ以上選択してください。'); return; }
        
        try {
            const querySnapshot = await patientsCollection.where("ticketNumber", "==", newPatientData.ticketNumber).get();
            if (!querySnapshot.empty) { alert('エラー: この番号札は既に使用されています。'); return; }
            await patientsCollection.add(newPatientData);
            resetReceptionForm();
        } catch (error) {
            console.error("受付登録に失敗: ", error);
            alert("受付登録に失敗しました。");
        }
    }

    async function handleUpdate() {
        if (!editMode.active || !editMode.patientId) return;
        const newTicketNumber = ticketNumberInput.value.trim();
        const newPatientId = patientIdInput.value.trim();
        if (!newPatientId || !newTicketNumber) { alert('患者IDと番号札は必須です。'); return; }
        
        try {
            const querySnapshot = await patientsCollection.where("ticketNumber", "==", newTicketNumber).get();
            const conflictingDoc = querySnapshot.docs.find(doc => doc.id !== editMode.patientId);
            if (conflictingDoc) { alert('エラー: この番号札は他の患者が使用しています。'); return; }
            
            const patientRef = patientsCollection.doc(editMode.patientId);
            const doc = await patientRef.get();
            if (!doc.exists) { resetReceptionForm(); return; }
            const existingData = doc.data();
            
            const updatedData = {
                patientId: newPatientId,
                ticketNumber: newTicketNumber,
                labs: Array.from(labSelectionCards).filter(c => c.classList.contains('selected')).map(c => c.dataset.value),
                statuses: Array.from(statusSelectionCards).filter(c => c.classList.contains('selected') || c.classList.contains('selected-urgent')).map(c => c.dataset.value),
                specialNotes: specialNotesInput.value,
            };
            
            let order = existingData.order;
            const isNowUrgent = updatedData.statuses.includes('至急対応');
            const wasUrgent = existingData.statuses.includes('至急対応');

            if (isNowUrgent && !wasUrgent) {
                const urgentOrders = registeredPatients.filter(p => p.statuses.includes('至急対応')).map(p => p.order);
                const minOrder = urgentOrders.length > 0 ? Math.min(...urgentOrders) : (registeredPatients[0]?.order || 0);
                order = minOrder - 1;
            } else if (!isNowUrgent && wasUrgent) {
                order = Date.now();
            }
            updatedData.order = order;
            
            await patientRef.update(updatedData);
            resetReceptionForm();
        } catch (error) {
            console.error("更新処理に失敗: ", error);
            alert("更新処理に失敗しました。");
        }
    }
    
    async function handleEditButtonClick(patientId) {
        const patientToEdit = registeredPatients.find(p => p.id === patientId);
        if (patientToEdit) {
            tabButtons.forEach(btn => { if (btn.dataset.tab === 'reception-tab') btn.click(); });
            setTimeout(() => {
                editMode.active = true;
                editMode.patientId = patientId;
                populateForm(patientToEdit);
                registerBtn.textContent = '更新';
                registerBtn.classList.remove('btn-success');
                registerBtn.classList.add('btn-info');
                if (patientIdInput) patientIdInput.focus();
                window.scrollTo(0, 0);
            }, 100);
        }
    }
        
    function populateForm(patient) {
        resetReceptionForm(false);
        if(patientIdInput) patientIdInput.value = patient.patientId;
        if(ticketNumberInput) ticketNumberInput.value = patient.ticketNumber;
        if(specialNotesInput) specialNotesInput.value = patient.specialNotes;
        allReceptionCards.forEach(card => {
            const cardValue = card.dataset.value;
            if (patient.labs.includes(cardValue) || patient.statuses.includes(cardValue)) {
                if (card.parentElement.id === 'status-selection' && cardValue === '至急対応') {
                    card.classList.add('selected-urgent');
                } else {
                    card.classList.add('selected');
                }
            }
        });
        updatePreview();
    }

    async function handleAwayButtonClick(patientId) {
        try {
            const doc = await patientsCollection.doc(patientId).get();
            if (!doc.exists) return;
            const isCurrentlyAway = doc.data().isAway;
            await patientsCollection.doc(patientId).update({ isAway: !isCurrentlyAway, awayTime: !isCurrentlyAway ? new Date() : null });
        } catch (error) {
            console.error("離席状態の更新に失敗: ", error);
        }
    }

    async function handleCancelButtonClick(patientId) {
        if (confirm('この受付を本当取り消しますか？（すべての検査がキャンセルされます）')) {
            try {
                if (patientId) await patientsCollection.doc(patientId).delete();
            } catch (error) {
                console.error("受付取消に失敗: ", error);
                alert("受付取消に失敗しました。");
            }
        }
    }

    async function handleCancelLabReception(patientId) {
        const patientRef = patientsCollection.doc(patientId);
        try {
            const doc = await patientRef.get();
            if (!doc.exists) return;
            const patient = doc.data();
            const currentLabGroup = labRoomSelect.value;
            if (!currentLabGroup) return;
            if (confirm(`「${currentLabGroup}」の受付のみを取り消しますか？`)) {
                const newLabs = patient.labs.filter(lab => lab !== currentLabGroup);
                if (newLabs.length === 0) {
                    await patientRef.delete();
                } else {
                    const updateData = { labs: newLabs };
                    if (patient.isExamining && (Object.keys(roomConfiguration).find(key => roomConfiguration[key]?.includes(patient.assignedExamRoom)) || patient.assignedExamRoom) === currentLabGroup) {
                        updateData.isExamining = false;
                        updateData.assignedExamRoom = null;
                        updateData.inRoomSince = null;
                    }
                    await patientRef.update(updateData);
                }
            }
        } catch (error) {
            console.error("検査室受付の取消に失敗: ", error);
            alert("検査室受付の取消に失敗しました。");
        }
    }
    
    function renderRegisteredList() {
        if (!registeredListContainer) return;
        const listScrollTop = registeredListContainer.scrollTop;
        registeredListContainer.innerHTML = '';
        if (registeredPatients.length === 0) { registeredListContainer.innerHTML = '<p class="no-patients">現在登録されている患者はいません。</p>'; return; }
        const fragment = document.createDocumentFragment();
        registeredPatients.forEach(patient => {
            const cardEl = document.createElement('div');
            cardEl.innerHTML = renderPatientCardHTML(patient, 'reception');
            fragment.appendChild(cardEl.firstElementChild);
        });
        registeredListContainer.appendChild(fragment);
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
        const fragment = document.createDocumentFragment();
        waitingPatients.forEach(patient => {
            const cardEl = document.createElement('div');
            cardEl.innerHTML = renderPatientCardHTML(patient, 'lab');
            fragment.appendChild(cardEl.firstElementChild);
        });
        labWaitingListContainer.appendChild(fragment);
    }

    function renderWaitingDisplay() {
        if (!waitingDisplayGrid) return;
        const beforeState = new Map();
        waitingDisplayGrid.querySelectorAll('.waiting-room-card').forEach(card => {
            beforeState.set(card.dataset.roomName, card.querySelector('.now-serving-number').textContent);
        });
        waitingDisplayGrid.innerHTML = '';
        const specialNoteText = '案内票に記載された予約時間を基準にご案内します。必ずしも受付番号順ではありません。また、検査の依頼内容に応じて順番が前後することがあります。あらかじめご了承証ください。';
        waitingRoomOrder.forEach(roomName => {
            const nowServingPatient = registeredPatients.find(p => p.isExamining && p.assignedExamRoom === roomName);
            const nowServingNumber = nowServingPatient ? nowServingPatient.ticketNumber : '-';
            const groupName = Object.keys(roomConfiguration).find(key => roomConfiguration[key]?.includes(roomName)) || roomName;
            const waitingPatientsForGroup = registeredPatients.filter(p => p.labs.includes(groupName) && !p.isExamining);
            const nextNumbers = waitingPatientsForGroup.slice(0, 10).map(p => `<span>${p.ticketNumber}</span>`).join('') || '-';
            const patientsForThisGroup = registeredPatients.filter(p => p.labs.includes(groupName));
            const waitCount = patientsForThisGroup.length;
            let waitTime = 0;
            if (waitCount > 0) {
                const earliestPatient = patientsForThisGroup.reduce((earliest, current) => new Date(earliest.receptionTime) < new Date(current.receptionTime) ? earliest : current);
                if (earliestPatient && earliestPatient.receptionTime) {
                    waitTime = Math.round((new Date() - earliestPatient.receptionTime) / (1000 * 60));
                }
            }
            const roomNameShort = groupName.split('(')[0];
            let noteHtml = specialNoteRooms.includes(roomName) ? `<p class="room-note">${specialNoteText}</p>` : '';
            const cardHtml = `<div class="waiting-room-card" data-room-name="${roomName}"><h3 class="waiting-room-name">${roomName}</h3><div class="waiting-info"><p>待ち: <span class="wait-count">${waitCount}</span>人 / 推定: <span class="wait-time">約${waitTime}</span>分</p></div><div class="now-serving"><h4>検査中</h4><p class="now-serving-number">${nowServingNumber}</p></div><div class="next-in-line"><h4>${roomNameShort}の次の方</h4><p class="next-numbers">${nextNumbers}</p></div>${noteHtml}</div>`;
            waitingDisplayGrid.insertAdjacentHTML('beforeend', cardHtml);
        });
        waitingDisplayGrid.querySelectorAll('.waiting-room-card').forEach(card => {
            const roomName = card.dataset.roomName;
            const oldNumber = beforeState.get(roomName);
            const newNumber = card.querySelector('.now-serving-number').textContent;
            if (newNumber !== '-' && newNumber !== oldNumber) {
                card.classList.add('newly-called');
                setTimeout(() => { card.classList.remove('newly-called'); }, 10000);
            }
        });
    }

    function renderPatientCardHTML(patientData, viewType) {
        const isUrgent = patientData.statuses.includes('至急対応');
        const isAway = patientData.isAway;
        const currentLabGroup = labRoomSelect ? labRoomSelect.value : null;
        let isExaminingInThisGroup = false;
        if (patientData.isExamining && patientData.assignedExamRoom) {
            const groupOfExam = Object.keys(roomConfiguration).find(key => roomConfiguration[key]?.includes(patientData.assignedExamRoom)) || patientData.assignedExamRoom;
            isExaminingInThisGroup = groupOfExam === currentLabGroup;
        }
        const isExaminingInLab = patientData.isExamining && viewType === 'lab';
        const statusHtml = patientData.statuses.map(s => (s === '至急対応') ? `<span class="status-urgent-text">至急対応</span>` : s).join(', ') || 'なし';
        const awayHtml = isAway && patientData.awayTime ? `<p class="away-time-text">離席中 (${patientData.awayTime.toLocaleTimeString('ja-JP')}〜)</p>` : '';
        const notesHtml = patientData.specialNotes ? `<p class="special-note-text">${patientData.specialNotes}</p>` : '';
        let inRoomHtml = '';
        if (isExaminingInLab && patientData.assignedExamRoom && patientData.inRoomSince) { inRoomHtml = `<p class="in-room-status"><strong>${patientData.assignedExamRoom}</strong>に入室中 (${patientData.inRoomSince.toLocaleTimeString('ja-JP')}〜)</p>`; }
        let actionsHtml = '';
        if (viewType === 'reception') { actionsHtml = `<div class="card-actions"><button class="btn edit-btn">編集</button><button class="btn cancel-btn">受付取消</button><button class="btn away-btn">${isAway ? '戻り' : 'トイレ離席'}</button></div>`; } 
        else if (viewType === 'lab') {
            const examButton = isExaminingInThisGroup ? `<button class="btn finish-exam-btn">検査終了</button>` : `<button class="btn exam-btn" ${patientData.isExamining ? 'disabled' : ''}>検査</button>`;
            const groupNameForChange = Object.keys(roomConfiguration).find(key => roomConfiguration[key]?.includes(patientData.assignedExamRoom));
            const changeRoomButton = (isExaminingInThisGroup && groupNameForChange && roomConfiguration[groupNameForChange].length > 1) ? `<button class="btn change-room-btn">部屋移動</button>` : '';
            actionsHtml = `<div class="card-actions">${examButton}${changeRoomButton}<button class="btn away-btn">${isAway ? '戻り' : 'トイレ離席'}</button><button class="btn edit-btn">編集</button><button class="btn cancel-btn">受付取消</button></div>`;
        }
        const receptionTimeStr = patientData.receptionTime ? patientData.receptionTime.toLocaleTimeString('ja-JP') : '取得中...';
        const idLineHtml = `<p class="card-id-line"><strong>番号札:</strong> <span class="card-ticket-number">${patientData.ticketNumber || '未'}</span> / <strong>患者ID:</strong> ${patientData.patientId || '未'}</p>`;
        return `<div class="patient-card ${isUrgent ? 'is-urgent' : ''} ${isAway ? 'is-away' : ''} ${isExaminingInLab && isExaminingInThisGroup ? 'is-examining-in-lab' : ''}" data-id="${patientData.id}" draggable="true"><div class="patient-card-drag-area"><div class="drag-handle">⠿</div><div class="card-up-down"><button class="up-btn" title="上へ">▲</button><button class="down-btn" title="下へ">▼</button></div></div><div class="patient-card-info">${idLineHtml}<p><strong>受付時刻:</strong> ${receptionTimeStr}</p><p><strong>検査室:</strong> ${patientData.labs.join(', ') || 'なし'}</p><p><strong>ステータス:</strong> ${statusHtml}</p>${inRoomHtml}${awayHtml}${notesHtml}${actionsHtml}</div></div>`;
    }
    
    function populateLabRoomSelect() {
        if (!labRoomSelect) return;
        const receptionButtons = document.querySelectorAll('#lab-selection .card-button');
        const uniqueLabNames = [...new Set(Array.from(receptionButtons).map(btn => btn.dataset.value))];
        labRoomSelect.innerHTML = '<option value="">-- 選択してください --</option>';
        uniqueLabNames.forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            labRoomSelect.appendChild(option);
        });
    }
    
    function startCamera(context) {
        if (!cameraContainer) {
            alert("カメラ表示エリア(#camera-container)が見つかりません。");
            return;
        }

        const qrReaderElement = document.getElementById('qr-reader');
        if (!qrReaderElement) {
            alert("QRリーダーの描画エリア(#qr-reader)が見つかりません。");
            return;
        }

        qrScanContext = context;
        cameraContainer.classList.add('is-visible');

        if (!html5QrCode) {
            try {
                html5QrCode = new Html5Qrcode("qr-reader");
            } catch (e) {
                console.error("Html5Qrcodeの初期化に失敗しました。", e);
                alert("QRコードリーダーの初期化に失敗しました。ページを再読み込みしてください。");
                cameraContainer.classList.remove('is-visible');
                return;
            }
        }

        const config = { fps: 10, qrbox: { width: 250, height: 250 } };

        html5QrCode.start({ facingMode: "environment" }, config, onQrSuccess, onQrFailure)
            .catch(err => {
                console.warn("背面カメラの起動に失敗:", err, "前面カメラで再試行します。");
                html5QrCode.start({ facingMode: "user" }, config, onQrSuccess, onQrFailure)
                    .catch(err2 => {
                        console.error("QRカメラの起動に失敗しました:", err2);
                        alert("カメラの起動に失敗しました。ブラウザのカメラアクセス許可を確認してください。");
                        stopCamera();
                    });
            });
    }

    function onQrSuccess(decodedText, decodedResult) {
        stopCamera();
        const validQrPattern = /^[0-9]{1,4}$/; 
        if (validQrPattern.test(decodedText)) {
            if (qrScanContext === 'reception') {
                ticketNumberInput.value = decodedText;
                updatePreview();
                const patientId = patientIdInput.value;
                const selectedLabs = Array.from(labSelectionCards).filter(c => c.classList.contains('selected'));
                if (patientId.length === 7 && selectedLabs.length > 0) {
                    registerBtn.click();
                }
            } else if (qrScanContext === 'lab') {
                const selectedLab = labRoomSelect.value;
                if (!selectedLab) {
                    alert('先に検査室を選択してください。');
                    return;
                }
                const patient = registeredPatients.find(p => p.ticketNumber === decodedText && p.labs.includes(selectedLab));
                if (patient) {
                   handleExamButtonClick(patient.id);
                } else {
                    alert(`番号札「${decodedText}」の患者は、この検査（${selectedLab}）の待機リストに見つかりませんでした。`);
                }
            }
        } else {
            alert(`無効なQRコードです。0-9999の数値を読み取ってください。\n(読み取り値: ${decodedText})`);
        }
    }

    function onQrFailure(error) { /* 読み取り中のエラーはコンソールに表示しない */ }

    function stopCamera() {
        if (html5QrCode && html5QrCode.isScanning) {
            html5QrCode.stop().then(() => {
                cameraContainer.classList.remove('is-visible');
            }).catch(err => {
                console.error("カメラの停止に失敗しました。", err);
                if (cameraContainer) cameraContainer.classList.remove('is-visible');
            });
        } else if (cameraContainer) {
            cameraContainer.classList.remove('is-visible');
        }
    }
    
    async function handleMove(patientId, direction) {
        const index = registeredPatients.findIndex(p => p.id === patientId);
        if (index === -1) return;
        let otherIndex = -1;
        if (direction === 'up' && index > 0) { otherIndex = index - 1; } 
        else if (direction === 'down' && index < registeredPatients.length - 1) { otherIndex = index + 1; }
        
        if (otherIndex !== -1) {
            try {
                const patient1 = registeredPatients[index];
                const patient2 = registeredPatients[otherIndex];
                const batch = db.batch();
                batch.update(patientsCollection.doc(patient1.id), { order: patient2.order });
                batch.update(patientsCollection.doc(patient2.id), { order: patient1.order });
                await batch.commit();
            } catch (error) {
                console.error("順序の移動に失敗: ", error);
            }
        }
    }
        
    function getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.patient-card:not(.dragging)')];
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) { return { offset: offset, element: child }; } 
            else { return closest; }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }
        
    function toggleCardSelection(card) {
        if (card.dataset.value === '至急対応') { card.classList.toggle('selected-urgent'); } 
        else { card.classList.toggle('selected'); }
        updatePreview();
    }

    function handlePatientIdInput(e) {
        let value = e.target.value.replace(/[^0-9]/g, '').slice(0, 7);
        e.target.value = value;
        if (value.length === 7) {
            const firstLabCard = document.querySelector('#lab-selection .card-button');
            if (firstLabCard) firstLabCard.focus();
        }
        updatePreview();
    }
        
    function handlePatientIdBlur(event) {
        let value = event.target.value;
        if (value.length > 0 && value.length < 7) { event.target.value = value.padStart(7, '0'); }
        updatePreview();
    }

    function handleNumericInput(event) {
        event.target.value = event.target.value.replace(/[^0-9]/g, '').slice(0, 4);
        updatePreview();
    }

    function handleTicketNumberEnter(event) { if (event.key === 'Enter') { event.preventDefault(); registerBtn.click(); } }

    function getCurrentFormData() {
        const statuses = Array.from(statusSelectionCards).filter(c => c.classList.contains('selected') || c.classList.contains('selected-urgent')).map(c => c.dataset.value);
        let order = Date.now();
        if (statuses.includes('至急対応')) {
            const urgentOrders = registeredPatients.filter(p => p.statuses.includes('至急対応')).map(p => p.order);
            const minOrder = urgentOrders.length > 0 ? Math.min(...urgentOrders) : (registeredPatients[0]?.order || 0);
            order = minOrder - 1;
        }

        return {
            patientId: patientIdInput.value, ticketNumber: ticketNumberInput.value, receptionTime: firebase.firestore.FieldValue.serverTimestamp(),
            labs: Array.from(labSelectionCards).filter(c => c.classList.contains('selected')).map(c => c.dataset.value),
            statuses: statuses,
            specialNotes: specialNotesInput.value, isAway: false, awayTime: null, isExamining: false, assignedExamRoom: null, inRoomSince: null,
            order: order
        };
    }

    function updatePreview() {
        if (!previewArea) return;
        const formData = {
            patientId: patientIdInput.value, ticketNumber: ticketNumberInput.value, receptionTime: new Date(),
            labs: Array.from(labSelectionCards).filter(c => c.classList.contains('selected')).map(c => c.dataset.value),
            statuses: Array.from(statusSelectionCards).filter(c => c.classList.contains('selected') || c.classList.contains('selected-urgent')).map(c => c.dataset.value),
            specialNotes: specialNotesInput.value, isAway: false, awayTime: null, isExamining: false, assignedExamRoom: null, inRoomSince: null, id: 'preview'
        };

        if (!formData.patientId && !formData.ticketNumber && formData.labs.length === 0 && formData.statuses.length === 0 && !formData.specialNotes) {
            previewArea.innerHTML = '<p class="no-patients">入力するとここにプレビューが表示されます。</p>';
            return;
        }
        previewArea.innerHTML = renderPatientCardHTML(formData, 'reception');
    }

    function resetReceptionForm(shouldFocus = true) {
        if (!patientIdInput) return;
        patientIdInput.value = ''; 
        if(ticketNumberInput) ticketNumberInput.value = ''; 
        if(specialNotesInput) specialNotesInput.value = '';
        allReceptionCards.forEach(card => card.classList.remove('selected', 'selected-urgent'));
        if (editMode.active) {
            editMode = { active: false, patientId: null };
            registerBtn.textContent = '受付登録';
            registerBtn.classList.remove('btn-info');
            registerBtn.classList.add('btn-success');
        }
        updatePreview();
        if (shouldFocus && patientIdInput) { patientIdInput.focus(); }
    }
        
    initialize();
});