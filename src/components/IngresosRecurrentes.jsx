import { useMemo, useState } from "react";
import {
  Plus, X, Check, Edit3, Trash2, CalendarDays, Repeat,
  UserRound, Clock, ChevronDown, FileText
} from "lucide-react";

import { B, fmt, hoy, MESES_FULL } from "../utils.js";
import { useResponsive } from "../hooks/useResponsive.js";
import { createRecord, updateRecord, deleteRecord } from "../api.js";
import { monthlyEquivalent, forecastForYear, isActiveInMonth } from "../recurringIncome.js";
import { Card, Lbl, Inp, Sel, TxtArea, PageHeader, Btn, ErrorBox } from "./UI.jsx";

const PERIODICIDADES = ["Mensual", "Trimestral"];

function emptyForm() {
  return {
    nombre: "",
    clienteId: "",
    importe: "",
    periodicidad: "Mensual",
    fechaInicio: hoy(),
    fechaFin: "",
    notas: ""
  };
}

function formatDate(value) {
  if (!value) return "Sin fecha de fin";
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function statusFor(record, now = new Date()) {
  const fields = record.fields || {};
  const current = now.getFullYear() * 12 + now.getMonth();
  const start = fields["Fecha primera factura"]?.slice(0, 7);
  const end = fields["Fecha última factura"]?.slice(0, 7);
  const toNumber = value => {
    if (!value) return null;
    const [year, month] = value.split("-").map(Number);
    return year * 12 + month - 1;
  };
  if (toNumber(start) > current) return "Próxima";
  if (end && toNumber(end) < current) return "Finalizada";
  return "Activa";
}

export default function IngresosRecurrentes({
  recurrentes, clientes, onUpsert, onRemove, onRefresh
}) {
  const { isMobile, formColumns } = useResponsive();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
  const [year, setYear] = useState(currentYear);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [error, setError] = useState("");

  const clientMap = useMemo(() => Object.fromEntries(
    (clientes || []).map(client => [client.id, client.fields["Nombre"] || "Sin nombre"])
  ), [clientes]);

  const sortedClients = useMemo(() => [...(clientes || [])].sort((a, b) =>
    (a.fields["Nombre"] || "").localeCompare(b.fields["Nombre"] || "", "es")
  ), [clientes]);

  const monthly = useMemo(() => monthlyEquivalent(recurrentes), [recurrentes]);
  const forecast = useMemo(() => forecastForYear(recurrentes, year), [recurrentes, year]);
  const yearTotal = forecast.reduce((sum, amount) => sum + amount, 0);
  const activeCount = (recurrentes || []).filter(record =>
    isActiveInMonth(record, currentYear, currentMonth)
  ).length;

  const openNew = () => {
    setEditId(null);
    setForm(emptyForm());
    setError("");
    setShowForm(true);
  };

  const openEdit = record => {
    const fields = record.fields || {};
    setEditId(record.id);
    setForm({
      nombre: fields["Nombre"] || "",
      clienteId: (fields["Cliente"] || [])[0] || "",
      importe: String(fields["Importe base"] ?? ""),
      periodicidad: fields["Periodicidad"] || "Mensual",
      fechaInicio: fields["Fecha primera factura"] || "",
      fechaFin: fields["Fecha última factura"] || "",
      notas: fields["Notas"] || ""
    });
    setError("");
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const closeForm = () => {
    setShowForm(false);
    setEditId(null);
    setForm(emptyForm());
    setError("");
  };

  const save = async event => {
    event.preventDefault();
    const amount = Number(form.importe);
    if (!form.nombre.trim() || !form.clienteId || !form.fechaInicio || !(amount > 0) || !PERIODICIDADES.includes(form.periodicidad)) {
      setError("Completa nombre, cliente, importe, periodicidad y fecha de primera factura.");
      return;
    }
    if (form.fechaFin && form.fechaFin < form.fechaInicio) {
      setError("La fecha última no puede ser anterior a la primera factura.");
      return;
    }

    const fields = {
      "Nombre": form.nombre.trim(),
      "Cliente": [form.clienteId],
      "Importe base": amount,
      "Periodicidad": form.periodicidad,
      "Fecha primera factura": form.fechaInicio,
      "Fecha última factura": form.fechaFin || null,
      "Notas": form.notas.trim() || null
    };

    setSaving(true);
    setError("");
    try {
      const result = editId
        ? await updateRecord("Ingresos recurrentes", editId, fields)
        : await createRecord("Ingresos recurrentes", fields);
      const record = result.records?.[0];
      if (onUpsert && record) onUpsert("Ingresos recurrentes", record);
      else if (onRefresh) await onRefresh();
      closeForm();
    } catch (err) {
      setError("No se pudo guardar: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async record => {
    const name = record.fields["Nombre"] || "esta cuota";
    if (!confirm(`¿Borrar «${name}» de los ingresos recurrentes?`)) return;
    setDeleting(record.id);
    try {
      await deleteRecord("Ingresos recurrentes", record.id);
      if (onRemove) onRemove("Ingresos recurrentes", record.id);
      else if (onRefresh) await onRefresh();
    } catch (err) {
      alert("No se pudo borrar: " + err.message);
    } finally {
      setDeleting(null);
    }
  };

  const records = (recurrentes || []).filter(record => {
    const fields = record.fields || {};
    return Boolean(
      fields["Nombre"] ||
      (fields["Cliente"] || []).length ||
      fields["Importe base"] ||
      fields["Fecha primera factura"]
    );
  }).sort((a, b) => {
    const order = { Activa: 0, "Próxima": 1, Finalizada: 2 };
    const statusDiff = order[statusFor(a)] - order[statusFor(b)];
    if (statusDiff) return statusDiff;
    return (a.fields["Nombre"] || "").localeCompare(b.fields["Nombre"] || "", "es");
  });

  const clientGroups = Object.values(records.reduce((groups, record) => {
    const clientId = (record.fields?.["Cliente"] || [])[0] || "sin-cliente";
    if (!groups[clientId]) {
      groups[clientId] = {
        clientId,
        clientName: clientMap[clientId] || "Cliente eliminado",
        records: []
      };
    }
    groups[clientId].records.push(record);
    return groups;
  }, {})).sort((a, b) => a.clientName.localeCompare(b.clientName, "es"));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <PageHeader
        title="Ingresos recurrentes."
        subtitle="Cuotas previstas de clientes, separadas de las facturas reales."
        action={
          <Btn onClick={showForm ? closeForm : openNew} icon={showForm ? X : Plus} iconBefore
            variant={showForm ? "outline" : "primary"}>
            {showForm ? "Cancelar" : "Nueva cuota"}
          </Btn>
        }
      />

      {showForm && (
        <Card accent="lavender">
          <form onSubmit={save}>
            <Lbl>{editId ? "Editar cuota" : "Nueva cuota fija"}</Lbl>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${formColumns}, minmax(0, 1fr))`, gap: 14, marginTop: 16 }}>
              <Inp label="Nombre" value={form.nombre} onChange={value => setForm({ ...form, nombre: value })} ph="Mantenimiento web" />
              <div>
                <label style={{ fontSize: B.ty.label, fontWeight: 600, fontFamily: B.font, textTransform: "uppercase", letterSpacing: "0.1em", display: "block", marginBottom: 6 }}>
                  Cliente
                </label>
                <select value={form.clienteId} onChange={event => setForm({ ...form, clienteId: event.target.value })} style={{ ...B.inp, cursor: "pointer" }}>
                  <option value="">Selecciona un cliente…</option>
                  {sortedClients.map(client => <option key={client.id} value={client.id}>{client.fields["Nombre"] || "Sin nombre"}</option>)}
                </select>
              </div>
              <Inp label="Importe base por factura" value={form.importe} onChange={value => setForm({ ...form, importe: value })} type="number" step="0.01" min="0.01" ph="0,00" />
              <Sel label="Periodicidad" value={form.periodicidad} onChange={value => setForm({ ...form, periodicidad: value })} options={PERIODICIDADES} />
              <Inp label="Fecha primera factura" value={form.fechaInicio} onChange={value => setForm({ ...form, fechaInicio: value })} type="date" />
              <Inp label="Fecha última factura (opcional)" value={form.fechaFin} onChange={value => setForm({ ...form, fechaFin: value })} type="date" />
            </div>
            <div style={{ marginTop: 14 }}>
              <TxtArea
                label="Condiciones o qué incluye (opcional)"
                value={form.notas}
                onChange={value => setForm({ ...form, notas: value })}
                ph="Ej.: mantenimiento, soporte y dos cambios al mes. Permanencia mínima de tres meses."
                rows={4}
              />
            </div>
            <div style={{ marginTop: 14 }}><ErrorBox>{error}</ErrorBox></div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 18 }}>
              <Btn type="submit" disabled={saving} icon={Check} iconBefore>{saving ? "Guardando…" : "Guardar cuota"}</Btn>
              <Btn onClick={closeForm} variant="outline">Cancelar</Btn>
            </div>
          </form>
        </Card>
      )}

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, minmax(0, 1fr))", gap: 14 }}>
        <Card accent="yellow">
          <Lbl>Recurrencia mensual equivalente</Lbl>
          <div style={{ fontSize: B.ty.display, fontWeight: 700, marginTop: 8, fontFamily: B.font, letterSpacing: "-0.035em", ...B.num }}>{fmt(monthly)}</div>
          <p style={{ margin: "8px 0 0", fontSize: 13, lineHeight: 1.45, fontFamily: B.font }}>
            {activeCount} {activeCount === 1 ? "cuota vigente" : "cuotas vigentes"}; las trimestrales se dividen entre tres.
          </p>
        </Card>
        <Card dark>
          <Lbl color="#fff">Previsto para facturar en {year}</Lbl>
          <div style={{ fontSize: B.ty.display, fontWeight: 700, marginTop: 8, fontFamily: B.font, letterSpacing: "-0.035em", ...B.num }}>{fmt(yearTotal)}</div>
          <p style={{ margin: "8px 0 0", fontSize: 13, lineHeight: 1.45, color: "#fff", fontFamily: B.font }}>
            Base imponible prevista. No se suma a Facturas ni al Resumen.
          </p>
        </Card>
      </div>

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <Lbl>Previsión por mes</Lbl>
          <div style={{ position: "relative" }}>
            <select value={year} onChange={event => setYear(Number(event.target.value))} style={{ ...B.inp, width: 120, paddingRight: 32, cursor: "pointer" }}>
              {[currentYear - 1, currentYear, currentYear + 1, currentYear + 2].map(value => <option key={value} value={value}>{value}</option>)}
            </select>
            <ChevronDown size={13} style={{ position: "absolute", right: 12, top: 14, pointerEvents: "none" }} />
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, minmax(0, 1fr))" : "repeat(4, minmax(0, 1fr))", gap: 10, marginTop: 16 }}>
          {forecast.map((amount, month) => (
            <div key={month} style={{ padding: "14px 12px", borderRadius: 14, border: `1px solid ${B.border}`, background: year === currentYear && month === currentMonth ? B.lavender : "transparent" }}>
              <div style={{ fontFamily: B.font, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>{MESES_FULL[month]}</div>
              <div style={{ fontFamily: B.font, fontSize: 17, fontWeight: 700, marginTop: 5, ...B.num }}>{fmt(amount)}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <Lbl>Clientes con cuotas ({clientGroups.length})</Lbl>
        {records.length === 0 ? (
          <p style={{ margin: "18px 0 0", color: B.muted, fontFamily: B.font, fontSize: 14, textAlign: "center", padding: 18 }}>
            Todavía no hay cuotas recurrentes.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 16 }}>
            {clientGroups.map(group => {
              const groupMonthly = monthlyEquivalent(group.records);
              return (
                <section key={group.clientId} style={{ border: `1px solid ${B.border}`, borderRadius: 16, overflow: "hidden" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap", padding: "15px 16px", background: "#f7f7f7" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                      <UserRound size={17} />
                      <div>
                        <strong style={{ display: "block", fontFamily: B.font, fontSize: 16 }}>{group.clientName}</strong>
                        <span style={{ color: B.muted, fontFamily: B.font, fontSize: 12 }}>
                          {group.records.length} {group.records.length === 1 ? "cuota registrada" : "cuotas registradas"}
                        </span>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontFamily: B.font, fontSize: 17, fontWeight: 700, ...B.num }}>{fmt(groupMonthly)}</div>
                      <div style={{ fontFamily: B.font, fontSize: 11, color: B.muted }}>al mes equivalente</div>
                    </div>
                  </div>
                  <div style={{ padding: "0 16px" }}>
                    {group.records.map((record, index) => {
                      const fields = record.fields || {};
                      const status = statusFor(record);
                      const amount = Number(fields["Importe base"]) || 0;
                      const monthlyAmount = fields["Periodicidad"] === "Trimestral" ? amount / 3 : amount;
                      return (
                        <div key={record.id} style={{ display: "flex", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", gap: 14, padding: "16px 0", borderBottom: index < group.records.length - 1 ? `1px solid ${B.border}` : "none", opacity: status === "Finalizada" ? 0.58 : 1 }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                              <strong style={{ fontFamily: B.font, fontSize: 15 }}>{fields["Nombre"] || "Sin nombre"}</strong>
                              <span style={{ borderRadius: 999, background: status === "Activa" ? B.lavender : "#f4f4f4", padding: "3px 8px", fontFamily: B.font, fontSize: 11, fontWeight: 600 }}>{status}</span>
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 16px", marginTop: 8, color: B.muted, fontFamily: B.font, fontSize: 12 }}>
                              <span style={{ display: "inline-flex", gap: 5, alignItems: "center" }}><Repeat size={12} />{fields["Periodicidad"] || "Mensual"}</span>
                              <span style={{ display: "inline-flex", gap: 5, alignItems: "center" }}><CalendarDays size={12} />Desde {formatDate(fields["Fecha primera factura"])}</span>
                              <span style={{ display: "inline-flex", gap: 5, alignItems: "center" }}><Clock size={12} />{formatDate(fields["Fecha última factura"])}</span>
                            </div>
                            {fields["Notas"] && (
                              <div style={{ display: "flex", gap: 7, alignItems: "flex-start", marginTop: 10, color: B.muted, fontFamily: B.font, fontSize: 12, lineHeight: 1.5 }}>
                                <FileText size={13} style={{ flexShrink: 0, marginTop: 2 }} />
                                <span style={{ whiteSpace: "pre-wrap" }}>{fields["Notas"]}</span>
                              </div>
                            )}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexShrink: 0 }}>
                            <div style={{ textAlign: isMobile ? "left" : "right" }}>
                              <div style={{ fontFamily: B.font, fontSize: 17, fontWeight: 700, ...B.num }}>{fmt(amount)}</div>
                              <div style={{ fontFamily: B.font, fontSize: 11, color: B.muted }}>{fmt(monthlyAmount)} / mes equivalente</div>
                            </div>
                            <Btn size="sm" variant="outline" onClick={() => openEdit(record)} icon={Edit3} iconBefore>Editar</Btn>
                            <button onClick={() => remove(record)} disabled={deleting === record.id} aria-label={`Borrar ${fields["Nombre"] || "cuota"}`} style={{ background: "transparent", border: "none", padding: 7, cursor: "pointer", color: B.danger }}>
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
