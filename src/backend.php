<?php
$host = "localhost";
$user = "root"; // por defecto en XAMPP
$pass = "";
$dbname = "reconocimiento";

$conn = new mysqli($host, $user, $pass, $dbname);

if ($conn->connect_error) {
    die("Error de conexión: " . $conn->connect_error);
}

$action = isset($_POST['action']) ? $_POST['action'] : '';


if ($action === 'register') {
    $opCode = $_POST['opCode'];
    $name = $_POST['name'];
    $dni = $_POST['dni'];
    $descriptor = $_POST['descriptor']; // JSON

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
    $fecha_hora = isset($_POST['fecha_hora']) ? $_POST['fecha_hora'] : date('Y-m-d H:i:s');

    if (!$usuario_id || !$accion) {
        echo json_encode(array("status" => "error", "msg" => "Faltan datos para registrar acceso."));
        exit;
    }

    $stmt = $conn->prepare("INSERT INTO accesos (usuario_id, accion, fecha_hora) VALUES (?, ?, ?)");
    $stmt->bind_param("iss", $usuario_id, $accion, $fecha_hora);

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
