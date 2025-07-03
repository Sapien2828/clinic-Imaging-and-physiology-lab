window.addEventListener('DOMContentLoaded', () => {

    // --- HTML要素の取得 ---
    const idInput = document.getElementById('id-input');
    const passwordInput = document.getElementById('password-input');
    const loginButton = document.getElementById('login-button');

    // --- 機能1: 入力値を半角数字のみに制限する ---
    
    // 入力値を半角数字のみに書き換える関数
    function enforceNumericInput(event) {
        // 入力値から数字(^0-9)以外の文字をすべて削除する
        event.target.value = event.target.value.replace(/[^0-9]/g, '');
    }

    // ID入力欄とパスワード入力欄の両方で、入力があるたびに関数を実行
    idInput.addEventListener('input', enforceNumericInput);
    passwordInput.addEventListener('input', enforceNumericInput);


    // --- 機能2: ログイン処理 ---

    // ログインボタンがクリックされた時の処理
    loginButton.addEventListener('click', () => {
        const id = idInput.value;
        const password = passwordInput.value;

        // IDとパスワードが正しいかチェック
        if (id === '7302' && password === '7302') {
            // ログイン成功
            alert('ログインしました。管理画面に移動します。');
            // 管理画面(index.html)へページを移動
            window.location.href = 'index.html';
        } else {
            // ログイン失敗
            alert('IDまたはパスワードが間違っています。');
        }
    });

    // パスワード入力欄で「Enter」キーが押された時もログイン処理を実行
    passwordInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            // ログインボタンのクリックイベントを強制的に発生させる
            loginButton.click();
        }
    });

});