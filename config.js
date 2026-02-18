// config.js - Archivo JavaScript puro

// Configuración de Supabase - REEMPLAZA CON TUS DATOS
const SUPABASE_URL = 'https://bvynfqxrdlfeofoftukl.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_se1VRWJQgqflk49m9lBg4g_fR3VItlC';

// Verificar que supabase está disponible
if (typeof supabase === 'undefined') {
    console.error('❌ Supabase JS no está cargado. Verifica el CDN en index.html');
} else {
    // Crear cliente de Supabase
    const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Exponer globalmente
    window.supabaseClient = supabaseClient;
    window.SUPABASE_URL = SUPABASE_URL;
    window.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;

    console.log('✅ Supabase configurado correctamente');
}
