// ══════════════════════════════════════════════════════
// GOLFEADOS — Config & State
// ══════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════
// VERSIÓN — cambia este número cada vez que subas cambios
// ══════════════════════════════════════════════════════
const APP_VERSION = '4.5.3';

// ══════════════════════════════════════════════════════
// DEV MODE DETECTION
// ══════════════════════════════════════════════════════
const IS_DEV = location.hostname.includes('--dev') || location.hostname.includes('golfeados-dev') || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
if (IS_DEV) {
  document.addEventListener('DOMContentLoaded', () => {
    const banner = document.getElementById('devBanner');
    if (banner) { banner.textContent = 'MODO DESARROLLO'; banner.classList.add('visible'); }
  });
}

// ══════════════════════════════════════════════════════
// FIREBASE CONFIG
// ══════════════════════════════════════════════════════
const firebaseConfig = {
  apiKey:            "AIzaSyCu98_7auFGd3nJJmYDRCM7KaM5OdtCBx4",
  authDomain:        "golfeados-660b3.firebaseapp.com",
  projectId:         "golfeados-660b3",
  storageBucket:     "golfeados-660b3.firebasestorage.app",
  messagingSenderId: "417996522021",
  appId:             "1:417996522021:web:67871e33758befec81f5cc"
};
firebase.initializeApp(firebaseConfig);
const auth    = firebase.auth();
const db      = firebase.firestore();
const storage = firebase.storage();

// Handle Google redirect result (fires after page reloads from Google auth)
// Google auth uses popup (more reliable on mobile)

// ══════════════════════════════════════════════════════
// ESTADO GLOBAL
// ══════════════════════════════════════════════════════
let STATE = {
  user:null, profile:null,
  torneo:null,          // legacy single-torneo (kept for compatibility)
  torneos:[],           // filtered torneos (user's torneos)
  allTorneos:[],        // all platform torneos (for participant discovery)
  jugadores:[], jugadores_by_torneo:{}, jugadores_global:[], partidas:[], resultados:[], clubes:[],
  jornadas:[],
  linked_jugador_ids:new Set(),  // ALL jugador IDs linked to this user (for multi-torneo vincular)
  users_cache:{},               // Cache of user profiles by uid (for admin to enrich jugador data)
  currentTab:'dashboard', cargarJornadaId:null,
  expandedJornada:null, expandedTorneo:null,
  expandedJornadaMT:null,  // partida expanded inside Mis Torneos
  chartInstance:null, editingJornadaId:null,
  activeTorneoId:null,  // torneo being viewed in detail
  unsubs:[],
  // ── Wallet ──
  wallet:null,                // { balance, creado, actualizado }
  myTransactions:[],          // user's own transactions
  walletConfig:null,          // app_config/wallet document
  // ── Admin Wallet ──
  allTransactions:[],         // admin: all transactions
  pagoMovilPendientes:[],     // admin: pending pago movil recharges
  // ── Admin Users ──
  allUsers:[],                // admin: all user profiles
  // ── Inscripciones ──
  inscripciones:[]            // tournament inscriptions
};
