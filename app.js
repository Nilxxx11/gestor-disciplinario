// app.js - Lógica principal de la aplicación

// ========== VARIABLES GLOBALES ==========
let registros = [];
let currentPreviewId = null;
let currentUser = null;
const { jsPDF } = window.jspdf;
let areasDisponibles = new Set();

// ========== UTILIDADES ==========
function mostrarCarga(texto = "Cargando, por favor espere...") {
    const loadingEl = document.getElementById('loading');
    const loadingText = document.getElementById('loadingText');
    if (loadingText) loadingText.textContent = texto;
    if (loadingEl) loadingEl.style.display = 'flex';
}

function ocultarCarga() {
    const loadingEl = document.getElementById('loading');
    if (loadingEl) loadingEl.style.display = 'none';
}

function mostrarMensaje(texto, tipo) {
    const messageEl = document.getElementById('message');
    if (!messageEl) return;

    messageEl.textContent = texto;
    messageEl.className = `message-card ${tipo}`;
    messageEl.style.display = 'block';

    setTimeout(() => {
        messageEl.style.display = 'none';
    }, 5000);
}

function formatearFecha(fechaString) {
    try {
        const fecha = new Date(fechaString);
        if (isNaN(fecha.getTime())) return fechaString;
        return fecha.toLocaleDateString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (e) {
        return fechaString;
    }
}

// ========== ESTADO DE CONEXIÓN ==========
function actualizarEstadoConexion(conectado) {
    const statusElement = document.getElementById('connectionStatus');
    if (!statusElement) return;

    const statusDot = statusElement.querySelector('.status-dot');
    const statusText = statusElement.querySelector('span:last-child');

    if (conectado) {
        if (statusDot) statusDot.className = 'status-dot online';
        if (statusText) statusText.textContent = 'Conectado';
    } else {
        if (statusDot) statusDot.className = 'status-dot offline';
        if (statusText) statusText.textContent = 'Sin conexión';
    }
}

// ========== AUTENTICACIÓN ==========
function actualizarUIUsuario(user) {
    const userName = document.getElementById('userName');
    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const adminTab = document.getElementById('adminTab');

    if (user) {
        // Usuario autenticado
        currentUser = user;
        if (userName) userName.textContent = user.email || 'Admin';
        if (loginBtn) loginBtn.style.display = 'none';
        if (logoutBtn) logoutBtn.style.display = 'flex';
        if (adminTab) adminTab.style.display = 'flex';

        // Cargar registros si estamos en admin
        if (document.getElementById('admin-section')?.classList.contains('active')) {
            cargarRegistros();
        }
    } else {
        // Usuario no autenticado
        currentUser = null;
        if (userName) userName.textContent = 'Usuario';
        if (loginBtn) loginBtn.style.display = 'flex';
        if (logoutBtn) logoutBtn.style.display = 'none';
        if (adminTab) adminTab.style.display = 'none';

        // Si está en admin, redirigir a form
        if (document.getElementById('admin-section')?.classList.contains('active')) {
            document.querySelector('.nav-tab[data-target="form-section"]')?.click();
        }
    }
}

function mostrarLoginModal() {
    const modal = document.getElementById('loginModal');
    if (modal) modal.style.display = 'flex';
}

function cerrarLoginModal() {
    const modal = document.getElementById('loginModal');
    if (modal) modal.style.display = 'none';
}

function iniciarSesion(email, password) {
    mostrarCarga("Iniciando sesión...");

    auth.signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
            actualizarUIUsuario(userCredential.user);
            cerrarLoginModal();
            mostrarMensaje('Sesión iniciada correctamente', 'success');
        })
        .catch((error) => {
            console.error('Error de login:', error);
            let mensaje = 'Error al iniciar sesión';
            if (error.code === 'auth/user-not-found') mensaje = 'Usuario no encontrado';
            if (error.code === 'auth/wrong-password') mensaje = 'Contraseña incorrecta';
            if (error.code === 'auth/invalid-credential') mensaje = 'Credenciales inválidas';
            mostrarMensaje(mensaje, 'error');
        })
        .finally(ocultarCarga);
}

function cerrarSesion() {
    auth.signOut()
        .then(() => {
            actualizarUIUsuario(null);
            mostrarMensaje('Sesión cerrada correctamente', 'success');
        })
        .catch((error) => {
            mostrarMensaje('Error al cerrar sesión', 'error');
        });
}

// ========== INICIALIZACIÓN ==========
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM cargado, inicializando aplicación...');

    // Verificar que Firebase esté disponible
    if (typeof firebase === 'undefined') {
        console.error('Firebase no está disponible');
        mostrarMensaje('Error: Firebase no se cargó correctamente', 'error');
        return;
    }

    // Configurar fecha actual
    const today = new Date().toISOString().split('T')[0];
    const fechaInput = document.getElementById('fechaSolicitud');
    if (fechaInput) fechaInput.value = today;

    // Configurar navegación
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            const targetId = this.getAttribute('data-target');

            document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
            this.classList.add('active');

            document.querySelectorAll('.section').forEach(section => {
                section.classList.remove('active');
            });

            const targetSection = document.getElementById(targetId);
            if (targetSection) targetSection.classList.add('active');

            if (targetId === 'admin-section' && currentUser) {
                cargarRegistros();
            }
        });
    });

    // Event listeners del formulario
    const form = document.getElementById('solicitudForm');
    if (form) form.addEventListener('submit', guardarSolicitud);

    const btnLimpiar = document.getElementById('btnLimpiar');
    if (btnLimpiar) btnLimpiar.addEventListener('click', limpiarFormulario);

    // Event listeners de búsqueda y filtros
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.addEventListener('input', filtrarRegistros);

    const filterArea = document.getElementById('filterArea');
    if (filterArea) filterArea.addEventListener('change', filtrarRegistros);

    const filterDate = document.getElementById('filterDate');
    if (filterDate) filterDate.addEventListener('change', filtrarRegistros);

    const btnResetFilters = document.getElementById('btnResetFilters');
    if (btnResetFilters) btnResetFilters.addEventListener('click', resetearFiltros);

    // Event listeners de modales
    const closePreview = document.getElementById('closePreview');
    if (closePreview) closePreview.addEventListener('click', cerrarPreview);

    const btnDownloadPDF = document.getElementById('btnDownloadPDF');
    if (btnDownloadPDF) btnDownloadPDF.addEventListener('click', descargarPDF);

    const closeLoginModal = document.getElementById('closeLoginModal');
    if (closeLoginModal) closeLoginModal.addEventListener('click', cerrarLoginModal);

    const closeDetailModal = document.getElementById('closeDetailModal');
    if (closeDetailModal) closeDetailModal.addEventListener('click', cerrarDetailModal);

    const detailCloseBtn = document.getElementById('detailCloseBtn');
    if (detailCloseBtn) detailCloseBtn.addEventListener('click', cerrarDetailModal);

    const detailDownloadBtn = document.getElementById('detailDownloadBtn');
    if (detailDownloadBtn) detailDownloadBtn.addEventListener('click', () => {
        if (currentPreviewId) {
            cerrarDetailModal();
            mostrarPreview(currentPreviewId);
        }
    });

    // User menu dropdown
    const userMenu = document.getElementById('userMenu');
    const userDropdown = document.getElementById('userDropdown');

    if (userMenu && userDropdown) {
        userMenu.addEventListener('click', (e) => {
            e.stopPropagation();
            userDropdown.classList.toggle('show');
        });

        document.addEventListener('click', () => {
            userDropdown.classList.remove('show');
        });

        userDropdown.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }

    // Login buttons
    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) {
        loginBtn.addEventListener('click', () => {
            mostrarLoginModal();
            userDropdown.classList.remove('show');
        });
    }

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            cerrarSesion();
            userDropdown.classList.remove('show');
        });
    }

    // Login form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail')?.value;
            const password = document.getElementById('loginPassword')?.value;
            if (email && password) {
                iniciarSesion(email, password);
            }
        });
    }

    // Monitorear conexión Firebase
    if (firebase.database) {
        firebase.database().ref('.info/connected').on('value', (snapshot) => {
            actualizarEstadoConexion(snapshot.val() === true);
        });
    }

    // Monitorear estado de autenticación
    auth.onAuthStateChanged((user) => {
        actualizarUIUsuario(user);
        if (user) {
            // Usuario autenticado, cargar datos
            cargarRegistros();
        }
    });

    // Cerrar modales con click fuera
    window.addEventListener('click', (e) => {
        const loginModal = document.getElementById('loginModal');
        const previewModal = document.getElementById('previewModal');
        const detailModal = document.getElementById('detailModal');

        if (e.target === loginModal) cerrarLoginModal();
        if (e.target === previewModal) cerrarPreview();
        if (e.target === detailModal) cerrarDetailModal();
    });
});

// ========== FUNCIONES DEL FORMULARIO ==========
function validarFormulario() {
    const camposRequeridos = [
        'fechaSolicitud', 'nombre', 'cedula', 'cargo',
        'area', 'jefe', 'fechasHechos', 'lugar', 'descripcion'
    ];

    for (const campoId of camposRequeridos) {
        const campo = document.getElementById(campoId);
        if (!campo || !campo.value.trim()) {
            mostrarMensaje(`Todos los campos obligatorios deben ser completados`, 'error');
            if (campo) campo.focus();
            return false;
        }
    }
    return true;
}

function limpiarFormulario() {
    const form = document.getElementById('solicitudForm');
    if (form) form.reset();

    const today = new Date().toISOString().split('T')[0];
    const fechaInput = document.getElementById('fechaSolicitud');
    if (fechaInput) fechaInput.value = today;

    const nombreInput = document.getElementById('nombre');
    if (nombreInput) nombreInput.focus();
}

function guardarSolicitud(e) {
    e.preventDefault();

    if (!validarFormulario()) return;

    mostrarCarga("Guardando solicitud...");

    const solicitud = {
        fechaSolicitud: document.getElementById('fechaSolicitud')?.value || '',
        nombre: document.getElementById('nombre')?.value.trim() || '',
        cedula: document.getElementById('cedula')?.value.trim() || '',
        cargo: document.getElementById('cargo')?.value.trim() || '',
        area: document.getElementById('area')?.value.trim() || '',
        jefe: document.getElementById('jefe')?.value.trim() || '',
        fechasHechos: document.getElementById('fechasHechos')?.value.trim() || '',
        lugar: document.getElementById('lugar')?.value.trim() || '',
        descripcion: document.getElementById('descripcion')?.value.trim() || '',
        infoAdicional: document.getElementById('infoAdicional')?.value.trim() || '',
        fechaRegistro: new Date().toISOString(),
        timestamp: firebase.database.ServerValue.TIMESTAMP,
        creadoPor: currentUser ? currentUser.email : 'anónimo'
    };

    const database = window.database;
    if (!database) {
        mostrarMensaje('Error: Base de datos no disponible', 'error');
        ocultarCarga();
        return;
    }

    const nuevaSolicitudKey = database.ref().child('solicitudes').push().key;
    const updates = {};
    updates['/solicitudes/' + nuevaSolicitudKey] = solicitud;

    database.ref().update(updates)
        .then(() => {
            mostrarMensaje('Solicitud guardada correctamente', 'success');
            limpiarFormulario();
            if (document.getElementById('admin-section')?.classList.contains('active') && currentUser) {
                cargarRegistros();
            }
        })
        .catch((error) => {
            console.error('Error:', error);
            mostrarMensaje('Error al guardar: ' + error.message, 'error');
        })
        .finally(ocultarCarga);
}

// ========== FUNCIONES DE ADMINISTRACIÓN ==========
function cargarRegistros() {
    if (!currentUser) {
        mostrarMensaje('Debe iniciar sesión para ver los registros', 'info');
        return;
    }

    mostrarCarga("Cargando registros...");

    const database = window.database;
    if (!database) {
        mostrarMensaje('Error: Base de datos no disponible', 'error');
        ocultarCarga();
        return;
    }

    database.ref('solicitudes').orderByChild('timestamp').once('value')
        .then((snapshot) => {
            registros = [];
            areasDisponibles.clear();

            const filterArea = document.getElementById('filterArea');
            if (filterArea) filterArea.innerHTML = '<option value="">Todas las áreas</option>';

            snapshot.forEach((childSnapshot) => {
                const registro = childSnapshot.val();
                registro.id = childSnapshot.key;
                registros.unshift(registro);

                if (registro.area && registro.area.trim() !== '') {
                    areasDisponibles.add(registro.area.trim());
                }
            });

            registros.sort((a, b) => {
                return new Date(b.fechaRegistro) - new Date(a.fechaRegistro);
            });

            if (filterArea) {
                areasDisponibles.forEach(area => {
                    const option = document.createElement('option');
                    option.value = area;
                    option.textContent = area;
                    filterArea.appendChild(option);
                });
            }

            actualizarTablaRegistros();
            ocultarCarga();
        })
        .catch((error) => {
            console.error('Error:', error);
            mostrarMensaje('Error al cargar registros: ' + error.message, 'error');
            ocultarCarga();
        });
}

function actualizarTablaRegistros() {
    const tbody = document.getElementById('registrosBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (registros.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-state">
                    <i class="fas fa-inbox"></i>
                    <p>No hay registros disponibles</p>
                </td>
            </tr>
        `;
        actualizarContadores(0, 0);
        return;
    }

    registros.forEach(registro => {
        const fechaFormateada = formatearFecha(registro.fechaSolicitud).split(',')[0];

        const fila = document.createElement('tr');
        fila.innerHTML = `
            <td>${fechaFormateada}</td>
            <td>${registro.nombre}</td>
            <td>${registro.cedula}</td>
            <td>${registro.cargo}</td>
            <td>${registro.area}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn-icon view-btn" data-id="${registro.id}" title="Ver detalles">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn-icon download-btn" data-id="${registro.id}" title="Descargar PDF">
                        <i class="fas fa-file-pdf"></i>
                    </button>
                    <button class="btn-icon danger delete-btn" data-id="${registro.id}" title="Eliminar">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(fila);
    });

    // Agregar event listeners
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', () => mostrarDetalleRegistro(btn.dataset.id));
    });

    document.querySelectorAll('.download-btn').forEach(btn => {
        btn.addEventListener('click', () => mostrarPreview(btn.dataset.id));
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', () => eliminarRegistro(btn.dataset.id));
    });

    actualizarContadores(registros.length, registros.length);
}

function filtrarRegistros() {
    const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';
    const areaFilter = document.getElementById('filterArea')?.value || '';
    const dateFilter = document.getElementById('filterDate')?.value || '';

    const filas = document.querySelectorAll('#registrosBody tr');
    let visibleCount = 0;

    filas.forEach(fila => {
        if (fila.classList.contains('empty-state')) return;

        const cells = fila.cells;
        if (cells.length < 6) return;

        const nombre = cells[1]?.textContent.toLowerCase() || '';
        const cedula = cells[2]?.textContent.toLowerCase() || '';
        const cargo = cells[3]?.textContent.toLowerCase() || '';
        const area = cells[4]?.textContent || '';
        const fechaTexto = cells[0]?.textContent || '';

        let coincide = true;

        if (searchTerm && !nombre.includes(searchTerm) &&
            !cedula.includes(searchTerm) && !cargo.includes(searchTerm)) {
            coincide = false;
        }

        if (areaFilter && area !== areaFilter) {
            coincide = false;
        }

        if (dateFilter && fechaTexto) {
            try {
                const fechaRegistro = new Date(fechaTexto.split('/').reverse().join('-'));
                const hoy = new Date();
                const diferenciaDias = Math.floor((hoy - fechaRegistro) / (1000 * 60 * 60 * 24));

                if (dateFilter === 'lastWeek' && diferenciaDias > 7) coincide = false;
                if (dateFilter === 'lastMonth' && diferenciaDias > 30) coincide = false;
                if (dateFilter === 'last3Months' && diferenciaDias > 90) coincide = false;
            } catch (e) {
                console.warn('Error al procesar fecha:', e);
            }
        }

        fila.style.display = coincide ? '' : 'none';
        if (coincide) visibleCount++;
    });

    actualizarContadores(visibleCount, registros.length);
}

function resetearFiltros() {
    const searchInput = document.getElementById('searchInput');
    const filterArea = document.getElementById('filterArea');
    const filterDate = document.getElementById('filterDate');

    if (searchInput) searchInput.value = '';
    if (filterArea) filterArea.value = '';
    if (filterDate) filterDate.value = '';

    filtrarRegistros();
}

function actualizarContadores(visibles, total) {
    const countEl = document.getElementById('countRecords');
    const totalEl = document.getElementById('totalRecords');

    if (countEl) countEl.textContent = visibles;
    if (totalEl) totalEl.textContent = total;
}

// ========== MODAL DE DETALLES (MEJORADO) ==========
function mostrarDetalleRegistro(id) {
    const registro = registros.find(r => r.id === id);
    if (!registro) return;

    currentPreviewId = id;

    const fechaSolicitud = formatearFecha(registro.fechaSolicitud);
    const fechaRegistro = formatearFecha(registro.fechaRegistro);

    const html = `
        <div class="detail-card">
            <div class="detail-header">
                <h2>${registro.nombre}</h2>
                <div class="detail-subtitle">
                    <i class="fas fa-id-card"></i>
                    Cédula: ${registro.cedula}
                </div>
                <div class="detail-subtitle" style="margin-top: 4px;">
                    <i class="fas fa-calendar"></i>
                    Solicitado: ${fechaSolicitud}
                </div>
            </div>

            <div class="detail-section">
                <div class="detail-section-title">
                    <i class="fas fa-briefcase"></i>
                    Información Laboral
                </div>
                <div class="detail-grid">
                    <div class="detail-item">
                        <span class="detail-label">Cargo</span>
                        <span class="detail-value">${registro.cargo}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Área</span>
                        <span class="detail-value">${registro.area}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Jefe Inmediato</span>
                        <span class="detail-value">${registro.jefe}</span>
                    </div>
                </div>
            </div>

            <div class="detail-section">
                <div class="detail-section-title">
                    <i class="fas fa-clock"></i>
                    Detalles del Incidente
                </div>
                <div class="detail-grid">
                    <div class="detail-item">
                        <span class="detail-label">Fecha(s) de ocurrencia</span>
                        <span class="detail-value">${registro.fechasHechos}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Lugar</span>
                        <span class="detail-value">${registro.lugar}</span>
                    </div>
                </div>
            </div>

            <div class="detail-section">
                <div class="detail-section-title">
                    <i class="fas fa-align-left"></i>
                    Descripción de los Hechos
                </div>
                <div class="detail-description">
                    ${registro.descripcion}
                </div>
            </div>

            ${registro.infoAdicional ? `
            <div class="detail-section">
                <div class="detail-section-title">
                    <i class="fas fa-plus-circle"></i>
                    Información Adicional
                </div>
                <div class="detail-description" style="border-left-color: var(--warning-color);">
                    ${registro.infoAdicional}
                </div>
            </div>
            ` : ''}

            <div class="detail-section" style="background-color: #f8f9fa;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <span class="detail-label">Registrado por</span>
                        <div style="display: flex; align-items: center; gap: 8px; margin-top: 4px;">
                            <i class="fas fa-user-circle" style="color: var(--primary-color); font-size: 20px;"></i>
                            <span>${registro.creadoPor || 'anónimo'}</span>
                        </div>
                    </div>
                    <div>
                        <span class="detail-label">Fecha de registro</span>
                        <div style="margin-top: 4px;">${fechaRegistro}</div>
                    </div>
                    <span class="detail-badge">ID: ${registro.id.substring(0, 8)}</span>
                </div>
            </div>
        </div>
    `;

    const modalBody = document.getElementById('detailModalBody');
    if (modalBody) modalBody.innerHTML = html;

    const modal = document.getElementById('detailModal');
    if (modal) modal.style.display = 'flex';
}

function cerrarDetailModal() {
    const modal = document.getElementById('detailModal');
    if (modal) modal.style.display = 'none';
}

// ========== FUNCIONES DE ELIMINACIÓN ==========
function eliminarRegistro(id) {
    if (!confirm('¿Está seguro de eliminar este registro? Esta acción no se puede deshacer.')) return;

    mostrarCarga("Eliminando registro...");

    const database = window.database;
    if (!database) {
        mostrarMensaje('Error: Base de datos no disponible', 'error');
        ocultarCarga();
        return;
    }

    database.ref('solicitudes/' + id).remove()
        .then(() => {
            registros = registros.filter(r => r.id !== id);
            actualizarTablaRegistros();
            mostrarMensaje('Registro eliminado correctamente', 'success');
        })
        .catch((error) => {
            console.error('Error:', error);
            mostrarMensaje('Error al eliminar: ' + error.message, 'error');
        })
        .finally(ocultarCarga);
}

// ========== FUNCIONES DE PDF ==========
function mostrarPreview(id) {
    currentPreviewId = id;
    const registro = registros.find(r => r.id === id);
    if (!registro) return;

    const plantilla = generarPlantillaRellenada(registro);
    const previewContent = document.getElementById('previewContent');
    const previewModal = document.getElementById('previewModal');

    if (previewContent) {
        previewContent.innerHTML = plantilla;

        // Asegurar que la plantilla tenga dimensiones adecuadas para la captura
        setTimeout(() => {
            const plantillaElement = document.getElementById('plantillaPDF');
            if (plantillaElement) {
                plantillaElement.style.width = '210mm';
                plantillaElement.style.minHeight = '297mm';
                plantillaElement.style.padding = '10mm';
                plantillaElement.style.margin = '0 auto';
                plantillaElement.style.backgroundColor = '#ffffff';
                plantillaElement.style.boxSizing = 'border-box';
            }
        }, 100);
    }

    if (previewModal) {
        previewModal.style.display = 'flex';
    }
}

function cerrarPreview() {
    const previewModal = document.getElementById('previewModal');
    if (previewModal) previewModal.style.display = 'none';
    currentPreviewId = null;
}

