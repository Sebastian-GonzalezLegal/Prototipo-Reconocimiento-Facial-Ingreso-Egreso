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
<body class="<?php echo $is_admin ? 'panel' : 'login'; ?>">
    <div class="admin-container">

        <?php if ($is_admin): ?>

        <!-- Contenido del Panel (si la sesión es de admin) -->
        <div id="panel-container">
            <div class="admin-header">
                <button id="register-button" class="btn btn-primary btn-register">Registrar Operario</button>
                <h1>Panel de Administrador</h1>
                <button id="admin-logout-button" class="btn btn-primary">Cerrar Sesión</button>
            </div>

            <div class="chart-container">
                <h2>Registros de Acceso por Día</h2>
                <canvas id="acceso-por-dia"></canvas>
            </div>

            <div class="chart-container">
                <h2>Tipo de Acceso (Facial vs. Manual)</h2>
                <canvas id="acceso-por-tipo"></canvas>
            </div>

            <div class="chart-container">
                <h2>Horas Trabajadas por Empleado y Día</h2>
                <canvas id="horas-trabajadas"></canvas>
            </div>

            <div class="chart-container">
                <h2>Distribución de Horarios de Llegada</h2>
                <canvas id="horarios-llegada"></canvas>
            </div>

            <div class="chart-container">
                <h2>Distribución de Horarios de Salida</h2>
                <canvas id="horarios-salida"></canvas>
            </div>
        </div>

                <!-- Pantalla de registro -->
        <div id="register-screen" class="screen">
            <div class="screen-content">
                <h2>Registro de Operario</h2>
                <div class="camera-container">
                    <video id="video-register" autoplay muted playsinline width="320" height="340"></video>
                    <canvas id="canvas-register" class="canvasregister"></canvas>
                </div>
                <div class="form-group">
                    <input type="text" id="op-code" placeholder="Código de Operario" required>
                    <input type="text" id="name" placeholder="Nombre Completo" required>
                    <input type="text" id="dni" placeholder="DNI" required>
                </div>
                <div class="button-group">
                    <button id="capture-button" class="btn btn-capture">Tomar Foto</button>
                    <button id="register-user-button" class="btn btn-primary">Registrar</button>
                    <button class="back-button btn btn-tertiary">Volver</button>
                </div>
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
            </div>
            <p id="admin-login-error" style="color: red; margin-top: 10px;"></p>
        </div>

        <?php endif; ?>

    </div>
    
    <footer>
        <p>&copy; 2025 Control de Ingreso/Egreso. Todos los derechos reservados.</p>
    </footer>

    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="js/face-api.min.js"></script>
    <script src="js/admin.js"></script>
</body>
</html>