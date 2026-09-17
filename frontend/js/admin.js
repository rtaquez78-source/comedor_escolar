document.addEventListener('DOMContentLoaded', () => {
    // 1. Proteger la ruta (Solo administradores)
    const rol = localStorage.getItem('usuarioRol');
    const nombre = localStorage.getItem('usuarioNombre');

    if (rol !== 'ADMINISTRADOR') {
        alert("Acceso denegado. Serás redirigido al Login.");
        window.location.href = '/'; // CORREGIDO A LA RAÍZ
        return;
    }
    
    const displayElement = document.getElementById('nombreUsuarioDisplay');
    if (displayElement) {
        displayElement.textContent = `Bienvenido, ${nombre}`;
    }

    // Lógica para cerrar sesión
    const btnCerrar = document.getElementById('btn-cerrar-sesion');
    if (btnCerrar) {
        btnCerrar.addEventListener('click', () => {
            localStorage.clear();
            window.location.href = '/'; // CORREGIDO A LA RAÍZ
        });
    }

    // ==========================================
    // GENERADOR DE SONIDOS ROBUSTO (Web Audio API)
    // ==========================================
    let audioCtx = null;

    document.addEventListener('click', () => {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
    }, { once: true });

    function reproducirSonido(tipo) {
        try {
            if (!audioCtx) {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (audioCtx.state === 'suspended') {
                audioCtx.resume();
            }

            const osc = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();

            osc.connect(gainNode);
            gainNode.connect(audioCtx.destination);

            if (tipo === 'aprobado') {
                osc.type = 'sine';
                osc.frequency.setValueAtTime(600, audioCtx.currentTime);
                osc.frequency.setValueAtTime(900, audioCtx.currentTime + 0.1);
                gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
                osc.start();
                osc.stop(audioCtx.currentTime + 0.3);
            } 
            else if (tipo === 'denegado') {
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(250, audioCtx.currentTime);
                gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
                osc.start();
                osc.stop(audioCtx.currentTime + 0.4);
            }
            else if (tipo === 'advertencia') {
                osc.type = 'square';
                osc.frequency.setValueAtTime(400, audioCtx.currentTime);
                gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
                osc.start();
                osc.stop(audioCtx.currentTime + 0.25);
            }
        } catch (e) {
            console.error("Error al reproducir sonido:", e);
        }
    }

    // ==========================================
    // MÓDULO 1: REPORTE DEL DÍA
    // ==========================================
    async function cargarReporteDelDia() {
        const titulo = document.getElementById('titulo-modulo');
        const contenedor = document.getElementById('contenedor-modulo');
        
        document.querySelectorAll('#modalNuevoEstudiante, #modalEditarEstudiante, #modalNuevoUsuario, #modalEditarUsuario, #modalImportarCsv, #modalEditarGrado, #modalEditarCurso').forEach(m => m.remove());

        if (titulo) titulo.textContent = "Reporte del Día (En Tiempo Real)";
        if (contenedor) contenedor.innerHTML = `<p class="text-muted">Cargando registros de desayunos de hoy...</p>`;

        try {
            const respuesta = await fetch('/api/reporte-dia');
            if (!respuesta.ok) throw new Error("No se pudo obtener el reporte");

            const datos = await respuesta.json();

            let html = `
                <div class="row mb-4">
                    <div class="col-md-4">
                        <div class="card bg-primary text-white p-3 shadow-sm">
                            <h5>Total Desayunos Entregados</h5>
                            <h2 class="fw-bold">${datos.total_atendidos}</h2>
                            <small>Fecha: ${datos.fecha}</small>
                        </div>
                    </div>
                </div>

                <div class="table-responsive">
                    <table class="table table-striped table-hover align-middle">
                        <thead class="table-dark">
                            <tr>
                                <th>Fecha</th>
                                <th>Hora</th>
                                <th>Documento</th>
                                <th>Nombres y Apellidos</th>
                                <th>Grado y Curso</th>
                            </tr>
                        </thead>
                        <tbody>
            `;

            if (datos.registros.length === 0) {
                html += `<tr><td colspan="5" class="text-center text-muted py-4">Aún no se registran ingresos al comedor el día de hoy.</td></tr>`;
            } else {
                datos.registros.forEach(reg => {
                    html += `
                        <tr>
                            <td>${reg.fecha_ingreso}</td>
                            <td><span class="badge bg-success">${reg.hora_ingreso}</span></td>
                            <td>${reg.doc_estudiante}</td>
                            <td>${reg.nom_estudiante} ${reg.ape_estudiante}</td>
                            <td>${reg.nombre_grados} ${reg.nombre_curso}</td>
                        </tr>
                    `;
                });
            }

            html += `</tbody></table></div>`;
            if (contenedor) contenedor.innerHTML = html;

        } catch (error) {
            console.error(error);
            if (contenedor) contenedor.innerHTML = `<div class="alert alert-danger">Error al cargar los datos del servidor. Verifica la conexión.</div>`;
        }
    }

    // ==========================================
    // MÓDULO 2: GESTIÓN DE ESTUDIANTES
    // ==========================================
    async function cargarGestionEstudiantes() {
        const titulo = document.getElementById('titulo-modulo');
        const contenedor = document.getElementById('contenedor-modulo');
        
        if (titulo) titulo.textContent = "Gestión de Estudiantes";
        if (contenedor) contenedor.innerHTML = `<p class="text-muted">Cargando listado de estudiantes...</p>`;

        try {
            const [resEst, resAux] = await Promise.all([
                fetch('/api/estudiantes'),
                fetch('/api/auxiliares')
            ]);
            
            window.listaEstudiantesGlobal = await resEst.json();
            const auxiliares = await resAux.json();

            let html = `
                <div class="d-flex justify-content-between align-items-center mb-4">
                    <h5>Padrón de Estudiantes Matriculados</h5>
                    <div>
                        <button class="btn btn-info text-white me-2" onclick="descargarQRsMasivos()" title="Descargar QRs Filtrados en ZIP">
                            📥 Descargar QRs (ZIP)
                        </button>
                        <button class="btn btn-success me-2" data-bs-toggle="modal" data-bs-target="#modalImportarCsv">
                            📁 Carga Masiva (CSV)
                        </button>
                        <button class="btn btn-primary" data-bs-toggle="modal" data-bs-target="#modalNuevoEstudiante">
                            + Registrar Estudiante
                        </button>
                    </div>
                </div>

                <div class="card shadow-sm p-3 mb-4">
                    <h6 class="text-primary mb-3">🔍 Filtros de Búsqueda y Filtrado</h6>
                    <div class="row g-3">
                        <div class="col-md-4">
                            <input type="text" id="filtroTexto" class="form-control" placeholder="Buscar por documento, nombre o apellido..." oninput="aplicarFiltrosEstudiantes()">
                        </div>
                        <div class="col-md-3">
                            <select id="filtroGrado" class="form-select" onchange="aplicarFiltrosEstudiantes()">
                                <option value="">Todos los Grados</option>
                                ${auxiliares.grados.map(g => `<option value="${g.id_grados}">${g.nombre_grados}</option>`).join('')}
                            </select>
                        </div>
                        <div class="col-md-3">
                            <select id="filtroCurso" class="form-select" onchange="aplicarFiltrosEstudiantes()">
                                <option value="">Todos los Cursos</option>
                                ${auxiliares.cursos.map(c => `<option value="${c.id_curso}">${c.nombre_curso}</option>`).join('')}
                            </select>
                        </div>
                        <div class="col-md-2">
                            <button class="btn btn-outline-secondary w-100" onclick="limpiarFiltrosEstudiantes()">🔄 Limpiar</button>
                        </div>
                    </div>
                </div>

                <div class="table-responsive">
                    <table class="table table-striped table-hover align-middle">
                        <thead class="table-dark">
                            <tr>
                                <th>Documento</th>
                                <th>Apellidos y Nombres</th>
                                <th>Grado y Curso</th>
                                <th>Estado</th>
                                <th class="text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody id="tablaEstudiantesBody">
                        </tbody>
                    </table>
                </div>
            `;

            if (contenedor) contenedor.innerHTML = html;
            renderizarTablaEstudiantes(window.listaEstudiantesGlobal);

            document.querySelectorAll('#modalNuevoEstudiante, #modalEditarEstudiante, #modalNuevoUsuario, #modalEditarUsuario, #modalImportarCsv, #modalEditarGrado, #modalEditarCurso').forEach(m => m.remove());

            const modalesHtml = `
                <div class="modal fade" id="modalNuevoEstudiante" tabindex="-1" aria-hidden="true">
                    <div class="modal-dialog">
                        <div class="modal-content">
                            <div class="modal-header bg-primary text-white">
                                <h5 class="modal-title">Registrar Nuevo Estudiante</h5>
                                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                            </div>
                            <div class="modal-body">
                                <div>
                                    <div class="mb-3">
                                        <label class="form-label">Tipo de Identificación</label>
                                        <select class="form-select" id="selectTipoId" required>
                                            <option value="">Seleccione...</option>
                                            ${auxiliares.tipos_id.map(t => `<option value="${t.id_tipo_identificacion}">${t.nom_tipo_identificacion}</option>`).join('')}
                                        </select>
                                    </div>
                                    <div class="mb-3"><label class="form-label">Documento</label><input type="text" class="form-control" id="nuevoDoc" required></div>
                                    <div class="mb-3"><label class="form-label">Nombres</label><input type="text" class="form-control" id="nuevoNombre" required></div>
                                    <div class="mb-3"><label class="form-label">Apellidos</label><input type="text" class="form-control" id="nuevoApellido" required></div>
                                    <div class="mb-3"><label class="form-label">Grado</label><select class="form-select" id="selectGrado" required><option value="">Seleccione...</option>${auxiliares.grados.map(g => `<option value="${g.id_grados}">${g.nombre_grados}</option>`).join('')}</select></div>
                                    <div class="mb-3"><label class="form-label">Curso</label><select class="form-select" id="selectCurso" required><option value="">Seleccione...</option>${auxiliares.cursos.map(c => `<option value="${c.id_curso}">${c.nombre_curso}</option>`).join('')}</select></div>
                                    <div class="mb-3"><label class="form-label">Derecho / Estado</label><select class="form-select" id="selectDerecho" required><option value="">Seleccione...</option>${auxiliares.derechos.map(d => `<option value="${d.id_derecho}">${d.nom_derecho}</option>`).join('')}</select></div>
                                    <button type="button" class="btn btn-success w-100" onclick="ejecutarGuardarEstudiante()">Guardar Estudiante</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="modal fade" id="modalEditarEstudiante" tabindex="-1" aria-hidden="true">
                    <div class="modal-dialog">
                        <div class="modal-content">
                            <div class="modal-header bg-warning text-dark">
                                <h5 class="modal-title">Editar Estudiante</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                            </div>
                            <div class="modal-body">
                                <div>
                                    <input type="hidden" id="editDocOriginal">
                                    <div class="mb-3"><label class="form-label">Documento (No editable)</label><input type="text" class="form-control" id="editDoc" disabled></div>
                                    <div class="mb-3"><label class="form-label">Nombres</label><input type="text" class="form-control" id="editNombre" required></div>
                                    <div class="mb-3"><label class="form-label">Apellidos</label><input type="text" class="form-control" id="editApellido" required></div>
                                    <div class="mb-3"><label class="form-label">Grado</label><select class="form-select" id="editGrado" required>${auxiliares.grados.map(g => `<option value="${g.id_grados}">${g.nombre_grados}</option>`).join('')}</select></div>
                                    <div class="mb-3"><label class="form-label">Curso</label><select class="form-select" id="editCurso" required>${auxiliares.cursos.map(c => `<option value="${c.id_curso}">${c.nombre_curso}</option>`).join('')}</select></div>
                                    <div class="mb-3"><label class="form-label">Derecho / Estado</label><select class="form-select" id="editDerecho" required>${auxiliares.derechos.map(d => `<option value="${d.id_derecho}">${d.nom_derecho}</option>`).join('')}</select></div>
                                    <button type="button" class="btn btn-warning w-100" onclick="ejecutarActualizarEstudiante()">Actualizar Cambios</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="modal fade" id="modalImportarCsv" tabindex="-1" aria-hidden="true">
                    <div class="modal-dialog">
                        <div class="modal-content">
                            <div class="modal-header bg-success text-white">
                                <h5 class="modal-title">Carga Masiva de Estudiantes (CSV)</h5>
                                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                            </div>
                            <div class="modal-body">
                                <p class="text-muted small">El archivo CSV debe contener los siguientes encabezados exactos en la primera línea:</p>
                                <code class="d-block bg-light p-2 mb-3 small text-dark">doc_estudiante,id_tipo_identificacion,nom_estudiante,ape_estudiante,id_derecho,id_grados,id_curso</code>
                                <div class="mb-3">
                                    <label class="form-label fw-bold">Seleccionar archivo .csv</label>
                                    <input type="file" id="archivoCsvEstudiantes" class="form-control" accept=".csv" required>
                                </div>
                                <button type="button" class="btn btn-success w-100" onclick="ejecutarImportacionCsv()">📤 Subir e Importar</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalesHtml);

        } catch (error) {
            console.error(error);
            if (contenedor) contenedor.innerHTML = `<div class="alert alert-danger">Error al cargar la gestión de estudiantes.</div>`;
        }
    }

    // ==========================================
    // MÓDULO 3: GESTIÓN DE USUARIOS
    // ==========================================
    async function cargarGestionUsuarios() {
        const titulo = document.getElementById('titulo-modulo');
        const contenedor = document.getElementById('contenedor-modulo');
        
        document.querySelectorAll('#modalNuevoEstudiante, #modalEditarEstudiante, #modalNuevoUsuario, #modalEditarUsuario, #modalImportarCsv, #modalEditarGrado, #modalEditarCurso').forEach(m => m.remove());

        if (titulo) titulo.textContent = "Gestión de Usuarios del Sistema";
        if (contenedor) contenedor.innerHTML = `<p class="text-muted">Cargando usuarios...</p>`;

        try {
            const respuesta = await fetch('/api/usuarios');
            const usuarios = await respuesta.json();

            let html = `
                <div class="d-flex justify-content-between align-items-center mb-4">
                    <h5>Lista de Usuarios Autorizados</h5>
                    <button class="btn btn-primary" data-bs-toggle="modal" data-bs-target="#modalNuevoUsuario">
                        + Registrar Usuario
                    </button>
                </div>

                <div class="table-responsive">
                    <table class="table table-striped table-hover align-middle">
                        <thead class="table-dark">
                            <tr>
                                <th>ID</th>
                                <th>Nombres</th>
                                <th>Apellidos</th>
                                <th>Rol</th>
                                <th class="text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
            `;

            if (usuarios.length === 0) {
                html += `<tr><td colspan="5" class="text-center text-muted py-4">No hay usuarios registrados.</td></tr>`;
            } else {
                usuarios.forEach(usr => {
                    let badgeRol = usr.rol === 'ADMINISTRADOR' ? 'bg-danger' : 'bg-primary';
                    html += `
                        <tr>
                            <td>${usr.id_usuario}</td>
                            <td>${usr.nombre}</td>
                            <td>${usr.apellido}</td>
                            <td><span class="badge ${badgeRol}">${usr.rol}</span></td>
                            <td class="text-center">
                                <button class="btn btn-sm btn-warning me-1" onclick='prepararEditarUsuario(${JSON.stringify(usr)})' title="Editar">✏️ Editar</button>
                                <button class="btn btn-sm btn-danger" onclick="eliminarUsuario(${usr.id_usuario})" title="Eliminar">🗑️ Eliminar</button>
                            </td>
                        </tr>
                    `;
                });
            }

            html += `</tbody></table></div>`;
            if (contenedor) contenedor.innerHTML = html;

            const modalesUsrHtml = `
                <div class="modal fade" id="modalNuevoUsuario" tabindex="-1" aria-hidden="true">
                    <div class="modal-dialog">
                        <div class="modal-content">
                            <div class="modal-header bg-primary text-white">
                                <h5 class="modal-title">Registrar Nuevo Usuario</h5>
                                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                            </div>
                            <div class="modal-body">
                                <div>
                                    <div class="mb-3"><label class="form-label">Nombre</label><input type="text" class="form-control" id="usrNombre" required></div>
                                    <div class="mb-3"><label class="form-label">Apellido</label><input type="text" class="form-control" id="usrApellido" required></div>
                                    <div class="mb-3"><label class="form-label">Rol del Sistema</label><select class="form-select" id="usrRol" required><option value="">Seleccione...</option><option value="ADMINISTRADOR">ADMINISTRADOR</option><option value="OPERADOR">OPERADOR</option></select></div>
                                    <div class="mb-3"><label class="form-label">Contraseña Temporal</label><input type="password" class="form-control" id="usrPassword" required></div>
                                    <button type="button" class="btn btn-success w-100" onclick="ejecutarGuardarUsuario()">Guardar Usuario</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="modal fade" id="modalEditarUsuario" tabindex="-1" aria-hidden="true">
                    <div class="modal-dialog">
                        <div class="modal-content">
                            <div class="modal-header bg-warning text-dark">
                                <h5 class="modal-title">Editar Usuario</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                            </div>
                            <div class="modal-body">
                                <div>
                                    <input type="hidden" id="editUsrId">
                                    <div class="mb-3"><label class="form-label">Nombre</label><input type="text" class="form-control" id="editUsrNombre" required></div>
                                    <div class="mb-3"><label class="form-label">Apellido</label><input type="text" class="form-control" id="editUsrApellido" required></div>
                                    <div class="mb-3"><label class="form-label">Rol del Sistema</label><select class="form-select" id="editUsrRol" required><option value="ADMINISTRADOR">ADMINISTRADOR</option><option value="OPERADOR">OPERADOR</option></select></div>
                                    <div class="mb-3"><label class="form-label">Nueva Contraseña (Opcional)</label><input type="password" class="form-control" id="editUsrPassword" placeholder="Dejar en blanco para mantener la actual"></div>
                                    <button type="button" class="btn btn-warning w-100" onclick="ejecutarActualizarUsuario()">Actualizar Cambios</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalesUsrHtml);

        } catch (error) {
            console.error(error);
            if (contenedor) contenedor.innerHTML = `<div class="alert alert-danger">Error al cargar la gestión de usuarios.</div>`;
        }
    }

    // ==========================================
    // MÓDULO 4: GESTIÓN DE GRADOS Y CURSOS
    // ==========================================
    async function cargarGestionGradosYCursos() {
        const titulo = document.getElementById('titulo-modulo');
        const contenedor = document.getElementById('contenedor-modulo');

        document.querySelectorAll('#modalNuevoEstudiante, #modalEditarEstudiante, #modalNuevoUsuario, #modalEditarUsuario, #modalImportarCsv, #modalEditarGrado, #modalEditarCurso').forEach(m => m.remove());

        if (titulo) titulo.textContent = "Gestión de Grados y Cursos";
        if (contenedor) contenedor.innerHTML = `<p class="text-muted">Cargando estructura académica...</p>`;

        try {
            const res = await fetch('/api/auxiliares');
            const datos = await res.json();

            let html = `
                <div class="row g-4">
                    <div class="col-md-6">
                        <div class="card shadow-sm p-3">
                            <h5 class="card-title text-primary mb-3">Grados Académicos</h5>
                            <div class="input-group mb-3">
                                <input type="text" id="nuevoNombreGrado" class="form-control" placeholder="Ej: 10, 11, Transición">
                                <button class="btn btn-primary" onclick="guardarNuevoGrado()">+ Agregar Grado</button>
                            </div>
                            <div class="table-responsive">
                                <table class="table table-hover align-middle">
                                    <thead class="table-light">
                                        <tr>
                                            <th>ID</th>
                                            <th>Nombre del Grado</th>
                                            <th class="text-center">Acción</th>
                                        </tr>
                                    </thead>
                                    <tbody>
            `;

            if (datos.grados.length === 0) {
                html += `<tr><td colspan="3" class="text-center text-muted">No hay grados registrados.</td></tr>`;
            } else {
                datos.grados.forEach(g => {
                    html += `
                        <tr>
                            <td>${g.id_grados}</td>
                            <td>${g.nombre_grados}</td>
                            <td class="text-center">
                                <button class="btn btn-sm btn-outline-warning me-1" onclick="prepararEditarGrado(${g.id_grados}, '${g.nombre_grados}')" title="Editar">✏️</button>
                                <button class="btn btn-sm btn-outline-danger" onclick="eliminarGrado(${g.id_grados})" title="Eliminar">🗑️</button>
                            </td>
                        </tr>
                    `;
                });
            }

            html += `
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <div class="col-md-6">
                        <div class="card shadow-sm p-3">
                            <h5 class="card-title text-success mb-3">Cursos / Secciones</h5>
                            <div class="input-group mb-3">
                                <input type="text" id="nuevoNombreCurso" class="form-control" placeholder="Ej: A, B, 1, Único">
                                <button class="btn btn-success" onclick="guardarNuevoCurso()">+ Agregar Curso</button>
                            </div>
                            <div class="table-responsive">
                                <table class="table table-hover align-middle">
                                    <thead class="table-light">
                                        <tr>
                                            <th>ID</th>
                                            <th>Nombre del Curso</th>
                                            <th class="text-center">Acción</th>
                                        </tr>
                                    </thead>
                                    <tbody>
            `;

            if (datos.cursos.length === 0) {
                html += `<tr><td colspan="3" class="text-center text-muted">No hay cursos registrados.</td></tr>`;
            } else {
                datos.cursos.forEach(c => {
                    html += `
                        <tr>
                            <td>${c.id_curso}</td>
                            <td>${c.nombre_curso}</td>
                            <td class="text-center">
                                <button class="btn btn-sm btn-outline-warning me-1" onclick="prepararEditarCurso(${c.id_curso}, '${c.nombre_curso}')" title="Editar">✏️</button>
                                <button class="btn btn-sm btn-outline-danger" onclick="eliminarCurso(${c.id_curso})" title="Eliminar">🗑️</button>
                            </td>
                        </tr>
                    `;
                });
            }

            html += `
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="modal fade" id="modalEditarGrado" tabindex="-1" aria-hidden="true">
                    <div class="modal-dialog modal-sm">
                        <div class="modal-content">
                            <div class="modal-header bg-warning text-dark">
                                <h5 class="modal-title">Editar Grado</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                            </div>
                            <div class="modal-body">
                                <input type="hidden" id="editIdGrado">
                                <div class="mb-3">
                                    <label class="form-label">Nombre del Grado</label>
                                    <input type="text" id="editNombreGrado" class="form-control" required>
                                </div>
                                <button type="button" class="btn btn-warning w-100" onclick="ejecutarActualizarGrado()">Actualizar Grado</button>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="modal fade" id="modalEditarCurso" tabindex="-1" aria-hidden="true">
                    <div class="modal-dialog modal-sm">
                        <div class="modal-content">
                            <div class="modal-header bg-warning text-dark">
                                <h5 class="modal-title">Editar Curso</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                            </div>
                            <div class="modal-body">
                                <input type="hidden" id="editIdCurso">
                                <div class="mb-3">
                                    <label class="form-label">Nombre del Curso</label>
                                    <input type="text" id="editNombreCurso" class="form-control" required>
                                </div>
                                <button type="button" class="btn btn-warning w-100" onclick="ejecutarActualizarCurso()">Actualizar Curso</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            if (contenedor) contenedor.innerHTML = html;

        } catch (error) {
            console.error(error);
            if (contenedor) contenedor.innerHTML = `<div class="alert alert-danger">Error al cargar grados y cursos.</div>`;
        }
    }

    // ==========================================
    // MÓDULO 5: GESTIÓN DE TIPO DERECHO
    // ==========================================
    async function cargarGestionDerechos() {
        const titulo = document.getElementById('titulo-modulo');
        const contenedor = document.getElementById('contenedor-modulo');

        document.querySelectorAll('#modalNuevoEstudiante, #modalEditarEstudiante, #modalNuevoUsuario, #modalEditarUsuario, #modalImportarCsv, #modalEditarGrado, #modalEditarCurso').forEach(m => m.remove());

        if (titulo) titulo.textContent = "Gestión de Tipos de Derecho / Estados de Acceso";
        if (contenedor) contenedor.innerHTML = `<p class="text-muted">Cargando derechos de acceso...</p>`;

        try {
            const res = await fetch('/api/derechos');
            const derechos = await res.json();

            let html = `
                <div class="row mb-4">
                    <div class="col-md-6">
                        <div class="card shadow-sm p-3">
                            <h5 class="card-title text-primary mb-3">Registrar Nuevo Estado / Derecho</h5>
                            <div class="mb-3">
                                <label class="form-label">Nombre del Estado</label>
                                <input type="text" id="nombreDerecho" class="form-control" placeholder="Ej: Becado, Suspendido Temporalmente">
                            </div>
                            <div class="mb-3">
                                <label class="form-label">¿Permite Ingreso al Comedor?</label>
                                <select id="permiteIngreso" class="form-select">
                                    <option value="1">Sí (Permite Acceso)</option>
                                    <option value="0">No (Bloquea Acceso)</option>
                                </select>
                            </div>
                            <button class="btn btn-primary w-100" onclick="guardarNuevoDerecho()">+ Registrar Derecho</button>
                        </div>
                    </div>
                </div>

                <div class="card shadow-sm p-3">
                    <h5 class="card-title mb-3">Listado de Derechos Actuales</h5>
                    <div class="table-responsive">
                        <table class="table table-hover align-middle">
                            <thead class="table-dark">
                                <tr>
                                    <th>ID</th>
                                    <th>Descripción del Derecho</th>
                                    <th>Estado de Ingreso</th>
                                    <th class="text-center">Acción</th>
                                </tr>
                            </thead>
                            <tbody>
            `;

            if (derechos.length === 0) {
                html += `<tr><td colspan="4" class="text-center text-muted">No hay derechos registrados.</td></tr>`;
            } else {
                derechos.forEach(d => {
                    let badge = d.permite_ingreso === 1 ? '<span class="badge bg-success">Permitido</span>' : '<span class="badge bg-danger">Bloqueado</span>';
                    html += `
                        <tr>
                            <td>${d.id_derecho}</td>
                            <td>${d.nom_derecho}</td>
                            <td>${badge}</td>
                            <td class="text-center">
                                <button class="btn btn-sm btn-outline-danger" onclick="eliminarDerecho(${d.id_derecho})">🗑️ Eliminar</button>
                            </td>
                        </tr>
                    `;
                });
            }

            html += `
                            </tbody>
                        </table>
                    </div>
                </div>
            `;

            if (contenedor) contenedor.innerHTML = html;

        } catch (error) {
            console.error(error);
            if (contenedor) contenedor.innerHTML = `<div class="alert alert-danger">Error al cargar la gestión de derechos.</div>`;
        }
    }

    // ==========================================
    // MÓDULO 6: LECTOR QR (CÁMARA Y MANUAL)
    // ==========================================
    async function cargarLectorManual() {
        const titulo = document.getElementById('titulo-modulo');
        const contenedor = document.getElementById('contenedor-modulo');

        document.querySelectorAll('#modalNuevoEstudiante, #modalEditarEstudiante, #modalNuevoUsuario, #modalEditarUsuario, #modalImportarCsv, #modalEditarGrado, #modalEditarCurso').forEach(m => m.remove());

        if (titulo) titulo.textContent = "Lector de Códigos QR y Registro de Ingreso";
        if (contenedor) contenedor.innerHTML = `
            <div class="row justify-content-center">
                <div class="col-md-8">
                    <div class="card shadow-sm p-4 mb-4">
                        <h5 class="card-title text-primary mb-3 text-center">📷 Escáner de Carnet (Cámara Web)</h5>
                        <p class="text-muted text-center small mb-3">Apunta con la cámara al código QR del estudiante para registrar su ingreso automáticamente.</p>
                        <div id="reader" style="width: 100%; max-width: 500px; margin: 0 auto;"></div>
                    </div>

                    <div class="card shadow-sm p-4">
                        <h5 class="card-title text-secondary mb-3 text-center">⌨️ O Ingreso Manual por Teclado</h5>
                        <div class="input-group mb-3">
                            <input type="text" id="inputDocManual" class="form-control form-control-lg" placeholder="Digite el documento y presione Enter">
                            <button class="btn btn-success btn-lg" onclick="procesarIngresoManual()">Registrar</button>
                        </div>
                        <div id="resultadoEscaneo" class="mt-3"></div>
                    </div>
                </div>
            </div>
        `;

        if (!window.Html5Qrcode) {
            const script = document.createElement('script');
            script.src = "https://unpkg.com/html5-qrcode";
            script.onload = () => iniciarScannerCamara();
            document.head.appendChild(script);
        } else {
            iniciarScannerCamara();
        }

        const inputDoc = document.getElementById('inputDocManual');
        if (inputDoc) {
            inputDoc.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    procesarIngresoManual();
                }
            });
        }
    }
    
    async function iniciarScannerCamara() {
        if (window.html5QrCodeInstance) {
            try {
                await window.html5QrCodeInstance.stop();
                await window.html5QrCodeInstance.clear();
            } catch (e) {}
            window.html5QrCodeInstance = null;
        }

        const readerElement = document.getElementById('reader');
        if (!readerElement) return;

        const html5QrCode = new Html5Qrcode("reader");
        window.html5QrCodeInstance = html5QrCode;

        const config = { fps: 10, qrbox: { width: 250, height: 250 } };
        let isProcessing = false;

        try {
            await html5QrCode.start(
                { facingMode: "environment" }, 
                config, 
                async (decodedText) => {
                    if (isProcessing) return;
                    isProcessing = true;

                    const inputField = document.getElementById('inputDocManual');
                    let estado = null;
                    if (inputField) {
                        inputField.value = decodedText;
                        estado = await procesarIngresoManual();
                    }

                    setTimeout(() => {
                        isProcessing = false;
                        const contenedorResultado = document.getElementById('resultadoEscaneo');
                        if (contenedorResultado) {
                            contenedorResultado.innerHTML = `<div class="alert alert-secondary">Cámara lista. Esperando siguiente código...</div>`;
                        }
                    }, 4000);
                },
                (error) => {}
            );
        } catch (err) {
            console.error("No se pudo iniciar la cámara:", err);
            const contenedorResultado = document.getElementById('resultadoEscaneo');
            if (contenedorResultado) {
                contenedorResultado.innerHTML = `<div class="alert alert-danger">No se pudo acceder a la cámara. Verifica los permisos del navegador.</div>`;
            }
        }
    }
    
    // ==========================================
    // MÓDULO 7: GESTIÓN DE REPORTES
    // ==========================================
    async function cargarGestionReportes() {
        const titulo = document.getElementById('titulo-modulo');
        const contenedor = document.getElementById('contenedor-modulo');

        document.querySelectorAll('#modalNuevoEstudiante, #modalEditarEstudiante, #modalNuevoUsuario, #modalEditarUsuario, #modalImportarCsv, #modalEditarGrado, #modalEditarCurso').forEach(m => m.remove());

        if (titulo) titulo.textContent = "Gestión de Reportes Históricos y Dashboard";
        
        const hoy = new Date().toISOString().split('T')[0];

        if (contenedor) contenedor.innerHTML = `
            <ul class="nav nav-tabs mb-4" id="reportesTab" role="tablist">
                <li class="nav-item" role="presentation">
                    <button class="nav-link active fw-bold" id="tab-asistencias" data-bs-toggle="tab" data-bs-target="#contenido-asistencias" type="button" role="tab">📥 Registros de Acceso</button>
                </li>
                <li class="nav-item" role="presentation">
                    <button class="nav-link fw-bold" id="tab-inasistencias" data-bs-toggle="tab" data-bs-target="#contenido-inasistencias" type="button" role="tab">❌ Reporte de Inasistencia</button>
                </li>
                <li class="nav-item" role="presentation">
                    <button class="nav-link fw-bold" id="tab-dashboard" data-bs-toggle="tab" data-bs-target="#contenido-dashboard" type="button" role="tab">📊 Dashboard Visual</button>
                </li>
            </ul>

            <div class="tab-content" id="reportesTabContent">
                <div class="tab-pane fade show active" id="contenido-asistencias" role="tabpanel">
                    <div class="card shadow-sm p-4 mb-4">
                        <h5 class="card-title text-primary mb-3">Filtro por Rango de Fechas (Asistencias)</h5>
                        <div class="row g-3 align-items-end">
                            <div class="col-md-4"><label class="form-label">Fecha Inicio</label><input type="date" id="asistFechaInicio" class="form-control" value="${hoy}"></div>
                            <div class="col-md-4"><label class="form-label">Fecha Fin</label><input type="date" id="asistFechaFin" class="form-control" value="${hoy}"></div>
                            <div class="col-md-4"><button class="btn btn-primary w-100" onclick="buscarAsistencias()">🔍 Buscar Registros</button></div>
                        </div>
                    </div>
                    <div id="resultadoAsistencias"></div>
                </div>

                <div class="tab-pane fade" id="contenido-inasistencias" role="tabpanel">
                    <div class="card shadow-sm p-4 mb-4">
                        <h5 class="card-title text-danger mb-3">Filtro de Inasistencias (Derecho Activo sin Registro)</h5>
                        <div class="row g-3 align-items-end">
                            <div class="col-md-4"><label class="form-label">Fecha Inicio</label><input type="date" id="inasFechaInicio" class="form-control" value="${hoy}"></div>
                            <div class="col-md-4"><label class="form-label">Fecha Fin</label><input type="date" id="inasFechaFin" class="form-control" value="${hoy}"></div>
                            <div class="col-md-4"><button class="btn btn-danger w-100" onclick="buscarInasistencias()">🔍 Buscar Ausentes</button></div>
                        </div>
                    </div>
                    <div id="resultadoInasistencias"></div>
                </div>

                <div class="tab-pane fade" id="contenido-dashboard" role="tabpanel">
                    <div class="card shadow-sm p-4 mb-4">
                        <h5 class="card-title text-success mb-3">Parámetros del Dashboard</h5>
                        <div class="row g-3 align-items-end">
                            <div class="col-md-4"><label class="form-label">Fecha Inicio</label><input type="date" id="dashFechaInicio" class="form-control" value="${hoy}"></div>
                            <div class="col-md-4"><label class="form-label">Fecha Fin</label><input type="date" id="dashFechaFin" class="form-control" value="${hoy}"></div>
                            <div class="col-md-4"><button class="btn btn-success w-100" onclick="cargarDashboardGraficas()">📈 Generar Dashboard</button></div>
                        </div>
                    </div>
                    <div id="contenedorGraficas"></div>
                </div>
            </div>
        `;

        if (!window.XLSX) {
            const scriptXLSX = document.createElement('script');
            scriptXLSX.src = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
            document.head.appendChild(scriptXLSX);
        }

        if (!window.Chart) {
            const scriptChart = document.createElement('script');
            scriptChart.src = "https://cdn.jsdelivr.net/npm/chart.js";
            document.head.appendChild(scriptChart);
        }
    }

    // ==========================================
    // MÓDULO 8: LIMPIEZA DE DATOS (DEPURACIÓN)
    // ==========================================
    async function cargarLimpiezaDatos() {
        const titulo = document.getElementById('titulo-modulo');
        const contenedor = document.getElementById('contenedor-modulo');

        document.querySelectorAll('#modalNuevoEstudiante, #modalEditarEstudiante, #modalNuevoUsuario, #modalEditarUsuario, #modalImportarCsv, #modalEditarGrado, #modalEditarCurso').forEach(m => m.remove());

        if (titulo) titulo.textContent = "Limpieza y Depuración de Datos del Sistema";
        if (contenedor) contenedor.innerHTML = `<p class="text-muted">Analizando almacenamiento de la base de datos...</p>`;

        try {
            const res = await fetch('/api/limpieza/stats');
            const stats = await res.json();

            let html = `
                <div class="row justify-content-center">
                    <div class="col-md-8">
                        <div class="card shadow-sm p-4 mb-4 border-warning">
                            <h5 class="card-title text-warning mb-3">⚠️ Panel de Depuración de Asistencias</h5>
                            <p class="text-muted small">Esta sección permite eliminar registros históricos de ingresos al comedor para optimizar espacio o cerrar ciclos académicos.</p>
                            
                            <div class="row text-center my-4 g-3">
                                <div class="col-md-4"><div class="p-3 bg-light rounded shadow-sm"><h6 class="text-muted">Total Registros</h6><h3 class="fw-bold text-primary">${stats.total_ingresos}</h3></div></div>
                                <div class="col-md-4"><div class="p-3 bg-light rounded shadow-sm"><h6 class="text-muted">Primer Registro</h6><span class="fw-bold text-dark">${stats.primera_fecha}</span></div></div>
                                <div class="col-md-4"><div class="p-3 bg-light rounded shadow-sm"><h6 class="text-muted">Último Registro</h6><span class="fw-bold text-dark">${stats.ultima_fecha}</span></div></div>
                            </div>

                            <hr class="my-4">
                            <div class="mb-4">
                                <h6 class="fw-bold text-danger">Opción 1: Eliminar registros anteriores a una fecha</h6>
                                <div class="input-group">
                                    <input type="date" id="fechaLimiteLimpieza" class="form-control">
                                    <button class="btn btn-outline-danger" onclick="ejecutarLimpiezaPorFecha()">Purgar por Fecha</button>
                                </div>
                            </div>
                            <div>
                                <h6 class="fw-bold text-danger">Opción 2: Borrar TODO el historial de asistencias</h6>
                                <button class="btn btn-danger w-100" onclick="ejecutarLimpiezaTotal()">🗑️ Vaciar Historial Completo de Ingresos</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            if (contenedor) contenedor.innerHTML = html;
        } catch (e) {
            console.error(e);
            if (contenedor) contenedor.innerHTML = `<div class="alert alert-danger">Error al conectar con el servicio de limpieza.</div>`;
        }
    }

    // ==========================================
    // MÓDULO 9: COPIAS DE SEGURIDAD (BACKEND)
    // ==========================================
    async function cargarCopiasSeguridad() {
        const titulo = document.getElementById('titulo-modulo');
        const contenedor = document.getElementById('contenedor-modulo');

        document.querySelectorAll('#modalNuevoEstudiante, #modalEditarEstudiante, #modalNuevoUsuario, #modalEditarUsuario, #modalImportarCsv, #modalEditarGrado, #modalEditarCurso').forEach(m => m.remove());

        if (titulo) titulo.textContent = "Copias de Seguridad (Backup de Base de Datos)";
        if (contenedor) contenedor.innerHTML = `
            <div class="row justify-content-center">
                <div class="col-md-8">
                    <div class="card shadow-sm p-5 text-center border-primary">
                        <h3 class="card-title text-primary mb-3">💾 Respaldo General del Sistema</h3>
                        <p class="text-muted mb-4">Descarga una copia exacta y segura de la base de datos SQLite en formato <code>.db</code>.</p>
                        <button class="btn btn-primary btn-lg py-3 fw-bold shadow-sm" onclick="ejecutarBackup()">
                            📥 Descargar Copia de Seguridad (.db)
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    // ==========================================
    // MÓDULO 10: CRÉDITOS Y ACERCA DE
    // ==========================================
    async function cargarCreditos() {
        const titulo = document.getElementById('titulo-modulo');
        const contenedor = document.getElementById('contenedor-modulo');

        document.querySelectorAll('#modalNuevoEstudiante, #modalEditarEstudiante, #modalNuevoUsuario, #modalEditarUsuario, #modalImportarCsv, #modalEditarGrado, #modalEditarCurso').forEach(m => m.remove());

        if (titulo) titulo.textContent = "Créditos y Acerca de";
        if (contenedor) contenedor.innerHTML = `
            <div class="row justify-content-center">
                <div class="col-md-9">
                    <div class="card shadow-sm p-5 border-info">
                        <div class="row align-items-center">
                            <!-- Columna Izquierda: Logo 2 / Imagen -->
                            <div class="col-md-4 text-center border-end mb-4 mb-md-0">
                                <img src="/static/assets/logo2.jpeg" alt="Logo Institucional 2" class="img-fluid rounded shadow-sm" style="max-height: 240px;" onerror="this.src='https://via.placeholder.com/120?text=Logo+2'">
                            </div>
                            
                            <!-- Columna Derecha: Información del Proyecto -->
                            <div class="col-md-8 ps-md-4 text-start">
                                <h3 class="card-title text-primary mb-2">🍽️ Proyecto: Comedor Escolar V1.2</h3>
                                <p class="text-muted mb-3"><strong>Año:</strong> 2026</p>
                                
                                <hr class="my-3">

                                <div class="mb-3">
                                    <h6 class="fw-bold text-dark">Autores:</h6>
                                    <p class="mb-0 text-muted">Jeimy Julieth Ruano Morales, Jessica Luciana Navarrete Rodriguez</p>
                                    <small class="text-secondary">IEM Luis Eduardo Mora Osejo – Técnico en Programación de Software - SENA</small>
                                </div>

                                <div class="mt-3">
                                    <h6 class="fw-bold text-dark">Asesores del Proyecto:</h6>
                                    <p class="mb-0 text-muted">Instructor Rigo Wilfred Taquez</p>
                                    <p class="mb-0 text-muted">Docentes: Mauricio Cabrera</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // ==========================================
    // FUNCIONES GLOBALES DE ACCIÓN
    // ==========================================
    window.renderizarTablaEstudiantes = (estudiantes) => {
        const tbody = document.getElementById('tablaEstudiantesBody');
        if (!tbody) return;

        if (estudiantes.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">No se encontraron estudiantes con los filtros especificados.</td></tr>`;
            return;
        }

        let html = '';
        estudiantes.forEach(est => {
            let badgeColor = est.permite_ingreso === 1 ? 'bg-success' : 'bg-danger';
            html += `
                <tr>
                    <td>${est.doc_estudiante}</td>
                    <td>${est.ape_estudiante} ${est.nom_estudiante}</td>
                    <td>${est.nombre_grados} - ${est.nombre_curso}</td>
                    <td><span class="badge ${badgeColor}">${est.nom_derecho}</span></td>
                    <td class="text-center">
                        <button class="btn btn-sm btn-info text-white me-1" onclick="descargarQR('${est.doc_estudiante}', '${est.nom_estudiante} ${est.ape_estudiante}')" title="Descargar QR">📥 QR</button>
                        <button class="btn btn-sm btn-warning me-1" onclick='prepararEditar(${JSON.stringify(est)})' title="Editar">✏️</button>
                        <button class="btn btn-sm btn-danger" onclick="eliminarEstudiante('${est.doc_estudiante}')" title="Eliminar">🗑️</button>
                    </td>
                </tr>
            `;
        });
        tbody.innerHTML = html;
    };

    window.aplicarFiltrosEstudiantes = () => {
        if (!window.listaEstudiantesGlobal) return;
        const texto = document.getElementById('filtroTexto').value.toLowerCase().trim();
        const gradoId = document.getElementById('filtroGrado').value;
        const cursoId = document.getElementById('filtroCurso').value;

        const filtrados = window.listaEstudiantesGlobal.filter(est => {
            const matchTexto = !texto || 
                est.doc_estudiante.toLowerCase().includes(texto) ||
                est.nom_estudiante.toLowerCase().includes(texto) ||
                est.ape_estudiante.toLowerCase().includes(texto);
            const matchGrado = !gradoId || est.id_grados.toString() === gradoId;
            const matchCurso = !cursoId || est.id_curso.toString() === cursoId;
            return matchTexto && matchGrado && matchCurso;
        });
        renderizarTablaEstudiantes(filtrados);
    };

    window.limpiarFiltrosEstudiantes = () => {
        document.getElementById('filtroTexto').value = '';
        document.getElementById('filtroGrado').value = '';
        document.getElementById('filtroCurso').value = '';
        renderizarTablaEstudiantes(window.listaEstudiantesGlobal);
    };

    window.descargarQRsMasivos = async () => {
        if (!window.listaEstudiantesGlobal) return;
        const texto = document.getElementById('filtroTexto').value.toLowerCase().trim();
        const gradoId = document.getElementById('filtroGrado').value;
        const cursoId = document.getElementById('filtroCurso').value;

        const filtrados = window.listaEstudiantesGlobal.filter(est => {
            const matchTexto = !texto || 
                est.doc_estudiante.toLowerCase().includes(texto) ||
                est.nom_estudiante.toLowerCase().includes(texto) ||
                est.ape_estudiante.toLowerCase().includes(texto);
            const matchGrado = !gradoId || est.id_grados.toString() === gradoId;
            const matchCurso = !cursoId || est.id_curso.toString() === cursoId;
            return matchTexto && matchGrado && matchCurso;
        });

        if (filtrados.length === 0) {
            alert("No hay estudiantes para descargar con los filtros actuales.");
            return;
        }

        if (!window.JSZip) {
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
        }

        alert(`Preparando archivo ZIP con ${filtrados.length} códigos QR...`);
        const zip = new JSZip();
        const folder = zip.folder("codigos_qr_estudiantes");

        for (const est of filtrados) {
            try {
                const urlQR = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${est.doc_estudiante}`;
                const response = await fetch(urlQR);
                const blob = await response.blob();
                folder.file(`QR_${est.doc_estudiante}_${est.nom_estudiante.replace(/\s+/g, '_')}.png`, blob);
            } catch (err) {
                console.error(err);
            }
        }

        const content = await zip.generateAsync({ type: "blob" });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = `QRs_Estudiantes_Filtrados.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    window.prepararEditarGrado = (id, nombre) => {
        document.getElementById('editIdGrado').value = id;
        document.getElementById('editNombreGrado').value = nombre;
        new bootstrap.Modal(document.getElementById('modalEditarGrado')).show();
    };

    window.ejecutarActualizarGrado = async () => {
        const id = document.getElementById('editIdGrado').value;
        const nombre = document.getElementById('editNombreGrado').value.trim();
        if (!nombre) { alert("El nombre no puede estar vacío."); return; }

        try {
            const res = await fetch(`/api/grados/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nombre_grados: nombre })
            });
            if (res.ok) {
                bootstrap.Modal.getInstance(document.getElementById('modalEditarGrado')).hide();
                document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
                localStorage.setItem('moduloActivo', 'grados');
                cargarGestionGradosYCursos();
            } else {
                const err = await res.json();
                alert("Error: " + err.detail);
            }
        } catch (e) {
            console.error(e);
            alert("Error de conexión al actualizar grado.");
        }
    };

    window.prepararEditarCurso = (id, nombre) => {
        document.getElementById('editIdCurso').value = id;
        document.getElementById('editNombreCurso').value = nombre;
        new bootstrap.Modal(document.getElementById('modalEditarCurso')).show();
    };

    window.ejecutarActualizarCurso = async () => {
        const id = document.getElementById('editIdCurso').value;
        const nombre = document.getElementById('editNombreCurso').value.trim();
        if (!nombre) { alert("El nombre no puede estar vacío."); return; }

        try {
            const res = await fetch(`/api/cursos/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nombre_curso: nombre })
            });
            if (res.ok) {
                bootstrap.Modal.getInstance(document.getElementById('modalEditarCurso')).hide();
                document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
                localStorage.setItem('moduloActivo', 'grados');
                cargarGestionGradosYCursos();
            } else {
                const err = await res.json();
                alert("Error: " + err.detail);
            }
        } catch (e) {
            console.error(e);
            alert("Error de conexión al actualizar curso.");
        }
    };

    window.ejecutarGuardarEstudiante = async () => {
        const doc = document.getElementById('nuevoDoc').value;
        const tipoId = document.getElementById('selectTipoId').value;
        const nombre = document.getElementById('nuevoNombre').value;
        const apellido = document.getElementById('nuevoApellido').value;
        const grado = document.getElementById('selectGrado').value;
        const curso = document.getElementById('selectCurso').value;
        const derecho = document.getElementById('selectDerecho').value;

        if (!doc || !tipoId || !nombre || !apellido || !grado || !curso || !derecho) {
            alert("Por favor completa todos los campos.");
            return;
        }

        const payload = {
            doc_estudiante: doc,
            id_tipo_identificacion: parseInt(tipoId),
            nom_estudiante: nombre,
            ape_estudiante: apellido,
            id_grados: parseInt(grado),
            id_curso: parseInt(curso),
            id_derecho: parseInt(derecho)
        };

        try {
            const res = await fetch('/api/estudiantes', {
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify(payload)
            });

            if (res.ok) { 
                bootstrap.Modal.getInstance(document.getElementById('modalNuevoEstudiante')).hide();
                document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
                localStorage.setItem('moduloActivo', 'estudiantes');
                cargarGestionEstudiantes(); 
            } else { 
                const err = await res.json(); 
                alert("Error: " + err.detail); 
            }
        } catch (err) {
            console.error(err);
            alert("Error de conexión al registrar estudiante.");
        }
    };

    window.ejecutarActualizarEstudiante = async () => {
        const doc = document.getElementById('editDocOriginal').value;
        const nombre = document.getElementById('editNombre').value;
        const apellido = document.getElementById('editApellido').value;
        const grado = document.getElementById('editGrado').value;
        const curso = document.getElementById('editCurso').value;
        const derecho = document.getElementById('editDerecho').value;

        const payload = {
            nom_estudiante: nombre,
            ape_estudiante: apellido,
            id_grados: parseInt(grado),
            id_curso: parseInt(curso),
            id_derecho: parseInt(derecho)
        };

        try {
            const res = await fetch(`/api/estudiantes/${doc}`, {
                method: 'PUT', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify(payload)
            });

            if (res.ok) { 
                bootstrap.Modal.getInstance(document.getElementById('modalEditarEstudiante')).hide();
                document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
                localStorage.setItem('moduloActivo', 'estudiantes');
                cargarGestionEstudiantes(); 
            } else { 
                alert("Error al actualizar."); 
            }
        } catch (err) {
            console.error(err);
            alert("Error de conexión al actualizar.");
        }
    };

    window.ejecutarImportacionCsv = async () => {
        const inputArchivo = document.getElementById('archivoCsvEstudiantes');
        if (!inputArchivo.files || inputArchivo.files.length === 0) {
            alert("Por favor selecciona un archivo CSV.");
            return;
        }

        const formData = new FormData();
        formData.append("file", inputArchivo.files[0]);

        try {
            const res = await fetch('/api/estudiantes/importar-csv', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            if (res.ok) {
                alert(data.mensaje);
                bootstrap.Modal.getInstance(document.getElementById('modalImportarCsv')).hide();
                document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
                localStorage.setItem('moduloActivo', 'estudiantes');
                cargarGestionEstudiantes();
            } else {
                alert("Error: " + (data.detail || "No se pudo procesar el archivo."));
            }
        } catch (e) {
            console.error(e);
            alert("Error de conexión al importar el archivo CSV.");
        }
    };

    window.ejecutarGuardarUsuario = async () => {
        const nombre = document.getElementById('usrNombre').value;
        const apellido = document.getElementById('usrApellido').value;
        const rolUsr = document.getElementById('usrRol').value;
        const password = document.getElementById('usrPassword').value;

        try {
            const res = await fetch('/api/usuarios', {
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ nombre, apellido, rol: rolUsr, password })
            });

            if (res.ok) {
                bootstrap.Modal.getInstance(document.getElementById('modalNuevoUsuario')).hide();
                document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
                localStorage.setItem('moduloActivo', 'usuarios');
                cargarGestionUsuarios();
            } else {
                const err = await res.json();
                alert("Error: " + err.detail);
            }
        } catch (err) {
            console.error(err);
            alert("Error de conexión al registrar usuario.");
        }
    };

    window.prepararEditarUsuario = (usr) => {
        document.getElementById('editUsrId').value = usr.id_usuario;
        document.getElementById('editUsrNombre').value = usr.nombre;
        document.getElementById('editUsrApellido').value = usr.apellido;
        document.getElementById('editUsrRol').value = usr.rol;
        document.getElementById('editUsrPassword').value = "";
        new bootstrap.Modal(document.getElementById('modalEditarUsuario')).show();
    };

    window.ejecutarActualizarUsuario = async () => {
        const idUsuario = document.getElementById('editUsrId').value;
        const nombre = document.getElementById('editUsrNombre').value;
        const apellido = document.getElementById('editUsrApellido').value;
        const rolUsr = document.getElementById('editUsrRol').value;
        const password = document.getElementById('editUsrPassword').value;

        const payload = { nombre, apellido, rol: rolUsr };
        if (password.trim() !== "") payload.password = password;

        try {
            const res = await fetch(`/api/usuarios/${idUsuario}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                bootstrap.Modal.getInstance(document.getElementById('modalEditarUsuario')).hide();
                document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
                localStorage.setItem('moduloActivo', 'usuarios');
                cargarGestionUsuarios();
            } else {
                const err = await res.json();
                alert("Error: " + err.detail);
            }
        } catch (err) {
            console.error(err);
            alert("Error de conexión al actualizar usuario.");
        }
    };

    window.guardarNuevoGrado = async () => {
        const nombre = document.getElementById('nuevoNombreGrado').value.trim();
        if (!nombre) { alert("Ingresa el nombre del grado."); return; }
        
        try {
            const res = await fetch('/api/grados', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nombre_grados: nombre })
            });

            if (res.ok) {
                localStorage.setItem('moduloActivo', 'grados');
                cargarGestionGradosYCursos();
            } else { 
                const err = await res.json(); 
                alert("Error: " + err.detail); 
            }
        } catch (e) {
            console.error(e);
            alert("Error de conexión al registrar grado.");
        }
    };

    window.eliminarGrado = async (idGrado) => {
        if (confirm("¿Estás seguro de eliminar este grado?")) {
            const res = await fetch(`/api/grados/${idGrado}`, { method: 'DELETE' });
            if (res.ok) {
                localStorage.setItem('moduloActivo', 'grados');
                cargarGestionGradosYCursos();
            } else { alert("Error al eliminar grado."); }
        }
    };

    window.guardarNuevoCurso = async () => {
        const nombre = document.getElementById('nuevoNombreCurso').value.trim();
        if (!nombre) { alert("Ingresa el nombre del curso."); return; }

        try {
            const res = await fetch('/api/cursos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nombre_curso: nombre })
            });

            if (res.ok) {
                localStorage.setItem('moduloActivo', 'grados');
                cargarGestionGradosYCursos();
            } else { 
                const err = await res.json(); 
                alert("Error: " + err.detail); 
            }
        } catch (e) {
            console.error(e);
            alert("Error de conexión al registrar curso.");
        }
    };

    window.eliminarCurso = async (idCurso) => {
        if (confirm("¿Estás seguro de eliminar este curso?")) {
            const res = await fetch(`/api/cursos/${idCurso}`, { method: 'DELETE' });
            if (res.ok) {
                localStorage.setItem('moduloActivo', 'grados');
                cargarGestionGradosYCursos();
            } else { alert("Error al eliminar curso."); }
        }
    };

    window.guardarNuevoDerecho = async () => {
        const nombre = document.getElementById('nombreDerecho').value.trim();
        const permite = parseInt(document.getElementById('permiteIngreso').value);
        if (!nombre) { alert("Ingresa el nombre del derecho."); return; }

        try {
            const res = await fetch('/api/derechos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nom_derecho: nombre, permite_ingreso: permite })
            });

            if (res.ok) {
                localStorage.setItem('moduloActivo', 'derechos');
                cargarGestionDerechos();
            } else {
                const err = await res.json();
                alert("Error: " + err.detail);
            }
        } catch (e) {
            console.error(e);
            alert("Error de conexión al registrar derecho.");
        }
    };

    window.eliminarDerecho = async (idDerecho) => {
        if (confirm("¿Estás seguro de eliminar este derecho?")) {
            try {
                const res = await fetch(`/api/derechos/${idDerecho}`, { method: 'DELETE' });
                if (res.ok) {
                    localStorage.setItem('moduloActivo', 'derechos');
                    cargarGestionDerechos();
                } else {
                    alert("No se pudo eliminar el derecho.");
                }
            } catch (e) {
                console.error(e);
                alert("Error al eliminar derecho.");
            }
        }
    };

    window.procesarIngresoManual = async () => {
        const doc = document.getElementById('inputDocManual').value.trim();
        const contenedorResultado = document.getElementById('resultadoEscaneo');
        if (!doc) {
            contenedorResultado.innerHTML = `<div class="alert alert-warning">Por favor ingrese o escanee un número de documento.</div>`;
            reproducirSonido('denegado');
            return null;
        }

        let estadoResultado = null;
        try {
            const res = await fetch('/api/escanear', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ doc_estudiante: doc })
            });
            const data = await res.json();

            if (res.ok) {
                estadoResultado = data.estado;
                if (data.estado === "aprobado") {
                    contenedorResultado.innerHTML = `<div class="alert alert-success shadow-sm"><h4 class="alert-heading">✅ ¡Acceso Aprobado!</h4><hr><p class="mb-1"><strong>Estudiante:</strong> ${data.datos.nom_estudiante} ${data.datos.ape_estudiante}</p><p class="mb-1"><strong>Grado y Curso:</strong> ${data.datos.nombre_grados} - ${data.datos.nombre_curso}</p></div>`;
                    reproducirSonido('aprobado');
                } else if (data.estado === "advertencia") {
                    contenedorResultado.innerHTML = `<div class="alert alert-warning shadow-sm"><h4 class="alert-heading">⚠️ Atención</h4><p class="mb-1">${data.mensaje}</p></div>`;
                    reproducirSonido('advertencia');
                } else if (data.estado === "denegado") {
                    contenedorResultado.innerHTML = `<div class="alert alert-danger shadow-sm"><h4 class="alert-heading">❌ Acceso Denegado</h4><p class="mb-1"><strong>Motivo:</strong> ${data.mensaje}</p></div>`;
                    reproducirSonido('denegado');
                }
            } else {
                contenedorResultado.innerHTML = `<div class="alert alert-danger shadow-sm"><h4 class="alert-heading">❌ Error</h4><p class="mb-0">${data.detail || "Estudiante no encontrado."}</p></div>`;
                reproducirSonido('denegado');
            }
            document.getElementById('inputDocManual').value = "";
            document.getElementById('inputDocManual').focus();
        } catch (e) {
            console.error(e);
            contenedorResultado.innerHTML = `<div class="alert alert-danger">Error de conexión con el servidor.</div>`;
            reproducirSonido('denegado');
        }
        return estadoResultado;
    };

    window.buscarAsistencias = async () => {
        const inicio = document.getElementById('asistFechaInicio').value;
        const fin = document.getElementById('asistFechaFin').value;
        const contenedor = document.getElementById('resultadoAsistencias');
        contenedor.innerHTML = `<p class="text-muted">Consultando registros...</p>`;

        try {
            const res = await fetch(`/api/reportes/asistencias?fecha_inicio=${inicio}&fecha_fin=${fin}`);
            const data = await res.json();
            let html = `<div class="d-flex justify-content-between align-items-center mb-3"><h5 class="fw-bold">Total Asistencias: <span class="text-primary">${data.total}</span></h5>${data.total > 0 ? `<button class="btn btn-success" onclick="exportarTablaAExcel('tablaAsistencias', 'Reporte_Asistencias.xlsx')">📥 Exportar a Excel</button>` : ''}</div><div class="table-responsive"><table class="table table-striped table-hover align-middle" id="tablaAsistencias"><thead class="table-dark"><tr><th>Fecha</th><th>Hora</th><th>Tipo Doc</th><th>Documento</th><th>Nombres y Apellidos</th><th>Grado</th><th>Curso</th></tr></thead><tbody>`;
            
            if (data.registros.length === 0) {
                html += `<tr><td colspan="7" class="text-center text-muted py-4">No se encontraron registros.</td></tr>`;
            } else {
                data.registros.forEach(r => {
                    html += `<tr><td>${r.fecha_ingreso}</td><td><span class="badge bg-success">${r.hora_ingreso}</span></td><td>${r.nom_tipo_identificacion}</td><td>${r.doc_estudiante}</td><td>${r.nom_estudiante} ${r.ape_estudiante}</td><td>${r.nombre_grados}</td><td>${r.nombre_curso}</td></tr>`;
                });
            }
            html += `</tbody></table></div>`;
            contenedor.innerHTML = html;
        } catch (e) {
            console.error(e);
            contenedor.innerHTML = `<div class="alert alert-danger">Error al consultar asistencias.</div>`;
        }
    };

    window.buscarInasistencias = async () => {
        const inicio = document.getElementById('inasFechaInicio').value;
        const fin = document.getElementById('inasFechaFin').value;
        const contenedor = document.getElementById('resultadoInasistencias');
        contenedor.innerHTML = `<p class="text-muted">Analizando inasistencias...</p>`;

        try {
            const res = await fetch(`/api/reportes/inasistencias?fecha_inicio=${inicio}&fecha_fin=${fin}`);
            const data = await res.json();
            let html = `<div class="d-flex justify-content-between align-items-center mb-3"><h5 class="fw-bold text-danger">Total Ausentes: <span>${data.total}</span></h5>${data.total > 0 ? `<button class="btn btn-success" onclick="exportarTablaAExcel('tablaInasistencias', 'Reporte_Inasistencias.xlsx')">📥 Exportar a Excel</button>` : ''}</div><div class="table-responsive"><table class="table table-striped table-hover align-middle" id="tablaInasistencias"><thead class="table-danger"><tr><th>Tipo Doc</th><th>Documento</th><th>Nombres y Apellidos</th><th>Grado</th><th>Curso</th><th>Derecho / Estado</th></tr></thead><tbody>`;
            
            if (data.registros.length === 0) {
                html += `<tr><td colspan="6" class="text-center text-muted py-4">¡Excelente! Ningún estudiante con derecho activo estuvo ausente.</td></tr>`;
            } else {
                data.registros.forEach(r => {
                    html += `<tr><td>${r.nom_tipo_identificacion}</td><td>${r.doc_estudiante}</td><td>${r.nom_estudiante} ${r.ape_estudiante}</td><td>${r.nombre_grados}</td><td>${r.nombre_curso}</td><td><span class="badge bg-secondary">${r.nom_derecho}</span></td></tr>`;
                });
            }
            html += `</tbody></table></div>`;
            contenedor.innerHTML = html;
        } catch (e) {
            console.error(e);
            contenedor.innerHTML = `<div class="alert alert-danger">Error al consultar inasistencias.</div>`;
        }
    };

    window.cargarDashboardGraficas = async () => {
        const inicio = document.getElementById('dashFechaInicio').value;
        const fin = document.getElementById('dashFechaFin').value;
        const contenedor = document.getElementById('contenedorGraficas');
        contenedor.innerHTML = `<p class="text-muted">Generando dashboard estadístico...</p>`;

        try {
            const res = await fetch(`/api/reportes/dashboard?fecha_inicio=${inicio}&fecha_fin=${fin}`);
            const data = await res.json();

            contenedor.innerHTML = `<div class="row g-4"><div class="col-md-6"><div class="card shadow-sm p-3"><h5 class="text-center text-primary mb-3">Asistencias por Grado y Curso</h5><canvas id="chartAsistencias"></canvas></div></div><div class="col-md-6"><div class="card shadow-sm p-3"><h5 class="text-center text-danger mb-3">Inasistencias por Grado y Curso</h5><canvas id="chartInasistencias"></canvas></div></div></div>`;

            const labelsAsist = data.asistencias_curso.map(item => `${item.nombre_grados} - ${item.nombre_curso}`);
            const valoresAsist = data.asistencias_curso.map(item => item.cantidad);
            const labelsInasist = data.inasistencias_curso.map(item => `${item.nombre_grados} - ${item.nombre_curso}`);
            const valoresInasist = data.inasistencias_curso.map(item => item.cantidad);

            new Chart(document.getElementById('chartAsistencias'), {
                type: 'bar',
                data: {
                    labels: labelsAsist.length > 0 ? labelsAsist : ['Sin datos'],
                    datasets: [{ label: 'Desayunos Entregados', data: valoresAsist.length > 0 ? valoresAsist : [0], backgroundColor: 'rgba(13, 110, 253, 0.7)' }]
                },
                options: { scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
            });

            new Chart(document.getElementById('chartInasistencias'), {
                type: 'bar',
                data: {
                    labels: labelsInasist.length > 0 ? labelsInasist : ['Sin datos'],
                    datasets: [{ label: 'Estudiantes Ausentes', data: valoresInasist.length > 0 ? valoresInasist : [0], backgroundColor: 'rgba(220, 53, 69, 0.7)' }]
                },
                options: { scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
            });
        } catch (e) {
            console.error(e);
            contenedor.innerHTML = `<div class="alert alert-danger">Error al generar las gráficas del dashboard.</div>`;
        }
    };

    window.ejecutarLimpiezaPorFecha = async () => {
        const fecha = document.getElementById('fechaLimiteLimpieza').value;
        if (!fecha) { alert("Por favor seleccione una fecha límite."); return; }

        if (confirm(`¿Estás seguro de eliminar registros anteriores a ${fecha}?`)) {
            try {
                const res = await fetch(`/api/limpieza/ingresos?fecha_limite=${fecha}`, { method: 'DELETE' });
                const data = await res.json();
                if (res.ok) { alert(data.mensaje); cargarLimpiezaDatos(); } else { alert("Error: " + data.detail); }
            } catch (e) { console.error(e); alert("Error de conexión."); }
        }
    };

    window.ejecutarLimpiezaTotal = async () => {
        if (confirm("⚠️ ADVERTENCIA: ¿Vaciar TODO el historial de asistencias? Esta acción es irreversible.")) {
            try {
                const res = await fetch(`/api/limpieza/ingresos?limpiar_todo=true`, { method: 'DELETE' });
                const data = await res.json();
                if (res.ok) { alert(data.mensaje); cargarLimpiezaDatos(); } else { alert("Error: " + data.detail); }
            } catch (e) { console.error(e); alert("Error de conexión."); }
        }
    };

    window.ejecutarBackup = () => { window.location.href = '/api/backup'; };
    window.exportarTablaAExcel = (idTabla, nombreArchivo) => { XLSX.writeFile(XLSX.utils.table_to_book(document.getElementById(idTabla), { sheet: "Reporte" }), nombreArchivo); };

    window.descargarQR = async (documento, nombreCompleto) => {
        try {
            const res = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${documento}`;
            const response = await fetch(res);
            const blob = await response.blob();
            const link = document.createElement('a');
            link.href = window.URL.createObjectURL(blob);
            link.download = `QR_${documento}_${nombreCompleto.replace(/\s+/g, '_')}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) { console.error(error); alert("No se pudo descargar el QR."); }
    };

    window.prepararEditar = (est) => {
        document.getElementById('editDocOriginal').value = est.doc_estudiante;
        document.getElementById('editDoc').value = est.doc_estudiante;
        document.getElementById('editNombre').value = est.nom_estudiante;
        document.getElementById('editApellido').value = est.ape_estudiante;
        document.getElementById('editGrado').value = est.id_grados;
        document.getElementById('editCurso').value = est.id_curso;
        document.getElementById('editDerecho').value = est.id_derecho;
        new bootstrap.Modal(document.getElementById('modalEditarEstudiante')).show();
    };

    window.eliminarEstudiante = async (documento) => {
        if (confirm(`¿Eliminar estudiante con documento ${documento}?`)) {
            const res = await fetch(`/api/estudiantes/${documento}`, { method: 'DELETE' });
            if (res.ok) { localStorage.setItem('moduloActivo', 'estudiantes'); cargarGestionEstudiantes(); }
            else { alert("No se pudo eliminar."); }
        }
    };

    window.eliminarUsuario = async (idUsuario) => {
        if (confirm("¿Eliminar este usuario?")) {
            const res = await fetch(`/api/usuarios/${idUsuario}`, { method: 'DELETE' });
            if (res.ok) { localStorage.setItem('moduloActivo', 'usuarios'); cargarGestionUsuarios(); }
            else { alert("No se pudo eliminar."); }
        }
    };

    // ==========================================
    // CONTROLADOR DEL MENÚ LATERAL Y PERSISTENCIA
    // ==========================================
    const moduloGuardado = localStorage.getItem('moduloActivo') || 'reporte';
    document.querySelectorAll('.sidebar a').forEach(a => a.classList.remove('active'));

    if (moduloGuardado === 'estudiantes') {
        const m = document.getElementById('menu-estudiantes'); if(m) m.classList.add('active'); cargarGestionEstudiantes();
    } else if (moduloGuardado === 'usuarios') {
        const m = document.getElementById('menu-usuarios'); if(m) m.classList.add('active'); cargarGestionUsuarios();
    } else if (moduloGuardado === 'grados') {
        const m = document.getElementById('menu-grados'); if(m) m.classList.add('active'); cargarGestionGradosYCursos();
    } else if (moduloGuardado === 'derechos') {
        const m = document.getElementById('menu-derechos'); if(m) m.classList.add('active'); cargarGestionDerechos();
    } else if (moduloGuardado === 'qr') {
        const m = document.getElementById('menu-qr'); if(m) m.classList.add('active'); cargarLectorManual();
    } else if (moduloGuardado === 'reportes') {
        const m = document.getElementById('menu-reportes'); if(m) m.classList.add('active'); cargarGestionReportes();
    } else if (moduloGuardado === 'limpieza') {
        const m = document.getElementById('menu-limpieza'); if(m) m.classList.add('active'); cargarLimpiezaDatos();
    } else if (moduloGuardado === 'backup') {
        const m = document.getElementById('menu-backup'); if(m) m.classList.add('active'); cargarCopiasSeguridad();
    } else if (moduloGuardado === 'creditos') {
        const m = document.getElementById('menu-creditos'); if(m) m.classList.add('active'); cargarCreditos();
    } else {
        const m = document.getElementById('menu-reporte-dia'); if(m) m.classList.add('active'); cargarReporteDelDia();
    }

    const vincularMenu = (id, modulo, callback) => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('click', (e) => {
                e.preventDefault();
                localStorage.setItem('moduloActivo', modulo);
                document.querySelectorAll('.sidebar a').forEach(a => a.classList.remove('active'));
                el.classList.add('active');
                callback();
            });
        }
    };

    vincularMenu('menu-reporte-dia', 'reporte', cargarReporteDelDia);
    vincularMenu('menu-estudiantes', 'estudiantes', cargarGestionEstudiantes);
    vincularMenu('menu-usuarios', 'usuarios', cargarGestionUsuarios);
    vincularMenu('menu-grados', 'grados', cargarGestionGradosYCursos);
    vincularMenu('menu-derechos', 'derechos', cargarGestionDerechos);
    vincularMenu('menu-qr', 'qr', cargarLectorManual);
    vincularMenu('menu-reportes', 'reportes', cargarGestionReportes);
    vincularMenu('menu-limpieza', 'limpieza', cargarLimpiezaDatos);
    vincularMenu('menu-backup', 'backup', cargarCopiasSeguridad);
    vincularMenu('menu-creditos', 'creditos', cargarCreditos);
});