function generarPlantillaRellenada(registro) {
    const fechaFormateada = formatearFecha(registro.fechaSolicitud).split(',')[0];

    // Logo en PNG convertido a Base64
const logoDataURI = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAACi0AAAQUCAYAAAAPj8hoAAAAAXNSR0IArs4c6QAAAARzQklUCAgICHwIZIgAACAASURBVHic7N17vCVkfd/772/tPTOgRBHwFimhTYyaaCLWJDaljYZBESXxJEAvSVuMOrPXGKNtzKVN2mPa5CTNpabxAkz04KlaU6aJxgsDs9cEjUnFO2q9SxiRWwSGSwXmttdz/hhAVOQ2e+9nrbXf79fLl3tm1t7zGV+is9b67udJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgMmwafG43gkAAAAAAAAAAABMprneAcyQM86fqyMOvzZP/5eH5e+e9oF8ZtuB3kkAAAAAAAAAAABMjkHvAGbII444PqkNVfVrdfRRn8lw9ILeSQAAAAAAAAAAAEwOo0WWz2DDd931ceX4St6e4eJ7s3nH0ztWAQAAAAAAAAAAMCGMFlk+bXzsN/9UpX6sBoMPZzj6kwz/4gk9sgAAAAAAAAAAAJgMRossn6rv+ra/lPyTyvh/Zzh6s/EiAAAAAAAAAADA2mS0yPKp9j338Yj5Sn7WeBEAAAAAAAAAAGBtMlpk2VTqvkaLd7r7ePH8bN7x9BUNAwAAAAAAAAAAYCJU7wBmRw1HVyZ53IP53Nbae1Pt1Tn72e9c5iwAAAAAAAAAAAAmhNEiy+OM8+fqmKMOHOqXaS1fTI3/a5b2npetp922HGkAAAAAAAAAAABMBqNFlseLLzi21q3/yrJ9vZabW+WN2b/02rzhOZcv29cFAAAAAAAAAACgm0HvAGbEunXHLuvXqzy8kn9T84MvZjh6Z4Y7fmJZvz4AAAAAAAAAAACrzkmLLI/NF51Wg7l3rvDv8jcteWOWDpyXradcs8K/FwAAAAAAAAAAAMvMSYssj8H8Mavwu/y9Sn6rBnO7nL4IAAAAAAAAAAAwfeZ7BzAjxuOjM1ilgzur1ldyWjI4LQujv22VN+ZA/r/88cYvrE4AAAAAAAAAAAAAD4broVkeC4uvqaqf75nQkv+V1t6S8Y3/PVvPvLlnCwAAAAAAAAAAAN/KaJHlsWX0Z9Xyf/XOSJK0tq9V3p2W/57x37wzWzfv750EAAAAAAAAAACA0SLLpIaL703qx3p3fIuWm9sgf5oDB96Sradc3DsHAAAAAAAAAABgLTNaZFnUcOcXk/Y9vTvuVcvftuRPMz7wPw0YAQAAAAAAAAAAVp/RIsuiFkY3pHJU744H4OqWvDlL7d3ZevJf9Y4BAAAAAAAAAABYC4wWWRY1HLXeDQ+aExgBAAAAAAAAAABWhdEih+6FFzyyDlv/1d4Zy6Ll+lZ5T7L0P7K0733ZetptvZMAAAAAAAAAAABmhdEih+7FFxxb69Z/pXfGCri9tbwnrV2Qtudd2Xra9b2DAAAAAAAAAAAAppnRIodu0+JTaq4+2TtjRbW21Ko+kFbvyYHxn+cNJ3+2dxIAAAAAAAAAAMC0MVrk0A0Xn1GpD/TOWGVfbi3vSC1d5BppAAAAAAAAAACA+8dokUO3NkeLd3d7a+0vk7w7+5cuzBtP+VLvIAAAAAAAAAAAgElktMih2zw6vQbZ1jtjcrQvtZYLk7oo493vz9Yzb+5dBAAAAAAAAAAAMAmMFjl0RovfXmv7WtWHUnVhlvb9Rc597lo+kRIAAAAAAAAAAFjj5nsHwEyrWl/JiWntxAzWJcPR1w6ewtjelwPZmTec/NneiQAAAAAAAAAAAKvFSYscuoXFl1TV1t4ZU6nlylZ5bzJ+X/aN35s3nvKl3kkAAAAAAAAAAAArxWiRQ7d59PIa5A97Z8wEI0YAAAAAAAAAAGCGuR4aJknl2Ep+Nhn8bNYPkoXR10eMWXp/zn7u53snAgAAAAAAAAAAPFhGizDJ7j5izCBZGF3fkvcmuSRt/L6c++yP9E4EAAAAAAAAAAC4v4wWYZpUjqnk9CSnpwbJcHR7S/46qUvSxn+V8Y2XZOuZN/fOBAAAAAAAAAAAuCdGizDdDq9kY9I2pioZPGIpw52fbW38/tT4g8n4EldKAwAAAAAAAAAAk8JoEWZJ1VzSnlxVT07mhslcMhzd2Fr+OpUPp7UPZrzno9l62vW9UwEAAAAAAAAAgLXHaBFm3yOq8vwkz09VMnd4Mhx9tiUfzXj8kbR2SbLrY9m6eX/vUAAAAAAAAAAAYLYZLcLa9KRKnpTB4GeTJO3v7cvC6NMt7ZLU+IMZt0tz7imf6NwIAAAAAAAAAADMGKNFIKlan+SESp2QzA0zSDIc3d5aLk3aR1PjjxgyAgAAAAAAAAAAh8poEfh2Dq/KP0jqHyRzuXPImORTrbWPJu0Taflo2t7PZOtpt/WOBQAAAAAAAAAAJp/RIvBAHJ7kh6vqh5NKKkk7bCnDnZ9taR9LyyeTpY9nvO+T2Xra9b1jAQAAAAAAAACAyWK0yKGrtnRwvcaaVDWXtCdX8uSD/zWYS+YOTxYWr2mpj6byqYzzieTA51wvDQAAAAAAAAAAa5ulGYdu8+j0GmRb7wymQGv7kvp0q3wqLZ9MG382S7d/NG/4yb/tnQYAAAAAAAAAAKw8Jy0Cq6dqfZITKjkhlaQGyeChyXB0Y2v5VNI+ndY+n7n24RzY9wVXTAMAAAAAAAAAwGwxWgQmwSOq8o+T+sepSloOXjE9HH21pV2alsvS6n+nlj6XA3s+7WRGAAAAAAAAAACYTq6H5tAt7PiHVYO/6p3BmnJjWvtMq/p0Wr6QNv5sBoPP5eyNf9M7DAAAAAAAAAAA+PaMFjl0w8VnVOoDvTMgre1LDb7QWj6TjL+YymeyNL4suflz2Xrmzb3zAAAAAAAAAABgrTNa5NBtvuD7arD+070z4D58tbV8LpXPHbxuOn+THPhi2v4vZutpt/WOAwAAAAAAAACAtcBokUP34guOrXXrv9I7Ax60lstatcvScllSl6VyWQ6Md2VP+2Le/Jxbe+cBAAAAAAAAAMCsMFrk0P3MBQ+rh6139S4zql3dWn0uabtSdfCExmq78rXx3+TNz/lq7zoAAAAAAAAAAJgmRossixqOWu8GWHWt3ZbUF1varqR2ZTz+YlK70pZ2pY75QrY+fX/vRAAAAAAAAAAAmCRGiyyLGo6uTPK43h0wWdrVSe1q7Y5RY9qutNqVjHelHbXLqBEAAAAAAAAAgLXGaJFlUQujT6bylN4dMF3adUntasmutFydunPYeODq3Fq7XD8NAAAAAAAAAMCsMVpkWdRwtD3JKb07YMbsSctXWrIraV9JBlck+XJauyrjA1dn/4ar8qZn3dQ7EgAAAAAAAAAA7q/53gHMhtby5TKBheV2WCqPr+TxBzfm7eDPVpLBfDK/lCws3pbUV1pyxdeHjeOrM87VGSxdl8GGK/L6Z13b8w8BAAAAAAAAAAB3MlpkuVzVOwDWpKqHJHlCJU/4+rCxkrkkmU/aUjIcLSX1laTtasl1abkulavS6upkvCtLS9dlT13nOmoAAAAAAAAAAFaa0SLLpF3rtnGYWHNJOz7J8ZV8/R/VumPgOD+fHJFkYbQ/VVfdbdy4O8lVSX0l4/F1mcsNqfFVef1zvtLpzwEA9PbMV83niT9ybMbz42w9+YreOQAAAAAAAEwfKzOWx+aLTqvB3Dt7ZwCrpV2XVrtTuaa17EpycypfTaur7xo4tgPX5pzn7updCgDczaYLH5tB25BxHZXB3MMyzkMzGDwyg/aQjOuRqfbQtDwylflKjk0yn9SxaW0+lWPv8+u37E7VLXf8YJzkiiRprd1x8nOSyjVptTc1vi1tcF1aO5BqV2apbs3c/uvyf9ruvPXUW1bqPwIAAAAAAAD6MlpkeSwsnlBVH+udAUyg1m5LDb6atF2ttduS+mpSu+4aKmS8K1m6LWlfNXIEgHuxsP34JElb99hU23C3weFcxnVsqg3SclySqsp3HfykOvg5B09dnjK1K60tpfKVltqdjG9OG3w5Nb4t4/xtKlekDlyT/e3WvOHUK3vXAgAAAAAAcP8YLbI8XnjBI+uw9V/tnQHMhD1JXZu061rLTUmuSnJzUjcm46uTui1pV2Wp3ZS5pZsyfuRV2fr0/b2jAeCevWqQhR85LsnXx4ZV82l1bDIeJIO/c/Bxd4wKqx1VqYfl6yccDlI5rlP89GhpqfpyWrumVXYnuTbJFWl1RTLelard2bPvmpx36nW9UwEAAAAAANY6o0WWTQ1HtyU5vHcHsAa17E/VVQdPdcxXW3JdWm5NatfBqynrK0nbk7Rr7zrVcc9hN+VNz7qpdzoAE+hfXPTQPHT8yBwYVOYHB08svPNUwzau1OCOEWE7KsnDUhlU7hgWtjw2VRvu93XKrLZbk7qmtfGXU7UrLV9Oa19OxrvSBruy9eQregcCAAAAAADMOqNFlk0tjD6ZylN6dwA8MO26ZHBr0q5Osq+1dnVS+w4OHpMkXz74sHZVqu0/+O9L+3Pr4Lq8+Tm3dssG4KA7B4bJ108yzHiQzB8cEd55dfLBBzw2yYZvGBkmRyX1sKRVcueVyqxdbZxWl7e0XQdHjXV5xktfSBvsym37Pp+3nnpL70IAlsFw8S8r9Xd6Z7Da2i0t9fmkfT5t/Lnsbx/MG0/5Uu8qgO7Oes9jsmHd0zIY/GDa+GlV9QNJre+dxaFrlV/P6ze+tXfHRFsYbUvV03tnALCGtFyWaq/N9bvflW1nLvXOgZ6MFlk+w9H5lZzROwNgVbXcnKob7zrlsWV/Dl5pnbuGj+Ol6zOYuzUZ35bkq6laStv/lSQxfgTWhE0XPjaDtiHJ3YaFSdrgsakc/LjaY9PufFPkrquSB5W68wTDQaruPOFwLomhAR20a1rL51O5PK0uPzh6WPp8zj3lE73LAHgAFhZvqcp39M5gArR2ZUu9L1UXZs++i3Leqdf1TgJYcZsuemKqnplB/YNKnpHke3snsTJaayfmnGf/de+OiTbc+fn4ZwCAHlouSw1enaWvnZetp93WOwd6MFpk+QxHv1HJf+idATCV7rzi+uAPrktya0sOpOXKJMkgt2Rcu5Mk1a5Jq31p43EqB6+xHIz3ZTy+OkmyZ7wnb3retav+ZwCmyxnnz+Xo7/j68K8GR6cNDr5539pcau5uv/YNg8LvSHL0HR+vq6rHHfzw7qPC5K7hIawFLS3VdrXU5Wn1iVT7RMZLl6cNPpGtJ9/cOw+AbzJcvK2Sw3tnMJH+uiX/I3v2/4kBIzAzXnThUZmfe34GeU4lP57kMb2TWB1tvP/7c+6pn+ndMdEWdt6UysN7ZwCwhrW2O6n/kr17t3oeylpjtMjyWRj9TFXe0jsDgLtp2ZOqa7/+cbv24Id3G0Qm46Su+PonjW9IBl87+DntQKpd+fVfGtySwb7dd/34hv9zdbaduW+F/xQwuxa2f9Owb3BEMjjmrh9WzafdebVx7hgT3u3H33Li4N1GhAetT+o77/brB69HBlbT5S35xjHj+qUP5jWn7u0dBrBW1XBxf5L53h1MttbaBamcm7P/17uTV4179wA8IJsuemLmBz+d1k49eJpiDXonsfra3va4/L/Pvrp3x8T6Fxc9NEfMf613BgDc4fYkr8uevb9rvMhaYbTI8nnx4jNqXX2gdwYAPd1xJfZd2tVJ7ho1tmRPWq69j88ZJ/WVb/nS46WrM6hvHEiOcyCDA1d+y2OT5Jzn7rrHn2e2fcsI8A4HBpX5wXfd46/d/Yrib3QPj2/rk3znN/3cXFV981XFc8k3/9w9fS6wJt15MmPVpVkaX5rUJ9Ly8Ww9+Yr7/mQADsnLLthQB9bt6Z3BFGm5rKX+KDfsPsc37QETbbj9CcncP0nLT1XVD/bOob92+5WH500v9Peeb2fT4omZG7y/dwYAfJOD48U2eF3OeZb3OplpRossn+G7H1E5bPd9PxAAurs6qXt5s+kbx5bf9lH3OMK8H6rtSRtMzxXe1QZpOe6+H3jPn1up+/e5ra1LDR53Hw86Iskx9/4YgKl1e0u7JC2XpuXSDOrSnL3xk72jAGbKpgufV3Nz7+6dwTRqt7Tk/8n1N73aeBGYGD/359+R9Yf/86T+VVX7EScqcjfXtrNPfmzviIm2MPqFVP3X3hkA8G3sT3JO9uz9T05eZFYZLbKsarj4t0k9qncHAADAbGjj1vLBJJem5ZKM65L88cYv9K4CmFoLi/+lKv+6dwbTrN3SMvcr+ez735D3vupA7xpgjdoy+qGM20Il/zyVw3rnMJHe2c4++Sd7R0y0hdF5qTqrdwYA3AfXRjOzjBZZXgujd1Xl+b0zAAAAZtjtLflAMv5gkkuyVJe6WhrgfhoufqKSH+idwQxo+UwbL/18tp5yce8UYA3ZfNE/yaB+oVI/2juFydYqv57Xn/xbvTsm2vAvFpO2sXcGANxPt6e138//2ff7eeupt/SOgeVgtMjyGo5+o5L/0DsDAABgbWmXt5ZLkjr4r3NO+lDvIoCJNFy8uZKH9c5gdrTkv2Upv5CtJ9/cuwWYUWecvz7HPGJzWvvlqjq2dw7ToSXPz9knv6d3x0RbGH0yVU/pnQEAD0hru1OD38quPa/L9lP39s6BQ2G0yPIajl5Qydt7ZwAAAKxtbdyS9yX1gSyN35fUB40pAJIMF2+r5PDeGcyadksbzP+zvO7HL+hdAsyQM85fn0c+4hdq3P5tqo7qncN0aUtLfz9bT/lY746JtrDz2lQe3TsDAB6kq5L2q7l+99uy7cyl3jHwYBgtsrxeMvrems/ne2cAAABwNy2tJR9P2vuSXJKM35tznvPV3lkAq62Gi/uSrOvdwWxqLa/NDTf+Yradua93CzDltiy+0liRQ9FS352zN/5N746JNtzZeicAwKFrl2Y8fmXOffbO3iXwQBktsuxqOLo5rtkBAACYXAdHjJ9N8t6DQ0YjRmANeNkFG+rAuj29M5hxLZ9p2fPsnHPaVb1TgCm0efGFqfYfXQPNoWq37H943nrqLb07JtbC4gmpgZMoAZgl70rql3L2jztkjKlhtMjyW1gcVdVJvTMAAAC4n+48ibHy3mT8vswfuCivOXVv7yyAZbXpwufV3Ny7e2ewJuxtqZNz9sb39w4BpsSmxRMzaK+tqh/sncIMaG1fO+fZG3pnTLTNoxdlUG/onQEAy2x/knOS2//vnP38G3vHwH0Z9A5gFtX7ehcAAADwAFSqKk+r5N9UBn9eB9bdluHor7Mw+vdZ2PnDvfMAlsVgzjfZslo2VNpfZjjaFAcHAPfmpaOjM9zxpppr7zNYZNlUfah3wsQbDE7onQAAK2BdkpelHfalLIw254zz53oHwb0xWmT5jccf7J0AAADAoahBJT9alf9Y1T5YC4u3Zrj4pxmONmXT4nG96wAelIrRIquq0s7NcPTvY7gI3JOFxWGN25cr9a+S8n4dy6ZVLu3dMPna3+tdAAArpuqoVJ2TY476SDYtntg7B76d+d4BzKD9Bz6eufW9KwAAAFguVQ+p5KeS/FQG1drC6LOpXJjx0oU59zmLvfMA7p92vO0Yq63SfqMNR8fl+t2bs+3Mpd49wARY2H58Mv+2qjyjdwozatyctHhfWh7tr4UAzL56aubq/RnufHNq8Mt5/bOu7V0Ed+evY6yIWlj8bKqe2LsDAACAFdbaba1yYdrgHRmP35mtJ9/cOwngHg0Xb63kIb0zWJta6o2Gi0C27Hh5jet3Ujmsdwqzqw3mnpHX/bhb0e7Nws6vpHJs7wwAWEW3ZFz/NruvP9fzUiaF4+ZZES0Z9W4AAABgFVQ9pFI/VdX+Ww3qxiyM/jrDxV/KS0bf2zsN4O6qZV3vBtauSntRjjnq3Jxx/lzvFqCDn9vxnVlYvLha/aHBIitu/37fSHbfHt07AABW2cMyaK/LMUd/IC++6O/3joHEaJGV0sbv650AAADAKqtUVX60Ur9b8/l8FkafzsLot/KS0Q/1TgNIMt87gLXtjuHir8UNSLC2bF78ydpQn6/KM3unsEYMsrt3wkR78UV/N+WbWQBYs34o6+Y/kuHOs3PW24/sHcPaZrTIyphb/1e9EwAAAOirKt9XlX9X8/lQhqMrMxz9QTZfdHLvLmAN2rzjpJShGP1V2m9kYfGFvTuAVTLc8doatD9LckTvFNaQG26+qXfCRFu/7oTeCQAwARZy2MM+lc2j03uHsHZ5oY4VUwujT6bylN4dAAAATJjWdrfkT9LG78i5z1nsnQOsAQsX/XbV4Fd7Z8CdWtWP5/UbL+7dAayQl46OzlLbUZWn9U5hzflSO/vkx/eOmGgLo/+cql/unQEAE+Qd2b/3ZXnDqVf2DmFtcdIiK6bV+N29GwAAAJhAVUdV1ZYazO2ohcUbsrD4OldIAyuqBif1ToC7q9a2Z8t7HtO7A1gBmy58VpbaZQaL9FDJh3o3TLzK9/dOAIAJ84Ks2/CpLOw8q3cIa4vRIivnQC7qnQAAAMCEu3PAeOcV0guj38+mRaf2A8usPaF3AXyTDTVe9+Gcdd5hvUOAZTS8aFPNzV1UlYf3TmFtGieX9m6YfHVM7wIAmEBHpnJehn9xcRa2H987hrXBaJGVc+WBS5Lc3jsDAACA6VDJ46ryizVXn8zC6NMZLv5SNi0e17sLmAU137sAvkXVsTns2Dckqd4pwDJY2PFfK3V2knW9U1jLmpMW71M9qncBAEyu9szU+k9lePFLe5cw+4wWWTnbT93bWi7snQEAAMD0qcr3Vep3a1C7srD4V1lYfEledsGG3l3AdKpmQMJkqsrPZGH0vN4dwCEaLm6vql9Iyvtu9LV/6cbeCROvjR/dOwEAJtwRyfi1Gf7F9rz4gmN7xzC7PHliZQ3yP3onAAAAMMUqVVX/sKq21v71t2Zh9JZsvujk3lnA1HHSIhOrqr0rZ739yN4dwINwxvnrM1z8RCWn9E6Bg9ru3gUTbWHn41L1kN4ZADAd2ilZt+FTGY5+tncJs8lokRU2977eBQAAAMyIylxVfqYGczsyXLwyC4u/6fpo4D5t3vH0lOt3mWx1+BHbc8b5c707gAfgpaOjc/SRn6jkB3qnwF1u/tpNvRMm2/jJvQsAYMocmdSbs7Bzm2+2Y7kZLbKyXv+sa1trO3tnAAAAMFsq9biq+rU7ro8eZdOOM3o3AROqytW7TINn5JFHn9o7ArifXjo6OuP2iap6Yu8UuEvL7mw782u9MyZaq6f1TgCAqVQ5PYc97FMZjjb2TmF2GC2yGv577wAAAABm1MHro0+qucH5NRxdn4XR72fzjsf3zgImSDUvqDMVqo235ef+/Dt6dwD34c7BYvK43inwDaou7Z0w8QZ1Qu8EAJhalWOTWsxw5+/lmRfP985h+hktsvIG8xf0TgAAAGBNOLoqv1g1+HwWFkfZfNFpvYOASVBP6V0A99OGrH/IH/aOAO6FwSITrLX2od4Nk689tncBAMyAV+ZJSx/Oiy78nt4hTDejRVaeK6IBAABYTXeevjiYe2cWRtdluPjr2bT48N5ZQCetreudAPdXVX4uWy76O707gHtgsMjEM1q8b/Wo3gUAMBvqqVm/7uNZ2HlW7xKml9Eiq8UV0QAAAKy6qhxTqf9Uc9mdhcW35CWjH+rdBKyuSrmyiKlSbXB+8iqv3cMkMVhkKoyv6l0w8Voe3TsBAGbIEamcl+HON2fLxUf0jmH6eOGD1VF7355kf+8MAAAA1qoaVNXP1Fw+mIXRh7N5dHrvImDVOGmRafOMDP/x43tHAHc44/z1WWofM1hk4u3P7t4JE+2si49MxQn8ALD8fjZt/PG8ZMdTe4cwXYwWWR1nP//GlryjdwYAAABrXKWq8vQaZFuGi1dm8+LL8rILNvTOAlbI5h1PT6V6Z8ADVW3pz3LG+XO9O4Akxzziw1U5rncG3Ke5/Tf1Tpho6w88uXcCAMyw78n83PtdF80DYbTIKqrzehcAAADAnSr1uBrUH9X+dbsz3Pl72bTozWiYNVXP650AD0rl+3LMMd/TOwPWvOGOCyr5gd4ZcL9s/aiTFu/NoJ7WOwEAZtzB66K37DwvZ118WO8YJp/RIqvn+ht2pOVve2cAAADAN6h6SKW9suZyeYajN2TT4lN6JwHLpHJi7wR4sKot/VnyKq/hQy/Di15fqef2zoD76dLkVePeERPuhN4BALAmtJyVw5c+kIXtx/dOYbJ5wYPVs+3MpZZ2du8MAAAAuGc1qORFNahPZLj4P7Nl0dgJpl3LD/VOgAet8n1Z+DGnAEMPwwtfUanNvTPg/mrJh3o3TLyq7+qdAABrRz01tf7j2Tw6pXcJk8tokdU13v+W3gkAAABwrypVqZ+ucf1lhqPFDC/8R72TgAepMt87AQ5F1YE39W6ANWfThc+qzP1uUt5DY3q0XNo7YeK1dkzvBABYY47MoN6VLTt/rXcIk8kTLlbX1lMvay1v750BAAAA96lSlWyszP9lFkYfzsLo+b2TgAemWlvXuwEO0Y/lX/7Z0b0jYM34uR3fmbm5dyTx/x9MmfbJ3gWTrx7Vi3u01gAAIABJREFUuwAA1qD5tPxmFnZuy5aLj+gdw2QxWmT1jcfn9E4AAACAB6IqT6/Ku4wXYco4aZFZ8NAjXFELq2VD/rqSh/XOgAesHbixd8JE2/SRdak8uncGAKxZldPTxh/Iwvbje6cwOYwWWX033rQzaV/qnQEAAAAPlPEiTJFN73mKqz2ZBZX6D3nuBRt6d8DMGy7+eaW8icp02j9/U++EyXbD03oXAAB5crL+w1lYfGbvECaDF+1YfdvOXGpVv9M7AwAAAB6sqjy9kndmOFrMlsUTe/cA92Bu/Um9E2CZbMhx67+7dwTMtIXFYaX5hhSm1/iq3b0TJlrNPbl3AgCQpHJMarCYLRe/qHcK/Rkt0sfN+7alxRMoAAAAplelKtlY4/rLDBcXs2nxKb2TgG/wvN4BsFxq0F7fuwFm1nD7E6ryB07nZYpdmze9cE/viIk2GJzQOwEAuMt82vgN2bLzt/PMi+d7x9CPJ2D08dZTb2lpf9Q7AwAAAA5ZpSq1sQb1iQxH52fT4nG9k4AkLT/UOwGW0Y9l0+LDe0fATGrzO5Ic3jsDDsGHegdMvvb43gUAwDdp+dU8abwtWy4+oncKfRgt0s/e/a9PcnvvDAAAAFgWB09ePKPmcnmGO3/PuAQ6q/hufWbLfD2tdwLMnOHin1TFN5ww1VoZLd63elTvAgDgHr0grS1my3se0zuE1We0SD/nnXpdS/1B7wwAAABYXjWotFfWXK7KwuKv9a6BtapaW9e7AZZTtea1VFhOwx0/UWln9M6AQ9Zyae+EidfaMb0TAIBvpz0j7bAPZNNFT+xdwuoyWqSv/XvPTbK/dwYAAAAsv3poVf1mhotfzcLoZ3rXwJrjpEVmzwlO8YVlcsb569NyXlLeJ2P6LS1d0zthCjy6dwAAcK+Oz2D+/dmyeGLvEFaPJ2P09YZTr2zJ1t4ZAAAAsFIq9ciqvCXDxfdn846n9+6BNWHzjscbojCT1g2+u3cCzIRjjnxHVR3VOwOWxdz8Tb0TJtpLRt+bihO4AWDSVY5JG2zP5tHpvVNYHV64o789+34jye29MwAAAGAlVerEGtQHszD6YydlwQqrtrF3AqyEGrdX9W6AqTfc8ROVPKd3BiybW/Zd3zthos3lab0TAID77YgM6m3ZcvGLeoew8owW6e+8U69rqT/onQEAAAArrwZVeXHN5aps2vHS3jUwuwYn9S6AldFOy3Mv2NC7AqaWa6GZNa3ty1tPvaV3xoQ7oXcAAPCAzKeN35CF0S/2DmFleVLGZNiz94/S4jvBAAAAWCPqoTU3eG0WRp/MpsUTe9fAzKkYLTK7Ht0e0TsBptYxj/hvroVmplR9qHfCxKt8f+8EAOBBqPr9DHe+uncGK8dokclw3qnXteTXe2cAAADAaqrKU2pQf5mF0R/nZU7OguXT1vUugBWzYf2zeyfAVNq84+nV2um9M2A5tcqlvRsmXz2qdwEA8KC9Igs7X5NnXjzfO4TlZ7TI5Lhh93lpuaJ3BgAAAKyqSlXlxTmw/vosjH6mdw7Mgkp5MZuZNRi45hIelKo/SdVc7wxYVuPmpMX7VMf0LgAADkHl5/N947cZLs4eo0Umx7Yz97U2HvbOAAAAgB4qOaIqb8lwcTGbFo/r3QPTzUmLzK5xy2W9G2DqbLrol6ry3b0zYNnNzX+hd8LEa+NH904AAA5Ry+mGi7PHaJHJcu6zL2jJxb0zAAAAoJdKbay5uizD0b/r3QJTafOOxyfldU9mWPt47wKYKmecv77mBr/eOwNWxP79N/dOmGgLOx+Xqof0zgAAloHh4szx4h2TZ5yf750AAAAAnc1X8ltZWPzkwQEWcL9V29g7AVbUgXVf7p0AU+WYI9+W5GG9M2BFDLK7d8JEa3la7wQAYBm1nJ4ntXdly8VH9E7h0BktMnnO3fiZlvx27wwAAADoraqeUjX4rFMX4YEYnNS7AFbU0u17eyfA1FjYfny1PL93BqyYG26+qXfCZGtP7l0AACy3dkpa2264OP2MFplMS+0/p7VremcAAABAd5U5py7CA3Ji7wBYUftitAj32/y2VK3vXQEr5EvZdua+3hETbVAn9E4AAFZCOzHNVdHTzmiRybT15JtbalPvDAAAAJgUTl2E+6ny0N4JsKJ2Gy3C/bJl549WNVfDMrMq+VDvhinwuN4BAMCKeX6+z3BxmhktMrnO2fjulryjdwYAAABMjDtOXazh6APZ8p7H9M6BSVRp63o3wAram+2nGi3C/dHGb0jK+2DMrHFyae+GKXBM7wAAYAW1nG64OL08WWOy3b53mOTm3hkAAAAwYZ5RbcM1Wdh5Vu8QmDzlhWpm2cd7B8BUGG7/iUqe1DsDVlZz0uJ9aXl07wQAYIUZLk4to0Um25ued21rzTXRAAAAcA+q2nkZjt6Wsy4+rHcLTIRNi8clmeudASulkkt6N8BUaPOv6Z0AK27/0o29EybaWRcfmcrDe2cAAKug5fQ8afx7vTN4YIwWmXznnHy+a6IBAADgnlXyT+vwpWsyXHxG7xbobi4n9U6AlTQeO2kR7tNw+09U5bjeGbDy2u7eBRPtsH1P650AAKyqV2S403BxihgtMh1u3ztMy/W9MwAAAGBCHVmpD2Rh8Vd7h0BXbbyxdwKsqGa0CPfJKYusFTd/7abeCZNt7oTeBQDAqntltoxe3juC+8dokenwpudd26r+Ze8MAAAAmGRV9dsZjra7Lpq1a+CkRWbbgXZD7wSYaJsufJZTFlkTWnZn25lf650x4Z7cOwAA6KDVH2Y4+tneGdw3o0Wmx9knbW8tr++dAQAAAJOsklNcF82aVXlo7wRYUQe+trd3Aky0ubnX9U6AVVF1ae+EiVf1Xb0TAIBe6rxsHp3Su4J7Z7TIdLlh9ytby6d6ZwAAAMCEO3hd9HDxFb1DYDVVy3zvBlhRtx8wWoRvZ7j9CZX2hN4ZsBpaax/q3TAFHtU7AADoZj6D2pbNO57eO4Rvz2iR6bLtzNtT+89Isr93CgAAAEy6Sr06w9HbenfA6mnrehfAinrEjUaL8G3Nvzkp73uxRhgt3qeWR/dOAAC6OiKDuXdlYfvxvUO4Z568MX3Ofu7nW2v/rHcGAAAATINK/mkNd16eLe95TO8WWFELFz0qVXO9M2AFXZetm30zN9yTl46OrtZ+sHcGrJ7xVb0LJtqmj6xL5ZjeGQBAd49J1m/PlouP6B3CtzJaZDqdc/KfttRremcAAADAdGjHV9tweRYWn9m7BFZMDTb2ToAV9vHeATCxxuOzU7W+dwasmv3Z3Tthst3wtN4FAMCEqDwxrb09z7x4vncK38hokel1/Q2/0pK/6p0BAAAAU+Kwqro4w8VX9A6BFdFyUu8EWEktZbQI30a1enbvBlhVc/tv6p0w0Wr+hN4JAMAkaRvzpPHZvSv4RkaLTK9tZ96e2/eekdau6Z0CAAAA06JSr85w0Yt0zJ4yWmTGjZ20CPdoYfQLqTy8dwasqq0fddLivRnUk3snAAAT58XZMnp57wi+zmiR6fam513bxkvPT7K/dwoAAABMi0ot1HD0gZx18WG9W2DZtBzVOwFW1Hxd0jsBJlLlX/dOgFV2afKqce+IydYe37sAAJhArX4/w9HG3hkcZLTI9Nt6ysdacmbvDAAAAJgyz6jDly7Plvc8pncILIdK1vVugBV16569vRNg4gy3P6EyPq53Bqymlnyod8Pkq0f1LgAAJtJ8Utvyogu/p3cIRovMirM3vqOl/XLvDAAAAJgyj6m24fJs2fHU3iFw6JrRIrPt8Ga0CN9i7veS8l4Xa0vLpb0TJl4bP7p3AgAwsY7M+nVvz5aLj+gdstZ5IsfsOPvk32vJG3tnAAAAwJQ5rNrg4xmOXtA7BB60hYselaq53hmwopaMFuFbDU7sXQCrr32yd8Hkq2N6FwAAE+3JGY/P6x2x1hktMluu3725Jdt7ZwAAAMC0qeTtGS6+oncHPCg12Ng7AVbc1o/u6Z0AE2XzRadX2iN6Z8Cqawdu7J0w0V4y+t5UnMANANy7yulZGP1i74y1zGiR2bLtzKVcv/unW/JXvVMAAABg2lTq1RmOfqd3BzxgLU7aYsbVZcmrxr0rYKLU3K/3ToAu9s/f1Dthos3Vj/ROAACmRNXvZGHxmb0z1iqjRWbPtjNvz74DP9laPtY7BQAAAKZNJb+ShdEf9u6AB6RyUu8EWFEtH++dABPljPPXV7Xv7Z0BXYyv2t07YbK1J/cuAACmxnxq8LZsec9jeoesRUaLzKY3nrI7e/edkpYreqcAAADAtKnKyzMcvb13B9xvLY/tnQArqZXRInyDox++kOTw3hnQwbV50wv39I6YaJXv750AAEyVx6Qd/uY88+L53iFrjdEis+u8U69r4/aPDBcBAADggavkBYaLTI2KF5aZba0u6Z0AE6UGL+2dAJ18qHfA5KtH9S4AAKZN25gnjn+td8VaY7TIbNt68hWGiwAAAPDgVPKCGo6c7sXEq2Rd7wZYUYMDX+ydAJOkWo7r3QA9tDJavE+tPbp3AgAwhSq/nk2LJ/bOWEuMFpl9hosAAABwKJ5quMhE23T+wxMnLTLj9u3Z1zsBJsZw8YWpHNY7A7poubR3wsQrJy0CAA/KfAaDt+Wstx/ZO2StMFpkbTBcBAAAgENhuMjkqkec1DsBVtyB8d7eCTAxWn6+dwJ0s7R0Te+Eibaw83GJUTMA8CBVjs1hD/vj3hlrhdEia8cdw8XW8rHeKQAAADCFDBeZTJWNvRNg5d20p3cBTIpKvrt3A3QzN39T74SJ1vK03gkAwJSrnJ6FnWf1zlgLjBZZW7aefEX2HzjZcBEAAAAeFMNFJk/FSYvMvje90GgRkuTnF5+SysN7Z0A3t+y7vnfCZGsn9C4AAGZA5TVZ2H5874xZZ7TI2vPGU3Zn3H68Jdt7pwAAAMAUMlxksrQ8tncCrKzyv7lwp6X28t4J0E1r+/LWU2/pnTHRBjFaBACWwxGpDef1jph1RousTVtPvjnX7/7p1uptvVMAAABgCj01w9Hbe0dAkqQy3zsBVlJVM1qEu9Q/6l0A3VR9qHfC5KtH9S4AAGZFe2aGF7+0d8UsM1pk7dp25u254YZ/0Vp+t3cKAAAATJtKXmC4yCSoGC0y28bJJb0bYFJU2iN6N0AvrXJp74aJ1/Lo3gkAwCwZ/45roleO0SJr27Yzl3LOxl9prW3pnQIAAADTppIXZGH0h707WMNedsGGJOt6Z8CKWnLSItyl5eG9E6CbcXPS4n2pOGkRAFhOroleQUaLkCTnnHx2a0snJbm5dwoAAABMk6q83HCRbvYONvZOgBVXc9f0ToCJsLD9+FSt750B3czNf6F3wkQ76+Ijk3xH7wwAYNa4JnqlGC3Cnc55zl+0A/nhtFzWOwUAAACmSVVenuHiK3p3sAYN5k7qnQArbu/efb0TYCLU/LN6J0BX+/c7eOPeHLbvab0TAIBZNf7NvPiCY3tXzBqjRbi7P974hbb/wA+35N29UwAAAGCaVOrVGY5e0LuDNaZitMjsq/17eifARGjtlN4J0NUgu3snTLa5E3oXAAAz68is2/Ca3hGzxmgRvtn/z96dh1l50Hf//3zvMwND2Pd9SwhJBGIg0ayaIGcSsrXmSUIXtSUmAiHatI9a+6v6lNY8XbVqVWbAqFRra0OrttmBSOyDiiQGTDQ7ZmcOQgayAjNzzvf3B4QskgnLzP2977nfr+uay1xIkvcfAWbOfM73/trcVm1vfa9LfxOdAgAAAABAnpj0PS1edVJ0BwplUnQA0O1e2LMnOgHIBLO3RScAoZ59bmd0QrYljBYBAEB3eq8WrbkoOqInYbQIHMjKeVU1lf/ca/5eSZzbBwAAAADgIJknP9H8tYOiO1AY9dEBQDfbo5XzeDw0IEmuAdEJQKBH+fPgLZiPiU4AAAA9nNmXNH9tQ3RGT8FoEejMssb/8mrbyS7dFZ0CAAAAAEBONFif6gPRESgGk+qiG4ButjE6AMgKkwZGNwBRTNoQ3ZADI6IDAABAjzdJfWqfjI7oKRgtAm9l+QWbtb31bHd9MToFAAAAAICcGGVXr2Fog+71kVt6i0uL6OFMWh/dAGTC5Tf0knn/6AwgSk3aFN2Qea7R0QkAAKAAXB/T4tumRGf0BIwWgYOxct4uNZf/2F0Xy7U9OgcAAAAAgBw4SYvWNEdHoAdrqzsrOgHobrWaMVoEJGnwgDMl43taKDDn0mJnFtxdL9OQ6AwAAFAApgZ5ry9FZ/QEfIEHHIrm8k2+e88Ml98enQIAAAAAQNaZaaEW3TE/ugM9lHk5OgHodnU8HhqQJCWlM6ITgFDt1R3RCdn27KzoAgAAUCQ+VwvXzI2uyDtGi8ChWnFhRdt3XOiyq+X+cnQOAAAAAABZZubf0ILbj4/uQA9kyZzoBKDb7aq9GJ0AZMTs6AAglrdGF2Sa1c2MTgAAAAVj9nmds7YuOiPPGC0Ch2PlvKqa5jR71Wa69OPoHAAAAAAAssxKpY2av7YhugM9jR8XXQB0O6vtjk4AMmJcdAAQ6rkXd0YnZFrijBYBAEC6TMfreF0ZnZFnjBaBI/HV8sPa3vpul/8pVxcBAAAAAHhTDdZQ4xGn6GLGu9nR87XZnugEIAtMGhTdAIRxtWrlPC7vdsomRRcAAIACstoSzf8eX6scJkaLwJFaOa+qpsZ/cHVMc9cPonMAAAAAAMgk8+O1aE1zdAZ6DnPVRzcA3e6pnzBaBCTJNDA6AQhjtik6IftsRHQBAAAopFFqGHBtdEReMVoEukrz+Y+ruTzHza6Qa3t0DgAAAAAAWWOmhVq0+pzoDvQYXFpET7dNdy7piI4Awn1w1RhJDdEZQBR33xDdkHleGxmdAAAACsr0MS2+eVR0Rh4xWgS62tI5K7y94zg3fT06BQAAAACArDGztZq/luEBjszCVXNksugMoHvZ+ugCIBPqkzOiE4BYjBbfknFpEQAAhOknb/hEdEQeMVoEusPX5rZqaflK99pZLnG2HwAAAACA17A+tQeiG5Bz5uXoBKC7ubQxugHIBPPZ0QlArNoz0QWZduXt0yWVojMAAECBuRbpqlvGRWfkDaNFoDs1n/sjbW89xd0X8MhoAAAAAABe4ZO0aM0XoiuQY5bMiU4AUsBoEdjrXdEBQKh2tUYnZFp93czoBAAAUHCmBvXq/ZnojLxhtAh0t5Xzqmpu/KrXfIpL/yipPToJAAAAAIBoZrpWi1edFN2BvPLjoguAbpcYo0VAksz6RycAoUrtO6MTMs1rs6ITAAAA5Hq/Ft82JTojTxgtAmlZ3vicmsofdW+f6tLK6BwAAAAAAKKZJz+JbkBOueqiE4Bu99LuPdEJQBaY1wZENwChlv+MS4udSRLezAIAALKgTl7/0eiIPGG0CKSt+fzH1VSe5+1+urt+EJ0DAAAAAECgBrt6zdroCOSPyRgtogDadkcXABkxMDoACLRJWlKLjsi4YdEBAAAAkiTXfC2+eVR0Rl4wWgSiXN+4Xs3lOV7T+S6tj84BAAAAACDIObp6zXujI5A79dEBQLd7qZ1Li8DCVafIrBSdAURxaUN0Q+a5j4xOAAAAkCSZGuQNn4jOyAtGi0C0ZeXb1FQ+3b36e5J+GZ0DAAAAAEDaTPqe5q9tiO5ATixcdYpMFp0BdLuV9zNaBBKfHZ0AhHJtik7IPLMR0QkAAAD7uRZp/vcGRWfkAaNFICuaz/uOb299O+NFAAAAAEARWZ8qj4nGwTG7MDoB6Hau+3kcKCDJk3OiE4BYfm90QaZddftkSbz5CQAAZIepQQ0Dro3OyANGi0CWrJxX3T9e5LHRAAAAAIBiOY3HROOgmJejE4DuZtLG6AYgE0yToxOAUN6xIzoh00p106MTAAAAfoNpEU+VeWuMFoEsWjmvuv+x0bXquS7dFp0EAAAAAEB3M+l70Q3IA5sRXQB0t5qM0SKw14DoACBUe93O6IRs85nRBQAAAAcwSn1q74+OyDpGi0DWLTtvtZrK53vVT3TXtyW1RycBAAAAANBd7Oo1PCYanXOvj04Auh+jRUCSTBoU3QCEqj3TGp2QaYmdHJ0AAADwJnhE9FtgtAjkxfLG+9Rcfr/vqU1y9/8r1/boJAAAAAAAusE5WrzqpOgIZJfJ6qIbgG7XkTwcnQCEu2bNUEl9ozOAQBWtuGJ3dETGDYsOAAAAeBPTdfWacnREljFaBPLm6+duUXPjp/zZ1rHufqVLP4tOAgAAAACgK5knP4luQKZxaRE9X11bW3QCEK5WOzM6AQi2ITog81wjoxMAAADelNvC6IQsY7QI5NXKeW1qbvy6msqneEf1TJe+KfeXo7MAAAAAAOgCDbp6zd9GRyCDFq46RSaLzgC6XS3ZE50AxEvOiC4AIrkxWnxLphHRCQAAAG/K9F5ddcu46IysYrQI9ARfPe/Hair/odc0xt0+Iune6CQAAAAAAI6ESZ/Q/LUN0R3ImMTOik4AUtH2NKNFwGuzoxOAUK5N0QmZ9oHbR0jqH50BAADQiTrV9b4yOiKr8jVadJXkqovOADJreeNzap7zZW8qv92r1dNcWi7puegsAAAAAAAOh/Wp8phovNGF0QFAKlZcsTs6AQhnGh6dAISqVluiEzKtr6ZHJwAAAByEq3TOWrZuB5Cv0eIzGq2tOjs6A8iF5ef9VE3lhb69dbTX9Lsu3SqpPToLAAAAAIBDcJIWrzopOgIZ4npHdAKQgvXRAUAWmIwLaii2Ut3O6IRsK82MLgAAAHhLpnE6rlqOzsiifI0W976r7veiM4BcWTlvl5aV/11N5Qu8XePdbbHLfxSdBQAAAADAwTBPuLaIVxlPYUHPZ9LG6AYgIwZGBwChnm/bHp2QbQmjRQAAkA9mPCL6API1WixpsKTL9ZT6RKcAuXR9eaua5zSpqfEsb7NJbvqESxuiswAAAAAA6ESDFt0xPzoC2WDu9dENQHerGaNFQB+89ThJ/J6P4nJv07cveD46I9PMx0UnAAAAHKSLtODGYdERWZOv0aJriKQBqtf/jk4Bcu9rc57Q0vLfq6l86msGjOuiswAAAAAAeCMz/0Z0AzKCS4sogg4eDw2ovjQ7OgEIZcbBibfiGhmdAAAAcFBMDSoddVl0Rtbka7RoGrvvr67l2iLQhV4dML7L2zXKVfuQS7fK/eXoNAAAAAAAJEmL1jRHJyDYgptnSJav1zOBw5Hsbo1OAMKZGC2i0Ny0KbohB0ZEBwAAABw8f190Qdbk7UW+V94xM1wl/Z/QEqCnur68VU3nXq+m8gX+7I5hXvP3uqxJrqej0wAAAAAAxWWmhZq/tiG6A4FKveZEJwCpqGlPdAIQz6ZHFwChas6lxc584Pa+Mg2JzgAAADh4dpYW3TopuiJL8jZafPWTz0Qf0RZNDGwBer6V83ZpWeN/qWnOYm8uj3evznDXx1xawxVGAAAAAEDarE/H96MbEOrC6AAgFR01RouAqX90AhCqVPdwdEKm9UlmRicAAAAcsqQX1xZfI1+jRX/dSLGvTMvCWoAiaj7vF2ouf05N5UZ/dscw71Cjy66T6+7oNAAAAABAEdh5XFsstFOiA4BU1FV2RycA0cw1ILoBCNXe/lx0QqZZwjVWAACQP+6XRSdkSb5Gi68+Hnov03naqg8EtQDFtnLeLn21vEZNcz7tzeV3+PbW/u662OWf3TdibI9OBAAAAAD0PNanuja6AVG8ProA6H7+vJYv5HU1FNvlN/SSaWB0BhAqUWt0QqYlzqVFAACQQ3aSrrxtSnRFVtRFBxySAz0OwPVlbdH/aIyeCCgC8IqV816UdJOkm1ySLr+hjwYNOVMlO1Xm7zLpNIkXmgAAAAAAR+w0zV87SCtm74wOQbpMlq/XMoHDYhujC4BwQwfPjk4Awj37HJ/rdio5WvLoCAAAgEPXq/5SSX8XnZEFeXuh70Br0wFKtFKuM2TqSL0IwIGtnLdL0pp9H3u/dLxq9Qkq6TSZZpnsNJneLokrCQAAAACAQ2J9qmtd4rpK4Xi9ZNERQLcyaSMTDMDP5Pd7FNyjWjmvLToi07w2UsbvEwAAII/8IjFalJSn0eIWHdXJ//sObdXnJF2bVg6Aw3B94wOSHpD0jX3XGHtp6OBpkk6TbLqZnyzXDJl19usdAAAAAICTuLZYMAtXHStZEp0BdLdazdZHNwDhzM6JTgAimbSBAftbGhYdAAAAcHjsLC2+eZSWXliJLomWn9FiTUPU+cuSf6QWbdRorUipCMCR2vtOwY37Pl495H/V6hNU58dLySmSppr0NpneFlQJAAAAAMgg69PxHZfmRncgJeZlrm6hEOoYLQKSRkYHAJFq0qbohswzGxGdAAAAcNi84SJJ10dnRMvPaNE0/CB+zpe1VQ9rpH6cQhGA7vLqRcbvSfvGjJff0EtDB06V7FhZcoJk00y1Y+R2jIx31AEAAABA8dh5mr+2QStm744uQRqSOdEFQCra23kcKArP5IMZqqPYfEN0QaYtWj1TUik6AwAA4LC5zhOjxRyNFl29D+Jn9ZXr+3pKZ2i8Hu32JgDp2XuV8Rf7Pl4dM0rS1TcNltcdK5UmyTRRrmMlm2TSWMkn8bhpAAAAAOih+lRXSPrd6AykwMRoEcVQ1Z7oBCCe9Y8uAEK1V3dEJ2RbMj26AAAA4IiY5uqctXW6c3ZHdEqk/IwWSxp3kD9zuOp1m57S2RqvZ7q1CUA2NF20Q9KGfR/7vX7UWD9WNRsjS8bLbJzkIySNMNMwySbJvR8XGwEAAAAgX0z6HWe0WBBez9UtFEKpneuxKLZFt06S1BCdAcTy1uiCTPPaLFkSXQEAAHAk+un4jrN0p+6MDomUn9GiHdKZ72NUr1u0TWdpuF7otiYA+bB31LhDe680vo6/8QcW3ThW1qe33CdItUSqm7Dv/5m4939q9ZKNfc3fUW+msW/8xwAAAPRcblIyUe51soN+cxkAdJ9CCIsoAAAgAElEQVRFq5eouXFJdAa6l8ny8zomcCR27OLSIgouOTO6AAj33Is7oxMyLUmOi04AIswY01cnTxgQnYGcWvNgq57eyZcaQKZYMkditJgXow7x55+oDt2hbZrDcBHAQWu++JULrb862L/lN4aPAAAARbLo1klqtzqVNF5J/USpNliywZImmGmiXKNlPkSy4dGpAHomM/sLlxgt9nhcWkQBuD+tlfOq0RlAKLPZ0QlAKFerVs57MToj01wj+bQQRbTo3WN1zdnj+a8fh+09n/+Z/+BhdvFAdnhZ0qejKyLlabTY55D/DtM7GC4CAAAAQDdqPv/xfX/16Bv/r9e9uePyG0rqP2Si6jom7h03aqLko2U+2mSTJJ8kGW8XB3B4Fq+Zq6Xl26Iz0E0WrJ4giWcAouezZGN0AhDO7Z2MkVBoZpuiE7LPh/FmFhTR0UMPfS4BvNYP/uRk+/h/PuL/sObJ6BQAkiQ7RYvX9tPS2YV9w0qeRouH9/jVV4aLT2muxqu1i5sAAAAAAAdj79WgX+kAF633jxuvvG2ISpokK02SaaJkkyQdZ9IkmXj8E4A3Za5/c2lwdAe6SUlzohOANLi0ProByICB0QFAJHffEN2QeWYjohOACBOGNEQnoAf4h0uPtRU/2eKLv/OQXm6rRecARVenavUsSYV9I3aeRov1h/13mt6hem3QUzpb4/XMW/8NAAAAAIDUfW1uq6RWSfe89of3jRpNH1wzWfW1ySolk+Q6TvLjTPZ2SRNTbwWQNYO0+OZRWnphJToE3cBrZRmHFlEExqVFFJ6Z9X/DzXagYBgtduqq2ydLYrmFQpo2ph8nRtEl5p8+xn74cKtf9tVfaNuL7dE5QLGV7GwxWswB18QjvPR9jOq1ThX9lkbpvi6qAgAAAACkw/X18m9canRp76OnBwyYrLrSiUrsOLmfYGbHSzpRUu+AVgABzHt936XTojvQHRIuLaIYqrVfRicA8WoDeewriq3G8ZXO9KqfKWfYjOIZPaCXWqIj0KOcPXWIPbL1JZ/75U3avH13dA5QXO7nRCdEys9osWtMknSHKvpdjdIPomMAAAAAAF1g76OnH933Iek11xkX3HK0VH+8SvZOSUeb6+0yzQjpBNDN7NToAnQTU9/oBCAVbW1t0QlAqA/dcYZU47Quiq1drdEJmVatTVfCsBnFM2tCf90cHYEe59iRfU2S3vG3G/yuJ16IzgGKye0kzV/boBWzC7kezs9o0TSli/5Jw+W6RS1aqNH65y76ZwIAAAAAsse1/ILNkjZLe1/b3X+ZcfCAt8vqZsp0oplmSv52yQZExgLoAlev/mM1NX4hOgNdy+T1XN1CMbQV8psUwH6l2uzoBCBcqX1ndEKmJXZydAIQ4dRJAxgtotvc9WfvtMYv3uOrH9wRnQIUj6lBfTpOkrQ+OiVCfkaLXcnUW9IKtWiaRutPo3MAAAAAACnae5nxnn0fr15lvPK2Y1QqvVMlnSDZaSZ/J0NGIF9M9nmXGC32OFbM1zBRQDsZLaLozogOAMIt/xmXFjs3MjoAiDB15FHRCejhVl87yy76yia/6RfPRqcAxWN2qhgtZt6ILv8nmj6uik5SSZdquLh3CwAAAADF5fra3Dc+YnrvkLG+7lSZnWrymZLOiksEcFAW3zxKSy+sRGegiyxYPUFSKToDSMWKK/ZEJwDBjokOAGLZ/dKSWnRFttmI/W89BApkwuCG6AQUwE3XnGTz//l+X7G+JToFKBa30yR9MTojQp5Gi9113aJRVd2rX+sSjdCmbvp3AAAAAADy57VDxm/v/baImxbcPlNJ6VSZTjO3c2SaEFoJ4HXMe33HpXOiO9BFSpoTnQCkwnW/WGGg6Ez9oxOASC5fF92QfT4sugCIMHZQ7+gEFMSKP3ybLfz2A75s3ZboFKBITokOiJJEB2TEJNW0Tlu0IDoEAAAAAJBl5lo+9x41NzapqfEPvbk80ffUxnrNL3XXP8m1IboQgJ0dXYAu5LVydAKQBkuK+Sgo4LVMGhzdAIRyjqt06gO3j5AYN6N46hPTxKF9LLoDxbHsfSfYwrPGRGcARTJF8783KDoiQj5Gi09rXAr/lr5KtEwVfVvb+IQXAAAAAHCQvn7uFi1r/K6ay9d6c/lUr+7q616d49JfyfU/0XlAIV29+rToBHQRS86MTgDSUKtpY3QDEOqaNUMl9YnOAGL5vdEFmdY3mRmdAESYNYHpAtLHcBFIWa9+06MTIuTp8dBp+X1V9U616Pc1WndFxwAAAAAAcmb5xS9L+oGkH+x9xuOSRItOP0dWOttc58j07tA+oABM9j2XRkd3oAu4hoibIigEZ7SIYuvQ7Jyc2QC6kT8XXZBpbrP4vBBFNGNMX/00OgKFtOx9J9jvfPU+//d7fh2dAvR8SXKSpHXRGWnLx5eAiUop/xunyPRjbdWn5Qw7AQAAAABHYklNzef9QE3lv/Dm8tk+cl3Ja7UL3fX3krikAXSPUdEB6Bom1Uc3AKnoqH8iOgGIVeWyLtBmrdEJmWbJtOgEIMJMLi0i0L9/aIZdNH1odAbQ85kK+XlOPkaLtZB3xtfJ9VfaqvV6SlMC/v0AAAAAgJ5oyZKalp17i5rLn/Cm8tu9rWOoV/197v5VmbZG5wE9xqJV86MT0BWc0SKKobprT3QCEMpKs6MTgHC1ZxgtdsZ8XHQCEOHooX2iE1BwN11zkp11zMDoDKCHs5OiCyLkY7QY62TVa5Mq+pPoEAAAAABAD/S1ua1a3vivam5c4EvLo7ymaS591F2ro9OAPDNLPh/dgCO06PYRMkv7CSxAjDYxWkSxWW1AdAIQrKIVV+yOjsi4iCM3QLgJQxqiEwCt+9gpNnNcv+gMoAfz46MLIjBaPDh9Jf2jKrpbFU2PjgEAAAAA9GDLyverqfyPai6f69Vdfb3ml3KFETgsg6IDcIQsKUcnAKlpZbSIYjMX53tQdBuiAzLPNSw6AYgwbUw/i24AJOnGxSdqIiNaoLsM0oIbC/e5Tj5Gi/UaFZ2wz8ly3a2KrpOrLjoGAAAAANDDLb/4ZS1r/O7+K4yJnezSJyXdG50G5AKPiM4315zoBCA1t17AaBHFZtY/OgGI5LJN0Q2Z9oHb+8o0JDoDSNvoAb2iE4D9xg3uYzdefaIGH8VUBugeDYW7tpiP0WItQwNBU29Jn9RWPaBn1BidAwAAAAAokK/MuUdN5b/2pvLbvVQb66ZreIw08OZ4RHTOGaNFFMb66AAg1ILVMyTVR2cAsZxLi53pk8yMTgAizJrAph/ZcuK4/vZvH5ymEvc/ga6XJFOiE9KWj9FiNk1RSatU0Xf0lMZGxwAAAAAACubL527R0vLS/Y+RVvI+l/+3pN3RaUCG8IjoPHOu6aAYjNEiii6x2dEJQLhqtSU6IdMSmxWdAEQ4ddKA6ATgN8ydNsw+f9mx0RlAz2M6JjohbYwWj9zvqF73q6I/45HRAAAAAIAQyy9+WU3v+Vc1Nf62j1zX180vdWmlGDAC0qLV50Qn4PAYV7dQELWaNkY3AKHMGS0Cpbqd0QmZZpoWnQBEmDryqOgE4ID+6D0T7IOnj47OAHqaSdEBacvHaDHRsOiEtzBA0t9oqx5QRRdHxwAAAAAACmzJkpqWNn5XTeV5DBgByZQ0RTfgMBlvEEZBOKNFFJxranQCEG7XC63RCdmWHB1dAESYMLghOgF4U1//g7fZ6ZO5Bgp0HWO0mEmu3tEJB2mKpP9Wi+7UFp0SHQMAAAAAKLg3DhjdL3PpxugsIFXmx0cn4DAsuGGgxGgRBdHhz0YnAKFMA6MTgFDubVpxCZcWO+O1kdEJQISxg/Iyk0BRrfzQdA3vx0MSgK7h46IL0paP0WLemM5Wop+oom/pKY2NzgEAAAAAQEuW1NTc+J9qKv+WV3f1dU+udNfq6CwgFfPXDopOwCGywXOiE4DUdLy4JzoBiGRitIiCM9sQnZB9NiK6AEhbfWKaOLSPRXcAnRk3uI/92wenqcR/qUBX4NIiukydpPerTpu1VZ/VUxoSHQQAAAAAgCRp+cUvq/k9X1dz+Vx/ScNc+qjc74vOArpNQ3VJdAIOkakcnQCkZlcHo0UU1wf/q7+kftEZQCQ3bYpuyDzTsOgEIG0zxvLHI/KhfMJQ+/PzC7e1ArrH/JtHRSekidFidzP1luujqtdjqugzekp9opMAAAAAANjvm+Vn1VT+R29uPNETO9nlX5LruegsoCuZ6droBhwiE5cWURyDdzBaRHH1OuqM6AQgXM25tNiZRatnSipFZwBpmzWe0SLy4zMXH2NnHcPxbOCI1dczWkS3GCDpU6rXE9qqjzJeBAAAAABkzlfm3KOmxj/y5jmD3fxSl26MTgJQUK7R0QlASrZp+cL26AggjNns6AQgnCePRidkmtus6AQgwnQuLSJnvjX/bRp8VF10BpBvdUmhrkvnZbQ4MjqgCw2X67OMFwEAAAAA2WWupY3fVVP5t159fLR4fDTybfGqk6ITcAhMfKcDRbExOgCI5VxaBLy6Izoh23x6dAEQYcpwZgTIl8nDjrIvXj41OgPIN7dx0QlpystosX90QDd443hxSHQQAAAAAAC/Yf/jo8snutfOctf1knZHZwGHyty+EN2Ag2dSfXQDkAaXMVpEsbnGRCcA4RK1RidkWpIcF50ARJg8lNEi8ucPThttF0wbGp0B5JgX6hdQXkaLPdkr48XHVNFnGC8CAAAAADKr+dwfqbn8Ia/uGuqma+TO9UXkiJ0dXYCDtOCGgRKXFlEQNS4totjMfEB0AxDu2ed2RidkmveoJ/IBB23amH4W3QAcjls+fJLxmGjgcFm/6II0MVrMjgGSPqU6bVFFX9IWTYgOAgAAAADggJZf/LKWlpd6c+OJ7slZ7v6t6CQAPYgNnhOdAKSmztZHJwChXAOjE4Bgj2rlvLboiIwbER0ApG30gF7RCcAR+ez/mhKdAOSTaVR0QpoYLWaNqbekDyvRZrXo37RFp0QnAQAAAADwpprf8yM1N/6Bv6Rh7vqYXE9GJwFvavGqk6ITcBBM5egEIDUv7d4TnQCEWXTrJJmxykCxuW+KTsgBLi2icGaMKdShLfRAV5451s4+dlB0BpA/robohDQxWsyuOpl+V4nuUovWqqLfjg4CAAAAAOBNfbP8rJrLn/Pm8iR3v8xda6KTgDeymi2JbsBBMJ0ZnQCkpo8zWkRxWd3s6AQgmpttiG7ItKtunyxTfXQGkLZTJw+ITgCO2PXvO16963jKOXBITMOiE9LEaDEPTOdI+r5a9Jgqulbb1D86CQAAAACAN+FqbvxPNZcbvSOZ7u5fjg4C9jPjTaH5MCk6AEhNldEiCsx9bnQCEM8ZLXamV/3M6AQgwrQxfaMTgCN27Mi+9uFzxkdnADljhTq1y2gxT0yTJH1BVT2tir6kJzQtOgkAAAAAgDf11ff8Us2NH/EXq/3c9TGZtkYnAcgFrumgOJb/bHd0AhDG7G3RCUC49uqO6IRMq9VOjU4AIowd2Ds6AegSn7v0WBs1oFd0BoCMYrSYTwMkfVi99QtVtEotukyuuugoAAAAAAAO6FvnvaTm8ud86box7smVct0XnYQCm792UHQCOmfidS4UhW2WltSiK4AwLp59CSR1O6MTMs3s+OgEIMKEIQ3RCUCX+dT5PEwBOHi1Qr1uyWgx/xplWqmtelIt+itt0YToIAAAAAAADmxJTc3v+bo3l090dTS6dFN0EQqoT8f86AR04iO39BaXFlEUro3RCUAkkwZGNwDhduxojU7IuJHRAUDa6hPTxKF9LLoD6CofPme8vW3UUdEZQE4Yo0Xk0miZPq1Em9WiW1XRb3N9EQAAAACQWU1z16ipfLErOcWlf4nOQXGYkmujG9CJPUk5OgFIixujRRTY5Tf0knn/6AwglKtVK+e9GJ2RbTYiugBI24yx/aITgC533W8dE50AIIMYLfY8dTLNlfR9bdWT2qq/1zZNjY4CAAAAAOCAmt7zMzWVP+DVtinu/uXoHBSB81yiLEtKc6ITgNS4rY9OAMIMHnCmZHyPCsVmtik6IfO8xqVFFM6s8YwW0fP8r5kj7LTJA6IzAGQMXxD2bKPl+riqekgV/VgVLdA28c5FAAAAAED2LL9gs5obP+LVXcNd/llJu6OTAAQwMVpEcSQdj0QnAGGS0hnRCUA0d98Q3ZBpH7h9hMx4nigKZzqXFtFD/cWFk6MTAGQMo8XiOF3SMnVomyr6V23VuTw+GgAAAACQOcsv3q6mxo/7i9VhLrtOjBfRHeavHRSdgDfFJUwUR9vutugEINDs6AAgXMKlxU71TWZGJwARpgzvE50AdIvzpw2zt41iiw7gVXkZLb4QHdBjmHpL+j25btdWPamKPq8tOjk6CwAAAACA1/nWeS+pac6nGS+iW/Rp/93oBLyp+ugAIDUdtT3RCUCgcdEBQLhax2PRCZnmNis6AYgweSijRfRcnzh3YnQCgAzJy2hxa3RADzVa0h8r0d1q0QNq0f/RNk2NjgIAAAAAYD/Gi+gGJpsf3YADM54MgkLZyZ9pKCyTuHoMtKs1OiHTEuPSIgpp2ph+Ft0AdJc/PH2MjRvUOzoDQEbkZbSI7mY6Xqa/VFUPqaIfa6v+t7ZoQnQWAAAAAACSGC+ii9mp0QV4U4wWURwrruDPMhSXaWB0AhCu1L4zOiHjRkQHAGkbPaBXdALQ7a48Y0x0AoCMYLSIAzldrs8p0RMMGAEAAAAAmcJ4Eei5Fq6aIxNXRVAQtjG6AAjzwVVjJDVEZwDhlv+MS4udGx0dAKRtxph+0QlAt/vLi4+23nV86Q+A0SLeGgNGAAAAAED2vDJerO4a7+5fjs4B0AXMy9EJQFrMnNEiiqs+OSM6AYhn90tLatEVmeYaGZ0ApO3UyQOiE4BUnHvCkOgEIJu8WG/QZ7SIQ/HqgLFF96hF/0fbNDU6CgAAAABQYMsv3q7mxo94tTTcpX+JzkGOLLp1UnQC3sCSOdEJQFpq0vroBiCM+ezoBCCay9dFN2TaB27vy2PkUUTTxvSNTgBSseCssdEJQDaZVaIT0pSX0eLL0QF4A9NMmf5SVT2kin6liv5av9a7o7MAAAAAAAW1fPZ2NZU/4G0dx7p0U3QOcsBKc6MT8EZ+XHQBkJoqlxZRaO+KDgDCuTZFJ2Ran2RmdAIQYezA3tEJQCouPnG4jRrQKzoDQLB8jBZdO6IT0KnJkv4/1fRDVbRVLfq6tuhSbVP/6DAAAAAAQMF8be6jaipf7OpoFNdL0Anz5L3RDXgjq4suAFJjpZboBCCMGd87AOT3RhdkWmKzohOACGMHMVpEcVwwfWh0ApBFHdEBacrHaBF5MkKmK5ToP9ShbarodrVosZ7Q0dFhAAAAAIACaZq7xpsa3+2my+V6MjoHGWQ6LzoBr2eu+ugGIDV79rRFJwBRzGsDohuAeP5cdEHGcWkRhXT08KMsugFIy++fMjI6Acge96ejE9LEaBHdx9Rb0rkyfUW9tVktul9b9Xeq6D1y8c55AAAAAEB3cy0t/4ePWjfZa/5xSbujgwB0iteLUBzWzp9JKLKB0QFAuDZrjU7INLOJ0QlA2maN5xAxiqV8wlAeEQ0UXD5Gi67noxPQBUwnyPWnku7QVu1URf/FFUYAAAAAQLdbsqSmZY2fdWsd7jV9JToHwAEsXDVHJq6KoDhe2LMnOgEIsXDVKTIrRWcA4WrPMFrsjPuw6AQgbTPG9I1OAFJ39rGDohOAbDFxaTFzaowWe6C+kn7rNVcYH1JFzdqiS7SZd1kCAAAAALrB0nkvaln5w97WcaxLa6JzALyG2VnRCUCK9mjlPB4PjWJKfHZ0ApABFa24gou7nbIR0QVA2mZO4NIiiueCaUOjE4BscXVEJ6QpH6NF9HymqZIWKtF31VfPqqL1qugzatFs3a366DwAAAAAQA/ytbmPqqnc6K6L5XoyOgeB5q/lLf1ZYV6OTgBStDE6AAjjyTnRCUAGbIgOyLQFd9fLNDI6A0jb5KEN0QlA6v7w9DE8cQF4vSeiA9KUj9GiiUdlFEtJ0qmSPiXTDzRWz6mi1dqqj2qLTomOAwAAAAD0EM3lm3zUusku/7QkLp0UUZ8qw4nMsBnRBUBaTFof3QCEMU2OTgCiuWxTdEOmJTumRycAESYP7ROdAIR426ijohOA7HB/MTohTfkYLbq2RScgkKmPpLJcn1Wiu1TRC6roRkaMAAAAAIAjtmRJTU2N13m1NN5d347OQboS6bToBuzjzpM2UBi1mjFaRJENiA4A4jmXFjvjNis6AYhw4rj+XJxDIc0cz6PRgf3Mt0cnpCkfo0Xg9fpJuogRIwAAAACgyyyfvV3N5fe71Cjp4egcpMNljBYzwmR10Q1Aaup4PDSKy6RB0Q1AuGq1JToh05JkZnQCkLZhfXkPF4rrlIm8pwV4Vcfj0QVpysdoMVFrdAIy7fUjxha9rIpWq6JPqkVna4u4JwwAAAAAODhN5TU+ct0J+x4ZjR7Pz44uwH58lw7FsatWqMc9Aftds2aopL7RGUC4Ut3O6IRs82OjC4C0zeLSHArsjKMHRicA2ZE0cGkxc8bo5egE5Mgrj5OWrpPpTpl2qKIfa6v+QS26TL/SyOhEAAAAAECGvfLI6N1tI1x+c3QO0OMtXHWKTDwKDcVhtd3RCUCIWu3M6AQgE3a9wLGWzriGRScAaZs1gdEiiuvUyQOtxCsCgCS9qKWzC/Umxzw9dmWXpD7REcghUy9Jp8t1ukzSUZIqelTSerl+Ktd6jdHdsZEAAAAAgMz5xgXbJF3ki9dcZjVdLxNv/Qa6g9mF0QlAqtpsT3QCECM5Q/LoCCCWe5tWXMKlxc6NiA4A0jZjLIeIUWyThvbR5u27ojOAWK6noxPSlo9Li3s9Ex2AHmWKpPfL9KXXPFL6B6ror7nGCAAAAAB4naXl//AH1w1z6SvRKUCPZF6OTgBS9dRPGC2imLw2OzoBCGe2ITohB/geHQpnwuCG6AQg1MSh/BoAZFa40WKeLi0C3WfvI6VnS5r9mmuMj0naJNOPVNPdelmbdIyeC+0EAAAAAMS4c0mH7tSHfcHq71jJviZpanQS0HPYjOgCIEXbdOeSjugIIIRpeHQCEM1Nm6IbMu1Da6bKVB+dAaRt7KDe0QlAqHH8GgAk+ePRBWnLz6VF16PRCSicyZIukeuzMt2pvnpWFd2nir6uLbpWT+lUbdFR0ZEAAAAAgBQtb1znI9ed4Gb/NzoF6DHc+cY0CsTWRxcAUUzWP7oBCFdzLi12pj6ZHp0ARDh6+FEW3QBEGtG/V3QCEM9UuNEilxaBg1eSNF3SdCV6ZfJbVUUPSLpLNf1cVa1XSfdpjF4O7AQAAAAAdKclS2qSPuULV/2zJcm3Jb0jOgnIM+M1ShSISxujG4Aw7gNkbDJQcJ5wpKUztdqp/D6Bopk1vr/uiY4AgvF4aEBSzTdHJ6QtP5cWjUuLyKRXhoxXKNEXVK/1SvT8vouM/6qt+qhadLa2aFh0KAAAAACgiy079xFvWneayz4dnYIjsGj1OdEJhWeMFlEojBZRTB+89TiZcUIH8OqO6IRMM02LTgDSNmNM3+gEINzIfnyaCMh4PHSWdUQHAAfplSHj7+1/tHSibaroV6roRm3VX6pFl2mrjo4OBQAAAAAcqSU1Nc25zmu1qZLuiq7BYXDj7fyRFtw8Q7I8vUYJHJnEGC2imOpLs6MTgExI1BqdkG3GERAUzswJ/aMTgHD9G0rRCUC86u7CHfPL07uYC7coRY8zWdJkuS6SSXJJFb0o6T65Nsn1kFx3yfSwxmh7bCoAAAAA4JAsO/cR15LTdPW7/tzkn4nOwcFLSn5aTbotuqOwSr3mRCcAqXpp957oBCCEidEiIEnPPrczOiHbbMTeb6ABxTGZx+ICAKSdWn5x4XZCeRotvhwdAHSDfpJOl+l02Wt+tKIn5fqlTA9Kuls1PSzpfo3h1wEAAAAAZNeSmpp0nS9c9e+WJDdJmhpdBOTAhdEBQLradkcXADFsenQBkAGPauW8tuiITPPaSJm99c8DepDJQ/tEJwAAwtmD0QUR8jNadO0Qn6OiOCbINEHS+ZJefZD7Vj0s18My3S/XzxkzAgAAAEAGLTv3EV+y5ARtPeszJv15dA46556cE91QaK538JofCuWldi4tophMPPsScN8UnZBpi+4YK9NR0RlA2k4c15+viACg6NwZLWaaqTU6AQjnmippqlwXSXp1zFjR5n1jxgdV0wP7rjTymGkAAAAAiLJkSU3SJ/3qNbeZaaVcI6OTgEyyHL0+CXSFlfczWkQhmWsAI3UUnZttiG7Ittr0V7/xBRTDsL71fDMXACDJfxFdECE/LwrW9DyfpwJv6hiZjpF0/ut+nbRoh0z3S/qlXJtV00NK9IhG6/6gTgAAAAAolqby//NzlozT8WcuM7MPRufgQHxUdEGRmXs9jwBEYbjul5bUojOA1F1+Qy+ZBkZnAPGc0WJn3GYxbkbRzBrfX6uiIwAAWfBQdECEPI0WK4wWgUNkGizpTElnyiSV9v14RVWZNqumzTJtlusB1fSIpAc1Vk+F9QIAAABAT3Tnkg7dqSv96jtuM/k3JTVEJ+F1josOKDQuLaJATNro0RFAhKGDZ0cnAJnQXt0RnZBpic2MTgDSNmsCo0UAgKSOtk3RCRHy86JgwuOhgS5UkmuqTFMl6XWDxha1ybRZ0mZJj8j0XFAjAABA3vWVNPw3ftRVlR3gjSI1vSxp2/6fJT2x769qMj0pSXpRLTpWPFIQyKumOSv9ilvutIb670p2VnQOEG7BzTMk423KKIyabGN0AxDDzxTn0wApqdsZnZBxY6MDgLTNGNs3OgHIhEe374pOACLt1PUXPB0dESE/o8Uxellb1S5XfXQK0KOZekk6Yd/H3m+XAwAAoGsd6HOsN/se3mt/vL+kiiSpVdLzMrXK9bykFvkbUdsAACAASURBVEm7ZHryNePHxyW9JNevNWbfABJAvG9csM3l79aiOz5lpr+KzgFCJXWMd1EwjBZRVHZGdAGQCTt2cKClc8OiA4C0jR3UOzoByITWl9qjE4BAdnd0QZT8jBYlyfWEpCnRGQAAAAAQbIikIXJNet2Pun5z/Gh67dCxVdKT+y43Pi7XDrla9n08obEHuAAJoBuYq1mf8UW33W5J3X/LNTK6CIiRzIkuAFLVkTwcnQCEMI2PTgDCuVq1ct6L0RmZ5hrJUVYUzYTBDdEJQCY8vYOHC6HI/BfRBVHyNVqUnhGjRQAAAAA4HEP2fUx53aVH06tDx4pq2nuhce+H6XHV9IRcj8v1GKNGoIs1z93gi2+YIg1ZYdKl0TlA6kyMFlEsdW1t0QlABJMP5vHQKDyzTdEJmTZ/7SBZbWB0BpC2o4cfxR+QgKSndzJaRJH5z6ILouRrtOj6NV/XAgAAAEC3SSQdve/j1cuNr44aq5Iek/SQXA/J9bBMD8r1mMboyYhgIPeWzntR0uV+9eoPm+yfonOAdHk9IxYUSi3hO3EoKOsfXQBEc/cN0Q2Z1tA2K2/ftgaO1IwxfXVfdASQEU88uys6AYjj1cK+uSVfn/2ZnolOAAAAAIACK2nv9fspMl24f2ey9xHUHZIekvRzmR5UVY+pqns1XvdGxQI54mpq/JJfdesPrVf9Kh4XjaIwWb5emwSOVNvTjBZRPItunSSJZ18CCZcWO1eaHl0ApG3W+P6MFoF9Nm9ntIjC2qnm83g8dE48Hh0AAAAAADigOknTJE2Ta+/NxkSvPHL6V3L9XKZN+y40/pTLjMABXH/+vb547RSp4zsmuzA6B+h+XFpEway4Ynd0ApC+5MzoAiATah2PRSdk3MzoACBt08f2i04AMuGeJ5/3WX9zV3QGEMTuji6IlLfRYiU6AAAAAABwSBLtvcw4RdKl+x83XdFLkjZJekA1bZBpk0aLV6eApbNflPxiX3zHx831d9E5QLdZuOpYyZLoDCBF66MDgBBms6MTgExoV2t0QqaZTYxOANI2dUSf6AQgEzY8/nx0AhDIC/1aQd5Gi9uiAwAAAAAAXaKvpDMlnalEV0l65SrjA9r7Tf2fy7WeISOKyVxL9fe+8I71lvjt4pGK6InMy1xZRJGYtNGjI4AIbu/kt3tAUql9Z3RCxo2IDgDSNmEIX+oDkvRTRosoMvefRidEYrQIAAAAAMiKRK88Ylp65SJjVdImmdarqvWq6qcar0cCG4H0LJvzP/6+W0Za/17rZJoRnQN0rWROdAGQppppY3QDEGRgdACQCct/xqXFzriGMXBG0cwcP4D/6gFJP33suegEIM7uF9ZFJ0TK1yNYnMdDAwAAAEDBlCSdLNc1SvQt1ethVbRdFd2kij6pLXqXHlHv6Eig23z7guf92daZ7loanQJ0KROjRRRLB4+HRjGZWf/oBiCe3S8tqUVXZNaCu+tlGhmdAaRpWN/66AQgM+6vvBydAET5hVZcUuhr3PkaLY7WNpnaozMAAAAAAKGGSrpQ0nVK9D/qr5dU0V1q0T+ooovVouHRgUCXWjmvqubyNS4tjE4BulDengADHJlkNxe2UExeGxCdAERzeaEv6Ly1Z2dFFwBpmzG2b3QCkAnX/+gZj24AAhX+c8R8jRYlyfVEdAIAAAAAIFNKkk6R6WOS/lumraroPlX0JbXoMkaM6DGaysvdO06Vi+fmIPdMzmkRFEtNe6ITgNR96I4zZFaKzgDCuTZFJ2SalaZHJwBpmzWeTT8gSTfdtz06AYjj/sPohGh5HC0+Gp0AAAAAAMg0kzRd0odlWrl/xLj3EuNFekS8Moz8ap67wV9omyDxjU/knXFpEcXSUWO0iOIp1WZHJwDZ4PdGF2RaksyMTgDSNmtCv+gEIBN++Eihn4yLokv23BmdEC1/o0VjtAgAAAAAOCR7R4x7LzHeqP5qVYv+n7bqr/SMzoyOAw7Zty943pvKM921IjoFOCwLVk/Q3iu5QHHUVXZHJwABzogOALLBuZTeKT82ugBI29hBvaMTgHDf3fhr3/FyR3QGEMP1oJZeWInOiJa/0aIYLQIAAAAAjkhJprPk+rRKWqeKnleLVuoZXaWnNS46DjhozeUrXP4n0RnAIStpTnQCkC5/XssXtkdXAAGOiQ4AMqHNWqMTss1GRBcAaZswuCE6AQj3zZ+2RCcAcUyFv7Io5XO0WPilKQAAAACgS/WX6TKV9FXV6UlVdK8q+gxXGJELTY1fcOmS6AzgkHitHJ0ApMs2RhcAIUz9oxOATKg9w2ixM+7DohOAtB09/CiLbgCi3frLZ6MTgEB+e3RBFuRvtGh6OjoBAAAAANBjmaQZkj617wrjNrXom9qiS/WIBkTHAQfUVP6+e/tk8UZP5EbCpUUUikmMFlFIJg2ObgAyoKIVV+yOjsi4kdEBQJpmjOkbnQCE+5vbHvc9HR6dAUTpkJXWREdkQf5Gi+16IjoBAAAAAFAYw2T6gBL9h/qrVRXdrIo+oop4fBWypfn8x31XabKkTdEpwFsy8V06FEqtZuujG4DUXbNmqKQ+0RlABmyIDsi0D62ZKlN9dAaQplnjOUQMfOMnW6ITgEC+XktnvxhdkQX5Gy2O49IiAAAAACBESdIFkv5JUkUt+pla9HH9WscGdwF7rZi925vKM136fnRKrrh+Hp1QNCbnG9MoljpGiyigDs2OTgCywGW8qagzJTs1OgFI2/Sx/aITgFA33rvNH/71rugMII7ZbdEJWZG/0aIkuR6MTgAAAAAAFJrJNEumv1dNDzFgRKY0lS9x1xejM3LDbGd0QvFYXXQBkKr29rboBCB91TOjC4BscC4tdsqnRxcAaZs6gkPEKLa/XcXDVVFw1ert0QlZkc/RoumB6AQAAAAAAPZhwIjsaS7/scv/JDojF9x3RycUyoLVE7T3ci1QHFXtiU4AUpckjBYBSapWW6ITMs00LToBSNuEIQ3RCUCYnz72nP9o83PRGUCkipade3d0RFbkc7QoLi0CAAAAADLp9QPGitapoo9oswZGh6GAmhq/4NIl0RlZZ4nz2NY0lXRWdAKQulI742gUkA+LLgAyoVTHVe9O2YjoAiBtM8cPsOgGIMqnb/xVdAIQ7abogCzJ52gx0SPRCQAAAAAAvAWTdKakf1JftapFN6tFl8vVOzoMBdJU/r5bbaYkBjPIBtec6AQgdTt2cWkRhWPOm3YASdKuF1qjEzLNfWR0ApCmYX3roxOAMGseeNZXPcAfiyg6vzm6IEvyOVqsiYfcAwAAAADyJJHpApluUEWtquhftFXl6CgUxNJzN7ntmSyJKy8HUKsalxbTZIwWUTDuT2vlvGp0BpA6s/7RCUA49zatuITPwTvHVVYUyoyxfaMTgDB/9v3N0QlALNdu7SrdFp2RJfkcLbYxWgQAAAAA5JTpKEnvk2u1KnpaFV2nLZoQnYUebumFFd9VGi2pEp2SOeZcoUyTa0h0ApAqSzZGJwCpW7B6hiROSQFmG6ITMm3RHWNldlR0BpCmWeMHRCcAIb72o2f87idfiM4AYplu04rZvA75GvkcLY7X4zK1R2cAAAAAAHCExkr6pBI9rorWqEWXRwehB1sxe7c3lUdL2hSdkim767i0mCJjxIKCcYnfY1A8ic2OTgCywI3PuzvlmhWdAKTt7eP6RScAIf7ipseiE4B4Nf/P6ISsyedo0VSV68HoDAAAAAAAuohJmrPv8dEvqkWf1VOaER2FnsmbyjNd+n50R2bwDueUOaNFFIxxaRHFY85oEZCkmnNpsVM+M7oASNuEIb2jE4DUffjfH/Knd+6JzgCidch38WjoN8jnaHGv+6IDAAAAAADoBn1l+qjq9XNVtI7ri+gWTeVLGC4idYtuHyGzUnQGkKpq7ZfRCUDqXFOjE4BM8OTR6IRMS2x6dAKQtrGDGC2iWO558nlv+uHT0RlABtidWn7x9uiKrMnvaJFLiwAAAACAns0knbnv+uJ2VXSdtmhCdBR6kKbyJe76YnQGCsSScnQCkLq2trboBCB1poHRCUAmeHVHdELGjf3/2bv3eLvvus737+9K0qYXoITapKWUIlTAoUNboTAz9UimqS2gI1WpOsihiPTiDRx1BC8jM+MFHXRwBptSEMOxXssZyiBQSqXFw6VW0AAKVVsLSptdLmlaKk2T7P09f3RUEJLmsvfv81trPZ//NU32ej0e2Y9kZa33+n6rA2Bopxx3VKtugCG96Dc/nsVeXQFj0H+vumCMpne0mHy8OgAAAAAG8ogkP5lJbsu2vCl35Ourg5gRl296qeEig+k5uzoBhrfLFfTMnZY8pLoBRmGS7dUJo9azvjoBhvSE9UdWJ8CgXn71Lf3PPnVvdQaMwZ4sfsGNN1/B9I4WW/6yOgEAAAAGNknLt2WSP8pCPpiFfG91EDPg8k0v7ek/XJ3BHGhGi8yjHUaLzJfvectDkjy0OgNG4XN376hOGLljqwNgSGc8yqaf+fG+W3b0X7r2k9UZMBbXuBr6K5ve0eJSbq1OAAAAgEJfl+R1Wchnsy0/nVtdw8ch2HzOqw0XWXE966oTYHBbXnh/dQIM6rAj/3V1AozELbnqgl3VEaN14fXHuEqeeXP6SUaLzI9//xt/4Vpo+AdLrobem+kdLZ6QLyS5pToDAAAAij0iLf8lR+VzWcjr8nc5tTqIKTWfw0Wn3wypZXV1Agyq52NJvFXHfGltY3UCjELvW6sTRm3trjOqE2Bojz32iOoEGMR3vO6j/ZPbHTgPSZKenVm1ytXQezG9o8Uk6fmz6gQAAAAYiVVJvjdr8uFsy5tyR86qDmIKzd1wsX24umCetGRNdQMMqU1yY3UDDK87aRGS9NZuqm4Yt1WnVxfA0E5ad3h1Aqy4X77uk/33/vTT1RkwHi1vymUb763OGKvpHi22/Gl1AgAAAIxMS8u3ZZI/ykLem4V8U3UQU2aOhoutLd1Q3TA3Lvr9hyVOWmS+LC350D1zqOeE6gQYh260uG9Pqg6AoT3l0Q9r1Q2wkm74q+39P/4vl6XCl1jqv1WdMGbTPVrs8Wl4AAAA+Mpakn+T5K3Zlg/mjnx3dRBTZPM5r+7J+dUZK22pN9f2DaU9/OzqBBheN1pk7rTWH1rdAKOwe/Gu6oRRa+3R1QkwpIetXVWdACvqU3fd15/7uj/PYq8ugVFZyF+uuq46Ysyme7S4OrdWJwAAAMDotXxdJvnNLOSvjRfZb5s3XT3zw8W+22hxKC2bqhNgcHvWfLI6AQbX87DqBBiFyeod1Qkjd1x1AAzpjJMeUp0AK+qZr/lwPnPv7uoMGJsrc8PGPdURYzbdo8Wvyl8lua86AwAAAKbE44wXOSCbN10901dFX/7MT1QnzI0WJy0yfxbvu786AQZ1yTtOTmuHVWfAKNx11/bqhFHrWV+dAEM69YSjqxNgxZz3P/+sf/SOv6/OgPHpe95YnTB20z1afIArNgAAAODAGC+y/zaf8+qZHi4yjJ7jqxNgcLtitMh8aas3VifAKPRsz1UX3FudMVoXfXBNWo6tzoAhPeXRD61OgBXxot/8WL/mY3b68OX6jbn83D+vrhi76R8t9ryvOgEAAACmlPEi+8dwkUPVsro6AQa33WiRuWO0CEnS2tbqhHH73BnVBTC0k9YdXp0Ay+4nrr6l//r7t1VnwEg1pyzuh+kfLSaWqQAAAHBoHhgvbstHs5Bvqo5hpAwXOQQtWVPdAIN7x7OMFpk3p1cHwBj03m+qbhi1ttqfFcydRx5jtMhs+YVrbus//85PVmfAWN2bNrmyOmIaTP8nnJvroQEAAGBZtDwpyVuzLe9Nz8tzQt5bncTIbD7n1f3S6za05MerU5bBjuqAufGDbz88e2bgdUg4MPe3S6+7rToChtUfWV0AozBx0uI+TfrpSauugEGdctxRvumZGb9wzW395W/5m+oMGLMrc9nGe6sjpsH0v1j4+fxVHprd6T6tDQAAAMui5ay0/FG25W3Zk5/Io/LR6iRGZPOml/VLrlvbWl5SnXJIet5TnTA37p9syqrqCBjc4Uk/uToCgAJLe4zW96n5+5G58oT1R+bm6ghYJlf+8bb+gjd+rDoDxm1p8derE6bF9F8PfUruT3faIgAAACyzlpZvyppszR15XW7Nw6qDGJHLN720J2+szjgUvfUbqhvmxmTV2dUJAACD2Z3t1Qnj1o6rLoAhnfGoh1QnwLJ49bv/tr/gjR/LYq8ugRFr/YN57Td+sDpjWkz/aPEB768OAAAAgBk1ySTfm6Py2SzkJ6tjGJHNmy7sydXVGQdtcema6oS50WK0CADMj1W7d1QnjFpfWl+dAEM6/SSjRabfL1xzW3/pVX9tsAgPprfXVidMk1kZLd5YHQAAAAAzbnWSn822fCZ35nnVMYzE5k3nJ9lanXFQrjjXDV3DcQUgADA/rviQkxb3pTlpkfny2GOPqE6AQ/Kzb7+tv/wtf1OdAdNgR+6bXFkdMU1mY7TY89HqBAAAAJgLLcem58psy/+XO/KU6hzq9c2bTk9vBoDsy5rqAACAYbSPJa9Yqq4YrRdf9zVJVlVnwJBOWnd4dQIctIt/6+P9p95qsAj76fXZsnFndcQ0mY3R4ob8ZZJ7qjMAAABgbrSclUluyh15XW7Nw6pzqNV3Tk5PslDdwTi1B05qBQCYeT39vdUNo7aqPa06AYb2lEc/rFU3wME4//IP99e+947qDJgWe9J3/Vp1xLSZjdFiy2Ja3l+dAQAAAHOmZZLvzZG5Pdvy/dUxFNqycWe/b9Vjkvg0MV/qB99+eJy0CADMi56t1Qmj1pfOqE6AIT1srYNFmU7/+r/9SX/zhz9bnQHT5A9y+TM/UR0xbWZjtJgkPX9UnQAAAABzqeWotLwmC/lI7shZ1TkU2bJxZ2/3P6Y6Y7/0vKU6YW7cP9lUnQAAMJz+keqCUZu0U6oTYEhnnPSQ6gQ4IB/bdm9/7E+/r7//b1x0CgekL/1qdcI0mp3R4lI+VJ0AAAAAc+7UTPJHWcgV6Tm8OoYClz17obel06szHkxvS9dUN8yNyaqzqxMAAIbT764uGLd2XHUBDOnUE46uToD99s6Pfbb/m1d9KLd+1iUacGD61lx+zg3VFdNodkaLu/Mn1QkAAABAWpIXZyGfzR15XnUMBS77xq2957uqM/ap7b66OmFutBgtAgDzY1fbXp0war2vr06AIT35RKNFpsOr3/23/Vmv+XDu+sKe6hSYPr05ZfEgzc5o8dG5K8lHqzMAAACAJC1HZ5Irs5Brc0dOqs5hYJdv+t3e+n+uztiry569UJ0wP/rJ1QUAAINZut1ocV+akxaZLyc/4ojqBHhQz/+Nv+gvveqvs9irS2AqLeTmyZXVEdNqdkaLD3hPdQAAAADwJc7JJLdmW36kOoSBXXbOK3riRMO511ZXFwAADGQhW17oTs29ueQPH5lkbXUGDOmkdYdXJ8Be/fWdf9//5c/+cf/Nm3yuEw5a76/KDRsdUXqQZmu02I0WAQAAYIRWp+VVWchH8umcUh3DgDZvOj/J1uoM6rSeNdUNAAADuak6YNR6zqhOgKGdctxRrboBvpK3fPjT/cxf+mA+cvu91SkwzXZk5+d/vTpims3WaHExN1YnAAAAAHt1apby8SzkJ6pDGE7fvOn0JCP62H7/4+qCOeOkRQBgLvQ0H9bZp356dQEM6bHHuhqacfrhN/1V/5bLP5q7vuBwODhEr8+W83dUR0yz2RotnphPJbm9OgMAAADYq1VJfs6pi/Olt/tH8wZlT99S3TA3Lr727LQ4WQQAmBPdSYv7Mslo/k0AQ3jayQ+tToAv8Q/XQf/3P/y76hSYfj0703b+cnXGtJut0eIDrqkOAAAAAB6UUxfnyWXPXuhtaRxvUrbdV1cnzI3WN1UnAAAMZnFxW3XCuLXjqgtgSKc+8ujqBPhHb3j/7f3JP3+T66BhubRsyWXPHtHNMtNp9j7pfEeel0murM4AAAAA9lPL/5fFfHdOyN9Wp7DCLv3DS1r65sqEvnnT7L0eNlaXvuumljy1OgMAYAg97bHZvOlvqjtG65I/vCUtj63OAAA4RHvSdj8xl513S3XItJu9kxb35MbqBAAAAOAA9Hx9Jrk1t+dF1SmssM1nX96TN1ZnMJT++OoCAIDB3Pf57dUJo9bipEUAYPq1XGmwuDxmb7R4Um5N4psDAAAApsvqrMrrspC3pOfw6hhW0OZNFybZWvToO4oed0611dUFAACD6H1XtpzvuebePP+dxyV5SHUGAMAh2pPs/rnqiFkxe6PFB1xTHQAAAAAcsJbk3+XOfCYLObs6hpXT71v1r5LsHPpxW8/vDf2Y86z1rKluAAAYRGs3VSeM2lF5UnUCAMAhc8risprN0WLPe6oTAAAAgIP2kCTXZlt+qTqEFbJl487edz9x6Iddan3L0I8555y0CADMhd7KThKfEqtOry4AADhke/b8YnXCLJnN0WKMFgEAAGDKTdLyY1nIH2chx1XHsAIuf+Ynes93DfqYm8+5cdDHm2cXX/uUtLTqDACAQSx1Jy3u08RoEQCYdlfminNvro6YJbM5Wjw+n0nPn1VnAAAAAIfszCSfyh35tuoQVsDlm363J2+szmAFtPbs6gQAgMH0iWsC96X1E6sTAAAOwZ603f+5OmLWzOZo8QFXVwcAAAAAy2JNJrnKddEzavOmC5P2iQEeaecAj8E/aH1TdQIAwGD64l3VCSN3bHUAAMBBa7kyl53nQyrLbJZHi66IBgAAgNnRXBc9u/p9kyeu9GO05PdW+jH4Yu3U6gIAgMFMsr06YdR6jq9OAAA4SHuS3T9XHTGLZne0eG9uTHJfdQYAAACwrM5McksWcnZ1CMtoy8adPf1freRDLLWlV6/k1+ef6X1NdQIAwGA+d/eO6oTRev47j0rLuuoMAICD4pTFFTO7o8VTcn+Sa6ozAAAAgGX3kCTX5s78h+oQltHmc27syS+u2Ne/7Bu3rtjX5su0tNXVDQAAA7klV12wqzpitI7Ik6oTAAAOSs/OZOfLqzNm1eyOFpOk5+rqBAAAAGBFTNLzy1lw5e9M2bzpZent5uoMloWTFgGA+dC7D8fsS1t9enUCAMBBabk8lz17oTpjVs36aPE91QkAAADAirogC/lEFnJcdQjLo++crMSbml5cHNLF1z4lLa06AwBgCL21m6obRm3SjRYBgGm0I/fd85+rI2bZbI8WT8gnk3y0OgMAAABYUY9Oz61ZyNnVISyDLRt39t43LueX7L3/6nJ+PR5Ea8+uTgAAGE43WtynyVdXFwAAHLCeV2XL+TuqM2bZbI8WH/A71QEAAADACms5Osk7sy3fV53CMrj8nBt6z2uX7evtXH35sn0tHlzLWdUJAACD2b14V3XCyB1bHQAAcIAWsnPyy9URs272R4tLeVd1AgAAADCIVWl5TRbiVL1ZcPmmS7Jc1zpv2ehT0UPqeWp1AgDAYCarPdfcl760vjoBAOCA9Lw8WzburM6YdbM/Wjw+f5bkzuoMAAAAYBAtyQ9lW25Iz+HVMRya3u4/vbqBg9CyujoBAGAwd921vTph1Fo7rjoBAGD/9a25eXJldcU8mP3RYstikquqMwAAAIABtXxD7sxfZiHeIJtmlz17off2wkP5Ei35veXKYf+03tdUNwAADKJne6664N7qjNF60TuflGRVdQYAwAH4sdywcU91xDyY/dFikizlrdUJAAAAwOAeneSW/F1OrQ7hEFx+9pYkNx7sL19qS69cxhr2h5MWAYB50drW6oRRW7PayekAwBRp12TzpuuqK+bFfIwW/z7vSXJPdQYAAAAwuIdkTf402/Ls6hAOXr9v1caD/sWXfaM3kod00dtOTdp8vOYIAMy93vtN1Q2j1pfOqE4AANhPe7K4+4erI+bJfLyAeEruT/IH1RkAAABAidVpeUvuzKXVIRykLRt39t4PfrjIcFYddnZ1AgDAYCZOWtynyeTx1QkAAPul5/Jcce7N1RnzZD5Gi0nSclV1AgAAAFBmVXpekzvjquBpdfk5NyS54cB+UX/PirSwL041BQDmx9Ke26oTRu7Y6gAAgP2wIzvv+enqiHkzP6PFxVyb5L7qDAAAAKDMJD3/MQv51eoQDk7fvOmATlvsPa9YqRb2ouep1QkAAIPZne3VCaPW+/rqBACABzf5qWw5f0d1xbyZn9HiCflCkjdXZwAAAAClWpIfykJ+pzqEg3NA10Q/cDojQ2pZXZ0AADCYVbu9ub0vrR1XnQAA8CD+PB/Pa6sj5tH8jBYTV0QDAAAA/+A7s5APVEdwEA7qmmiG0npfU90AADCYKz7kpMW9edE1j0uytjoDAGCf+tIP5oaNe6oz5tF8jRZdEQ0AAAD8k6dnIR9Iz+HVIRyYft+qZ+7Hz3rPypfwZZy0CADMjfax5BVL1RWjddiqM6sTAAAexO+6qaXOfI0WXRENAAAAfKmnZyF/abg4ZbZs3NmT8/f1U3rPK4bK4f+4+NpTkjZfrzcCAHOrp7+3umHUltpp1QkAAPtwb3bf/2PVEfNs/l5EXMobqxMAAACAEWl5tOHiFNq86eqkfWKv/9+npIfX+qbqBACAwfRsrU4YtdaeVp0AALAPP5vXP+tT1RHzbP5Gi3+f9yS5pzoDAAAAGBHDxanU75ucXt3AF5ucXV0AADCc/pHqglFrWVedAADwFfXcnI9Pfrk6Y97N32jxlNyf5A3VGQAAAMDIGC5Ony0bd/SeX/2yH+/9LQU1tBgtAgBzpN9dXTBqPcdUJwAAfGVLl+aGjXuqK+bd/I0Wk6TlTdUJAAAAwAgZLk6fyze9NMnOL/6hvrT0sqKaOdfXVBcAAAxmV9tenTBqrTtpEQAYoytz+Tk3VEcwr6PF9Xlfej5ZnQEAAACMkOHi1Om9P/NLfuCKc28uSplrLW11dQMAwGCWbjda3JsL37YhaUdWZwAAQ4pmMwAAIABJREFU/DM7sviFH66O4AHzOVpMkpYrqhMAAACAkTJcnC6Xn3ND0j7xf/5r5z5/LivISYsAwNxYyJYXet65N0esObM6AQDgK/ixXPHNn62O4AHzO1rcld+rTgAAAABGzHBxqvT7JqcnSW/9F6tb5tLF156StPl9rREAmDc3VQeM2tLktOoEAIAv1d+bzWe/vrqCfzK/LySelFuTvKc6AwAAABgxw8XpsWXjjqS/M19Y/erqlLnU+qbqBACAofS0rdUNo9baU6sTAAD+Uc/OLC6+uDqDLzW/o8UkWYoFLQAAALBvLY/OnbmxOoMH1+9b/ZwHxosUOKs6AABgON1Ji/t2QnUAAMAXeWWuOPfm6gi+1HyPFpP/leS+6ggAAABg9E7LQj5QHcGD2LJxZ3XC/JqcXV0AADCYxcVt1Qmj1rKuOgEAIEnSc3NunvxcdQZfbr5HiyfkC0l+vToDAAAAmApPz7a8vToCRqnlqOoEAIDBrFrtdO996kaLAMAY7ElbemFu2LinOoQvN9+jxSTZk9+qTgAAAACmRMszs5Dfrs6AsWnpa6obAAAGc9/nt1cnjNZzrz86aQ+tzgAASPKabD7nxuoIvjKjxRNzY5KPVmcAAAAAU+M7c2deWR0B49JWVxcAAAyi913Zcr6TFvfmEbvOrE4AAEjyibTJT1dHsHdGi0mylF+rTgAAAACmRkvPf8ydubQ6BEbhonedlGRVdQYAwCBau6k6YdT6qtOqEwAA0pdemMs23ludwd4ZLSbJ3+d3ktxXnQEAAABMjZae12Rbnl0dAuVW5ezqBACAofSWrdUNozZpT61OAADmXMtrcvk5N1RnsG9Gi0lySu5J8uvVGQAAAMBUmaTl6vxdTq0OgVJ9aVN1AgDAYJa6kxb3peerqxMAgLn2iWTy8uoIHpzR4j+5ojoAAAAAmDqrsyZ/koUcVx0CdSZOWgQA5kef3FKdMGot66oTAIA55lroqWG0+A825KNJ3l+dAQAAAEydw5P8ZXoOrw6BEi1HVScAAAymL95VnTBqvRstAgA1XAs9VYwWv1jLf6tOAAAAAKbSMVnIB6ojoELrWV3dAAAwmEm2VyeMWssx1QkAwFy6xbXQ08Vo8Yvdk3ckub06AwAAAJhCLafnjvx2dQYMr6+pLgAAGMzn7t5RnTBal1xzZtK8/wwADG1PsvR810JPF08av9gpuT89/7M6AwAAAJhSk3xn7sgPV2fAYC5553FpbVV1BgDAQG7JVRfsqo4YrzVnVhcAAHOo51XZfM6N1RkcGKPFL/eGtOyujgAAAACmUssk/y0LObs6BAbRJpuqEwAABtP71uqEUWv9tOoEAGDe9K25efLT1RUcOKPFf+74fCY9b6jOAAAAAKbWqiRvz0KOqw6BFdcNdAGA+dFbu6m6YdzaE6sLAIA50rMzffH5uWHjnuoUDpzR4lfS8z+qEwAAAICpdliSD1dHwIprRosAwDzpRov70rOuOgEAmCOT/rJcfu6fV2dwcIwWv5Lj87H0/EF1BgAAADDVNmRb3l0dASvKG9MAwDzZvXhXdcKote65IQAwkHZdLtv0q9UVHDyjxb1p+e/VCQAAAMCUa3lGtuUV1RmwUlqyproBAGAwk9U7qhNGreeY6gQAYA70fDa7d76wOoNDY7S4Nxvy7iSOeAcAAAAORUvLT+WOnFUdAiujGy0CAPPjrru2VyeM1ouueVxaO6w6AwCYA62/OK9/1qeqMzg0Rov70vOq6gQAAABg6q3KJNfl1jysOgSW1fe9bUNaW1WdAQAwiJ7tueqCe6szRuuwVWdWJwAAc+HybN50dXUEh85ocV825H+l5+bqDAAAAGDqHZ6j8qfVEbCsltacV50AADCY1rZWJ4xab0aLAMBK+/O0yY9VR7A8jBb3pWUxzWmLAAAAwLL46mzL5uoIWC6TlmdUNwAADKX3flN1w7i106sLAIAZ1rMzexafn8s2Ovl6RhgtPpjP58okt1dnAAAAADOg5aIs5OzqDFgOPZNzqxsAAAYzcdLiPrWsq04AAGZYm/xoXveNno/NEKPFB3NK7k/yM9UZAAAAwEyYpOftuTUPqw6BQ9c3VBcAAAxmac9t1Qnj1o0WAYCVcnU2b/y16giWl9Hi/nDaIgAAALBcWg7LkfnT6gwAAOAA7M726oSRO6Y6AACYSZ/Iffe8sDqC5We0uD9Oyf1p+e/VGQAAAMCMaPnq3OG1BgAAmBqrdu+oThitC9+2IWlHVmcAADNnTxaXnp8t53seNoOMFvfXPXlduk9QAQAAAMtkkh/MHXlKdQYclAvf7CQdAGC+XPEh7xPuzRFrzqxOAABm0k/linPeWx3ByjBa3F+n5J6sys9UZwAAAAAzY1Umua46Ag7K2iPPq04AABhO+1jyiqXqitHqzWgRAFhm7ZpsPvsXqytYOUaLB+LuvC7J7dUZAAAAwMx4WLblbdURcKAmrRktAgBzo6c74WefJk+uLgAAZkjPp7L498+vzmBlGS0eiFNyf+K0RQAAAGAZtTwzd+ZbqzPgQPRMzq1uAAAYTM/W6oSRO6E6AACYGXvSlp6bK775s9UhrCyjxQP1+VwZpy0CAAAAy6dlKb+TnsOrQ2D/9Q3VBQAAw+kfqS4YuWOrAwCAGdH6j2bzOTdWZ7DyjBYP1AOnLf5YdQYAAAAwQ1oOy515X3UGAADwlfS7qwtGrWVddQIAMAN63pTLNv1qdQbDMFo8GOvz++m5uToDAAAAmClnZCH/vjoCAAD4Z3a17dUJo/Xc649OcnR1BgAw9W7JZPLC6giGY7R4MFoWk/xIdQYAAAAwU1p6fsM10YzehdevrU4AABjU0u1Gi3vziF1nVicAAFPv3vQ95+eyjfdWhzAco8WDdXzenuT91RkAAADADHFNNNPgiF3nVScAAAxoIVteuLM6YrwmRosAwCHql+byc/+8uoJhGS0eij1OWwQAAACWnWuiGbVJb0aLAMA8uak6YNTa5KnVCQDAVHt1Nm+6sjqC4RktHooTc2OS367OAAAAAGZKS/IG10QzVr1Nzq1uAAAYSk/bWt0waj0nVicAANOq3ZCPT36suoIaRouHaik/kZbd1RkAAADATDk8C3l7dQR8Zf3k6gIAgOF0Jy3uS8u66gQAYCotpN33Xblh457qEGoYLR6qE/LJJL9SnQEAAADMmJaNuSNnVWcAAMBcW1zcVp0war0bLQIAB2pPsnR+Lnv2QnUIdYwWl8M9+fn0bK/OAAAAAGZKS8u11REAADDXVq3eUZ0waq0ZLQIAB6ZNLsnmc26szqCW0eJyOCX3JPmR6gwAAABgxrQckW15Q3UG/KMLr19bnQAAMKj7Pu/gkr255JozqxMAgKnz+ly28derI6hntLhcNuQ30/Nn1RkAAADAjGl5fu7ISdUZkCQ5fPEZ1QkAAIPpfVe2nO+kxb1aY7QIAByA9t58fHJpdQXjYLS4XFoWM8kPVmcAAAAAM2d1Jnl3dQQkyaQtnVfdAAAwmNZuqk4YOaNFAGD/9Hwq7b7n5oaNe6pTGAejxeW0Pu9LXNkEAAAALLuvzp351uoI6K0ZLQIAc6O3bK1uGLWWx1YnAABT4d70xfNz2bMXqkMYD6PF5TbJTya5pzoDAAAAmCktPb9VHQFJHl8dAAAwmKXupMV96VlXnQAATIGeHbl/zZ9XZzAuRovL7bgs/J/hIgAAAMByWpttbngAAIDB9Mkt1Qmj1rrRIgDw4FpOzJG5uDqDcTFaXAlflc1JPlqdAQAAAMyYlufn1jysOgMAAOZCX7yrOmHcmtEiALB/+tLLcuH1a6szGA+jxZXQspilfE91BgAAADBzVueovK86AgAA5sIk26sTRutF1zwuyerqDABgamxw2iJfzGhxpZyQD6blsuoMAAAAYOZ8bRby9OoI5tDF151XnQAAMKjP3b2jOmG0Dlt1ZnUCADBlnLbIFzFaXEn35OVJ7qzOAAAAAGZKS3J9dQTzZ9KWjBYBgHlyS666YFd1xGj1yVnVCQDA1HHaIv/IaHElnZJ70nJpdQYAAAAwc9bmjlxSHcF86a0ZLQIA86P3rdUJo9b6qdUJAMAU6ks/kGdcv7o6g3pGiyttfd6cnjdVZwAAAAAzZpLN1QnMncdXBwAADKW3dlN1w7i1Y6oLAICp9Lg8Yem7qyOoZ7Q4hFX5wST3VGcAAAAAM2ZbtlQnAADAbOpGi/vU11UXAABTqvWXVCdQz2hxCMdlIT0vrc4AAAAAZkzLC3Jb1lZnAADAzNm9eFd1wqj1ZrQIABykdlouve451RXUMlocyvH5jbRcU50BAAAAzJi1ubo6AQAAZs5k9Y7qhNG66F0npfnwFABwCHqctjjnjBaHtDsvjmuiAQAAgOXUcm5uyzHVGcy4S9/19OoEAIBB3XXX9uqE0VrVT6tOAACmXGvPyIuv9ZxijhktDunEfMo10QAAAMCyOzLXVycw2yZpruwBAOZHz/ZcdcG91Rmj1duZ1QkAwAxYverHqxOoY7Q4tOPzG4lrmwAAAIBl1HOa0xZZSb0vnVfdAAAwmNa2VieMWps8tToBAJgJ357ve9uG6ghqGC1WmOTS9DhSHgAAAFg+R+QD1QnMsNaeXJ0AADCU3vtN1Q3j1o+rLgAAZsLqLK19SXUENYwWKxyXhSzle6ozAAAAgJnyhGzLydURAAAw9SZOWtyn3tZVJwAAM+N7c+H1a6sjGJ7RYpVH5i1JXledAQAAAMyQluurEwAAYOot7bmtOmHUWowWAYDl0XJsjlj67uoMhme0WOnz+dEkt1RnAAAAADPjZKctAgDAIdqd7dUJo/Wia9YlObo6AwCYJf37qwsYntFipVNyT5byXWnZXZ0CAAAAzAinLbLcXnztadUJAACDWrV7R3XCaK1pnhsCAMusnZZL3/X06gqGZbRY7YR8MMlPVmcAAAAAM+Pk3JZjqiOYIavaedUJAACDuuJDTlrcq8mZ1QUAwCyavKS6gGEZLY7BcfmVtFxTnQEAAADMiCOdtsjyaS3PqW4AABhO+1jyiqXqitFqk6dWJwAAM6jnObnorcdWZzAco8UxaFlMywuT3FmdAgAAAMyAntOctsgyelp1AADAUHr6e6sbRq33k6oTAIAZ1LI2kyNeUJ3BcIwWx+K4LKTnO6szAAAAgBmxNr9bnQAAAFOnZ2t1wqi15sNRAMDKaO0HqhMYjtHimByfG9Lyn6ozAAAAgBnQcm51AgAATJ/+keqCUet9XXUCADCzTs4l73pGdQTDMFocm+Py82l5Z3UGAAAAMAO2ZUt1AgAATJd+d3XBaD339w9La0aLAMDKaZOLqxMYhtHi2LQsZinPT3J7dQoAAAAw5VpeUJ3AlHvxtadVJwAADGpX216dMFqPeKjnhgDAyup5Ti5667HVGaw8o8UxOj6fyZ48Ny27q1MAAACAKbeQl1UnMMVWtfOqEwAABrV0u9HiXq05s7oAAJhxLWuz+ojnVWew8owWx+rEfCBLeWl1BgAAADD1fqE6gOnVWp5T3QAAMKCFbHnhzuqIETNaBABWXs+F1QmsPKPFMTs+lyV5fXUGAAAAMOW25RnVCUytp1UHAAAM6KbqgFFr/ZTqBABgHrTT8uJrT6uuYGUZLY7dUl4S/0ACAAAADsUkb65OAACAsetpW6sbxq2tqy4AAObE6lUvqE5gZRktjt0J+UL25NuS3F6dAgAAAEypnmPy6WyozgAAgHHrDhLZp35MdQEAMCd6vjvPuH51dQYrx2hxGpyYT2VPnpuW3dUpAAAAwJTqeUd1AgAAjNri4rbqhHFz0iIAMJCWY/PExW+qzmDlGC1OixPzgfRcWJ0BAAAATKme06oTmDIXvfMJ1QkAAINatXpHdcJoXXzd1yZx2hEAMJzenledwMoxWpwmG/LbSX6hOgMAAACYUnfmldUJTJFVk/OqEwAABnXf57dXJ4xWa2dWJwAAc+ebcuGbj6mOYGUYLU6b9fnpJFdXZwAAAABTqOfHqxOYHq3HaBEAmB+978qW8520uHdGiwDAsFrW5oiHfnt1BivDaHHatCxmKc9Lz59VpwAAAABT6FOuiWY/tZxbnQAAMJjWbqpOGLXWT61OAADmUfuO6gJWhtHiNDohX8iqPCvJ7dUpAAAAwJRZnTdXJwAAwNj0lq3VDaPW27rqBABgHvVN+d63n1hdwfIzWpxWx2UhyTOT3FOdAgAAAEyVk6sDAABgdJa6kxb3pfVjqhMAgDl12GHfVp3A8jNanGYb8tEk35qW3dUpAAAAwBRZyKurEwAAYFT65JbqhFFz0iIAUKXn26sTWH5Gi9NuQ/4wPRdWZwAAAABT5SXVAYzcJe9wIicAMF/64l3VCaN10btOSsva6gwAYF61s1wRPXuMFmfBhvx2lvIj1RkAAADAFLkjT6hOYMTaqvOqEwAABjXJ9uqE0WrtzOoEAGDOuSJ65hgtzooT8itJXlmdAQAAAEyJSd5cncB4td6MFgGA+fK5u3dUJ4xW66dVJwAAc84V0TPHaHGWrM9PJfmt6gwAAABgKjhpkb1rObc6AQBgQLfkqgt2VUeMVps8tToBAJh3roieNUaLs6RlMevzgvS8rToFAAAAmALbcmF1AqO1tjoAAGAwvW+tThi5DdUBAACuiJ4tRouzpmUxPRckeXd1CgAAADByLZurEwAAoFpv7abqhlHrOaY6AQDAFdGzxWhxFp2QL2Qp35zEP7AAAACAfVmb25yoBwDAvOveU9uXlnXVCQAASXt6LnrrsdUVLA+jxVl1Qr6Qnm9K8tHqFAAAAGDEjsgrqxMYmUvecXJ1AgDAoHYv3lWdMFovumZdkqOrMwAAkqzOqiOfUx3B8jBanGXH5zPpOTuGiwAAAMDevaQ6gJFpq86rTgAAGNRk9Y7qhNFavfrM6gQAgC/y7OoAlofR4qwzXAQAAAAezG05pjqB8Wi9GS0CAPPlrru2VyeMmNEiADAePeflwuvXVmdw6IwW54HhIgAAALAva/O71QmMSMs3VCcAAAymZ3uuuuDe6ozRmrQnVycAAPyjlrVZu7ipOoNDZ7Q4LwwXAQAAgL1pObc6gVFx8iYAMD9a21qdMGq9n1SdAADwJVr7luoEDp3R4jwxXAQAAAD25tPZUJ0AAABD673fVN0waq2tq04AAPgSPedVJ3DojBbnjeEiAAAA8JUsZkt1AgAADG7ipMUHYbQIAIxLy4m5+NqnVGdwaIwW55HhIgAAAPDPuSKaJPm+tzlxEwCYL0t7bqtOGK3n/v5hSY6pzgAA+DKrVnktc8oZLc4rw0UAAADgn3NFNEtrXK8DAMyX3dlenTBaD3/4mdUJAABfUe9ew5pyRovz7Ph8Jkt5epJ3V6cAAAAAI+CK6Lk3ac0LvgDAfFm1e0d1wmi1ZrQIAIxUe3oufLMToaeY0eK8OyFfyFK+OYaLAAAAgCui516P7wEAYM5c8SEnLe5Na6dVJwAA7MXqHP6QTdURHDyjRR4YLq7PNyb5reoUAAAAoNht8Qnl+eb3HwCYI+1jySuWqitGq/VTqhMAAPZq0nz4dooZLfKAlsWszwvSc1l1CgAAAFDoiLyyOgEAAIbQ099b3TBubV11AQDAPjhpcYoZLfJPWhZzfL4/Lf+pOgUAAAAoc3F1AAAADKJna3XCqPUYLQIAY3ZyXnTN46ojODhGi3y59fmvSV6clt3VKQAAAAAM5MI3uxoaAJgz/SPVBaPW4vkhADBuq9c4bXFKGS3ylW3I69PzrUnuqU4BAAAABraQl1YnUGDtkedVJwAADKvfXV0wWhdf97VJVldnAADs0yTfUJ3AwTFaZO825A/SsynJ7dUpAAAAwIBafqY6geFNWjNaBADmy662vTphtCY5qzoBAGA/eD1rShktsm/H50+yK9+Q5KPVKQAAAMBAumvg5lHP5NzqBgCAQS3dbrS4N72dVp0AALAfjsmLr/W8ZQoZLfLgTsqtuT/fkJZrq1MAAACAgXw6XuybO31DdQEAwIAWsuWFO6sjRqv1U6sTAAD2y5qJK6KnkNEi++fRuSvH5VlpuaI6BQAAABjAUl5dnQAAACvopuqAUettXXUCAMB+6e0Z1QkcuNXVAUyRlsUkF2chH0/LL6VnTXUSAAAAsGJ8QhkAgJnV07ZWN4xai9Eic+ekhx+ef/t43/ocnGs+9rks3LOrOgPm1VnVARw4o0UO3Ia8OnfmL5K8KclDq3MAAACAFXJb1uYxcWXePLjwzcdUJwAADKs7aXFfeo5Jq46AYT3nyV+V//Edj/edz0E761Uf7O+99e7qDJhHx+aidz4hV5x7c3UI+8/10Byc9XlXduWMJB+vTgEAAABWyBG5pDqBgaw98rzqBACAQS0ubqtOGK2L3nVSWtZWZ8DQnnzi0dUJTLn3/uhT2o9selR1BsynttoV0VPGaJGDd1Juzefz9CT/uzoFAAAAWAEtP1OdwDAmrRktAgDzZdXqHdUJo9XamdUJUOHkRxxRncAM+OVv+5r22n//+ByxxhwHBtXytOoEDow/JTk0p+SerM+3puU/VacAAAAAy6zHlcFzomfyDdUNAACDuu/z26sTRsxokbl00rrDqxOYERd//YntHT/w5Kw7cnV1CsyPlrOqEzgwRoscupbFrM9/TfLvktxTnQMAAAAso09nQ3UCQ+gnVxcAAAym913Zcr6TFvem5anVCVDhlOOOatUNzI5nfM26dtOPPyUnPdwYFgbyuFz01mOrI9h/Rossnw15a3bljCRbq1MAAACAZbKUl1UnAADAsmrtpuqEUWttXXUCDO2xx7oamuX3uOOOan/782e1Jz/y6OoUmA+rjnDa4hQxWmR5nZRbs5R/k+QN1SkAAADAsri4OgAAAJZTbw7g2Kceo0XmztNOfmh1AjPswz/1tHbOEx5enQGzr7WnVSew/4wWWX4n5AvZkBdlku9Jcl91DgAAAHBI1lYHsMIuvN7vMQAwX5a6kxb3pXWjRebOqU7CY4W96yVntOeecVx1Bsy23p5encD+M1pk5RyX30jPU5N8vDoFAAAAOASfzobqBFbQEbvOq04AABhUn9xSnTBaL7pmXdKOrM6AoT1+vW97Vt5VLz61XXzWCdUZMMP6U6oL2H9Gi6ys4/MXWcpT0vL/VKcAAAAAB2kpL6tOYOVMejNaBADmS1+8qzphtFavPrM6ASo88pjDqxOYE6993hMNF2HlHJ1L3vmk6gj2j9EiK++EfCHr84Is5XlJ7qnOAQAAAA7YxdUBrJzeJudWNwAADGqS7dUJI2a0yFx62mMe1qobmB+Gi7CC2qrTqhPYP0aLDOeE/HaW8i+TfKA6BQAAADgga6sDWEn95OoCAIBBfe7uHdUJo9XaU6sTYGhHrjGbYHiGi7BS2tdVF7B//O3LsE7IJ7M+X5+W/5KW3dU5AAAAwH66LcdUJwAAwDK4JVddsKs6Yrz6huoCGNoZJz2kOoE5ZbgIK6E9pbqA/WO0yPBaFrM+P5M92ZjkluocAAAAYD+szUurEwAA4JD1vrU6YdRaW1edAEM79YSjqxOYY6993hPbc558bHUGzJDueugpYbRInUfmffl8vi4tr6tOAQAAAB5Ey8XVCQAAcKh6azdVN4xbt5xh7pz+KCctUuvqS57cvulJj6jOgFlxdC5555OqI3hwRovUOiX3ZH0uSs+zk2yrzgEAAAD2yjVxs+ji686rTgAAGFY3Wtyb5/7+YUl7aHUGDO2xX3VEdQLkD77/tPbURxvQwrLoq55QncCDM1pkHI7P2/P3eWJa3lidAgAAADAvJm3JaBEAmC+7F++qThithz/8zOoEqPDIYw6vToAkyZ+87Mz22GPXVmfA9Ju0p1Un8OCMFhmPx+burM+F6XlWnLoIAAAA43NnnlOdwPLqrRktAgDzZbJ6R3XCaLVmtMhcesKGo1p1A/yDa37gtHzV0WuqM2DaOWlxChgtMj7H5x35+zwxyeuqUwAAAIAvspRLqhNYdo+vDgAAGNRdd22vThitSXtqdQIM7aSHO2WRcTll/VHtqhc/KUceZs4DB63ntOoEHpw/5Rinx+bubMhF6fm3SW6tzgEAAACStJxbnQAAAAetZ3uuuuDe6ozx6idXF8DQnvaYh1YnwJd5xtesa7/2HT5jCAet5cRc+OZjqjPYN6NFxu34XJ/dOTUtv5hkd3UOAAAAAAAAU6q1rdUJ49bWVRfA0M54lNEi4/TCf31C+w9nP6o6A6bXEUe7InrkjBYZv0flvqzPy7I7T0ny/uocAAAAmGu3xaeUAQCYSr33m6obRq3HaJG587ivOqI6AfbqV779a9ozTvEyDByUpYkrokfOaJHp8ah8JH+U/ystlya5uzoHAAAA5tLh+c7qBJbJxdedV50AADCoiZMW96l1o0Xmzknr1lYnwD7d8B++rp14zOHVGTB9JnHH+sgZLTJdLshi1ufy9JyS5A3VOQAAADB3Wl5ancDymEzyjOoGAIBBLe25rTphtF587WlJ894xc+dpj3lYq26AB/P/XnRqDl/tWxUOTHM99Mh54sl0Oj6fyYa8KIs5K4lPxQEAAMBQmk8pz4rel5y0CADMl93ZXp0wWqsnZ1YnwNCOXGMuwXR42mMe1n7+Wx5bnQFTphstjpy/hZluj8z78kd5Sib5obgyGgAAAGD/tfbk6gQAgEGt2r2jOmHEjBaZO2ec9JDqBNhvP7Lp0e3cJ66rzoBpcnIuvH5tdQR7Z7TI9Lsgizku/zO789Vpubw6BwAAAGbebfGCHwAA0+eKDzlpca/aE6sLYGinnnB0dQIckHf+0Oltw0MPq86A6bF21+OqE9g7o0Vmx6OyPetzaXbnyUneXZ0DAAAAM2ttvrM6AQAADkz7WPKKpeqK0eo5pjoBhnb6o5y0yPTZ/F2Pr06A6dFWGS2OmNEis+dR+Ug25Ows5lvSc3N1DgAAAMwgo0UAAKZKT39vdcOotbhzlLnz2K86ojoBDtix4uewAAAgAElEQVT5px3XXvivjq/OgOnQ89jqBPbOaJHZ9cj872zPk9Py/Uk+W50DAAAAM6Pl3OoEDtGl73p6dQIAwKB6tlYnjFrvRovMnUcec3h1AhyU3/i/v7ad6PsXHlxrTlocMaNFZtu/yK6sz2X5XB6T5JVJvlCdBAAAAFBtkvac6gYAgGH1j1QXjNaLrnlcWjusOgOG9oQNR7XqBjhY/+OCr6lOgCnQTq4uYO9WVwfAIP5F7k3y8tyWX82R+Zn0vCjJmuosAAAAgAq9L52X5v055ktP+8Xcs+vn85B2ACdJrd7/Nzh6Tkrr+3lQQHtk9vf1+dYfmj7Z7+bW+oG8KXNS0vazuZ8Y7ykAU63fXV0wWqtXn1adAEM76eGH52+rI+AQfOvpx7XzL/9If/OHP1OdAiPWnbQ4Yl5gYL48JgtJLs2deVV6fjbJd1YnAQAAwFS6I0/ICbm5OoOD1NqTqxNgeO09+a1n3ZPkngP4RZ9YqZqV0qsDkuR5b3+ocegX6XlUWlu1fz936QSnncEK2dW2VyeM2P/P3r2HWVnf997/fO+ZgRkGkIMwa4DB0ah4CIpGwTw72ZHEKEl0N7Zb2rTp3h4SD6jtjleyt92PaUjSPs2htqmJDKHaktbunYpJNZF4ggipuYpEEzzEoMFI5DQcB+QwM2vNun/PHwyIwiCHmfv7W+t+v66LqzGm4U0tx/nM9zfVOwDI2rSThzNaRMX75u+fpsUvb9MbXWXvFCBWXFqMGKNF5FOTXpX0Ca3XF2X6W5lmeCcBAAAAAFBRTH8gabZ3BgAcsVLygndCbjAOzca1Dw3ToEGjD/W3zGpflNSYcREQt3Qdo8W+mE3zTgCydn7LcC3wjgCO04SRDfYXj7wW7vjBb7xTgFjV6lM/mqB7PrrWOwQHY7SIfNt7EeIjWquLVKMvMF4EAAAAAOCIMVoEUFmSXV3eCUC/+off2Slp5yH/3o2P18ss2x4gbu2afw0/D/TFNMI7AcjaqWMavBOAfnHHR062d33+p+HVLfw0BxxSUtcqidFihI7wCQWgyk3QMjXrI+rRexX0qHcOAAAAAADRM03yTgCAo9I5qNM7AcjEjY+0HvFz1EB+LPcOiFrQKO8EIGsTR9V7JwD95uu/e5p3AhCvxCZ4J+DQGC0CBzpwvCgt9M4BAAAAAADod59+fIp3AuDin/+D0SJyopZPLADeJshWeDdEzQKjReTO+BGDvROAfvO75421i04e7p0BxGq8dwAOjdEicCgTtEwFXa5UZ0r6rncOAAAAAABAv6mxGd4JQPbsF9Ls1LsCyIYxWgQOEri02JerFxYkG+KdAWRpSF2iCSPrzbsD6E93cm0RODTj0mKsGC0ChzNOK1XQJ1TS6TLNlVTyTgIAAAAAIBob1OqdgKNnpo97NwBZC9Lj3g1AZiw9xzsBiE65vME7IVqDB3OFG7kzefxQ7wSg3/2nU0fYpWdyOBc4hIJ3AA6N0SJwJFr0azXpJplaJH1F0g7vJAAAAAAA3AVxsa8yTfMOADIXjNEi8uQ93gFAdGpqt3snRGyqdwCQtfNbhnknAAPiy1ec4p0ARMgYLUaK0SJwNJq0UQX9mbZqgqTbJL3unQQAAAAAgBsu9gGoHC97BwCZCdbgnQBEp3PnNu+EaJld6J0AZO3d4xu9E4ABMe3kE+yDp4/0zgAiE3gpJlKMFoFjcbZ2qaC/1U90ioJmSlrmnQQAAAAAQOZMl3knAMAR2bOjyzsByBCjReBAIRQ1/0ouLfZtnHcAkLXTxgzxTgAGzOcuneidAMTmRO8AHBqjReB4zFRZzVqggt6roKmS/kVSyTsLAAAAAAAAwAHq6zq9E4CsmIklBnAgs+XeCVEzjfBOALI2cVS9dwIwYD5y9ol2VoFfDgIHGKqrn+QH/ggxWgT6S7N+poI+KVOLTF+StME7CQAAAAAA4C0+/fgU7wTAxbwrGC0iT7i0CBwgmFZ4N8QtcH0IuXNGodG8G4CB9CfTW7wTgLjUdxW8E3AwRotAf2vSRjXpC9qqVgXNlOkn3kkAAAAAAACSpFq72DsBcLBUUvCOADLU6B0ARCUNXFrsy1VPDpVsuHcGkKWJIwd7JwAD7sb/PMFGDqn1zgDiYbWMFiPEaBEYKGerqGYtUJM+oFRnSrpL0g7vLAAAAAAA+tV6neGdgCNnQTO8G4CsBdlS7wYgM9c/Mdk7AYhOSFZ5J0RrdHGqdwKQtfMnDvNOADIx8/yx3glARGyodwEOxmgRyMI4rVRBf6qSmhV0NdcXAQAAAABVhMt9lcR0mXcCkLnAaBE5kqTneCcA0QnlDu+EaIWaKd4JQNbOb2G0iHy44f3jvROAeASb4J2AgzFaBLLUok416ztq0gdU0umS/lLSBu8sAAAAAACOWcLlPgDRe9k7AMiOTfIuAKKTaJt3QrQSu9A7AcjamYVG7wQgE+dPHG5nFYZ4ZwBxCKr3TsDBGC0CXlr0axV0h36iFgV9TNL9kkreWQAAAAAAHBXTB7wTAOCw9uzo8k4AMsRoEXi7rTu2eydEK+gU7wQga+NHDPZOADJz+eQTvROAOJiavBNwMEaLgLeZKqtZP1JBv6/dGiPp0zwfDQAAAACoGEEjvBMA4LDq6zq9E4DsJIwWgbdapQUzi94R0TKN8k4AsjZxFMe2kB/XvLfZOwGIBT/4R4jRIhCTd2mHCrpHTfqAUrVK+t+SfuWdBQAAAAAAqsD1j53hnQA46Na8K/Z4RwCZsZQ3L4EDhbDCOyFqfAIScmZIXaIJI+vNuwPIypnNQ3kiGtir4B2AgzFaBGI1Tr9VQX+lgs5S0NkyfUnSa95ZAAAAAACgQtUkM7wTAAdLvQOAbBkflQYOEMyWezdEzQKXFpErk8cP9U4AMnfJGfxQDyBOjBaBStCsl9SkL6igUyRdJNPXxIARAAAAAAAcBQtitIjcCTJGi8gVkzV4NwBxCYwW+3Ljo1Ml42PFyJXzW4Z5JwCZ+y/nnOidAPgza/VOwMH4hShQaQp6Wk36XyroFPVoikxfEE9IAwAAAAA8rRfPDlcC02XeCUDmQspoEfkSeB4aeItSucM7IVpWO8U7Acjau8fz0yTy55IzR9uQQUyDAMSHH5mASjZBz6lJX1JBZylVq0z/S9KT3lkAAAAAgJwxXeSdAACH1r3auwDIzLUPDZPZIO8MICpJ7XbvhIhN9Q4AsnbamCHeCYCLC08a7p0AeKv1DsDBGC0C1WKcfqsmfU0FfVCpxijoakn/V9IO7zQAAAAAQJVjtAggVqW6Tu8EIDN1DZO8E4DodHRs806Il53pXQBkbeKoeu8EwMXUVkaLyLswwbsAB2O0CFSjcdqiZn1HBf2htmqsgi6W9FeSXvROAwAAAABUJZ6WAxCnN95gtIj8SHSBdwIQlaBtWjBzl3dGtIJGeScAWTuj0GjeDYCHCycyWgQQH0aLQLU7W0U1a6kK+t8qaLJ61NJ7hfE+SVu88wAAAAAAVWGadwDewY2PtHonAA66tWAmo0XkR7DJ3glAVMxWeCdEzTTCOwHI0sSRg70TADczL2hisAsgOowWgbyZoLW9Vxj/WAWNUY+myPRZSQ+Lp6QBAAAAAKhOVjPDOwFwsNQ7AMgYz0MDBwghLPduiFoIXFpErpw/cZh3AuBqzNA67wQAeAtGi0DeTdBzatKdKugK/USjlepCRowAAAAAAFQXC8ZoEbkTgj3u3QBkytTknQBEJeHSYp+ue/RUmQ3yzgCydH4Lo0Xk2+lNQ7wTAE8TvANwMEaLAN40U2WN0zMHjRgT3aKgBxS01jsRAAAAAAAcA9Nl3glA5kLKpUXkTGj0LgCikva85p0QrUE1U70TgKwx2ELetY6q904APNV6B+Bg/EMB0LeZKkt6pvfL3ZKktZqgGl0kaZpM75c0WRK/ygcAAAAAIG58dAL5U9J67wQgSyZr8G4AolLSNu+EaKU2hdM2yJuJI/ktEfKthe8DACLDaBHA0ZmgtZIe6P0i/VKDNEJnK9FFMp0r6T2SzpVU5xcJAAAAAACA3Btc7PROADI21DsAiEpNabt3QrTMpnknAFkbP2KwdwLgavxIvg8AiAujRQDH52wVJf2i98tev9QgDdPpqtOFks6S6XxJZ0tq8okEAAAAAAy49TpD47TSOwMA9lud7PFOADIVQoPMvCuAeMx7lkuLfTGN8k4AslSXmE4a3cBPksi1U0/kKDeAuDBaBND/9g4ZX+z98qbfaqTqdKFM75JpkvY+LX2GpHHZRwIAAAAA+tkZEqPFKN34SKt3ApC98IYe+Wi3dwWQmRsfaZVZjXcGEA97SZqdelfEK4yS2G8hP86fOExPe0cAzobXMw8CEBd+VAKQnZPUIenxg/79NWpQojOU6DQlOklBp0lqlfb/TwAAAABA7ExTJD3onYFDqbnYuwDIXrLUuwDIVu0k7wIgJkHhKe+GyI3wDgCyNHlcI6NF5N7Y4YO8EwDgLRgtAvDXok69/YnpA63ReCVqlWmsajVOqcbJNE5B4yUN195np8dKGnLMDUGdMj0vaZFMpWP+73nnr2e8THUD9t9/+K97iPb+38nj666RqcXl695rjKRGx68fAAAAqH57R4uIUGI2I3hHABkLQYwWkTM2SeJHe2C/oBXeCdG6emFBsmP/eApQgc6bOMw7AQAAvA2jRQDxa9E6SeuO6D+7ofcyY4/GqrZ3xFhWjWoOGMyZigpaL0kK2qWgjRqvNf0bDfT6tQZrqJodC/yulZqGK2iU09ddK9N4l69bkoLGyeTzKWtB9ZIKTl93ItNEl697r9GS+NMnAAD8+PwaBO8oSJd5NwCZCymjReSLpefw1CtwoPC8d0G0GuqmeicAWTtldIN3AgAAeBtGiwCqS7NW9/6r1Yf9zwFZOU3d8v3/R74vAFkIqlW7JjgWeA6UhyroRKevO3G45NsoaYzS3ivCb451E8l1tAsAMZjmHYA+8fwf8qfU+wmrQH68xzsAiEvY4V0QrWBT2TgjbyaOqvdOAAAAb8NoEQAAADheph4xUIYk3a8avV8t6lGtajVBqZqVqF6JJiqoVqYJCmrt/dctkk7yTgYAAKhKtbbbOwHIVLAGRkjAAYq2zTshXsm53gVA1s4eN5SfJQEg39q9A3AwRosAAAAA0F9mqqw3R6Srjuh/p12N6laTBmmipFaZRipopKSTeq84tiqoWabBAxMNAABQhTo6Or0TgIzx7iVwoHQdo8W+jfMOALI0fsRgrfOOAAB46/IOwMEYLQIAAACAp4J2S/pN75e+tatRJTUrUatqdJJC76Bx79CxVTxPDQA4lFkLCwreEUDmNmvBzKJ3BJAlMw3xbgAi0q751/CB6b6d6B0AZGla63B93zsCiEBPOfVOAIC3YLQIAAAAAJVg77hxlfq64Dhbia5Rq2rUqlqdrKCTZDpZ0iTtHTeOyS4WABCNtG4Gz4Uid4It9U4AHHBpEXjTcu+AqFkYIX6BiBx5/6kjGC0CklZvZc8PIC6MFgEAAACgGsxWqtmHudi4RqNkmqRanamg1t5B4zkKmsTT0wBQvRKzGRxaRN4EBUaLyKNG7wAgFkG2wrshWlc9OVRKh3tnAFma1MQxYkCStu0peScAjsJ27wIcjNEiAAAAAORBi7ZJ+o/eLwcyva5TVKOTVaPJCpoi6RSZzpHEBzIAoMIF6TLvBiBzqRgtIl+uf2KydwIQl8Clxb6MLk7lw8PIm+YTBnknAFH4LZcWkWsJo8UI8atSAAAAAMi3oIl6VdKrkha95e/8VqdokM7sHTCeJemc3i8AgMoxwjsAyF55i3cBkKkkPUdKvCuAeJTLG7wT4pVM9S4AstY0jNEiIEmvMVoEEBlGiwAAAACAQztp/3PTC/f/e/erRv9J56pG52nv89LnyXSuuMoIAACiUbPHuwDIlk3yLgCiUlPLJZ2+WHKudwKQpboa07gR9ebdAcTgt9sYLSLPQrt3AQ7GaBEAAAAAcORmqizp571f9jGt0btUo2mq0blKdRFDRiCn1usMjdNK7wwAOdfR0emdAGSM0SJwoM6d27wTohV0iphvIUemtQ7XU94RQCRWc2kReRbEd4AIMVoEAAAAAByvoBatkrRK0r9IkmYr0Q06U6aLJE2TdJGkyX6JADJhKkiMFqNx9b/xNDTyJ4S1WjCz6J0BZCuZJAXvCCAOIRQ1/0ouLfbFNMo7AcjS+S3DGC0CvV7ZxEF65JiJXx9GKPEOAAAAAABUodlK1axfqqB7VdD1Kugc/Up16tElku6Q9LCkN5wrAfS3oHrvBBygfsgM7wQgayZb6t0AZM7SRu8EIBpmy70TohYCo0XkytRWHgEBJOmnq7bzGS7It8BoMUZcWgQAAAAAZGO6eiQt7v0iSaZ2na1E05TqYpkuVtAEx0IAx2vvddVHvTOwV2I2g49KIG/SRIwWkUM2xLsAiEUwrfBuiJqJS9zIlZNG8Xl1gCQtenmbdwLgbat3AA7GaBEAAAAA4CWooBclvSjpXknSGp2qwfoAI0YAOH5ByWU8F4rcMS4tIn9M1sCP90CvNHBpsS83PjpVMl7hQ640nzDIOwGIwrLXePAGubfLOwAHY7QIAAAAAIhHi1ZJWqWDR4zTJV0qaYxjHYB3Yip4J+BAgX8eyJ/u3Tu8E4DMhbRRZt4VQBxCsso7IV51U70LgKydOraRnyABScte47dJyDkLa70TcDA+mwYAAAAAEK8WrdJY3auCPqmCmiSdI9NnJS1SULd3HoCDnOEdACDnOus6vROATF370DCZcUYK2CeUO7wTomVhincCkKXxIwZ7JwBR+Omq7aFjT493BuArTbd7J+BgjBYBAAAAAJUiqKAX1KQ7VdCHtVJDVdalMt0p6ZfecQAAIAKNaxgtIl/qGiZ5JwBRSbTNOyFedqZ3AZClaa3DvROAKDz0/GbvBMCflbd4J+BgjBYBAAAAAJVpuno0Xk+oSZ9VQe9WWROV6FZJC7nCCLip9w5Ar6uf5J8F8ieEtZp3Q8k7A8hUogu8E4CobN3BFZ2+BI3yTgCyxGgR2OvhF9hqAVpZz/PQEWK0CAAAAACoDuO1RmP1LRV0udZpmKT/IuleSXw6MZCdad4B6NVQnOGdAGTNZEu9G4DMBZvsnQBEZJUWzCx6R0TLAqNF5Mrk8UO9EwB3v9qwK7zUvsc7A/C2RUum80Z6hBgtAgAAAACqzwUqqaAfqqBPaa4KSvX+3mekV3mnAUAWkmCMFpE7aSJGi8gjnocG9glhhXdC3IzRInKladgg7wTA3d//dL13AuAviHOjkWK0CAAAAACobrOVapye6n1G+jRJ58j055J+6Z0GAAMlWHKZdwOQuR495p0AZM7U5J0AxCKYLfduiNZ1j54qqdY7A8hS8wmMFoH7n93knQD4M+Np6EgxWgQAAAAA5EtBL6hJX1ZB7xYDRgBVK7R6FwCZS9Iu7wQge6HRuwCIR2C02JdBNVO9E4As1dWYxo2oN+8OwNP3f7EprN3e7Z0B+AuB0WKkGC0CAAAAAPKLASMAANWj2NXpnQBkzWQN3g1ANErlDu+EaIXkfd4JQJbObxnmnQC4m/vv67wTgFis9g7AoTFaBAAAAABAOnDAOFlBU2W6U9Jm7ywAAHCEfvMLRovIo6HeAUA0ktrt3gkRO9s7AMjStNbh3gmAq19t2BUWr9zmnQHEwcSCN1KMFgEAAAAAeKugZv1MTfqs5qqgVJdJ+kcF8Z4KgMpw9ZP13glA9uxVLZnd410BZC4ELi0C+3R0sM7oi2mUdwKQpfO4tIic++tFr6scvCuAWAQuLUaK0SIAAAAAAH2ZrVTj9LgKulbbNFymT0pa5J0FAIfVUJzhnQBkzSws9W4AMnfjI60yq/HOAKIQtE0LZu7yzohXYLSIXDn5RD6PC/m1tqMz3Le83TsDiEexh9FipBgtAgAAAABwJM5WUU36FxX0YdVqgqQ7JL3unQUAb5cEY7SI3EnLYrSIHKqd5F0ARMNshXdC1IIxWkSuTBgx2DsBcPOFh19Tdw9nFoH9Xh3MaDFSjBYBAAAAADhaJ2qdCvpLFdSqoMtlWuCdBAD7BEsu824AMhe0xDsByJ4xWgR6hRCWezdE6+qFBZk4O4dcOXVso3k3AB64sggcZJWWTO/xjsChMVoEAAAAAODYBTVroZo0Uz06UabPiuuLANyFVu8CIHNJ2uWdAGTO0nO8E4BoJFxa7FND3VTvBCBL47myiBz73Pdf5coi8Ba2yrsAfWO0CAAAAABAf5igrWrSnfuvLwY97J0EAEBubN2xxzsBcPAe7wAgGmnPa94J0QrGaBG5cn7LUO8EwMXPX38j3P/sRu8MIC4hMFqMGKNFAAAAAAD6197ri826QkWdqqC/lrTDOwoAgCrX6R0AZC5Yg3cCEI2StnknRMuSC70TgCy9710jvBMAF7O++7LKHFkE3u5l7wD0jdEiAAAAAAADZaJeVbM+p59otBJ9StIL3kkAAFSdoBe0YGbZOwNwwGgR2KemtN07IVpBJ3onAFmaPJ5Li8ifb//72rDstTe8M4D4cGkxaowWAQAAAAAYaDNV1ljdq4LOVVkflng6GsAAuWHRDO8EIGtmWuzdAHgw0xDvBiAa857l0mLfGC0iV5qGDfJOADJ3+4OveicAceruXuGdgL4xWgQAAAAAIDtB47VIBV2hoHcr6J+9gwBUl8RSRovInVS20LsBcMKlRUCSZC9Js1PvimiZRnknAFlqPoHRIvJl5t+/EDr29HhnADHarvkfa/eOQN8YLQIAAAAA4KFZv1Sz/ptSjVHQX0vq8k4CUPmCGaNF5E9tcbl3AuCk0TsAiEFQeMq7IVpXPTlUEm/lIjfqakzjRtSbdweQlQXPbgz3/3yTdwYQKVvpXYDDY7QIAAAAAICncdqiZn1O0okyfVbSDu8kABVtkncAkLnuMmdFkD/XPzHZOwGIRhDP/vVldHGqdwKQpfNbhnknAJm6/v+wyQL6FMIz3gk4PEaLAAAAAADEoKDdatKd+olG944XN3onAQBQETo6GS0if5L0HO8EIB7hee+CeCWMFpEr01qHeycAmbn4b57lWWjg8F72DsDhMVoEAAAAACAmM1VWk+7UXI1Tok9Jet07CQCAqC24quSdAGTPuKwL7Be4Vt8XSy70TgCydB6XFpETn//hq2HJr7d7ZwBxC+Vl3gk4PEaLAAAAAADEaLZSjdW9mquTGS8CANCHoBckC94ZgANGi8A+RdvmnRCtECZ6JwBZOvnEeu8EYMAt+tXW8P89sto7A4hfTR3vp0eO0SIAAAAAADE7cLxYo09L4ooIgEO76YmLvBOArAXp+94NgI+E0SKwT7qO0WJfzEZ4JwBZmjBisHcCMKDWdnSGT/zDL1Xm07aAd/Ki5kzf5R2Bw2O0CAAAAABAJZitVGN0j36i0TJ9VowXAbxNIvu4dwOQuVSLvBMAF5Y2eicAkWjX/Gu6vCOiFcIo7wQgS6eObTTvBmAgfeRbz2nzrpJ3BlAJVngH4J0xWgQAAAAAoJLMVFlNulO/0olK9BeS+AAdAElSCOkM7wYgc7tLz3snAD5siHcBEInl3gHRuur+QTJjtIjcGM+VRVS535v3fHhh/W7vDKAyBD3tnYB3xmgRAAAAAIBKNF09GqvPK9EYBd3tnQMgAmbneicAmWss93gnAB5M1uDdAMQgyLii05fRw6d4JwBZOr9lqHcCMGBue+CV8L1fbPbOACpHKC/zTsA7Y7QIAAAAAEAlG6tdatYtKuk0BX3POwcAgGw18zYa8inwPDSwV+DSYp/qpnoXAFma1nqCdwIwIO768evhbxav8c4AKkdQl16u4xNbKgCjRQAAAAAAqkGLVqlZ/1WJ3i/pZ945AABkYt4FXFpE/lz70DCZDfLOAKJQLm/wTogYo0XkyhQuLaIK3ff0hvCZB37tnQFUFrNntGQ6f1ZQARgtAgAAAABQTcbqKRU0TYk+JWmHdw4AAAMm6BlJwTsDyFxdwyTvBCAaNbXbvROiZeE07wQgS83DB3snAP1q8cqt4br7fqUyv+MBjo6Fp7wTcGQYLQIAAAAAUH2CxupeNWm0pL/0jgGQgZueuMg7AchakBZ6NwAuEl3gnQBEo3PnNu+EaAUb4Z0AZGns8DrvBKDfLF65NVzR9ry6e1gsAkcthKe9E3BkGC0CAAAAAFCtTGUVdIfq1KLAsAOoZons494NQOZSLfJOAFwEm+ydAEQhhKLmX8mlxb5YGOWdAGSpZWSDeTcA/WHfYHFPMfVOASpT584l3gk4MowWAQAAAACodqO1Vs26XDW6QtLr3jkA+l9QuNi7AchcT8Nz3gmAE56HBiTJbLl3QtyM0SJyY1rrcO8EoF8wWASOV1jBJ7VUDkaLAAAAAADkxRg9rJ/oFPFkNFCNpnkHAJnbub7HOwFwYWryTgBiEEwrvBuidcOisyTVemcAWTmvZZh3AnDcGCwC/cG4slhBGC0CAAAAAJAnM3ufjE50msSzmuhnQS97JwDIkZEdjBaRU6HRuwCIQhq4tNiXJEzxTgCyxKVFVLr7nt7AYBHoF2GpdwGOHKNFAAAAAADyaKxWqaBLZfpjSV3eOagSpnbvBAA5Mu+GkncC4MFkDd4NQBRCsso7IVoheZ93ApClk0bXeycAx+zen64L//07LzFYBI5fj6yGT9KvIJwFB/rDNztPTpKaj6QhrJPK7QphjW5tXO+dBQAAAADvIKhJ92mTHlSquZL+yDsIAIAjErTYOwFwNNQ7AIhCKHd4J0TLwmTJvCuAzIwfMdg7ATgmsx/+TbjuvpXeGUCVCM9ozvRd3hU4cowWgf6wu3ObThj69UQ2ZP93q7aiJK0O0jrJNpnCOpmttxA2lFVeraKtU+eeTbp91A7PdAAAAADQWO2S9Elt1ndV1j2SmryTUKECVztdfPpxnv9D7oREXE9AfoXQIGOMBCjRNu+EeNkI7wIgS5OaGub/kvwAACAASURBVPmJERXn6u+8FGYvfM07A6gewR71TsDRYbQI9IfbR+1QW+kuKdz+tr/TalKrFPb+VQgKkhLVSIMkDRoqzSl2BmmNTOtNWi2FTVKyKU3TtbJ0vUxr9Iv6dZpnPHcDAAAAYGCN0cN6UhN0puZKus47BxVpmXdALtXYDO8EIHvGpUXk042PtMqsxjsDiMLWHdu9E+IVRnFpEXkxdlidNnlHAEfpg3/7bJi/bIN3BlBdLH3MOwFHh9Ei0E/SUJ6fWPL20eI7MzWYdLr2ftHe30QGJYlJ6v2zp/NKUluxI0jtCmGNma2XbLXSsDlV2CSV1yux9bqpYXV/fXsAAAAA5NR09Uj6lDbqXxX0z+LqIhA9M33cuwHIXFc9b6ghp2oneRcAkVilBTOL3hHRCjaKzSLyYlrrcP3QOwI4Qr/euDtc3va8fvwKu3ugXwVt0dwP88nUFYbRItBfZtW/HOZ2P27BLh2gr2GkSSNldubevwxSIiUyvfVJatsUFDYphPUHjRst3cjlRgAAAABHpElP9F5dnC/pj7xzUCGC+FN3H9O8A4DM7Vzf450A+LBJ+1/2AfIshBXeCdG6/omJMtV7ZwBZmdZ6AqNFVIQfPr85TP3aM+rYw29lgH5n4mnoCsRoEehHIaRfNdUM1GjxSCvGmjRWZu/u/esDxo2HuNworTdpjWTrJHWkId0gS9dLWq2NHZs0e9wen28HAAAAAHd7ry5+Uu36V0n3S3zgC+/AxAePAWRjZAcf6UM+WXoOT74CUjBb7t0QrZowxTsByNKUlqHeCcA7+vKPXgsfn/u8ynzuCTAw0sDT0BWI0SLQn35cvzR8sPi6ySZ6pxyBvZcbpTcvN0pK7IBxY9OJ0pxiZzCtl7TGpHWSOmS23kLYUC6n65Qmm2Slzbq1cb3DtwEAAABAFgr6oTZrrMr6vqRLvHMAALnXpXk38IoI8uo93gFAHAKjxb4Em8q2GXnSPHywdwJwWL/T9lz4/A9/450BVLMede982DsCR4/RItCfFlg5fLB4h0n/5J3Sb0wNJr1Le7/sFYKCpKQm6d031vU+Ta3VQeqQQrvJNu59mrq8PZW1K0k3SlqtHZ0dun3UDo9vCgAAAIDjMEY7JV2qdt0i6S7vHESqRiu9EwDkwmLvAMBNsAbGSICkUrnDOyFallzonQBkaezwOu8E4JCWv7YjfOIfXtRDz2/xTgGqnC3R/Cu3e1fg6DFaBPpbuv3flIzYI2mId4qDVpNa33yeJEhJokTS/uuNJwyV2opFSeuDtFqyDgths8zWWxrWlxU6ZOlGmdbwPDUAAAAQnaCCvqm1ekx1+qGCTvcOQmTGqt07IXeuf+wM7wQgayEwWkSuNXgHAFFIavnAdN8K3gFAllpGNjDnR3S++eSa8IG//bk6S6l3CpAD6YPeBTg2jBaB/nbz2F2aW/qSQviKd0rEBmn/wDH0bhyDQiIlOvh5apk2vn3gqDRsThW27r/guLu0S58dzqepAAAAAFmYoFcUdJY2ap6ka71zgFyrSWZ4JwCZS7XIOwHwYpbLT5YHDtbRsc07IVpBI7jIiryY1jpcT3tHAG9z5dznwq33v+KdAeRHqfiQdwKODaNFYACke0r3JQ21X5bEPfLjZWrQIQaOevvAsbFGaiuWJa0J0iaFsN3M1kthk5RsNYVN5XK6TkrfUI1t1E0Nq92+TQAAAEA1MJUlXadNelSp/klSvXcSkEcWNIMPSiN3evbw5zrIMy4tAkHbtGDmLu+MaJlGeScAWTmvZRijRURj8cpt4Y/+8Zf6t+e4swNkJzylez661rsCx4bRIjAQbhuyTm3FeyTd5J2SMzXaN3C0fR+xMUlBQVJSk0i9j1WrrShJuyRt2XvFMewy2RbJVitoj1nYXDZbpzTslJXbldSv0w1Wyv6bBAAAAERurBZoq5apR4t4LhpwYLrMOwHI3M7uHu8EwFGjdwDgzmyFd0K0rnt0lKSh3hlAVub++zrppsXBuwOQpA/93S+8E4D8MT3gnYBjx2gRGCBpmv5NkiSMFuM2VNLQvVcc940c915zDJKSsO+yY42UlqS2YknSuiDtUNBWM70uaY9km0xhfVlhj5SuU1qzXUl5O0NHAAAA5MZoreG5aABAZjaP4c9bkE/XPzHZOwGIQQhhuXdDtGprp3onAAAAZKZY/J53Ao4do0VgoNxcv0ptxf8j6Q+9U9Bv6rT3kqPe+vRW7yXHfc9VJ9Ihho57JG0ys80KYXfvRceSWVhfVuiS0nYp7JFsk7rqt+sztj3jbxsAAABwfPY9F92uZZLmeecAAKpWl5ZM59Ii8ilJz9n/kgyQZwmXFvtkYcrbPoABAABQpXgautIxWgQGUJrq60nCaDHn3hw6Smcp7LtQf8BFx31jx33qS73PV9tmKewO0mZJu98cPGqHZB1S2m2y9rJUlsprJGn/lce0vqybbU1W30gAAABgv4L+Xhv1tIIel9TknQMAqDqLvQMAPzbJuwCIQtrzmndCtCy50DsBAAAgG/Yv3gU4PowWgYF086AVYW7pQQvh494pqERhjKQxe5+vlt4cPEp7547WO3qU9o8e9115TPYNHyVJJUnrMggGAABHIATtNtN/pEFPy8Iy3TT4Re8moN816Xlt1mnq0Y9kep93DlC1rn/sDO8EIGshaKF3A+CI0SIgSSVt806IVggTZVxaBAAAVa9H5T0PeEfg+DBaBAZYKIcvWiJGi/BUp33DRwAA4K73YwdnJ6ZPSabQVtwl2RKTlqVpz1Ld3PCUcyLQP8Zop4I+oHZ9U6ZZ3jlAVapJZngnAJkrG5cWkWPJpL2fzAzkXE1pu3dCtMxGeScAAABk4GHNu2KLdwSOD6NFYKBxbREAAACHYdJQKVwu6fIkqZHmFHuCaYnJljBiRMUzpZJuVruek/Rt7xwMMBMfPM6YBV0sDukgb8q7N3gnAG4sbRQ/8APSvGe5tNiXEEZwaREAAFS/8B3vAhw/RotABri2CAAAgCNmqjXpEilc8uaI0R4NaXmpLHlSswY9650IHLWC5mmDVsi0VFK9dw4GSNBz3gm5Y7rMOwHIXDq85J0A+LEh3gWAP3tJmp16V0TpqvsHcWkRAABUvaAtWlnzsHcGjh+jRSALXFsEAADAsTLVmsLlliSXS1JoK22xEB5Ng5ao3P0D/cmwzd6JwBFp1nJt1ekq6SlJE71zMCDavQNyiBEw8mf3ZkaLyC2TNfA8NPIuKPAaQV9GjpzqnQAAADDgTPdpyfQe7wwcv8Q7AMiLUA5f9G4AAABA5TOFE2X6ZJLonqRu8EZrKz6fzO3+mr7V+SHvNuAdjdYardWpMi3yTsEACFrpnQCgygXt0IKZZe8MwE1IG70TAHdBK7wTopUkU7wTAAAABlzoudc7Af2D0SKQlZsHrQhmD3pnAAAAoKqYSZMV7HNJTc0iayvuTOaW7tfdxet0184x3nHAIV2gkpZqhoLavFPQz/gAMoCBZlrsnQC4ufahYTIb5J0B+AvPexdEjEuLAACgyoVlmnvZi94V6B+MFoEMhXL5c94NAAAAqF4mDVUIVyWJ7klqB7dbW3G57u76rL7VfbZ3G/AWM1VWQTcr6HbvFPSjhOehM3XjI63eCUDWQuBSL3KsrmGSdwIQh7DDuyBaFk7zTgAAABhQwb7tnYD+w2gRyNLN9ask8YMoAAAABp4pMenCJEm+ntTYi9ZW/G0yt/tr+mbnB73TAEmSKahZX1XQ1d4p6CcFLfNOyBWrmeGdAGSubFxaRH4lusA7AYhC0bZ5J8TLRnkXAAAADKDt6kq+6x2B/sNoEchY2tnzZUkl7w4AAADki0kTFexzSW3NYmsrbUraivM0p+tj3l2AmvUdSb/jnQFUGgvGaBH5U969wTsBcBNssncCEIV0HaPFPoUR3gUAAAAD6B7Nn97lHYH+w2gRyNptQ9Yp2Je8MwAAAJBfpjBG0qcTSx62tuIbyZzidxgwwlVBP1DQNEn8oRNwpEyXeScAmWusK3onAI54HhqQ2jX/Gn7P0CcuLQIAgCoWind7J6B/MVoEHKRde+ZI2uLdAQAAAJg0TKb/xoAR7pq1XKnOEMNF4EjVewcAmWvf1eOdALgxNXknABFY7h0QrRsWnSWp1jsDAABggDyouR9Z7R2B/sVoEfBw2wnb0pD8mXcGAAAAcKBDDhi/2flB7y7kyDj9Vrt0kqSN3ikAgMiYbdSCmWXvDMBPaPQuALwF2Qrvhmglep93AgAAwMAJXFmsQowWAS+bXv6noLDSOwMAAAA4lP0DxtqaxdZW2pS0Ff9Oc4rv8e5CDpyqTarT6WK4CAA4gIWw2LsB8GSyBu8GwF/g0mJfgk3xTgAAABgYYYXaLlnkXYH+x2gR8DL77GII4VbvDAAAAOCdmMIYSX+SmJ6xOcWXNaf0Rd3V9S7vLlSx0XpDNTpN0gveKUCUZi0seCcAWUuDGC0i74Z6BwDuyuUN3gnRsjDZOwEAAGBABPs77wQMDEaLgKdZ9YtCsIXeGQAAAMCRMtPpiYU/T+qSX1tbcanaijfprq3DvbtQhcZop9bqPWK4WCme8w7IlbRuhncCkLlUXFVAvoXApUWgpna7d0K0go3yTgAAABgA7VqZ3OcdgYHBaBFwFso9t0oqeXcAAAAAR8lM+s+JNMfqhm1J5hS/qzldH/GOQpW5QCWGixVjpXdAniRmjBaRP7W127wTADc3PtIqsxrvDMBd505+LuiLidEiAACoPpZ8RUum93hnYGAwWgS83drwmsz+yjsDAAAAOFYm1cn0+4klP7K2UjvPR6NfMVysFCu8A/IkSJd5NwCZq+nkk36RY7WTvAsAdyEUNf9KLi32JWiEdwIAAEA/2y7pXu8IDBxGi0AE0nLH14PCBu8OAAAA4HiZQlNi4c+T2uQVm9P9mNq6f8+7CVWA4WL8gpZ5J+QMH5RG/rTv4rICcswYLQJmy70TonX9ExNlqvfOAAAA6FdB39Cc6bu8MzBwGC0CMbh57K5QDtd7ZwAAAAD9xpSY2aWJ7AGbU9yRtHV/VXd1n+WdhQrGcDFuXYwWAQygoNe1YGbZOwNwY+k53gmAt2Bc9u6T2VTvBAAAgH62XV1v/J13BAYWo0UgFrfUPxyCLfTOAAAAAPqbmYZL9j+TOnvR5nQ/pru7f9e7CRXqApXUpPdI2uidgrc5WV3eCQCql5kWezcAzt7jHQC4SwOXFvvGaBEAAFSXoG9o/pXbvTMwsBgtAhEJxZ5ZkkreHQAAAMAAMTO7NEnse9ZW2qi7S7N1154J3lGoMKaS6nS6GC4ir2YtLHgnAFlLpUXeDYCrYA3eCYC7kKzyTohWYud6JwAAAPQjrizmBKNFICb/o+H1VPpT7wwAAABgoJnC2CQJX0jqalcnc4rf1d17/h/vJlSQ0Xqjd7i4wzsFyFxaN8M7Achcybi0iLxjtAiEcod3QsT4pBYAAFA9uLKYG4wWgdhs/PW9Qfq5dwYAAACQkRqZfj9Jan9qbcWnNad4jXcQKsRovaFU50o8S4x8SUwXezcAmesu7/JOADyZaYh3A+Au0TbvhGgFjfJOAAAA6CdcWcwRRotAbGafXQyl8MfeGQAAAEDWTJqamP7B2orb9z4dvXOMdxMiN06/VdCZ3hlAloKSy7wbgMxtKfd4JwDOuLQIbN3BtZ2+mEZ4JwAAAPSLoL/mymJ+MFoEYvQng1+S2Re8MwAAAAAPJp2QJOELSe3g9cmc4nzd1X2WdxMi1qzVkt7rnZFzz3kH5Evg+T/kz7TlJe8EwFmjdwDgbJUWzCx6R0TpukdHSRrqnQEAANAP2tWV3OkdgewwWgQile5p/3pQWOndAQAAALgx1cr035M6e9HmdD+iu7tmeCchUgUtU6I/8M7IsWXeAQCqWNDrmj079c4A3Fz/xGTvBMBdCCu8E6JVWzvVOwEAAKBfhGS25k/v8s5AdhgtArG6raUzpPYJ7wwAAAAgAmZmM5IkecTmFJeprZtxGg42Vv+qoNu9M3IpMFoEMHDMtNi7AXCVpOd4JwDegtly74aIMVoEAACVL2ilVupe7wxki9EiELObB63gmWgAAADgTWaalsj+r80prtac4o3ePYhMs76moDbvjNxhtJidq/9thHcCkLVUWuTdAPiySd4FgL/AaLEviZ3rnQAAAHD8wue0ZHqPdwWyxWgRiFza/spXgvRz7w4AAAAgJmY6KTG1WVupXXd3365bw2DvJkQhqKBbJC30DsmVcVrpnZAb9UNmeCcAmSvzYzpyj9EiUCp3eCdEK4SJ3gkAAADHJYQlmnvJw94ZyB6jRSB2s88uhpD+oaSSdwoAAAAQG1NoShL7KzurtJHxIiRJplRrdaVMr3inAP0tMWO0iPzpTLm0gJxLGC0CSe1274RomY3yTgAAADgOPSqnn/GOgA9Gi0AlmFX/chp0i3cGAAAAECuTTmC8iP0uUEm1ulBSl3cK0J+Cksu8G4DMde3gE3mRb5Y2eicA7jo6tnknRIzRIgAAqGT36O8vXeEdAR+MFoFK8WTdvSEYz+EAAAAAh8F4EfuN1huSzvLOAPpXKHgXAJlb8BKXFpFzNsS7AHAVtE0LZu7yzojSVfcPkjTCOwMAAOAYbVd5z+e9I+CH0SJQKRZYOYTuT0na4p0CAAAAxI7xIiRJBb0m05XeGVWOa5YABtKvpdmpdwTgyWQN3g2AKzMu7/Rl5Mip3gkAAADHLCS3a94V7F9yjNEiUEluHtqepuWZ3hkAAABApXjbePF/evfAQZMelPQV74yqFbTUOwFA9TJpkXcD4C7wPDTyLYSw3LshWmaMFgEAQGUK4Rmt1L3eGfDFaBGoNDc3PKlgf+GdAQAAAFSS3vHiV62ttEFtxRu8e5Cxufp/ZQxfBsgy74DcuPrJeu8EIGtp0GLvBsDVtQ8Nk9kg7wzAVcKlxT4ldqF3AgAAwDHokYVbtWR6j3cIfDFaBCpQuumVL4egp7w7AAAAgEpjCoVEmmttxV+prZsr5nkxW6nG6qOSNnqnVB3To94JudFQnOGdAGQuZXCOnKtrmOSdALhLe17zTohXaPUuAAAAOGqmuWr7MJ8IDUaLQEWafXYxdPX8gaQd3ikAAABAJTLpjET2r9ZW/A99a897vXuQAVNJQRd5Z1SdApcWs5IEY7SI/OlMubqAfEt0gXcC4K6kbd4J8bJR3gUAAABHJWit9rzxee8MxIHRIlCpbhuyLi2Xf887AwAAAKhkJl2U1NT+1NpK39ddXe/y7sEAa9ZqJfqodwZwLIIll3k3AJnr2lHyTgBcpYFLi0BNabt3QrSCGC0CAIDKEsJnNP9Kfn0HSYwWgcp2S8PiVPZn3hkAAABAhTNTuDKpTVYmbcW7ddfW4d5BGEBj9YhMbd4ZwNHj+T/k0IKrGC0i3yyZ7J0AuJv3LJcW+2KB0SIAAKgcQQ/o25c84J2BeDBaBCrdj2u/HmQ/8M4AAAAAKp6pVtIsqxv2uu4u/ql3DgbQWN0q0yveGQCAwwh6QbLgnQG4MjV5JwC+7CVpdupdEaUbFp0lGR/nBQAAlWK70j03eUcgLvxiFqh0C6wcOvdcExRe9U4BAAAAqoFJJySJvmFtxZfU1sVzrNXIVNYeTfPOqHgmnnIBMGDMtNi7AXAX1OCdAHgKCk95N0Qr0fu8EwAAAI5Y0Gc074ot3hmIC6NFoBrcdsK2EMLHJO3wTgEAAACqhUlnJkoesTml7+muPRO8e9DPTtZ2SR/yzqhoQY95J+TG1U/WeycAWUtlC70bAG9mavRuAFwFrfBOiNhU7wAAAIAjEvSA5n5ovncG4sNoEagWs+pfTkP6R94ZAAAAQJUxs/C7Vlf7G7V1f8E7Bv2soB8r6B+9MypW0KPeCbkxuHyxdwKQudricu8EIAJDvQMAX+F574KITfIOAAAAeEdBW3gWGn1htAhUk1n1C9Ogz3hnAAAAANXGpLpENtvautdoTs/HvHvQj1bqekkbvTMq1BLvgLxILJ3h3QBkrrvc450AuAuB56GRc4HXpfoSbJR3AgAAwDuy8GmehUZfGC0C1WbWoG9I4rQuAAAAMABMNiGx9Ic2p/sHagtjvXvQD6arRzU6zzujIjVrtXdCXgQzRovIn45ORovIt2sfHyezGu8MwFXRtnknRMvEaBEAAMTuHrVd8qB3BOLFaBGoQmnnxlkh6EnvDgAAAKBKmZldYaG0TnNKt3nHoB+M0QaZZnlnAIfB83/InwVXlbwTAFeDbLJ3AuAuXcdosS8hMFoEAAAxWyVLeCUUh8VoEahGt7V0hq7O/xoUXvVOAQAAAKqVmWoTC3daW/F5fbObDypXujZ9W9LPvDMAAJKCXpAseGcAvozBOvKuXfOv6fKOiNL1T0yU2SDvDAAAgD70KC1/QnOm7/IOQdwYLQLV6rYTtoXu9IOSdninAAAAANXMpMlJja3QnO4ve7fgOMxWqkH6sHdGBeEDyAAGTJC+790AuLP0HO8EwNly74BomU31TgAAADiMO/TtS5/xjkD8GC0C1ex/NLyelvVBSTynAwAAAAwkU5KY3WFtxVd0d+f7vHNwjEZph4I+5p1RIR7zDgBQxVIt8k4A3AVxyRu5FmQrvBsixmgRAABEyh5V24e+6l2BysBoEah2twz6eVpO+aAbAAAAkAGTTkuSmqWaU7zLuwXHqKBHFPSUd0b0gh70TsiNGxbN8E4AMre79Lx3AuDPTvAuAHwFLi32xXShdwIAAMBBgtaqvPuPvTNQORgtAnlwS/0TadDV3hkAAABATiSJ6Vab0/26vlm8wDsGR8kU1MUz0e+oRo96J+RFYimjReRPY7nHOwGIQIN3AOCqXN7gnRAts1HeCQAAAG/TozT9hOZdscU7BJWD0SKQF7MGfScN+ox3BgAAAJAXZtaS1Ohpzen+sncLjtLJ6uKZ6HcwVu3eCXkRzBgtIoeaS94FgDezwGgR+VZTu907IVpBjBYBAEBcQrhd8z7M6zU4KowWgTyZNegbqWy2dwYAAACQG6YkMbvD2orPa27Xad45OAoFPSLpZ94ZgKRJ3gFA5uZdwKVFQDbEuwBw1blzm3dCtCwwWgQAAPEIekBzL7nTOwOVh9EikDc31X1RQXO9MwAAAIA8MWmypclLurs4y7sFR8gUNFiXemcAQO4EPSMpeGcAEWj0DgDchFDU/Cu5tHgoVy8sMGoGAADRCFqpJLnGOwOVidEikEPpk3W3KOhe7w4AAAAgT8xUmyS62+Z0/0B3hcHePTgCI7Vdia71zojQau8AANXLTK94NwDurn9isncC4MpsuXdCtAYPnuKdAAAA0GuX0p4rNWf6Lu8QVCZGi0AeLbBy+mTdDQwXAQAAgOyZ2RVWV9qsb5U+5N2CI7BE//T/s3fvcXZX9b3/32tPblwUBJUECgTbKtaqsUXEHlrlHrG0tj1Erf2demmRBPVn7U17OY09bbU3640kRIt4KrUa66XWcrVCxUqtVpRWUakiFgSBBFBI5rbX+WNCRUwkM5nZa1+ez8djHkqY7/f72mFnMvPdn71WkhtbZ/SZD7QOAIZXt+Ta1g3QXCmPaZ0ALdWSa1o39LFjWwcAACSZSreemc2nXdc6hMFlaBFGlcFFAABopiQP6YzVS3Pu+O+3buFBrMl0xvLU1hl9peb9rRNGxtrLjmudAD03lataJ0BzpfuE1gnQVLdaaXF3Snly6wQAgCS/k/NOvrh1BIPN0CKMMoOLAADQUqfTKb9bNk5cmdduPaB1DN/DI3JzSja2zugbK3JF64RR0Ul5VusG6Lmlk59tnQB9wEqLjLbaub51Qh87tHUAADDy3pGNJ/1x6wgGn6FFGHUGFwEAoKmS/EQ5YP+v2S66z92elyfZ0TqD0VJrd3XrBui58emp1gnQXMmjWydAU3V6W+uEvlVyYOsEAGCUlavy+c4LWlcwHAwtAgYXAQCgsf/eLvrN47/VuoXdeFwm0snPtc5gxJTyxNYJ0HPbthtahGT/1gHQVCdbWyf0r/rw1gUAwMi6PmX7mbniBD+3My8MLQIzDC4CAEBrnc5Y+cOyYfwDeWNd2jqGXdiQi5Pc2DqjqZI7WycAQ27LmsnWCdBe2bd1ATR1x12+59yVMz+yf1Ie2joDABhJd2Z66oxseOYtrUMYHoYWgW/bObjYTfnD1ikAADCqSik/VRZPfjGv335E6xYeYH26GctTW2c01c0HWicAQ+1DSWrrCGitpOzTugEauj5b1ky0juhLD5ta1ToBABhJUyndM7L5tOtahzBcDC0C32lLmc7axb/TTVnfOgUAAEZVSY4oS8euz4apZ7Zu4QEekZtT897WGc3UvL91AjC8as2HWjdAf6iGFhldtV7TOqFvlXJs6wQAYAR163Oz4ZSrWmcwfAwtAru2dvGruzXPb50BAACjqiSLO6X7d9kw+arWLTzAjjyvdUIzhxpa7JlfvtRKOoyg7t+2LoDmXviBhyRZ1joDWqmlfKJ1Q9/qlCe3TgAARkypL895J7+ndQbDydAisHvrlry9O12flWSydQoAAIyoTqfUP+psmPib1iHcz1HZkeQVrTMYcmNldesE6LnuxLdaJ0Bzi/d5TOsEaKsaWtydmke1TgAARkjJa7Ph5De0zmB4GVoEvreXLP1Atzt9YpK7WqcAAMDIKnl22TjxL3ljXdo6hZ3+K29OsqN1BsOrlDyrdQP03Lbt460ToLlOjmmdAE1NTm9rndC3Sg5snQAAjIxN2XCSHYBYUIYWgQd3zj5Xdbv1qTX1xtYpAAAwqkpybFk8dWNev/2I1i0kOSaTKSO3TfQtrQNGzFNaB0BP1XwyW9ZMt86A5rrVSouMts6iO1sn9K2ag1onAAAjoOQ9+Xznpa0zGH6GFoE9c87Sz9fJiWNq8m+tUwAAYFSV1EeWpWPX59ztx7duIcmV+UBGa1X6D7QOAIZXLfmL1g3QF0rn8a0ToKlt27a2TuhbpRpaAf4y+AAAIABJREFUBAAW2t/nc53n5ooTplqHMPwMLQJ77mUPua1uv/X4mvKe1ikAADCqSrK4dMauyMbxn2vdMvLWZDrdnNQ6o4cuaB0ADLHxfT7YOgH6QskhrROgmZqt2bLmW60z+tIvX7oqKV7XBQAWULkqxcAiveObW2B2XnH49vqPi56TlD9pnQIAAKOqJGOdlHfn3Il1rVtG3uZ8OsmNrTN6Ynmubp0ADLFv3jzeOgH6Qs0+rROgmVKuaZ3QtxZ1jm2dAAAMs3JVSnlGNpzgDST0jKFFYPa2lOnu2sW/2U3n2UkmW+cAAMCI6nQ6eXM2jL+2dchIW59uak5vncGQ+eVLV7VOgJ6quTFb1ky0zoB+UEr2a90ArdRaP9G6oY8ZWgQAFoiBRdowtAjM3dpF7+5OTf5YTR2NVUUAAKD/lE4pv9HZOPHO1iEjbUU+l+Ta1hkMkbGyunUC9FJNXt26AfrI/q0DoJmOlRZ3rzy2dQEAMIwMLNKOoUVg77x0v0/WyYljanJl6xQAABhRJclzDC42VbMoz2gdscA+0zpglJSSZ7VugJ6auHdL6wToG7XaHprR1Z36SuuEvlVzYOsEAGDYGFikLUOLwN572UNuq7d+6dSk8+bWKQAAMMKeUzZMXNE6YmQ9PDdnmFdb7GZT64QR85TWAdBTX/709tYJ0BdeeOmhKWWsdQY0M5mtrRP6VslBrRMAgGFiYJH2DC0C82P94ya6axe9tJvOs5Pc2zoHAABGUSl5Wtk48fHWHSNquFdbXJT3t04AhlX5UK5YP9W6AvrCkvL41gnQ1Njkna0T+lathhYBgPnyjwYW6QeGFoH5tXbRu7vT3SfVYV5hBAAA+lhJjjO42Mgwr7b4yNzSOgEYTnW6vqp1A/SP8pjWBdDU5k9ZaXFXXnTxD6SUJa0zAIBhUN6V6XvPMLBIPzC0CMy/lyz7Yt1+61OSzltbpwAAwCgyuNhMTc1zW0cADJSlk19snQB9o3Sf0DoB2imfS9Z3W1f0pSVjx7ZOAACGQK0X5vbbn5fNZ9g5k75gaBFYGK84fHt37aJf7qbzC7FdNAAA9JzBxUbOy+eT3Ng6Y16V2Kavl8665OjWCdBDX8ybTh9vHQF9o8b20IysmnpV64a+1S2rWicAAAOu5g25Y+svZsua6dYpcB9Di8DCWrvowu5k9wm15p9bpwAAwKgxuNjA+nSTPLN1xryqeVfrhJEy1lndOgF6paac07oB+ku5vXUBNFNzTeuEvlXKU1onAAADrOYPs+mklxtYpN8YWgQW3suW/Wf9xpdOSCl/0DoFAABGTUmOKxvG39e6Y6T8Uz6f5K7WGfOmm9e3ThglpcbQIqNj+5hVteD+Juovp9aJ1hnQRv1s64K+VXJQ6wQAYEDVenY2nfQ7rTNgVwwtAr2x/nET3bMX/253eurHaup/ts4BAIBRUkp5VmfjxDtbd4yMNZlOzfNaZ8ybQ3Nd64SRUnJa6wToiZprc8EJO1pnQF85/9Sbayn/1DoD2qjD86af+VZzYOsEAGDgTKbWM7Lp5PNah8DuGFoEeusl+368du9alXT85QgAAL31nGwYf23riJFxUy5tnQDQz2pd9MLWDdCXxusvWm2RkTRRtrZO6FulWmkRAJiNu1Pq/8imk/++dQh8L4YWgd4755Hf6q5ddHa3dk+vqV9vnQMAAKOiU8pv5Nzx9a07RsIxmUzyitYZ88AqaMDC2HqbbUBhV6y2yKjq3mRocVee/6HlSdm3dQYAMDBuyHR+JBtO/tfWIfBgDC0C7axbdlG9657HJnlL6xQAABgRpdMpv5sNEy9oHTIStmdj64S9VvOu1gnA8KnJe7NljZXkYHestsjouSUXvMCbZXZln8XHtk4AAAZErR/PjvFjs/mk/2ydAnvC0CLQ1isPuqu7dslZ3e70iTXVX54AALDwOqXkLTl3+/GtQ4beUdmRmve2zthLF7QOGClnX7SydQL0xPSiF7dOgL5mtUVGzydaB/StbmdV6wQAYBCUd6W7/eS87fTbWpfAnjK0CPSHc/b5SN3+jcenlD9OMtk6BwAAhllJxkpn7B/z+u1HtG4ZejWDPZizIle0ThgpZWx16wRYcDV3ZfOVtgCFBzN+788m2d46A3qhplzTuqFvlfLk1gkAQJ+r9X9n44nPyeYz7m2dArNhaBHoH684fHv37MWv7NaJY2rNP7fOAQCAYVaSxWXp2Gfzxrq0dctQW5E7ktzYOoPBUGoxtMjQqyXPS9Z3W3dA3zv/p79Za97XOgN6o1ppcfcObR0AAPSt7UnWZNPJ/6d1CMyFoUWg/6zb/7P1I4t/opucleT21jkAADCsSnJAWTTx+dYdQ62kppvntc6Yox2tA0ZOyWmtE2DB3b7tstYJMDDu2PaCJHe3zoAFNz399dYJfavkoNYJAEBfuimpx2XjSVtah8BcGVoE+tOWMp21S97S3b79MUne0joHAACGVSnlqM7Gib9u3THUbs6/tE6Yk5p3tU4YQctaB8BCqsnGbFkz0boDBsaWNRM1eWPrDFhwY4vubJ3Qv6qhRQDgO9X8U3aMPykbT/5s6xTYG4YWgf72igO2dtcuOatbJ4+pyUdb5wAAwJB6Ts7d8SutI4bWMZlM8trWGbNWsql1AjBkpnf8WusEGDgbT/ndmnpb6wxYUNu/ubV1Ql868yP7J+WhrTMAgD5S64bccceJedvpfkZg4BlaBAbDuv0+Vf9x8Qnd7vQv1NQbW+cAAMCQKaXT+dO8aeKY1iFD7A9aB8za8lzdOgEYIjUfzuYz7m2dAQOpVm8uYXjVOpELfsZKi7ty8MSxrRMAgL6xPek+L5tOPidb1ky3joH5YGgRGBxbynTO2efC2r3rcanlt5O40Q0AAPOkJGNlUa7KG+vS1i1DaXnuTeINWOze2RetbJ0AC6l2dzyndQMMrE2nXViTL7TOgAVRyidaJ/StOraqdQIA0Beuz9Tkk7PxlL9uHQLzydAiMHjOeeS3uusW/1F3cnxlajYlmWydBAAAw6AkS8viyc+17hhSNd08r3XEHiux2k2vlbHVrRNgwdRcm81n3NE6AwbadM6M+6AMoVpyTeuGvtUpT26dAAA0997cPf6jecvq/2gdAvPN0CIwuF72kNu665as7U52H5vkb1rnAADAMCjJozobdmxs3TGUtmVwVpGpeVfrhFFTajG0yNCq6TwjSW3dAQNt8ynX1lova50B865bB+d75F6reVTrBACgmcnU8opsPOnncuHpd7eOgYVgaBEYfC9b9p/dtUue262Tx9RaL26dAwAAA690zsqbJ09qnTF0HpeJJIOxjUs3r2+dMHJKntY6ARZEzbXZdNLNrTNgKExsf04SL1gyXGrn+tYJfavkoNYJAEAT16fm+Gw68S9ah8BCMrQIDI91+32qrlv6jG6deqrhRQAA2CudMlb/IW+sS1uHDJ2p/GbrhD1yaK5rnTCCDmwdAAuhTtTVscoizI/zf/qbdbr7B60zYF7V6W2tE/pWrYYWAWDUlLw7d4//aDadZDVqhp6hRWD4rNv3asOLAACwd0qypCye+LfWHUPnn/P1JDtaZwD0RM2Hc/6pVlmE+bT5tD+tyRdbZ8C86WRr64S+VbypBQBGyPYkL8yGk55tO2hGhaFFYHgZXgQAgL1SUn4o546/snXHUFmT6ZT8ceuMB3FD6wBgONTujp9q3QBDaTr/M7VOtM6AeXHHXXe2TuhLZ198bFK8jgsAo+Ffk/KkbDzpba1DoJd8swsMv/uGF6fzo0n+pnUOAAAMklLK/8nrtx/RumOo3J4/a53wIN7QOmDkrPvQ8tYJMN9qzWuz+Yx7W3fAUNp8yrW15J2tM2AeXJ8tawzg7tLiY1sXAAC9UF+TG8Z/PBtP/ELrEug1Q4vA6HjJkn/rrl3y3O5E99Gp2ZTEjXMAAHgQpWRRWbro4607hsoP5Z4kd7XO2K3tuaB1wsjpLl7dOgHm2Y7cse33WkfAUNt46vNr6m2tM2Cv1HpN64S+Veqq1gkAwIK6IXX6+Gw8+bdy0enjrWOgBUOLwOj5/5d9qbtuydru9u2Hp5TfT3J76yQAAOhnJfXQzsbJ17TuGBolNSWvap2xW0fFFn091inF0CJDpXbGfs7KWdAD091np9bp1hkwV7WUT7Ru6F/lsa0LAIAFUvOW3D3+xGw69WOtU6AlQ4vA6HrFAVu7Zy/+ve6tXzqsm7yoJp9qnQQAAP2q1vprtomeRzX/t3UC/aMmp7VugHlTc23O/aeLW2fASNi8+iO1lPe0zoC5q4YWd6fmoNYJAMA8q7k13elnZtNJZ+XC0+9unQOtGVoEWP+4iaxdcn5du+SYbp3+idT6f5NYDQAAAO5n5zbR/9y6Y2gcknvTn1tEf6B1wIg6sHUAzJc6Of30ZH23dQeMjNu3/S/bRDOwJqe3tU7oW6UaWgSAYVLzzpTtj815p/5D6xToF4YWAe5v3T4f7a5b+ovdzuLDkvKbNfU/WycBAEC/KKmHZcPEy1t3DIV+3SK65vWtE4DBVWtelb9cvbV1B4yULWsmMjX2rCSTrVNg1jqL7myd0LeqN7UAwJC4KSk/nU0n/Xw2/qQ3bMD9GFoE2JUXl9u7axf/Sb11yaO73XJiuvXdsfoiAACklPxJ3liXtu4YCv24RfSKXNE6ARhQNTfmjm1/2joDRtJbTvrnmrytdQbM2rZtBt135UUX/0BKWdI6AwDYSzVvyd3jP5SNJ/5d6xToR6V1AMDAOK8+vNOd/Pla61mllMe1zgEAgFZq8rG6dsnxrTsGXk0nt+aeJMtap/y35e4V9dzz33dg2Wd/77Rn4NXxew/L+T99c+sOGGlrL/1ySTmqdQbskZqtddMpB7fO6EtrL/v5pHNh6wwAYM6uT6Z/KRtPvbJ1CPQzKy0C7KkXl9u7a5e8sa5b+sPdkien5twk32idBQAAvVaSp+ZNE8e07hh4Jd2kr7ZjvqV1wEhatu/q1gmwt2rNOgOL0Afq9IlJ7mmdAXuklGtaJ/StWo5tnQAAzMlkUl+TG8Z/2MAiPDhDiwBzcfaST3bXLXlJ99Of/b7uVHd1knemuiEIAMDI6JRFuaR1xFCoeV3rhPv549YBo6hTiqFFBlz512z62HmtK4Akm55xQ6359aR2W6fAg6m1fqJ1Q/8qT2pdAADMUs1HMzX5pGw8+bdy0enjrXNgEBhaBNgbm4+ZzEuXXdJdu+Tnu1OLD+6Wemat9UNJJlqnAQDAQirJQdkw8fLWHQNvefpnW+DtuaB1wiiq6ZzWugH2wo66aOLHk/UGpKBfbDplY035+9YZ8KA6VlrcrZKDWicAAHuo1q2p5UXZdNJP5C2r/6N1DgwSQ4sA8+VlZTxnL31PXbf0J7vdxQd3a/3/YgVGAACGWCl5beuGgVcyleTDrTOSJEflztYJo6kub10Ac1VrfixvsoIE9J3bt51Za25snQHfU3fqK60T+lc1tAgAg2FTyo4fyKYTz28dAoPI0CLAQjinfCvrlr7j/iswpnb/Min9s4oKAADspZIs7WwYd1Nub9W8qnVCkh2tA4DBUpNfyaZTPt26A9iFLWsmkqmnJd5MTR+bzNbWCX3swNYBAMD3UOvVmZw6JhtPWpuNP+n1f5gjQ4sAC23nCozddct+qXvrood3u+XHU8traq2WhwYAYODVUn4hb6xLW3cMtKn8e+uE1LyrdQIwOGry3mw8+Q2tO4DvYdMzbqjd8vzUOt06BXZpbNIq37vy/A8tT8q+rTMAgF2ouTW1vCh3bD0+bz3tU61zYNAZWgTopfWlm3MWX9Vdt/i36rqlP9ydnDq8W/PLtda/s400AACDqCSLy+LJD7XuGGjflx1J7mpcsb7x9UfT899nFR0GT821+fzHnp2U2joFeBDnnfyeWmLAmP60+VNWWtyVfRYf2zoBAPguk+nm9fnm+KOz6cTzs2WNNwbBPDC0CNDSy/b9r6xb8ta6bulPd6/57MN2rsL4+zX5WOs0AACYhafntVsPaB0xsEpqko1NG1bkhqbXH1XL9l3dOgFmpZRb6+LJ43PF+qnWKcAe2njqr9aay1tnwHcqn0vWd1tX9KVaDC0CQH/5YCYmfyjnnfQrufD0u1vHwDBZ1DoAgJ02HzOZ5KpuclWS36vrb943Dz/o6Z2x8rSa8vSSuFkBAEBfKslYHrr/39fkx1u3DKz98rrck1e2zqC3OqWstlQdA2RHLeUpeZMXaWDg3LHtmfXhB15XUo5qnQJJUlOvat3QvzpPbF0AACRJ/j3d6ZfnvFM/3DoEhpWVFgH61fpD781Llv1Dd+3S36xrlzyle+vt+3VTVu9cifEK20kDANBXSp5qtcW9cEtaDgFd2fDaI62m87TWDbCnaqlPzbknfbV1BzAHW9ZMpNN5cq3Vdrz0h5prWif0sUNbBwDAiLsptbwot9+xysAiLCwrLQIMivWH3pvkkm5ySZLUsz65OE947OM7Y4ufkprjaqnHlpSjG1cCADCirLa4l34w47kltyY5pOfXrlnf82uyU13ZugD2RO10j8u5pxkwgUF27sl3ZO1FP5Ys+lSS/VrnMOrqZ1sX9LGHtw4AgBF1d2r+JN17/yKbz7i3dQyMgtI6AIB5tP7mfXPII368U7Mqpf5ITX2CQUYAAHql1kzVqcX752VlvHXLQPpGXpluXtPz6y53f6iVsvYyu0PT9+r09InZvPojrTuAeXLWxSeUztg/pGRZ6xRGV63dx2fTaf/euqMvrf3wN5Ps3zoDAEbIZLo5NxPjf5S3nX5b6xgYJW5KAwy79Tfvm4Me9qOdxWM/nJrH1eRHSymPSerDWqcBADB8aq3vreuW/lzrjoH0zTwi9+QbPb+uocVmDC3S72rNs7PplHe37gDm2drLf6Gknp9kcesURlMdr4fl/FNvbt3Rd878yP55ePebrTMAYIS8NbXzh9l0wg2tQ2AU2R4aYNjNbCv90W7y0ft+qSbJn997ePZd/EOd1Eel5nG15OiZVRnrYc1aAQAYfKX8ZOuEgXVL7s5Den7Vz/T8isx4/keWJVOtK2C3dm4J/S+tO4AFsPHkd9S1l6fU7gUpZax1DiOoe9PW1gl96eCJY710CwA9UPOeZOrVVn6GtnznCzCqfnXfryX5Wvd+v1ST5I11aTLx/VmSH+yk84Pp1pU1dWVSVpZkZUr2axMMAMAgKMmSsnH897prl766dcvA+cFM5JbcleSAnl2zZH3PrsV32mdiddJpXQG7sqN2uk83sAhDbmZw8fCS7h8kxV9I9NItueAFO1pH9KfOsa0LAGC41cvT7fxazjvRm3ihDxhaBOA7vayMJ/lcks91H/CvZoYav/mILFl6aKa6h3XGOoenWw9Lpxxek8OSHFBqXZFSDu91NgAA/aOm/EYSQ4uzV1Py16lZ27MrHpL39+xafIdOLaurjbnpNzV31bHOE3PuKV9tnQL0wMaTX1PXXh6Di/TYJ1oH9K3SeXLrBAAYTvXyTNdXZ/MpV7UuAb7N0CIAs/Oyh9yW5LYkn3ngUGOyc7AxSc6rB2R6/OCUekSyaOlY6oqa7JOURybdfZPyyNQ6Vu8bcKxZVkqWf/tM5YCkPmxukeW2pN6zs2cyyU1JUkq5LbXek+SupGwrqV+dTt2R2rkpZepr3/1gytKUumJWl66dR4yVsuerUXazuHbKobO7Rn1oSg7a889Pp5YcMatrJMtK7v/fY4+snOXnAwBDqiT71nMnj885i90InK2ajUkPhxZpppbOaff7CQr6wRfr4skn502n3906BOghg4v0WE25pnVD36r5vnhTCwDMI8OK0M8MLQKwMF5c7kpyV5IvJ8n0Hhyy0C/XzfH8X5jtAXvyWAfBgr98uv4/luSQR81uYLNbD02nLNnjz69l0VjpfN9sLlFTDk6y/ywO6MwM587iGrU+NKXs+eBpkjLrodC6LCmzHTwFgHlTOt131sQK3LP35R5e64YeXovvUr3ph75Rkw/l84uelStOmWrdAjQwM7j4tZJ6fpLFrXMYdtVKi7szmzeqAwC7V+sl6dY/MKwI/c3QIgDQxvrHTWT2L5TP+oV1Q6Sz8KZ7Ds2izp4PhXbLonTqrIZCk87BYykP2fNrZKx2yuyu0a0PSScH7/Hn19qppcx2NdIlJZnd0K3VSOmt//56WZOtSb69YlJNLSV7veVjTV2RlKUP+OWDSvLQ+/2z5/1IKyvy2q0H5JUH3dW6ZKAckvHc2qNrVVt4A0lNfU02nvLbSbH0J4yyjSe/o669PKV2/zJlFm8Yhdmanv5664S+VetBKZZaBIA5q3lPMvXqbDrt31unAA/O0CIAADNeut/Nczjq+tkeYJB0D62vi3LIjtkNbE4vWpGxqQcOkX2Pz8/Y2NjYrFZBq6UclJo9Hzyt3U5mORRaa31IStnzwdPMaTXSRcksB2J7qyb56s6BwztLcmNq7kkpt5XUr07X1JTp+wYPZwYUJ+/dmpcdvEfbOS7k83e35/6Le1ZkWWdpplKyKEcmSbqdg8Y65aHpTo/VzqLv++/nS02nlhyRZKwkhw/Afy92oSRj5aH7begmz2vdMlBKpnJLbkwy24H62VuRCxb8GkA/21G7nTU576QPtg4B+sTGk99Rz7r4pjI29sEk+7XOYUiNLbqzdULfmuXOLABAkmQyydtTp95gWBEGi7frAAAA7In7hu721GQZy+I6u61xa2drpqa35mX7/tds80bC6+46KPsseWiSlfcN3daU5Ul336QcvnP1x31nBh2t8tgPas32um7Jvq07Bs7Xsz4lv7fg11nuvlBLZe1lVrWjofKvdcfEM/O2029rXQL0obUXPSZ10ZWl5JDWKQyfuv1bD8sFP2Nw8YHOvvjYlMX/0joDAAbI9iTnpnbOzaYTZr1TG9Cem9MAAAAMpz+9Zb/sd+AhKfWIdDsrOmPlYenWQ1LKEXVmqHFFqTkoJY9onTrEancqx+alSz7ZOmSg3JZHZzpfWOCr3JDlOWqBr8HuvPjy1aVTL2qdwWiqKX+UjVf9brK+27oF6GPnXH5wputHSsnjW6cwRGqdqJtO3fM3A46Ssz/8kpS8qXUGAPS9mluTvCnj45u9EQ8Gm+2hAQAAGE6/vvyeJF/e+ZFdTWbUJDnz3WM54aeOTK1HjnXGjqwpRyZ1RU1dkVpWlFJX2J56zkpZlPNr8oTWIQNlOjct+DVqXr3g12C3OqW7unovMb1Wc2Odmjojb33GZ1unAAPg3JPvSPKEuu6yvyw1L2ydw5Ao5ROtE/rYsa0DAKDPfSHJ6/PV8bflotPHW8cAe8/QIgAAAKNty5rpbJkZbpzexb+uSbL+I4ty0FOPzNjYEWOlrqylHpmUlTVZWWZWbTyyp82D5TGtAwbOHZnMwQt8jRW5YIGvwPdQS1nduoHRUlP+KHds/d/ZsmZXf9UB7N6GU15Uz77s0yX1z1PKktY5DLZack3rhr5V8v2tEwCgT12ZWv8sm07++9YhwPzylm4AAADYeyVv2r4ynUUrx0pdWVNXzgw11qNL6RyZ1ENaB7bUnS4n5yWLP9y6Y6Dcku1Jli3Y+Ze7J9RSWXtZbd3AyLiqdusLc96pX2odAgy4F196TDrlgyVZ3jqFwVVr/V/ZdOpfte7oS2d/+PMpObp1BgD0ie1JfXfq9J9l02n/3joGWBhWWgQAAIC9V/PSfb6S5CsPXMKqJsmGOx+W7PuYsZKja7euTKesrMlRZWa48Yje5/ZWGeturMmjW3cMlJp/SMnPLtDZP7NA5wX6Rc1dtdaX5LxTL8zOv4oA9sp5p34yZ777yHrwgW8vJWuS0mmdxACqnetbJ/StUg+y1gwA5KbUvDnj43+Zt51+W+sYYGEZWgQAAICFtu7AbUmunk6uvv8v1yR5Xd0nyyafOFZydE1dmVqOmlmhsTwmyQEtcudfsX32bHVyeeoCDS2WrF+Q8wL9YEdN/ix3bFtvK2hg3m1ZM5HkufXFl/5d6WRzkv1bJzFg6vS21gn9qxzUugAAGvpYkjfk9jve62dZGB3esgMAAAD9auP2lekuOmpsrK6sNU+sNatKqUcN4uqMtoiepa05IhP56oKc29bQzdkemoVQa31zOotflQ0nfKt1CzACzrn84HTrW0vqT1l1kT1Va/eQbDrtG607+s6LLv6BLFn8pdYZANBjdyflr1InN9kCGkaTlRYBAACgX63d54YkN9z/7cXfsTpj8tiaurKWPLGkrErStysalk59TU2Obd0xMKaytXUCC+TFl6+2Wy/zqdb65nTHX53NZ9zeugUYIeeefEeSn6lnX/ozSX1DKeXw1kkMgDvuurN1Ql9aMubnJABGR81nUrIpd4//dS48/e7WOUA7hhYBAABg0LyibM8DtpuuSbJ+fSeH/PoTx+riVTV1ZU1WlZJVfbEyY8kPt04YKHdlMg9ZkDNfuSBnZY91Onm6kUX2Ws1dtVPemG9O/3H+6rR7WucAI2zTqe/Lme/+UH34gb9WUn4nyT6tk+hb1+/cYpwHqp3jrYUOwJDbnpS/zlT3vLzl5H9tHQP0B98CAwAAwLB7Xd0nS6ZWjS2qR9fp7qra6awqyROTHNDDitrN4uVZW2wHtydqxnJrphbgvCdkRa6Y9/Oyx8rZl16TUp7YuoMBVeu1NeX1Wf6xC7J+fbd1DsB3eOGlh2ZJeVUpeXGSxa1z6DO1vqduOvXM1hl9ae3lH03K8a0zAGABfCrJW62qCOyKlRYBAABg2M2szPjx6eTj9/1STZI3bT8qY+XoTilPSTePrSWrSimPXqCK0snkK7vJKxbo/MOlZDq3ZEeSZfN6XgOL7RlYZPZ21FrfmlIvyKbTPtU6BmC3zj/15iQvrWsvenMy9jsl5dkxvMhOtZRPtG7oX+XA1gUAMG9q3Zrkr9IZuyAbTrimdQ7Qv6y0CAAAAHzb+vWdPPy3n9IZq6tSu6tqyqpSyrHzceqa3F3XLunl6o7lrVT/AAAgAElEQVSD7dZ8NDXzu+LKcveCWitrL7M7NHukpn4wtbw9yz/2PqsqAgPphZcemqX51ZKyNraNHnk19enZeOqVrTv60trLb0rKoa0zAGAvTCb10qS8PTeM/10uOn28dRDQ/6y0CAAAAHzb+vXdZP3Hu9+5KmPJueNHj5VyXK3/vb30sZn9KoBerJ6NmquSeRxarHnXvJ0LWAg7auoHk/L+TO94fzafcW/rIIC9MrPy4q/WM9/9qhx84AtS8oKS8pTWWTQyOb2tdULfquUgby0CYED9R0ouyNTkhdm8+uutY4DB4ltgAAAAYC7mNMjYnapPyEuXXtujxsF2S34+yYXzdr6ao7IiN8zb+ZgTKy3yAJ+tySXp1ity3ikXJcXzAxhuZ11ydMbK85OypiRHtc6hd+p0jszmU25s3dF3zrrsiIx1vto6AwD2WM2t6eQdSecdtn8G9oaVFgEAAIC5qDln6eenk89/+xdSsnFi1VjJqtrNcTX1uFLKE+5/UGdReXk3eVHvcwdQJzdmPjeENbDY3trLjmudQGO1fqImV6dOX5mpb16Rv1yztXUSQE9tPu26JK9M8sp61iVHp5TT0ylPK8nTkzy0cR0Lads2f+ftylhd1ToBAPbA3Ul9f7p5R7Zu/cdsWTPdOggYfIYWAQAAgPlSs3bJp6eTTyd5W5LU19V9snTquE7pHleT45L8RNvEAbIo12Zins5Vcuc8nYm90ClZXa2jNyp2pNbP1lKuS83VqeWanHfVvyTr53MUGWCwzQwwXpfkdTVJzrn4cZletCrpPikpjympK1M6+yd1ZdtQ9lrN1mxZ863WGX2plmPtiwdAn5pMyt+lW/829d4PZPMZ97YOAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGAYrE5S5/ixukEvAAAAAAAAAAAAMKC2Z+5Di3/ToBcAAAAAAAAAAAAYQCsz94HF+z4AAAAAAAAAAAAAHtTnY2gRAAAAAGBoldYBAAAAALDTssxsDb233PMCAAAAAOhTndYBAAAAALDTBfN0nlXzdB4AAAAAAAAAAABgSO3tttD3fWzqdTgAAAAAAAAAAAAwOM7O/A0tbutxOwAAAAAAAAAAADBA5mtg8b4PAAAAYLQ8J8kVSe7Nt+8P3JLk7UmOa9gFAAAAAAD0mVUxtAgAAADMzRFJ/i0Pfq/gLUn2adQIAAAAAAD0kW2Z/6HFlT19BAAAAEALRyS5I3t+v+AfYnARAAAAAABG2oGZ/4HFmuS1vXwQAAAAQM8tTnJdZn/P4E9bxAIAAAAAAP3h6izM0OLXe/kgAAAAgJ77/cz9vsGqBr0AAAAAAEAfWIiBxfs+AAAAgOH1pcz9nsGfNegFAAAAAAAae30MLQIAAACztyJ7d8/g5t4nAwAAAAAArS3kwGJNsrx3DwUAAADooWdm7+8b7NPzagCSJJ3WAQAAAACMpGcNyTUAAACA3ls8D+fYfx7OAQAAAAAADIjtWfiVFq/r2aMBAAAAeun47N09g4neJwMAAAAAAK2szMIPLN73AQAAAAyffZOMZ+73C/6x98kA3Mf20AAAAAD02kdaBwAAAAAD7d4kV+3F8W+brxAAAAAAAKC/LcvcVkD4mzket6w3DwsAAADosR9JMpXZ3yv4apL9G/QCAAAAAAANvD9zGz48cI7HPb83DwsAAABo4NWZ3X2CiSTHNSkFAAAAAACamMvg4ev34tgrevCYAAAAgHZemz27R3BPklMaNQIAAAAAAA28PHMbPLzPXI69//EAAADAcPrpJP+Z3d8buCjJo5vVAfAdSusAAAAAAEbGXAYIr0nypJ3//ytJVs7hHO6BAQAAwOz8apL953Dcnyf51jy3zMYJSZ6cZJ+d//yNJJck+XKzIgAAAAAAoInjMrdVEu8/pLin2z1ZaREAAADmbt/M7efviSRLGvQCAAAAAAB8l22Z/Ysd2x9wjpVzOEdNsnrhHhYAAAAMnRMyt5+/r24RC8Dg6bQOAAAAAGDoLU9y4ByOe8ED/vmGOV7/+XM8DgAAAEbR8XM87t/mtQIAAAAAAGCOPp3529Z5LuexRTQAAADsuS2Z28/ez20RC8DgsdIiAAAAAAtt1RyO+cBufn3H3oQAAAAAD+oxczxurjskAAAAAAAAzJtNmdvqDMt2c74L5ng+AAAAYM98M3P72Xt5i1gAAAAAAID7m8uLHF//HudbPcdzHje/DwsAAACG0tGZ28/dt7WIBQAAAAAAuL/nZG4vdDzYdtJzOecF8/ewAAAAYGj9Uub2c/clLWIBAAAAAADub3sWZivnuZxz2zw9JgAAABhmmzK3n7tf2SIWgMHUaR0AAAAAwFBalWTZHI571XyH7HTgAp0XAAAAhsnRczzuC/NaAQAAAAAAMEtfycKsspgkVyzguQEAAGCUfTVz+5n7h1rEAgAAAAAAJDOrGs7lBY6r9/D8z5/j+Vfu9SMDAACA4XVA5vbzdk2yf4NeAAZUaR0AAAAAwNC5OMlpczhuRZJb9uDzliXZPofz/3GSV87hOIbHIzPzPHtYkiMz81xavgfHfTXJXUm2Jbkh3155BJg/R+78OCTJfkm+L8nYgxzzX0mmk9yY5NYkX0+ydQEbYT4dluT7kzwqu3++35jka0muy8zzfVgclJmtRx+Vmd+HZbv4nFsy82f6hsw8/ome1cGMAzPz/HxEZt78dGBmhrl255Yk45l5zt6UmT+/4wvcuDeWJ/nBzHwdOjTJ4l18ztcy81iuy8z3v4yGU5NcMofjrkvy2HlugUckeUySH8jM162lu/ic/8rM9wzXJfly79KAvbWodQAAAAAAQ2cuA4t3Zs8GFpNkxxzOnyS/GEOLo+KAJE9JsiozQxH3/e8+83iNr2bmRZHPJLkmyb9kuF8gOTYzv4cr891vhr8xM78XV8cwJw/uB5Mcl+SJOz8eleSozN8iC7cl+UKSr2Tmz+ZnklyZZGqezt9vHr/z48gkSx7w727KzPDM1Um+1eOu3VmS5JjMDMkcme8e1LsxybWZ+W83bP/Njk6yOskJSX4sycNnefztSf4pyRVJ3p2ZQd1BsX+S05M8IzOP/dFzOMe/JflEZv48X5yZ7x1hvjwhyY8keXJmvqYenZlBmb1139fh6zLzte2iJF+ch/POxfdn5mvQiUn+R2beJDAb25J8NDNfg7ZkuAap59PDM/N8um8Y9P7uTXJ9Zp4L1/e4azZOmONxV81rBaPqiMx8rTopyfH57j9HD+buzDwXr0jynsz8TAD0KSstAgAAADCfXpnkNXM47meSvH8Wnz/XwaiFvh+2LMlvzvHYV89nyBw9PcnT5njsH2RmxbMWlmZmRZCnZ+YFjsemzb3PWzMzTHFJkvPn8by/lV2vfvNg/jrJl+Z4zSOSPDszv59PT9LZg2N2JLksyduTvC9Jd47XnotfzehuRzee5E/T7s/fg/mBzDyPTs3MsNLBjTo+mZkXL1+b5I55ON//TPK4ORx3c5K37MV1VyZ5VmaGv56e7x5U3J0rk/xNZv58zmW14r3xxCQ/m5nnwY/mwVfQTGae1xdlpvk96d/n94N5SJKfT/LiJE+a53NfkuTNmfl96tffnx9J8tIka5LsO8/nvjQzw5vvzMwgEMzGYZn5mnTfEN9BPbruC5Jc0KNrJTMrF6/JzNegp8zzuT+SZEOSDySZnOdzz9VhSX5pjsf+eeY+4P8Tmfl77qQkP7yHx/xXkg8meWtmhrIXwtGZ+X5+tn4uM8O7s3Vpkn+ew3G3Jzl3DsfN9fv/C9N+aHRFZt5Yd9jOj362NcmbFvga+2Tmz9CLk/z4PJ/7Y0k2ZWbYup9XvwUAAAAAYC/VOX7M1ld6dJ256NXvwULYnrm1X9giNsmZSf42M6txzfX3fSE+5nv1px1z7PheWxjuzk8muTwzA4f/r707j5ekKu8//tEwMwIygywjCmERBEQHQUEQMQRQliCuJCIERZGfogliXMAYI5qouGNUNC64QTTuKAgouCGEHR1EQJR9CwiywwzR/v1R07G5ubdv13Oequqe+bxfr/My0Tl9vlW3b3ffrqeeU3IOrgH+lvaKR39fmHeSxzMSzl+2LagKsRfT/fmZOv486RjPDa5/XHC9fYDTqYrTSo7/LuBNNL8T11zgYKpCjNKf2WVUr/eT1IhjNeBfqIrpmn5OXwbszXidn02o3p9Ln6+jjLupCoFHLRTSimtV4CCqboFdfXaMdrCra1XgrVSfSZs+piupCiNHucGlaQcRO4bI9vOrAP8A/Da45uA4mdiNELM5JCFbGyOyFTXE32OfGlyvxAKqouWvUd3o1vU5rzNOa+B89K1MVXx6SwvHcT3V7huj3DwjSZIkSZIkSZowexD78viTgbWOCK61TujI6ol+id616M+vR373pGEWUXWWurcgb9PjG8nHHL2wvmqNNZ4FnBdcZ9g4kXY6IEYLbid9jNuW9/tRbUVcWvTa5MjY7hOqLT8j67+m5jr7kVMQMXWcRzPviXOBN1J1s8zO/D2qYsBx9w9U3brafm6fRP3tXpvwD3T3mvwtqs5V0qAtqTpgj8Nnx80bPlaoCtWaeA2ebfwQ2KiF4xvmY8SyX1BjjTk08z63lKp4K7Og6lPJGZsaHwkc2/oF67XZ2XB7qhv8lhTk7XpEvq8ZxYFUHcjbPp7/opkiYUmSJEmSJElSh6Kdzh4RWGvD4FqHhY6snmgXyOe3kG2Yce+yuCNVAdw4F0P1xyGJx11yQW6UbWMXAt+h2fN6M3nd7WbS9c+8i/EdxqNTyDyq4smb6f6cjDKyimhvD66/5YiPvyPNd6q8ldwL9y8Arp2wzJkW0X130Qeofg5dmEvVLazr3/EeVfHiJs0eribAjsAP6P75ODgiXbBHtSlwTsfHtwQ4oMFjnM2pM+SabYy6Zfezif+tN+r4DFX3uQzfbzhr1ohs6b1XcK1IV82IbRmf98TS8cbkc7MB8OOOj2kpuX+zS5IkSZIkSZI6FC0ivKpgzch6lxWsN6pXB7Od0kK2mYxzl8VFVBecJ6FYsT8WJR7/fgU5Ztumb3/gwYLHrzPuB+bHT8NQu7Z0DOM0riPvgnaJ19HO1pOZI2tb5Oi27bN1oZpL1dGmra1LbwXWjJ8GWDb/Wy3l7Wcet8LFQxmvLkrvoN2tWtcALm3gOErHR2in26/Gy5OAE+j++Td13N7gMb+C8egk2R8fpJvtoi8I5n3DLI+7CtU29G2dvy+Sc2PKJS1mLhl7BY4tuvNCna6aEasAx9DdFvRNjBcnnp+/Ae4cg2Pqj39nPG4CkyRJkiRJkiQVuIjYl8QlW6RFv5hu2iPGONtMxrHL4jyqLc3+EMzW5cjcvvSzwQy/nuVxv0D7haDXkFcwNujtLR9H1+MB2tnqfpjdgSvp/lzUHb9JOv75BRmGFQjuANyUdKx1xi8YrTPrdPakm4vPNzA+W0UfR/fP7elGW0VDj6SZLcyzxk3ACxs7eo2TOcB7qTpodf28m240dYPSJ8bg2KYbH6f9wsXrglmHdahdBFwefNyScWTRmajc3UHuyIjc8PXF4FqjdtWM2Jbqs2bX5zN7PCPp/LxvDI5lunEcFi5KkiRJkiRJ0sTqqkgvuh11G7o4H1Hj2GXxRcBdBbm6Hpkd8K4OZjhmhsdbSNVxtKtz00Sh67ht/dj02CXntIXMoyqknaTOp4Pjs0nnYe+CDPNmeMw30m2hzasC5+Gf6baT0AnAwwK5s8wFzp0m1ziNNgoXzxyD4xxlbNjUCdBYeBbxgrW2xruTj3kOcNoYHNew0XbhYvR99GkzPN7z6Lbwb+eCc/GYDnPXHWsHju/04FqzddWMeilwXzDTuI8NCs/NSsA3x+A4hg0LFyVJkiRJkiRpQn2e2BfDr+5o3UcUrjuK6Jflq7eQbapol8WmulR8isktiOqPzG6C0eLNF03zWIsYj+24tig+Kw81adsTl4wjks5ZxE7A72bINSnjpUnn4gPB9W+Y4fHGpVPfGiMe/1zgO2OQtwf85YiZs82l6lDZ9fGPMpoq0AD48Bgc36jDosXlU7+74iRsxZrZ8XMO8NMxOKZRxj8lHvcwmxZkXHeaxzuM7p9X1xDf4n63jrOPOu4NHl/0JqxhXTWjlveu7yXFfCsB3x2DYxhlfKjgOCVJkiRJkiRJHYl+KVxq++C6ByasPZuvBLOVFnLWVdJlMdtCqgtzXV+sKB33J5+XaFHpgimPs4jx2S7xZnI7WdwzBsfUxvgO3XUAeQPdX7jPGOsnnY9od72vTXmc1Rivwre3jXDs45b5BuJbW0dNUsFifzyzgfOwCfH3qC6GRYvLn4XAOXT/3Bp1bJd03JNUsNgfuycd+zAHBLMtneaxxqkI7Y3B8/G2Mcg+yrggeHzRDpgzddWMGqfnShPj6oJzM0kFi/2xX8HxSpIkSZIkSZJadiCxL4NPSVo/svbZSWsPEy2ovKyFbIPGpcviroxPQV3pODH53EQLxVYdeIxxKljsj2fknB4AHhiD42l6XEfutuN1fHHEjJMwFiadkxuC6x828BhrAtePwTkZHA8wvKPTOGbukV+AMJsLE7O3NW4D1ko+D+eNwXHVGRYtLl+2o7oJouvnVRfPwei2uF2O26m2K25StPPr1KK5cStCu5fROyEPOn4Mso8yIn9Xlmx9nXUDC1RdRLs+f02PkwvOz9fHIH/dcSewccExS6opc5sSSZIkSZIkrXg+F5y3b2qKerK6nAwTLYzcLDXFcHsQ3yo7s1vlXsAJtNdB7lqqjhG/XzZm8rfEvj89PRJqBguIn5cHl/3nIqqLsXNSEuX5D6qL972Ex1rev+deAmxLfhfP2cyjKjBva/vdJVS/mzdR/Z7+cYZ/tx7wrOAaWecwWkB61rL/fCxVt8bptqPs0jzgSUz/HrYmVXfBccsM8HGq35E2nABsnfh4lwHfBs5c9n//z7L/fi6wDdVzfV/Ki5bXAD4BvJiZf7fq2Ap4SsLjSBHPo/ocsUrXQWq6KeExPgvskvA4fb+leg06g+o1aMmy/34O1WvdLlSvQVM7eNf1KODfgeeT8xo0nccH51088H+/HTgyIUumVajO27E1543j+/V0IjftLSpY74aCuYMOYPyeK034TXDee4EXJea4luq16idUz5n7lv33KwFbUv29si+wduE686leZ3cF/lD4WJIkSZIkSZKkBm1F7O71YYVidUXvoG/DOGeD8eiyeAjVxYCmOiVcTnWB9OVUF14fXiPbncE1Sy6iTfXCYIYe1bEuJNZh8X7gq1Tn7QlUxYUbAn8BvIu87ZiHdXQb1cKkLOM8dk04T3XNo7og2NQxPQD8AHgrVVHW42pkW69g3awC12h3z8dRFf/dHpx/EXA41XNiw4GxF3A01QXc0p/NCdMcb0mHxbuALwMHA08dyLwp1RZ8J5HzPlB6kXoUmVttnk5VDPSwEdZdDXgfOR1zdwgf/UP9ICFLj2rbyEOAHXnoc3pT4DlUz/dvUX12LF3LTovLh31ob1vy/6bqMvZe4FVUWxw/mYc+VwfH9sCzqV7v3kVVYNMvRr4y4dhfm3hsZwF7Mtpn41WBd5Bz3qM3HYzi3GCmNyyb/+bg/CuBD1G9Zm3Mn54P+1B9no52TR8clwbOx5UJ67YxIoVthwbXWhxYazqLyPnMNQnjdYHz85LE9S+iKtod5Ua+lYEjyPlb9SWB45YkSZIkSZIktegmYl8AZ3btOiWYoQ1XBbO1cVF9j2C2zHO3H80ULC4G/oF6RVDTuTe4/mqF6w46Jpjh11RFZ3fUnHcN1QXx2ToXzaO6CFv6s8roTlJS2DkJo6sOLr+qkXHU8QBVl6C9KSse3D+4frRTzFTzg+v3gM2JFf99DXj6CNlWo+qAXPqzGnwNmEus8OEy4BVUrxez2ZH6r1dTxyjnp8Q25BQNPkDVCWiUYsWpdqD8PF1BTvFutLC/P75E/c87OwIfpNrqOrKmRYuT72ByCsBmGkuAE4FXUv45ctCqwBaFj/EkcooGlwAHUe9Gnr6tgRsL17+S5rp/XxPM9AKq1+W6z62TqYpUZyum2qEg2+DIvDFqJtFCvD1ayDboU8GcxyesPYfqvTTjNec+qi2UX0rVLXCwCHpP4C3Ei3GnjgMSjn0Um5BTNLiUqjg1suvA5lSf+0vWv57RPsNKkiRJkiRJkjqwOvEvgDPtG8zQxvbUhwWzHdVCtuhFz1OS1t+L/IvOX6Lq4pUlWpxSuoXnoMuDGb5BvSKj+4E3Uv8C9peD+frjDmKFO+Nue3KKm06lvW3TB/0omHemcR3VRcesgt7oherjktbfO7h+D7i15r//BfDMQMYPFmTs8dBinfNrzr2B6sJ43efuZsDdBZk/UnO9OuYCtxRk64/LgHUKs2xGeeHiToUZdilYewlVgVCJuVQ3PlxUc22LFifb82iuw+I5VN2lMzpAN2EO5QU4ParPhhsXZtmI8sLFvQozzCT6/Hgz9Yr1LqLqPl7H+pQXLh5Uc826Ni/ItknD2ab6fjDnEQlrfzy49uBYCryf0btEbwOcVrjmnZR/BpnNSsCFhTl7VAWDWxZmWZfy182mf+ckSZIkSZIkSUE/JvbF79HJOR4RzPGV5BzTiRZ2Zm6fPZ2SLouPSFj/8eQUdPXH12nmQtkfg3kyu8fcFcxQ9/ytVZDxksL1M55T42Q+ZYVX/XELs3e8bMKxwbzTjTuBV5O3JXNfdNvqg5PW/0Bw/brjLZSdu18UrP38ZY9xQs1576asK010u8ceVbFkU75XkKs/fkheQdQiyoq3riDWZa3viwVrZ21P3bcLcN6Ia1u0OLl2pJmCxe/SfJfWDJ+n/FjPpuzz3qBNKfuMeiVlr0HT2aggz6hjKfAmqsLpiM0p+4x4YnDdUb2yIFv0nERF//6IbEU9aBFV8X3J82gx8MTg+i+lrIvhZ4Prjup9BdkGz896SXk2IN6duUdVPNnFDWSSJEmSJEmSpFlEv/hd3rNMQrYuuyxGtiyeadxMtSVbE3YtyJUpukXbqONgyjsdLqSsa+b8wvXHTWkRZ388pu3gwOuJF+tOHV+guYLUm4OZNk1aP2ubvpnGrcBTEnJuRvx38ziqrclH/fc3JGWG+M+3R26n276dKe8MfBn5RchvLsxUslXtqEWCU8fhBWvO5vnAVbOsb9HiZNqIsqKT6cZ5TEaxIsB2lN/scyXwqORcBxdm2iY5zwsL88w2LqW88xuUFXXdkbD+MNEOgmc3nGs60b8ndyxc94fBdfvje5R/VtmFssLF0q3qZ7IIeKAgV4+qSDC7G+Q+hZn2TM4jSZIkSZIkSSp0FLEvfC9qKE/0C+g2jFu2rrssXlCw/uA4nvzubYPeE8x1WnKOB4M5Zhs3k3PhtW9xQZb9EnN07TPk/Hx2bTs4sDU5HVAfoLltH/vuDGZ7dNL6NwTXH2X8EFiQlBPiW1HeyujPh9PJ3VK1pIvfwsQcfaU/71uBNRrIBXBtQa6PFqw7W3HgTKPpIvW5wFuZ+eYMixYnzxzgl+S9xi4BDiO/y1+TSo//dqqtiZtQd4v2wfGZ5CzvLcgy2/g2ee/Nq1DWbbGpnyXEd1I4psFM01krmLNHVQQdtWPBuj1yChb7diFeIHh8Uoapzgjm6Y87aa6gsmRr7W82lEmSJEmSJEmSFBT9wrepi8XRrULb8O1gtu0bytNll8U6XbuGjTclZJlNtJPaEYkZ5gUzzDYWA6sl5oSyi3jHJmfpyv7kdCk8su3g5HVAvQRYu4W80eLKrIKp24PrzzY+T34xdlYh7Uzjow1k3qEgzwbJWd5ZkKU/oltAjqLkXC0h3v3x94H1TgiuFbEJ8JNpMli0OHmOJ+/16gJg43bjFzuU8uN+ZoP5ti7ItYTcgvcTCrIMG+8lf3vYkwvyNNkh9Mpgppc0mGk6Owdz9ijbxvqkgnXPJr8bdEnH5ezPS/sVZOmP5yVnGrR5Qa6l5HeqlSRJkiRJkiQFRTv13d9gpiOCmZoqDBz0l8FsX2kgS5ddFh9P+faaPeDFhTlGFe3ktm1ihr2CGYaNE2muQ2W0kGpeyZwAACAASURBVOy8hvK0aQvKt0PrAaeSf2F8FN8P5h0cl5C//e101ivIOCcpQ8bPeur4F8q3ap/O7g1k7Y83NpQZ4q8nmyRmmEv8vWDwHDUt2k2zR7zjbqRosY0bDqY6jIferGHR4mTZl7zXq+Np5z0q0xyqztglx/2eFnKWdFHPLMA7uyDHTOPQxHyDSopRm+pmPYf432qlWy7XdUgw528K1nwMVaFtZN07gHUL1h4meqPdmxMzrES8A3N/fCoxz0xOLcj3/BbySZIkSZIkSZJGEO3Ut2+DmdYJZvp8g5kGRb8cz9Zll8XbgmsPjrYKFgHuDWbM7GD4oWCGmcaJNFsQd09Btkk2j/Kigh5wC90UVOxGeYfItgoWoepoGcl4XdL684PrDxuvSso2ndUayNsDDmowM8S7WWYWLX4imKE/fkFZR6dRvbUg4+uCa0bW+mBwrVJbABcvy2DR4uRYnWpr9YzXq7cxWdtB972DsuO+jHbem19dkPGtiTmiXQJnGi9LzDbVdmOYq6Rr+joNZZrJx4M5v1qwZsmOAc8pWHc2uwYzXZqY4bXBDP1xFXnd0If564KMH20hnyRJkiRJkiRpFhsS/6K3aZFMTXZ/LM2Wfc667LL49oK1+6PtbceiXb4yt/36RTDDdOMYmuuI1hfpvNXW60OTfkbOz+gxbQdfpnRb6LaLLT8VzHlc0vp7B9efaeyflGuYaGegmcbuLWS+KZgts2ixdBvwTROzDDOX+M/4ouCakcL+a+iucGwuVRHq+h2tr/q+Tc7r1eFtB090HWXHvkNLOecQv9nn4sQc0QxTx1Lg2Ym5pjOnIF9TRYvR7o+3NpRnmBODWd9WsOb5wTVPLFhzVBcGs22ctP5lwfX747lJOWazEvEO2le0lFGSJEmSJEmSNMSlxL7kbWKr46miX5K3IVp8kamrLovziBcA9seHCjNERDvPZW0/C+XbkvZHGwWLUFZkOaneQ87P6K/aDr7Mp2tknG48QPvddaIXRg9OWv8DwfWnG20U/wHcPYGZuy5aLOle2AOOTcoxqpIOY5Gi42iR+laRg9MKZ0fi29QOjkkuWCzpXtgDvtFy3pKtmR+ZsP66BesPjjYKFvui781NFS0eH8xzakN5hlkczPo3wfUWEH9NauN975+C2TJunCnpXtgDTkvIUMd3CrI+quWskiRJkiRJkqQBjyD+BW9pp75RRC+gt+GIYLYDk9bvsstitBNGfyym2S2NpxPdZqtHbnHgfQU5+qOtgkUo+1lPot3IKap4D+39jAbNJ17M3B+7tp46vhX3oqT1zw2uP3W0VfwHeUWLbWbuumjx2uD6/bEwKceovlWQNXLOfhtc6yLa2TJbk+0Cyl+v3t566lwXUXb8j28578cKsma8P2d0QW6zYBHi73NNFS2eFcxzREN5hrktmHWn4Hr7Bdf7YXC9uhYF870vYe3Tgmv3xzYJGep4S0HW6PNHkiRJkiRJkpTgK8S+3L2qpXyfDObbvIVs6wSznZ20flddFku6UvTHgsIMEdHueecl5yjtUHki7RbDrUhFi2uTsw3hj6m2KuvCySNmnGl8mG6KLaMdSLO2374huP7gaLP4D3IKoNvOHC3myNj+dxHwh+D6Pcq2n4zapyDvdoH1/qtgvbcG1tOKY1/KX6+Op7utyDNsStnn54+0H5ndC/JmFAr+c8H6/fH8hBx1jFvRYjTPCxrKM5MFwZw94jc2RL9n+OvgehGRz8cnF665AfBgYN3B1+q27VCQ9+Ud5JUkSZIkSZIkLRP9cretrQC3CuY7qqV80fNXqssui2cUrN2juy1zo53UjkzOEd2iugf8gPY7VF5ekHfSlGzF2h+3AKu2HXyZ+cCSETIOy95GB93pRIt5swqgbw+u3x/PScpRR+lzdc/2I4e7Q2ZsV/6j4NqZGeparSDvAYH1SguE3sRkF5WpOaVdFi8mZ7vhLh1H2Tlo44asqVYtyPvahPW/WrB+D3hFQoa6ojcUNFG0WFIIuEUDeYbZriDrysE1o3/Trh1cL+LCQL4rCtd8b2DNwbF94foRKxfkfXcHeSVJkiRJkiRJwKuJf7nbpki+m8Y4W8b566rL4jzKOi+cSzdd3CDeyW3HxAwlW1TfDMxJzDKq6Bbt2R0qm/Zd4j+bwbFR28EH/OeQXKOMrK2W61qvRsapI2tL2gcKMvxdUoY6NizI2wNe035kIN5lLKNYKbrtZA/4WsL6UfcMyTVsvCew1hqUvcf3gH/HraL1UCXFSD2qYvy2t0VuwjXEz0Hp5/cS0dfOjM6QZwbX7tHeDWyD5hTk3auBPLsV5Gm7SPiVwZzXFKwZuVlpccF6EacGMl5fuOYlgTX748zCtUvcOCTXsNFFZ0hJkiRJkiRJEvEvo4+YkJxtOCWYraRjU5ddFj9bsHaPqiCiK9Ftf+cnZohuUd0DHpWYo45owcwxXYQNej1lHTD7o6suon3Rn1UP+A7dFRTvP2LGqeOWpPXnB9fvASfQfvdTKNs2+Fi6+VlvE8zbo/wcl2wb2CO+9WSGW4bkGjaiF+EvDa43OM4AHhtcX8ufSNHN4OiiMDzb1pSdg8wbaOr6zZBcw8Y3Olz7DLp5b35KMG8PeFoDed4ZzHJpA1lmc3Qw64kFa0a6Yn66YL2IrwUy9grW2zy4Xn/sU7B2qUhXyh5wWhdhpRXBSl0HkCRJkiRJ0lgr2d55HvD2rCAT7mhg98C8A4l3APlWcN6pVN3ESrykYO5RVFuwdiXapfB/EjPsGpz3H1QdD7sQ/a75Z6kpmrM11TZopUVcRwEnl8cJewVl21K/lLKLnCV2Cs77ScfrQ9UZ6A9JOep4RnDeEuB1dPOz3jk473LKz/GbCub+Dri6cP0SDwbnRbf2/Djw0eDcvh2ptvPdn247xKl7q1JWcHc57RcJNeGggrm/p9vu1dG/HTZNWHthcN5b6Oa9uaRj9c1pKf7kCcF5XXyGj3YqvzA4bw6xbaUvDq7XpvsL5r6gYO5dwPcK5pe6Nzhvg9QUkiRJkiRJkqSRRLd8naRR0s2wjki2q4JrddllsaRLVsb6paKd9DK3ZI5uUf2sxAx1/WFIrmEjeqG5TfOpLrCVvtb8mO4bCUS3ROsBH+4g76DLiOXO6r71geD6NyStH3HOkFzDRpfbHH9rSK5h49iEta8Prt2ju620+64glvuigjVvCq450+tL1+//6s6hlD1/SorKx8li4ufgHR3kHXQGsdylxV0Lg+v2gLUL1456f42Mg2MpzXSGvCiY55AGsszm/GDWvw2uF+0o+LLgelGRTrVXFKz348B6/fHJgnUzRLtSlpwvSUM8vOsAkiRJkiRJGlurLxvLuwO7DjDEhsF5XXZZLNnu96iE9UvsSryTXmanxWhh27mJGep4PPHvmqPdLtp0FrBa4WPcCuxF7vOkrnnAWgXzuy6IiL4fZXVa3C4476yk9SPWDM47MzVFPdGuWz9KWLukiLpk68kuPbJg7rvSUsBhwH8BT0p8TE2OFxfM/Rl5r/Nde3zB3BPSUrSrpPszVJ2wI+6j+mzWhY2D8y6mmc6Q0e6Fv0pNMZr1g/NuTE0xfiIFuCV/k2xTMPebBXO7FOm4KWkEFi1KkiRJkiRpJivKVn2vammdO1paZw/i3Yqen7B+yZZn70xYv0S0U2G/60eWcdiiuo6SDo/RLU3bcgzwxITH2Y7uCzQPI/7cOp72XsNmEr1Y+Luk9aMX9bssAJwfnNdloWW0QLikYyDAc4n/ftzN5BZEbFIw92PkFq1sRVWU8ya670qr9syh+tlH/VNWkI7tQvzz+73AJYlZ2hR9b+17SnBel9v3rhuc10Tm9YEFwbnXZgYZwSrEu2N22fW6DZGti68OrvU04sXG99PNtuIZor+3kmZh0aIkSZIkSZJmEu0qNWmi3Qzr+vfgvM1r/vsuuywuIn7B9WdUFzK6tGtwXvbFl2ixRldFi9HzBuNdtLg/OUXNLyK+1XumQwvmvjEtRVy0aDGre2t0/UksAMwq9IyIFlreXbju/gVzP0e3XVRLLC2c/9dUHcsyvY9qq9mSgkpNjj2oipEirqfb19hMexfM/SawJCtIy0pfg6I3lkxi0eKFqSkqOwbn3Uf7RYt1/yYe1HbR4mNaXGsDYI3AvGuC6+0UnAdwOvmfGdoyzn+zShPNokVJkiRJkiRN5+iuAyyHouf0sBr/tusui+8pmPvyhPVLbRacd1Jihm2Ib1Hd1cWUaNHixeR2qMy0MfAZyr9D/zDxQuJskQuaUG2f2NUWin3rEe+Cl3VxtOtOj3U9lvj7QWkBYIlooWVp5pIuwZ8vXLtLpZ0SfwX8PfDHhCyDtqfqHGfXxeXfCwvmvp/lp5CkZGv0r6WlaN+vC+evF5zXVdHiHOJFi9HOeMNEt9e+kGa2qh4m+j59E3BPcG70M1xJgWVdewTn/Tw4r6QD/fcK5nYtWuQpaRYWLUqSJEmSJGk6r+s6QMtWb2GNm4PzXlbj33bZZRHKOi80cSGurmhhxLmJGfYKzuuyADBaTPbN1BR55lFt6Rst+Oo7Gzic8SjM3J748byR9i9MTxV9bbmLnO5T84gXLXZVALhDwdy70lLUswPx61almdcqmHtT4doZos/PDMcCH2jgcedSdV08mXhhksbflgVzT05L0b2SbZKvSEsRF91iuFS0o11Xf3eUFMg30bU7WizbxRa/0awlBaq/I/YZeOeCNevaPTgvWjBc8pp9UcHcLNEtxiU1xKJFSZIkSZIkTZXRcW/SjPMxj1po1HWXRagKeyJOYjy21owW32Vmf1Zw3umJGeqKFnuelpoiz0nAowsf41bg2YxPB6hDCuaekpYiLlq0+JOO14fuCgCfEZx3I91tMxrNfDnlr8PRDo/Q7XbafX/W8fqH01yX7mcBlwIvbujx1a31g/NuAX6bGaRjCwvmNlHMVlf0M3Sp6Oe1trcL7ispWmwic7RYtovis42D80q7akbO+/rEX9vqWAP4q+Dc84PzNgjOA1hcMDdL9PsKSQ2xaFGSJEmSJElTfbnrAB14dUvrZBXQTKfrLouPJ37B8i0J62eIFt9lFi1GL2ZmblFdV/Tn/ovUFDneTXy760E7Ed+Krgklx3R7Woq4vwjO67poscsCwGinxbNSU9TTVeaSrbRPZTyK7qOdFn+TmOH1NFe4+EjgK8AnqDowavmwOvEup98kf1vyriwkXjj9M7p7nxkU7bRYUnC5esG61xasWyLaLfB3NPN5LFpY10Wnyui22qVFi9Hnyi6F647iUGJFeOcSu6lmjWUj4iLgvuDcTNFOi10VOkvLPYsWJUmSJEmSNGhzyrdEnUTbtbRO9GL+HiP87113WXxFwdxx6JSzK/Cw4NzMbnrRAsDMLarreDzx75nHodBn0G7AmxMe50VUXcHGSbQY4uuMx89p9eC8rKLFaNFklwWAawbnnZmaop5Ng/N+VLhuSeer0rWzRAv5sourXw+8ieaKyV5N1Vm4ZDtvjY+nFMw9NS1F96KvfQDnpKUos0pw3r0Fa0afP/dRdcTuQlfdAqfzFOIF75dnBhlRtGjxxsJ1LwnOO5xmuyCvAbwmOPcbwXklXRabeA5HzA/Ouz81haT/ZdGiJEmSJEmSBp3cdYDl3LeD8w6b5X/vussixLemIjFDiei2zBcDvcQc49DtsY7oeYPx2ToZqq4b36T84uKHif8+NilaTPCJ1BRx0YvqpReq+6LbJ3ZZABi9KNtloWW0uLZ0m8rNCuZ2+TPuW43478jPM4Ms8wHgJTTXUWlHqvfezRt6fLUn2nUOuuuU14ToewzAhWkp4lYl3vHwlwXrRp8/XRZPRQvvmvg5R4s+bwLuzAwyoui5K+2Qd0pw3ubAcwrXHuZfiXcNPDE4L/ozgPG4oWtl4ucsszO1pAEWLUqSJEmSJKnvEcCGXYfQtHYf8r+NQ5dFiF9wvZjx2N4vun3u6akpJq9oMXre7mQ8Ovj1nU110b30MQ4nt4g1wxbEn1eXZQYpEC3IyuqKEl1/EgsAf5eaop5ooeXdhetuWTC3q25dg7YpmNtU4ddXgWcA1zf0+OsAvwCe1tDjqx0lBTD/nZaieyWF0zelpYgrKT4tKSjbOjhvEosWL0hNUYm+d/wsNcVoSjoilxYtnkS8SPMTxAt6h9kVODg49yzgV8G5Jd8VXVcwN8smBXNvSUsh6SGiX1RIkiRJkiRp+fOVgrlHpqUo95fLRl37UnYORnUH8a1OpzMOXRYh/l3jfyRmKBG9YHxaYoZFxG8076pr4bgUe5b4OvC4wse4FXg249U9sm+ngrnZW8dGrEd82/Suixa7KgB8LPFi9tICwBLRQsvSzI8pmDsOvyM7FMzN6kY6nZ8DTwC+RnWDRba5wBnAM4FzG3h8Na9kW+QuOr01Jdr5C7otNO+LFg9CWUFZdKvarooW59DdFsfTiXar7WJL8mjR4u8of614EPgRsZv9HgN8Evhb4A+FOfrWBb5E/G/vowvWflTB3KZuYqijpEPzOOSXJEmSJEmSpOVaLziiWx43ZXPG+ziODuabrgBlj+BjzfR4JZYGc5RsL5zpXmL5M7tnHBbMsDgxQ133DMk1bBzSRdhpvIaq02f096g/ntB28Bq+QPy45nWQd6r9iWXPKsqeF1y/R1khSol9amQcl5/5DjUyTh2lDTouKlh7zcK1M5xGPH9J0VgdhwFLCnIOG0uw4+KkOoH4z3158i3i52EcuuR/jnj+Jxes+8vgms8tWLPEU2pknDpKOsTN5MpgliaK0GfznmDWHyatv2Nw/f54e1KO1ai6DEdzXEXZ57wPF6xd0i0zyzuJ59+lg7zSCsHtoSVJkiRJkgTVxeSoA9NS5IhuZ/q81BQzi3Y3mO48j0uXRYgXjZyXmiIu2sktc4vjvYLzuuxaGP25n5SaImZrqotvDyt8nH2AS8vjNGargrlL0lLERTtF/qTj9QHuSspQ1zOC826ku595NPPldLvV/Dj8jpR0ir09LcVwRwPbAb9u4LH7HRebKOpRs9boOsByYBy6vZbcuFGy5Wq0S27pdsFRJUVb16alqKwCrB+ce1VmkBFFX9+zumr+jKp7cNSRwIeAPyt4jE2obrLYsuAx3kx3n1t+39G6g0r+JromLYUkSZIkSZIk6f+I3nE+Dl8+Tyd6POOcb2ox5jh1WVxQkOWRyVmiot325iZmuCOYoctulX8Ykmucf+7zqLaLiz5v++PjlBc9Nu0aYsd2YRdhp3EZsfz/mLT+u4Lrd1UUAdXWjZHMX+si7DLRTmPHJqy9OLh2j/HoRhp9Lbub9pubzAXeS/y9Y9i4Bpjf3qEowRnEf97LkxOJn4euP08B3Ews+z3EX4NWDa7Zo7suyO+vkXFwNHFjTEnnwMy/fUZ1VjBrZmf3Halukih5nzoTeGJg7YMp/7vlTMqKJgGOKVi/ZGvpLFcRy34f5edO0gzstChJkiRJkqS/LJi7Z1oKzWazKf//OHVZHIftnkrsSrzwLLPDV7Rr4bmJGepYRPw75gczgwScT3lxy0XA66kuZo2z6MXlceggB7B6cF5Wp8W/CM47K2n9iOiWxWempqhn6nvcqH6UsPbKBXO7/j3ZjPhr2c+oCvbbtBQ4HNidqrNnpvWBjyQ/ptSGBQVzu+60uBHw6ODcc4i/Bm0dnHcfcGtwbqlNg/OauIlku+C8c6hex9u2bnBeZofKnwFfL3yMHai2Nf8asDPDC+EWAq+l6hb5Kcr+bnmQqvDxDwWPAWUFv13f7LousGFw7sWUnztJM4h+CSZJkiRJkqTlR7T4DeDstBS5/hN4cWDe9rRzTOcQv1gEVZfFaLfE5xesu7yKdiq8gtyCj+j3tV1tjbprwdwuixaPAZ5U+Bh3UW0b3MWF2xVNtKDs6qT1NwrO67IAMHphu8tCy2jmi1JTTJ5XF8z9TlqK+k6jKrj8ErmfSw4EPsr4dIpVcx5O+0W3+r/2LZh7asHc6Oe4rO2CI6KFd01k3jY4r6vX1nEoWgR4FfA04p8N+/ZZNu4CLgEuH/jfVqbacr1kG+ipDgd+lfh4k2iPgrldfj6Wlnt2WpQkSZIkSVqxrUO8i9V7M4Mk+3ZwXsnF/zo+GZzX7w4wTl0WAbZp4DHbFC2+Oy01BcwJzuuqaHGv4LzsYs869gH+X8LjPJ1qa9VJMA7b15aIFi3e3/H6XV7gXC0473epKeqJZs74Pey6U1mJ5xTMPSctRcw9wAuotu/M/Gzyn9i0ZVKUvOaskZaie12+9pb6q4K5JTeKRTstdlm0uH5w3uWz/5Paolm6uGFxY+Jb896QGYRqi+Z9yPvcMJ/qb4oDB8aLyS1YPAn4t6THuj7pcbpQUrQ4rjfqSssFixYlSZIkSZJWbCcXzD0iLUW+rwTnRbozRnw+OO/VjGeXxWiecRHdlvT0xAyPZ/K2Wo52acku9hzVelRdvaIXPvv2Z7K6lUS3Ph8H6xEv5u26aLGrIpTHEn9NvjMzSA1ziXdanJTi4SbMpfodicruQBX1SaqijaxiiE2AZyQ9lsbXo7oOIOYATy6Yf0XB3McF53VVtLgK8a11swvvoHqdjLgyNcVonhKcdydwe2aQZS4E/oa8z5lNuhg4ALc2XgnYpWD++VlBJP1fFi1KkiRJkiSt2LYKzvt5aorxMe7Fdy9j/LoslhqHgqpoR6bM4rvoFtUXA73EHHVEz9s3U1OMZh5wHuW/48cAXy6PMxGiF9cz7RSct4Sci8nziBctdlVMt0PB3K4ylxSY3ZWWIqa0CLrEq4m/pv2c8eru9nOq7TBPSXq89yU9jpr164K5JQW7y5NoYX+GfYl3yf0lcFPB2o8Ozru6YM0SiwrmXpWWorIW8c94v8kMMqLouWuyQPVk4EV0d7PHKG6g6oT6+66DLNNl5/c9iHfn/Q3w28QskqawaFGSJEmSJGnFFe32B7BnWooVV6SAcB3Gr8tiqVW6DsB4bMsc3aI6s9tjXdHzdm5qitGcSPX7U+Ii4PV0VyTato3pvqg4WrSYtY1bdH3orpguWgB4NbA0M0gN0ULLy8l5Hb6gYG60qDXD3xfM/VRaijz3UH2+/FjCYz2NeCc2taekGCvaKW4cXVIwd0Faivr+X8HcLxWuvTA4r4muhaOIFt7dB9yaGYSyzoU3ZwYZ0abBeU131TwZeCbjWdB2MbA9+ds5lxxrlzdDvaxg7olpKSRNy6JFSZIkSZKkFVf0y9sH6OaCRV2/CM7bPDXFzL7Q0jrQfJfFkotCO6aliIt2DByHosWTEjPUNQ7nbRRvJ97Jsu8uqgK2roq6SpRk7rr77F8E5/0kaf1o0eKNVN0euxAtADwzNUU90cxnJa1/Y8HcrooWHwtsVDD/R1lBGvD3wBuAPxY+zs4JWdSsXxbMfVFaiu7dUjC3q6LFhcB2BfNLupXPId5p8dqCdUs8KTjvwtQUlehr4zmpKUa3bnDeZakppncx8FTgcy2sNaqTqT6/ZhcsQtl2210VLa4B7F0w/+SsIJKmZ9GiJEmSJEnSiunAgrkvSUvRrE8G5x2WmmJmR7W0DjTfZbFka6y90lLE7Eq8m9yDiTmiBYBddC2EqmNM9PvlzPM2m52Af0p4nKfT3da5pUoKf7ruhLp6cF5W0WK0aDKrmC4iuv1dl5mjxXdZhXeLC+Y+MilDXZ8kvjX17XSzxWcdHwLeRNnrV8lnXbXjooK5u9Pd71+2ywvmrpWWop5/Id5x+/eU3fAULQBsomvhqKLvc010C9wsOK+rYvdo0WJbW4HfCbwC2I12CiVnchfwOprdErrknK6XlqKeQ4lvTX0XeX9TSJIkSZIkSZIG3E+1xWlkTIrViR3fTS1mjP4M6oxTWjiOeQX57mgh3zDvIZb7muQcDwRzdFVUdliNjF29hqxNtd1o6e/Q/i1mbsLVxI+96+037ySWO3qBe6rrg+u3Vfw+nZuH5Bo2tuwi7DLR8xwtXJlqw+D6PbrpFrwaVfFNNPOb2o8c9g3KXr+77har2V1H/OcbLSwfN+sSPwf7dZB3VarP79HM7yhc/6DgumcXrlvi/CG5ho1XNpDlomCWFzSQZRTR97undhEW+ABVV/mS9646YynwaWCdFo5tYUHOI1rIN9XKVJ1so5mjN8FKkiRJkiRJkobYivgXt1/pIG+J6HGOe746o60L9iUXZ6LdDzKcMSTXsHFsco7o+ZubnGNUP6iRcXCUbAdY16+CGQfHZ4l34hwX3yN+/KWFBaWWEMu9ZtL6twXXf1rS+hHRi/slWw2XihanbpCYIfpc+0hihlF9LZi1PzZsP3LYXOK/hz266+yk0Z1J/Of75Q7yNuVeYufgix1k/Wgwa39sXrj+x4Lrfrpw3RLRwqlnN5Dl7mCWRQ1kmc36waw92t2O+DFUNwRcUpC37rge+Ffa33Y5+pntuy3nBHhrMGt/bN9+ZEmSJEmSJEla/l1F/IvbSetYEz3OtlxWkHGU0UaXxb6S7p1/3mLOqaKdYjI725RckOuqoC563l7fUr7jgvkGxyV0VxSa6XDi5+BO4tuAl1p7xIzTjawOpNECwMclrV/XmjUyTh1ZhZ51za2RceqIboU9nWiHyluJb9Mc8VjKuiyeE1jzucvW7coHiB/vFh3kVT0fpuy9ev32IzficmLHfzvxbZojFlLWZfHChAynBtc+NGHtiFVqZJw6ols5z6Tkb44utmPfK5j13pbyPZGqcDh640PdcSfwBWBv2v3sMejcWTIOy97mjYprUNZl8dIWs0qSJEmSJEnSCiO6ZXKPqthx0txE7Fjb2F4J4MBgvlFHm0Wm0a4LPeD4FnMOmkf8ItOjE3O8PJhhcWKGuqLbLrfRpeUQ4I/BfP3xADC/haxt2Jiyc7FW+5GBeCelHjnFvCXb3rfd9abvuTUyTh1dFejuXCPj1LFSYo6S7khtdvP7cUHOHrBTYM1vUHU73KUwe9QjgQeJHe9WHeRVPVtT9pz+cPuRpWdVoAAAHJ1JREFUGxEtxOsBT24xZ2mn170SMkS3N35uwtoR29XIOHVkFwq+LJjjxuQco3pbjYyDo+mtwNcCPkM720BfQtXVeTe63Z2g77PEj6XNzxHHFOTsUW1DL0mSJEmSJElKdgrxL24n8cLvUcSO9YiW8j0imG+U0WaXRYATC/N2UTATvejZA1ZNzHF8MEOXF+qjxZ6rNZxri4Jsg2N5685V0gn1HzvIuxuwNJj3x4kZouesq4vK0fe8Lm9KiG7dd1lyjpJub4clZ5nJc4E/FOS8idh77cUDj/F2cotFR3UdsWOexM+uK6Jop9P+2Lj9yOneQvz4391Sxl0oK9L6b3LeH28Mrv/UhLUjXlkj4+C4poEsRwez/LCBLKOI/o30+QYz7UNZB79h407gp8AHgRdSdTYdNwcRP77PtJTxacRvduhR3aiR1bVdkiRJkiRJkjSg5Ev0SbQ5sWNts4CjiQsePdrfynvHwrwvbDnvfxXmzSxKil6sf1ZihrqihTNNPi/nUbZlYX+8osGMXYl2ne1RdZ1cucWsu1FWeHpUUo53Bde/IWn9iJ8OyTVsHNdF2GVOGpJr2Dg2OcdmwRw94C6a/x1ZjWob2JLXtucF1/7vKY/zE9rtLgnV57LIMW/Zck7FfJ2y5/bZtLtFchM2In789wALGs63KvHi4f7YPylLtHCyqy7I0ULBExvIcnIwy7cayDKKaHfhNzSU5/3BPNON24DvA++j+jt4Um6YWpf4Md9H87+HK1Pd2FLys2nq+SNJkiRJkiRJK7QjiX9x21YXoSZEj7ktJR3QZhptd1nsi3ZG61Gdh7a6N5UWLPaAP0vMc3cwQ1fbFy+qkbHJ8zbV+QW5+uOz5GwtPG6+QNl5OaClnKUFiz1gz6QsZwTX/1rS+hGXD8k1bLymi7DL/GpIrrafk7cGs/SAFzWQZ9B5Bdl6VIXLkaLxuUxfpL6E6mfw8OgB1XTNNBlGGRu2lE9lSrbP7Y9/bT11viuJH/9rG85W0q2/R1X8nNG57EnB9e9JWDvqhCG5ho23NZDlkmCWrooWr6iRcXC8oIEsXwlm6Y8bgS9Rdd7ctIF8bfoF8fPwLw1ni3bn7I/b6O5vbEmSJEmSJElarpV8eTvJxv2YP1+QcabRdpfFvtKtsprelnsecHVhxh5VZ8RM0cLVrratOqxGxibP26CSrV374xK62aa8DRsDf6Ts/DR9Ae8gyrad7I+sDnDXB9fvssg/2rW1y2500fP8pAay/CiYpUfVbXG1BjIBfKwgV3/sFFx7j1ke97vAY4OPPaq5xIuZ12g4m/JcSvnz/G9bTz29VYFnB+YdR/zY76G5rWTfWZCrP/ZKynJAcP0zktaPiN5U8zcNZIl23j61gSyjiN7Y9bTkHJ8L5rgV+ABVYfby5L3EXwvuAzZoKFf0b9TBcVBD2SRJkiRJkiRphTbbRedh48cd5M0ULQhbvaV80S2sZxpddVkEePmQXKOOjRrK9njgzoR8PaoODpmihVpdFdj9oEbGwZG9nWvfCykvdnuA5b+rxu8oO0en0lynzH+hvKiyP9ZKynRbcP3sC+V13DckVxevu6OIvi43ccF7h2CW/vhEA5newvSdDuuMM4h3RHzfCI+/hGorxabek/55hAzTjbsbyqNmHErOe0BbnYGnMwf4O6qOah8JzN+asmP/cln8ab2G8s9YZ5PXlTV6k0rk55ElelPX0xvIEv2ccGsDWWD4+8Zjgll7VFsYZ3ldMMNRwCMTc4yT0u8vTm4g0/7Ag4W5FtPsrgCSJEmSJEmStML6PfEvb9sq3mtKdCunV7eYseTL9amjqy6LfaVbu95MddE3016UbV09dbwiMdvCghxdbWN8R42Mg2O/BrKsT87PdosGso2bj1J+ng5JzjQP+GpCrsGxalK26IX9xyWtX9eaNTJOHWt2kBeqYoVo5qY66JV2DN47MUtGwWKPsi2Sz6yxzhVUReSZW0avQbyAuMut2hUT3QZ86jiK/M+Sw6zKn4oV+xkODj7Wbyg79pdHD2IaGQWLPaoCpyzfC2Y4MDFDHavUyDh1rN9AnpKf41aJOXah6kA57DF3C+ZcmphzfWLdHl+WmGFcXUjZ8+lNiVkyChZ7wPaJmSRJkiRJkiRJy2xI/Ivb33eQN1u0y+TZLWYs/YK9P7rsstj3DcqPYzF5F5vfSU7Rx+DIvIi4XzDD4sQMdd0zJNewsaCBLCUF2f2RXYg3ruYRL8QbHFkXYjemKnLK/N3skVMwNa9g/bUT1o94bo2MU0dXXVt3r5Fx6lipoUwZW81vnZDjMwk5Ml7fLg+seQHwfMp/F+cC5wTW74/nFa6v9r2avPeC84AtG867MfAhpr+ZY4/gY75lmseqO3YJrj0o47WwB7wxIcugC4I5dk7OMartamQcHJmFd4NKCvO/lbD+9lRd9vqPuc6Qf/uGYM4LEnL2fTmw/ucT1x9nB1H++vCihBwZ29f3qLa8ltSBru7ElSRJkiRJUnsuIt4ZYWcmf3toqL6Ijmjr+7OrKOuE1Lcy1Ta3XVpA1RWpdGuli4FnEN/e8fFU2zhvW5hjOqtRFe5l+Cyxzo1HA69PylDXEmJFTo8E7k3McSbVdq4lllBdpPpjeZxWvIuq61HUycQLKQa9Cvg08dfWQ4H3k18sdxHwlITH2Y1qO+yIR1A9r9p2FHB4YN7VdLc99DuBtwXmXU5u565Bc6m2wSzdLv6vga8H5m0LfAnYrHB9gHOBZ1JW/HI38e0tfwn8G9V78X01525BdRNEyc95A+DagvnqxmJgUeLjHQd8APhF0uNtTPU+egBVQdpMtqXqJFfXHOA64NGBuYMOAo4NzNuSqugqo/j6QqrPaZnvidcB6wXmPRH4VWKOUb2S6vNSXRcCT03OAlU305Kbr44E3lFzzhzgb6i6kU7tZPcYqi770/kise3e/4Oq816pOVSfB+redLUD8F8J64+7lahuPir9DuP1VH/X1rUZ1d/RzyhcH+BSYBvqf1aRJEmSJEmSJM3iEZTdcb68GPfjz+gsMw5dFvsyui32qDrXPKfm2guoiqGyuysOjnk1Mw1zdTDDsxIz1BU9t5kFakdSFRo29TMex3FdwnnL6rbYo7qYvHrN9fcALklaf7pxVM08M3lXcP2Mn1HUT4fkGjaO6yLsMqcNyTVsRApx6vhEMNd0OUfdxvrJVMWKGVux9oC7GN7BahTrJGVZQrVV834jZNoS+MiyOSVrnlN26OrQk4D7yX9/OIeqi+FTqNfNe3NgX+Dj1Hv/KinkeUfg+KYbX6EqChvFE6iK65YmrX0PzWxvHM33qAayjOLoGhkHR6TQcRRnBPMMju8z+01DC4AXUBXATteJtD+G3eR2ejDfEbOfhpHsHFw/46aDSfFacl4vvsPor5kbAx+lulEzY+37qG6UkCRJkiRJkiQ14PPEv8CN3PE+rqLnoC2lxaW9ZY8xLuaRdyGhR3WB7UUM32pyW+Bj5BV8DBulXSQH3RXMUNoFLGpRjYxTR1bn0h1ptih1XEdWQd67EzM9ALyH4V2x5lN1Ez07cd2Zxp7hs/JQ0Yv6XRYARrbx7QGv6SLsMpcNyTVsRDov1dHvtpj1O/JFqi5Tm1JdlO+PvamKk36etNbgyOjQdWADuXrADVSdTD83ME6m6gCWtcZOCcev7hxJM8+9/lhC1Zn3RB76POyP06len0oK+KIdSqEqqrwy8Vj/k6poeAse+hq0F1W32/OS1hoczy44/plsGsyS1R094oQhuYaNQxvK0++SnTGuA77NQ393vkvV0XLUxxgmepNLxpbDUBU/RtZ/VdL6k2Alqi62Gc+npVTPp5dS3cAw+Fq1J1XR+VlJaw2OF6efFUmSJEmSJEnS/yr5And5Ei2W2bfFjCU/q3Hqsth3CM10wvsJVTFu/+LY96i2o85eZ6ZxR+ZJIt71bpXkHKM6rEbGwXFe0voLKe/ANanjSQnnr+/GBvJdR3VxfvDi9fm0W2D650nn5/rg+gcnrR9x85Bcw8aWXYRd5oYhudr6XZjJ/kxucfR+Sefgy2NwLJFxBVUhhSbb9+n+uRQdtycc/960cyNOE+PvEo5/Oi8M5jmjoTyjOH9IrmFjr4by7BXM08S4Zpaswzo0DhtPj5yYaUSLFu+l2mp4RbET8CDdP58i458bOB+SJEmSJEmSpGVKOuRc2kHeJkXPRZvFgCVfuI9Tl8VBF9D9xYiZRrRY8BupZyh+kSdzq+U6flAj4+A4Mmn9rM5DkzjWSjh/fVuTtwVk9riFeMHz2knnJ1oIvWnS+hHR17SNugi7zD1Dcg0bG7SU75Rgvi7HuxOPv4nua22M2bYt1WRYlervka6fT5GRVST3pTE4lrrj40nHPp33BjN9pMFMs7llSK5hY1gH61I3BTNlj2HfN6xV8LhZ25JHixZ7VJ+x/5GyjquT5EN0/3yqO7rsji5JkiRJkiRJK4SSL3E37CBvk1Ynfi7aEt3Kexy7LPbNA+6n+4sSU8fhxLd/PSTx/CwoOIasrZbrinY92TZh7W8E115expzyU/gQJRdjmxq3UBUeRrtpZl0cjhYAPjpp/brWrJFx6lijg7wAq9XI2FXmucC1BTnbHu8m971hP+DOMTiuOuOzicev7m1EM52Bmx6fSTr+OcAvx+B4Rh0fBx6edOzTOTGY68AGMw2zSo2MU8eCBnO9pyBX5vjhkIw7Fzzun0VPTGKG/rgX+ALwV3R3w1kbVqKZrZubGseR9zyRJEmSJEmSJE1jK+Jf4t7fQd42RM9HW7YP5hvXLot9ixivLaMOX5YrWnyX2Uktus3d4sQMdUU7o61WuG5T241Pyriw8PzNJFoA0MToFyyuXfAYGRcg5xWsPz9h/Yjn1sg4dXS1je7uNTJ2mXlD4u8XbY7sgsW+9YGfjMHxjTKuYMXparUimcTCxcMSj3/dCTn+pgsWAc4NZtu54Vwz2a5GxsFxa8O5ViHeATJzfGtIxkODj5n5N9Icct//7wD+E3gZed0gx8lC4Dd0/7yabViwKEmSJEmSJEktKNn2qatuFE2Lno9xzjjOXRYH7QX8ge4vUhw6kOne4GOUFt8NOiaY4cOJGeqKdsBbuWDNcSt87WL8XcH5m804dHG6hD9tf71/wWNk2K3gOLK7YY7qqBoZB8dlXYRd5p1Dco1b5p2Jd99sY7yR5rvvvob4+2Yb4zZgvcaOXl1bl8naKvqvko9/O8a7ePqdNF+wCHBNMN8WLWSbzitrZBwcp7aQ7YBgtszx6SH5PhV8zK/GT8m0vhzMMcq4hKrY97l0d9NLtkWMR0HsTONoLFiUJEmSJEmSpMaVbIXc6yBvW64idj72aDFj3Wzj3mVx0CF0V7h4P9UFoUHRIrjMc355MMOzEjPUFf0ZRjujzWO8L9S3NZosxplHVQjW1bGdwkOLWr8SfJxjks7Hu4LrX5e0fsRPh+QaNo7tIuwypw3JNY6Zd2b8XoseoLopoC3rAN9o4DhKx23A4xo8bo2HOVSd2bp+vo0ytmvg+Ldj/DouLgH2beBYZ3J/MOejWsw46OgaGQfHB1rK9+/BfFnjPUOyfT/4mG8rOB/TWZ/2blq4APgg1d+sayQfR5sWMX4dF5cCBzd50JIkSZIkSZKkP/kx8S90v91B3rYcSeycfL7FjHUKKyely+KgFwH/Q7sXKS7n/27BtbDg8TK7M9wZzNBVN45tamQcHHcUrHlhcM3lbSwoOIejmEfZe0d0/Av/93fq2uBjPT/pXJwRXP+4pPUjogXQB3QRdplooexBXYRdZjPgtzPkanucB2zQ7OHOaDfgohEytjGuwYLFFc24d/3sUW0r34SNgF+MwfH1gIuBJzR0nNNZN5jznhYzTnXikFzDxktayjeHeHFgxjhiSLbFwcf8m4LzMZO3BrOUjkuAjwB7Um3pPUnWBc6ku+fW4LgCeGqzhytJkiRJkiRJGlType4kde6ra0Ni5+T+FjMeViPXpP6stgHuop2LFB9n+iLDlwcfr6T4bjrRzh1dXbh6e42Mg+MbwfU+EVxveRsP0N5WZv8G/LGFY7oF2HWGDL8LPuafZ5wA4Prg+l12cLl5SK5h40ldhF3mhiG5ho0tuwg7YC7wSbrrHPwAVaFHtHttpgOJd7HOGCdRdRfXimcj4Ht099ybaXwJ2KTB44aq0OxDtH8TUH8sobrhYF7DxznV3sG8Z7Scc1C08G6nFjPOAY4P5iwdLxuS67bgY+5YcjKG+FwwT9a4j+o97+V01zm0rpWAfyW+u0HpWEr1WjlpBZ+SJEmSJEmSNNGOIv7F7k0d5G1b9Ny0ZdStvSexy+KgecBXaa44ajHwzCHrRy/ORYvvZrI0mGNuco5RRTvQvSKw1gvpriho3MbXAuevxF8Dtydln24czfBih2gHrbXLDx2IXyjfNGn9iGgBdFed+qDqfhXJvFEXYaexJ1WnsTZfC46n2a3iow6k3c6LdwOvBR7exsFprO0OnEW7v4dTxz1U3dDafm3aiarjapvH+k2aL8qcyT+PmHHq+EgXYZeJfp7o4n3uVVSvrW0+n2bqkL2g4DGbPHddFy72x1Lg68AetHdTU4ltif8NGR0n0+2NOZIkSZIkSZK0wir5cnerDvK2LXpuxi3jpHZZnGov4NfkXaC4hmrr0NkKGe4IPv7ri4/4T+YFM/SAhyXmqCN63qZuzz2bhcQLOpfHsWfN85dhHvAecrujfBnYfJZ15xc8/mqlB71MtADw0Unr17VmjYxTxxod5IXqZxXNvGYHeYd5Jc0WLz4AfBrYoq0DKrAD8AWa27p3CfBhqvcIadCOwH9QdUdv6ndx6jiNqlNc1128/pZmixeXUHWQ3LqtA5rBCcTyH9hFWMoK77q6OWl9qs9qTXbxvJKq+97jhuTYseDxmz53h1H9TrT1OjPbuGZZpvlNHnSSfWi2eHEp1Y1e27d1QJIkSZIkSZIkLY9m+0J+0rssTuc5wInEO+t9H3gRdl2Sss0HjqS6KBr53bwF+CDddiGU2vBMqi6i0a26p46TqbrULmjzIJLMBZ5L1RnyJsrPxS+AN9Bdka0mx+rAS6kKV6Jd7oYVB32BqkhwHJ+LTwPeD1xHzvGeBhwCrNXmQWgsbES1e8PV5DyXzqPaUny7Ng+iQVsB55P7+lI6bgMOp/1t2yOeDLybqoA149h/QlW4+Zg2D0JSnq7uyJUkSZIkSZI0vW8Dzxvyv69M1XlpebSAqtDh6VQXhDYC1pnyb/6b6sLxz6kuUpxCtZWtpGY9lWoruu2BJwAb8n+3pbuGanv2c6h+P8+i2gZeWpFsQfU+9jRgY6rflfWBOdP82xupCvsuBy4FzgV+TNUxaHmxOVUXxm2ptpbtn4/pOmJdS1Uos5iq0OU0qnMkRWwJPIXqM+XjqZ57qwOPneHf3wvcSlX4dy1wGVUn1Z9Tvb9Nik350+9c/7j/nOk7td9C9Tv2a+BXVL93P6bqOiw9CdiVqtDsicC6y8Z0rqZ6Lv0WuBD4JXA21Rbqy6NXUN3Y8+ddBxnwG+C1VDf0TYLHAc8AtgE2o3qtWg9YdZp/eztwA3AFcAlV4eiPgbtaSSpJkiRJkiRJkiRJkiRJUsfmAPsDF9B9t8XBcQzdb10vSZIkSZIkSZIkSZIkSZIasBbwPmAJ3Rcs9sdZwNpNHrQkSZIkSZIkSZIkSZIkSWreKsCewNFUW8h3XaA401iMhYuSJEmSJEmSJEmSJEmSJE2cVai2gv42cB/dFySOOi7EraIlSZIkSZIkSZIkSZIkSZoITwU+C9xN9wWI0XFs+lmRJEmSJEmSJEmSJEmSJElp9gB+SjNFhL8CfgScDdzT0BpTx1/lnh5JkiRJkiRJkiRJkiRJklTqicBp5BYMXgl8CHgWsPKU9VYC/gL4N+DG5HUHx/XAvPLTI0mSJEmSJEmSJEmSJEmSMvwzsIScIsEbgQ8A29VYfyXgecDJSRmmjoPqnAxJkiRJkiRJkiRJkiRJkpRvAXA6OYWBpwIvBOYWZtoM+ATwQFKuHnBFYSZJkiRJkiRJkiRJkiRJklRgAfBzyooB7wU+AjyugXwLgaPIK17cpoGMkiRJkiRJkiRJkiRJkiRpBD+jrAjwE8AaLeTcADixMGsPeH0LWSVJkiRJkiRJkiRJkiRJ0hRvI178txjYsv3I/D3wYCBvf3yz/ciSJEmSJEmSJEmSJEmSJK3YVgFuI1b49z3gke1H/l/7Ey9cvKKDvJIkSZIkSZIkSZIkSZIkrdCiXRbPAFbuIO9U7yTebVGSJEmSJEmSJEmSJEmSJLXoDGIFf5t1EXYaKwO3YNGiJEmSJEmSJEmSJEmSJElj73rqF/v9sJOkM/sOFi1KmnAP7zqAJEmSJEmSJEmSJEmS1II/C8w5Jz1FmSWBOfenp5CkAhYtSpIkSZIkSZIkSZIkSdPbvOsAU8wPzLksPYUkSZIkSZIkSZIkSZIkSRrqGupvq3wv8Mguwk5jZeAe6h/DF7oIK0kzsdOiJEmSJEmSJEmSJEmSVgTXBuasAhyYHSToH4BVA/O+nx1EkiRJkiRJkiRJkiRJkiQN91HqdynsAUuBZ3eQd9AiYl0We8A6HeSVJEmSJEmSJEmSJEmSJGmFtohY0V+/cPGg9iMDVe5bRsg43fhmB3klSZIkSZIkSZIkSZIkSRJwPvHCxR5wOrB9i3kPJt5hsddyVkmSJEmSJEmSJEmSJEmSNGAvyooW++MnwMuABQ1kXAnYB7i4MKNdFiVJkiRJkiRJkiRJkiRJ6tg3ySlc7I8zgKOAFwCbAn8WyLQ28ELgGODGhEy3AesFckhS4x7WdQBJkiRJkiRJkiRJkiSpRQuAi4CNGlzjauA64G7glhn+zXzg0cAmy/4z03OAk5IfU5IkSZIkSZIkSZIkSZIkBWxM1Y0ws+PiuIxXJZ4nSZIkSZIkSZIkSZIkSZKU4CnANXRfZGjBoiRJkiRJkiRJkiRJkiRJK4D1gfPovtiwdCwFDkg+N5IkSZIkSZIkSZIkSZIkKdkc4L3A/9B98WFkXAU8Lf2sSJIkSZIkSZIkSZIkSZKkxuwAnE/3RYh1xqeA+U2cDEmSJEmSJEmSJEmSJEmS1LwDgGvpviBx2DgP2KmpEyBJkiRJkiRJkiRJkiRJktq1L3Am3RcoTi1WfE6TBy1JkiRJkiRJkiRJkiRJkrqzJXAUcDXdFCreCXwB2L7pA5UkSZIkSZIkSZIkSZIkSePjCcBhwHeBW2muUPES4OPA3sC8Vo5MklrysK4DSJIkSZIkSZIkSZIkSRPqscC2wCbAxsCGwDrAo4BHAysPmXsr8DvgBqoujpcClwFnA7c3F1mSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmS1LH/D1Vv8Acd63QRAAAAAElFTkSuQmCC";


    return `
        <div class="preview-page" id="plantillaPDF" style="width:210mm; min-height:297mm; padding:10mm; margin:0 auto; background-color:white; font-family:Arial, sans-serif; font-size:12px; box-sizing:border-box;">
            <table style="width:100%; border-collapse:collapse; margin-bottom:6px; border:1px solid #000;">
                <tr>
                    <td style="border:1px solid #000; padding:4px; vertical-align:middle; text-align:center; width:20%; height:60px;">
                        <div style="display:flex; justify-content:center; align-items:center; height:100%;">
                            <img src="${logoDataURI}" alt="Logo" style="height:50px; width:auto; display:block;">
                        </div>
                    </td>
                    <td style="border:1px solid #000; padding:4px; vertical-align:middle; text-align:center; font-weight:bold; width:60%;">
                        <strong>FORMATO DE SOLICITUD DE INICIO DE PROCESO DISCIPLINARIO</strong><br>
                        <strong>PROCESO: TALENTO HUMANO</strong>
                    </td>
                    <td style="border:1px solid #000; padding:4px; vertical-align:top; font-size:11px; width:20%;">
                        <strong>CODIGO:</strong> FT-TH-024<br>
                        <strong>VERSIÓN:</strong> 11<br>
                        <strong>FECHA:</strong> 09/01/2026<br>
                        <strong>PÁGINA:</strong> 1 de 1
                    </td>
                </tr>
            </table>

            <table style="width:100%; border-collapse:collapse; margin-bottom:6px;">
                <tr>
                    <td style="border:1px solid #000; padding:4px; vertical-align:top; height:22px;">
                        <strong>Fecha de solicitud:</strong> ${fechaFormateada}
                    </td>
                </tr>
            </table>

            <table style="width:100%; border-collapse:collapse; margin-bottom:6px;">
                <tr>
                    <th colspan="2" style="border:1px solid #000; padding:4px; background:#d9d9d9; text-align:center; font-weight:bold;">1. DATOS DEL TRABAJADOR</th>
                </tr>
                <tr>
                    <td style="border:1px solid #000; padding:4px; vertical-align:top; width:30%;">Nombre completo:</td>
                    <td style="border:1px solid #000; padding:4px; vertical-align:top;">${escapeHTML(registro.nombre)}</td>
                </tr>
                <tr>
                    <td style="border:1px solid #000; padding:4px; vertical-align:top;">Número de cédula:</td>
                    <td style="border:1px solid #000; padding:4px; vertical-align:top;">${escapeHTML(registro.cedula)}</td>
                </tr>
                <tr>
                    <td style="border:1px solid #000; padding:4px; vertical-align:top;">Cargo:</td>
                    <td style="border:1px solid #000; padding:4px; vertical-align:top;">${escapeHTML(registro.cargo)}</td>
                </tr>
                <tr>
                    <td style="border:1px solid #000; padding:4px; vertical-align:top;">Área / Dependencia:</td>
                    <td style="border:1px solid #000; padding:4px; vertical-align:top;">${escapeHTML(registro.area)}</td>
                </tr>
                <tr>
                    <td style="border:1px solid #000; padding:4px; vertical-align:top;">Jefe inmediato:</td>
                    <td style="border:1px solid #000; padding:4px; vertical-align:top;">${escapeHTML(registro.jefe)}</td>
                </tr>
            </table>

            <table style="width:100%; border-collapse:collapse; margin-bottom:6px;">
                <tr>
                    <th colspan="2" style="border:1px solid #000; padding:4px; background:#d9d9d9; text-align:center; font-weight:bold;">2. DESCRIPCIÓN DE LOS HECHOS</th>
                </tr>
                <tr>
                    <td style="border:1px solid #000; padding:4px; vertical-align:top; width:30%;">Fecha(s) de ocurrencia:</td>
                    <td style="border:1px solid #000; padding:4px; vertical-align:top;">${escapeHTML(registro.fechasHechos)}</td>
                </tr>
                <tr>
                    <td style="border:1px solid #000; padding:4px; vertical-align:top;">Lugar de ocurrencia:</td>
                    <td style="border:1px solid #000; padding:4px; vertical-align:top;">${escapeHTML(registro.lugar)}</td>
                </tr>
                <tr>
                    <td colspan="2" style="border:1px solid #000; padding:4px; vertical-align:top; height:90px;">
                        <strong>Descripción:</strong><br><br>
                        ${escapeHTML(registro.descripcion).replace(/\n/g, '<br>')}
                    </td>
                </tr>
                <tr>
                    <td colspan="2" style="border:1px solid #000; padding:4px; vertical-align:top; height:90px;">
                        <strong>Información adicional:</strong><br><br>
                        ${registro.infoAdicional ? escapeHTML(registro.infoAdicional).replace(/\n/g, '<br>') : 'No aplica'}
                    </td>
                </tr>
            </table>

            <table style="width:100%; border-collapse:collapse; margin-bottom:6px;">
                <tr>
                    <th style="border:1px solid #000; padding:4px; background:#d9d9d9; text-align:center; font-weight:bold;">3. ANEXOS</th>
                </tr>
                <tr>
                    <td style="border:1px solid #000; padding:4px; vertical-align:top; height:100px;">
                        Fotografías / Quejas / Correos / Testimonios / Otros:
                    </td>
                </tr>
            </table>

            <table style="width:100%; border-collapse:collapse; margin-bottom:6px;">
                <tr>
                    <th colspan="2" style="border:1px solid #000; padding:4px; background:#d9d9d9; text-align:center; font-weight:bold;">4. FIRMAS</th>
                </tr>
                <tr>
                    <td style="border:1px solid #000; padding:4px; vertical-align:top; height:90px;">
                        Firma Jefe Inmediato:<br><br><br>Nombre:<br>Cargo:<br>Fecha:
                    </td>
                    <td style="border:1px solid #000; padding:4px; vertical-align:top; height:90px;">
                        Firma Jefe Talento Humano:<br><br><br>Nombre:<br>Cargo:<br>Fecha:
                    </td>
                </tr>
            </table>

            <table style="width:100%; border-collapse:collapse; margin-bottom:6px;">
                <tr>
                    <th style="border:1px solid #000; padding:4px; background:#d9d9d9; text-align:center; font-weight:bold;">5. REVISIÓN JURÍDICA</th>
                </tr>
                <tr>
                    <td style="border:1px solid #000; padding:4px; vertical-align:top; height:70px;">Concepto y/o sanción definida:</td>
                </tr>
                <tr>
                    <td style="border:1px solid #000; padding:4px; vertical-align:top; height:70px;">Observaciones del Área Jurídica:</td>
                </tr>
                <tr>
                    <td style="border:1px solid #000; padding:4px; vertical-align:top; height:70px;">
                        Visto Bueno Asesor Jurídico:<br>
                        Nombre: _______________<br>
                        Firma: _______________<br>
                        Fecha: ____/____/______
                    </td>
                </tr>
            </table>

            <div style="text-align: right; font-size: 10px; margin-top: 10px; color: #666;">
                Generado el ${new Date().toLocaleString()}
            </div>
        </div>
    `;
}

