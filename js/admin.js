document.addEventListener('DOMContentLoaded', () => {
    // ===== ELEMENTOS DEL DOM =====
    const adminLoginButton = document.getElementById('admin-login-button');
    const adminLogoutButton = document.getElementById('admin-logout-button');
    const adminOpCodeInput = document.getElementById('admin-op-code');
    const adminDniInput = document.getElementById('admin-dni');
    const adminLoginError = document.getElementById('admin-login-error');

    const registerButton = document.getElementById('register-button');
    const reportButton = document.getElementById('report-button');
    const registerUserButton = document.getElementById('register-user-button');
    const captureButton = document.getElementById('capture-button');
    const backButtons = document.querySelectorAll('.back-button');

    const opCodeInput = document.getElementById('op-code');
    const nameInput = document.getElementById('name');
    const dniInput = document.getElementById('dni');
    const videoRegister = document.getElementById('video-register');

    // Elementos de control de fecha
    const dateSelector = document.getElementById('date-selector');
    const prevDayButton = document.getElementById('prev-day-button');
    const nextDayButton = document.getElementById('next-day-button');
    const todayButton = document.getElementById('today-button');

    // Elementos del reporte mensual
    const monthSelector = document.getElementById('month-selector');
    const employeeReportBody = document.getElementById('employee-report-body');

    // ===== VARIABLES =====
    let capturedDescriptor = null;
    let modelsLoaded = false;
    let accessLogsChart, accessTypeChart, hoursWorkedChart, arrivalDistributionChart, departureDistributionChart;
    const chartTextColor = '#e0e0e0';
    let currentDate = new Date();

    // ===== FUNCIONES =====

    // --- Funciones de Utilidad de Fecha ---
    const toISODateString = (date) => {
        return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
    };

    const isSameDay = (date1, date2) => {
        return date1.getFullYear() === date2.getFullYear() &&
               date1.getMonth() === date2.getMonth() &&
               date1.getDate() === date2.getDate();
    };
    
    function updateDateControls() {
        if (!dateSelector) return;
        dateSelector.value = toISODateString(currentDate);
        nextDayButton.disabled = isSameDay(currentDate, new Date());
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        prevDayButton.disabled = currentDate <= thirtyDaysAgo;
    }

    function showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(s => s.style.display = 'none');
        document.getElementById('charts-screen').style.display = 'none';

        const mainButtons = [registerButton, reportButton];
        mainButtons.forEach(btn => btn.style.display = 'inline-block');

        if (screenId === 'charts-screen') {
            document.getElementById('charts-screen').style.display = 'block';
        } else if (screenId === 'report-screen') {
            document.getElementById('report-screen').style.display = 'block';
            mainButtons.forEach(btn => btn.style.display = 'none');
        } else if (screenId === 'register-screen') {
            document.getElementById(screenId).style.display = 'block';
            mainButtons.forEach(btn => btn.style.display = 'none');
            startCamera(videoRegister);
        }
    }

    function showMessage(text, type = 'info', duration = 3000) {
        alert(`[${type.toUpperCase()}] ${text}`);
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
        }
    }
    loadFaceApiModels();

    // ===== GRÁFICOS =====
    async function renderCharts(date) {
        const dateString = toISODateString(date);
        const commonOptions = {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        };

        try {
            const fetchData = async (action) => {
                const body = new URLSearchParams({ action, date: dateString });
                const response = await fetch('src/backend.php', { ...commonOptions, body });
                return response.json();
            };

            const [logsData, typeData, hoursData, arrivalData, departureData] = await Promise.all([
                fetchData('getAccessLogsPerDay'),
                fetchData('getAccessLogsByType'),
                fetchData('getHoursWorkedPerDay'),
                fetchData('getArrivalDistribution'),
                fetchData('getDepartureDistribution')
            ]);
            
            if (logsData.status === 'success') {
                const ctx = document.getElementById('acceso-por-dia').getContext('2d');
                if (accessLogsChart) accessLogsChart.destroy();
                accessLogsChart = new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: logsData.data.labels,
                        datasets: [
                            { label: 'Ingresos', data: logsData.data.ingresos, backgroundColor: 'rgba(75, 192, 192, 0.7)' },
                            { label: 'Egresos', data: logsData.data.egresos, backgroundColor: 'rgba(255, 99, 132, 0.7)' }
                        ]
                    },
                    options: { scales: { y: { beginAtZero: true, ticks: { color: chartTextColor, stepSize: 1 } }, x: { ticks: { color: chartTextColor } } }, plugins: { legend: { labels: { color: chartTextColor } } } }
                });
            }

            if (typeData.status === 'success') {
                const ctx = document.getElementById('acceso-por-tipo').getContext('2d');
                if (accessTypeChart) accessTypeChart.destroy();
                accessTypeChart = new Chart(ctx, {
                    type: 'doughnut',
                    data: {
                        labels: typeData.data.labels,
                        datasets: [{ data: typeData.data.values, backgroundColor: ['rgba(54, 162, 235, 0.7)', 'rgba(255, 206, 86, 0.7)'] }]
                    },
                    options: { plugins: { legend: { labels: { color: chartTextColor } } } }
                });
            }

            if (hoursData.status === 'success') {
                const ctx = document.getElementById('horas-trabajadas').getContext('2d');
                if (hoursWorkedChart) hoursWorkedChart.destroy();
                hoursWorkedChart = new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: hoursData.data.labels,
                        datasets: hoursData.data.datasets
                    },
                    options: {
                        scales: { y: { beginAtZero: true, ticks: { color: chartTextColor } }, x: { ticks: { color: chartTextColor } } },
                        plugins: { legend: { labels: { color: chartTextColor } }, tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${c.parsed.y.toFixed(2)} horas` } } }
                    }
                });
            }

            if (arrivalData.status === 'success') {
                const ctx = document.getElementById('horarios-llegada').getContext('2d');
                if (arrivalDistributionChart) arrivalDistributionChart.destroy();
                arrivalDistributionChart = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: arrivalData.data.labels,
                        datasets: [{ label: 'Cantidad', data: arrivalData.data.values, backgroundColor: 'rgba(255, 159, 64, 0.5)', borderColor: 'rgba(255, 159, 64, 1)', fill: true }]
                    },
                    options: { scales: { y: { beginAtZero: true, ticks: { color: chartTextColor, stepSize: 1 } }, x: { ticks: { color: chartTextColor } } }, plugins: { legend: { labels: { color: chartTextColor } } } }
                });
            }

            if (departureData.status === 'success') {
                const ctx = document.getElementById('horarios-salida').getContext('2d');
                if (departureDistributionChart) departureDistributionChart.destroy();
                departureDistributionChart = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: departureData.data.labels,
                        datasets: [{ label: 'Cantidad', data: departureData.data.values, backgroundColor: 'rgba(201, 203, 207, 0.5)', borderColor: 'rgba(201, 203, 207, 1)', fill: true }]
                    },
                    options: { scales: { y: { beginAtZero: true, ticks: { color: chartTextColor, stepSize: 1 } }, x: { ticks: { color: chartTextColor } } }, plugins: { legend: { labels: { color: chartTextColor } } } }
                });
            }
        } catch (err) {
            console.error('Error renderizando gráficos:', err);
        }
    }
    
    // --- Reporte de Empleados ---
    async function renderEmployeeReport(month) {
        if (!employeeReportBody) return;
        
        try {
            const response = await fetch('src/backend.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({ action: 'getEmployeeReport', month })
            });
            const result = await response.json();

            employeeReportBody.innerHTML = '';

            if (result.status === 'success' && result.data.length > 0) {
                result.data.forEach(employee => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td data-label="Código de Operario">${employee.opCode}</td>
                        <td data-label="Nombre">${employee.name}</td>
                        <td data-label="Llegadas Tarde">${employee.llegadas_tarde}</td>
                        <td data-label="Salidas Tempranas">${employee.salidas_tempranas}</td>
                        <td data-label="Faltas">${employee.faltas}</td>
                        <td data-label="Horas Extras">${employee.horas_extras.toFixed(2)}</td>
                    `;
                    employeeReportBody.appendChild(row);
                });
            } else if (result.status === 'success') {
                employeeReportBody.innerHTML = '<tr><td colspan="6">No hay datos para el mes seleccionado.</td></tr>';
            } else {
                employeeReportBody.innerHTML = `<tr><td colspan="6">Error: ${result.msg || 'No se pudo cargar el reporte.'}</td></tr>`;
            }
        } catch (err) {
            console.error('Error renderizando el reporte de empleados:', err);
            employeeReportBody.innerHTML = '<tr><td colspan="5">Error de conexión al cargar el reporte.</td></tr>';
        }
    }

    // ===== MANEJO DE EVENTOS =====

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

    if (adminLogoutButton) {
        adminLogoutButton.addEventListener('click', async () => {
            try {
                await fetch('src/backend.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({ action: 'adminLogout' })
                });
                location.reload();
            } catch (err) {
                console.error('Error al cerrar sesión:', err);
            }
        });
    }

    // --- Navegación entre pantallas ---
    if (registerButton) registerButton.addEventListener('click', () => showScreen('register-screen'));
    if (reportButton) reportButton.addEventListener('click', () => showScreen('report-screen'));
    
    backButtons.forEach(btn => btn.addEventListener('click', () => {
        resetRegistrationForm();
        stopCamera(videoRegister);
        showScreen('charts-screen');
    }));

    if (captureButton) {
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
                captureButton.style.backgroundColor = '#007bff';
                showMessage('No se detectó ningún rostro.', 'error');
            }
        });
    }

    if (registerUserButton) {
        registerUserButton.addEventListener('click', async () => {
            const opCode = opCodeInput.value, name = nameInput.value, dni = dniInput.value;
            if (!opCode || !name || !dni) return showMessage('Complete todos los campos.', 'error');
            if (!capturedDescriptor) return showMessage('Capture una foto primero.', 'error');

            try {
                const res = await fetch('src/backend.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({ action: 'register', opCode, name, dni, descriptor: JSON.stringify(Array.from(capturedDescriptor)) })
                });
                const data = await res.json();
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
    
    // --- Controles de Fecha ---
    if (dateSelector) {
        dateSelector.addEventListener('change', () => {
            const [year, month, day] = dateSelector.value.split('-').map(Number);
            currentDate = new Date(year, month - 1, day);
            updateDateControls();
            renderCharts(currentDate);
        });

        prevDayButton.addEventListener('click', () => {
            currentDate.setDate(currentDate.getDate() - 1);
            updateDateControls();
            renderCharts(currentDate);
        });

        nextDayButton.addEventListener('click', () => {
            currentDate.setDate(currentDate.getDate() + 1);
            updateDateControls();
            renderCharts(currentDate);
        });

        todayButton.addEventListener('click', () => {
            currentDate = new Date();
            updateDateControls();
            renderCharts(currentDate);
        });
    }

    // --- Controles de Mes ---
    if (monthSelector) {
        monthSelector.addEventListener('change', () => {
            renderEmployeeReport(monthSelector.value);
        });
    }

    // ===== INICIALIZACIÓN =====
    if (document.getElementById('panel-container')) {
        showScreen('charts-screen');
        
        // Inicializar controles de fecha y gráficos
        updateDateControls();
        renderCharts(currentDate);

        // Inicializar controles de mes y reporte
        const currentMonth = new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0');
        monthSelector.value = currentMonth;
        renderEmployeeReport(currentMonth);
    }
});
