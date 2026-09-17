import csv
import io
import glob
import os
from datetime import datetime, timezone, timedelta
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from passlib.context import CryptContext
from backend.database import inicializar_bd, obtener_conexion
from typing import List

app = FastAPI(title="API Comedor Escolar V1.2")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__truncate_error=False)
inicializar_bd()

# ==========================================
# CONFIGURACIÓN DE ARCHIVOS ESTÁTICOS (FRONTEND)
# ==========================================
frontend_path = os.path.join(os.path.dirname(__file__), "../frontend")
if os.path.exists(frontend_path):
    app.mount("/static", StaticFiles(directory=frontend_path), name="static")

# ==========================================
# MODELOS DE DATOS (Pydantic)
# ==========================================
class LoginRequest(BaseModel):
    nombre: str
    password: str

class EscaneoRequest(BaseModel):
    doc_estudiante: str

class EstudianteCreateRequest(BaseModel):
    doc_estudiante: str
    id_tipo_identificacion: int
    nom_estudiante: str
    ape_estudiante: str
    id_derecho: int
    id_grados: int
    id_curso: int

class EstudianteUpdateRequest(BaseModel):
    nom_estudiante: str
    ape_estudiante: str
    id_derecho: int
    id_grados: int
    id_curso: int

class GradoCreateRequest(BaseModel):
    nombre_grados: str

class CursoCreateRequest(BaseModel):
    nombre_curso: str

class DerechoCreateRequest(BaseModel):
    nom_derecho: str
    permite_ingreso: int

class UsuarioCreateRequest(BaseModel):
    nombre: str
    apellido: str
    rol: str
    password: str

class UsuarioUpdateRequest(BaseModel):
    nombre: str
    apellido: str
    rol: str
    password: str | None = None

# ==========================================
# RUTAS / ENDPOINTS DE PÁGINAS WEB
# ==========================================
@app.get("/")
def ruta_raiz():
    posibles_rutas = [
        os.path.join(os.path.dirname(__file__), "../frontend/index.html"),
        os.path.join(os.path.dirname(__file__), "frontend/index.html"),
        "frontend/index.html",
        "../frontend/index.html"
    ]
    for ruta in posibles_rutas:
        if os.path.exists(ruta):
            return FileResponse(ruta)
    return {"mensaje": "¡Servidor del Comedor Escolar en línea y Base de Datos conectada!"}

@app.get("/login")
def ruta_login():
    return ruta_raiz()

@app.get("/admin.html")
def ruta_admin():
    posibles_rutas = [
        os.path.join(os.path.dirname(__file__), "../frontend/admin.html"),
        os.path.join(os.path.dirname(__file__), "frontend/admin.html"),
        "frontend/admin.html",
        "../frontend/admin.html"
    ]
    for ruta in posibles_rutas:
        if os.path.exists(ruta):
            return FileResponse(ruta)
    raise HTTPException(status_code=404, detail="Página de administrador no encontrada")

@app.get("/operador.html")
def ruta_operador():
    posibles_rutas = [
        os.path.join(os.path.dirname(__file__), "../frontend/operador.html"),
        os.path.join(os.path.dirname(__file__), "frontend/operador.html"),
        "frontend/operador.html",
        "../frontend/operador.html"
    ]
    for ruta in posibles_rutas:
        if os.path.exists(ruta):
            return FileResponse(ruta)
    raise HTTPException(status_code=404, detail="Página de operador no encontrada")

# ==========================================
# ENDPOINTS DE API (BACKEND)
# ==========================================
@app.post("/api/login")
def iniciar_sesion(datos: LoginRequest):
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    cursor.execute("SELECT * FROM USUARIOS WHERE nombre = ?", (datos.nombre,))
    usuario = cursor.fetchone()
    conexion.close()
    
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
        
    password_segura = datos.password.encode('utf-8')[:72].decode('utf-8', errors='ignore')
    if not pwd_context.verify(password_segura, usuario["password_hash"]):
        raise HTTPException(status_code=401, detail="Contraseña incorrecta")
        
    return {
        "mensaje": "Login exitoso",
        "id_usuario": usuario["id_usuario"],
        "nombre": usuario["nombre"],
        "apellido": usuario["apellido"],
        "rol": usuario["rol"]
    }

