// src/components/GastosFijos.jsx
// Vista de Gastos Fijos. REDISEÑO 2026 paleta marca completa.
// LÓGICA INTACTA: prorrateo fiscal (Deducible/Cuota SS/No deducible), baja/reactivar, edición.

import { useState } from "react";
import {
  Repeat, Calendar, CheckCircle2, Building2, AlertCircle,
  Wallet, Receipt, Clock, StickyNote, Edit3, Pause, Play,
  Trash2, ChevronDown, ChevronRight, X, Check
} from "lucide-react";

import { B, fmt, hoy } from "../utils.js";
import { useResponsive } from "../hooks/useResponsive.js";
import { updateRecord, deleteRecord } from "../api.js";
import {
  Card, Lbl, Inp, Sel, TxtArea, PageHeader, Btn, IconPill, ErrorBox
} from "./UI.jsx";

const PERIODICIDADES = ["Mensual", "Trimestral", "Anual"];
const MONEDAS = ["EUR", "USD", "GBP"];
const TIPOS = ["Deducible", "Cuota SS", "No deducible"];

// Icono según tipo fiscal
function iconForTipo(tipo) {
  if (tipo === "Cuota SS") return Building2;
  if (tipo === "No deducible") return AlertCircle;
  return CheckCircle2;
}

// ============================================================
// CALCULADORA DE PRORRATEO POR TIPO (LÓGICA INTACTA)
// ============================================================
function calcularProrrateoMensual(gastosFijos) {
  let deducible = 0;
  let cuotaSS = 0;
  let noDeducible = 0;

  for (const gf of (gastosFijos || [])) {
    if (gf.fields["Activa"] === "No") continue;
    const importe = gf.fields["Importe Medio"] || 0;
    const periodicidad = gf.fields["Periodicidad"] || "Mensual";
    const tipo = gf.fields["Tipo"] || "Deducible";

    const mensual = periodicidad === "Mensual" ? importe
      : periodicidad === "Trimestral" ? importe / 3
      : periodicidad === "Anual" ? importe / 12
      : 0;

    if (tipo === "Cuota SS") cuotaSS += mensual;
    else if (tipo === "No deducible") noDeducible += mensual;
    else deducible += mensual;
  }

  return { deducible, cuotaSS, noDeducible, total: deducible + cuotaSS + noDeducible };
}

