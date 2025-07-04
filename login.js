window.addEventListener('DOMContentLoaded', () => {
    const idInput = document.getElementById('id-input');
    const passwordInput = document.getElementById('password-input');
    const loginButton = document.getElementById('login-button');

    function enforceNumericInput(event) {
        event.target.value = event.target.value.replace(/[^0-9]/g, '');
    }

    if (idInput) idInput.addEventListener('input', enforceNumericInput);
    if (passwordInput) passwordInput.addEventListener('input', enforceNumericInput);

    function attemptLogin() {
        if (idInput.value === '7302' && passwordInput.value === '7302') {
            window.location.href = 'admin.html';
        } else {
            alert('IDまたはパスワードが間違っています。');
        }
    }

    if (loginButton) loginButton.addEventListener('click', attemptLogin);
    if (passwordInput) passwordInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            attemptLogin();
        }
    });
});