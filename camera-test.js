document.getElementById('startButton').addEventListener('click', () => {
    const resultElement = document.getElementById('result');
    const readerElement = document.getElementById('reader');
    resultElement.innerText = "カメラを起動しようとしています...";

    const html5QrCode = new Html5Qrcode("reader");

    const qrCodeSuccessCallback = (decodedText, decodedResult) => {
        resultElement.innerText = `読み取り成功！: ${decodedText}`;
        html5QrCode.stop().catch(err => console.error("停止エラー", err));
    };

    const config = { fps: 10, qrbox: { width: 250, height: 250 } };

    // 背面カメラを優先して起動を試みる
    html5QrCode.start({ facingMode: "environment" }, config, qrCodeSuccessCallback)
        .catch((err) => {
            resultElement.innerText = "背面カメラの起動に失敗。前面カメラを試します...";
            // 背面カメラが失敗した場合、前面カメラで再試行
            html5QrCode.start({ facingMode: "user" }, config, qrCodeSuccessCallback)
                .catch((err2) => {
                    resultElement.innerText = "カメラの起動に完全に失敗しました。";
                    console.error("カメラ起動エラー:", err2);
                });
        });
});