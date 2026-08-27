// src/App.jsx
// Cerebro principal: routing, autenticación, carga de datos, campanita, pop-up.
// REDISEÑO 2026: header con KanjiMark + sidebar overlay con iconos lucide.
// v2: botón ↻ Actualizar en header para reducir llamadas API a Airtable.
// v3 (AHORRO DE API):
//   - Carga inicial reducida a 3 tablas (Ingresos, Gastos, Alertas) en vez de 8.
//   - Tramos de Cotización cacheados en localStorage 30 días → 0 llamadas.
//   - Carga perezosa: Clientes, Gastos Fijos, Presupuestos y Proyectos se piden
//     solo al entrar en su sección, y se quedan en memoria.
//   - onRefresh quirúrgico: cada sección recarga SOLO sus tablas (2 en vez de 8).
// v4 (AHORRO DE API):
//   - Actualización local: tras crear/editar/borrar NO se recarga nada.
//     Se usa el registro que devuelve Airtable. Cada acción = 1 llamada.
// v5: Presupuestos vuelve a la carga inicial (lo necesita la alerta de
//     seguimiento comercial) y se pasa a generateAutoAlerts.

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Menu, X, Calendar, LogOut, Bell as BellIcon,
  LayoutDashboard, FileText, Users, Receipt, Repeat,
  Bell, Calculator, ShieldCheck, RefreshCw, Send, Briefcase
} from "lucide-react";

import { B, MENU } from "./utils.js";
import { useResponsive } from "./hooks/useResponsive.js";
import {
  isLoggedIn, logout,
  fetchTable
} from "./api.js";

import Login from "./components/Login.jsx";
import { LoadingScreen, ErrorBox, KanjiMark, Btn } from "./components/UI.jsx";
import AlertPopup from "./components/AlertPopup.jsx";
import Dashboard from "./components/Dashboard.jsx";
import FacturasView from "./components/Facturas.jsx";
import Clientes from "./components/Clientes.jsx";
import Presupuestos from "./components/Presupuestos.jsx";
import Proyectos from "./components/Proyectos.jsx";
import GastosView from "./components/Gastos.jsx";
import GastosFijos from "./components/GastosFijos.jsx";
import Simulador from "./components/Simulador.jsx";
import CuotaAut from "./components/CuotaAut.jsx";
import AlertasView, {
  generateAutoAlerts,
  getPendingAlerts,
  cleanupDismissed
} from "./components/Alertas.jsx";
import NotificationDropdown from "./components/NotificationDropdown.jsx";

const FONTS_LINK = "https://fonts.googleapis.com/css2?family=Work+Sans:wght@300;400;500;600;700;800&display=swap";
const POPUP_SHOWN_DATE_KEY = "ga_popup_shown_date";

// ============================================================
// AHORRO DE API — CONFIGURACIÓN
// ============================================================

// Tablas que SÍ se cargan al abrir la app (las necesita el dashboard y la campanita)
// Presupuestos entra aquí porque la alerta de seguimiento comercial tiene que
// poder saltar en la campanita nada más abrir la app.
const CORE_TABLES = ["Ingresos", "Gastos", "Alertas", "Presupuestos"];

// Qué tabla necesita cada sección. Se carga la primera vez que entras.
const PAGE_TABLES = {
  dashboard: [],
  facturas: ["Clientes"],
  clientes: ["Clientes"],
  presupuestos: [],
  proyectos: ["Proyectos", "Clientes"],
  gastos: ["Gastos Fijos"],
  gastosfijos: ["Gastos Fijos"],
  alertas: [],
  simulador: [],
  autonomo: ["Gastos Fijos"]
};

// Caché de Tramos de Cotización (datos oficiales, cambian 1 vez al año)
const TRAMOS_CACHE_KEY = "ga_tramos_cache";
const TRAMOS_TTL_DIAS = 30;

function leerTramosCache() {
  try {
    const raw = localStorage.getItem(TRAMOS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.records) || !parsed.ts) return null;
    const dias = (Date.now() - parsed.ts) / 86400000;
    if (dias > TRAMOS_TTL_DIAS) return null;
    return parsed.records;
  } catch {
    return null;
  }
}

