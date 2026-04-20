// src/App.jsx
// Cerebro principal: routing, autenticación, carga de datos, campanita, pop-up.

import { useState, useEffect, useCallback, useMemo } from "react";

import { B, MENU } from "./utils.js";
import { useResponsive } from "./hooks/useResponsive.js";
import {
  isLoggedIn, logout,
  fetchTable
} from "./api.js";

import Login from "./components/Login.jsx";
import { LoadingScreen, ErrorBox } from "./components/UI.jsx";
import AlertPopup from "./components/AlertPopup.jsx";
import Dashboard from "./components/Dashboard.jsx";
import FacturasView from "./components/Facturas.jsx";
import Clientes from "./components/Clientes.jsx";
import GastosView from "./components/Gastos.jsx";
import Simulador from "./components/Simulador.jsx";
import CuotaAut from "./components/CuotaAut.jsx";
import AlertasView, {
  generateAutoAlerts,
  getPendingAlerts,
  cleanupDismissed
} from "./components/Alertas.jsx";
import NotificationDropdown from "./components/NotificationDropdown.jsx";

const FONTS_LINK = "https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@400;500;600;700&family=Work+Sans:wght@400;500;600;700;800&display=swap";

const POPUP_SHOWN_DATE_KEY = "ga_popup_shown_date";

// ============================================================
// COMPONENTE CAMPANITA
// ============================================================
function NotificationBell({ count, maxPriority, onClick, isMobile, active }) {
  const badgeColor = maxPriority === "Alta" ? B.red
    : maxPriority === "Media" ? B.amber
    : B.muted;

  return (
    <button
      data-bell-button
      onClick={onClick}
      title={count > 0 ? `${count} alerta${count > 1 ? "s" : ""} pendiente${count > 1 ? "s" : ""}` : "Sin alertas"}
      style={{
        background: active ? "rgba(0,0,0,0.06)" : "transparent",
        border: "none",
        cursor: "pointer",
        padding: 6,
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 6,
        transition: "background 0.15s ease"
      }}
      aria-label="Notificaciones"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke={count > 0 ? B.text : B.muted}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ width: isMobile ? 20 : 22, height: isMobile ? 20 : 22 }}
      >
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>

      {count > 0 && (
        <span style={{
          position: "absolute",
          top: 0,
          right: 0,
          background: badgeColor,
          color: "#fff",
          fontSize: 10,
          fontWeight: 700,
          fontFamily: B.tM,
          minWidth: 18,
          height: 18,
          borderRadius: 9,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 5px",
          border: "2px solid rgba(255,255,255,0.9)",
          boxSizing: "content-box",
          lineHeight: 1
        }}>
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  );
}

