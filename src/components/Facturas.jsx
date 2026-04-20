// src/components/Facturas.jsx
// Lista de facturas + botón para abrir el formulario de nueva factura/gasto.

import { useState, useMemo } from "react";
import { B, fmt, applyF } from "../utils.js";
import { useResponsive } from "../hooks/useResponsive.js";
import { deleteRecord } from "../api.js";
import { Card, Lbl, Sem, FilterBar, SectionHeader } from "./UI.jsx";
import NuevoForm from "./NuevoForm.jsx";

// ============================================================
// LISTA DE FACTURAS
// ============================================================
function ListaFacturas({ ingresos, clientes, filtro, setFiltro, onDelete }) {
  const { isMobile } = useResponsive();
  const [search, setSearch] = useState("");
  const [estadoFilter, setEstadoFilter] = useState("");
  const [delId, setDelId] = useState(null);

  const fi = applyF(ingresos, filtro);

  const enriched = useMemo(() => {
    const clientMap = {};
    clientes.forEach(c => { clientMap[c.id] = c.fields["Nombre"] || "Sin nombre"; });

    return fi.map(f => {
      const cIds = f.fields["Cliente"] || [];
      const clienteName = cIds.length > 0 ? (clientMap[cIds[0]] || "Cliente desconocido") : "—";
      return {
        id: f.id,
        numero: f.fields["Nº Factura"] || "—",
        fecha: f.fields["Fecha"] || "",
        clienteName,
        base: f.fields["Base Imponible"] || 0,
        irpf: f.fields["IRPF (€)"] || 0,
        estado: f.fields["Estado"] || "Pendiente"
      };
    }).filter(f => {
      if (estadoFilter && f.estado !== estadoFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!f.numero.toLowerCase().includes(s) &&
            !f.clienteName.toLowerCase().includes(s)) return false;
      }
      return true;
    }).sort((a, b) => {
      if (!a.fecha) return 1;
      if (!b.fecha) return -1;
      return b.fecha.localeCompare(a.fecha);
    });
  }, [fi, clientes, search, estadoFilter]);

  const totalBase = enriched.reduce((s, f) => s + f.base, 0);

  const del = async (id) => {
    if (!confirm("¿Borrar esta factura?")) return;
    setDelId(id);
    try {
      await deleteRecord("Ingresos", id);
      await onDelete();
    } catch (e) {
      alert("Error al borrar: " + e.message);
    }
    setDelId(null);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <FilterBar filtro={filtro} setFiltro={setFiltro} />

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <input
          type="text"
          placeholder="Buscar número o cliente..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            ...B.inp,
            maxWidth: isMobile ? "100%" : 280,
            padding: "10px 14px",
            fontSize: 13
          }}
        />
        <select
          value={estadoFilter}
          onChange={e => setEstadoFilter(e.target.value)}
          style={{ ...B.inp, width: "auto", padding: "10px 14px", fontSize: 13, fontFamily: B.tM }}
        >
          <option value="">Todos los estados</option>
          <option value="Cobrada">Cobradas</option>
          <option value="Pendiente">Pendientes</option>
          <option value="Vencida">Vencidas</option>
        </select>
        <span style={{
          fontSize: 12,
          color: B.muted,
          fontFamily: B.tM,
          marginLeft: "auto"
        }}>
          {enriched.length} facturas · {fmt(totalBase)}
        </span>
      </div>

      {enriched.length === 0 && (
        <Card>
          <p style={{ color: B.muted, fontFamily: B.tS, margin: 0 }}>
            No hay facturas que coincidan con los filtros.
          </p>
        </Card>
      )}

      {enriched.map(f => (
        <div
          key={f.id}
          style={{
            background: B.card,
            backdropFilter: "blur(14px)",
            borderRadius: 8,
            padding: "14px 18px",
            border: `1px solid ${B.border}`,
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap"
          }}
        >
          <div style={{ minWidth: 100 }}>
            <div style={{ fontWeight: 700, fontFamily: B.tM, fontSize: 13 }}>{f.numero}</div>
            <div style={{ fontSize: 11, color: B.muted }}>{f.fecha}</div>
          </div>
          <div style={{ flex: 1, minWidth: 140 }}>
            <div style={{ fontSize: 13, fontFamily: B.tS }}>{f.clienteName}</div>
          </div>
          <div style={{ textAlign: "right", minWidth: 80 }}>
            <div style={{ fontWeight: 700, fontFamily: B.tM }}>{fmt(f.base)}</div>
            {f.irpf > 0 && (
              <div style={{ fontSize: 11, color: B.red, fontWeight: 600 }}>
                IRPF: {fmt(f.irpf)}
              </div>
            )}
          </div>
          <Sem estado={f.estado} />
          <button
            onClick={() => del(f.id)}
            disabled={delId === f.id}
            style={{ ...B.btnDel, opacity: delId === f.id ? 0.5 : 1 }}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================
export default function FacturasView({ ingresos, clientes, onRefresh, filtro, setFiltro }) {
  const [view, setView] = useState("lista");

  if (view === "nueva") {
    return (
      <NuevoForm
        defaultTipo="ingreso"
        lockTipo={false}
        onClose={() => { setView("lista"); onRefresh(); }}
        onSaved={() => { onRefresh(); }}
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <SectionHeader
        title="Facturas"
        action={
          <button onClick={() => setView("nueva")} style={B.btn}>
            + NUEVA
          </button>
        }
      />
      <ListaFacturas
        ingresos={ingresos}
        clientes={clientes}
        filtro={filtro}
        setFiltro={setFiltro}
        onDelete={onRefresh}
      />
    </div>
  );
}