// Función auxiliar para escapar HTML y evitar problemas con caracteres especiales
function escapeHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function descargarPDF() {
    if (!currentPreviewId) return;

    const registro = registros.find(r => r.id === currentPreviewId);
    if (!registro) return;

    mostrarCarga("Generando PDF, por favor espere...");

    // Pequeña pausa para asegurar que el DOM esté listo
    setTimeout(() => {
        const element = document.getElementById('plantillaPDF');

        if (!element) {
            console.error('Elemento plantillaPDF no encontrado');
            ocultarCarga();
            mostrarMensaje('Error: No se pudo generar el PDF', 'error');
            return;
        }

        // Guardar estilos originales
        const originalDisplay = element.style.display;
        const originalVisibility = element.style.visibility;
        const originalPosition = element.style.position;

        // Forzar visibilidad
        element.style.display = 'block';
        element.style.visibility = 'visible';
        element.style.position = 'relative';

        // Configuración simplificada para html2canvas
        const options = {
            scale: 2,
            backgroundColor: '#ffffff',
            logging: false,
            allowTaint: false,
            useCORS: true,
            windowWidth: element.scrollWidth,
            windowHeight: element.scrollHeight
        };

        html2canvas(element, options).then(canvas => {
            // Restaurar estilos originales
            element.style.display = originalDisplay;
            element.style.visibility = originalVisibility;
            element.style.position = originalPosition;

            try {
                // Crear PDF
                const pdf = new jsPDF({
                    orientation: 'portrait',
                    unit: 'mm',
                    format: 'a4'
                });

                const pageWidth = 210;
                const pageHeight = 297;

                const imgWidth = canvas.width;
                const imgHeight = canvas.height;
                const ratio = imgWidth / imgHeight;

                // Calcular dimensiones manteniendo proporción
                let pdfImgWidth = pageWidth - 20;
                let pdfImgHeight = pdfImgWidth / ratio;

                if (pdfImgHeight > pageHeight - 20) {
                    pdfImgHeight = pageHeight - 20;
                    pdfImgWidth = pdfImgHeight * ratio;
                }

                const xPos = (pageWidth - pdfImgWidth) / 2;
                const yPos = 10;

                // Usar JPEG para mejor compatibilidad
                const imgData = canvas.toDataURL('image/jpeg', 0.95);

                pdf.addImage(imgData, 'JPEG', xPos, yPos, pdfImgWidth, pdfImgHeight);

                const nombreArchivo = `Solicitud_${registro.nombre.replace(/[^a-z0-9]/gi, '_')}_${registro.cedula}.pdf`;
                pdf.save(nombreArchivo);

                mostrarMensaje('PDF generado correctamente', 'success');
                cerrarPreview();

            } catch (pdfError) {
                console.error('Error al crear PDF:', pdfError);
                mostrarMensaje('Error al generar el PDF', 'error');
            }

            ocultarCarga();

        }).catch(error => {
            console.error('Error en html2canvas:', error);

            // Restaurar estilos originales
            element.style.display = originalDisplay;
            element.style.visibility = originalVisibility;
            element.style.position = originalPosition;

            ocultarCarga();
            mostrarMensaje('Error al capturar la imagen: ' + error.message, 'error');
        });
    }, 500);
}

