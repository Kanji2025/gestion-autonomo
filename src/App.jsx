// src/App.jsx
// Cerebro principal: routing, autenticación, carga de datos, campanita, pop-up.
// REDISEÑO 2026: header con KanjiMark + sidebar overlay con iconos lucide.

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Menu, X, Calendar, LogOut, Bell as BellIcon,
  LayoutDashboard, FileText, Users, Receipt, Repeat,
  Bell, Calculator, ShieldCheck
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

// Mapa de iconos lucide para cada item del MENU
const MENU_ICONS = {
  LayoutDashboard,
  FileText,
  Users,
  Receipt,
  Repeat,
  Bell,
  Calculator,
  ShieldCheck
};

// ============================================================
// COMPONENTE CAMPANITA — refinado con lucide Bell + badge negro
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

  const [ingresos, setI] = useState([]);
  const [gastos, setG] = useState([]);
  const [gastosFijos, setGF] = useState([]);
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

  const [popupAlerts, setPopupAlerts] = useState([]);
  const [popupCheckedThisSession, setPopupCheckedThisSession] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [bellRefreshCounter, setBellRefreshCounter] = useState(0);

  const responsive = useResponsive();
  const { isMobile } = responsive;

  // ============================================================
  // CARGA DE DATOS
  // ============================================================
  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [i, g, c, t, a, gf] = await Promise.all([
        fetchTable("Ingresos"),
        fetchTable("Gastos"),
        fetchTable("Clientes"),
        fetchTable("Tramos de Cotización"),
        fetchTable("Alertas").catch(() => []),
        fetchTable("Gastos Fijos").catch(() => [])
      ]);
      setI(i); setG(g); setC(c); setT(t); setA(a); setGF(gf);
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

  useEffect(() => { if (auth) load(); }, [auth, load]);

  const refreshLocal = useCallback(() => {
    setBellRefreshCounter(c => c + 1);
  }, []);

  const refreshAll = useCallback(async () => {
    await load();
    refreshLocal();
  }, [load, refreshLocal]);

  // ============================================================
  // ALERTAS PENDIENTES
  // ============================================================
  const cuotaActual = (() => {
    try { return Number(localStorage.getItem("ga_cuota")) || 294; } catch { return 294; }
  })();

  const pendingAlerts = useMemo(() => {
    if (!auth || loading) return [];
    void bellRefreshCounter;
    const autoAlerts = generateAutoAlerts(ingresos, gastos, tramos, cuotaActual);
    return getPendingAlerts(alertas, autoAlerts);
  }, [auth, loading, ingresos, gastos, tramos, alertas, cuotaActual, bellRefreshCounter]);

  useEffect(() => {
    if (!auth || loading) return;
    const allAutos = generateAutoAlerts(ingresos, gastos, tramos, cuotaActual, { ignoreDismissed: true });
    const activeFingerprints = {};
    allAutos.forEach(a => { activeFingerprints[a.id] = a.fingerprint; });
    cleanupDismissed(activeFingerprints);
  }, [auth, loading, ingresos, gastos, tramos, cuotaActual]);

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
  const onAlertDismissed = async () => { await refreshAll(); };

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
            <Btn onClick={() => load()}>Reintentar</Btn>
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
            ingresos={ingresos} clientes={clientes} onRefresh={load}
            filtro={filtro} setFiltro={setFiltro}
          />
        );
      case "clientes":
        return <Clientes clientes={clientes} ingresos={ingresos} onRefresh={load} />;
      case "gastos":
        return (
          <GastosView
            gastos={gastos} gastosFijos={gastosFijos} onRefresh={load}
            filtro={filtro} setFiltro={setFiltro}
          />
        );
      case "gastosfijos":
        return <GastosFijos gastosFijos={gastosFijos} gastos={gastos} onRefresh={load} />;
      case "alertas":
        return (
          <AlertasView
            alertas={alertas} ingresos={ingresos} gastos={gastos} tramos={tramos}
            onRefresh={refreshAll}
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

      {/* HEADER — fondo sólido blanco con KanjiMark */}
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

        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 6 : 12 }}>
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

      {/* SIDEBAR OVERLAY + BACKDROP */}
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
          onChange={refreshAll}
        />
      )}
    </div>
  );
}
