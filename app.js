// ============================================
// PARTE 1: VARIABLES GLOBALES Y CONFIGURACIÓN
// ============================================

let registros = [];
let currentPreviewId = null;
let currentUser = null;
let currentUserRole = 'invitado'; // admin, revisor, invitado
const { jsPDF } = window.jspdf;
let areasDisponibles = new Set();

// ============================================
// VERIFICACIÓN DE SUPABASE
// ============================================

// Esperar a que Supabase esté disponible
let supabaseClient = window.supabaseClient;


if (!supabaseClient) {
    console.warn('⚠️ Supabase no está listo, intentando conectar...');

    // Intentar crear el cliente si tenemos las credenciales
    if (window.SUPABASE_URL && window.SUPABASE_ANON_KEY && typeof supabaseClient !== 'undefined') {
        supabaseClient = window.supabaseClient.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
        window.supabaseClient = supabaseClient;
        console.log('✅ Supabase inicializado manualmente');
    } else {
        console.error('❌ No se puede inicializar supabaseClient. Verifica config.js');
    }
}

// Si todavía no hay Supabase, mostrar error
if (!supabaseClient) {
    mostrarMensaje('Error: No se pudo conectar a la base de datos', 'error');
}

// ============================================
// PARTE 2: FUNCIONES UTILITARIAS
// ============================================

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

function escapeHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// ============================================
// PARTE 3: AUTENTICACIÓN Y ROLES (SUPABASE)
// ============================================

