document.addEventListener('DOMContentLoaded', () => {
    // --- Elementos del DOM ---
    const screens = document.querySelectorAll('.screen');
    const videoLogin = document.getElementById('video-login');
    const loginStatus = document.getElementById('login-status');
    const userNameSpan = document.getElementById('user-name');
    const messageBox = document.getElementById('message-box');
    const videoLogout = document.getElementById('video-logout');
    const logoutStatus = document.getElementById('logout-status');

    // Botones
    const loginButton = document.getElementById('login-button');
    const backButtons = document.querySelectorAll('.back-button');
    const logoutButtons = document.querySelectorAll('.logout-button');
    const manualLoginButton = document.getElementById('manual-login-button');
    const logoutMenuButton = document.getElementById('logout-button');
    const manualLogoutButton = document.getElementById('manual-logout-button');
    const manualLogoutOpCodeInput = document.getElementById('manual-logout-op-code');
    const manualLogoutDniInput = document.getElementById('manual-logout-dni');


    // Inputs
    const manualOpCodeInput = document.getElementById('manual-op-code');
    const manualDniInput = document.getElementById('manual-dni');

    let capturedDescriptor = null;
    let modelsLoaded = false;
    let loginInterval = null;
    let loginTimeout = null;
    let messageTimeout = null;
    let logoutInterval, logoutTimeout;

    // --- Lógica de Mensajes ---
    function showMessage(text, type = 'info', duration = 3000) {
        messageBox.textContent = text;
        messageBox.className = 'message-box show';
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

        stopCamera(videoLogin);
        clearInterval(loginInterval);
        clearTimeout(loginTimeout);

        if (screenId === 'login-screen') startFacialLogin();
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

    async function startFacialLogout() {
        loginStatus.textContent = 'Iniciando cámara...';
        if (!(await startCamera(videoLogout))) return showScreen('manual-logout-screen');

        loginStatus.textContent = 'Cargando usuarios...';
        const faceMatcher = await getFaceMatcher();
        if (!faceMatcher) {
            loginStatus.textContent = 'No hay usuarios registrados.';
            loginTimeout = setTimeout(() => showScreen('manual-logout-screen'), 2000);
            return;
        }

        loginStatus.textContent = 'Detectando...';
        loginTimeout = setTimeout(() => {
            clearInterval(loginInterval);
            stopCamera(videoLogout);
            showScreen('manual-logout-screen');
        }, 5000);

        loginInterval = setInterval(async () => {
            const detections = await faceapi.detectSingleFace(videoLogin, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptor();
            if (detections) {
                const bestMatch = faceMatcher.findBestMatch(detections.descriptor);
                if (bestMatch && bestMatch.label !== 'unknown') {
                    handleSuccessfulLogout(bestMatch.label);
                }
            }
        }, 1000);
    }



    async function getFaceMatcher() {
        try {
            const response = await fetch('src/backend.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({ action: 'getUsers' })
            });
            const users = await response.json();
            if (!users.length) return null;

            const labeledDescriptors = users.map(user =>
                new faceapi.LabeledFaceDescriptors(
                    user.opCode,
                    [Float32Array.from(JSON.parse(user.descriptor))]
                )
            );
            return new faceapi.FaceMatcher(labeledDescriptors, 0.5);
        } catch (err) {
            console.error(err);
            return null;
        }
    }

    function handleSuccessfulLogin(opCode) {
        clearInterval(loginInterval);
        clearTimeout(loginTimeout);
        stopCamera(videoLogin);

        fetch('src/backend.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ action: 'getUsers' })
        })
        .then(res => res.json())
        .then(users => {
            const user = users.find(u => u.opCode === opCode);
            if (user) {
                userNameSpan.textContent = user.name;
                registerAccess(user.id, 'facial', 'ingreso').then(success => {
                    if (success) {
                        showAccessScreen(user.name, 'ingreso');
                    } else {
                        showScreen('main-menu');
                    }
                });
            } else {
                showScreen('manual-login-screen');
            }
        });
    }

    // --- Lógica de Inicio de Sesión Manual ---
    manualLoginButton.addEventListener('click', async () => {
        const opCode = manualOpCodeInput.value, dni = manualDniInput.value;
        if (!opCode || !dni) return showMessage('Por favor, complete todos los campos.', 'error');

        const response = await fetch('src/backend.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ action: 'getUsers' })
        });
        const users = await response.json();
        const user = users.find(u => u.opCode === opCode && u.dni === dni);
        
        if (user) {
            userNameSpan.textContent = user.name;
            registerAccess(user.id, 'manual', 'ingreso').then(success => {
                if (success) {
                    showAccessScreen(user.name, 'ingreso');
                } else {
                    showScreen('main-menu');
                }
            });
        } else {
            showScreen('access-denied-screen');
        }
        
        manualOpCodeInput.value = '';
        manualDniInput.value = '';
    });

    // --- Event Listeners de Navegación ---
    loginButton.addEventListener('click', () => showScreen('login-screen'));
    backButtons.forEach(button => button.addEventListener('click', () => {
        showScreen('main-menu');
    }));
    logoutButtons.forEach(button => button.addEventListener('click', () => showScreen('main-menu')));

    // --- Carga de Modelos Face API ---
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

    // --- Registro de Accesos ---
    async function registerAccess(usuario_id, tipo = 'manual', accion = 'ingreso') {
        try {
            const response = await fetch('src/backend.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    action: 'access',
                    usuario_id: usuario_id,
                    tipo: tipo,
                    accion: accion,
                    fecha_hora: new Date().toISOString()
                })
            });

            const data = await response.json();
            if (data.status === 'success') {
                showMessage(data.msg, 'success');
                return true;
            } else {
                showMessage(data.msg, 'error');
                return false;
            }
        } catch (err) {
            console.error('Error de conexión al registrar acceso:', err);
            showMessage('Error de conexión con el servidor.', 'error');
            return false;
        }
    }

    logoutMenuButton.addEventListener('click', () => showScreen('logout-screen'));

    async function startFacialLogout() {
        logoutStatus.textContent = 'Iniciando cámara...';
        if (!(await startCamera(videoLogout))) return showScreen('manual-logout-screen');

        logoutStatus.textContent = 'Cargando usuarios...';
        const faceMatcher = await getFaceMatcher();
        if (!faceMatcher) {
            logoutStatus.textContent = 'No hay usuarios registrados.';
            return showScreen('manual-logout-screen');
        }

        logoutStatus.textContent = 'Detectando...';

        let logoutInterval = setInterval(async () => {
            const detections = await faceapi.detectSingleFace(videoLogout, new faceapi.TinyFaceDetectorOptions())
                .withFaceLandmarks().withFaceDescriptor();

            if (detections) {
                const bestMatch = faceMatcher.findBestMatch(detections.descriptor);
                if (bestMatch && bestMatch.label !== 'unknown') {
                    clearInterval(logoutInterval);
                    clearTimeout(logoutTimeout);
                    stopCamera(videoLogout);
                    handleLogout(bestMatch.label);
                }
            }
        }, 1000);

        // Si no detecta rostro en 5 segundos, pasa a logout manual
        let logoutTimeout = setTimeout(() => {
            clearInterval(logoutInterval);
            stopCamera(videoLogout);
            showScreen('manual-logout-screen');
        }, 5000);
    }


    function handleLogout(opCode) {
        fetch('src/backend.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ action: 'getUsers' })
        })
        .then(res => res.json())
        .then(users => {
            const user = users.find(u => u.opCode === opCode);
            if (user) {
                registerAccess(user.id, 'facial', 'egreso').then(success => {
                    if (success) {
                        showAccessScreen(user.name, 'egreso');
                    } else {
                        showScreen('main-menu');
                    }
                });
            }
        });
    }

    manualLogoutButton.addEventListener('click', async () => {
        const opCode = manualLogoutOpCodeInput.value;
        const dni = manualLogoutDniInput.value;
        if (!opCode || !dni) return showMessage('Por favor, complete todos los campos.', 'error');

        const response = await fetch('src/backend.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ action: 'getUsers' })
        });
        const users = await response.json();
        const user = users.find(u => u.opCode === opCode && u.dni === dni);

        if (user) {
            registerAccess(user.id, 'manual', 'egreso').then(success => {
                if (success) {
                    showAccessScreen(user.name, 'egreso');
                } else {
                    showScreen('main-menu');
                }
            });
        } else {
            showScreen('access-denied-screen');
        }

        manualLogoutOpCodeInput.value = '';
        manualLogoutDniInput.value = '';
    });


    function showScreen(screenId) {
        screens.forEach(screen => screen.classList.remove('active'));
        const screenToShow = document.getElementById(screenId);
        if (screenToShow) screenToShow.classList.add('active');

        stopCamera(videoLogin);
        stopCamera(videoLogout);
        clearInterval(loginInterval);
        clearTimeout(loginTimeout);

        if (screenId === 'login-screen') startFacialLogin();
        if (screenId === 'logout-screen') startFacialLogout();
    }

    function showAccessScreen(userName, type = 'ingreso') {
        userNameSpan.textContent = userName;
        const accessMessage = document.getElementById('access-message');

        if (type === 'ingreso') {
            accessMessage.textContent = `Bienvenido/a, ${userName}.`;
        } else if (type === 'egreso') {
            accessMessage.textContent = `Salida registrada para ${userName}. ¡Que tengas buen día!`;
        }

        showScreen('access-permitted-screen');
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
    // --- Inicialización ---
    loadFaceApiModels();
    showScreen('main-menu');
});
