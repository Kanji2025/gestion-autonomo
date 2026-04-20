// src/components/Dashboard.jsx
// Panel principal completo: KPIs, Hucha, gráfica, próximo IVA, cuota, alertas.

import { useState } from "react";
import { B, fmt, MESES, applyF, getTrimestre } from "../utils.js";
import { useResponsive } from "../hooks/useResponsive.js";
import { Card, Lbl, Big, Sub, PBar, FilterBar, SectionHeader } from "./UI.jsx";

// ============================================================
// PRÓXIMO VENCIMIENTO DE IVA
// ============================================================
function nextIVAClosingDate() {
  const now = new Date();
  const year = now.getFullYear();
  const limites = [
    { tri: "Q1", date: new Date(year, 3, 20) },
    { tri: "Q2", date: new Date(year, 6, 20) },
    { tri: "Q3", date: new Date(year, 9, 20) },
    { tri: "Q4", date: new Date(year + 1, 0, 30) }
  ];
  for (const l of limites) {
    if (l.date >= now) return l;
  }
  return limites[0];
}

// ============================================================
// CÁLCULO DE TRAMO
// ============================================================
function calcularTramo(ingresos, gastos, tramos, cuotaActual) {
  if (!tramos || tramos.length === 0) return null;

  const tI = ingresos.reduce((s, r) => s + (r.fields["Base Imponible"] || 0), 0);
  const tG = gastos.reduce((s, r) => s + (r.fields["Base Imponible"] || 0), 0);
  const ms = Math.max(new Date().getMonth() + 1, 1);
  const rn = ((tI - tG - (cuotaActual * ms)) * 0.93) / ms;

  const td = tramos.map(r => ({
    tramo: r.fields["Tramo"] || 0,
    min: r.fields["Rend. Neto Mín"] || r.fields["Rend Neto Min"] || 0,
    max: r.fields["Rend. Neto Máx"] || r.fields["Rend Neto Max"] || 0,
    cuota: r.fields["Cuota Mínima"] || r.fields["Cuota Minima"] || 0
  })).sort((a, b) => a.tramo - b.tramo);

  const tr = rn <= 0
    ? td[0]
    : (td.find(t => rn >= t.min && rn < t.max) || td[0]);

  return {
    rn,
    tramo: tr.tramo,
    cuotaCorrecta: tr.cuota,
    diff: tr.cuota - cuotaActual
  };
}

