document.addEventListener('DOMContentLoaded', () => {
    const rol = localStorage.getItem('usuarioRol');
    const nombre = localStorage.getItem('usuarioNombre');

    if (!rol) {
        alert("Acceso denegado. Serás redirigido al Login.");
        window.location.href = 'index.html';
        return;
    }
    const elNombreOp = document.getElementById('nombreOperador');
    if (elNombreOp) elNombreOp.textContent = `Operador: ${nombre}`;

    const btnSalir = document.getElementById('btn-cerrar-sesion');
    if (btnSalir) {
        btnSalir.addEventListener('click', () => {
            localStorage.clear();
            window.location.href = 'index.html';
        });
    }

    // ==========================================
    // Generador de Sonidos Robusto (Web Audio API)
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
                osc.frequency.setValueAtTime(800, audioCtx.currentTime);
                gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
                osc.start();
                osc.stop(audioCtx.currentTime + 0.2);
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
    // SINCRONIZACIÓN CON LOS REGISTROS DEL DÍA
    // ==========================================
    async function sincronizarTablaDelDia() {
        try {
            const respuesta = await fetch('http://127.0.0.1:8003/api/reporte-dia');
            if (!respuesta.ok) return;

            const datos = await respuesta.json();
            const tablaIngresos = document.getElementById('tablaIngresosRecientes');
            const contadorSesion = document.getElementById('contadorSesion');

            if (!tablaIngresos) return;

            if (contadorSesion) {
                contadorSesion.textContent = `${datos.total_atendidos} registros`;
            }

            if (!datos.registros || datos.registros.length === 0) {
                tablaIngresos.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-4">Aún no hay registros en esta sesión.</td></tr>`;
                return;
            }

            let html = '';
            // Mostramos los más recientes arriba
            const registrosInvertidos = [...datos.registros].reverse();
            registrosInvertidos.forEach(reg => {
                html += `
                    <tr>
                        <td><span class="badge bg-success">${reg.hora_ingreso}</span></td>
                        <td class="fw-bold">${reg.doc_estudiante}</td>
                        <td>${reg.nom_estudiante} ${reg.ape_estudiante}</td>
                        <td><span class="badge bg-secondary">${reg.nombre_grados} ${reg.nombre_curso}</span></td>
                    </tr>
                `;
            });
            tablaIngresos.innerHTML = html;
        } catch (err) {
            console.error("Error al sincronizar los ingresos del día:", err);
        }
    }

    // Cargar los registros de hoy al abrir la sesión
    sincronizarTablaDelDia();

    async function iniciarScannerOperador() {
        if (window.html5QrCodeInstance) {
            try {
                await window.html5QrCodeInstance.stop();
                await window.html5QrCodeInstance.clear();
            } catch (e) {}
            window.html5QrCodeInstance = null;
        }

        const readerElement = document.getElementById('lector-qr');
        if (!readerElement) return;

        const html5QrCode = new Html5Qrcode("lector-qr");
        window.html5QrCodeInstance = html5QrCode;

        const config = { fps: 10, qrbox: { width: 300, height: 300 } };
        let escaneando = false; 

        try {
            await html5QrCode.start(
                { facingMode: "environment" }, 
                config, 
                async (decodedText) => {
                    if (escaneando) return; 
                    
                    escaneando = true; 
                    const documento = decodedText.trim();
                    let tiempoPausa = 3000;
                    const zonaAlertas = document.getElementById('zonaAlertas');

                    try {
                        const respuesta = await fetch('http://127.0.0.1:8003/api/escanear', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ doc_estudiante: documento })
                        });

                        if (!respuesta.ok) {
                            if (zonaAlertas) zonaAlertas.innerHTML = `<div class="alert alert-danger text-center py-3 fs-5 fw-bold mb-0">❌ Estudiante NO encontrado.</div>`;
                            reproducirSonido('denegado');
                        } else {
                            const resultado = await respuesta.json();
                            const estudiante = resultado.datos;
                            const estado = (resultado.estado || '').toLowerCase().trim();
                            const infoEstudiante = `<br><span class="fs-6 text-dark">${estudiante.nom_estudiante} ${estudiante.ape_estudiante} (${estudiante.nombre_grados} ${estudiante.nombre_curso})</span>`;

                            if (estado === 'aprobado') {
                                if (zonaAlertas) zonaAlertas.innerHTML = `<div class="alert alert-success text-center py-3 fs-4 fw-bold shadow-sm mb-0">✅ ACCESO APROBADO ${infoEstudiante}</div>`;
                                reproducirSonido('aprobado');
                                
                                // Actualiza la tabla consultando de inmediato los registros de hoy
                                await sincronizarTablaDelDia();
                                
                                tiempoPausa = 3000; 
                            } 
                            else if (estado === 'advertencia') {
                                if (zonaAlertas) zonaAlertas.innerHTML = `<div class="alert alert-warning text-center py-3 fs-5 fw-bold shadow-sm mb-0">⚠️ ATENCIÓN: YA ATENDIDO HOY ${infoEstudiante}</div>`;
                                reproducirSonido('advertencia');
                                // Al ser repetido, el servidor no crea un ingreso nuevo, por lo que la lista no se altera
                            } 
                            else if (estado === 'denegado') {
                                if (zonaAlertas) zonaAlertas.innerHTML = `<div class="alert alert-danger text-center py-3 fs-5 fw-bold shadow-sm mb-0">⛔ ACCESO DENEGADO<br>${resultado.mensaje}</div>`;
                                reproducirSonido('denegado');
                            }
                        }
                    } catch (error) {
                        console.error("Error en petición de escaneo:", error);
                        if (zonaAlertas) zonaAlertas.innerHTML = `<div class="alert alert-danger py-3 fs-6 mb-0">Error de conexión con el servidor.</div>`;
                        reproducirSonido('denegado');
                    }

                    setTimeout(() => { 
                        escaneando = false; 
                        if (zonaAlertas) zonaAlertas.innerHTML = `<div class="alert alert-secondary py-3 fs-5 fw-semibold mb-0">Cámara lista. Esperando código...</div>`;
                    }, tiempoPausa);
                },
                (error) => {}
            );
        } catch (err) {
            console.error("No se pudo iniciar la cámara:", err);
            const zonaAlertas = document.getElementById('zonaAlertas');
            if (zonaAlertas) zonaAlertas.innerHTML = `<div class="alert alert-danger py-3 fs-6 mb-0">No se pudo acceder a la cámara. Verifica los permisos.</div>`;
        }
    }

    if (!window.Html5Qrcode) {
        const script = document.createElement('script');
        script.src = "https://unpkg.com/html5-qrcode";
        script.onload = () => iniciarScannerOperador();
        document.head.appendChild(script);
    } else {
        iniciarScannerOperador();
    }
});