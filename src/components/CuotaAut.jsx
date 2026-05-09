// src/components/CuotaAut.jsx
// Calcula tu rendimiento neto mensual y compara con el tramo de cotización correcto.
// Solo cuenta gastos DEDUCIBLES + Cuota SS. Excluye No deducibles (aplazamientos, IVA fraccionado, multas).

import { useState } from "react";
import { B, fmt } from "../utils.js";
import { useResponsive } from "../hooks/useResponsive.js";
import { Card, Lbl, SectionHeader } from "./UI.jsx";

export default function CuotaAut({ ingresos, gastos, gastosFijos, tramos }) {
  const { isMobile } = useResponsive();

  const [ca, setCa] = useState(() => {
    try { return Number(localStorage.getItem("ga_cuota")) || 294; }
    catch { return 294; }
  });

  // ============================================================
  // CÁLCULO DEL RENDIMIENTO NETO (fiscalmente correcto)
  // ============================================================
  // Solo restan los gastos DEDUCIBLES y la CUOTA SS.
  // Los NO DEDUCIBLES (IVA fraccionado, aplazamientos, multas) NO restan
  // porque son deuda histórica, no operación corriente.

  // 1. Identificar IDs de gastos fijos NO deducibles
  const gastosFijosNoDeducibles = (gastosFijos || []).filter(gf =>
    gf.fields["Tipo"] === "No deducible"
  );
  const idsNoDeducibles = new Set();
  gastosFijosNoDeducibles.forEach(gf => {
    const links = gf.fields["Gastos"] || [];
    links.forEach(id => idsNoDeducibles.add(id));
  });

  // 2. Sumar ingresos
  const tI = ingresos.reduce((s, r) => s + (r.fields["Base Imponible"] || 0), 0);

  // 3. Sumar gastos deducibles (TODOS los gastos EXCEPTO los enlazados a Gastos Fijos No deducibles)
  const tGdeducibles = gastos.reduce((s, r) => {
    if (idsNoDeducibles.has(r.id)) return s; // saltar No deducibles
    return s + (r.fields["Base Imponible"] || 0);
  }, 0);

  // 4. Calcular meses transcurridos
  const ms = Math.max(new Date().getMonth() + 1, 1);

  // 5. Rendimiento neto mensual = (Ingresos - Gastos Deducibles - Cuotas SS pagadas) × 0.93 / meses
  const rn = ((tI - tGdeducibles - (ca * ms)) * 0.93) / ms;

  // Procesar tramos
  const td = tramos.map(r => ({
    tramo: r.fields["Tramo"] || 0,
    min: r.fields["Rend. Neto Mín"] || r.fields["Rend Neto Min"] || 0,
    max: r.fields["Rend. Neto Máx"] || r.fields["Rend Neto Max"] || 0,
    cuota: r.fields["Cuota Mínima"] || r.fields["Cuota Minima"] || 0
  })).sort((a, b) => a.tramo - b.tramo);

  const tr = rn <= 0
    ? (td[0] || { tramo: 1, min: 0, max: 670, cuota: 200 })
    : (td.find(t => rn >= t.min && rn < t.max) || td[0] || { tramo: 1, min: 0, max: 670, cuota: 200 });

  const d = tr.cuota - ca;

  const save = (v) => {
    setCa(v);
    try { localStorage.setItem("ga_cuota", v); } catch {}
  };

  // Para mostrar transparencia: cuántos gastos no deducibles hay excluidos
  const numNoDed = idsNoDeducibles.size;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <SectionHeader title="Cuota de Autónomos" />

      <Card>
        <Lbl>Tu cuota actual (€/mes)</Lbl>
        <input
          type="number"
          value={ca}
          onChange={e => save(Number(e.target.value))}
          style={{
            ...B.inp,
            fontSize: 20,
            fontWeight: 700,
            fontFamily: B.tM,
            marginTop: 10
          }}
        />
        <div style={{ marginTop: 8, fontSize: 12, color: B.muted, fontFamily: B.tS }}>
          La que te cobra la Seguridad Social actualmente cada mes.
        </div>
      </Card>

      <div style={{
        background: B.text,
        borderRadius: 12,
        padding: isMobile ? 22 : 28,
        color: "#fff"
      }}>
        <Lbl><span style={{ color: "rgba(255,255,255,0.6)" }}>RENDIMIENTO NETO MENSUAL</span></Lbl>
        <div style={{
          fontSize: isMobile ? 32 : 40,
          fontWeight: 700,
          fontFamily: B.tM,
          marginTop: 6
        }}>
          {fmt(rn)}
        </div>
        <div style={{
          marginTop: 16,
          display: "flex",
          gap: isMobile ? 14 : 24,
          fontSize: 13,
          fontFamily: B.tS,
          flexWrap: "wrap"
        }}>
          <div>
            <div style={{ opacity: 0.55, fontSize: 11, fontFamily: B.tM, textTransform: "uppercase" }}>Tramo</div>
            <div style={{ fontWeight: 700 }}>{tr.tramo}</div>
          </div>
          <div>
            <div style={{ opacity: 0.55, fontSize: 11, fontFamily: B.tM, textTransform: "uppercase" }}>Cuota correcta</div>
            <div style={{ fontWeight: 700 }}>{fmt(tr.cuota)}/mes</div>
          </div>
          <div>
            <div style={{ opacity: 0.55, fontSize: 11, fontFamily: B.tM, textTransform: "uppercase" }}>Rango</div>
            <div style={{ fontWeight: 700 }}>{fmt(tr.min)} - {fmt(tr.max)}</div>
          </div>
        </div>
        {numNoDed > 0 && (
          <div style={{
            marginTop: 14,
            padding: "8px 12px",
            background: "rgba(255,255,255,0.08)",
            borderRadius: 6,
            fontSize: 11,
            color: "rgba(255,255,255,0.7)",
            fontFamily: B.tS
          }}>
            ℹ️ Excluyendo {numNoDed} {numNoDed === 1 ? "gasto" : "gastos"} no deducibles (IVA fraccionado, aplazamientos, multas).
          </div>
        )}
      </div>

      {d !== 0 && (
        <div style={{
          background: d > 0 ? "#fef2f2" : "#f0fdf4",
          border: `2px solid ${d > 0 ? B.red : B.green}`,
          borderRadius: 8,
          padding: 20,
          color: d > 0 ? "#991b1b" : "#166534"
        }}>
          <div style={{ fontWeight: 700, fontSize: 15, fontFamily: B.tS }}>
            {d > 0 ? "⚠️ Pagando de menos" : "✅ Pagando de más"}
          </div>
          <div style={{ fontSize: 14, marginTop: 6 }}>
            {d > 0
              ? `Deberías pagar ${fmt(tr.cuota)}. Diferencia: ${fmt(d)}/mes que se acumula como deuda con la Seguridad Social.`
              : `Estás pagando ${fmt(Math.abs(d))}/mes de más. Podrías solicitar bajada de tramo para ahorrar.`}
          </div>
        </div>
      )}

      {d === 0 && (
        <div style={{
          background: "#f0fdf4",
          border: `2px solid ${B.green}`,
          borderRadius: 8,
          padding: 20,
          color: "#166534"
        }}>
          <div style={{ fontWeight: 700, fontSize: 15, fontFamily: B.tS }}>
            ✅ Cuota perfecta
          </div>
          <div style={{ fontSize: 14, marginTop: 6 }}>
            Estás pagando exactamente la cuota correcta para tu tramo. Sigue así.
          </div>
        </div>
      )}

      {td.length > 0 && (
        <Card>
          <Lbl>Tramos 2026</Lbl>
          <div style={{ overflowX: "auto", marginTop: 14 }}>
            <table style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 13,
              fontFamily: B.tS,
              minWidth: isMobile ? 400 : "auto"
            }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${B.border}` }}>
                  <th style={{ padding: "8px 12px", textAlign: "left", color: B.muted, fontFamily: B.tM, fontSize: 11 }}>TRAMO</th>
                  <th style={{ padding: "8px 12px", textAlign: "left", color: B.muted, fontFamily: B.tM, fontSize: 11 }}>REND. NETO</th>
                  <th style={{ padding: "8px 12px", textAlign: "right", color: B.muted, fontFamily: B.tM, fontSize: 11 }}>CUOTA</th>
                </tr>
              </thead>
              <tbody>
                {td.map(t => (
                  <tr
                    key={t.tramo}
                    style={{
                      background: t.tramo === tr.tramo ? B.yellow + "55" : "transparent",
                      fontWeight: t.tramo === tr.tramo ? 700 : 400,
                      borderBottom: `1px solid ${B.border}`
                    }}
                  >
                    <td style={{ padding: "8px 12px", fontFamily: B.tM }}>
                      {t.tramo === tr.tramo ? "→ " : ""}{t.tramo}
                    </td>
                    <td style={{ padding: "8px 12px" }}>
                      {fmt(t.min)} - {t.max < 99999 ? fmt(t.max) : "+6.000€"}
                    </td>
                    <td style={{
                      padding: "8px 12px",
                      textAlign: "right",
                      color: t.tramo === tr.tramo ? B.purple : B.text,
                      fontFamily: B.tM
                    }}>
                      {fmt(t.cuota)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
