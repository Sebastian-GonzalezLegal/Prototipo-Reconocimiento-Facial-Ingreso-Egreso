<?php
date_default_timezone_set('America/Argentina/Buenos_Aires');
$host = "localhost";
$user = "root";
$pass = "";
$dbname = "reconocimiento";

$conn = new mysqli($host, $user, $pass, $dbname);

if ($conn->connect_error) {
    die("Error de conexión: " . $conn->connect_error);
}

// --- Lógica de Migración Simple ---
// Añadir columna 'rol' a 'usuarios'
$result_rol = $conn->query("SHOW COLUMNS FROM `usuarios` LIKE 'rol'");
if ($result_rol->num_rows == 0) {
    $conn->query("ALTER TABLE `usuarios` ADD COLUMN `rol` VARCHAR(50) NOT NULL DEFAULT 'operario' AFTER `dni`");
    $conn->query("UPDATE `usuarios` SET `rol` = 'admin' ORDER BY id ASC LIMIT 1");
}
// Añadir columnas 'tipo' y 'fecha_hora' a 'accesos'
$result_tipo = $conn->query("SHOW COLUMNS FROM `accesos` LIKE 'tipo'");
if ($result_tipo->num_rows == 0) {
    $conn->query("ALTER TABLE `accesos` ADD COLUMN `tipo` VARCHAR(50) NOT NULL AFTER `accion`");
}
$result_fecha = $conn->query("SHOW COLUMNS FROM `accesos` LIKE 'fecha_hora'");
if ($result_fecha->num_rows == 0) {
    $conn->query("ALTER TABLE `accesos` ADD COLUMN `fecha_hora` DATETIME NOT NULL AFTER `tipo`");
}
// --- Fin de la Lógica de Migración ---


session_start();
$action = isset($_POST['action']) ? $_POST['action'] : '';

if ($action === 'checkAdminSession') {
    if (isset($_SESSION['isAdmin']) && $_SESSION['isAdmin'] === true) {
        echo json_encode(['status' => 'success', 'isAdmin' => true]);
    } else {
        echo json_encode(['status' => 'success', 'isAdmin' => false]);
    }
    exit;
}

if ($action === 'adminLogout') {
    session_destroy();
    echo json_encode(['status' => 'success']);
    exit;
}

if ($action === 'adminLogin') {
    $opCode = $_POST['opCode'];
    $dni = $_POST['dni'];

    $stmt = $conn->prepare("SELECT id FROM usuarios WHERE opCode = ? AND dni = ? AND rol = 'admin'");
    $stmt->bind_param("ss", $opCode, $dni);
    $stmt->execute();
    $stmt->store_result();

    if ($stmt->num_rows > 0) {
        $_SESSION['isAdmin'] = true;
        echo json_encode(["status" => "success"]);
    } else {
        $_SESSION['isAdmin'] = false;
        echo json_encode(["status" => "error", "msg" => "Credenciales de administrador incorrectas."]);
    }
    $stmt->close();
    exit;
}

// --- API para Gráficos (Solo para Admins) ---
if (isset($_SESSION['isAdmin']) && $_SESSION['isAdmin'] === true) {
    if ($action === 'getAccessLogsPerDay') {
        $query = "
            SELECT 
                DATE(fecha_hora) as dia,
                COUNT(id) as total,
                SUM(CASE WHEN accion = 'ingreso' THEN 1 ELSE 0 END) as ingresos,
                SUM(CASE WHEN accion = 'egreso' THEN 1 ELSE 0 END) as egresos
            FROM accesos
            GROUP BY DATE(fecha_hora)
            ORDER BY dia ASC
        ";
        $result = $conn->query($query);
        $data = ["labels" => [], "ingresos" => [], "egresos" => []];
        while($row = $result->fetch_assoc()) {
            $data['labels'][] = $row['dia'];
            $data['ingresos'][] = $row['ingresos'];
            $data['egresos'][] = $row['egresos'];
        }
        echo json_encode(["status" => "success", "data" => $data]);
        exit;
    }

    if ($action === 'getAccessLogsByType') {
        $query = "
            SELECT 
                tipo,
                COUNT(id) as total
            FROM accesos
            GROUP BY tipo
        ";
        $result = $conn->query($query);
        $data = ["labels" => [], "values" => []];
        while($row = $result->fetch_assoc()) {
            $data['labels'][] = ucfirst($row['tipo']); // Capitalize first letter
            $data['values'][] = $row['total'];
        }
        echo json_encode(["status" => "success", "data" => $data]);
        exit;
    }
}
// --- Fin API para Gráficos ---

if ($action === 'register') {
    $opCode = $_POST['opCode'];
    $name = $_POST['name'];
    $dni = $_POST['dni'];
    $descriptor = $_POST['descriptor'];

    $stmt = $conn->prepare("INSERT INTO usuarios (opCode, name, dni, descriptor) VALUES (?, ?, ?, ?)");
    $stmt->bind_param("ssss", $opCode, $name, $dni, $descriptor);

    if ($stmt->execute()) {
        echo json_encode(["status" => "success"]);
    } else {
        echo json_encode(["status" => "error", "msg" => $stmt->error]);
    }
    $stmt->close();
}

if ($action === 'access') {
    $usuario_id = isset($_POST['usuario_id']) ? intval($_POST['usuario_id']) : 0;
    $accion     = isset($_POST['accion']) ? $_POST['accion'] : '';
    $tipo       = isset($_POST['tipo']) ? $_POST['tipo'] : 'desconocido';
    $fecha_hora = isset($_POST['fecha_hora']) ? $_POST['fecha_hora'] : date('Y-m-d H:i:s');

    // Formatear la fecha para asegurar compatibilidad con MySQL DATETIME
    $fecha_hora_dt = new DateTime($fecha_hora);
    $mysql_datetime = $fecha_hora_dt->format('Y-m-d H:i:s');

    if (!$usuario_id || !$accion) {
        echo json_encode(array("status" => "error", "msg" => "Faltan datos para registrar acceso."));
        exit;
    }

    $stmt = $conn->prepare("INSERT INTO accesos (usuario_id, accion, tipo, fecha_hora) VALUES (?, ?, ?, ?)");
    $stmt->bind_param("isss", $usuario_id, $accion, $tipo, $mysql_datetime);

    if ($stmt->execute()) {
        echo json_encode(array("status" => "success"));
    } else {
        echo json_encode(array("status" => "error", "msg" => $stmt->error));
    }
    $stmt->close();
    exit;
}

if ($action === 'getUsers') {
    $result = $conn->query("SELECT * FROM usuarios");
    $users = [];
    while($row = $result->fetch_assoc()) {
        $users[] = $row;
    }
    echo json_encode($users);
}

$conn->close();
?>
