window.addEventListener('DOMContentLoaded', () => {
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

    firebase.initializeApp(firebaseConfig);
    const db = firebase.firestore();
    const auth = firebase.auth();
    const patientsCollection = db.collection('patients');

    const roomConfiguration = {
        'レントゲン撮影室': ['レントゲン撮影室(1番)', 'レントゲン撮影室(2番)', '透視室(6番)'],
        '超音波検査室': ['超音波検査室(3番)', '超音波検査室(11番)', '超音波検査室(14番)', '超音波検査室(15番)'],
        '骨密度検査室(4番)': null, 'CT撮影室(5番)': null, '乳腺撮影室(10番)': null, '肺機能検査室(12番)': null,
        '心電図検査室(13番)': null, '透視室(6番)': null, '聴力検査室(7番)': null, '呼吸機能検査室(8番)': null, '血管脈波検査室(9番)': null,
    };
    const waitingRoomOrder = ['レントゲン撮影室(1番)', 'レントゲン撮影室(2番)', '超音波検査室(3番)', '骨密度検査室(4番)', 'CT撮影室(5番)', '透視室(6番)', '聴力検査室(7番)', '呼吸機能検査室(8番)', '血管脈波検査室(9番)', '乳腺撮影室(10番)', '超音波検査室(11番)', '肺機能検査室(12番)', '心電図検査室(13番)', '超音波検査室(14番)', '超音波検査室(15番)'];
    const specialNoteRooms = ['CT撮影室(5番)', '超音波検査室(3番)', '超音波検査室(11番)', '超音波検査室(14番)', '超音波検査室(15番)'];
    
    let registeredPatients = [];
    const waitingDisplayGrid = document.querySelector('.waiting-display-grid');

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
            const waitingPatientsForGroup = registeredPatients.filter(p => p.labs.includes(groupName) && !p.isExamining && !p.isAway);
            const nextNumbers = waitingPatientsForGroup.slice(0, 10).map(p => `<span>${p.ticketNumber}</span>`).join('') || '-';
            const patientsForThisGroup = registeredPatients.filter(p => p.labs.includes(groupName));
            const waitCount = waitingPatientsForGroup.length;
            let waitTime = 0;
            if (waitCount > 0) {
                const earliestPatient = patientsForThisGroup.filter(p => !p.isExamining && p.receptionTime).reduce((earliest, current) => earliest.receptionTime < current.receptionTime ? earliest : current, {receptionTime: new Date()});
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
    
    function initialize() {
        // ゲスト（ログインしていないユーザー）として匿名でサインインする
        auth.signInAnonymously()
            .then(() => {
                // データベースの変更をリアルタイムで監視する
                patientsCollection.orderBy("order").onSnapshot(snapshot => {
                    registeredPatients = snapshot.docs.map(doc => {
                        const data = doc.data();
                        // データベースから取得した時刻データが存在する場合のみ正しく変換する
                        return {
                            id: doc.id,
                            ...data,
                            receptionTime: data.receptionTime ? data.receptionTime.toDate() : null,
                            awayTime: data.awayTime ? data.awayTime.toDate() : null,
                            inRoomSince: data.inRoomSince ? data.inRoomSince.toDate() : null,
                        };
                    });
                    // 画面を再描画する
                    renderWaitingDisplay();
                }, error => {
                    console.error("Firestoreからのデータ取得に失敗しました:", error);
                    if(waitingDisplayGrid) waitingDisplayGrid.innerHTML = `<p class="no-patients">データの読み込みに失敗しました。Firebaseのセキュリティルールを確認してください。</p>`;
                });
            })
            .catch((error) => {
                console.error("匿名認証エラー:", error);
                if(waitingDisplayGrid) waitingDisplayGrid.innerHTML = `<p class="no-patients">データの読み込みに失敗しました。管理者にお問い合わせください。</p>`;
            });
    }

    initialize();
});