@app.post("/api/escanear")
def escanear_qr(datos: EscaneoRequest):
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    
    colombia_tz = timezone(timedelta(hours=-5))
    ahora_col = datetime.now(colombia_tz)
    hoy = ahora_col.strftime("%Y-%m-%d")
    hora = ahora_col.strftime("%H:%M:%S")

    cursor.execute("""
        SELECT e.doc_estudiante, e.nom_estudiante, e.ape_estudiante, 
               g.nombre_grados, c.nombre_curso, 
               d.nom_derecho, d.permite_ingreso
        FROM ESTUDIANTES e
        JOIN TIPO_DERECHO d ON e.id_derecho = d.id_derecho
        JOIN GRADOS g ON e.id_grados = g.id_grados
        JOIN CURSOS c ON e.id_curso = c.id_curso
        WHERE e.doc_estudiante = ?
    """, (datos.doc_estudiante,))
    estudiante = cursor.fetchone()

    if not estudiante:
        conexion.close()
        raise HTTPException(status_code=404, detail="Documento no encontrado en el sistema.")

    datos_est = dict(estudiante)

    cursor.execute("SELECT * FROM INGRESOS WHERE doc_estudiante = ? AND fecha_ingreso = ?", 
                   (datos.doc_estudiante, hoy))
    if cursor.fetchone():
        conexion.close()
        return {
            "estado": "advertencia",
            "mensaje": f"El estudiante {datos_est['nom_estudiante']} ya desayunó hoy.",
            "datos": datos_est
        }

    if datos_est["permite_ingreso"] == 0:
        conexion.close()
        return {
            "estado": "denegado",
            "mensaje": datos_est["nom_derecho"],
            "datos": datos_est
        }

    cursor.execute("""
        INSERT INTO INGRESOS (doc_estudiante, fecha_ingreso, hora_ingreso, asistencia)
        VALUES (?, ?, ?, 1)
    """, (datos.doc_estudiante, hoy, hora))
    conexion.commit() 
    conexion.close()

    return {
        "estado": "aprobado",
        "mensaje": "Acceso Aprobado",
        "datos": datos_est
    }

@app.get("/api/reporte-dia")
def obtener_reporte_dia():
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    
    colombia_tz = timezone(timedelta(hours=-5))
    hoy = datetime.now(colombia_tz).strftime("%Y-%m-%d")
    
    cursor.execute("""
        SELECT i.fecha_ingreso, i.hora_ingreso, 
               e.doc_estudiante, e.nom_estudiante, e.ape_estudiante,
               g.nombre_grados, c.nombre_curso
        FROM INGRESOS i
        JOIN ESTUDIANTES e ON i.doc_estudiante = e.doc_estudiante
        JOIN GRADOS g ON e.id_grados = g.id_grados
        JOIN CURSOS c ON e.id_curso = c.id_curso
        WHERE i.fecha_ingreso = ?
        ORDER BY i.hora_ingreso DESC
    """, (hoy,))
    registros = [dict(row) for row in cursor.fetchall()]
    conexion.close()
    return {
        "fecha": hoy,
        "total_atendidos": len(registros),
        "registros": registros
    }

@app.get("/api/estudiantes")
def listar_estudiantes():
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    cursor.execute("""
        SELECT e.doc_estudiante, e.nom_estudiante, e.ape_estudiante, 
               g.nombre_grados, c.nombre_curso, d.nom_derecho, e.id_derecho, e.id_grados, e.id_curso, d.permite_ingreso
        FROM ESTUDIANTES e
        JOIN TIPO_DERECHO d ON e.id_derecho = d.id_derecho
        JOIN GRADOS g ON e.id_grados = g.id_grados
        JOIN CURSOS c ON e.id_curso = c.id_curso
        ORDER BY e.ape_estudiante ASC
    """)
    estudiantes = [dict(row) for row in cursor.fetchall()]
    conexion.close()
    return estudiantes

