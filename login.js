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
    const auth = firebase.auth();

    const emailInput = document.getElementById('email-input');
    const passwordInput = document.getElementById('password-input');
    const loginButton = document.getElementById('login-button');

    function attemptLogin() {
        const email = emailInput.value;
        const password = passwordInput.value;

        if (!email || !password) {
            alert('メールアドレスとパスワードを入力してください。');
            return;
        }

        auth.signInWithEmailAndPassword(email, password)
            .then((userCredential) => {
                window.location.href = 'admin.html';
            })
            .catch((error) => {
                console.error("ログインエラー:", error.code, error.message);
                alert("メールアドレスまたはパスワードが間違っています。");
            });
    }

    if (loginButton) loginButton.addEventListener('click', attemptLogin);
    if (passwordInput) passwordInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            attemptLogin();
        }
    });
});