// ============================================================
// HELPER: ¿el popup ya se mostró hoy en este dispositivo?
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

  const [ingresos, setI] = useState([]);
  const [gastos, setG] = useState([]);
  const [clientes, setC] = useState([]);
  const [tramos, setT] = useState([]);
  const [alertas, setA] = useState([]);

  const [salObj, setSalObj] = useState(() => {
    try { return Number(localStorage.getItem("ga_salario")) || 2500; }
    catch { return 2500; }
  });

  const [filtro, setFiltro] = useState({
    year: String(new Date().getFullYear()),
    tri: "",
    mes: ""
  });

  // Pop-up y dropdown
  const [popupAlerts, setPopupAlerts] = useState([]);
  const [popupCheckedThisSession, setPopupCheckedThisSession] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Contador de "refresh" para forzar re-render cuando cambian los descartes locales
  const [bellRefreshCounter, setBellRefreshCounter] = useState(0);

  const responsive = useResponsive();
  const { isMobile, isPhoneOrSmallTablet } = responsive;

  // ============================================================
  // CARGA DE DATOS
  // ============================================================
  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [i, g, c, t, a] = await Promise.all([
        fetchTable("Ingresos"),
        fetchTable("Gastos"),
        fetchTable("Clientes"),
        fetchTable("Tramos de Cotización"),
        fetchTable("Alertas").catch(() => [])
      ]);
      setI(i);
      setG(g);
      setC(c);
      setT(t);
      setA(a);
    } catch (e) {
      console.error("Error cargando datos:", e);
      setLoadError(e.message || "Error cargando datos");
      if (e.message && e.message.includes("autorizado")) {
        logout();
        setAuth(false);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (auth) load();
  }, [auth, load]);

  // Refresco que también actualiza el contador de la campana (sin re-cargar de Airtable)
  const refreshLocal = useCallback(() => {
    setBellRefreshCounter(c => c + 1);
  }, []);

  // Refresco completo tras marcar una alerta: recargamos Airtable Y actualizamos contador
  const refreshAll = useCallback(async () => {
    await load();
    refreshLocal();
  }, [load, refreshLocal]);

  // ============================================================
  // CALCULAR ALERTAS PENDIENTES (para campana y popup)
  // ============================================================
  const cuotaActual = (() => {
    try { return Number(localStorage.getItem("ga_cuota")) || 294; } catch { return 294; }
  })();

  const pendingAlerts = useMemo(() => {
    if (!auth || loading) return [];
    // bellRefreshCounter: dependencia artificial para forzar recálculo cuando se marca una alerta como leída
    void bellRefreshCounter;
    const autoAlerts = generateAutoAlerts(ingresos, gastos, tramos, cuotaActual);
    return getPendingAlerts(alertas, autoAlerts);
  }, [auth, loading, ingresos, gastos, tramos, alertas, cuotaActual, bellRefreshCounter]);

  // Limpiar descartes antiguos (huellas que ya no existen) al cargar
  useEffect(() => {
    if (!auth || loading) return;
    // Recalculamos TODAS las automáticas ignorando descartes, para saber las huellas vivas
    const allAutos = generateAutoAlerts(ingresos, gastos, tramos, cuotaActual, { ignoreDismissed: true });
    const activeFingerprints = {};
    allAutos.forEach(a => {
      activeFingerprints[a.id] = a.fingerprint;
    });
    cleanupDismissed(activeFingerprints);
  }, [auth, loading, ingresos, gastos, tramos, cuotaActual]);

  // Disparar pop-up una vez al día (solo la primera carga de la sesión)
  useEffect(() => {
    if (!auth || loading || popupCheckedThisSession) return;
    setPopupCheckedThisSession(true);

    if (popupAlreadyShownToday()) return;
    if (pendingAlerts.length === 0) return;

    setPopupAlerts(pendingAlerts);
    markPopupShownToday();
  }, [auth, loading, popupCheckedThisSession, pendingAlerts]);

  // ============================================================
  // INFO DE LA CAMPANA (contador y prioridad máxima)
  // ============================================================
  const bellInfo = useMemo(() => {
    let maxPriority = "Baja";
    for (const a of pendingAlerts) {
      if (a.prioridad === "Alta") { maxPriority = "Alta"; break; }
      if (a.prioridad === "Media" && maxPriority !== "Alta") maxPriority = "Media";
    }
    return { count: pendingAlerts.length, maxPriority };
  }, [pendingAlerts]);

  const closePopup = () => setPopupAlerts([]);
  const onAlertDismissed = async () => {
    await refreshAll();
  };

  // ============================================================
  // RENDERS DE BLOQUEO
  // ============================================================
  if (!auth) {
    return <Login onLogin={() => setAuth(true)} />;
  }

  if (loading) {
    return <LoadingScreen message="Cargando datos..." />;
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
        fontFamily: B.tS
      }}>
        <link href={FONTS_LINK} rel="stylesheet" />
        <div style={{ maxWidth: 480, width: "100%" }}>
          <ErrorBox>{loadError}</ErrorBox>
          <div style={{ textAlign: "center", marginTop: 16 }}>
            <button onClick={() => load()} style={B.btn}>REINTENTAR</button>
            <button
              onClick={() => { logout(); setAuth(false); }}
              style={{
                ...B.btn,
                marginLeft: 10,
                background: "transparent",
                color: B.text,
                border: `2px solid ${B.text}`
              }}
            >
              CERRAR SESIÓN
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================
  // RENDER DE LA SECCIÓN ACTIVA
  // ============================================================
  const renderPage = () => {
    switch (page) {
      case "dashboard":
        return (
          <Dashboard
            ingresos={ingresos}
            gastos={gastos}
            tramos={tramos}
            alertas={alertas}
            salObj={salObj}
            setSalObj={setSalObj}
            filtro={filtro}
            setFiltro={setFiltro}
          />
        );
      case "facturas":
        return (
          <FacturasView
            ingresos={ingresos}
            clientes={clientes}
            onRefresh={load}
            filtro={filtro}
            setFiltro={setFiltro}
          />
        );
      case "clientes":
        return (
          <Clientes
            clientes={clientes}
            ingresos={ingresos}
            onRefresh={load}
          />
        );
      case "gastos":
        return (
          <GastosView
            gastos={gastos}
            onRefresh={load}
            filtro={filtro}
            setFiltro={setFiltro}
          />
        );
      case "alertas":
        return (
          <AlertasView
            alertas={alertas}
            ingresos={ingresos}
            gastos={gastos}
            tramos={tramos}
            onRefresh={refreshAll}
          />
        );
      case "simulador":
        return <Simulador />;
      case "autonomo":
        return (
          <CuotaAut
            ingresos={ingresos}
            gastos={gastos}
            tramos={tramos}
          />
        );
      default:
        return (
          <Dashboard
            ingresos={ingresos}
            gastos={gastos}
            tramos={tramos}
            alertas={alertas}
            salObj={salObj}
            setSalObj={setSalObj}
            filtro={filtro}
            setFiltro={setFiltro}
          />
        );
    }
  };

  // ============================================================
  // LAYOUT PRINCIPAL
  // ============================================================
  const sidebarOverlay = isPhoneOrSmallTablet;
  const sidebarWidth = open ? 240 : 0;

  return (
    <div style={{
      fontFamily: B.tS,
      color: B.text,
      minHeight: "100vh",
      background: B.bg,
      position: "relative"
    }}>
      <link href={FONTS_LINK} rel="stylesheet" />

      {/* HEADER */}
      <header style={{
        background: "rgba(255,255,255,0.82)",
        backdropFilter: "blur(16px)",
        borderBottom: `1px solid ${B.border}`,
        padding: isMobile ? "12px 16px" : "14px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        position: "sticky",
        top: 0,
        zIndex: 100,
        gap: 12
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
          <button
            onClick={() => setOpen(!open)}
            style={{
              background: "none",
              border: "none",
              color: B.text,
              cursor: "pointer",
              padding: 4,
              display: "flex"
            }}
            aria-label="Abrir menú"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: 22, height: 22 }}>
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <span style={{
            fontSize: isMobile ? 13 : 15,
            fontWeight: 700,
            fontFamily: B.tM,
            textTransform: "uppercase",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis"
          }}>
            Gestión Autónomo
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 8 : 16 }}>
          {!isMobile && (
            <span style={{ fontSize: 12, color: B.muted, whiteSpace: "nowrap" }}>
              {new Date().toLocaleDateString("es-ES", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric"
              })}
            </span>
          )}

          {/* CAMPANITA → ABRE DROPDOWN */}
          <NotificationBell
            count={bellInfo.count}
            maxPriority={bellInfo.maxPriority}
            isMobile={isMobile}
            active={dropdownOpen}
            onClick={() => setDropdownOpen(!dropdownOpen)}
          />

          <button
            onClick={() => { logout(); setAuth(false); }}
            style={{
              ...B.btn,
              padding: isMobile ? "6px 12px" : "8px 16px",
              fontSize: isMobile ? 10 : 11,
              background: "transparent",
              color: B.muted,
              border: `1px solid ${B.border}`
            }}
          >
            SALIR
          </button>
        </div>
      </header>

      {/* LAYOUT */}
      <div style={{ display: "flex", position: "relative" }}>
        {sidebarOverlay && open && (
          <div
            onClick={() => setOpen(false)}
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(0,0,0,0.4)",
              zIndex: 90,
              backdropFilter: "blur(2px)"
            }}
          />
        )}

        <nav style={{
          width: sidebarWidth,
          overflow: "hidden",
          background: "rgba(255,255,255,0.95)",
          backdropFilter: "blur(16px)",
          borderRight: `1px solid ${B.border}`,
          transition: "width 0.3s ease",
          minHeight: sidebarOverlay ? "100vh" : "calc(100vh - 56px)",
          flexShrink: 0,
          position: sidebarOverlay ? "fixed" : "static",
          top: sidebarOverlay ? 0 : "auto",
          left: 0,
          zIndex: sidebarOverlay ? 95 : "auto",
          paddingTop: sidebarOverlay ? 64 : 0
        }}>
          <div style={{
            padding: "20px 14px",
            display: "flex",
            flexDirection: "column",
            gap: 4
          }}>
            {MENU.map(m => (
              <button
                key={m.id}
                onClick={() => { setPage(m.id); setOpen(false); }}
                style={{
                  display: "block",
                  padding: "12px 16px",
                  borderRadius: 6,
                  border: "none",
                  background: page === m.id ? B.text : "transparent",
                  color: page === m.id ? "#fff" : B.text,
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: "pointer",
                  width: "100%",
                  textAlign: "left",
                  fontFamily: B.tM,
                  letterSpacing: "0.06em",
                  whiteSpace: "nowrap"
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
        </nav>

        <main style={{
          flex: 1,
          padding: isMobile ? 16 : 28,
          maxWidth: responsive.isDesktopXL ? 1400 : 920,
          margin: "0 auto",
          width: "100%",
          boxSizing: "border-box"
        }}>
          {renderPage()}
        </main>
      </div>

      {/* POP-UP DE ALERTAS (solo una vez al día) */}
      {popupAlerts.length > 0 && (
        <AlertPopup
          alertas={popupAlerts}
          onClose={closePopup}
          onDismissed={onAlertDismissed}
        />
      )}

      {/* DROPDOWN DE LA CAMPANITA */}
      {dropdownOpen && (
        <NotificationDropdown
          alertas={pendingAlerts}
          onClose={() => setDropdownOpen(false)}
          onGoToAlerts={() => setPage("alertas")}
          onChange={refreshAll}
        />
      )}
    </div>
  );
}
