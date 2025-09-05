document.addEventListener('DOMContentLoaded', () => {
    // ===== ELEMENTOS DEL DOM =====
    const adminLoginButton = document.getElementById('admin-login-button');
    const adminLogoutButton = document.getElementById('admin-logout-button');
    const adminOpCodeInput = document.getElementById('admin-op-code');
    const adminDniInput = document.getElementById('admin-dni');
    const adminLoginError = document.getElementById('admin-login-error');

    const registerButton = document.getElementById('register-button');
    const registerUserButton = document.getElementById('register-user-button');
    const captureButton = document.getElementById('capture-button');
    const backButtons = document.querySelectorAll('.back-button');

    const opCodeInput = document.getElementById('op-code');
    const nameInput = document.getElementById('name');
    const dniInput = document.getElementById('dni');

    const videoRegister = document.getElementById('video-register');

    // ===== VARIABLES =====
    let capturedDescriptor = null;
    let modelsLoaded = false;
    let accessLogsChart = null;
    let accessTypeChart = null;
    const chartTextColor = '#e0e0e0';

    // ===== FUNCIONES =====
    function showScreen(screenId) {
        // Ocultar todas las "screens" y "chart-container"
        const screens = document.querySelectorAll('.screen, #panel-container > .chart-container');
        screens.forEach(s => s.style.display = 'none');

        if (screenId === 'register-screen') {
            document.getElementById('register-screen').style.display = 'block';
            document.getElementById('register-button').style.display = 'none';
            startCamera(videoRegister);
        } else if (screenId === 'charts-screen') {
            document.querySelectorAll('#panel-container .chart-container').forEach(c => c.style.display = 'block');
            document.getElementById('register-button').style.display = 'block';
            stopCamera(videoRegister);
        }
    }

    function showMessage(text, type = 'info', duration = 3000) {
        const messageBox = document.getElementById('message-box');
        if (!messageBox) return;
        messageBox.textContent = text;
        messageBox.className = 'message-box show';
        if (type === 'success') messageBox.classList.add('success');
        if (type === 'error') messageBox.classList.add('error');
        setTimeout(() => messageBox.classList.remove('show'), duration);
    }

    function startCamera(videoEl) {
        if (!modelsLoaded) return;
        navigator.mediaDevices.getUserMedia({ video: {} })
            .then(stream => { videoEl.srcObject = stream; })
            .catch(err => console.error("Error al acceder a la cámara:", err));
    }

    function stopCamera(videoEl) {
        if (videoEl && videoEl.srcObject) {
            videoEl.srcObject.getTracks().forEach(track => track.stop());
            videoEl.srcObject = null;
        }
    }

    function resetRegistrationForm() {
        if (opCodeInput) opCodeInput.value = '';
        if (nameInput) nameInput.value = '';
        if (dniInput) dniInput.value = '';
        capturedDescriptor = null;
        if (captureButton) {
            captureButton.textContent = 'Tomar Foto';
            captureButton.style.backgroundColor = '#007bff';
        }
    }

    // ===== CAPTURA DE FOTO =====
    if (captureButton) {
        captureButton.addEventListener('click', async () => {
            captureButton.textContent = 'Procesando...';
            await new Promise(r => setTimeout(r, 50));
            const detections = await faceapi.detectSingleFace(videoRegister, new faceapi.TinyFaceDetectorOptions())
                .withFaceLandmarks().withFaceDescriptor();
            if (detections) {
                capturedDescriptor = detections.descriptor;
                captureButton.textContent = 'Foto Capturada ✓';
                captureButton.style.backgroundColor = '#28a745';
                showMessage('Foto capturada exitosamente.', 'success');
            } else {
                captureButton.textContent = 'Tomar Foto';
                captureButton.style.backgroundColor = '#007bff';
                showMessage('No se detectó ningún rostro.', 'error');
            }
        });
    }

    // ===== REGISTRO DE USUARIO =====
    if (registerUserButton) {
        registerUserButton.addEventListener('click', async () => {
            const opCode = opCodeInput.value;
            const name = nameInput.value;
            const dni = dniInput.value;

            if (!opCode || !name || !dni) return showMessage('Complete todos los campos.', 'error');
            if (!capturedDescriptor) return showMessage('Capture una foto primero.', 'error');

            try {
                const response = await fetch('src/backend.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({
                        action: 'register',
                        opCode,
                        name,
                        dni,
                        descriptor: JSON.stringify(Array.from(capturedDescriptor))
                    })
                });
                const data = await response.json();
                if (data.status === 'success') {
                    showMessage(`Usuario ${name} registrado.`, 'success');
                    resetRegistrationForm();
                    showScreen('charts-screen');
                } else {
                    showMessage('Error al registrar: ' + data.msg, 'error');
                }
            } catch (err) {
                console.error(err);
                showMessage('Error de conexión al servidor.', 'error');
            }
        });
    }

    // ===== NAVEGACIÓN REGISTRO <-> GRÁFICOS =====
    if (registerButton) {
        registerButton.addEventListener('click', () => showScreen('register-screen'));
    }
    backButtons.forEach(btn => btn.addEventListener('click', () => {
        resetRegistrationForm();
        showScreen('charts-screen');
    }));

    // ===== CARGA MODELOS FACE API =====
    async function loadFaceApiModels() {
        const MODEL_URL = './models';
        try {
            await Promise.all([
                faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
                faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
                faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
            ]);
            modelsLoaded = true;
        } catch (err) {
            console.error('Error al cargar modelos:', err);
            showMessage('Error al cargar modelos de IA.', 'error', 5000);
        }
    }
    loadFaceApiModels();

    // ===== GRÁFICOS =====
    async function renderCharts() {
        try {
            const logsRes = await fetch('src/backend.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({ action: 'getAccessLogsPerDay' })
            });
            const logsData = await logsRes.json();

            if (logsData.status === 'success') {
                const ctx = document.getElementById('access-logs-chart').getContext('2d');
                if (accessLogsChart) accessLogsChart.destroy();
                accessLogsChart = new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: logsData.data.labels,
                        datasets: [
                            { label: 'Ingresos', data: logsData.data.ingresos, backgroundColor: 'rgba(75, 192, 192, 0.5)' },
                            { label: 'Egresos', data: logsData.data.egresos, backgroundColor: 'rgba(255, 99, 132, 0.5)' }
                        ]
                    },
                    options: {
                        scales: {
                            y: { beginAtZero: true, ticks: { color: chartTextColor } },
                            x: { ticks: { color: chartTextColor } }
                        },
                        plugins: { legend: { labels: { color: chartTextColor } } }
                    }
                });
            }

            const typeRes = await fetch('src/backend.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({ action: 'getAccessLogsByType' })
            });
            const typeData = await typeRes.json();

            if (typeData.status === 'success') {
                const ctx = document.getElementById('access-type-chart').getContext('2d');
                if (accessTypeChart) accessTypeChart.destroy();
                accessTypeChart = new Chart(ctx, {
                    type: 'doughnut',
                    data: {
                        labels: typeData.data.labels,
                        datasets: [{
                            label: 'Tipo de Acceso',
                            data: typeData.data.values,
                            backgroundColor: ['rgba(54, 162, 235, 0.5)', 'rgba(255, 206, 86, 0.5)'],
                            borderColor: ['rgba(54, 162, 235, 1)', 'rgba(255, 206, 86, 1)']
                        }]
                    },
                    options: { plugins: { legend: { labels: { color: chartTextColor } } } }
                });
            }
        } catch (err) { console.error('Error renderizando gráficos:', err); }
    }

    // ===== LOGIN =====
    if (adminLoginButton) {
        adminLoginButton.addEventListener('click', async () => {
            const opCode = adminOpCodeInput.value;
            const dni = adminDniInput.value;
            if (!opCode || !dni) return adminLoginError.textContent = 'Complete todos los campos.';
            try {
                const res = await fetch('src/backend.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({ action: 'adminLogin', opCode, dni })
                });
                const data = await res.json();
                if (data.status === 'success') location.reload();
                else adminLoginError.textContent = data.msg || 'Error en login.';
            } catch (err) {
                console.error(err);
                adminLoginError.textContent = 'Error de conexión.';
            }
        });
    }

    // ===== LOGOUT =====
    if (adminLogoutButton) {
        adminLogoutButton.addEventListener('click', async () => {
            try {
                await fetch('src/backend.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({ action: 'adminLogout' })
                });
                location.reload();
            } catch (err) { console.error('Error al cerrar sesión:', err); }
        });
    }

    // ===== INICIALIZACIÓN =====
    if (document.getElementById('panel-container')) {
        renderCharts();       // Renderizar gráficos al cargar panel
        showScreen('charts-screen'); // Mostrar solo gráficos
    }
});
