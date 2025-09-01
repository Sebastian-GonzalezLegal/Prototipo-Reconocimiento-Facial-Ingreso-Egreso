<?php
session_start();
$is_admin = isset($_SESSION['isAdmin']) && $_SESSION['isAdmin'] === true;
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Panel de Administrador</title>
    <link rel="stylesheet" href="css/admin.css">
</head>
<body>
    <div class="admin-container">

        <?php if ($is_admin): ?>

        <!-- Contenido del Panel (si la sesión es de admin) -->
        <div id="panel-container">
            <div class="admin-header">
                <a href="index.html" class="nav-link">← Volver al Menú</a>
                <h1>Panel</h1>
                <button id="admin-logout-button" class="nav-link">Cerrar Sesión</button>
            </div>

            <div class="chart-container">
                <h2>Registros de Acceso por Día</h2>
                <canvas id="access-logs-chart"></canvas>
            </div>

            <div class="chart-container">
                <h2>Tipo de Acceso (Facial vs. Manual)</h2>
                <canvas id="access-type-chart"></canvas>
            </div>
        </div>

        <?php else: ?>

        <!-- Formulario de Login de Admin (si no hay sesión de admin) -->
        <div id="login-form-container">
            <h2>Login de Administrador</h2>
            <div class="form-group">
                <input type="text" id="admin-op-code" placeholder="Código de Operario" required>
                <input type="password" id="admin-dni" placeholder="DNI (contraseña)" required>
            </div>
            <div class="button-group">
                <button id="admin-login-button" class="btn btn-primary">Ingresar</button>
                <button class="btn btn-secondary"><a href="index.html" class="btn btn-tertiary">Volver</a></button
            </div>
            <p id="admin-login-error" style="color: red; margin-top: 10px;"></p>
        </div>

        <?php endif; ?>

    </div>

    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="js/admin.js"></script>
</body>
</html>