// ============================================================
// CHIP DE STAT (estilo coherente)
// ============================================================
function StatChip({ icon: Icon, children }) {
  return (
    <div style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 5,
      padding: "4px 10px",
      background: "#fff",
      border: `1px solid ${B.border}`,
      borderRadius: 999,
      fontSize: 11,
      fontWeight: 500,
      fontFamily: B.font,
      color: B.ink,
      ...B.num
    }}>
      <Icon size={11} strokeWidth={2} />
      {children}
    </div>
  );
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================
export default function GastosFijos({ gastosFijos, gastos, onRefresh }) {
  const { isMobile, formColumns } = useResponsive();
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [bajaModal, setBajaModal] = useState(null);
  const [showInactivos, setShowInactivos] = useState(false);
  const [err, setErr] = useState("");

  // Enriquecer con estadísticas
  const enriquecer = (gf) => {
    const gastosLink = gf.fields["Gastos"] || [];
    const gastosVinculados = gastos.filter(g => gastosLink.includes(g.id));
    const totalPagado = gastosVinculados.reduce((s, g) =>
      s + (g.fields["Base Imponible"] || 0) + (g.fields["IVA Soportado (€)"] || 0), 0);
    const numPagos = gastosVinculados.length;
    const ultimaFecha = gastosVinculados
      .map(g => g.fields["Fecha"])
      .filter(Boolean)
      .sort()
      .pop() || null;
    const importeMedio = numPagos > 0 ? totalPagado / numPagos : (gf.fields["Importe Medio"] || 0);

    return {
      ...gf,
      _stats: { totalPagado, numPagos, ultimaFecha, importeMedio }
    };
  };

  const enriquecidos = gastosFijos.map(enriquecer);
  const activos = enriquecidos.filter(g => g.fields["Activa"] === "Sí" || !g.fields["Activa"]);
  const inactivos = enriquecidos.filter(g => g.fields["Activa"] === "No");

  const prorrateo = calcularProrrateoMensual(gastosFijos);

  // ============================================================
  // EDICIÓN
  // ============================================================
  const startEdit = (gf) => {
    setErr("");
    setEditId(gf.id);
    setEditForm({
      nombre: gf.fields["Nombre"] || "",
      proveedor: gf.fields["Proveedor"] || "",
      cifProveedor: gf.fields["CIF Proveedor"] || "",
      periodicidad: gf.fields["Periodicidad"] || "Mensual",
      importe: String(gf.fields["Importe Medio"] || ""),
      moneda: gf.fields["Moneda"] || "EUR",
      notas: gf.fields["Notas"] || "",
      tipo: gf.fields["Tipo"] || "Deducible"
    });
    setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 50);
  };

  const cancelEdit = () => {
    setEditId(null);
    setEditForm(null);
    setErr("");
  };

  const updateField = (field, value) => {
    setEditForm(prev => prev ? { ...prev, [field]: value } : null);
  };

  const saveEdit = async () => {
    if (!editForm.nombre.trim() || !editForm.proveedor.trim()) {
      setErr("Nombre y proveedor son obligatorios");
      return;
    }
    setSavingEdit(true);
    try {
      const fields = {
        "Nombre": editForm.nombre.trim(),
        "Proveedor": editForm.proveedor.trim(),
        "Periodicidad": editForm.periodicidad,
        "Importe Medio": Number(editForm.importe) || 0,
        "Moneda": editForm.moneda,
        "Tipo": editForm.tipo || "Deducible"
      };
      if (editForm.cifProveedor.trim()) fields["CIF Proveedor"] = editForm.cifProveedor.trim();
      if (editForm.notas.trim()) fields["Notas"] = editForm.notas.trim();

      await updateRecord("Gastos Fijos", editId, fields);
      cancelEdit();
      await onRefresh();
    } catch (e) {
      setErr("Error al guardar: " + e.message);
    }
    setSavingEdit(false);
  };

  // ============================================================
  // BAJA / REACTIVAR
  // ============================================================
  const confirmarBaja = async () => {
    const { id, accion } = bajaModal;
    try {
      const fields = {
        "Activa": accion === "baja" ? "No" : "Sí"
      };
      if (accion === "baja") {
        fields["Fecha Baja"] = hoy();
      }
      await updateRecord("Gastos Fijos", id, fields);
      setBajaModal(null);
      await onRefresh();
    } catch (e) {
      alert("Error: " + e.message);
    }
  };

  // ============================================================
  // BORRAR PERMANENTEMENTE
  // ============================================================
  const borrarPermanentemente = async (gf) => {
    const nombre = gf.fields["Nombre"] || gf.fields["Proveedor"] || "este gasto fijo";
    const confirm1 = confirm(`¿Seguro que quieres BORRAR PERMANENTEMENTE «${nombre}»?\n\nEsto eliminará el Gasto Fijo de la base de datos. Los gastos individuales asociados quedarán sin enlace, pero NO se borran.`);
    if (!confirm1) return;
    const confirm2 = confirm(`Última confirmación:\n\n¿Borrar «${nombre}»? Esta acción NO se puede deshacer.`);
    if (!confirm2) return;
    try {
      await deleteRecord("Gastos Fijos", gf.id);
      await onRefresh();
    } catch (e) {
      alert("Error al borrar: " + e.message);
    }
  };

  // ============================================================
  // RENDER DE CADA TARJETA
  // ============================================================
  const renderGastoFijo = (gf, esActivo) => {
    const stats = gf._stats;
    const periodicidad = gf.fields["Periodicidad"] || "Mensual";
    const importeMedio = gf.fields["Importe Medio"] || 0;
    const moneda = gf.fields["Moneda"] || "EUR";
    const fechaAlta = gf.fields["Fecha Alta"];
    const fechaBaja = gf.fields["Fecha Baja"];
    const notas = gf.fields["Notas"];
    const tipo = gf.fields["Tipo"] || "Deducible";
    const TipoIcon = iconForTipo(tipo);

    const importeMensual =
      periodicidad === "Mensual" ? importeMedio :
      periodicidad === "Trimestral" ? importeMedio / 3 :
      periodicidad === "Anual" ? importeMedio / 12 : 0;

    return (
      <div
        key={gf.id}
        style={{
          padding: 16,
          background: "#fafafa",
          border: `1px solid ${B.border}`,
          borderRadius: 14,
          marginBottom: 10,
          opacity: esActivo ? 1 : 0.65,
          transition: "opacity 0.2s ease"
        }}
      >
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
          flexWrap: "wrap"
        }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            {/* Header con icono y nombre */}
            <div style={{
              fontWeight: 700,
              fontSize: 15,
              fontFamily: B.font,
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
              color: B.ink,
              letterSpacing: "-0.01em"
            }}>
              <Repeat size={15} strokeWidth={2} />
              {gf.fields["Nombre"] || gf.fields["Proveedor"] || "Sin nombre"}
              {!esActivo && (
                <span style={{
                  background: B.ink,
                  color: "#fff",
                  padding: "2px 9px",
                  borderRadius: 999,
                  fontSize: 10,
                  fontWeight: 600,
                  fontFamily: B.font,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em"
                }}>
                  Dado de baja
                </span>
              )}
            </div>

            {/* Proveedor + CIF */}
            <div style={{
              fontSize: 13,
              color: B.ink,
              marginTop: 6,
              fontFamily: B.font,
              fontWeight: 500
            }}>
              {gf.fields["Proveedor"] || "—"}
              {gf.fields["CIF Proveedor"] && (
                <span style={{ ...B.num }}> · CIF {gf.fields["CIF Proveedor"]}</span>
              )}
            </div>

            {/* Periodicidad + fechas */}
            <div style={{
              fontSize: 11,
              color: B.ink,
              marginTop: 4,
              fontFamily: B.font,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              flexWrap: "wrap"
            }}>
              <Calendar size={11} strokeWidth={2} />
              <span>{periodicidad}</span>
              {fechaAlta && <span style={B.num}> · Alta {fechaAlta}</span>}
              {fechaBaja && <span style={B.num}> · Baja {fechaBaja}</span>}
            </div>

            {/* Chips stats */}
            <div style={{
              marginTop: 12,
              display: "flex",
              gap: 6,
              flexWrap: "wrap"
            }}>
              <StatChip icon={TipoIcon}>{tipo}</StatChip>
              <StatChip icon={Wallet}>Medio · {fmt(stats.importeMedio)}</StatChip>
              <StatChip icon={Receipt}>Total · {fmt(stats.totalPagado)}</StatChip>
              <StatChip icon={Receipt}>{stats.numPagos} {stats.numPagos === 1 ? "pago" : "pagos"}</StatChip>
              {stats.ultimaFecha && (
                <StatChip icon={Clock}>Último · {stats.ultimaFecha}</StatChip>
              )}
            </div>

            {/* Notas */}
            {notas && (
              <div style={{
                marginTop: 10,
                padding: "10px 12px",
                background: B.yellow,
                borderRadius: 12,
                fontSize: 12,
                color: B.ink,
                fontFamily: B.font,
                lineHeight: 1.5,
                display: "flex",
                alignItems: "flex-start",
                gap: 8
              }}>
                <StickyNote size={13} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>{notas}</span>
              </div>
            )}
          </div>

          {/* Columna derecha: importe + acciones */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
            <div style={{
              fontWeight: 700,
              fontFamily: B.font,
              fontSize: B.ty.numM,
              color: B.ink,
              letterSpacing: "-0.015em",
              ...B.num
            }}>
              {fmt(importeMedio)}
              {moneda !== "EUR" && (
                <span style={{ fontSize: 11, color: B.muted, marginLeft: 4 }}>{moneda}</span>
              )}
            </div>
            {esActivo && periodicidad !== "Mensual" && (
              <div style={{
                fontSize: 11,
                color: B.muted,
                fontWeight: 500,
                fontFamily: B.font,
                ...B.num
              }}>
                ≈ {fmt(importeMensual)}/mes
              </div>
            )}
            <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
              <button
                onClick={() => startEdit(gf)}
                title="Editar"
                style={{
                  background: "transparent",
                  border: `1px solid ${B.border}`,
                  borderRadius: 999,
                  padding: 6,
                  cursor: "pointer",
                  color: B.ink,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                <Edit3 size={13} strokeWidth={2} />
              </button>
              {esActivo ? (
                <button
                  onClick={() => setBajaModal({
                    id: gf.id,
                    nombre: gf.fields["Nombre"] || gf.fields["Proveedor"],
                    accion: "baja"
                  })}
                  title="Dar de baja"
                  style={{
                    background: "transparent",
                    border: `1px solid ${B.border}`,
                    borderRadius: 999,
                    padding: 6,
                    cursor: "pointer",
                    color: B.ink,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                >
                  <Pause size={13} strokeWidth={2} />
                </button>
              ) : (
                <button
                  onClick={() => setBajaModal({
                    id: gf.id,
                    nombre: gf.fields["Nombre"] || gf.fields["Proveedor"],
                    accion: "reactivar"
                  })}
                  title="Reactivar"
                  style={{
                    background: "transparent",
                    border: `1px solid ${B.border}`,
                    borderRadius: 999,
                    padding: 6,
                    cursor: "pointer",
                    color: B.ink,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                >
                  <Play size={13} strokeWidth={2} />
                </button>
              )}
              <button
                onClick={() => borrarPermanentemente(gf)}
                title="Borrar permanentemente"
                style={{
                  background: "transparent",
                  border: `1px solid ${B.border}`,
                  borderRadius: 999,
                  padding: 6,
                  cursor: "pointer",
                  color: B.muted,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                <Trash2 size={13} strokeWidth={2} />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ============================================================
  // EDITOR
  // ============================================================
  const renderEditor = () => {
    if (!editForm) return null;
    return (
      <Card style={{ border: `1px solid ${B.ink}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <IconPill icon={Edit3} size={28} />
          <Lbl>Editar gasto fijo</Lbl>
        </div>
        {err && <div style={{ marginBottom: 14 }}><ErrorBox>{err}</ErrorBox></div>}
        <div style={{
          display: "grid",
          gridTemplateColumns: `repeat(${formColumns}, 1fr)`,
          gap: 14
        }}>
          <Inp label="Nombre" value={editForm.nombre} onChange={v => updateField("nombre", v)} ph="Ej: Canva Pro" />
          <Inp label="Proveedor" value={editForm.proveedor} onChange={v => updateField("proveedor", v)} ph="Ej: Canva" />
          <Inp label="CIF proveedor" value={editForm.cifProveedor} onChange={v => updateField("cifProveedor", v)} ph="Opcional" />
          <Inp label="Importe medio" value={editForm.importe} onChange={v => updateField("importe", v)} type="number" />
          <Sel label="Periodicidad" value={editForm.periodicidad} onChange={v => updateField("periodicidad", v)} options={PERIODICIDADES} />
          <Sel label="Moneda" value={editForm.moneda} onChange={v => updateField("moneda", v)} options={MONEDAS} />
          <Sel label="Tipo fiscal" value={editForm.tipo} onChange={v => updateField("tipo", v)} options={TIPOS} />
        </div>
        <div style={{ marginTop: 14 }}>
          <TxtArea
            label="Notas"
            value={editForm.notas}
            onChange={v => updateField("notas", v)}
            ph="Cualquier detalle útil sobre este gasto fijo…"
            rows={3}
          />
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
          <Btn
            onClick={saveEdit}
            disabled={savingEdit}
            icon={Check}
            iconBefore
          >
            {savingEdit ? "Guardando…" : "Guardar cambios"}
          </Btn>
          <Btn
            onClick={cancelEdit}
            variant="outline"
            icon={X}
            iconBefore
          >
            Cancelar
          </Btn>
        </div>
      </Card>
    );
  };

  // ============================================================
  // RENDER PRINCIPAL
  // ============================================================
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <PageHeader
        title="Gastos fijos."
        subtitle="Tus suscripciones y gastos recurrentes prorrateados a mensual."
      />

      {/* EDITOR */}
      {editId && renderEditor()}

      {/* APARTA CADA MES — card amarilla intacta */}
      <div style={{
        background: B.yellow,
        borderRadius: 20,
        padding: "clamp(22px, 3vw, 30px)",
        border: `1px solid ${B.ink}`,
        color: B.ink
      }}>
        <Lbl>Aparta cada mes</Lbl>
        <div style={{
          fontSize: B.ty.display,
          fontWeight: 700,
          marginTop: 8,
          fontFamily: B.font,
          letterSpacing: "-0.035em",
          lineHeight: 1,
          ...B.num
        }}>
          {fmt(prorrateo.total)}
        </div>
        <div style={{
          fontSize: B.ty.small,
          color: B.ink,
          marginTop: 10,
          fontFamily: B.font,
          lineHeight: 1.5,
          maxWidth: 460
        }}>
          {activos.length} {activos.length === 1 ? "gasto fijo activo" : "gastos fijos activos"} prorrateados a mensual.
        </div>

        <div style={{
          marginTop: 24,
          paddingTop: 22,
          borderTop: `1px solid ${B.ink}22`,
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
          gap: isMobile ? 22 : 32
        }}>
          <div>
            <Lbl>Reduce IRPF</Lbl>
            <div style={{
              fontSize: B.ty.numL,
              fontWeight: 700,
              fontFamily: B.font,
              marginTop: 8,
              color: B.ink,
              letterSpacing: "-0.015em",
              ...B.num
            }}>
              {fmt(prorrateo.deducible + prorrateo.cuotaSS)}
            </div>
            <div style={{
              fontSize: 12,
              color: B.ink,
              marginTop: 4,
              fontFamily: B.font,
              lineHeight: 1.4
            }}>
              Deducibles{prorrateo.cuotaSS > 0 && ` + Cuota SS (${fmt(prorrateo.cuotaSS)})`}
            </div>
          </div>

          <div>
            <Lbl>Solo ocupa caja</Lbl>
            <div style={{
              fontSize: B.ty.numL,
              fontWeight: 700,
              fontFamily: B.font,
              marginTop: 8,
              color: B.ink,
              letterSpacing: "-0.015em",
              ...B.num
            }}>
              {fmt(prorrateo.noDeducible)}
            </div>
            <div style={{
              fontSize: 12,
              color: B.ink,
              marginTop: 4,
              fontFamily: B.font,
              lineHeight: 1.4
            }}>
              No deducibles (aplazamientos, IVA fraccionado…)
            </div>
          </div>
        </div>
      </div>

      {/* ACTIVOS */}
      {activos.length > 0 ? (
        <Card>
          <Lbl>Activos ({activos.length})</Lbl>
          <div style={{ marginTop: 14 }}>
            {activos.map(gf => renderGastoFijo(gf, true))}
          </div>
        </Card>
      ) : (
        <Card>
          <p style={{
            color: B.ink,
            fontFamily: B.font,
            margin: 0,
            textAlign: "center",
            padding: "20px 0",
            fontSize: 14
          }}>
            No tienes gastos fijos activos. Cuando añadas un gasto manual y marques la opción
            <strong> "Es un gasto fijo recurrente"</strong>, aparecerá aquí.
          </p>
        </Card>
      )}

      {/* INACTIVOS — desplegable */}
      {inactivos.length > 0 && (
        <div>
          <Btn
            variant="outline"
            onClick={() => setShowInactivos(!showInactivos)}
            icon={showInactivos ? ChevronDown : ChevronRight}
            iconBefore
            style={{ width: "100%" }}
          >
            Dados de baja ({inactivos.length})
          </Btn>
          {showInactivos && (
            <Card style={{ marginTop: 10 }}>
              <div>
                {inactivos.map(gf => renderGastoFijo(gf, false))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* MODAL BAJA/REACTIVAR */}
      {bajaModal && (
        <div
          onClick={() => setBajaModal(null)}
          style={{
            position: "fixed",
            top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(0,0,0,0.55)",
            backdropFilter: "blur(3px)",
            zIndex: 300,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: "#fff",
              borderRadius: 20,
              padding: 28,
              maxWidth: 440,
              width: "100%",
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
              border: `1px solid ${B.border}`
            }}
          >
            <div style={{ marginBottom: 14 }}>
              <IconPill
                icon={bajaModal.accion === "baja" ? Pause : Play}
                size={48}
              />
            </div>
            <div style={{
              fontSize: 18,
              fontWeight: 700,
              fontFamily: B.font,
              marginBottom: 8,
              color: B.ink,
              letterSpacing: "-0.015em"
            }}>
              {bajaModal.accion === "baja" ? "Dar de baja" : "Reactivar"} «{bajaModal.nombre}»
            </div>
            <div style={{
              fontSize: 14,
              color: B.muted,
              marginBottom: 22,
              lineHeight: 1.55,
              fontFamily: B.font
            }}>
              {bajaModal.accion === "baja"
                ? "El gasto fijo se marcará como inactivo y no contará en el total mensual. El historial fiscal de los pagos asociados se mantiene intacto."
                : "El gasto fijo volverá a estar activo y contará en el total mensual."}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Btn
                onClick={confirmarBaja}
                icon={bajaModal.accion === "baja" ? Pause : Play}
                iconBefore
                style={{ flex: 1 }}
              >
                {bajaModal.accion === "baja" ? "Dar de baja" : "Reactivar"}
              </Btn>
              <Btn
                onClick={() => setBajaModal(null)}
                variant="outline"
                icon={X}
                iconBefore
                style={{ flex: 1 }}
              >
                Cancelar
              </Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
