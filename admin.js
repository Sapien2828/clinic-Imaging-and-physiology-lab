window.addEventListener('DOMContentLoaded', () => {

    if (!document.querySelector('.admin-container')) {
        return;
    }

    // Firebase設定
   const firebaseConfig = {

  apiKey: "AIzaSyCsk7SQQY58yKIn-q4ps1gZ2BRbc2k6flE",

  authDomain: "clinic-imaging-and-physiology.firebaseapp.com",

  projectId: "clinic-imaging-and-physiology",

  storageBucket: "clinic-imaging-and-physiology.firebasestorage.app",

  messagingSenderId: "568457688933",

  appId: "1:568457688933:web:2eee210553b939cf39538c"


    firebase.initializeApp(firebaseConfig);
    const db = firebase.firestore();
    const patientsCollection = db.collection('patients');

    // グローバル変数
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
    //【重要】FirestoreのドキュメントIDを保持する変数を`docId`に統一
    let editMode = { active: false, docId: null }; 
    let html5QrCode = null;

    // DOM要素の取得
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
    const modalContainer = document.getElementById('modal-container');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const modalOkBtn = document.getElementById('modal-ok-btn');
    const modalCancelBtn = document.getElementById('modal-cancel-btn');
    const resetAllBtn = document.getElementById('reset-all-btn');


    /**
     * =================================================================
     * 【最終FIX】ご指摘の根本原因を修正した、登録・更新の統合関数
     * =================================================================
   // Firestore 初期化
const patientsCollection = firebase.firestore().collection("patients");

let registeredPatients = [];
let editMode = { active: false, docId: null };
let html5QrCode = null;

// DOM要素の取得（略）
// ...（既に取得済みの部分はそのままでOK）

/**
 * 受付フォームの初期化
 */
function resetReceptionForm() {
    patientIdInput.value = "";
    ticketNumberInput.value = "";
    specialNotesInput.value = "";
    labSelectionCards.forEach(card => card.classList.remove('selected'));
    statusSelectionCards.forEach(card => {
        card.classList.remove('selected');
        card.classList.remove('selected-urgent');
    });
    previewArea.innerHTML = "";
    editMode = { active: false, docId: null };
    registerBtn.textContent = '受付登録';
    registerBtn.classList.remove('btn-info');
    registerBtn.classList.add('btn-success');
}

/**
 * 現在のフォーム内容をオブジェクトとして取得
 */
function getCurrentFormData() {
    return {
        patientId: patientIdInput.value,
        ticketNumber: ticketNumberInput.value,
        labs: Array.from(labSelectionCards).filter(c => c.classList.contains('selected')).map(c => c.dataset.value),
        statuses: Array.from(statusSelectionCards).filter(c => c.classList.contains('selected') || c.classList.contains('selected-urgent')).map(c => c.dataset.value),
        specialNotes: specialNotesInput.value,
        order: Date.now()
    };
}

/**
 * 登録または更新処理
 */
async function handleRegistrationOrUpdate() {
    const newTicketNumber = ticketNumberInput.value.trim();
    const newPatientId = patientIdInput.value.trim();
    const currentDocId = editMode.active ? editMode.docId : null;

    if (!newPatientId || newPatientId.length !== 7) {
        alert('患者IDは7桁で入力してください。');
        return;
    }
    if (!newTicketNumber) {
        alert('番号札は必須です。');
        return;
    }

    try {
        const querySnapshot = await patientsCollection.where("ticketNumber", "==", newTicketNumber).get();

        console.log("=== チェックログ ===");
        console.log("編集中のID:", currentDocId);
        console.log("一致したDoc ID:", querySnapshot.docs.map(d => d.id));

        const conflictDoc = querySnapshot.docs.find(doc => String(doc.id) !== String(currentDocId));

        if (conflictDoc) {
            alert('エラー: この番号札は他の患者が既に使用しています。');
            return;
        }

        if (editMode.active && currentDocId) {
            const patientRef = patientsCollection.doc(currentDocId);
            const doc = await patientRef.get();
            if (!doc.exists) {
                alert("編集対象が存在しません。");
                resetReceptionForm();
                return;
            }
            const originalData = doc.data();
            const updatedData = getCurrentFormData();

            if (updatedData.statuses.includes("至急対応") && !originalData.statuses.includes("至急対応")) {
                updatedData.order = -1;
            } else if (!updatedData.statuses.includes("至急対応") && originalData.statuses.includes("至急対応")) {
                updatedData.order = Date.now();
            }

            await patientRef.update(updatedData);
        } else {
            const newData = getCurrentFormData();
            await patientsCollection.add(newData);
        }

        resetReceptionForm();
    } catch (error) {
        console.error("登録処理中のエラー:", error);
        alert("登録処理中にエラーが発生しました。");
    }
}

/**
 * 編集ボタンクリック時処理
 */
async function handleEditButtonClick(docId) {
    try {
        const docRef = patientsCollection.doc(docId);
        const doc = await docRef.get();

        if (doc.exists) {
            const data = doc.data();
            editMode.active = true;
            editMode.docId = docId;
            patientIdInput.value = data.patientId;
            ticketNumberInput.value = data.ticketNumber;
            specialNotesInput.value = data.specialNotes || "";

            labSelectionCards.forEach(card => {
                card.classList.toggle("selected", data.labs?.includes(card.dataset.value));
            });

            statusSelectionCards.forEach(card => {
                card.classList.remove("selected", "selected-urgent");
                if (data.statuses?.includes(card.dataset.value)) {
                    if (card.dataset.value === "至急対応") {
                        card.classList.add("selected-urgent");
                    } else {
                        card.classList.add("selected");
                    }
                }
            });

            tabButtons.forEach(btn => {
                if (btn.dataset.tab === "reception-tab") btn.click();
            });

            registerBtn.textContent = '更新';
            registerBtn.classList.remove('btn-success');
            registerBtn.classList.add('btn-info');
            patientIdInput.focus();
            window.scrollTo(0, 0);
        }
    } catch (e) {
        console.error("編集時エラー:", e);
    }
}

    // ============================================================================================
    //            以下の関数群は、全ての機能追加とバグ修正を反映した最終版です
    // ============================================================================================
    //

    function setupEventListeners() {
        const allFocusableElements = Array.from(receptionTab.querySelectorAll('[tabindex]')).filter(el => el.tabIndex > 0).sort((a, b) => a.tabIndex - b.tabIndex);
        
        tabButtons.forEach(button => { button.addEventListener('click', (e) => {
            const targetTabId = e.currentTarget.dataset.tab;
            tabButtons.forEach(btn => btn.classList.remove('active'));
            e.currentTarget.classList.add('active');
            allTabs.forEach(tab => { if(tab) tab.id === targetTabId ? tab.classList.add('active') : tab.classList.remove('active'); });
            renderAll();
        }); });
        
        if (registerBtn) { registerBtn.addEventListener('click', handleRegistrationOrUpdate); }
        
        const setupListEventListeners = (container) => {
            if (!container) return;
            container.addEventListener('click', (e) => {
                const target = e.target.closest('button');
                if (!target) return;
                const card = target.closest('.patient-card');
                if (!card) return;
                const docId = card.dataset.id; // ここで取得されるのはFirestoreのDoc ID
                if (!docId) return;

                if (target.matches('.away-btn')) handleAwayButtonClick(docId);
                if (target.matches('.edit-btn')) handleEditButtonClick(docId);
                if (target.matches('.up-btn')) handleMove(docId, 'up');
                if (target.matches('.down-btn')) handleMove(docId, 'down');
                if (container.id === 'registered-list-container' && target.matches('.cancel-btn')) handleCancelButtonClick(docId);
                if (container.id === 'lab-waiting-list-container') {
                    if (target.matches('.exam-btn')) handleExamButtonClick(docId);
                    if (target.matches('.finish-exam-btn')) handleFinishExamButtonClick(docId);
                    if (target.matches('.change-room-btn')) handleRoomChangeClick(docId);
                    if (target.matches('.cancel-btn')) handleCancelLabReception(docId);
                }
            });
            let draggedItem = null;
            container.addEventListener('dragstart', (e) => {
                const target = e.target.closest('.patient-card');
                if (target && target.dataset.id) {
                    draggedItem = target; 
                    setTimeout(() => { if (draggedItem) draggedItem.classList.add('dragging'); }, 0);
                } else { e.preventDefault(); }
            });
            container.addEventListener('dragend', () => { if (draggedItem) { draggedItem.classList.remove('dragging'); draggedItem = null; } });
            container.addEventListener('dragover', (e) => { e.preventDefault(); const afterElement = getDragAfterElement(container, e.clientY); const currentlyDragged = document.querySelector('.dragging'); if (currentlyDragged) { if (afterElement == null) { container.appendChild(currentlyDragged); } else { container.insertBefore(currentlyDragged, afterElement); } } });
            container.addEventListener('drop', async (e) => {
                e.preventDefault();
                if (!draggedItem) return;
                draggedItem.classList.remove('dragging');
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

    function renderPatientCardHTML(patientData, viewType) {
        if (!patientData) return '';
        const isUrgent = patientData.statuses && patientData.statuses.includes('至急対応');
        const isAway = patientData.isAway;
        const cardClasses = ['patient-card'];
        if (isUrgent) cardClasses.push('is-urgent');
        if (isAway) cardClasses.push('is-away');
        if (viewType === 'lab' && patientData.isExamining) cardClasses.push('is-examining-in-lab');
        const patientIdHtml = `<p class="card-id-line">ID: <strong>${patientData.patientId || 'N/A'}</strong></p>`;
        const ticketNumberHtml = `<p class="card-id-line">番号: <strong class="card-ticket-number">${patientData.ticketNumber || 'N/A'}</strong></p>`;
        let receptionTimeHtml = '';
        if (patientData.receptionTime && patientData.receptionTime instanceof Date) {
            const time = patientData.receptionTime.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
            receptionTimeHtml = `<p>受付: <strong>${time}</strong></p>`;
        }
        const labsHtml = patientData.labs && patientData.labs.length > 0 ? `<p>検査: <strong>${patientData.labs.join(', ')}</strong></p>` : '';
        const statusesHtml = patientData.statuses && patientData.statuses.length > 0 ? `<p>状態: <strong>${patientData.statuses.join(', ')}</strong></p>` : '';
        const specialNotesHtml = patientData.specialNotes ? `<p class="special-note-text">特記: ${patientData.specialNotes}</p>` : '';
        let awayHtml = '';
        if (isAway && patientData.awayTime && patientData.awayTime instanceof Date) {
            const awayTimeFormatted = patientData.awayTime.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
            awayHtml = `<p class="away-time-text">離席中 (${awayTimeFormatted}～)</p>`;
        }
        let inRoomHtml = '';
        if (viewType === 'lab' && patientData.isExamining && patientData.assignedExamRoom) {
            let sinceText = '';
            if (patientData.inRoomSince && patientData.inRoomSince instanceof Date) {
                sinceText = ` (${patientData.inRoomSince.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}～)`;
            }
            inRoomHtml = `<p class="in-room-status"><strong>${patientData.assignedExamRoom}</strong> で検査中${sinceText}</p>`;
        }
        let actionsHtml = '';
        const awayButton = `<button class="btn btn-small away-btn">${isAway ? '戻り' : '離席'}</button>`;
        if (viewType === 'reception') {
            actionsHtml = `<div class="card-actions">${awayButton}<button class="btn btn-small edit-btn">編集</button><button class="btn btn-small cancel-btn">受付取消</button></div>`;
        } else if (viewType === 'lab') {
            const isGroupRoom = labRoomSelect.value && roomConfiguration[labRoomSelect.value];
            const changeRoomBtnHtml = patientData.isExamining && isGroupRoom ? `<button class="btn btn-small change-room-btn">部屋移動</button>` : '';
            actionsHtml = `<div class="card-actions">${awayButton}${!patientData.isExamining ? '<button class="btn btn-small exam-btn">検査開始</button>' : ''}${patientData.isExamining ? '<button class="btn btn-small finish-exam-btn">検査終了</button>' : ''}${changeRoomBtnHtml}<button class="btn btn-small cancel-btn">受付取消</button></div>`;
        }
        const docIdAttr = patientData.id ? `data-id="${patientData.id}"` : '';
        return `<div class="${cardClasses.join(' ')}" ${docIdAttr} draggable="true"><div class="patient-card-drag-area"><span class="drag-handle">⠿</span><div class="card-up-down"><button class="up-btn" aria-label="上へ移動">▲</button><button class="down-btn" aria-label="下へ移動">▼</button></div></div><div class="patient-card-info">${ticketNumberHtml}${patientIdHtml}${receptionTimeHtml}${labsHtml}${statusesHtml}${awayHtml}${specialNotesHtml}${inRoomHtml}${actionsHtml}</div></div>`;
    }
    
    function listenToPatients() {
        patientsCollection.onSnapshot(snapshot => {
            const patientMap = new Map();
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                patientMap.set(doc.id, { id: doc.id, ...data, receptionTime: data.receptionTime?.toDate(), awayTime: data.awayTime ? data.awayTime.toDate() : null, inRoomSince: data.inRoomSince ? data.inRoomSince.toDate() : null });
            });
            registeredPatients = Array.from(patientMap.values()).sort((a, b) => a.order - b.order);
            renderAll();
        }, error => { console.error("Firestoreからのデータ取得に失敗しました:", error); });
    }
    
    function renderWaitingDisplay() {
        const waitingDisplayGrid = document.querySelector('#waiting-tab .waiting-display-grid');
        if (!waitingDisplayGrid) return;
        waitingDisplayGrid.innerHTML = '';
        const specialNoteText = '案内票に記載された予約時間を基準にご案内します。必ずしも受付番号順ではありません。また、検査の依頼内容に応じて順番が前後することがあります。あらかじめご了承証ください。';
        waitingRoomOrder.forEach(roomName => {
            const nowServingPatient = registeredPatients.find(p => p.isExamining && p.assignedExamRoom === roomName);
            const nowServingNumber = nowServingPatient ? nowServingPatient.ticketNumber : '-';
            const groupName = Object.keys(roomConfiguration).find(key => roomConfiguration[key]?.includes(roomName)) || roomName;
            const waitingPatientsForGroup = registeredPatients.filter(p => p.labs.includes(groupName) && !p.isExamining && !p.isAway);
            const nextNumbers = waitingPatientsForGroup.slice(0, 10).map(p => `<span>${p.ticketNumber}</span>`).join('') || '-';
            const patientsForThisGroup = registeredPatients.filter(p => p.labs.includes(groupName));
            const waitCount = patientsForThisGroup.filter(p => !p.isExamining).length;
            let waitTime = 0;
            const waitingForThisGroup = patientsForThisGroup.filter(p => !p.isExamining);
            if (waitingForThisGroup.length > 0) {
                const earliestPatient = waitingForThisGroup.reduce((earliest, current) => new Date(earliest.receptionTime) < new Date(current.receptionTime) ? earliest : current);
                if (earliestPatient && earliestPatient.receptionTime) {
                    waitTime = Math.round((new Date() - earliestPatient.receptionTime) / (1000 * 60));
                }
            }
            const roomNameShort = groupName.split('(')[0];
            let noteHtml = specialNoteRooms.includes(roomName) ? `<p class="room-note">${specialNoteText}</p>` : '';
            const cardHtml = `<div class="waiting-room-card" data-room-name="${roomName}"><h3 class="waiting-room-name">${roomName}</h3><div class="waiting-info"><p>待ち: <span class="wait-count">${waitCount}</span>人 / 推定: <span class="wait-time">約${waitTime}</span>分</p></div><div class="now-serving"><h4>検査中</h4><p class="now-serving-number">${nowServingNumber}</p></div><div class="next-in-line"><h4>${roomNameShort}の次の方</h4><p class="next-numbers">${nextNumbers}</p></div>${noteHtml}</div>`;
            waitingDisplayGrid.insertAdjacentHTML('beforeend', cardHtml);
        });
    }

    function renderAll() {
        const activeTab = document.querySelector('.tab-content.active');
        if (!activeTab) return;
        const activeTabId = activeTab.id;
        if (activeTabId === 'reception-tab') renderRegisteredList();
        else if (activeTabId === 'lab-tab') renderLabWaitingList();
        else if (activeTabId === 'waiting-tab') renderWaitingDisplay();
    }
    
    function checkAndResetDailyData() {
        const today = new Date().toISOString().split('T')[0];
        const lastDate = localStorage.getItem(LAST_ACTIVE_DATE_KEY);
        if (today !== lastDate) {
            handleResetAll(true);
            localStorage.setItem(LAST_ACTIVE_DATE_KEY, today);
        }
    }
    function initialize() {
        if (!document.querySelector('.admin-container')) return;
        checkAndResetDailyData();
        listenToPatients();
        setupEventListeners();
        populateLabRoomSelect();
        if (previewArea) updatePreview();
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
            if(snapshot.empty) return;
            const batch = db.batch();
            snapshot.docs.forEach(doc => { batch.delete(doc.ref); });
            await batch.commit();
        };
        if (isAutomatic) { confirmReset(); } 
        else { if(confirm('現在の受付情報をすべてリセットしますか？\nこの操作は元に戻せません。')) { confirmReset(); } }
    }
    function handleExamButtonClick(docId) {
        const selectedPatient = registeredPatients.find(p => p.id === docId);
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
    async function handleFinishExamButtonClick(docId) {
        const patientRef = patientsCollection.doc(docId);
        const doc = await patientRef.get();
        if (!doc.exists) return;
        const selectedPatient = {id: doc.id, ...doc.data()};
        const finishedRoom = selectedPatient.assignedExamRoom;
        const finishedGroup = Object.keys(roomConfiguration).find(key => roomConfiguration[key]?.includes(finishedRoom)) || finishedRoom;
        const remainingLabs = selectedPatient.labs.filter(lab => lab !== finishedGroup);
        await patientRef.update({ isExamining: false, assignedExamRoom: null, inRoomSince: null, labs: remainingLabs });
        if (remainingLabs.length > 0) {
            showModal('次の検査があります', `<p><strong>${finishedRoom}</strong> での検査は終了しました。</p><p>この患者にはまだ次の検査が残っています:<br><strong>${remainingLabs.join(', ')}</strong></p>`, closeModal, false);
        } else {
            showModal('全検査完了', `<p>番号: <strong>${selectedPatient.ticketNumber}</strong> の全検査が完了しました。</p>`, closeModal, false);
        }
    }
    function handleRoomChangeClick(docId) {
        const selectedPatient = registeredPatients.find(p => p.id === docId);
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
            const updateData = { isExamining: true, assignedExamRoom: specificRoom, inRoomSince: new Date() };
            if (patient.isExamining && patient.assignedExamRoom && patient.assignedExamRoom !== specificRoom) {
                await patientsCollection.doc(patient.id).update({isExamining: false, inRoomSince: null});
            }
            await patientsCollection.doc(patient.id).update(updateData);
        }
    }
    function populateForm(patient) {
        resetReceptionForm(false);
        patientIdInput.value = patient.patientId;
        ticketNumberInput.value = patient.ticketNumber;
        specialNotesInput.value = patient.specialNotes;
        allReceptionCards.forEach(card => {
            const cardValue = card.dataset.value;
            const isSelected = patient.labs.includes(cardValue) || patient.statuses.includes(cardValue);
            if (isSelected) {
                if (card.parentElement.id === 'status-selection' && cardValue === '至急対応') {
                    card.classList.add('selected-urgent');
                } else {
                    card.classList.add('selected');
                }
            }
        });
        updatePreview();
    }
    async function handleAwayButtonClick(docId) {
        const doc = await patientsCollection.doc(docId).get();
        if (!doc.exists) return;
        const isCurrentlyAway = doc.data().isAway;
        await patientsCollection.doc(docId).update({ isAway: !isCurrentlyAway, awayTime: !isCurrentlyAway ? new Date() : null });
    }
    async function handleCancelButtonClick(docId) {
        if (confirm('この受付を本当取り消しますか？（すべての検査がキャンセルされます）')) {
            if (docId) await patientsCollection.doc(docId).delete();
        }
    }
    async function handleCancelLabReception(docId) {
        const patientRef = patientsCollection.doc(docId);
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
    }
    function renderRegisteredList() {
        if (!registeredListContainer) return;
        const listScrollTop = registeredListContainer.scrollTop;
        while (registeredListContainer.firstChild) {
            registeredListContainer.removeChild(registeredListContainer.firstChild);
        }
        if (registeredPatients.length === 0) { 
            registeredListContainer.innerHTML = '<p class="no-patients">現在登録されている患者はいません。</p>'; 
            return; 
        }
        const fragment = document.createDocumentFragment();
        registeredPatients.forEach(patient => {
            const cardHtml = renderPatientCardHTML(patient, 'reception');
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = cardHtml.trim();
            if(tempDiv.firstChild) {
                fragment.appendChild(tempDiv.firstChild);
            }
        });
        registeredListContainer.appendChild(fragment);
        registeredListContainer.scrollTop = listScrollTop;
    }
    function renderLabWaitingList() {
        if (!labWaitingListContainer) return;
        const selectedRoomOrGroup = labRoomSelect.value;
        labWaitingListTitle.textContent = selectedRoomOrGroup ? `${selectedRoomOrGroup} 待機患者リスト` : '待機患者リスト';
        while (labWaitingListContainer.firstChild) {
            labWaitingListContainer.removeChild(labWaitingListContainer.firstChild);
        }
        if (!selectedRoomOrGroup) { 
            labWaitingListContainer.innerHTML = '<p class="no-patients">検査室を選択してください。</p>'; 
            return; 
        }
        const waitingPatients = registeredPatients.filter(p => p.labs.includes(selectedRoomOrGroup));
        if (waitingPatients.length === 0) { 
            labWaitingListContainer.innerHTML = `<p class="no-patients">${selectedRoomOrGroup}の待機患者はいません。</p>`; 
            return; 
        }
        const fragment = document.createDocumentFragment();
        waitingPatients.forEach(patient => {
            const cardHtml = renderPatientCardHTML(patient, 'lab');
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = cardHtml.trim();
            if(tempDiv.firstChild){
               fragment.appendChild(tempDiv.firstChild);
            }
        });
        labWaitingListContainer.appendChild(fragment);
    }
    function populateLabRoomSelect() {
        if (!labRoomSelect) return;
        labRoomSelect.innerHTML = '<option value="">検査室グループを選択...</option>';
        Object.keys(roomConfiguration).forEach(groupName => {
            labRoomSelect.innerHTML += `<option value="${groupName}">${groupName}</option>`;
        });
    }
    function startCamera(context) {
        if (!cameraContainer) return;
        if (!html5QrCode) {
            html5QrCode = new Html5Qrcode("qr-reader");
        }
        cameraContainer.classList.add('is-visible');
        const qrCodeSuccessCallback = (decodedText, decodedResult) => {
            if (context === 'reception' && ticketNumberInput) {
                ticketNumberInput.value = decodedText;
                ticketNumberInput.focus();
            } else if (context === 'lab') {
                const patient = registeredPatients.find(p => p.ticketNumber === decodedText);
                if (patient) {
                   handleExamButtonClick(patient.id);
                } else {
                    alert(`番号札「${decodedText}」の患者は見つかりませんでした。`);
                }
            }
            stopCamera();
        };
        const config = { fps: 10, qrbox: { width: 250, height: 250 } };
        html5QrCode.start({ facingMode: "environment" }, config, qrCodeSuccessCallback)
            .catch(err => console.error("QRカメラの起動に失敗しました:", err));
    }
    function stopCamera() {
        if (html5QrCode && html5QrCode.isScanning) {
            html5QrCode.stop().then(() => {
                cameraContainer.classList.remove('is-visible');
            }).catch(err => console.error("カメラの停止に失敗しました:", err));
        } else {
            cameraContainer.classList.remove('is-visible');
        }
    }
    async function handleMove(docId, direction) {
        const index = registeredPatients.findIndex(p => p.id === docId);
        if (index === -1) return;
        let otherIndex = -1;
        if (direction === 'up' && index > 0) { otherIndex = index - 1; } 
        else if (direction === 'down' && index < registeredPatients.length - 1) { otherIndex = index + 1; }
        
        if (otherIndex !== -1) {
            const patient1 = registeredPatients[index];
            const patient2 = registeredPatients[otherIndex];
            if(patient1.order === -1 || patient2.order === -1) {
                alert('至急対応の患者は手動で順番を移動できません。');
                return;
            }
            const batch = db.batch();
            batch.update(patientsCollection.doc(patient1.id), { order: patient2.order });
            batch.update(patientsCollection.doc(patient2.id), { order: patient1.order });
            await batch.commit();
        }
    }
    function getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.patient-card:not(.dragging)')];
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }
    function toggleCardSelection(card) {
        if (!card) return;
        const isUrgentCard = card.dataset.value === '至急対応';
        const isSelected = card.classList.contains('selected') || card.classList.contains('selected-urgent');
        if (isSelected) {
            card.classList.remove('selected', 'selected-urgent');
        } else {
            if (isUrgentCard) {
                card.classList.add('selected-urgent');
            } else {
                card.classList.add('selected');
            }
        }
        updatePreview();
    }
    function handlePatientIdInput(e, focusableElements) {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length > 7) { value = value.slice(0, 7); }
        e.target.value = value;
        if (e.target.value.length === 7) {
            const currentTabIndex = document.activeElement.tabIndex;
            const nextElement = focusableElements.find(el => el.tabIndex === currentTabIndex + 1);
            if (nextElement) nextElement.focus();
        }
        updatePreview();
    }
    function handlePatientIdBlur(event) {
        const value = event.target.value;
        if (value.length > 0 && value.length < 7) {
            event.target.value = value.padStart(7, '0');
        }
        updatePreview();
    }
    function handleNumericInput(event) {
        let value = event.target.value.replace(/[^0-9]/g, '');
        if (value.length > 4) { value = value.slice(0, 4); }
        event.target.value = value;
        updatePreview();
    }
    function handleTicketNumberEnter(event) {
        if (event.key === 'Enter') {
            handleRegistrationOrUpdate();
        }
    }
    function handleArrowKeyNavigation(e, focusableElements) {
        if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
        if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;
        e.preventDefault();
        const activeIndex = focusableElements.indexOf(document.activeElement);
        if (activeIndex === -1) { focusableElements[0].focus(); return; }
        let nextIndex = activeIndex;
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
            nextIndex = (activeIndex + 1) % focusableElements.length;
        } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
            nextIndex = (activeIndex - 1 + focusableElements.length) % focusableElements.length;
        }
        focusableElements[nextIndex].focus();
    }
    function getCurrentFormData() {
        const orderValue = registeredPatients.length > 0 ? Math.max(...registeredPatients.filter(p=>p.order !==-1).map(p => p.order).filter(Number.isFinite), 0) + 1 : 0;
        const statuses = Array.from(statusSelectionCards).filter(c => c.classList.contains('selected') || c.classList.contains('selected-urgent')).map(c => c.dataset.value);
        return {
            patientId: patientIdInput.value, ticketNumber: ticketNumberInput.value, receptionTime: firebase.firestore.FieldValue.serverTimestamp(),
            labs: Array.from(labSelectionCards).filter(c => c.classList.contains('selected')).map(c => c.dataset.value),
            statuses: statuses,
            specialNotes: specialNotesInput.value, isAway: false, awayTime: null, isExamining: false, assignedExamRoom: null, inRoomSince: null,
            order: statuses.includes('至急対応') ? -1 : orderValue
        };
    }
    function updatePreview() {
        if (!previewArea) return;
        const formData = getCurrentFormData();
        if (!formData.patientId && !formData.ticketNumber && formData.labs.length === 0 && formData.statuses.length === 0 && !formData.specialNotes) {
            previewArea.innerHTML = '<p class="no-patients">入力するとここにプレビューが表示されます。</p>'; return;
        }
        const previewData = {...formData, receptionTime: new Date(), id: null};
        previewArea.innerHTML = renderPatientCardHTML(previewData, 'reception');
    }
    function resetReceptionForm(shouldFocus = true) {
        if (!patientIdInput) return;
        patientIdInput.value = ''; ticketNumberInput.value = ''; specialNotesInput.value = '';
        allReceptionCards.forEach(card => card.classList.remove('selected', 'selected-urgent'));
        if (editMode.active) {
            editMode = { active: false, docId: null };
            registerBtn.textContent = '受付登録';
            registerBtn.classList.remove('btn-info');
            registerBtn.classList.add('btn-success');
        }
        updatePreview();
        if (shouldFocus) { patientIdInput.focus(); }
    }
        
    // アプリケーションの開始
    initialize();
});