@app.post("/api/estudiantes")
def crear_estudiante(datos: EstudianteCreateRequest):
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    try:
        cursor.execute("""
            INSERT INTO ESTUDIANTES (doc_estudiante, id_tipo_identificacion, nom_estudiante, ape_estudiante, id_derecho, id_grados, id_curso)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (datos.doc_estudiante, datos.id_tipo_identificacion, datos.nom_estudiante, datos.ape_estudiante, datos.id_derecho, datos.id_grados, datos.id_curso))
        conexion.commit()
    except Exception as e:
        conexion.close()
        raise HTTPException(status_code=400, detail=f"Error al registrar estudiante: {str(e)}")
    conexion.close()
    return {"mensaje": "Estudiante registrado exitosamente"}

@app.post("/api/estudiantes/importar-csv")
async def importar_estudiantes_csv(file: UploadFile = File(...)):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="El archivo debe tener formato .csv")
    
    contenido = await file.read()
    decodificado = contenido.decode('utf-8', errors='ignore')
    lector = csv.DictReader(io.StringIO(decodificado))
    
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    
    importados = 0
    errores = []
    
    for fila in lector:
        try:
            doc = fila.get("doc_estudiante") or fila.get("documento")
            tipo_id = fila.get("id_tipo_identificacion") or fila.get("tipo_id")
            nombres = fila.get("nom_estudiante") or fila.get("nombres")
            apellidos = fila.get("ape_estudiante") or fila.get("apellidos")
            derecho = fila.get("id_derecho") or fila.get("derecho")
            grado = fila.get("id_grados") or fila.get("grado")
            curso = fila.get("id_curso") or fila.get("curso")
            
            if not doc or not nombres or not apellidos or not tipo_id or not derecho or not grado or not curso:
                continue
            
            cursor.execute("""
                INSERT OR IGNORE INTO ESTUDIANTES (doc_estudiante, id_tipo_identificacion, nom_estudiante, ape_estudiante, id_derecho, id_grados, id_curso)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (doc.strip(), int(tipo_id), nombres.strip(), apellidos.strip(), int(derecho), int(grado), int(curso)))
            
            if cursor.rowcount > 0:
                importados += 1
        except Exception as e:
            errores.append(f"Doc {fila.get('doc_estudiante', 'Desconocido')}: {str(e)}")
            
    conexion.commit()
    conexion.close()
    return {
        "mensaje": f"Importación exitosa. Se registraron {importados} estudiantes.",
        "errores": errores
    }

@app.put("/api/estudiantes/{doc_estudiante}")
def actualizar_estudiante(doc_estudiante: str, datos: EstudianteUpdateRequest):
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    cursor.execute("""
        UPDATE ESTUDIANTES 
        SET nom_estudiante = ?, ape_estudiante = ?, id_derecho = ?, id_grados = ?, id_curso = ?
        WHERE doc_estudiante = ?
    """, (datos.nom_estudiante, datos.ape_estudiante, datos.id_derecho, datos.id_grados, datos.id_curso, doc_estudiante))
    conexion.commit()
    conexion.close()
    return {"mensaje": "Estudiante actualizado exitosamente"}

@app.delete("/api/estudiantes/{doc_estudiante}")
def eliminar_estudiante(doc_estudiante: str):
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    cursor.execute("DELETE FROM ESTUDIANTES WHERE doc_estudiante = ?", (doc_estudiante,))
    conexion.commit()
    conexion.close()
    return {"mensaje": "Estudiante eliminado exitosamente"}

@app.get("/api/auxiliares")
def obtener_auxiliares():
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    cursor.execute("SELECT * FROM TIPO_DERECHO")
    derechos = [dict(row) for row in cursor.fetchall()]
    cursor.execute("SELECT * FROM GRADOS")
    grados = [dict(row) for row in cursor.fetchall()]
    cursor.execute("SELECT * FROM CURSOS")
    cursos = [dict(row) for row in cursor.fetchall()]
    cursor.execute("SELECT * FROM TIPO_IDENTIFICACION")
    tipos_id = [dict(row) for row in cursor.fetchall()]
    conexion.close()
    return {"derechos": derechos, "grados": grados, "cursos": cursos, "tipos_id": tipos_id}

@app.get("/api/grados")
def listar_grados():
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    cursor.execute("SELECT * FROM GRADOS")
    grados = [dict(row) for row in cursor.fetchall()]
    conexion.close()
    return grados

@app.post("/api/grados")
def crear_grado(datos: GradoCreateRequest):
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    try:
        cursor.execute("INSERT INTO GRADOS (nombre_grados) VALUES (?)", (datos.nombre_grados,))
        conexion.commit()
    except Exception as e:
        conexion.close()
        raise HTTPException(status_code=400, detail=f"Error al registrar grado: {str(e)}")
    conexion.close()
    return {"mensaje": "Grado registrado exitosamente"}

@app.delete("/api/grados/{id_grados}")
def eliminar_grado(id_grados: int):
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    cursor.execute("DELETE FROM GRADOS WHERE id_grados = ?", (id_grados,))
    conexion.commit()
    conexion.close()
    return {"mensaje": "Grado eliminado exitosamente"}

