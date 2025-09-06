# Sistema de Control de Ingreso/Egreso con Reconocimiento Facial

Este proyecto es un prototipo funcional de un sistema de control de acceso que utiliza reconocimiento facial para registrar las entradas y salidas de los operarios. Incluye un módulo de registro de usuarios, un sistema de login/logout facial, un fallback manual y un panel de administración con estadísticas.

## ✨ Características

-   **Separación de Roles:** La aplicación se divide en dos interfaces claras: una para el registro de fichajes de los operarios y otra para la administración.
-   **Registro de Fichaje Facial:** Utiliza la cámara del dispositivo para identificar al operario y registrar su ingreso o egreso de forma automática.
-   **Fallback de Fichaje Manual:** Si el reconocimiento facial falla, el sistema ofrece la opción de registrar el ingreso/egreso manualmente con el código de operario y DNI.
-   **Panel de Administración Centralizado:** Una sección protegida por contraseña donde los administradores pueden gestionar operarios y visualizar estadísticas avanzadas.
    -   **Gestión de Operarios:** Permite registrar nuevos operarios, incluyendo la captura de su descriptor facial.
    -   **Visualización de Datos Mejorada:** Incluye gráficos interactivos para un análisis completo:
        -   Registros de acceso por día (ingresos vs. egresos).
        -   Proporción de accesos faciales vs. manuales.
        -   **Nuevo:** Horas trabajadas por operario en un día específico.
        -   **Nuevo:** Distribución de horarios de llegada para analizar la puntualidad.
        -   **Nuevo:** Distribución de horarios de salida.

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

5.  **(Requerido) Crear un usuario administrador:** Para acceder al panel de administración (y poder registrar nuevos operarios), es necesario crear un usuario con el rol de `admin`. El DNI que especifique aquí será la contraseña para el login de administrador.

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
├── admin.php               # Panel de admin (login, gestión de operarios y estadísticas)
├── css/
│   ├── admin.css           # Estilos para el panel de admin
│   └── styles.css          # Estilos para la interfaz de operarios
├── index.html              # Página principal para el fichaje de operarios (facial y manual)
├── js/
│   ├── admin.js            # Lógica para el panel de admin (registro de usuarios, gráficos)
│   ├── face-api.min.js     # Librería de reconocimiento facial
│   └── script.js           # Lógica para el fichaje de operarios
├── models/                 # Modelos pre-entrenados para face-api.js
└── src/
    └── backend.php         # Endpoint PHP que maneja toda la lógica del servidor
```

## ⚙️ ¿Cómo Funciona?

### Flujo del Operario: Fichaje de Ingreso/Egreso
1.  El operario accede a `index.html` y elige si desea registrar un ingreso o un egreso.
2.  La aplicación activa la cámara y utiliza `face-api.js` para buscar una coincidencia facial contra los descriptores de los usuarios registrados en la base de datos.
3.  Si encuentra una coincidencia con una confianza suficiente, identifica al operario y envía una petición al backend para registrar el acceso (`ingreso` o `egreso`) en la tabla `accesos`.
4.  Si el reconocimiento facial falla tras unos segundos, el sistema redirige automáticamente a una pantalla para el registro manual, donde el operario puede identificarse con su código y DNI.

### Flujo del Administrador: Gestión y Estadísticas
1.  **Login de Administrador:** El administrador navega a `admin.php` e inicia sesión utilizando su código de operario y DNI (previamente configurado en la base de datos con el rol `admin`).
2.  **Registro de Nuevos Operarios:**
    -   Dentro del panel, el administrador accede a la sección de registro.
    -   Completa los datos del nuevo operario (código, nombre, DNI).
    -   Usa la cámara para capturar el rostro del operario y generar su **descriptor facial** (un array de 128 flotantes que representa unívocamente el rostro).
    -   El backend recibe estos datos y los guarda en la tabla `usuarios`.
3.  **Visualización de Gráficos:** El panel de administrador carga y muestra automáticamente los siguientes gráficos generados con `Chart.js`:
    -   **Accesos por Día:** Un gráfico de barras que compara el número de ingresos y egresos para cada día.
    -   **Tipo de Acceso:** Un gráfico de dona que muestra el porcentaje de fichajes realizados por reconocimiento facial frente a los manuales.
    -   **Horas Trabajadas:** Un gráfico de barras que desglosa las horas trabajadas por cada empleado en la jornada actual.
    -   **Distribución de Llegadas/Salidas:** Gráficos de línea que muestran a qué horas se concentran los ingresos y egresos, permitiendo analizar patrones de puntualidad y ausentismo.