async function actualizarUIUsuario(user) {
    const userName = document.getElementById('userName');
    const userRoleSpan = document.getElementById('userRole');
    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const adminTab = document.getElementById('adminTab');
    const reviewTab = document.getElementById('reviewTab');

    if (user) {
        currentUser = user;

        // Obtener rol del usuario desde la base de datos
        try {
            const { data, error } = await supabaseClient
                .from('usuarios')
                .select('rol')
                .eq('email', user.email)
                .single();

            if (data && data.rol) {
                currentUserRole = data.rol;
            } else {
                // Determinar rol por email (fallback)
                if (user.email === 'juridica@transportehb.com.co') {
                    currentUserRole = 'admin';
                } else if (user.email === 'rrhh@transportehb.com.co') {
                    currentUserRole = 'revisor';
                } else {
                    currentUserRole = 'usuario';
                }
            }
        } catch (error) {
            console.error('Error al obtener rol:', error);
            currentUserRole = 'usuario';
        }

        if (userName) userName.textContent = user.email || 'Usuario';
        if (userRoleSpan) {
            userRoleSpan.textContent = currentUserRole === 'admin' ? 'Admin' :
                                      currentUserRole === 'revisor' ? 'Revisor' : 'Usuario';
        }
        if (loginBtn) loginBtn.style.display = 'none';
        if (logoutBtn) logoutBtn.style.display = 'flex';

        // Mostrar tabs según rol
        if (adminTab) adminTab.style.display = currentUserRole === 'admin' ? 'flex' : 'none';
        if (reviewTab) reviewTab.style.display = currentUserRole === 'revisor' || currentUserRole === 'admin' ? 'flex' : 'none';

    } else {
        currentUser = null;
        currentUserRole = 'invitado';

        if (userName) userName.textContent = 'Invitado';
        if (userRoleSpan) userRoleSpan.textContent = 'Sin rol';
        if (loginBtn) loginBtn.style.display = 'flex';
        if (logoutBtn) logoutBtn.style.display = 'none';
        if (adminTab) adminTab.style.display = 'none';
        if (reviewTab) reviewTab.style.display = 'none';

        // Redirigir a form si está en sección restringida
        if (document.getElementById('admin-section')?.classList.contains('active') ||
            document.getElementById('review-section')?.classList.contains('active')) {
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

async function iniciarSesion(email, password) {
    mostrarCarga("Iniciando sesión...");

    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (error) throw error;

        actualizarUIUsuario(data.user);
        cerrarLoginModal();
        mostrarMensaje('Sesión iniciada correctamente', 'success');
        cargarRegistros();

    } catch (error) {
        console.error('Error de login:', error);
        let mensaje = 'Error al iniciar sesión';
        if (error.message.includes('Invalid login')) mensaje = 'Credenciales inválidas';
        mostrarMensaje(mensaje, 'error');
    } finally {
        ocultarCarga();
    }
}

async function cerrarSesion() {
    try {
        const { error } = await supabaseClient.auth.signOut();
        if (error) throw error;

        actualizarUIUsuario(null);
        mostrarMensaje('Sesión cerrada correctamente', 'success');

    } catch (error) {
        console.error('Error al cerrar sesión:', error);
        mostrarMensaje('Error al cerrar sesión', 'error');
    }
}

// ============================================
// PARTE 4: GESTIÓN DE ANEXOS (SUPABASE STORAGE)
// ============================================

async function subirArchivo(file, solicitudId) {
    return new Promise(async (resolve, reject) => {
        try {
            // Generar nombre único para el archivo
            const timestamp = Date.now();
            const random = Math.random().toString(36).substring(2, 10);
            const extension = file.name.split('.').pop();
            const nombreLimpio = file.name
                .replace(/\.[^/.]+$/, '')
                .replace(/[^a-z0-9]/gi, '_')
                .substring(0, 30);

            const fileName = `solicitud_${solicitudId}/${timestamp}_${random}_${nombreLimpio}.${extension}`;

            // Subir a Supabase Storage
            const { data, error } = await supabaseClient.storage
                .from('anexos')
                .upload(fileName, file, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (error) throw error;

            // Obtener URL pública
            const { data: urlData } = supabaseClient.storage
                .from('anexos')
                .getPublicUrl(fileName);

            const fileData = {
                nombre: file.name,
                tipo: file.type,
                tamaño: file.size,
                url: urlData.publicUrl,
                path: fileName,
                subido: new Date().toISOString()
            };

            resolve(fileData);

        } catch (error) {
            console.error('Error al subir archivo:', error);
            reject(error);
        }
    });
}

async function procesarAnexos(solicitudId) {
    const files = document.getElementById('fileInput').files;
    const urlsInput = document.getElementById('urlAnexos').value;
    const anexos = [];

    // Procesar archivos subidos
    if (files.length > 0) {
        mostrarCarga(`Subiendo ${files.length} archivo(s)...`);

        for (let i = 0; i < files.length; i++) {
            try {
                const fileData = await subirArchivo(files[i], solicitudId);
                anexos.push({
                    tipo: 'archivo',
                    ...fileData
                });
                mostrarMensaje(`${files[i].name} subido correctamente`, 'success');
            } catch (error) {
                console.error('Error al subir archivo:', error);
                mostrarMensaje(`Error al subir ${files[i].name}`, 'error');
            }
        }
    }

    // Procesar URLs
    if (urlsInput.trim()) {
        const urls = urlsInput.split(',').map(url => url.trim());
        urls.forEach(url => {
            if (url) {
                anexos.push({
                    tipo: 'url',
                    nombre: url.split('/').pop() || 'enlace',
                    url: url,
                    fecha: new Date().toISOString()
                });
            }
        });
    }

    ocultarCarga();
    return anexos;
}

function mostrarPreviewAnexos() {
    const preview = document.getElementById('anexosPreview');
    const files = document.getElementById('fileInput').files;
    const urls = document.getElementById('urlAnexos').value;

    preview.innerHTML = '';

    // Mostrar preview de archivos seleccionados
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const reader = new FileReader();

        reader.onload = function(e) {
            const div = document.createElement('div');
            div.className = 'anexo-item';

            if (file.type.startsWith('image/')) {
                div.innerHTML = `<img src="${e.target.result}" alt="${file.name}" title="${file.name}">`;
            } else if (file.type === 'application/pdf') {
                div.innerHTML = `<div class="document" title="${file.name}"><i class="fas fa-file-pdf"></i></div>`;
            } else {
                div.innerHTML = `<div class="document" title="${file.name}"><i class="fas fa-file"></i></div>`;
            }

            preview.appendChild(div);
        };

        if (file.type.startsWith('image/')) {
            reader.readAsDataURL(file);
        }
    }

    // Mostrar preview de URLs
    if (urls.trim()) {
        const urlList = urls.split(',').map(u => u.trim());
        urlList.forEach(url => {
            if (url) {
                const div = document.createElement('div');
                div.className = 'anexo-link';
                div.innerHTML = `<i class="fas fa-link"></i><span title="${url}">${url.substring(0, 30)}...</span>`;
                preview.appendChild(div);
            }
        });
    }
}

// ============================================
// PARTE 5: CRUD DE SOLICITUDES (SUPABASE)
// ============================================

function validarFormulario() {
    const camposRequeridos = [
        'solicitanteNombre', 'solicitanteCargo', 'fechaSolicitud',
        'nombre', 'cedula', 'cargo', 'area', 'jefe',
        'fechasHechos', 'lugar', 'descripcion'
    ];

    for (const campoId of camposRequeridos) {
        const campo = document.getElementById(campoId);
        if (!campo || !campo.value.trim()) {
            mostrarMensaje('Todos los campos obligatorios deben ser completados', 'error');
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

    document.getElementById('anexosPreview').innerHTML = '';
}

async function guardarSolicitud(e) {
    e.preventDefault();

    if (!validarFormulario()) return;

    mostrarCarga("Guardando solicitud...");

    try {
        // Primero crear la solicitud sin anexos para obtener el ID
        const solicitudBase = {
            solicitante_nombre: document.getElementById('solicitanteNombre')?.value.trim() || '',
            solicitante_cargo: document.getElementById('solicitanteCargo')?.value.trim() || '',
            fecha_solicitud: document.getElementById('fechaSolicitud')?.value || '',
            trabajador_nombre: document.getElementById('nombre')?.value.trim() || '',
            trabajador_cedula: document.getElementById('cedula')?.value.trim() || '',
            trabajador_cargo: document.getElementById('cargo')?.value.trim() || '',
            trabajador_area: document.getElementById('area')?.value.trim() || '',
            trabajador_jefe: document.getElementById('jefe')?.value.trim() || '',
            hechos_fechas: document.getElementById('fechasHechos')?.value.trim() || '',
            hechos_lugar: document.getElementById('lugar')?.value.trim() || '',
            hechos_descripcion: document.getElementById('descripcion')?.value.trim() || '',
            hechos_info_adicional: document.getElementById('infoAdicional')?.value.trim() || '',
            estado: 'pendiente',
            fecha_registro: new Date().toISOString(),
            creado_por: currentUser ? currentUser.email : 'anónimo',
            anexos: [] // Inicialmente vacío
        };

        // Insertar en Supabase
        const { data: solicitudData, error: insertError } = await supabaseClient
            .from('solicitudes')
            .insert([solicitudBase])
            .select();

        if (insertError) throw insertError;

        const solicitudId = solicitudData[0].id;

        // Procesar anexos con el ID de la solicitud
        const anexos = await procesarAnexos(solicitudId);

        // Actualizar la solicitud con los anexos
        if (anexos.length > 0) {
            const { error: updateError } = await supabaseClient
                .from('solicitudes')
                .update({ anexos: anexos })
                .eq('id', solicitudId);

            if (updateError) throw updateError;
        }

        mostrarMensaje('Solicitud guardada correctamente', 'success');
        limpiarFormulario();

        // Recargar según la sección activa
        if (document.getElementById('admin-section')?.classList.contains('active') && currentUserRole === 'admin') {
            cargarRegistros();
        }
        if (document.getElementById('review-section')?.classList.contains('active') && (currentUserRole === 'revisor' || currentUserRole === 'admin')) {
            cargarRegistrosRevision();
        }

    } catch (error) {
        console.error('Error:', error);
        mostrarMensaje('Error al guardar: ' + error.message, 'error');
    } finally {
        ocultarCarga();
    }
}

async function cargarRegistros() {
    if (!currentUser || currentUserRole !== 'admin') return;

    mostrarCarga("Cargando registros...");

    try {
        const { data, error } = await supabaseClient
            .from('solicitudes')
            .select('*')
            .order('fecha_registro', { ascending: false });

        if (error) throw error;

        registros = data || [];
        areasDisponibles.clear();

        registros.forEach(registro => {
            if (registro.trabajador_area) {
                areasDisponibles.add(registro.trabajador_area);
            }
        });

        actualizarTablaAdmin();

    } catch (error) {
        console.error('Error:', error);
        mostrarMensaje('Error al cargar registros', 'error');
    } finally {
        ocultarCarga();
    }
}

async function cargarRegistrosRevision() {
    if (!currentUser || (currentUserRole !== 'revisor' && currentUserRole !== 'admin')) return;

    mostrarCarga("Cargando solicitudes para revisión...");

    try {
        const { data, error } = await supabaseClient
            .from('solicitudes')
            .select('*')
            .order('fecha_registro', { ascending: false });

        if (error) throw error;

        registros = data || [];
        actualizarTablaRevision();

    } catch (error) {
        console.error('Error:', error);
        mostrarMensaje('Error al cargar registros', 'error');
    } finally {
        ocultarCarga();
    }
}

function actualizarTablaAdmin() {
    const tbody = document.getElementById('adminBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (registros.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="empty-state"><i class="fas fa-inbox"></i><p>No hay solicitudes</p></td></tr>`;
        document.getElementById('adminTotalRecords').textContent = '0';
        document.getElementById('adminCountRecords').textContent = '0';
        return;
    }

    registros.forEach(registro => {
        const fecha = formatearFecha(registro.fecha_solicitud).split(',')[0];
        const estado = registro.estado || 'pendiente';
        const estadoClass = `status-badge status-${estado}`;

        const fila = document.createElement('tr');
        fila.innerHTML = `
            <td>${fecha}</td>
            <td>${escapeHTML(registro.trabajador_nombre || '')}</td>
            <td>${escapeHTML(registro.trabajador_cedula || '')}</td>
            <td>${escapeHTML(registro.trabajador_cargo || '')}</td>
            <td><span class="${estadoClass}">${estado}</span></td>
            <td>
            // Busca esta parte en actualizarTablaAdmin()
<div class="action-buttons">
    <button class="btn-icon view-btn" data-id="${registro.id}" title="Ver detalles">
        <i class="fas fa-eye"></i>
    </button>
    <button class="btn-icon edit-btn" data-id="${registro.id}" title="Editar">
        <i class="fas fa-edit"></i>
    </button>
    <button class="btn-icon download-btn" data-id="${registro.id}" title="Descargar PDF">
        <i class="fas fa-file-pdf"></i>
    </button>
    <button class="btn-icon warning sanction-btn" data-id="${registro.id}" title="Definir sanción">
        <i class="fas fa-gavel"></i>
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
    document.querySelectorAll('#adminBody .edit-btn').forEach(btn => {
    btn.addEventListener('click', () => mostrarModalEdicion(btn.dataset.id));
});
    document.querySelectorAll('#adminBody .view-btn').forEach(btn => {
        btn.addEventListener('click', () => mostrarDetalleRegistro(btn.dataset.id));
    });

    document.querySelectorAll('#adminBody .download-btn').forEach(btn => {
        btn.addEventListener('click', () => mostrarPreview(btn.dataset.id));
    });

    document.querySelectorAll('#adminBody .sanction-btn').forEach(btn => {
        btn.addEventListener('click', () => mostrarModalSanction(btn.dataset.id));
    });

    document.querySelectorAll('#adminBody .delete-btn').forEach(btn => {
        btn.addEventListener('click', () => eliminarRegistro(btn.dataset.id));
    });

    document.getElementById('adminTotalRecords').textContent = registros.length;
    document.getElementById('adminCountRecords').textContent = registros.length;
}

function actualizarTablaRevision() {
    const tbody = document.getElementById('reviewBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (registros.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="empty-state"><i class="fas fa-inbox"></i><p>No hay solicitudes</p></td></tr>`;
        return;
    }

    registros.forEach(registro => {
        const fecha = formatearFecha(registro.fecha_solicitud).split(',')[0];
        const estado = registro.estado || 'pendiente';
        const estadoClass = `status-badge status-${estado}`;

        const fila = document.createElement('tr');
        fila.innerHTML = `
            <td>${fecha}</td>
            <td>${escapeHTML(registro.trabajador_nombre || '')}</td>
            <td>${escapeHTML(registro.trabajador_cedula || '')}</td>
            <td>${escapeHTML(registro.trabajador_cargo || '')}</td>
            <td><span class="${estadoClass}">${estado}</span></td>
            <td>
                <div class="action-buttons">
                    <button class="btn-icon view-btn" data-id="${registro.id}" title="Ver detalles">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn-icon download-btn" data-id="${registro.id}" title="Descargar PDF">
                        <i class="fas fa-file-pdf"></i>
                    </button>
                    <button class="btn-icon primary review-btn" data-id="${registro.id}" title="Revisar">
                        <i class="fas fa-check-circle"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(fila);
    });

    document.querySelectorAll('#reviewBody .view-btn').forEach(btn => {
        btn.addEventListener('click', () => mostrarDetalleRegistro(btn.dataset.id));
    });

    document.querySelectorAll('#reviewBody .download-btn').forEach(btn => {
        btn.addEventListener('click', () => mostrarPreview(btn.dataset.id));
    });

    document.querySelectorAll('#reviewBody .review-btn').forEach(btn => {
        btn.addEventListener('click', () => mostrarModalReview(btn.dataset.id));
    });
}

async function eliminarRegistro(id) {
    if (!confirm('¿Está seguro de eliminar este registro?')) return;

    mostrarCarga("Eliminando registro...");

    try {
        // Primero obtener el registro para eliminar sus anexos
        const { data: registro } = await supabaseClient
            .from('solicitudes')
            .select('anexos')
            .eq('id', id)
            .single();

        // Eliminar anexos de Storage
        if (registro?.anexos) {
            for (const anexo of registro.anexos) {
                if (anexo.path) {
                    await supabaseClient.storage
                        .from('anexos')
                        .remove([anexo.path]);
                }
            }
        }

        // Eliminar registro de la base de datos
        const { error } = await supabaseClient
            .from('solicitudes')
            .delete()
            .eq('id', id);

        if (error) throw error;

        registros = registros.filter(r => r.id !== id);
        actualizarTablaAdmin();
        mostrarMensaje('Registro eliminado', 'success');

    } catch (error) {
        console.error('Error:', error);
        mostrarMensaje('Error al eliminar: ' + error.message, 'error');
    } finally {
        ocultarCarga();
    }
}
// ============================================
// FUNCIÓN DE EDICIÓN PARA ADMIN
// ============================================

async function editarRegistro(id, datosActualizados) {
    mostrarCarga("Actualizando registro...");
    
    try {
        const { error } = await supabaseClient
            .from('solicitudes')
            .update(datosActualizados)
            .eq('id', id);
        
        if (error) throw error;
        
        mostrarMensaje('Registro actualizado correctamente', 'success');
        cargarRegistros();
        
    } catch (error) {
        console.error('Error:', error);
        mostrarMensaje('Error al actualizar: ' + error.message, 'error');
    } finally {
        ocultarCarga();
    }
}

// Modal de edición para Admin
function mostrarModalEdicion(id) {
    const registro = registros.find(r => r.id === id);
    if (!registro) return;
    
    // Crear modal de edición
    const modalHtml = `
        <div class="modal-content" style="max-width: 600px;">
            <div class="modal-header">
                <h3><i class="fas fa-edit"></i> Editar Solicitud</h3>
                <button class="close-modal" onclick="cerrarModalEdicion()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                <form id="editarForm">
                    <div class="form-group">
                        <label>Nombre del trabajador</label>
                        <input type="text" id="editNombre" value="${escapeHTML(registro.trabajador_nombre || '')}" class="form-input">
                    </div>
                    <div class="form-group">
                        <label>Cédula</label>
                        <input type="text" id="editCedula" value="${escapeHTML(registro.trabajador_cedula || '')}" class="form-input">
                    </div>
                    <div class="form-group">
                        <label>Cargo</label>
                        <input type="text" id="editCargo" value="${escapeHTML(registro.trabajador_cargo || '')}" class="form-input">
                    </div>
                    <div class="form-group">
                        <label>Área</label>
                        <input type="text" id="editArea" value="${escapeHTML(registro.trabajador_area || '')}" class="form-input">
                    </div>
                    <div class="form-group">
                        <label>Descripción de los hechos</label>
                        <textarea id="editDescripcion" rows="4" class="form-textarea">${escapeHTML(registro.hechos_descripcion || '')}</textarea>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button class="btn btn-outline" onclick="cerrarModalEdicion()">
                    <i class="fas fa-times"></i> Cancelar
                </button>
                <button class="btn btn-primary" onclick="guardarEdicion('${id}')">
                    <i class="fas fa-save"></i> Guardar Cambios
                </button>
            </div>
        </div>
    `;
    
    // Mostrar modal
    const modalDiv = document.createElement('div');
    modalDiv.id = 'editarModal';
    modalDiv.className = 'modal';
    modalDiv.style.display = 'flex';
    modalDiv.innerHTML = modalHtml;
    document.body.appendChild(modalDiv);
}

function cerrarModalEdicion() {
    const modal = document.getElementById('editarModal');
    if (modal) modal.remove();
}

async function guardarEdicion(id) {
    const datosActualizados = {
        trabajador_nombre: document.getElementById('editNombre')?.value,
        trabajador_cedula: document.getElementById('editCedula')?.value,
        trabajador_cargo: document.getElementById('editCargo')?.value,
        trabajador_area: document.getElementById('editArea')?.value,
        hechos_descripcion: document.getElementById('editDescripcion')?.value
    };
    
    await editarRegistro(id, datosActualizados);
    cerrarModalEdicion();
}

// ============================================
// PARTE 6: REVISIÓN Y APROBACIÓN
// ============================================

function mostrarModalReview(id) {
    currentPreviewId = id;
    const modal = document.getElementById('reviewModal');
    if (modal) modal.style.display = 'flex';
}

function cerrarModalReview() {
    const modal = document.getElementById('reviewModal');
    if (modal) modal.style.display = 'none';
}

async function guardarRevision() {
    if (!currentPreviewId) return;

    const comentario = document.getElementById('reviewComentario').value;
    const decision = document.querySelector('input[name="reviewDecision"]:checked').value;

    mostrarCarga("Guardando revisión...");

    try {
        const revision = {
            comentario: comentario,
            fecha: new Date().toISOString(),
            revisor: currentUser.email,
            decision: decision
        };

        const { error } = await supabaseClient
            .from('solicitudes')
            .update({
                estado: decision,
                revision: revision
            })
            .eq('id', currentPreviewId);

        if (error) throw error;

        mostrarMensaje(`Solicitud ${decision === 'aprobado' ? 'aprobada' : 'rechazada'} correctamente`, 'success');
        cerrarModalReview();
        cargarRegistrosRevision();
        if (currentUserRole === 'admin') cargarRegistros();

    } catch (error) {
        console.error('Error:', error);
        mostrarMensaje('Error al guardar revisión: ' + error.message, 'error');
    } finally {
        ocultarCarga();
    }
}

// ============================================
// PARTE 7: ADMINISTRACIÓN Y SANCIONES
// ============================================

function mostrarModalSanction(id) {
    currentPreviewId = id;
    const modal = document.getElementById('sanctionModal');
    if (modal) modal.style.display = 'flex';
}

function cerrarModalSanction() {
    const modal = document.getElementById('sanctionModal');
    if (modal) modal.style.display = 'none';
}

async function guardarSanction() {
    if (!currentPreviewId) return;

    const sancion = {
        tipo: document.getElementById('sanctionTipo').value,
        descripcion: document.getElementById('sanctionDescripcion').value,
        fechaInicio: document.getElementById('sanctionFechaInicio').value,
        fechaFin: document.getElementById('sanctionFechaFin').value,
        fechaRegistro: new Date().toISOString(),
        admin: currentUser.email
    };

    if (!sancion.descripcion) {
        mostrarMensaje('Debe ingresar una descripción de la sanción', 'error');
        return;
    }

    mostrarCarga("Guardando sanción...");

    try {
        const { error } = await supabaseClient
            .from('solicitudes')
            .update({
                sancion: sancion,
                estado: 'sancionado'
            })
            .eq('id', currentPreviewId);

        if (error) throw error;

        mostrarMensaje('Sanción guardada correctamente', 'success');
        cerrarModalSanction();
        cargarRegistros();

    } catch (error) {
        console.error('Error:', error);
        mostrarMensaje('Error al guardar sanción: ' + error.message, 'error');
    } finally {
        ocultarCarga();
    }
}

// ============================================
// PARTE 8: GENERACIÓN DE PDF
// ============================================

function mostrarPreview(id) {
    currentPreviewId = id;
    const registro = registros.find(r => r.id === id);
    if (!registro) return;

    const plantilla = generarPlantillaRellenada(registro);
    const previewContent = document.getElementById('previewContent');
    const previewModal = document.getElementById('previewModal');

    if (previewContent) {
        previewContent.innerHTML = plantilla;
        setTimeout(() => {
            const plantillaElement = document.getElementById('plantillaPDF');
            if (plantillaElement) {
                plantillaElement.style.width = '210mm';
                plantillaElement.style.minHeight = '297mm';
                plantillaElement.style.padding = '10mm';
                plantillaElement.style.margin = '0 auto';
                plantillaElement.style.backgroundColor = '#ffffff';
            }
        }, 100);
    }

    if (previewModal) previewModal.style.display = 'flex';
}

function cerrarPreview() {
    const previewModal = document.getElementById('previewModal');
    if (previewModal) previewModal.style.display = 'none';
    currentPreviewId = null;
}

function generarPlantillaRellenada(registro) {
    const fechaSolicitud = formatearFecha(registro.fecha_solicitud).split(',')[0];

    // Adaptar los nombres de campos de Supabase al formato esperado
    const registroAdaptado = {
        solicitante: {
            nombre: registro.solicitante_nombre,
            cargo: registro.solicitante_cargo
        },
        fechaSolicitud: registro.fecha_solicitud,
        trabajador: {
            nombre: registro.trabajador_nombre,
            cedula: registro.trabajador_cedula,
            cargo: registro.trabajador_cargo,
            area: registro.trabajador_area,
            jefe: registro.trabajador_jefe
        },
        hechos: {
            fechas: registro.hechos_fechas,
            lugar: registro.hechos_lugar,
            descripcion: registro.hechos_descripcion,
            infoAdicional: registro.hechos_info_adicional
        },
        anexos: registro.anexos || [],
        estado: registro.estado,
        revision: registro.revision,
        sancion: registro.sancion,
        creadoPor: registro.creado_por
    };

    // Generar HTML de anexos
    let anexosHTML = '';
    if (registroAdaptado.anexos && registroAdaptado.anexos.length > 0) {
        registroAdaptado.anexos.forEach(anexo => {
            if (anexo.tipo === 'archivo' && anexo.url) {
                if (anexo.tipo?.startsWith('image/')) {
                    anexosHTML += `<img src="${anexo.url}" style="max-width:100px; max-height:100px; margin:5px; border:1px solid #ccc;">`;
                } else {
                    anexosHTML += `<div style="margin:5px;"><i class="fas fa-file"></i> <a href="${anexo.url}" target="_blank">${anexo.nombre}</a></div>`;
                }
            } else {
                anexosHTML += `<div style="margin:5px;"><i class="fas fa-link"></i> <a href="${anexo.url}" target="_blank">${anexo.nombre}</a></div>`;
            }
        });
    } else {
        anexosHTML = 'No se adjuntaron anexos';
    }

    // Generar HTML de sanción
    let sancionHTML = '';
    if (registroAdaptado.sancion) {
        sancionHTML = `
            <tr>
                <th colspan="2" style="border:1px solid #000; padding:4px; background:#d9d9d9; text-align:center; font-weight:bold;">6. SANCIÓN IMPUESTA</th>
            </tr>
            <tr>
                <td style="border:1px solid #000; padding:4px; width:30%;">Tipo de sanción:</td>
                <td style="border:1px solid #000; padding:4px;">${escapeHTML(registroAdaptado.sancion.tipo)}</td>
            </tr>
            <tr>
                <td style="border:1px solid #000; padding:4px;">Descripción:</td>
                <td style="border:1px solid #000; padding:4px;">${escapeHTML(registroAdaptado.sancion.descripcion).replace(/\n/g, '<br>')}</td>
            </tr>
            <tr>
                <td style="border:1px solid #000; padding:4px;">Fecha de inicio:</td>
                <td style="border:1px solid #000; padding:4px;">${registroAdaptado.sancion.fechaInicio || 'No especificada'}</td>
            </tr>
            <tr>
                <td style="border:1px solid #000; padding:4px;">Fecha de fin:</td>
                <td style="border:1px solid #000; padding:4px;">${registroAdaptado.sancion.fechaFin || 'No especificada'}</td>
            </tr>
            <tr>
                <td style="border:1px solid #000; padding:4px;">Impuesta por:</td>
                <td style="border:1px solid #000; padding:4px;">${escapeHTML(registroAdaptado.sancion.admin)} el ${formatearFecha(registroAdaptado.sancion.fechaRegistro)}</td>
            </tr>
        `;
    }

    const logoSvg = `
        <svg width="50" height="50" viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg">
            <rect width="50" height="50" fill="#1976D2" rx="8"/>
            <text x="25" y="38" font-size="28" text-anchor="middle" fill="white" font-family="Arial" font-weight="bold">⚖️</text>
        </svg>
    `;
    const logoDataURI = 'data:image/svg+xml,' + encodeURIComponent(logoSvg);

    return `
        <div class="preview-page" id="plantillaPDF" style="width:210mm; min-height:297mm; padding:10mm; margin:0 auto; background-color:white; font-family:Arial, sans-serif; font-size:12px; box-sizing:border-box;">
            <!-- ENCABEZADO -->
            <table style="width:100%; border-collapse:collapse; margin-bottom:6px; border:1px solid #000;">
                <tr>
                    <td style="border:1px solid #000; padding:4px; text-align:center; width:20%;">
                        <img src="${logoDataURI}" alt="Logo" style="height:50px;">
                    </td>
                    <td style="border:1px solid #000; padding:4px; text-align:center; font-weight:bold; width:60%;">
                        <strong>FORMATO DE SOLICITUD DE INICIO DE PROCESO DISCIPLINARIO</strong><br>
                        <strong>PROCESO: TALENTO HUMANO</strong>
                    </td>
                    <td style="border:1px solid #000; padding:4px; font-size:11px; width:20%;">
                        <strong>CODIGO:</strong> FT-TH-024<br>
                        <strong>VERSIÓN:</strong> 11<br>
                        <strong>FECHA:</strong> 09/01/2026<br>
                        <strong>PÁGINA:</strong> 1 de 1
                    </td>
                </tr>
            </table>

            <!-- DATOS DEL SOLICITANTE -->
            <table style="width:100%; border-collapse:collapse; margin-bottom:6px;">
                <tr>
                    <th colspan="2" style="border:1px solid #000; padding:4px; background:#d9d9d9; text-align:center; font-weight:bold;">DATOS DEL SOLICITANTE</th>
                </tr>
                <tr>
                    <td style="border:1px solid #000; padding:4px; width:30%;">Nombre:</td>
                    <td style="border:1px solid #000; padding:4px;">${escapeHTML(registroAdaptado.solicitante?.nombre || '')}</td>
                </tr>
                <tr>
                    <td style="border:1px solid #000; padding:4px;">Cargo:</td>
                    <td style="border:1px solid #000; padding:4px;">${escapeHTML(registroAdaptado.solicitante?.cargo || '')}</td>
                </tr>
                <tr>
                    <td style="border:1px solid #000; padding:4px;">Fecha de solicitud:</td>
                    <td style="border:1px solid #000; padding:4px;">${fechaSolicitud}</td>
                </tr>
            </table>

            <!-- DATOS DEL TRABAJADOR -->
            <table style="width:100%; border-collapse:collapse; margin-bottom:6px;">
                <tr>
                    <th colspan="2" style="border:1px solid #000; padding:4px; background:#d9d9d9; text-align:center; font-weight:bold;">1. DATOS DEL TRABAJADOR</th>
                </tr>
                <tr>
                    <td style="border:1px solid #000; padding:4px; width:30%;">Nombre completo:</td>
                    <td style="border:1px solid #000; padding:4px;">${escapeHTML(registroAdaptado.trabajador?.nombre || '')}</td>
                </tr>
                <tr>
                    <td style="border:1px solid #000; padding:4px;">Número de cédula:</td>
                    <td style="border:1px solid #000; padding:4px;">${escapeHTML(registroAdaptado.trabajador?.cedula || '')}</td>
                </tr>
                <tr>
                    <td style="border:1px solid #000; padding:4px;">Cargo:</td>
                    <td style="border:1px solid #000; padding:4px;">${escapeHTML(registroAdaptado.trabajador?.cargo || '')}</td>
                </tr>
                <tr>
                    <td style="border:1px solid #000; padding:4px;">Área / Dependencia:</td>
                    <td style="border:1px solid #000; padding:4px;">${escapeHTML(registroAdaptado.trabajador?.area || '')}</td>
                </tr>
                <tr>
                    <td style="border:1px solid #000; padding:4px;">Jefe inmediato:</td>
                    <td style="border:1px solid #000; padding:4px;">${escapeHTML(registroAdaptado.trabajador?.jefe || '')}</td>
                </tr>
            </table>

            <!-- HECHOS -->
            <table style="width:100%; border-collapse:collapse; margin-bottom:6px;">
                <tr>
                    <th colspan="2" style="border:1px solid #000; padding:4px; background:#d9d9d9; text-align:center; font-weight:bold;">2. DESCRIPCIÓN DE LOS HECHOS</th>
                </tr>
                <tr>
                    <td style="border:1px solid #000; padding:4px; width:30%;">Fecha(s) de ocurrencia:</td>
                    <td style="border:1px solid #000; padding:4px;">${escapeHTML(registroAdaptado.hechos?.fechas || '')}</td>
                </tr>
                <tr>
                    <td style="border:1px solid #000; padding:4px;">Lugar de ocurrencia:</td>
                    <td style="border:1px solid #000; padding:4px;">${escapeHTML(registroAdaptado.hechos?.lugar || '')}</td>
                </tr>
                <tr>
                    <td colspan="2" style="border:1px solid #000; padding:4px; height:90px;">
                        <strong>Descripción:</strong><br><br>
                        ${escapeHTML(registroAdaptado.hechos?.descripcion || '').replace(/\n/g, '<br>')}
                    </td>
                </tr>
                <tr>
                    <td colspan="2" style="border:1px solid #000; padding:4px; height:90px;">
                        <strong>Información adicional:</strong><br><br>
                        ${registroAdaptado.hechos?.infoAdicional ? escapeHTML(registroAdaptado.hechos.infoAdicional).replace(/\n/g, '<br>') : 'No aplica'}
                    </td>
                </tr>
            </table>

            <!-- ANEXOS -->
            <table style="width:100%; border-collapse:collapse; margin-bottom:6px;">
                <tr>
                    <th style="border:1px solid #000; padding:4px; background:#d9d9d9; text-align:center; font-weight:bold;">3. ANEXOS</th>
                </tr>
                <tr>
                    <td style="border:1px solid #000; padding:4px; height:100px;">
                        ${anexosHTML}
                    </td>
                </tr>
            </table>

            <!-- REVISIÓN -->
            <table style="width:100%; border-collapse:collapse; margin-bottom:6px;">
                <tr>
                    <th colspan="2" style="border:1px solid #000; padding:4px; background:#d9d9d9; text-align:center; font-weight:bold;">4. REVISIÓN</th>
                </tr>
                <tr>
                    <td style="border:1px solid #000; padding:4px; width:30%;">Estado:</td>
                    <td style="border:1px solid #000; padding:4px; text-transform:uppercase;">${registroAdaptado.estado || 'pendiente'}</td>
                </tr>
                ${registroAdaptado.revision ? `
                <tr>
                    <td style="border:1px solid #000; padding:4px;">Revisor:</td>
                    <td style="border:1px solid #000; padding:4px;">${escapeHTML(registroAdaptado.revision.revisor)}</td>
                </tr>
                <tr>
                    <td style="border:1px solid #000; padding:4px;">Comentario:</td>
                    <td style="border:1px solid #000; padding:4px;">${escapeHTML(registroAdaptado.revision.comentario) || 'Sin comentarios'}</td>
                </tr>
                <tr>
                    <td style="border:1px solid #000; padding:4px;">Fecha revisión:</td>
                    <td style="border:1px solid #000; padding:4px;">${formatearFecha(registroAdaptado.revision.fecha)}</td>
                </tr>
                ` : '<tr><td colspan="2" style="border:1px solid #000; padding:4px;">Pendiente de revisión</td></tr>'}
            </table>

            <!-- FIRMAS -->
            <table style="width:100%; border-collapse:collapse; margin-bottom:6px;">
                <tr>
                    <th colspan="2" style="border:1px solid #000; padding:4px; background:#d9d9d9; text-align:center; font-weight:bold;">5. FIRMAS</th>
                </tr>
                <tr>
                    <td style="border:1px solid #000; padding:4px; height:90px;">
                        Firma Jefe Inmediato:<br><br><br>
                        Nombre: ${escapeHTML(registroAdaptado.trabajador?.jefe || '')}<br>
                        Cargo: Jefe Inmediato<br>
                        Fecha: ${fechaSolicitud}
                    </td>
                    <td style="border:1px solid #000; padding:4px; height:90px;">
                        Firma Jefe Talento Humano:<br><br><br>
                        Nombre: _________________________<br>
                        Cargo: Jefe Talento Humano<br>
                        Fecha: _________________________
                    </td>
                </tr>
            </table>

            <!-- SANCIÓN (si existe) -->
            ${sancionHTML}

            <!-- PIE DE PÁGINA -->
            <div style="text-align: right; font-size: 10px; margin-top: 10px; color: #666;">
                <i class="fas fa-print"></i> Generado el ${new Date().toLocaleString()} por ${escapeHTML(registroAdaptado.creadoPor || 'sistema')}
            </div>
        </div>
    `;
}

function descargarPDF() {
    if (!currentPreviewId) return;

    const registro = registros.find(r => r.id === currentPreviewId);
    if (!registro) return;

    mostrarCarga("Generando PDF, por favor espere...");

    setTimeout(() => {
        const element = document.getElementById('plantillaPDF');

        if (!element) {
            ocultarCarga();
            mostrarMensaje('Error: No se pudo generar el PDF', 'error');
            return;
        }

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
            try {
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

                let pdfImgWidth = pageWidth - 20;
                let pdfImgHeight = pdfImgWidth / ratio;

                if (pdfImgHeight > pageHeight - 20) {
                    pdfImgHeight = pageHeight - 20;
                    pdfImgWidth = pdfImgHeight * ratio;
                }

                const xPos = (pageWidth - pdfImgWidth) / 2;
                const yPos = 10;

                const imgData = canvas.toDataURL('image/jpeg', 0.95);
                pdf.addImage(imgData, 'JPEG', xPos, yPos, pdfImgWidth, pdfImgHeight);

                const nombreArchivo = `Solicitud_${registro.trabajador_nombre?.replace(/[^a-z0-9]/gi, '_') || 'documento'}.pdf`;
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
            ocultarCarga();
            mostrarMensaje('Error al capturar la imagen: ' + error.message, 'error');
        });
    }, 500);
}

// ============================================
// PARTE 9: MODALES Y EVENTOS
// ============================================

function mostrarDetalleRegistro(id) {
    const registro = registros.find(r => r.id === id);
    if (!registro) return;

    currentPreviewId = id;

    // Adaptar para el modal
    const registroAdaptado = {
        solicitante: {
            nombre: registro.solicitante_nombre,
            cargo: registro.solicitante_cargo
        },
        fechaSolicitud: registro.fecha_solicitud,
        trabajador: {
            nombre: registro.trabajador_nombre,
            cedula: registro.trabajador_cedula,
            cargo: registro.trabajador_cargo,
            area: registro.trabajador_area,
            jefe: registro.trabajador_jefe
        },
        hechos: {
            fechas: registro.hechos_fechas,
            lugar: registro.hechos_lugar,
            descripcion: registro.hechos_descripcion,
            infoAdicional: registro.hechos_info_adicional
        },
        anexos: registro.anexos || [],
        estado: registro.estado,
        revision: registro.revision,
        sancion: registro.sancion,
        creadoPor: registro.creado_por,
        fechaRegistro: registro.fecha_registro
    };

    // Generar HTML de anexos para el modal
    let anexosHTML = '';
    if (registroAdaptado.anexos && registroAdaptado.anexos.length > 0) {
        registroAdaptado.anexos.forEach(anexo => {
            if (anexo.tipo === 'archivo' && anexo.url) {
                if (anexo.tipo?.startsWith('image/')) {
                    anexosHTML += `<a href="${anexo.url}" target="_blank" class="detail-anexo"><i class="fas fa-image"></i> ${anexo.nombre}</a>`;
                } else {
                    anexosHTML += `<a href="${anexo.url}" target="_blank" class="detail-anexo"><i class="fas fa-file-pdf"></i> ${anexo.nombre}</a>`;
                }
            } else {
                anexosHTML += `<a href="${anexo.url}" target="_blank" class="detail-anexo"><i class="fas fa-link"></i> ${anexo.nombre}</a>`;
            }
        });
    } else {
        anexosHTML = '<p class="text-secondary">No hay anexos</p>';
    }

    // HTML de sanción
    let sancionHTML = '';
    if (registroAdaptado.sancion) {
        sancionHTML = `
            <div class="detail-section">
                <div class="detail-section-title">
                    <i class="fas fa-gavel"></i>
                    Sanción Impuesta
                </div>
                <div class="sanction-card">
                    <div class="sanction-title">
                        <i class="fas fa-tag"></i>
                        ${escapeHTML(registroAdaptado.sancion.tipo)}
                    </div>
                    <p>${escapeHTML(registroAdaptado.sancion.descripcion)}</p>
                    <div class="sanction-dates">
                        <span><i class="fas fa-calendar"></i> Inicio: ${registroAdaptado.sancion.fechaInicio || 'N/A'}</span>
                        <span><i class="fas fa-calendar"></i> Fin: ${registroAdaptado.sancion.fechaFin || 'N/A'}</span>
                    </div>
                    <small>Impuesta por: ${escapeHTML(registroAdaptado.sancion.admin)} el ${formatearFecha(registroAdaptado.sancion.fechaRegistro)}</small>
                </div>
            </div>
        `;
    }

    const html = `
        <div class="detail-card">
            <div class="detail-section">
                <div class="detail-section-title">
                    <i class="fas fa-user"></i>
                    Solicitante
                </div>
                <div class="detail-grid">
                    <div class="detail-item">
                        <div class="detail-label">Nombre</div>
                        <div class="detail-value">${escapeHTML(registroAdaptado.solicitante?.nombre || '')}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Cargo</div>
                        <div class="detail-value">${escapeHTML(registroAdaptado.solicitante?.cargo || '')}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Fecha solicitud</div>
                        <div class="detail-value">${formatearFecha(registroAdaptado.fechaSolicitud)}</div>
                    </div>
                </div>
            </div>

            <div class="detail-section">
                <div class="detail-section-title">
                    <i class="fas fa-user-tie"></i>
                    Trabajador
                </div>
                <div class="detail-grid">
                    <div class="detail-item">
                        <div class="detail-label">Nombre</div>
                        <div class="detail-value">${escapeHTML(registroAdaptado.trabajador?.nombre || '')}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Cédula</div>
                        <div class="detail-value">${escapeHTML(registroAdaptado.trabajador?.cedula || '')}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Cargo</div>
                        <div class="detail-value">${escapeHTML(registroAdaptado.trabajador?.cargo || '')}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Área</div>
                        <div class="detail-value">${escapeHTML(registroAdaptado.trabajador?.area || '')}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Jefe</div>
                        <div class="detail-value">${escapeHTML(registroAdaptado.trabajador?.jefe || '')}</div>
                    </div>
                </div>
            </div>

            <div class="detail-section">
                <div class="detail-section-title">
                    <i class="fas fa-clock"></i>
                    Hechos
                </div>
                <div class="detail-grid">
                    <div class="detail-item">
                        <div class="detail-label">Fecha(s) ocurrencia</div>
                        <div class="detail-value">${escapeHTML(registroAdaptado.hechos?.fechas || '')}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Lugar</div>
                        <div class="detail-value">${escapeHTML(registroAdaptado.hechos?.lugar || '')}</div>
                    </div>
                </div>
                <div class="detail-description">
                    <strong>Descripción:</strong><br>
                    ${escapeHTML(registroAdaptado.hechos?.descripcion || '').replace(/\n/g, '<br>')}
                </div>
                ${registroAdaptado.hechos?.infoAdicional ? `
                <div class="detail-description" style="border-left-color: #ff9800; margin-top: 10px;">
                    <strong>Información adicional:</strong><br>
                    ${escapeHTML(registroAdaptado.hechos.infoAdicional).replace(/\n/g, '<br>')}
                </div>
                ` : ''}
            </div>

            <div class="detail-section">
                <div class="detail-section-title">
                    <i class="fas fa-paperclip"></i>
                    Anexos
                </div>
                <div class="detail-anexos">
                    ${anexosHTML}
                </div>
            </div>

            <div class="detail-section">
                <div class="detail-section-title">
                    <i class="fas fa-check-circle"></i>
                    Estado y Revisión
                </div>
                <div class="detail-grid">
                    <div class="detail-item">
                        <div class="detail-label">Estado</div>
                        <div class="detail-value">
                            <span class="status-badge status-${registroAdaptado.estado || 'pendiente'}">
                                ${registroAdaptado.estado || 'pendiente'}
                            </span>
                        </div>
                    </div>
                    ${registroAdaptado.revision ? `
                    <div class="detail-item">
                        <div class="detail-label">Revisor</div>
                        <div class="detail-value">${escapeHTML(registroAdaptado.revision.revisor)}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Fecha revisión</div>
                        <div class="detail-value">${formatearFecha(registroAdaptado.revision.fecha)}</div>
                    </div>
                    <div class="detail-item" style="grid-column: 1/-1;">
                        <div class="detail-label">Comentario</div>
                        <div class="detail-value">${escapeHTML(registroAdaptado.revision.comentario) || 'Sin comentarios'}</div>
                    </div>
                    ` : '<div class="detail-item"><div class="detail-value">Pendiente de revisión</div></div>'}
                </div>
            </div>

            ${sancionHTML}

            <div class="detail-section" style="background-color: #f8f9fa;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <div class="detail-label">Registrado por</div>
                        <div>${escapeHTML(registroAdaptado.creadoPor || 'anónimo')}</div>
                    </div>
                    <div>
                        <div class="detail-label">Fecha de registro</div>
                        <div>${formatearFecha(registroAdaptado.fechaRegistro)}</div>
                    </div>
                    <span class="detail-badge">ID: ${registro.id.substring(0, 8)}</span>
                </div>
            </div>
        </div>
    `;

    const modalBody = document.getElementById('detailModalBody');
    const modalFooter = document.getElementById('detailModalFooter');

    if (modalBody) modalBody.innerHTML = html;

    // Configurar botones del footer según rol
    if (modalFooter) {
        let footerButtons = `
            <button class="btn btn-outline" onclick="cerrarDetailModal()">
                <i class="fas fa-times"></i> Cerrar
            </button>
            <button class="btn btn-primary" onclick="mostrarPreview('${id}')">
                <i class="fas fa-file-pdf"></i> Descargar PDF
            </button>
        `;

        if (currentUserRole === 'admin') {
            footerButtons = `
                <button class="btn btn-outline" onclick="cerrarDetailModal()">
                    <i class="fas fa-times"></i> Cerrar
                </button>
                <button class="btn btn-warning" onclick="mostrarModalSanction('${id}')">
                    <i class="fas fa-gavel"></i> Definir Sanción
                </button>
                <button class="btn btn-primary" onclick="mostrarPreview('${id}')">
                    <i class="fas fa-file-pdf"></i> Descargar PDF
                </button>
            `;
        } else if (currentUserRole === 'revisor' && registroAdaptado.estado === 'pendiente') {
            footerButtons = `
                <button class="btn btn-outline" onclick="cerrarDetailModal()">
                    <i class="fas fa-times"></i> Cerrar
                </button>
                <button class="btn btn-primary" onclick="mostrarModalReview('${id}')">
                    <i class="fas fa-check-circle"></i> Revisar
                </button>
                <button class="btn btn-primary" onclick="mostrarPreview('${id}')">
                    <i class="fas fa-file-pdf"></i> Descargar PDF
                </button>
            `;
        }

        modalFooter.innerHTML = footerButtons;
    }

    const modal = document.getElementById('detailModal');
    if (modal) modal.style.display = 'flex';
}

function cerrarDetailModal() {
    const modal = document.getElementById('detailModal');
    if (modal) modal.style.display = 'none';
}

// ============================================
// PARTE 10: INICIALIZACIÓN
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('Inicializando aplicación con supabaseClient...');

    // Verificar Supabase
    if (typeof supabaseClient === 'undefined') {
        mostrarMensaje('Error: Supabase no está disponible', 'error');
        return;
    }

    // Configurar fecha actual
    const today = new Date().toISOString().split('T')[0];
    const fechaInput = document.getElementById('fechaSolicitud');
    if (fechaInput) fechaInput.value = today;

    // Navegación
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

            if (targetId === 'admin-section' && currentUserRole === 'admin') {
                cargarRegistros();
            } else if (targetId === 'review-section' && (currentUserRole === 'revisor' || currentUserRole === 'admin')) {
                cargarRegistrosRevision();
            }
        });
    });

    // Event listeners formulario
    document.getElementById('solicitudForm')?.addEventListener('submit', guardarSolicitud);
    document.getElementById('btnLimpiar')?.addEventListener('click', limpiarFormulario);

    // Preview de anexos
    document.getElementById('fileInput')?.addEventListener('change', mostrarPreviewAnexos);
    document.getElementById('urlAnexos')?.addEventListener('input', mostrarPreviewAnexos);

    // Búsqueda y filtros
    document.getElementById('adminSearchInput')?.addEventListener('input', filtrarAdmin);
    document.getElementById('adminAreaFilter')?.addEventListener('change', filtrarAdmin);
    document.getElementById('adminStatusFilter')?.addEventListener('change', filtrarAdmin);

    document.getElementById('reviewSearchInput')?.addEventListener('input', filtrarRevision);
    document.getElementById('reviewStatusFilter')?.addEventListener('change', filtrarRevision);

    // Modales
    document.getElementById('closeDetailModal')?.addEventListener('click', cerrarDetailModal);
    document.getElementById('closePreview')?.addEventListener('click', cerrarPreview);
    document.getElementById('closeLoginModal')?.addEventListener('click', cerrarLoginModal);
    document.getElementById('closeReviewModal')?.addEventListener('click', cerrarModalReview);
    document.getElementById('closeSanctionModal')?.addEventListener('click', cerrarModalSanction);

    // Botones de modales
    document.getElementById('submitReviewBtn')?.addEventListener('click', guardarRevision);
    document.getElementById('saveSanctionBtn')?.addEventListener('click', guardarSanction);
    document.getElementById('btnDownloadPDF')?.addEventListener('click', descargarPDF);

    // User menu
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
    document.getElementById('loginBtn')?.addEventListener('click', () => {
        mostrarLoginModal();
        userDropdown.classList.remove('show');
    });

    document.getElementById('logoutBtn')?.addEventListener('click', () => {
        cerrarSesion();
        userDropdown.classList.remove('show');
    });

    // Login form
    document.getElementById('loginForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail')?.value;
        const password = document.getElementById('loginPassword')?.value;
        if (email && password) {
            iniciarSesion(email, password);
        }
    });

    // Verificar sesión actual
    supabaseClient.auth.getSession().then(({ data: { session } }) => {
        actualizarUIUsuario(session?.user || null);
        if (session?.user) {
            cargarRegistros();
        }
    });

    // Escuchar cambios en la autenticación
    supabaseClient.auth.onAuthStateChange((event, session) => {
        actualizarUIUsuario(session?.user || null);
    });

    // Cerrar modales con click fuera
    window.addEventListener('click', (e) => {
        if (e.target === document.getElementById('loginModal')) cerrarLoginModal();
        if (e.target === document.getElementById('previewModal')) cerrarPreview();
        if (e.target === document.getElementById('detailModal')) cerrarDetailModal();
        if (e.target === document.getElementById('reviewModal')) cerrarModalReview();
        if (e.target === document.getElementById('sanctionModal')) cerrarModalSanction();
    });
});

// Funciones de filtrado
function filtrarAdmin() {
    const searchTerm = document.getElementById('adminSearchInput')?.value.toLowerCase() || '';
    const areaFilter = document.getElementById('adminAreaFilter')?.value || '';
    const statusFilter = document.getElementById('adminStatusFilter')?.value || '';

    const filas = document.querySelectorAll('#adminBody tr');
    let visibleCount = 0;

    filas.forEach(fila => {
        if (fila.classList.contains('empty-state')) return;

        const cells = fila.cells;
        if (cells.length < 6) return;

        const nombre = cells[1]?.textContent.toLowerCase() || '';
        const cedula = cells[2]?.textContent.toLowerCase() || '';
        const area = cells[4]?.textContent || '';
        const estado = cells[4]?.textContent.toLowerCase() || '';

        let coincide = true;

        if (searchTerm && !nombre.includes(searchTerm) && !cedula.includes(searchTerm)) {
            coincide = false;
        }

        if (areaFilter && area !== areaFilter) {
            coincide = false;
        }

        if (statusFilter && !estado.includes(statusFilter)) {
            coincide = false;
        }

        fila.style.display = coincide ? '' : 'none';
        if (coincide) visibleCount++;
    });

    document.getElementById('adminCountRecords').textContent = visibleCount;
}

function filtrarRevision() {
    const searchTerm = document.getElementById('reviewSearchInput')?.value.toLowerCase() || '';
    const statusFilter = document.getElementById('reviewStatusFilter')?.value || '';

    const filas = document.querySelectorAll('#reviewBody tr');
    let visibleCount = 0;

    filas.forEach(fila => {
        if (fila.classList.contains('empty-state')) return;

        const cells = fila.cells;
        if (cells.length < 6) return;

        const nombre = cells[1]?.textContent.toLowerCase() || '';
        const cedula = cells[2]?.textContent.toLowerCase() || '';
        const estado = cells[4]?.textContent.toLowerCase() || '';

        let coincide = true;

        if (searchTerm && !nombre.includes(searchTerm) && !cedula.includes(searchTerm)) {
            coincide = false;
        }

        if (statusFilter && !estado.includes(statusFilter)) {
            coincide = false;
        }

        fila.style.display = coincide ? '' : 'none';
        if (coincide) visibleCount++;
    });
}
