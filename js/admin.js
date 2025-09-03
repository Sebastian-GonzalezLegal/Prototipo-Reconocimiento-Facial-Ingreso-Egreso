document.addEventListener('DOMContentLoaded', () => {
    // --- Elementos del DOM ---
    const adminLoginButton = document.getElementById('admin-login-button');
    const adminLogoutButton = document.getElementById('admin-logout-button');
    const adminOpCodeInput = document.getElementById('admin-op-code');
    const adminDniInput = document.getElementById('admin-dni');
    const adminLoginError = document.getElementById('admin-login-error');

    const chartTextColor = '#e0e0e0';
    let accessLogsChart = null;
    let accessTypeChart = null;

    // --- Lógica de Gráficos ---
    const renderCharts = async () => {
        try {
            const logsResponse = await fetch('src/backend.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({ action: 'getAccessLogsPerDay' })
            });
            const logsResult = await logsResponse.json();

            if (logsResult.status === 'success') {
                const logsCtx = document.getElementById('access-logs-chart').getContext('2d');
                if (accessLogsChart) accessLogsChart.destroy();
                accessLogsChart = new Chart(logsCtx, {
                    type: 'bar', data: { labels: logsResult.data.labels, datasets: [{ label: 'Ingresos', data: logsResult.data.ingresos, backgroundColor: 'rgba(75, 192, 192, 0.5)', borderColor: 'rgba(75, 192, 192, 1)', borderWidth: 1 }, { label: 'Egresos', data: logsResult.data.egresos, backgroundColor: 'rgba(255, 99, 132, 0.5)', borderColor: 'rgba(255, 99, 132, 1)', borderWidth: 1 }] },
                    options: { scales: { y: { beginAtZero: true, ticks: { stepSize: 1, color: chartTextColor }, grid: { color: 'rgba(224, 224, 224, 0.2)' } }, x: { ticks: { color: chartTextColor }, grid: { color: 'rgba(224, 224, 224, 0.2)' } } }, plugins: { legend: { labels: { color: chartTextColor } } } }
                });
            }

            const typeResponse = await fetch('src/backend.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({ action: 'getAccessLogsByType' })
            });
            const typeResult = await typeResponse.json();

            if (typeResult.status === 'success') {
                const typeCtx = document.getElementById('access-type-chart').getContext('2d');
                if (accessTypeChart) accessTypeChart.destroy();
                accessTypeChart = new Chart(typeCtx, {
                    type: 'doughnut', data: { labels: typeResult.data.labels, datasets: [{ label: 'Tipo de Acceso', data: typeResult.data.values, backgroundColor: ['rgba(54, 162, 235, 0.5)', 'rgba(255, 206, 86, 0.5)'], borderColor: ['rgba(54, 162, 235, 1)', 'rgba(255, 206, 86, 1)'], borderWidth: 1 }] },
                    options: { plugins: { legend: { labels: { color: chartTextColor } } } }
                });
            }
        } catch (error) {
            console.error('Error al renderizar los gráficos:', error);
        }
    };

    // Si existe el botón de login, le añadimos el evento
    if (adminLoginButton) {
        adminLoginButton.addEventListener('click', async () => {
            const opCode = adminOpCodeInput.value;
            const dni = adminDniInput.value;
            if (!opCode || !dni) {
                adminLoginError.textContent = 'Por favor, complete todos los campos.';
                return;
            }
            try {
                const response = await fetch('src/backend.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({ action: 'adminLogin', opCode, dni })
                });
                const data = await response.json();
                if (data.status === 'success') {
                    location.reload(); // Recargar la página. El servidor mostrará el panel.
                } else {
                    adminLoginError.textContent = data.msg || 'Error en el login.';
                }
            } catch (error) {
                console.error('Error en el login:', error);
                adminLoginError.textContent = 'Error de conexión con el servidor.';
            }
        });
    }

    // Si existe el botón de logout, le añadimos el evento
    if (adminLogoutButton) {
        adminLogoutButton.addEventListener('click', async () => {
            try {
                await fetch('src/backend.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({ action: 'adminLogout' })
                });
                location.reload();
            } catch (error) {
                console.error('Error al cerrar sesión:', error);
            }
        });
    }

    // --- Inicialización ---
    // Si el botón de logout existe, significa que estamos en el panel.
    if (adminLogoutButton) {
        renderCharts();
    }
});
