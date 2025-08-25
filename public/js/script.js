document.addEventListener('DOMContentLoaded', () => {
    // --- Elementos del DOM ---
    const screens = document.querySelectorAll('.screen');
    const videoRegister = document.getElementById('video-register');
    const videoLogin = document.getElementById('video-login');
    const loginStatus = document.getElementById('login-status');
    const userNameSpan = document.getElementById('user-name');
    const messageBox = document.getElementById('message-box');

    // Botones
    const registerButton = document.getElementById('register-button');
    const loginButton = document.getElementById('login-button');
    const backButtons = document.querySelectorAll('.back-button');
    const logoutButtons = document.querySelectorAll('.logout-button');
    const captureButton = document.getElementById('capture-button');
    const registerUserButton = document.getElementById('register-user-button');

    // Inputs
    const opCodeInput = document.getElementById('op-code');
    const nameInput = document.getElementById('name');
    const dniInput = document.getElementById('dni');

    let capturedDescriptor = null;
    let modelsLoaded = false;
    let loginInterval = null;
    let loginTimeout = null;
    let messageTimeout = null;

    // --- Lógica de Mensajes y Notificaciones ---
    /**
     * Muestra un mensaje flotante en la parte superior de la pantalla.
     * @param {string} text - El texto a mostrar.
     * @param {string} type - El tipo de mensaje ('success', 'error', 'info').
     * @param {number} duration - La duración en milisegundos.
     */
    function showMessage(text, type = 'info', duration = 3000) {
        messageBox.textContent = text;
        messageBox.className = 'message-box show'; // Reset classes and show
        if (type === 'success') messageBox.classList.add('success');
        if (type === 'error') messageBox.classList.add('error');

        clearTimeout(messageTimeout);
        messageTimeout = setTimeout(() => {
            messageBox.classList.remove('show');
        }, duration);
    }

    // --- Lógica de Navegación ---
    function showScreen(screenId) {
        screens.forEach(screen => screen.classList.remove('active'));
        const screenToShow = document.getElementById(screenId);
        if (screenToShow) screenToShow.classList.add('active');

        stopCamera(videoRegister);
        stopCamera(videoLogin);
        clearInterval(loginInterval);
        clearTimeout(loginTimeout);

        if (screenId === 'register-screen') startCamera(videoRegister);
        if (screenId === 'login-screen') startFacialLogin();
    }

    // --- Lógica de Cámara ---
    async function startCamera(videoEl) {
        if (!modelsLoaded) {
            showMessage('Modelos de IA cargando, espere.', 'info');
            return false;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: {} });
            videoEl.srcObject = stream;
            return true;
        } catch (err) {
            console.error("Error al acceder a la cámara:", err);
            showMessage("No se pudo acceder a la cámara.", 'error');
            return false;
        }
    }

    function stopCamera(videoEl) {
        if (videoEl && videoEl.srcObject) {
            videoEl.srcObject.getTracks().forEach(track => track.stop());
            videoEl.srcObject = null;
        }
    }

    // --- Lógica de Registro ---
    captureButton.addEventListener('click', async () => {
        captureButton.textContent = 'Procesando...';
        const detections = await faceapi.detectSingleFace(videoRegister, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptor();
        if (detections) {
            capturedDescriptor = detections.descriptor;
            captureButton.textContent = 'Foto Capturada ✓';
            captureButton.style.backgroundColor = '#28a745';
            showMessage('Foto capturada exitosamente.', 'success');
        } else {
            captureButton.textContent = 'Tomar Foto';
            showMessage('No se detectó ningún rostro.', 'error');
        }
    });

    registerUserButton.addEventListener('click', () => {
        const opCode = opCodeInput.value, name = nameInput.value, dni = dniInput.value;
        if (!opCode || !name || !dni) return showMessage('Por favor, complete todos los campos.', 'error');
        if (!capturedDescriptor) return showMessage('Por favor, capture una foto primero.', 'error');

        const users = JSON.parse(localStorage.getItem('registeredUsers')) || [];
        if (users.some(user => user.opCode === opCode)) return showMessage('El código de operario ya está registrado.', 'error');
        if (users.some(user => user.dni === dni)) return showMessage('El DNI ya está registrado.', 'error');

        users.push({ opCode, name, dni, descriptor: Array.from(capturedDescriptor) });
        localStorage.setItem('registeredUsers', JSON.stringify(users));
        showMessage(`Usuario ${name} registrado.`, 'success');
        resetRegistrationForm();
        showScreen('main-menu');
    });

    function resetRegistrationForm() {
        opCodeInput.value = ''; nameInput.value = ''; dniInput.value = '';
        capturedDescriptor = null;
        captureButton.textContent = 'Tomar Foto';
        captureButton.style.backgroundColor = '#007bff';
    }

    // --- Lógica de Inicio de Sesión Facial ---
    async function startFacialLogin() {
        loginStatus.textContent = 'Iniciando cámara...';
        if (!(await startCamera(videoLogin))) return showScreen('manual-login-screen');

        loginStatus.textContent = 'Cargando usuarios...';
        const faceMatcher = await getFaceMatcher();
        if (!faceMatcher) {
            loginStatus.textContent = 'No hay usuarios registrados.';
            loginTimeout = setTimeout(() => showScreen('manual-login-screen'), 2000);
            return;
        }

        loginStatus.textContent = 'Detectando...';
        loginTimeout = setTimeout(() => {
            clearInterval(loginInterval);
            stopCamera(videoLogin);
            showScreen('manual-login-screen');
        }, 5000);

        loginInterval = setInterval(async () => {
            const detections = await faceapi.detectSingleFace(videoLogin, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptor();
            if (detections) {
                const bestMatch = faceMatcher.findBestMatch(detections.descriptor);
                if (bestMatch && bestMatch.label !== 'unknown') {
                    handleSuccessfulLogin(bestMatch.label);
                }
            }
        }, 1000);
    }

    async function getFaceMatcher() {
        const users = JSON.parse(localStorage.getItem('registeredUsers')) || [];
        if (users.length === 0) return null;

        const labeledDescriptors = users.map(user =>
            new faceapi.LabeledFaceDescriptors(
                user.opCode, // Usamos opCode como etiqueta única para identificar al usuario
                [Float32Array.from(user.descriptor)]
            )
        );
        return new faceapi.FaceMatcher(labeledDescriptors, 0.5);
    }

    function handleSuccessfulLogin(opCode) {
        clearInterval(loginInterval);
        clearTimeout(loginTimeout);
        stopCamera(videoLogin);

        const users = JSON.parse(localStorage.getItem('registeredUsers')) || [];
        const user = users.find(u => u.opCode === opCode);

        if (user) {
            userNameSpan.textContent = user.name;
            showScreen('access-permitted-screen');
        } else {
            showScreen('manual-login-screen');
        }
    }

    // --- Lógica de Inicio de Sesión Manual ---
    const manualLoginButton = document.getElementById('manual-login-button');
    const manualOpCodeInput = document.getElementById('manual-op-code');
    const manualDniInput = document.getElementById('manual-dni');

    manualLoginButton.addEventListener('click', () => {
        const opCode = manualOpCodeInput.value, dni = manualDniInput.value;
        if (!opCode || !dni) return showMessage('Por favor, complete todos los campos.', 'error');

        const users = JSON.parse(localStorage.getItem('registeredUsers')) || [];
        const user = users.find(u => u.opCode === opCode && u.dni === dni);

        if (user) {
            userNameSpan.textContent = user.name;
            showScreen('access-permitted-screen');
        } else {
            showScreen('access-denied-screen');
        }
        manualOpCodeInput.value = '';
        manualDniInput.value = '';
    });

    // --- Event Listeners de Navegación ---
    registerButton.addEventListener('click', () => showScreen('register-screen'));
    loginButton.addEventListener('click', () => showScreen('login-screen'));
    backButtons.forEach(button => button.addEventListener('click', () => {
        showScreen('main-menu');
        resetRegistrationForm();
    }));
    logoutButtons.forEach(button => button.addEventListener('click', () => showScreen('main-menu')));

    // --- Carga de Modelos de Face API ---
    async function loadFaceApiModels() {
        const MODEL_URL = './models';
        try {
            console.log('Cargando modelos de face-api...');
            await Promise.all([
                faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
                faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
                faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
            ]);
            modelsLoaded = true;
            console.log('Modelos cargados exitosamente.');
        } catch (error) {
            console.error('Error al cargar los modelos de face-api:', error);
            showMessage('Error al cargar modelos de IA.', 'error', 5000);
        }
    }

    // --- Inicialización ---
    loadFaceApiModels();
    showScreen('main-menu');
});