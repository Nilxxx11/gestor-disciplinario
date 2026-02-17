// config.js - Configuración de Firebase
// REEMPLAZA ESTOS VALORES CON LOS DE TU PROYECTO FIREBASE

const firebaseConfig = {
  apiKey: "AIzaSyA96D-qUxdG9NC9pQ-99jz7d3P776hgn8I",
  authDomain: "proceso-disciplinario.firebaseapp.com",
  projectId: "proceso-disciplinario",
  storageBucket: "proceso-disciplinario.firebasestorage.app",
  messagingSenderId: "679812242624",
  appId: "1:679812242624:web:ecfe0876d1c04993822125",
  measurementId: "G-K06VQSG1RK"
};

// Inicializar Firebase con la versión compat
firebase.initializeApp(firebaseConfig);

// Inicializar servicios
const database = firebase.database();
const auth = firebase.auth();

// Hacer disponible globalmente
window.database = database;
window.auth = auth;
