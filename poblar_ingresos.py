import sqlite3
from datetime import datetime, timedelta
import random
import os

def poblar_ingresos():
    # Buscar automáticamente el archivo de la base de datos en la ruta del backend
    rutas_posibles = ["backend/database.db", "database.db", "backend/comedor.db", "comedor.db"]
    db_path = None
    for ruta in rutas_posibles:
        if os.path.exists(ruta):
            db_path = ruta
            break
            
    if not db_path:
        db_path = "backend/database.db"
        
    print(f"📂 Conectando a la base de datos en: {db_path}")
    conexion = sqlite3.connect(db_path)
    conexion.row_factory = sqlite3.Row
    cursor = conexion.cursor()

    # 1. Obtener todos los documentos de estudiantes existentes
    cursor.execute("SELECT doc_estudiante FROM ESTUDIANTES")
    estudiantes = [row["doc_estudiante"] for row in cursor.fetchall()]

    if not estudiantes:
        print("❌ Error: No hay estudiantes registrados en esta base de datos.")
        conexion.close()
        return

    print(f"✅ Se encontraron {len(estudiantes)} estudiantes en el sistema.")

    # 2. Configurar el período histórico (Ej: 365 días atrás = 1 año completo de historial)
    # Puedes cambiar este valor a 180 (6 meses), 730 (2 años), etc.
    dias_a_simular = 365 
    hoy = datetime.now()
    registros_creados = 0

    print(f"⏳ Generando datos históricos desde hace {dias_a_simular} días hasta hoy (omitiendo fines de semana)...")

    for dias_atras in range(dias_a_simular, -1, -1):
        fecha_dt = hoy - timedelta(days=dias_atras)
        
        # Omitir sábados (5) y domingos (6) para mayor realismo escolar
        if fecha_dt.weekday() >= 5:
            continue
            
        fecha_actual = fecha_dt.strftime("%Y-%m-%d")
        
        # Simular que un 70% a 85% de los estudiantes asisten cada día hábil
        porcentaje_asistencia = random.uniform(0.70, 0.85)
        asistentes_del_dia = random.sample(estudiantes, k=int(len(estudiantes) * porcentaje_asistencia))

        for doc in asistentes_del_dia:
            # Horas aleatorias de desayuno (entre 06:00 AM y 08:30 AM)
            hora_aleatoria = f"{random.randint(6, 8):02d}:{random.randint(0, 59):02d}:{random.randint(0, 59):02d}"
            
            try:
                cursor.execute("""
                    INSERT OR IGNORE INTO INGRESOS (doc_estudiante, fecha_ingreso, hora_ingreso, asistencia)
                    VALUES (?, ?, ?, 1)
                """, (doc, fecha_actual, hora_aleatoria))
                
                if cursor.rowcount > 0:
                    registros_creados += 1
            except Exception as e:
                print(f"Error al insertar para {doc}: {e}")

    conexion.commit()
    conexion.close()
    print(f"🎉 ¡Proceso finalizado! Se insertaron {registros_creados} nuevos registros históricos de asistencia.")

if __name__ == "__main__":
    poblar_ingresos()