const express = require('express');
const sqlite = require('sqlite');
const sqlite3 = require('sqlite3');
const cors = require('cors');

const app = express();
const PORT = 3000;

let db;

// Middleware
app.use(cors());
app.use(express.json()); // Para parsear application/json
app.use(express.static('public')); // Para servir los archivos estáticos del frontend

// --- API Endpoints ---

// Endpoint para obtener todos los usuarios registrados
app.get('/users', async (req, res) => {
    try {
        const users = await db.all('SELECT opCode, name, dni, descriptor FROM employees');
        // El descriptor se guarda como TEXT (JSON string), lo parseamos antes de enviar
        const parsedUsers = users.map(user => ({
            ...user,
            descriptor: JSON.parse(user.descriptor)
        }));
        res.status(200).json(parsedUsers);
    } catch (error) {
        console.error('Error al obtener usuarios:', error);
        res.status(500).json({ message: 'Error en el servidor al obtener usuarios.' });
    }
});

// Endpoint para registrar un nuevo empleado
app.post('/register', async (req, res) => {
    const { opCode, name, dni, descriptor } = req.body;

    // Validación simple
    if (!opCode || !name || !dni || !descriptor) {
        return res.status(400).json({ message: 'Todos los campos son requeridos.' });
    }

    try {
        // Verificar si ya existe el opCode o DNI para evitar duplicados
        const existingUser = await db.get('SELECT * FROM employees WHERE opCode = ? OR dni = ?', [opCode, dni]);
        if (existingUser) {
            return res.status(409).json({ message: 'El código de operario o DNI ya está registrado.' });
        }

        // El descriptor (Float32Array) se convierte a un array normal en el frontend
        // Aquí lo guardamos como un string JSON
        const descriptorJson = JSON.stringify(descriptor);

        await db.run('INSERT INTO employees (opCode, name, dni, descriptor) VALUES (?, ?, ?, ?)', [opCode, name, dni, descriptorJson]);

        res.status(201).json({ message: `Usuario ${name} registrado exitosamente.` });

    } catch (error) {
        console.error('Error al registrar usuario:', error);
        res.status(500).json({ message: 'Error en el servidor al registrar el usuario.' });
    }
});


// --- Inicialización del Servidor y la Base de Datos ---
async function initialize() {
    try {
        // Abrir la conexión a la base de datos
        db = await sqlite.open({
            filename: './database.sqlite',
            driver: sqlite3.Database
        });

        console.log('Conectado a la base de datos SQLite.');

        // Crear la tabla de empleados si no existe
        await db.exec(`
            CREATE TABLE IF NOT EXISTS employees (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                opCode TEXT NOT NULL UNIQUE,
                name TEXT NOT NULL,
                dni TEXT NOT NULL UNIQUE,
                descriptor TEXT NOT NULL
            )
        `);

        console.log('Tabla "employees" asegurada.');

        // Iniciar el servidor
        app.listen(PORT, () => {
            console.log(`Servidor corriendo en http://localhost:${PORT}`);
        });

    } catch (error) {
        console.error('Error al inicializar el servidor:', error);
    }
}

initialize();