function guardarTramosCache(records) {
  try {
    localStorage.setItem(
      TRAMOS_CACHE_KEY,
      JSON.stringify({ ts: Date.now(), records })
    );
  } catch {}
}

const MENU_ICONS = {
  LayoutDashboard,
  FileText,
  Users,
  Send,
  Briefcase,
  Receipt,
  Repeat,
  Bell,
  Calculator,
  ShieldCheck
};

// ============================================================
// COMPONENTE CAMPANITA
// ============================================================
function NotificationBell({ count, onClick, isMobile, active }) {
  return (
    <button
      data-bell-button
      onClick={onClick}
      title={count > 0 ? `${count} alerta${count > 1 ? "s" : ""} pendiente${count > 1 ? "s" : ""}` : "Sin alertas"}
      style={{
        background: active ? "#f4f4f4" : "transparent",
        border: "none",
        cursor: "pointer",
        padding: 8,
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 999,
        transition: "background 0.15s ease"
      }}
      aria-label="Notificaciones"
    >
      <BellIcon
        size={isMobile ? 18 : 20}
        strokeWidth={2}
        color={count > 0 ? B.ink : B.muted}
      />
      {count > 0 && (
        <span style={{
          position: "absolute",
          top: 2,
          right: 2,
          background: B.ink,
          color: "#fff",
          fontSize: 10,
          fontWeight: 700,
          fontFamily: B.font,
          minWidth: 17,
          height: 17,
          borderRadius: 999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 4px",
          border: `2px solid ${B.surface}`,
          boxSizing: "content-box",
          lineHeight: 1,
          ...B.num
        }}>
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  );
}

// ============================================================
// HELPERS POPUP
// ============================================================
function popupAlreadyShownToday() {
  try {
    const last = localStorage.getItem(POPUP_SHOWN_DATE_KEY);
    if (!last) return false;
    const today = new Date().toISOString().split("T")[0];
    return last === today;
  } catch {
    return false;
  }
}

function markPopupShownToday() {
  try {
    const today = new Date().toISOString().split("T")[0];
    localStorage.setItem(POPUP_SHOWN_DATE_KEY, today);
  } catch {}
}

// ============================================================
// APP
// ============================================================
export default function App() {
  const [auth, setAuth] = useState(() => isLoggedIn());
  const [page, setPage] = useState("dashboard");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [sectionLoading, setSectionLoading] = useState(false);

  const [ingresos, setI] = useState([]);
  const [gastos, setG] = useState([]);
  const [gastosFijos, setGF] = useState([]);
  const [clientes, setC] = useState([]);
  const [presupuestos, setP] = useState([]);
  const [proyectos, setPR] = useState([]);
  const [tramos, setT] = useState([]);
  const [alertas, setA] = useState([]);

  // Registro de qué tablas ya se han traído en esta sesión.
  // Es un ref (no estado) para que no re-dispare renders ni recree callbacks.
  const loadedRef = useRef({});

  const [salObj, setSalObj] = useState(() => {
    try { return Number(localStorage.getItem("ga_salario")) || 2500; }
    catch { return 2500; }
  });

  const [filtro, setFiltro] = useState({
    year: String(new Date().getFullYear()),
    tri: "",
    mes: ""
  });

  const [popupAlerts, setPopupAlerts] = useState([]);
  const [popupCheckedThisSession, setPopupCheckedThisSession] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [bellRefreshCounter, setBellRefreshCounter] = useState(0);

  const responsive = useResponsive();
  const { isMobile } = responsive;

  // ============================================================
  // MOTOR DE CARGA
  // ============================================================
  const SETTERS = useMemo(() => ({
    "Ingresos": setI,
    "Gastos": setG,
    "Clientes": setC,
    "Gastos Fijos": setGF,
    "Presupuestos": setP,
    "Proyectos": setPR,
    "Alertas": setA
  }), []);

  const handleFetchError = useCallback((e) => {
    console.error("Error cargando datos:", e);
    if (e && e.message && e.message.includes("autorizado")) {
      logout();
      setAuth(false);
    }
  }, []);

  // Trae las tablas indicadas y las vuelca en su estado correspondiente.
  const fetchInto = useCallback(async (tables) => {
    const unique = [...new Set(tables)].filter(t => SETTERS[t]);
    if (unique.length === 0) return;
    const results = await Promise.all(unique.map(t => fetchTable(t)));
    unique.forEach((t, i) => {
      SETTERS[t](results[i]);
      loadedRef.current[t] = true;
    });
  }, [SETTERS]);

  // Tramos: primero mira la caché del navegador. Solo llama a Airtable
  // si no hay caché o si ha caducado (30 días).
  const cargarTramos = useCallback(async (forzar = false) => {
    if (!forzar) {
      const cache = leerTramosCache();
      if (cache) {
        setT(cache);
        return;
      }
    }
    try {
      const t = await fetchTable("Tramos de Cotización");
      setT(t);
      guardarTramosCache(t);
    } catch (e) {
      console.warn("No se pudieron cargar los tramos:", e);
      const cache = leerTramosCache();
      if (cache) setT(cache);
    }
  }, []);

  // Carga inicial: solo lo imprescindible.
  const loadCore = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      await fetchInto(CORE_TABLES);
      await cargarTramos();
    } catch (e) {
      setLoadError(e.message || "Error cargando datos");
      handleFetchError(e);
    }
    setLoading(false);
  }, [fetchInto, cargarTramos, handleFetchError]);

  useEffect(() => { if (auth) loadCore(); }, [auth, loadCore]);

  // Recarga silenciosa de tablas concretas (lo usan los onRefresh de cada sección)
  const reload = useCallback(async (tables) => {
    setRefreshing(true);
    try {
      await fetchInto(tables);
    } catch (e) {
      handleFetchError(e);
    }
    setRefreshing(false);
  }, [fetchInto, handleFetchError]);

  // ============================================================
  // CARGA PEREZOSA POR SECCIÓN
  // ============================================================
  useEffect(() => {
    if (!auth || loading) return;
    const needed = (PAGE_TABLES[page] || []).filter(t => !loadedRef.current[t]);
    if (needed.length === 0) return;

    let cancelado = false;
    setSectionLoading(true);
    fetchInto(needed)
      .catch(e => { if (!cancelado) handleFetchError(e); })
      .finally(() => { if (!cancelado) setSectionLoading(false); });

    return () => { cancelado = true; };
  }, [page, auth, loading, fetchInto, handleFetchError]);

  const refreshLocal = useCallback(() => {
    setBellRefreshCounter(c => c + 1);
  }, []);

  // Botón ↻ del header: recarga SOLO lo que ya se había cargado en esta sesión.
  const refreshAll = useCallback(async () => {
    const cargadas = Object.keys(loadedRef.current);
    await reload(cargadas.length ? cargadas : CORE_TABLES);
    refreshLocal();
  }, [reload, refreshLocal]);

  // ============================================================
  // REFRESCOS QUIRÚRGICOS POR SECCIÓN
  // Cada uno recarga solo las tablas que esa pantalla puede tocar.
  // ============================================================
  const refreshFacturas = useCallback(() => reload(["Ingresos", "Clientes"]), [reload]);
  const refreshClientes = useCallback(() => reload(["Clientes", "Ingresos"]), [reload]);
  const refreshPresupuestos = useCallback(() => reload(["Presupuestos"]), [reload]);
  const refreshProyectos = useCallback(() => reload(["Proyectos", "Clientes"]), [reload]);
  const refreshGastos = useCallback(() => reload(["Gastos", "Gastos Fijos"]), [reload]);
  const refreshGastosFijos = useCallback(() => reload(["Gastos Fijos", "Gastos"]), [reload]);
  const refreshAlertas = useCallback(async () => {
    await reload(["Alertas"]);
    refreshLocal();
  }, [reload, refreshLocal]);

  // ============================================================
  // ACTUALIZACIÓN LOCAL (0 llamadas a Airtable)
  // Airtable ya devuelve el registro completo al crear/editar, con las
  // fórmulas (IVA, IRPF, Total) ya recalculadas. Lo metemos directamente
  // en la lista que hay en pantalla en vez de volver a pedir la tabla.
  // ============================================================

  // Inserta el registro si es nuevo, o lo sustituye si ya estaba.
  const upsertLocal = useCallback((table, record) => {
    const setter = SETTERS[table];
    if (!setter || !record || !record.id) return;
    setter(prev => {
      const existe = prev.some(r => r.id === record.id);
      return existe
        ? prev.map(r => (r.id === record.id ? record : r))
        : [...prev, record];
    });
  }, [SETTERS]);

  // Quita el registro de la lista.
  const removeLocal = useCallback((table, id) => {
    const setter = SETTERS[table];
    if (!setter || !id) return;
    setter(prev => prev.filter(r => r.id !== id));
  }, [SETTERS]);

  // Marca una tabla como "caducada": se volverá a pedir la próxima vez
  // que entres en su sección. Se usa cuando una operación cambia un
  // vínculo de otra tabla (p. ej. crear una factura cambia el cliente).
  const invalidate = useCallback((table) => {
    delete loadedRef.current[table];
  }, []);

  // ============================================================
  // ALERTAS PENDIENTES
  // ============================================================
  const cuotaActual = (() => {
    try { return Number(localStorage.getItem("ga_cuota")) || 294; } catch { return 294; }
  })();

  const pendingAlerts = useMemo(() => {
    if (!auth || loading) return [];
    void bellRefreshCounter;
    const autoAlerts = generateAutoAlerts(ingresos, gastos, tramos, cuotaActual, presupuestos);
    return getPendingAlerts(alertas, autoAlerts);
  }, [auth, loading, ingresos, gastos, tramos, alertas, presupuestos, cuotaActual, bellRefreshCounter]);

  useEffect(() => {
    if (!auth || loading) return;
    const allAutos = generateAutoAlerts(ingresos, gastos, tramos, cuotaActual, presupuestos, { ignoreDismissed: true });
    const activeFingerprints = {};
    allAutos.forEach(a => { activeFingerprints[a.id] = a.fingerprint; });
    cleanupDismissed(activeFingerprints);
  }, [auth, loading, ingresos, gastos, tramos, presupuestos, cuotaActual]);

  useEffect(() => {
    if (!auth || loading || popupCheckedThisSession) return;
    setPopupCheckedThisSession(true);
    if (popupAlreadyShownToday()) return;
    if (pendingAlerts.length === 0) return;
    setPopupAlerts(pendingAlerts);
    markPopupShownToday();
  }, [auth, loading, popupCheckedThisSession, pendingAlerts]);

  const bellCount = pendingAlerts.length;
  const closePopup = () => setPopupAlerts([]);
  const onAlertDismissed = async () => { await refreshAlertas(); };

  // ============================================================
  // RENDERS DE BLOQUEO
  // ============================================================
  if (!auth) {
    return <Login onLogin={() => setAuth(true)} />;
  }

  if (loading) {
    return <LoadingScreen message="Cargando tu negocio…" />;
  }

  if (loadError) {
    return (
      <div style={{
        minHeight: "100vh",
        background: B.bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        fontFamily: B.font
      }}>
        <link href={FONTS_LINK} rel="stylesheet" />
        <div style={{ maxWidth: 480, width: "100%" }}>
          <ErrorBox>{loadError}</ErrorBox>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 16 }}>
            <Btn onClick={() => loadCore()}>Reintentar</Btn>
            <Btn variant="outline" onClick={() => { logout(); setAuth(false); }}>
              Cerrar sesión
            </Btn>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================
  // RENDER DE LA SECCIÓN ACTIVA
  // ============================================================
  const renderPage = () => {
    // Mientras se trae por primera vez la tabla de esta sección
    const pendientes = (PAGE_TABLES[page] || []).filter(t => !loadedRef.current[t]);
    if (sectionLoading && pendientes.length > 0) {
      return (
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          padding: "80px 20px",
          color: B.muted,
          fontFamily: B.font,
          fontSize: 13,
          fontWeight: 500
        }}>
          <RefreshCw
            size={16}
            strokeWidth={2}
            style={{ animation: "spin 1s linear infinite" }}
          />
          Cargando…
        </div>
      );
    }

    switch (page) {
      case "dashboard":
        return (
          <Dashboard
            ingresos={ingresos} gastos={gastos} tramos={tramos} alertas={alertas}
            salObj={salObj} setSalObj={setSalObj}
            filtro={filtro} setFiltro={setFiltro}
          />
        );
      case "facturas":
        return (
          <FacturasView
            ingresos={ingresos} clientes={clientes} onRefresh={refreshFacturas}
            onUpsert={upsertLocal} onRemove={removeLocal} onInvalidate={invalidate}
            filtro={filtro} setFiltro={setFiltro}
          />
        );
      case "clientes":
        return (
          <Clientes
            clientes={clientes} ingresos={ingresos} onRefresh={refreshClientes}
            onUpsert={upsertLocal} onRemove={removeLocal} onInvalidate={invalidate}
          />
        );
      case "presupuestos":
        return <Presupuestos presupuestos={presupuestos} onRefresh={refreshPresupuestos} />;
      case "proyectos":
        return <Proyectos proyectos={proyectos} clientes={clientes} onRefresh={refreshProyectos} />;
      case "gastos":
        return (
          <GastosView
            gastos={gastos} gastosFijos={gastosFijos} onRefresh={refreshGastos}
            filtro={filtro} setFiltro={setFiltro}
          />
        );
      case "gastosfijos":
        return <GastosFijos gastosFijos={gastosFijos} gastos={gastos} onRefresh={refreshGastosFijos} />;
      case "alertas":
        return (
          <AlertasView
            alertas={alertas} ingresos={ingresos} gastos={gastos} tramos={tramos}
            presupuestos={presupuestos}
            onRefresh={refreshAlertas}
          />
        );
      case "simulador":
        return <Simulador />;
      case "autonomo":
        return (
          <CuotaAut
            ingresos={ingresos} gastos={gastos}
            gastosFijos={gastosFijos} tramos={tramos}
          />
        );
      default:
        return (
          <Dashboard
            ingresos={ingresos} gastos={gastos} tramos={tramos} alertas={alertas}
            salObj={salObj} setSalObj={setSalObj}
            filtro={filtro} setFiltro={setFiltro}
          />
        );
    }
  };

  // ============================================================
  // LAYOUT PRINCIPAL
  // ============================================================
  return (
    <div style={{
      fontFamily: B.font,
      color: B.ink,
      minHeight: "100vh",
      background: B.bg,
      position: "relative"
    }}>
      <link href={FONTS_LINK} rel="stylesheet" />
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      {/* HEADER */}
      <header style={{
        background: B.surface,
        borderBottom: `1px solid ${B.border}`,
        padding: isMobile ? "12px 16px" : "14px 28px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        position: "sticky",
        top: 0,
        zIndex: 50,
        height: 60,
        boxSizing: "border-box",
        gap: 12
      }}>
        {/* IZQUIERDA: hamburguesa + logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          <button
            onClick={() => setOpen(!open)}
            aria-label="Abrir menú"
            style={{
              background: "transparent",
              border: "none",
              color: B.ink,
              cursor: "pointer",
              padding: 4,
              display: "flex",
              alignItems: "center"
            }}
          >
            <Menu size={20} strokeWidth={2} />
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <KanjiMark size={isMobile ? 22 : 26} />
            <span style={{
              fontSize: isMobile ? 13 : 14,
              fontWeight: 700,
              fontFamily: B.font,
              letterSpacing: "-0.01em",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis"
            }}>
              Gestión Autónomo
            </span>
          </div>
        </div>

        {/* DERECHA: fecha + botón actualizar + campanita + salir */}
        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 4 : 10 }}>
          {!isMobile && (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              color: B.muted,
              fontWeight: 500,
              whiteSpace: "nowrap"
            }}>
              <Calendar size={13} strokeWidth={2} />
              <span style={{ textTransform: "capitalize" }}>
                {new Date().toLocaleDateString("es-ES", {
                  weekday: "long",
                  day: "numeric",
                  month: "long"
                })}
              </span>
            </div>
          )}

          {/* BOTÓN ACTUALIZAR ↻ — recarga silenciosa sin pantalla de carga */}
          <button
            onClick={refreshAll}
            disabled={refreshing}
            title="Actualizar datos"
            aria-label="Actualizar"
            style={{
              background: "transparent",
              border: "none",
              cursor: refreshing ? "not-allowed" : "pointer",
              padding: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 999,
              opacity: refreshing ? 0.4 : 1,
              transition: "opacity 0.15s ease"
            }}
          >
            <RefreshCw
              size={isMobile ? 16 : 18}
              strokeWidth={2}
              color={B.muted}
              style={{ animation: refreshing ? "spin 1s linear infinite" : "none" }}
            />
          </button>

          <NotificationBell
            count={bellCount}
            isMobile={isMobile}
            active={dropdownOpen}
            onClick={() => setDropdownOpen(!dropdownOpen)}
          />

          <Btn
            variant="outline"
            size="sm"
            icon={LogOut}
            onClick={() => { logout(); setAuth(false); }}
          >
            {isMobile ? "" : "Salir"}
          </Btn>
        </div>
      </header>

      {/* SIDEBAR BACKDROP */}
      <div
        onClick={() => setOpen(false)}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.4)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "opacity 0.2s ease",
          zIndex: 90
        }}
      />

      {/* SIDEBAR */}
      <aside style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: 280,
        maxWidth: "85vw",
        height: "100vh",
        background: B.surface,
        borderRight: `1px solid ${B.border}`,
        transform: open ? "translateX(0)" : "translateX(-100%)",
        transition: "transform 0.25s ease",
        zIndex: 100,
        display: "flex",
        flexDirection: "column",
        padding: 20,
        boxSizing: "border-box"
      }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 28,
          padding: "0 4px"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <KanjiMark size={28} />
            <span style={{
              fontSize: 14,
              fontWeight: 700,
              fontFamily: B.font,
              letterSpacing: "-0.01em"
            }}>
              Gestión Autónomo
            </span>
          </div>
          <button
            onClick={() => setOpen(false)}
            aria-label="Cerrar"
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: 4,
              color: B.ink,
              display: "flex",
              alignItems: "center"
            }}
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {MENU.map(m => {
            const Icon = MENU_ICONS[m.iconName] || LayoutDashboard;
            const active = page === m.id;
            return (
              <button
                key={m.id}
                onClick={() => { setPage(m.id); setOpen(false); }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "11px 14px",
                  borderRadius: 12,
                  border: "none",
                  background: active ? B.ink : "transparent",
                  color: active ? "#fff" : B.ink,
                  fontFamily: B.font,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "background 0.15s ease",
                  whiteSpace: "nowrap"
                }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "#f4f4f4"; }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
              >
                <Icon size={16} strokeWidth={1.75} />
                {m.label}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* MAIN */}
      <main style={{
        padding: isMobile ? "20px 16px 48px" : "28px 32px 48px",
        maxWidth: responsive.isDesktopXL ? 1400 : 1080,
        margin: "0 auto",
        width: "100%",
        boxSizing: "border-box"
      }}>
        {renderPage()}
      </main>

      {/* POP-UP DE ALERTAS */}
      {popupAlerts.length > 0 && (
        <AlertPopup
          alertas={popupAlerts}
          onClose={closePopup}
          onDismissed={onAlertDismissed}
        />
      )}

      {/* DROPDOWN CAMPANITA */}
      {dropdownOpen && (
        <NotificationDropdown
          alertas={pendingAlerts}
          onClose={() => setDropdownOpen(false)}
          onGoToAlerts={() => setPage("alertas")}
          onChange={refreshAlertas}
        />
      )}
    </div>
  );
}