@app.post("/api/cursos")
def crear_curso(datos: CursoCreateRequest):
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    try:
        cursor.execute("INSERT INTO CURSOS (nombre_curso) VALUES (?)", (datos.nombre_curso,))
        conexion.commit()
    except Exception as e:
        conexion.close()
        raise HTTPException(status_code=400, detail=f"Error al registrar curso: {str(e)}")
    conexion.close()
    return {"mensaje": "Curso registrado exitosamente"}

@app.delete("/api/cursos/{id_curso}")
def eliminar_curso(id_curso: int):
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    cursor.execute("DELETE FROM CURSOS WHERE id_curso = ?", (id_curso,))
    conexion.commit()
    conexion.close()
    return {"mensaje": "Curso eliminado exitosamente"}

@app.get("/api/derechos")
def listar_derechos():
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    cursor.execute("SELECT * FROM TIPO_DERECHO")
    derechos = [dict(row) for row in cursor.fetchall()]
    conexion.close()
    return derechos

@app.post("/api/derechos")
def crear_derecho(datos: DerechoCreateRequest):
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    try:
        cursor.execute("INSERT INTO TIPO_DERECHO (nom_derecho, permite_ingreso) VALUES (?, ?)", 
                       (datos.nom_derecho, datos.permite_ingreso))
        conexion.commit()
    except Exception as e:
        conexion.close()
        raise HTTPException(status_code=400, detail=f"Error al registrar derecho: {str(e)}")
    conexion.close()
    return {"mensaje": "Derecho registrado exitosamente"}

@app.delete("/api/derechos/{id_derecho}")
def eliminar_derecho(id_derecho: int):
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    cursor.execute("DELETE FROM TIPO_DERECHO WHERE id_derecho = ?", (id_derecho,))
    conexion.commit()
    conexion.close()
    return {"mensaje": "Derecho eliminado exitosamente"}

@app.get("/api/usuarios")
def listar_usuarios():
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    cursor.execute("SELECT id_usuario, nombre, apellido, rol FROM USUARIOS")
    usuarios = [dict(row) for row in cursor.fetchall()]
    conexion.close()
    return usuarios

@app.post("/api/usuarios")
def crear_usuario(datos: UsuarioCreateRequest):
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    try:
        password_segura = datos.password.encode('utf-8')[:72].decode('utf-8', errors='ignore')
        password_hash = pwd_context.hash(password_segura)
        cursor.execute("INSERT INTO USUARIOS (nombre, apellido, rol, password_hash) VALUES (?, ?, ?, ?)", 
                       (datos.nombre, datos.apellido, datos.rol, password_hash))
        conexion.commit()
    except Exception as e:
        conexion.close()
        raise HTTPException(status_code=400, detail=f"Error al registrar usuario: {str(e)}")
    conexion.close()
    return {"mensaje": "Usuario registrado exitosamente"}

@app.put("/api/usuarios/{id_usuario}")
def actualizar_usuario(id_usuario: int, datos: UsuarioUpdateRequest):
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    try:
        if datos.password and datos.password.strip():
            password_segura = datos.password.encode('utf-8')[:72].decode('utf-8', errors='ignore')
            password_hash = pwd_context.hash(password_segura)
            cursor.execute("UPDATE USUARIOS SET nombre = ?, apellido = ?, rol = ?, password_hash = ? WHERE id_usuario = ?", 
                           (datos.nombre, datos.apellido, datos.rol, password_hash, id_usuario))
        else:
            cursor.execute("UPDATE USUARIOS SET nombre = ?, apellido = ?, rol = ? WHERE id_usuario = ?", 
                           (datos.nombre, datos.apellido, datos.rol, id_usuario))
        conexion.commit()
    except Exception as e:
        conexion.close()
        raise HTTPException(status_code=400, detail=f"Error al actualizar usuario: {str(e)}")
    conexion.close()
    return {"mensaje": "Usuario actualizado exitosamente"}

@app.delete("/api/usuarios/{id_usuario}")
def eliminar_usuario(id_usuario: int):
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    cursor.execute("DELETE FROM USUARIOS WHERE id_usuario = ?", (id_usuario,))
    conexion.commit()
    conexion.close()
    return {"mensaje": "Usuario eliminado exitosamente"}

