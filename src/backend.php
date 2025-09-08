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
    // Obtener la fecha de la petición, si no, usar la de hoy
    $date = isset($_POST['date']) ? $_POST['date'] : date('Y-m-d');
    $month = isset($_POST['month']) ? $_POST['month'] : date('Y-m');

    if ($action === 'getEmployeeReport') {
        // --- Lógica para calcular ausencias ---
        list($year, $month_num) = explode('-', $month);
        $workdays = 0;
        
        // Determinar el límite de días a contar
        $current_month_str = date('Y-m');
        $limit_day = ($month === $current_month_str) ? date('j') : cal_days_in_month(CAL_GREGORIAN, $month_num, $year);

        for ($d = 1; $d <= $limit_day; $d++) {
            $day_of_week = date('N', strtotime("$year-$month_num-$d"));
            if ($day_of_week >= 1 && $day_of_week <= 5) { // Lunes a Viernes
                $workdays++;
            }
        }

        // --- Obtener todos los operarios ---
        $users_res = $conn->query("SELECT id, opCode, name FROM usuarios WHERE rol != 'admin' ORDER BY name ASC");
        $users = [];
        while ($user_row = $users_res->fetch_assoc()) {
            $users[$user_row['id']] = [
                'opCode' => $user_row['opCode'],
                'name' => $user_row['name'],
                'llegadas_tarde' => 0,
                'salidas_tempranas' => 0,
                'faltas' => 0,
                'horas_extras' => 0
            ];
        }
        $user_ids = array_keys($users);

        if (!empty($user_ids)) {
            $user_id_placeholders = implode(',', array_fill(0, count($user_ids), '?'));

            // --- Calcular llegadas tarde, salidas tempranas y horas extras ---
            $query_times = "
                SELECT 
                    usuario_id,
                    SUM(CASE WHEN CAST(fecha_hora_ingreso AS TIME) > '08:15:00' THEN 1 ELSE 0 END) as llegadas_tarde,
                    SUM(CASE WHEN CAST(fecha_hora_egreso AS TIME) < '16:00:00' THEN 1 ELSE 0 END) as salidas_tempranas,
                    SUM(CASE WHEN CAST(fecha_hora_egreso AS TIME) >= '17:00:00' THEN 3600 + TIMESTAMPDIFF(SECOND, TIME('17:00:00'), CAST(fecha_hora_egreso AS TIME)) ELSE 0 END) as horas_extras_segundos
                FROM accesos
                WHERE DATE_FORMAT(fecha_hora_ingreso, '%Y-%m') = ? AND usuario_id IN ($user_id_placeholders)
                GROUP BY usuario_id
            ";
            $stmt_times = $conn->prepare($query_times);
            $types = 's' . str_repeat('i', count($user_ids));
            $params = array_merge([$month], $user_ids);
            $stmt_times->bind_param($types, ...$params);
            $stmt_times->execute();
            $result_times = $stmt_times->get_result();
            while ($row = $result_times->fetch_assoc()) {
                $users[$row['usuario_id']]['llegadas_tarde'] = $row['llegadas_tarde'];
                $users[$row['usuario_id']]['salidas_tempranas'] = $row['salidas_tempranas'];
                $users[$row['usuario_id']]['horas_extras'] = round($row['horas_extras_segundos'] / 3600, 2);
            }

            // --- Calcular días presentes ---
            $query_present = "
                SELECT usuario_id, COUNT(DISTINCT DATE(fecha_hora_ingreso)) as dias_presente
                FROM accesos
                WHERE DATE_FORMAT(fecha_hora_ingreso, '%Y-%m') = ? AND usuario_id IN ($user_id_placeholders)
                GROUP BY usuario_id
            ";
            $stmt_present = $conn->prepare($query_present);
            $stmt_present->bind_param($types, ...$params);
            $stmt_present->execute();
            $result_present = $stmt_present->get_result();
            while ($row = $result_present->fetch_assoc()) {
                $users[$row['usuario_id']]['faltas'] = $workdays - $row['dias_presente'];
            }
        }
        
        // Formatear datos para la respuesta
        $reportData = array_values($users);
        echo json_encode(["status" => "success", "data" => $reportData]);
        exit;
    }

    if ($action === 'getAccessLogsPerDay') {
        $query = "
            SELECT 
                HOUR(fecha_hora_ingreso) as hora, COUNT(id) as cantidad
            FROM accesos 
            WHERE DATE(fecha_hora_ingreso) = ?
            GROUP BY hora
            ORDER BY hora ASC
        ";
        $stmt_ingresos = $conn->prepare($query);
        $stmt_ingresos->bind_param("s", $date);
        $stmt_ingresos->execute();
        $res_ingresos = $stmt_ingresos->get_result();

        $query_egresos = "
            SELECT 
                HOUR(fecha_hora_egreso) as hora, COUNT(id) as cantidad
            FROM accesos 
            WHERE DATE(fecha_hora_egreso) = ?
            GROUP BY hora
            ORDER BY hora ASC
        ";
        $stmt_egresos = $conn->prepare($query_egresos);
        $stmt_egresos->bind_param("s", $date);
        $stmt_egresos->execute();
        $res_egresos = $stmt_egresos->get_result();

        $labels = range(0, 23);
        $ingresos = array_fill(0, 24, 0);
        $egresos = array_fill(0, 24, 0);

        while ($row = $res_ingresos->fetch_assoc()) {
            $ingresos[intval($row['hora'])] = $row['cantidad'];
        }
        while ($row = $res_egresos->fetch_assoc()) {
            $egresos[intval($row['hora'])] = $row['cantidad'];
        }

        $data = [
            "labels" => array_map(function($h) { return str_pad($h, 2, '0', STR_PAD_LEFT) . ':00'; }, $labels),
            "ingresos" => $ingresos,
            "egresos" => $egresos
        ];
        
        echo json_encode(["status" => "success", "data" => $data]);
        exit;
    }

    if ($action === 'getHoursWorkedPerDay') {
        $query = "
            SELECT
                u.name as nombre_empleado,
                SUM(TIMESTAMPDIFF(SECOND, a.fecha_hora_ingreso, a.fecha_hora_egreso)) / 3600 as horas_trabajadas
            FROM accesos a
            JOIN usuarios u ON a.usuario_id = u.id
            WHERE 
                DATE(a.fecha_hora_ingreso) = ? 
                AND a.fecha_hora_egreso IS NOT NULL 
                AND u.rol != 'admin'
            GROUP BY nombre_empleado
            ORDER BY nombre_empleado
        ";
        $stmt = $conn->prepare($query);
        $stmt->bind_param("s", $date);
        $stmt->execute();
        $result = $stmt->get_result();

        $labels = [];
        $datasets = [
            [
                'label' => 'Horas Trabajadas',
                'data' => [],
                'backgroundColor' => 'rgba(75, 192, 192, 0.5)'
            ]
        ];

        while($row = $result->fetch_assoc()) {
            $labels[] = $row['nombre_empleado'];
            $datasets[0]['data'][] = round($row['horas_trabajadas'], 2);
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
            WHERE DATE(fecha_hora_ingreso) = ? AND HOUR(fecha_hora_ingreso) >= 7 AND HOUR(fecha_hora_ingreso) < 20
            GROUP BY hora, cuarto_hora
            ORDER BY hora, cuarto_hora ASC
        ";
        $stmt = $conn->prepare($query);
        $stmt->bind_param("s", $date);
        $stmt->execute();
        $result = $stmt->get_result();

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
            WHERE DATE(fecha_hora_egreso) = ? AND HOUR(fecha_hora_egreso) >= 7 AND HOUR(fecha_hora_egreso) < 20
            GROUP BY hora, cuarto_hora
            ORDER BY hora, cuarto_hora ASC
        ";
        $stmt = $conn->prepare($query);
        $stmt->bind_param("s", $date);
        $stmt->execute();
        $result = $stmt->get_result();

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
                SELECT tipo_ingreso as tipo FROM accesos WHERE tipo_ingreso IS NOT NULL AND DATE(fecha_hora_ingreso) = ?
                UNION ALL
                SELECT tipo_egreso as tipo FROM accesos WHERE tipo_egreso IS NOT NULL AND DATE(fecha_hora_egreso) = ?
            ) as all_types
            GROUP BY tipo
        ";
        $stmt = $conn->prepare($query);
        $stmt->bind_param("ss", $date, $date);
        $stmt->execute();
        $result = $stmt->get_result();
        
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