// ============================================================
// COMPONENTE
// ============================================================
export default function Dashboard({
  ingresos, gastos, tramos, alertas,
  salObj, setSalObj,
  filtro, setFiltro
}) {
  const { columnsForGrid, isMobile, isPhoneOrSmallTablet } = useResponsive();

  const fi = applyF(ingresos, filtro);
  const fg = applyF(gastos, filtro);

  const tFact = fi.reduce((s, r) => s + (r.fields["Base Imponible"] || 0), 0);
  const tCob = fi.filter(r => r.fields["Estado"] === "Cobrada").reduce((s, r) => s + (r.fields["Base Imponible"] || 0), 0);
  const tPend = fi.filter(r => ["Pendiente", "Vencida"].includes(r.fields["Estado"]))
    .reduce((s, r) => s + (r.fields["Base Imponible"] || 0), 0);
  const ivaR = fi.reduce((s, r) => s + (r.fields["IVA (€)"] || 0), 0);
  const ivaS = fg.reduce((s, r) => s + (r.fields["IVA Soportado (€)"] || 0), 0);
  const irpfRet = fg.reduce((s, r) => s + (r.fields["IRPF Retenido (€)"] || 0), 0);
  const tGast = fg.reduce((s, r) => s + (r.fields["Base Imponible"] || 0), 0);
  const irpfClientes = fi.reduce((s, r) => s + (r.fields["IRPF (€)"] || 0), 0);
  const benef = tFact - irpfClientes - tGast;
  const hucha = ivaR - ivaS + irpfRet;
  const venc = fi.filter(r => r.fields["Estado"] === "Vencida").length;
  const eficiencia = tFact > 0 ? Math.round((tCob / tFact) * 100) : 0;

  const mT = Math.max(
    new Set(fi.map(r => r.fields["Fecha"] ? new Date(r.fields["Fecha"]).getMonth() : -1).filter(m => m >= 0)).size,
    1
  );
  const bMes = benef / mT;

  // Próximo cierre IVA
  const proxIVA = nextIVAClosingDate();
  const diasIVA = Math.max(0, Math.floor((proxIVA.date - new Date()) / 86400000));
  const ivaTrim = ingresos.filter(r => r.fields["Fecha"] && getTrimestre(r.fields["Fecha"]) === proxIVA.tri)
    .reduce((s, r) => s + (r.fields["IVA (€)"] || 0), 0)
    - gastos.filter(r => r.fields["Fecha"] && getTrimestre(r.fields["Fecha"]) === proxIVA.tri)
    .reduce((s, r) => s + (r.fields["IVA Soportado (€)"] || 0), 0);

  // Cuota autónomos
  const cuotaActual = (() => {
    try { return Number(localStorage.getItem("ga_cuota")) || 294; } catch { return 294; }
  })();
  const tramoInfo = calcularTramo(ingresos, gastos, tramos, cuotaActual);

  // Alertas activas
  const alertasActivas = (alertas || []).filter(a => a.fields["Mostrada"] !== true).length;

  const [editS, setEditS] = useState(false);
  const [tmpS, setTmpS] = useState(salObj);

  // Datos gráfica
  const mRange = filtro.tri
    ? { Q1: [0, 1, 2], Q2: [3, 4, 5], Q3: [6, 7, 8], Q4: [9, 10, 11] }[filtro.tri]
    : filtro.mes !== ""
      ? [Number(filtro.mes)]
      : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].filter(m => m <= new Date().getMonth());

  const mData = mRange.map(mi => ({
    mes: MESES[mi],
    ing: fi.filter(r => {
      const d = r.fields["Fecha"];
      return d && new Date(d).getMonth() === mi;
    }).reduce((s, r) => s + (r.fields["Base Imponible"] || 0), 0),
    gas: fg.filter(r => {
      const d = r.fields["Fecha"];
      return d && new Date(d).getMonth() === mi;
    }).reduce((s, r) => s + (r.fields["Base Imponible"] || 0), 0)
  }));

  const mx = Math.max(...mData.map(d => Math.max(d.ing, d.gas)), 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <SectionHeader title="Dashboard" />
      <FilterBar filtro={filtro} setFiltro={setFiltro} />

      {/* FILA 1: KPIs principales */}
      <div style={{
        display: "grid",
        gridTemplateColumns: `repeat(${columnsForGrid}, 1fr)`,
        gap: 14
      }}>
        <Card>
          <Lbl>Facturado Total</Lbl>
          <Big color={B.purple}>{fmt(tFact)}</Big>
          <Sub>Base imponible</Sub>
        </Card>
        <Card>
          <Lbl>Total Gastos</Lbl>
          <Big color={B.red}>{fmt(tGast)}</Big>
          <Sub>Del período</Sub>
        </Card>
        <Card>
          <Lbl>Beneficio Neto</Lbl>
          <Big color={benef > 0 ? B.green : B.red}>{fmt(benef)}</Big>
          <Sub>{fmt(bMes)}/mes</Sub>
        </Card>
        <Card>
          <Lbl>Pendiente Cobro</Lbl>
          <Big color={B.amber}>{fmt(tPend)}</Big>
          <Sub>{venc} vencida{venc !== 1 ? "s" : ""}</Sub>
        </Card>
      </div>

      {/* HUCHA DE HACIENDA */}
      <div style={{
        background: B.text,
        borderRadius: 12,
        padding: isMobile ? "22px 18px" : "28px 28px 24px",
        color: "#fff",
        position: "relative",
        overflow: "hidden"
      }}>
        {!isMobile && (
          <div style={{
            position: "absolute",
            top: -8,
            right: 20,
            fontSize: 72,
            opacity: 0.06,
            fontFamily: B.tM,
            fontWeight: 700
          }}>
            HACIENDA
          </div>
        )}
        <Lbl><span style={{ color: "rgba(255,255,255,0.6)" }}>HUCHA DE HACIENDA — DINERO INTOCABLE</span></Lbl>
        <div style={{
          fontSize: isMobile ? 32 : 44,
          fontWeight: 700,
          marginTop: 8,
          fontFamily: B.tM
        }}>
          {fmt(hucha)}
        </div>
        <div style={{
          display: "flex",
          gap: isMobile ? 10 : 20,
          marginTop: 14,
          fontSize: isMobile ? 11 : 12,
          opacity: 0.65,
          fontFamily: B.tS,
          flexWrap: "wrap"
        }}>
          <span>IVA Repercutido: {fmt(ivaR)}</span>
          <span>IVA Soportado: {fmt(ivaS)}</span>
          <span>IRPF Retenido proveedores: {fmt(irpfRet)}</span>
        </div>
      </div>

      {/* FILA 2: Próximo IVA + Cuota */}
      <div style={{
        display: "grid",
        gridTemplateColumns: isPhoneOrSmallTablet ? "1fr" : "1fr 1fr",
        gap: 14
      }}>
        <Card style={{ borderLeft: `4px solid ${diasIVA <= 7 ? B.red : diasIVA <= 15 ? B.amber : B.purple}` }}>
          <Lbl>Próximo cierre IVA ({proxIVA.tri})</Lbl>
          <div style={{
            display: "flex",
            alignItems: "baseline",
            gap: 8,
            marginTop: 6,
            flexWrap: "wrap"
          }}>
            <span style={{
              fontSize: 30,
              fontWeight: 700,
              color: diasIVA <= 7 ? B.red : diasIVA <= 15 ? B.amber : B.text,
              fontFamily: B.tM
            }}>
              {diasIVA}
            </span>
            <span style={{ fontSize: 13, color: B.muted }}>
              día{diasIVA !== 1 ? "s" : ""} restante{diasIVA !== 1 ? "s" : ""}
            </span>
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: B.muted, fontFamily: B.tS }}>
            Modelo 303 · A ingresar: <strong style={{ color: B.text }}>{fmt(ivaTrim)}</strong>
          </div>
          <div style={{ marginTop: 4, fontSize: 11, color: B.muted, fontFamily: B.tM }}>
            {proxIVA.date.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
          </div>
        </Card>

        {tramoInfo && (
          <Card style={{ borderLeft: `4px solid ${tramoInfo.diff === 0 ? B.green : Math.abs(tramoInfo.diff) > 50 ? B.red : B.amber}` }}>
            <Lbl>Cuota Autónomos</Lbl>
            <div style={{
              display: "flex",
              alignItems: "baseline",
              gap: 8,
              marginTop: 6,
              flexWrap: "wrap"
            }}>
              <span style={{ fontSize: 30, fontWeight: 700, color: B.text, fontFamily: B.tM }}>
                Tramo {tramoInfo.tramo}
              </span>
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: B.muted, fontFamily: B.tS }}>
              Pagas: <strong>{fmt(cuotaActual)}</strong> · Correcta: <strong style={{ color: B.text }}>{fmt(tramoInfo.cuotaCorrecta)}</strong>
            </div>
            {tramoInfo.diff !== 0 && (
              <div style={{
                marginTop: 4,
                fontSize: 12,
                color: tramoInfo.diff > 0 ? B.red : B.green,
                fontWeight: 600
              }}>
                {tramoInfo.diff > 0
                  ? `⚠️ Pagas ${fmt(Math.abs(tramoInfo.diff))}/mes de menos`
                  : `✅ Ahorro posible: ${fmt(Math.abs(tramoInfo.diff))}/mes`}
              </div>
            )}
          </Card>
        )}
      </div>

      {/* FILA 3: Eficiencia + Alertas */}
      <div style={{
        display: "grid",
        gridTemplateColumns: isPhoneOrSmallTablet ? "1fr" : "1fr 1fr",
        gap: 14
      }}>
        <Card>
          <Lbl>Eficiencia de Cobro</Lbl>
          <div style={{ marginTop: 10 }}>
            <PBar
              value={tCob}
              max={tFact || 1}
              label={`${eficiencia}% cobrado`}
              color={eficiencia >= 80 ? B.green : eficiencia >= 50 ? B.amber : B.red}
            />
          </div>
          <div style={{ marginTop: 10, fontSize: 12, color: B.muted, fontFamily: B.tS }}>
            Cobrado: <strong style={{ color: B.green }}>{fmt(tCob)}</strong> · Pendiente: <strong style={{ color: B.amber }}>{fmt(tFact - tCob)}</strong>
          </div>
        </Card>

        <Card style={{ borderLeft: `4px solid ${alertasActivas > 0 ? B.amber : B.green}` }}>
          <Lbl>Alertas Activas</Lbl>
          <div style={{
            display: "flex",
            alignItems: "baseline",
            gap: 8,
            marginTop: 6
          }}>
            <span style={{
              fontSize: 30,
              fontWeight: 700,
              color: alertasActivas > 0 ? B.amber : B.green,
              fontFamily: B.tM
            }}>
              {alertasActivas}
            </span>
            <span style={{ fontSize: 13, color: B.muted }}>
              sin atender
            </span>
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: B.muted, fontFamily: B.tS }}>
            {alertasActivas > 0
              ? "Revisa la sección Alertas para verlas"
              : "Todo bajo control 🎉"}
          </div>
        </Card>
      </div>

      {/* OBJETIVO SALARIO */}
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <Lbl>Objetivo Salario</Lbl>
          <button
            onClick={() => {
              if (editS) {
                setSalObj(Number(tmpS));
                try { localStorage.setItem("ga_salario", tmpS); } catch {}
              }
              setEditS(!editS);
            }}
            style={B.btnSm}
          >
            {editS ? "GUARDAR" : "EDITAR"}
          </button>
        </div>
        {editS && (
          <div style={{ marginBottom: 12 }}>
            <input
              type="number"
              value={tmpS}
              onChange={e => setTmpS(e.target.value)}
              style={{ ...B.inp, fontSize: 18, fontWeight: 700, fontFamily: B.tM, textAlign: "center" }}
            />
          </div>
        )}
        <PBar value={bMes} max={salObj} label="Beneficio neto medio mensual" color={bMes >= salObj ? B.green : B.amber} />
      </Card>

      {/* GRÁFICA INGRESOS VS GASTOS */}
      {mData.length > 0 && (
        <Card>
          <Lbl>Ingresos vs Gastos</Lbl>
          <div style={{ display: "flex", gap: 16, margin: "14px 0 8px", fontSize: 12, fontFamily: B.tS }}>
            <span><span style={{ color: B.purple }}>■</span> Ingresos</span>
            <span><span style={{ color: B.red + "88" }}>■</span> Gastos</span>
          </div>
          <div style={{
            display: "flex",
            alignItems: "flex-end",
            gap: 8,
            height: 150,
            overflowX: isMobile ? "auto" : "visible",
            paddingBottom: isMobile ? 4 : 0
          }}>
            {mData.map((d, i) => (
              <div key={i} style={{
                flex: isMobile ? "0 0 40px" : 1,
                minWidth: isMobile ? 40 : "auto",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4
              }}>
                <div style={{ display: "flex", gap: 3, alignItems: "flex-end", height: 120, width: "100%" }}>
                  <div style={{
                    flex: 1,
                    background: B.purple,
                    borderRadius: "3px 3px 0 0",
                    height: `${(d.ing / mx) * 100}%`,
                    minHeight: 2
                  }} />
                  <div style={{
                    flex: 1,
                    background: B.red + "77",
                    borderRadius: "3px 3px 0 0",
                    height: `${(d.gas / mx) * 100}%`,
                    minHeight: 2
                  }} />
                </div>
                <span style={{ fontSize: 11, color: B.muted, fontWeight: 600, fontFamily: B.tM }}>{d.mes}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