@app.get("/api/reportes/asistencias")
def reporte_asistencias(fecha_inicio: str, fecha_fin: str):
    try:
        conexion = obtener_conexion()
        cursor = conexion.cursor()
        cursor.execute("""
            SELECT i.fecha_ingreso, i.hora_ingreso, 
                   t.nom_tipo_identificacion, e.doc_estudiante, 
                   e.nom_estudiante, e.ape_estudiante,
                   c.nombre_curso, g.nombre_grados
            FROM INGRESOS i
            JOIN ESTUDIANTES e ON i.doc_estudiante = e.doc_estudiante
            JOIN TIPO_IDENTIFICACION t ON e.id_tipo_identificacion = t.id_tipo_identificacion
            JOIN GRADOS g ON e.id_grados = g.id_grados
            JOIN CURSOS c ON e.id_curso = c.id_curso
            WHERE i.fecha_ingreso BETWEEN ? AND ?
            ORDER BY i.fecha_ingreso DESC, i.hora_ingreso DESC
        """, (fecha_inicio, fecha_fin))
        registros = [dict(row) for row in cursor.fetchall()]
        conexion.close()
        return {"total": len(registros), "registros": registros}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error en asistencias: {str(e)}")

@app.get("/api/reportes/inasistencias")
def reporte_inasistencias(fecha_inicio: str, fecha_fin: str):
    try:
        conexion = obtener_conexion()
        cursor = conexion.cursor()
        cursor.execute("""
            SELECT t.nom_tipo_identificacion, e.doc_estudiante, 
                   e.nom_estudiante, e.ape_estudiante,
                   c.nombre_curso, g.nombre_grados, d.nom_derecho
            FROM ESTUDIANTES e
            JOIN TIPO_DERECHO d ON e.id_derecho = d.id_derecho
            JOIN TIPO_IDENTIFICACION t ON e.id_tipo_identificacion = t.id_tipo_identificacion
            JOIN GRADOS g ON e.id_grados = g.id_grados
            JOIN CURSOS c ON e.id_curso = c.id_curso
            WHERE d.permite_ingreso = 1
              AND e.doc_estudiante NOT IN (
                  SELECT DISTINCT doc_estudiante FROM INGRESOS 
                  WHERE fecha_ingreso BETWEEN ? AND ?
              )
            ORDER BY g.nombre_grados, c.nombre_curso, e.ape_estudiante
        """, (fecha_inicio, fecha_fin))
        registros = [dict(row) for row in cursor.fetchall()]
        conexion.close()
        return {"total": len(registros), "registros": registros}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error en inasistencias: {str(e)}")

