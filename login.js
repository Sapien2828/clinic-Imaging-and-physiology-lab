window.addEventListener('DOMContentLoaded', () => {
    // ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
    // 【重要】あなた自身のFirebase設定をここに貼り付けてください
    const firebaseConfig = {
      apiKey: "YOUR_API_KEY",
      authDomain: "YOUR_AUTH_DOMAIN",
      projectId: "YOUR_PROJECT_ID",
      storageBucket: "YOUR_STORAGE_BUCKET",
      messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
      appId: "YOUR_APP_ID"
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
                // ログイン成功
                window.location.href = 'admin.html';
            })
            .catch((error) => {
                // ログイン失敗
                console.error("ログインエラー:", error);
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