// Función auxiliar para capturar y generar PDF
function capturarYGenerarPDF(element, registro, originalDisplay, originalVisibility, originalPosition) {
    // Configuración para html2canvas evitando problemas CORS
    const options = {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight,
        foreignObjectRendering: false, // Deshabilitar para evitar problemas
        imageTimeout: 0,
        removeContainer: true,
        onclone: (clonedDoc) => {
            // En el clon, aseguramos que todas las imágenes tengan el atributo crossOrigin
            const clonedImages = clonedDoc.querySelectorAll('img');
            clonedImages.forEach(img => {
                img.crossOrigin = 'anonymous';
            });
        }
    };

    html2canvas(element, options).then(canvas => {
        // Restaurar estilos originales
        element.style.display = originalDisplay;
        element.style.visibility = originalVisibility;
        element.style.position = originalPosition;

        try {
            // Crear PDF
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });

            const pageWidth = 210;
            const pageHeight = 297;

            const imgWidth = canvas.width;
            const imgHeight = canvas.height;
            const ratio = imgWidth / imgHeight;

            // Calcular dimensiones manteniendo proporción
            let pdfImgWidth = pageWidth - 20; // márgenes de 10mm cada lado
            let pdfImgHeight = pdfImgWidth / ratio;

            // Si la altura excede la página, ajustar
            if (pdfImgHeight > pageHeight - 20) {
                pdfImgHeight = pageHeight - 20;
                pdfImgWidth = pdfImgHeight * ratio;
            }

            const xPos = (pageWidth - pdfImgWidth) / 2;
            const yPos = 10; // margen superior

            // Usar JPEG para mejor compatibilidad
            const imgData = canvas.toDataURL('image/jpeg', 0.95);

            pdf.addImage(imgData, 'JPEG', xPos, yPos, pdfImgWidth, pdfImgHeight);

            const nombreArchivo = `Solicitud_${registro.nombre.replace(/[^a-z0-9]/gi, '_')}_${registro.cedula}.pdf`;
            pdf.save(nombreArchivo);

            mostrarMensaje('PDF generado correctamente', 'success');
            cerrarPreview();

        } catch (pdfError) {
            console.error('Error al crear PDF:', pdfError);
            mostrarMensaje('Error al generar el PDF', 'error');
        }

        ocultarCarga();

    }).catch(error => {
        console.error('Error en html2canvas:', error);

        // Restaurar estilos originales
        element.style.display = originalDisplay;
        element.style.visibility = originalVisibility;
        element.style.position = originalPosition;

        ocultarCarga();
        mostrarMensaje('Error al capturar la imagen para el PDF: ' + error.message, 'error');
    });
}