@app.get("/api/reportes/dashboard")
def reporte_dashboard(fecha_inicio: str, fecha_fin: str):
    try:
        conexion = obtener_conexion()
        cursor = conexion.cursor()
        
        cursor.execute("""
            SELECT g.nombre_grados, c.nombre_curso, COUNT(*) as cantidad
            FROM INGRESOS i
            JOIN ESTUDIANTES e ON i.doc_estudiante = e.doc_estudiante
            JOIN GRADOS g ON e.id_grados = g.id_grados
            JOIN CURSOS c ON e.id_curso = c.id_curso
            WHERE i.fecha_ingreso BETWEEN ? AND ?
            GROUP BY g.id_grados, c.id_curso
            ORDER BY g.nombre_grados, c.nombre_curso
        """, (fecha_inicio, fecha_fin))
        asistencias = [dict(row) for row in cursor.fetchall()]

        cursor.execute("""
            SELECT g.nombre_grados, c.nombre_curso, COUNT(e.doc_estudiante) as cantidad
            FROM ESTUDIANTES e
            JOIN TIPO_DERECHO d ON e.id_derecho = d.id_derecho
            JOIN GRADOS g ON e.id_grados = g.id_grados
            JOIN CURSOS c ON e.id_curso = c.id_curso
            WHERE d.permite_ingreso = 1
              AND e.doc_estudiante NOT IN (
                  SELECT DISTINCT doc_estudiante FROM INGRESOS 
                  WHERE fecha_ingreso BETWEEN ? AND ?
              )
            GROUP BY g.id_grados, c.id_curso
            ORDER BY g.nombre_grados, c.nombre_curso
        """, (fecha_inicio, fecha_fin))
        inasistencias = [dict(row) for row in cursor.fetchall()]
        conexion.close()
        return {
            "asistencias_curso": asistencias,
            "inasistencias_curso": inasistencias
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error en dashboard: {str(e)}")

@app.get("/api/limpieza/stats")
def estadisticas_limpieza():
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    cursor.execute("SELECT COUNT(*) as total FROM INGRESOS")
    total_ingresos = cursor.fetchone()["total"]
    cursor.execute("SELECT MIN(fecha_ingreso) as primera_fecha, MAX(fecha_ingreso) as ultima_fecha FROM INGRESOS")
    rango = cursor.fetchone()
    conexion.close()
    return {
        "total_ingresos": total_ingresos,
        "primera_fecha": rango["primera_fecha"] if rango and rango["primera_fecha"] else "Sin registros",
        "ultima_fecha": rango["ultima_fecha"] if rango and rango["ultima_fecha"] else "Sin registros"
    }

@app.delete("/api/limpieza/ingresos")
def limpiar_ingresos(fecha_limite: str | None = None, limpiar_todo: bool = False):
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    try:
        if limpiar_todo:
            cursor.execute("DELETE FROM INGRESOS")
        elif fecha_limite:
            cursor.execute("DELETE FROM INGRESOS WHERE fecha_ingreso < ?", (fecha_limite,))
        else:
            raise HTTPException(status_code=400, detail="Debe especificar una fecha límite o seleccionar limpiar todo.")
        
        conexion.commit()
        eliminados = cursor.rowcount
    except Exception as e:
        conexion.close()
        raise HTTPException(status_code=400, detail=f"Error al depurar datos: {str(e)}")
    
    conexion.close()
    return {"mensaje": f"Limpieza completada con éxito. Se eliminaron {eliminados} registros de asistencia."}

@app.get("/api/backup")
def descargar_copia_seguridad():
    archivos_db = glob.glob("**/*.db", recursive=True) + glob.glob("*.db")
    db_path = None
    
    for ruta in archivos_db:
        if os.path.exists(ruta) and os.path.getsize(ruta) > 0:
            db_path = ruta
            break
            
    if not db_path:
        base_dir = os.path.dirname(os.path.abspath(__file__))
        ruta_alternativa = os.path.join(base_dir, "database.db")
        if os.path.exists(ruta_alternativa):
            db_path = ruta_alternativa
            
    if not db_path or not os.path.exists(db_path):
        raise HTTPException(status_code=404, detail="Archivo de base de datos no encontrado en el servidor.")
    
    colombia_tz = timezone(timedelta(hours=-5))
    nombre_archivo = f"backup_comedor_{datetime.now(colombia_tz).strftime('%Y-%m-%d_%H-%M-%S')}.db"
    return FileResponse(path=db_path, filename=nombre_archivo, media_type="application/octet-stream")

@app.put("/api/grados/{id_grados}")
def actualizar_grado(id_grados: int, datos: GradoCreateRequest):
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    try:
        cursor.execute("UPDATE GRADOS SET nombre_grados = ? WHERE id_grados = ?", (datos.nombre_grados, id_grados))
        conexion.commit()
    except Exception as e:
        conexion.close()
        raise HTTPException(status_code=400, detail=f"Error al actualizar grado: {str(e)}")
    conexion.close()
    return {"mensaje": "Grado actualizado exitosamente"}

@app.put("/api/cursos/{id_curso}")
def actualizar_curso(id_curso: int, datos: CursoCreateRequest):
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    try:
        cursor.execute("UPDATE CURSOS SET nombre_curso = ? WHERE id_curso = ?", (datos.nombre_curso, id_curso))
        conexion.commit()
    except Exception as e:
        conexion.close()
        raise HTTPException(status_code=400, detail=f"Error al actualizar curso: {str(e)}")
    conexion.close()
    return {"mensaje": "Curso actualizado exitosamente"}

class ActualizacionMasiva(BaseModel):
    documentos: List[str]
    id_nuevo_derecho: int

@app.post("/api/estudiantes/actualizar-estado-masivo")
def actualizar_estado_masivo(payload: ActualizacionMasiva):
    conexion = obtener_conexion()
    cursor = conexion.cursor()
    try:
        docs = payload.documentos
        id_nuevo_derecho = payload.id_nuevo_derecho
        
        if not docs:
            raise HTTPException(status_code=400, detail="No se seleccionaron estudiantes.")
            
        placeholders = ','.join('?' * len(docs))
        cursor.execute(
            f"UPDATE ESTUDIANTES SET id_derecho = ? WHERE doc_estudiante IN ({placeholders})", 
            [id_nuevo_derecho] + docs
        )
        conexion.commit()
        return {"mensaje": f"Se actualizaron {cursor.rowcount} estudiantes exitosamente."}
    except Exception as e:
        conexion.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conexion.close()