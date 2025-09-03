# Sistema de Control de Ingreso/Egreso con Reconocimiento Facial

Este proyecto es un prototipo funcional de un sistema de control de acceso que utiliza reconocimiento facial para registrar las entradas y salidas de los operarios. Incluye un módulo de registro de usuarios, un sistema de login/logout facial, un fallback manual y un panel de administración con estadísticas.

## ✨ Características

-   **Registro de Operarios:** Los nuevos operarios pueden registrarse proporcionando sus datos (código de operario, nombre, DNI) y capturando una foto de su rostro.
-   **Reconocimiento Facial:** Utiliza la cámara del dispositivo para identificar al operario y registrar su ingreso o egreso de forma automática.
-   **Registro Manual:** Si el reconocimiento facial falla, el sistema ofrece la opción de registrar el ingreso/egreso manualmente introduciendo el código de operario y el DNI.
-   **Panel de Administración:** Una sección protegida por contraseña donde los administradores pueden visualizar estadísticas de acceso.
-   **Visualización de Datos:** Gráficos que muestran los registros de acceso por día y la proporción de accesos faciales vs. manuales.

## 🛠️ Tecnologías Utilizadas

### Frontend
-   **HTML5:** Estructura de la aplicación web.
-   **CSS3:** Estilos para la interfaz de usuario.
-   **JavaScript (ES6+):** Lógica del lado del cliente, manejo de la cámara y eventos.
-   **Face-api.js:** Una API de JavaScript para detección y reconocimiento de rostros en el navegador, basada en tensorflow.js.
-   **Chart.js:** Para la creación de gráficos dinámicos y responsivos en el panel de administración.

### Backend
-   **PHP 7+:** Lógica del lado del servidor para interactuar con la base de datos.
-   **MySQL:** Sistema de gestión de bases de datos para almacenar la información de los usuarios y los registros de acceso.

### Entorno de Desarrollo
-   **XAMPP:** Utilizado para correr el servidor web Apache y la base de datos MySQL en un entorno local.
-   **DBeaver:** Cliente de base de datos utilizado para visualizar, crear y editar la estructura y los datos de la base de datos.

## 🚀 Instalación y Puesta en Marcha

Siga estos pasos para configurar y ejecutar el proyecto en su entorno local.

### 1. Prerrequisitos

-   Tener instalado [XAMPP](https://www.apachefriends.org/es/index.html) (o un stack de servidor similar como WAMP o MAMP).
-   Un navegador web moderno (Chrome, Firefox) que soporte `getUserMedia` para el acceso a la cámara.
-   Opcional: Un cliente de base de datos como [DBeaver](https://dbeaver.io/) o phpMyAdmin (incluido en XAMPP).

### 2. Configuración de la Base de Datos

1.  **Inicie XAMPP** y active los módulos de **Apache** y **MySQL**.
2.  Abra su cliente de base de datos (phpMyAdmin, DBeaver).
3.  Cree una nueva base de datos llamada `reconocimiento`.
4.  Ejecute el siguiente script SQL para crear las tablas necesarias:

    ```sql
    CREATE TABLE `usuarios` (
      `id` int(11) NOT NULL AUTO_INCREMENT,
      `opCode` varchar(50) NOT NULL,
      `name` varchar(100) NOT NULL,
      `dni` varchar(20) NOT NULL,
      `descriptor` text NOT NULL,
      `rol` varchar(20) DEFAULT 'operario',
      PRIMARY KEY (`id`),
      UNIQUE KEY `opCode` (`opCode`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

    CREATE TABLE `accesos` (
      `id` int(11) NOT NULL AUTO_INCREMENT,
      `usuario_id` int(11) NOT NULL,
      `accion` enum('ingreso','egreso') NOT NULL,
      `tipo` enum('facial','manual') NOT NULL,
      `fecha_hora` datetime NOT NULL,
      PRIMARY KEY (`id`),
      KEY `usuario_id` (`usuario_id`),
      CONSTRAINT `accesos_ibfk_1` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ```

5.  **(Opcional) Crear un usuario administrador:** Para acceder al panel de administración, inserte un usuario con el rol de `admin`. Use su DNI como contraseña.

    ```sql
    INSERT INTO `usuarios` (opCode, name, dni, descriptor, rol) 
    VALUES ('ADMIN01', 'Administrador', 'SU_DNI_AQUI', '[]', 'admin');
    ```

### 3. Configuración del Proyecto

1.  Clone o descargue este repositorio en la carpeta `htdocs` de su instalación de XAMPP.
    -   Por lo general, la ruta es `C:/xampp/htdocs/`.
2.  El archivo de conexión a la base de datos `src/backend.php` está preconfigurado para un entorno XAMPP estándar (`host: "localhost"`, `user: "root"`, `pass: ""`). Si su configuración es diferente, modifique estas variables.
3.  Abra su navegador y vaya a `http://localhost/NOMBRE_DE_LA_CARPETA_DEL_PROYECTO/`.

## 📁 Estructura del Proyecto

```
.
├── admin.php               # Página del panel de administración
├── css/
│   ├── admin.css           # Estilos para el panel de admin
│   └── styles.css          # Estilos principales
├── index.html              # Página principal de la aplicación
├── js/
│   ├── admin.js            # Lógica para el panel de admin (gráficos)
│   ├── face-api.min.js     # Librería de reconocimiento facial
│   └── script.js           # Lógica principal (registro, login/logout facial)
├── models/                 # Modelos pre-entrenados para face-api.js
└── src/
    └── backend.php         # Endpoint PHP que maneja toda la lógica del servidor
```

## ⚙️ ¿Cómo Funciona?

### Registro de Usuario
1.  El usuario navega a la pantalla de registro.
2.  Al presionar "Tomar Foto", `face-api.js` detecta un rostro en el stream de la cámara y genera un **descriptor facial** (un array de 128 números que representa las características únicas del rostro).
3.  Este descriptor, junto con los datos del formulario, se envía al `backend.php`.
4.  El backend inserta un nuevo registro en la tabla `usuarios`, guardando el descriptor como un string JSON.

### Login/Logout Facial
1.  Al iniciar el proceso de login, el frontend solicita al backend la lista completa de usuarios registrados (`getUsers`).
2.  `face-api.js` crea un `FaceMatcher` con los descriptores de todos los usuarios.
3.  La aplicación escanea el video de la cámara en tiempo real. Por cada rostro detectado, calcula su descriptor y lo compara con el `FaceMatcher`.
4.  Si encuentra una coincidencia con una confianza suficiente, identifica al usuario y envía una petición al backend para registrar el acceso (`ingreso` o `egreso`) en la tabla `accesos`.
5.  Si no se detecta a nadie en 5 segundos, se redirige al flujo de registro manual.
