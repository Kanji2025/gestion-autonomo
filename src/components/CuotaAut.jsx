// src/components/CuotaAut.jsx
// Calcula tu rendimiento neto mensual y compara con el tramo de cotización correcto.
// Solo cuenta gastos DEDUCIBLES + Cuota SS. Excluye No deducibles (aplazamientos, IVA fraccionado, multas).
// REDISEÑO 2026: solo colores de marca.

import { useState } from "react";
import {
  Wallet, TrendingUp, AlertTriangle, CheckCircle2,
  Info, Edit3, Check, ChevronRight
} from "lucide-react";

import { B, fmt } from "../utils.js";
import { useResponsive } from "../hooks/useResponsive.js";
import { Card, Lbl, PageHeader, IconPill, Btn } from "./UI.jsx";

// ============================================================
// SUBCOMPONENTE BREAKDOWN — texto en negro
// ============================================================
function BreakdownItem({ label, value }) {
  return (
    <div>
      <Lbl color={B.ink}>{label}</Lbl>
      <div style={{
        fontSize: B.ty.numM,
        fontWeight: 700,
        marginTop: 6,
        color: B.ink,
        letterSpacing: "-0.015em",
        fontFamily: B.font,
        ...B.num
      }}>
        {value}
      </div>
    </div>
  );
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================
export default function CuotaAut({ ingresos, gastos, gastosFijos, tramos }) {
  const { isMobile } = useResponsive();

  const [ca, setCa] = useState(() => {
    try { return Number(localStorage.getItem("ga_cuota")) || 294; }
    catch { return 294; }
  });
  const [editing, setEditing] = useState(false);
  const [tmpCa, setTmpCa] = useState(ca);

  const saveCuota = () => {
    const v = Number(tmpCa) || 0;
    setCa(v);
    try { localStorage.setItem("ga_cuota", v); } catch {}
    setEditing(false);
  };

  // ============================================================
  // CÁLCULO DEL RENDIMIENTO NETO (lógica fiscal idéntica)
  // ============================================================
  const gastosFijosNoDeducibles = (gastosFijos || []).filter(gf =>
    gf.fields["Tipo"] === "No deducible"
  );
  const idsNoDeducibles = new Set();
  gastosFijosNoDeducibles.forEach(gf => {
    const links = gf.fields["Gastos"] || [];
    links.forEach(id => idsNoDeducibles.add(id));
  });

  const tI = ingresos.reduce((s, r) => s + (r.fields["Base Imponible"] || 0), 0);
  const tGdeducibles = gastos.reduce((s, r) => {
    if (idsNoDeducibles.has(r.id)) return s;
    return s + (r.fields["Base Imponible"] || 0);
  }, 0);

  const ms = Math.max(new Date().getMonth() + 1, 1);
  const rn = ((tI - tGdeducibles - (ca * ms)) * 0.93) / ms;

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
  const numNoDed = idsNoDeducibles.size;
  const isPerfect = Math.abs(d) < 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <PageHeader
        title="Cuota de autónomos."
        subtitle="Lo que pagas a la Seguridad Social y lo que deberías pagar según tu tramo."
      />

      {/* TU CUOTA ACTUAL */}
      <Card>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 14,
          flexWrap: "wrap"
        }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <IconPill icon={Wallet} size={28} />
              <Lbl>Tu cuota actual</Lbl>
            </div>
            <p style={{
              fontSize: B.ty.small,
              color: B.muted,
              margin: "6px 0 0",
              fontFamily: B.font
            }}>
              Lo que pagas cada mes a la Seguridad Social.
            </p>
          </div>
          {editing ? (
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                type="number"
                value={tmpCa}
                onChange={e => setTmpCa(e.target.value)}
                style={{
                  width: 120,
                  padding: "9px 14px",
                  borderRadius: 999,
                  border: `1px solid ${B.ink}`,
                  fontSize: 14,
                  fontFamily: B.font,
                  fontWeight: 700,
                  outline: "none",
                  textAlign: "center",
                  background: "#fff",
                  ...B.num
                }}
              />
              <Btn size="sm" icon={Check} onClick={saveCuota}>Guardar</Btn>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                fontSize: B.ty.numL,
                fontWeight: 700,
                color: B.ink,
                fontFamily: B.font,
                letterSpacing: "-0.02em",
                ...B.num
              }}>
                {fmt(ca)}/mes
              </div>
              <Btn
                variant="outline"
                size="sm"
                icon={Edit3}
                onClick={() => { setTmpCa(ca); setEditing(true); }}
              >
                Editar
              </Btn>
            </div>
          )}
        </div>
      </Card>

      {/* RENDIMIENTO NETO — lavanda Kanji */}
      <Card accent="lavender">
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <IconPill icon={TrendingUp} size={28} />
          <Lbl>Rendimiento neto mensual estimado</Lbl>
        </div>
        <div style={{
          fontSize: B.ty.display,
          fontWeight: 700,
          marginTop: 8,
          fontFamily: B.font,
          letterSpacing: "-0.035em",
          lineHeight: 1,
          color: B.ink,
          ...B.num
        }}>
          {fmt(rn)}
        </div>
        <p style={{
          fontSize: B.ty.small,
          color: B.ink,
          margin: "12px 0 0",
          fontFamily: B.font,
          lineHeight: 1.5,
          maxWidth: 480
        }}>
          Calculado como (ingresos − gastos deducibles − cuotas SS pagadas) × 0,93 / meses transcurridos.
        </p>

        <div style={{
          marginTop: 24,
          paddingTop: 22,
          borderTop: `1px solid ${B.ink}22`,
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)",
          gap: isMobile ? 16 : 24
        }}>
          <BreakdownItem label="Tramo" value={tr.tramo} />
          <BreakdownItem label="Cuota correcta" value={`${fmt(tr.cuota)}/mes`} />
          <BreakdownItem label="Rango neto" value={`${fmt(tr.min)} – ${tr.max < 99999 ? fmt(tr.max) : "+6.000 €"}`} />
        </div>

        {numNoDed > 0 && (
          <div style={{
            marginTop: 18,
            padding: "10px 14px",
            background: "rgba(0,0,0,0.07)",
            borderRadius: 12,
            fontSize: 12,
            color: B.ink,
            fontFamily: B.font,
            display: "flex",
            alignItems: "center",
            gap: 8
          }}>
            <Info size={13} strokeWidth={2.25} />
            Excluyendo {numNoDed} {numNoDed === 1 ? "gasto" : "gastos"} no deducibles (IVA fraccionado, aplazamientos, multas).
          </div>
        )}
      </Card>

      {/* AVISO PAGANDO DE MENOS */}
      {!isPerfect && d > 0 && (
        <Card style={{ border: `1px solid ${B.ink}` }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
            <IconPill icon={AlertTriangle} size={36} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontFamily: B.font,
                fontWeight: 700,
                fontSize: B.ty.h2,
                color: B.ink,
                letterSpacing: "-0.02em"
              }}>
                Estás pagando de menos.
              </div>
              <p style={{
                fontFamily: B.font,
                fontSize: B.ty.small,
                marginTop: 6,
                color: B.muted,
                lineHeight: 1.5
              }}>
                Tu rendimiento te encaja en el tramo {tr.tramo} ({fmt(tr.cuota)}/mes).
                Diferencia: <strong style={{ color: B.ink, ...B.num }}>{fmt(Math.abs(d))}/mes</strong> que se acumula como deuda con la SS.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* AVISO PAGANDO DE MÁS */}
      {!isPerfect && d < 0 && (
        <Card>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
            <IconPill icon={CheckCircle2} size={36} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontFamily: B.font,
                fontWeight: 700,
                fontSize: B.ty.h2,
                color: B.ink,
                letterSpacing: "-0.02em"
              }}>
                Podrías pagar menos.
              </div>
              <p style={{
                fontFamily: B.font,
                fontSize: B.ty.small,
                marginTop: 6,
                color: B.muted,
                lineHeight: 1.5
              }}>
                Tu rendimiento encaja en el tramo {tr.tramo} ({fmt(tr.cuota)}/mes).
                Podrías solicitar bajada de tramo y ahorrar <strong style={{ color: B.ink, ...B.num }}>{fmt(Math.abs(d))}/mes</strong>.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* AVISO PERFECTO */}
      {isPerfect && (
        <Card>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
            <IconPill icon={CheckCircle2} size={36} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontFamily: B.font,
                fontWeight: 700,
                fontSize: B.ty.h2,
                color: B.ink,
                letterSpacing: "-0.02em"
              }}>
                Cuota perfecta.
              </div>
              <p style={{
                fontFamily: B.font,
                fontSize: B.ty.small,
                marginTop: 6,
                color: B.muted,
                lineHeight: 1.5
              }}>
                Pagas exactamente la cuota correcta para tu tramo. Sigue así.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* TABLA TRAMOS 2026 */}
      {td.length > 0 && (
        <Card>
          <Lbl>Tramos 2026</Lbl>
          <div style={{ overflowX: "auto", marginTop: 14 }}>
            <table style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: B.ty.small,
              fontFamily: B.font,
              minWidth: 480
            }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${B.border}` }}>
                  <th style={{
                    padding: "10px 12px",
                    textAlign: "left",
                    fontFamily: B.font,
                    fontSize: B.ty.label,
                    fontWeight: 600,
                    color: B.muted,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em"
                  }}>Tramo</th>
                  <th style={{
                    padding: "10px 12px",
                    textAlign: "left",
                    fontFamily: B.font,
                    fontSize: B.ty.label,
                    fontWeight: 600,
                    color: B.muted,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em"
                  }}>Rend. neto</th>
                  <th style={{
                    padding: "10px 12px",
                    textAlign: "right",
                    fontFamily: B.font,
                    fontSize: B.ty.label,
                    fontWeight: 600,
                    color: B.muted,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em"
                  }}>Cuota</th>
                </tr>
              </thead>
              <tbody>
                {td.map(t => {
                  const active = t.tramo === tr.tramo;
                  return (
                    <tr key={t.tramo} style={{
                      background: active ? B.yellow : "transparent",
                      fontWeight: active ? 700 : 500,
                      borderBottom: `1px solid ${B.border}`
                    }}>
                      <td style={{
                        padding: "10px 12px",
                        color: B.ink,
                        ...B.num
                      }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          {active && <ChevronRight size={13} strokeWidth={2.5} />}
                          {t.tramo}
                        </span>
                      </td>
                      <td style={{
                        padding: "10px 12px",
                        color: B.ink,
                        ...B.num
                      }}>
                        {fmt(t.min)} – {t.max < 99999 ? fmt(t.max) : "+6.000 €"}
                      </td>
                      <td style={{
                        padding: "10px 12px",
                        textAlign: "right",
                        color: B.ink,
                        fontWeight: active ? 700 : 600,
                        ...B.num
                      }}>
                        {fmt(t.cuota)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
