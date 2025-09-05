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

$conn->query("SET time_zone = 'America/Argentina/Buenos_Aires'");

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
                dia,
                SUM(ingresos) as ingresos,
                SUM(egresos) as egresos
            FROM (
                SELECT DATE(fecha_hora_ingreso) as dia, COUNT(id) as ingresos, 0 as egresos
                FROM accesos
                WHERE fecha_hora_ingreso IS NOT NULL
                GROUP BY dia
                UNION ALL
                SELECT DATE(fecha_hora_egreso) as dia, 0 as ingresos, COUNT(id) as egresos
                FROM accesos
                WHERE fecha_hora_egreso IS NOT NULL
                GROUP BY dia
            ) as daily_counts
            WHERE dia IS NOT NULL
            GROUP BY dia
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

    if ($action === 'getHoursWorkedPerDay') {
        $query = "
            SELECT
                DATE(a.fecha_hora_ingreso) as dia,
                u.name as nombre_empleado,
                SUM(TIMESTAMPDIFF(SECOND, a.fecha_hora_ingreso, a.fecha_hora_egreso)) / 3600 as horas_trabajadas
            FROM accesos a
            JOIN usuarios u ON a.usuario_id = u.id
            WHERE a.fecha_hora_ingreso IS NOT NULL AND a.fecha_hora_egreso IS NOT NULL AND u.rol != 'admin'
            GROUP BY dia, nombre_empleado
            ORDER BY dia, nombre_empleado
        ";
        $result = $conn->query($query);

        $labels = [];
        $datasets = [];
        $rawData = [];

        while($row = $result->fetch_assoc()) {
            if (!in_array($row['dia'], $labels)) {
                $labels[] = $row['dia'];
            }
            $rawData[$row['nombre_empleado']][$row['dia']] = round($row['horas_trabajadas'], 2);
        }

        sort($labels);

        $employeeColors = [
            'rgba(255, 99, 132, 0.5)', 'rgba(54, 162, 235, 0.5)', 'rgba(255, 206, 86, 0.5)',
            'rgba(75, 192, 192, 0.5)', 'rgba(153, 102, 255, 0.5)', 'rgba(255, 159, 64, 0.5)'
        ];
        $colorIndex = 0;

        foreach ($rawData as $employeeName => $dailyData) {
            $dataset = [
                'label' => $employeeName,
                'data' => [],
                'backgroundColor' => $employeeColors[$colorIndex % count($employeeColors)]
            ];
            foreach ($labels as $label) {
                $dataset['data'][] = isset($dailyData[$label]) ? $dailyData[$label] : 0;
            }
            $datasets[] = $dataset;
            $colorIndex++;
        }

        echo json_encode(["status" => "success", "data" => ["labels" => $labels, "datasets" => $datasets]]);
        exit;
    }

    if ($action === 'getArrivalDistribution') {
        $query = "
            SELECT
                HOUR(fecha_hora_ingreso) as hora,
                FLOOR(MINUTE(fecha_hora_ingreso) / 15) as cuarto_hora,
                COUNT(id) as cantidad
            FROM accesos
            WHERE fecha_hora_ingreso IS NOT NULL AND HOUR(fecha_hora_ingreso) >= 7 AND HOUR(fecha_hora_ingreso) < 20
            GROUP BY hora, cuarto_hora
            ORDER BY hora, cuarto_hora ASC
        ";
        $result = $conn->query($query);
        $data = ["labels" => [], "values" => []];
        for ($h = 7; $h < 20; $h++) {
            for ($q = 0; $q < 4; $q++) {
                $minute = $q * 15;
                $data['labels'][] = str_pad($h, 2, '0', STR_PAD_LEFT) . ':' . str_pad($minute, 2, '0', STR_PAD_LEFT);
                $data['values'][] = 0;
            }
        }
        while($row = $result->fetch_assoc()) {
            $hour = intval($row['hora']);
            $quarter = intval($row['cuarto_hora']);
            $index = (($hour - 7) * 4) + $quarter;
            if (isset($data['values'][$index])) {
                $data['values'][$index] = $row['cantidad'];
            }
        }
        echo json_encode(["status" => "success", "data" => $data]);
        exit;
    }

    if ($action === 'getDepartureDistribution') {
        $query = "
            SELECT
                HOUR(fecha_hora_egreso) as hora,
                FLOOR(MINUTE(fecha_hora_egreso) / 15) as cuarto_hora,
                COUNT(id) as cantidad
            FROM accesos
            WHERE fecha_hora_egreso IS NOT NULL AND HOUR(fecha_hora_egreso) >= 7 AND HOUR(fecha_hora_egreso) < 20
            GROUP BY hora, cuarto_hora
            ORDER BY hora, cuarto_hora ASC
        ";
        $result = $conn->query($query);
        $data = ["labels" => [], "values" => []];
        for ($h = 7; $h < 20; $h++) {
            for ($q = 0; $q < 4; $q++) {
                $minute = $q * 15;
                $data['labels'][] = str_pad($h, 2, '0', STR_PAD_LEFT) . ':' . str_pad($minute, 2, '0', STR_PAD_LEFT);
                $data['values'][] = 0;
            }
        }
        while($row = $result->fetch_assoc()) {
            $hour = intval($row['hora']);
            $quarter = intval($row['cuarto_hora']);
            $index = (($hour - 7) * 4) + $quarter;
            if (isset($data['values'][$index])) {
                $data['values'][$index] = $row['cantidad'];
            }
        }
        echo json_encode(["status" => "success", "data" => $data]);
        exit;
    }

    if ($action === 'getAccessLogsByType') {
        $query = "
            SELECT tipo, COUNT(*) as total
            FROM (
                SELECT tipo_ingreso as tipo FROM accesos WHERE tipo_ingreso IS NOT NULL
                UNION ALL
                SELECT tipo_egreso as tipo FROM accesos WHERE tipo_egreso IS NOT NULL
            ) as all_types
            GROUP BY tipo
        ";
        $result = $conn->query($query);
        $data = ["labels" => [], "values" => []];
        while($row = $result->fetch_assoc()) {
            $data['labels'][] = ucfirst($row['tipo']);
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

    $fecha_hora_dt = new DateTime($fecha_hora);
    $mysql_datetime = $fecha_hora_dt->format('Y-m-d H:i:s');

    if (!$usuario_id || !$accion) {
        echo json_encode(["status" => "error", "msg" => "Faltan datos para registrar acceso."]);
        exit;
    }

    if ($accion === 'ingreso') {
        $stmt_check = $conn->prepare("SELECT id FROM accesos WHERE usuario_id = ? AND fecha_hora_egreso IS NULL");
        if ($stmt_check === false) {
            echo json_encode(["status" => "error", "msg" => "Error preparing statement (check): " . $conn->error]);
            exit;
        }
        $stmt_check->bind_param("i", $usuario_id);
        $stmt_check->execute();
        $stmt_check->store_result();

        if ($stmt_check->num_rows > 0) {
            echo json_encode(["status" => "error", "msg" => "Usted ya ha registrado su ingreso."]);
            $stmt_check->close();
            exit;
        }
        $stmt_check->close();

        $stmt_insert = $conn->prepare("INSERT INTO accesos (usuario_id, fecha_hora_ingreso, tipo_ingreso) VALUES (?, ?, ?)");
        if ($stmt_insert === false) {
            echo json_encode(["status" => "error", "msg" => "Error preparing statement (insert): " . $conn->error]);
            exit;
        }
        $stmt_insert->bind_param("iss", $usuario_id, $mysql_datetime, $tipo);
        
        if ($stmt_insert->execute()) {
            echo json_encode(["status" => "success", "msg" => "Ingreso registrado correctamente."]);
        } else {
            echo json_encode(["status" => "error", "msg" => "Error executing statement (insert): " . $stmt_insert->error]);
        }
        $stmt_insert->close();
        exit;
    } elseif ($accion === 'egreso') {
        $stmt = $conn->prepare("SELECT id FROM accesos WHERE usuario_id = ? AND fecha_hora_egreso IS NULL ORDER BY fecha_hora_ingreso DESC LIMIT 1");
        $stmt->bind_param("i", $usuario_id);
        $stmt->execute();
        $stmt->bind_result($acceso_id_from_db);
        $stmt->store_result();

        if ($stmt->num_rows === 0) {
            echo json_encode(["status" => "error", "msg" => "Debe registrar su ingreso antes de poder egresar."]);
            $stmt->close();
            exit;
        }

        $stmt->fetch();
        $acceso_id = $acceso_id_from_db;
        $stmt->close();

        $stmt = $conn->prepare("UPDATE accesos SET fecha_hora_egreso = ?, tipo_egreso = ? WHERE id = ?");
        $stmt->bind_param("ssi", $mysql_datetime, $tipo, $acceso_id);

        if ($stmt->execute()) {
            echo json_encode(["status" => "success", "msg" => "Egreso registrado correctamente."]);
        } else {
            echo json_encode(["status" => "error", "msg" => $stmt->error]);
        }
        $stmt->close();
    } else {
        echo json_encode(["status" => "error", "msg" => "Acción no válida."]);
    }
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
