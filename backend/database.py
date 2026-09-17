import sqlite3
import os

# Definimos la ruta del archivo de la base de datos en la carpeta actual
DB_PATH = os.path.join(os.path.dirname(__file__), "comedor.db")

def inicializar_bd():
    """Crea las tablas e inserta los datos iniciales si no existen."""
    conexion = sqlite3.connect(DB_PATH)
    cursor = conexion.cursor()

    # Ejecutamos todo tu script SQL utilizando executescript
    cursor.executescript("""
    PRAGMA foreign_keys = ON;

    -- =========================================================
    -- 1. TABLAS DE CATÁLOGO (ESTRUCTURA BASE)
    -- =========================================================
    CREATE TABLE IF NOT EXISTS CURSOS (
       id_curso INTEGER PRIMARY KEY AUTOINCREMENT,
       nombre_curso TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS GRADOS (
       id_grados INTEGER PRIMARY KEY AUTOINCREMENT,
       nombre_grados TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS TIPO_IDENTIFICACION (
       id_tipo_identificacion INTEGER PRIMARY KEY AUTOINCREMENT,
       nom_tipo_identificacion TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS TIPO_DERECHO (
       id_derecho INTEGER PRIMARY KEY AUTOINCREMENT,
       nom_derecho TEXT NOT NULL,
       permite_ingreso INTEGER NOT NULL
    );

    -- =========================================================
    -- 2. TABLA PRINCIPAL DE ESTUDIANTES
    -- =========================================================
    CREATE TABLE IF NOT EXISTS ESTUDIANTES (
       doc_estudiante TEXT PRIMARY KEY,
       nom_estudiante TEXT NOT NULL,
       ape_estudiante TEXT NOT NULL,
       id_tipo_identificacion INTEGER NOT NULL,
       id_curso INTEGER NOT NULL,
       id_grados INTEGER NOT NULL,
       id_derecho INTEGER NOT NULL DEFAULT 1,
       FOREIGN KEY (id_tipo_identificacion) REFERENCES TIPO_IDENTIFICACION(id_tipo_identificacion)
           ON UPDATE CASCADE ON DELETE RESTRICT,
       FOREIGN KEY (id_curso) REFERENCES CURSOS(id_curso)
           ON UPDATE CASCADE ON DELETE RESTRICT,
       FOREIGN KEY (id_grados) REFERENCES GRADOS(id_grados)
           ON UPDATE CASCADE ON DELETE RESTRICT,
       FOREIGN KEY (id_derecho) REFERENCES TIPO_DERECHO(id_derecho)
           ON UPDATE CASCADE ON DELETE RESTRICT
    );

    -- =========================================================
    -- 3. TABLAS DE OPERACIÓN Y AUTENTICACIÓN
    -- =========================================================
    CREATE TABLE IF NOT EXISTS INGRESOS (
       doc_estudiante TEXT NOT NULL,
       fecha_ingreso TEXT NOT NULL,
       hora_ingreso TEXT NOT NULL,
       asistencia INTEGER DEFAULT 1,
       PRIMARY KEY (doc_estudiante, fecha_ingreso),
       FOREIGN KEY (doc_estudiante) REFERENCES ESTUDIANTES(doc_estudiante)
           ON UPDATE CASCADE ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS USUARIOS (
       id_usuario INTEGER PRIMARY KEY AUTOINCREMENT,
       nombre TEXT NOT NULL,
       apellido TEXT NOT NULL,
       password_hash TEXT NOT NULL,
       rol TEXT NOT NULL
    );

    -- =========================================================
    -- 4. INSERCIÓN DE DATOS INICIALES (USANDO INSERT OR IGNORE)
    -- =========================================================
    INSERT OR IGNORE INTO TIPO_DERECHO (id_derecho, nom_derecho, permite_ingreso) VALUES
    (1, 'Acceso permitido: Estudiante Activo', 1),
    (2, 'Acceso denegado: Ausente temporalmente / Incapacidad', 0),
    (3, 'Acceso denegado: Sancionado / Suspendido', 0);

    INSERT OR IGNORE INTO TIPO_IDENTIFICACION (id_tipo_identificacion, nom_tipo_identificacion) VALUES
    (1, 'CC - Cédula de Ciudadanía'),
    (2, 'TI - Tarjeta de Identidad'),
    (3, 'PPT - Permiso por Protección Temporal'),
    (4, 'RC - Registro Civil'),
    (5, 'CE - Cédula de Extranjería');

    INSERT OR IGNORE INTO GRADOS (id_grados, nombre_grados) VALUES
    (1, '6'), (2, '7'), (3, '8'), (4, '9'), (5, '10'), (6, '11');

    INSERT OR IGNORE INTO CURSOS (id_curso, nombre_curso) VALUES
    (1, '-1'), (2, '-2'), (3, '-3'), (4, '-4'), (5, '-A'), (6, '-C'), (7, '-D'), (8,'-E'); 

    INSERT OR IGNORE INTO USUARIOS (id_usuario, nombre, apellido, password_hash, rol) VALUES
    (1, 'rigo', 'wilfred', '$2b$12$/Tr5zoVfNqzOjs2gxKX3Le6JZcVpu9.lqEMZFJafs6CZlPcoP85kO', 'ADMINISTRADOR'),
    (2, 'María', 'Ortiz',  '$2b$12$/Tr5zoVfNqzOjs2gxKX3Le6JZcVpu9.lqEMZFJafs6CZlPcoP85kO', 'OPERADOR');

    INSERT OR IGNORE INTO ESTUDIANTES (doc_estudiante, nom_estudiante, ape_estudiante, id_tipo_identificacion, id_curso, id_grados, id_derecho) VALUES 
    ('1085000001', 'Carlos Andrés', 'Pérez Restrepo', 2, 5, 5, 1), 
    ('1085000002', 'Laura Sofía', 'Gómez Restrepo', 2, 8, 6, 2), 
    ('1085000003', 'Mateo Jesús', 'Ramirez Torres', 3, 5, 2, 3);
    """)

    # Guardamos los cambios y cerramos la conexión
    conexion.commit()
    conexion.close()
    print("Base de datos y tablas inicializadas correctamente.")

# Esta función nos permitirá obtener una conexión a la BD en nuestros endpoints más adelante
def obtener_conexion():
    conexion = sqlite3.connect(DB_PATH)
    # Esto permite acceder a las columnas por su nombre en lugar de índices (ej: fila['nom_estudiante'])
    conexion.row_factory = sqlite3.Row 
    return conexion