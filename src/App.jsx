// src/App.jsx
// Cerebro principal: routing, autenticación, carga de datos y orquestación.

import { useState, useEffect, useCallback } from "react";

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
import AlertasView, { generateAutoAlerts, getPendingPopupAlerts } from "./components/Alertas.jsx";

const FONTS_LINK = "https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@400;500;600;700&family=Work+Sans:wght@400;500;600;700;800&display=swap";

export default function App() {
  // ============================================================
  // ESTADO
  // ============================================================
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

  // Pop-up de alertas
  const [popupAlerts, setPopupAlerts] = useState([]);
  const [popupShown, setPopupShown] = useState(false);

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
        fetchTable("Alertas").catch(() => [])  // Si la tabla no existe, no rompe
      ]);
      setI(i);
      setG(g);
      setC(c);
      setT(t);
      setA(a);
    } catch (e) {
      console.error("Error cargando datos:", e);
      setLoadError(e.message || "Error cargando datos");
      // Si hay error de auth, deslogueamos
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

  // Calcular alertas pendientes para popup tras cargar datos
  useEffect(() => {
    if (!auth || loading || popupShown) return;

    const autoAlerts = generateAutoAlerts(ingresos, gastos, tramos);
    const pending = getPendingPopupAlerts(alertas, autoAlerts);

    if (pending.length > 0) {
      setPopupAlerts(pending);
      setPopupShown(true);
    }
  }, [auth, loading, ingresos, gastos, tramos, alertas, popupShown]);

  // Cerrar popup
  const closePopup = () => {
    setPopupAlerts([]);
  };

  // Cuando se marca una alerta manual como mostrada, refrescamos
  const onAlertDismissed = () => {
    load();
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
          <ErrorBox>
            {loadError}
          </ErrorBox>
          <div style={{ textAlign: "center", marginTop: 16 }}>
            <button
              onClick={() => load()}
              style={B.btn}
            >
              REINTENTAR
            </button>
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
            onRefresh={load}
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
  // En móvil/tablet portrait: el menú es un cajón overlay
  // En tablet landscape o más grande: puede estar siempre visible o colapsable
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

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
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
        {/* Overlay oscuro cuando el menú está abierto en móvil */}
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

        {/* SIDEBAR */}
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

        {/* CONTENIDO PRINCIPAL */}
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

      {/* POP-UP DE ALERTAS */}
      {popupAlerts.length > 0 && (
        <AlertPopup
          alertas={popupAlerts}
          onClose={closePopup}
          onDismissed={onAlertDismissed}
        />
      )}
    </div>
  );
}
