document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault(); // Evita que la página se recargue
    
    const nombre = document.getElementById('nombreUsuario').value;
    const password = document.getElementById('passwordUsuario').value;
    const mensajeError = document.getElementById('mensajeError');

    try {
        // Hacemos la petición POST a nuestro servidor FastAPI
        const respuesta = await fetch('http://127.0.0.1:8003/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ nombre, password })
        });

        if (respuesta.ok) {
            const datos = await respuesta.json();
            
            // Guardamos temporalmente los datos en el navegador para usarlos en la siguiente pantalla
            localStorage.setItem('usuarioRol', datos.rol);
            localStorage.setItem('usuarioNombre', datos.nombre);
            
            // Redirección condicionada por el rol
            if (datos.rol === 'ADMINISTRADOR') {
                window.location.href = 'admin.html';
            } else {
                window.location.href = 'operador.html';
            }
        } else {
            // Si hay error (401 o 404), mostramos la alerta
            mensajeError.classList.remove('d-none');
        }
    } catch (error) {
        console.error("Error al conectar con el backend:", error);
        alert("Error de conexión con el servidor. ¿Está encendido Uvicorn?");
    }
});