// src/components/Dashboard.jsx
// Panel principal: saludo + KPIs + Hucha (lavanda) + filas info + salario (amarillo) + gráfica.
// REDISEÑO 2026: solo colores de marca (amarillo + lavanda + negro/grises).

import { useState } from "react";
import {
  FileText, Receipt, TrendingUp, TrendingDown, Clock,
  Calendar, ShieldCheck, Activity, Bell, Target,
  Edit3, Check
} from "lucide-react";

import { B, fmt, MESES, applyF, getTrimestre, mesActualLabel } from "../utils.js";
import { useResponsive } from "../hooks/useResponsive.js";
import { Card, Lbl, PBar, FilterBar, PageHeader, IconPill, Btn } from "./UI.jsx";

// ============================================================
// HELPERS (lógica idéntica al original)
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
// SUBCOMPONENTES LOCALES
// ============================================================
function KPICard({ icon, label, value, sub }) {
  return (
    <Card>
      <IconPill icon={icon} />
      <div style={{ marginTop: 16 }}>
        <Lbl>{label}</Lbl>
      </div>
      <div style={{
        fontSize: B.ty.numL,
        fontWeight: 700,
        marginTop: 6,
        color: B.ink,
        letterSpacing: "-0.02em",
        fontFamily: B.font,
        ...B.num
      }}>
        {value}
      </div>
      {sub && (
        <div style={{
          fontSize: B.ty.small,
          color: B.ink,
          marginTop: 4,
          fontFamily: B.font
        }}>
          {sub}
        </div>
      )}
    </Card>
  );
}

function BreakdownItem({ label, value, sign }) {
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
        {sign === "+" ? "+" : sign === "−" ? "−" : ""}{fmt(Math.abs(value))}
      </div>
    </div>
  );
}

function LegendDot({ color, label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ width: 9, height: 9, background: color, borderRadius: 3, display: "inline-block" }} />
      <span style={{ fontSize: 12, color: B.ink, fontWeight: 500, fontFamily: B.font }}>{label}</span>
    </div>
  );
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================
export default function Dashboard({
  ingresos, gastos, tramos, alertas,
  salObj, setSalObj,
  filtro, setFiltro
}) {
  const { columnsForGrid, isMobile, isPhoneOrSmallTablet } = useResponsive();

  const fi = applyF(ingresos, filtro);
  const fg = applyF(gastos, filtro);

  // Cálculos (idénticos al original)
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

  // Edición salario
  const [editS, setEditS] = useState(false);
  const [tmpS, setTmpS] = useState(salObj);
  const reached = bMes >= salObj;
  const remaining = Math.max(salObj - bMes, 0);
  const pctSal = Math.min(Math.max((bMes / (salObj || 1)) * 100, 0), 100);

  const saveSal = () => {
    setSalObj(Number(tmpS) || 0);
    try { localStorage.setItem("ga_salario", String(tmpS)); } catch {}
    setEditS(false);
  };

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
      <PageHeader
        title="Hola, María."
        subtitle={`Esto es tu negocio en ${mesActualLabel()}.`}
      />

      <FilterBar filtro={filtro} setFiltro={setFiltro} />

      {/* KPIs */}
      <div style={{
        display: "grid",
        gridTemplateColumns: `repeat(${columnsForGrid}, 1fr)`,
        gap: 14
      }}>
        <KPICard
          icon={FileText}
          label="Facturado total"
          value={fmt(tFact)}
          sub="Base imponible"
        />
        <KPICard
          icon={Receipt}
          label="Total gastos"
          value={fmt(tGast)}
          sub="Del período"
        />
        <KPICard
          icon={benef >= 0 ? TrendingUp : TrendingDown}
          label="Beneficio neto"
          value={fmt(benef)}
          sub={`${fmt(bMes)} de media al mes`}
        />
        <KPICard
          icon={Clock}
          label="Pendiente cobro"
          value={fmt(tPend)}
          sub={venc > 0 ? `${venc} vencida${venc !== 1 ? "s" : ""}` : "Todo al día"}
        />
      </div>

      {/* HUCHA DE HACIENDA — lavanda con borde negro */}
      <Card accent="lavender" style={{ overflow: "hidden", position: "relative" }}>
     <Lbl>Hucha de Hacienda · Dinero intocable</Lbl>
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
          {fmt(hucha)}
        </div>
        <p style={{
          fontSize: B.ty.small,
          color: B.ink,
          margin: "12px 0 0",
          fontFamily: B.font,
          lineHeight: 1.5,
          maxWidth: 480
        }}>
          Apártalo en otra cuenta antes del próximo cierre. Este dinero no es tuyo.
        </p>

        <div style={{
          marginTop: 24,
          paddingTop: 22,
          borderTop: `1px solid ${B.ink}22`,
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)",
          gap: isMobile ? 16 : 24,
          position: "relative",
          zIndex: 1
        }}>
          <BreakdownItem label="IVA repercutido" value={ivaR} sign="+" />
          <BreakdownItem label="IVA soportado" value={ivaS} sign="−" />
          <BreakdownItem label="IRPF retenido" value={irpfRet} sign="+" />
        </div>
      </Card>

      {/* FILA: Próximo IVA + Cuota Autónomos */}
      <div style={{
        display: "grid",
        gridTemplateColumns: isPhoneOrSmallTablet ? "1fr" : "1fr 1fr",
        gap: 14
      }}>
        <Card>
          <IconPill icon={Calendar} />
          <div style={{ marginTop: 16 }}>
            <Lbl>Próximo cierre IVA ({proxIVA.tri})</Lbl>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
            <span style={{
              fontSize: B.ty.numL,
              fontWeight: 700,
              color: B.ink,
              fontFamily: B.font,
              letterSpacing: "-0.02em",
              ...B.num
            }}>
              {diasIVA}
            </span>
            <span style={{ fontSize: B.ty.small, color: B.ink, fontFamily: B.font }}>
              día{diasIVA !== 1 ? "s" : ""} restante{diasIVA !== 1 ? "s" : ""}
            </span>
          </div>
          <div style={{ marginTop: 10, fontSize: B.ty.small, color: B.ink, fontFamily: B.font }}>
            Modelo 303 · A ingresar: <strong style={{ color: B.ink, ...B.num }}>{fmt(ivaTrim)}</strong>
          </div>
          <div style={{ marginTop: 4, fontSize: 12, color: B.soft, fontFamily: B.font, textTransform: "capitalize" }}>
            {proxIVA.date.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
          </div>
        </Card>

        {tramoInfo && (
          <Card>
            <IconPill icon={ShieldCheck} />
            <div style={{ marginTop: 16 }}>
              <Lbl>Cuota autónomos</Lbl>
            </div>
            <div style={{ marginTop: 6 }}>
              <span style={{
                fontSize: B.ty.numL,
                fontWeight: 700,
                color: B.ink,
                fontFamily: B.font,
                letterSpacing: "-0.02em"
              }}>
                Tramo {tramoInfo.tramo}
              </span>
            </div>
            <div style={{ marginTop: 10, fontSize: B.ty.small, color: B.ink, fontFamily: B.font }}>
              Pagas: <strong style={{ color: B.ink, ...B.num }}>{fmt(cuotaActual)}</strong> · Correcta: <strong style={{ color: B.ink, ...B.num }}>{fmt(tramoInfo.cuotaCorrecta)}</strong>
            </div>
            {tramoInfo.diff !== 0 && Math.abs(tramoInfo.diff) >= 1 && (
              <div style={{
                marginTop: 6,
                fontSize: 12,
                color: B.ink,
                fontWeight: 600,
                fontFamily: B.font
              }}>
                {tramoInfo.diff > 0
                  ? `Pagas ${fmt(Math.abs(tramoInfo.diff))}/mes de menos`
                  : `Ahorro posible: ${fmt(Math.abs(tramoInfo.diff))}/mes`}
              </div>
            )}
          </Card>
        )}
      </div>

      {/* FILA: Eficiencia + Alertas */}
      <div style={{
        display: "grid",
        gridTemplateColumns: isPhoneOrSmallTablet ? "1fr" : "1fr 1fr",
        gap: 14
      }}>
        <Card>
          <IconPill icon={Activity} />
          <div style={{ marginTop: 16 }}>
            <Lbl>Eficiencia de cobro</Lbl>
          </div>
          <div style={{ marginTop: 12 }}>
            <PBar
              value={tCob}
              max={tFact || 1}
              label={`${eficiencia}% cobrado`}
              color={B.ink}
            />
          </div>
          <div style={{ marginTop: 10, fontSize: B.ty.small, color: B.ink, fontFamily: B.font }}>
            Cobrado: <strong style={{ color: B.ink, ...B.num }}>{fmt(tCob)}</strong> · Pendiente: <strong style={{ color: B.ink, ...B.num }}>{fmt(tFact - tCob)}</strong>
          </div>
        </Card>

        <Card>
          <IconPill icon={Bell} />
          <div style={{ marginTop: 16 }}>
            <Lbl>Alertas activas</Lbl>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 6 }}>
            <span style={{
              fontSize: B.ty.numL,
              fontWeight: 700,
              color: B.ink,
              fontFamily: B.font,
              letterSpacing: "-0.02em",
              ...B.num
            }}>
              {alertasActivas}
            </span>
            <span style={{ fontSize: B.ty.small, color: B.ink, fontFamily: B.font }}>
              sin atender
            </span>
          </div>
          <div style={{ marginTop: 8, fontSize: B.ty.small, color: B.ink, fontFamily: B.font }}>
            {alertasActivas > 0
              ? "Revisa la sección Alertas."
              : "Todo bajo control."}
          </div>
        </Card>
      </div>

      {/* OBJETIVO SALARIO — amarillo Kanji con borde negro */}
      <Card accent="yellow">
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
          flexWrap: "wrap"
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <IconPill icon={Target} size={28} />
              <Lbl>Tu salario este mes</Lbl>
            </div>
            <h2 style={{
              fontSize: B.ty.h2,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              margin: "8px 0 0",
              color: B.ink,
              lineHeight: 1.25,
              fontFamily: B.font
            }}>
              {reached ? "Has superado tu objetivo." : `Te quedan ${fmt(remaining)}.`}
            </h2>
            <p style={{
              fontSize: B.ty.small,
              color: B.ink,
              margin: "4px 0 0",
              fontFamily: B.font
            }}>
              Llevas {fmt(Math.max(bMes, 0))} de los {fmt(salObj)} que te marcaste.
            </p>
          </div>
          {editS ? (
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                type="number"
                value={tmpS}
                onChange={e => setTmpS(e.target.value)}
                style={{
                  width: 110,
                  padding: "8px 12px",
                  borderRadius: 999,
                  border: `1px solid ${B.ink}`,
                  fontSize: 13,
                  fontFamily: B.font,
                  fontWeight: 700,
                  outline: "none",
                  textAlign: "center",
                  background: "#fff",
                  ...B.num
                }}
              />
              <Btn size="sm" icon={Check} onClick={saveSal}>Guardar</Btn>
            </div>
          ) : (
            <Btn variant="outline" size="sm" icon={Edit3} onClick={() => { setTmpS(salObj); setEditS(true); }}>
              Editar
            </Btn>
          )}
        </div>

        <div style={{
          height: 12,
          background: "rgba(0,0,0,0.08)",
          borderRadius: 999,
          overflow: "hidden",
          marginTop: 22
        }}>
          <div style={{
            width: `${pctSal}%`,
            height: "100%",
            background: B.ink,
            borderRadius: 999,
            transition: "width 1s ease"
          }} />
        </div>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 8,
          fontSize: 12,
          fontWeight: 500,
          color: B.ink,
          fontFamily: B.font,
          ...B.num
        }}>
          <span>0 €</span>
          <span style={{ color: B.ink, fontWeight: 600 }}>{Math.round(pctSal)}%</span>
          <span>{fmt(salObj)}</span>
        </div>
      </Card>

      {/* GRÁFICA INGRESOS VS GASTOS — lavanda + negro */}
      {mData.length > 0 && (
        <Card>
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 22,
            flexWrap: "wrap",
            gap: 12
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <Lbl>Ingresos vs gastos</Lbl>
              <h2 style={{
                fontFamily: B.font,
                fontSize: B.ty.h2,
                fontWeight: 700,
                letterSpacing: "-0.02em",
                margin: "8px 0 0",
                color: B.ink,
                lineHeight: 1.25
              }}>
                ¿Cubren tus ingresos los gastos?
              </h2>
            </div>
            <div style={{ display: "flex", gap: 14, flexShrink: 0, alignItems: "center" }}>
              <LegendDot color={B.lavender} label="Ingresos" />
              <LegendDot color={B.ink} label="Gastos" />
            </div>
          </div>
          <div style={{
            display: "flex",
            alignItems: "flex-end",
            gap: 8,
            height: 160,
            overflowX: isMobile ? "auto" : "visible",
            paddingBottom: isMobile ? 4 : 0
          }}>
            {mData.map((d, i) => (
              <div key={i} style={{
                flex: isMobile ? "0 0 44px" : 1,
                minWidth: isMobile ? 44 : "auto",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6
              }}>
                <div style={{ display: "flex", gap: 3, alignItems: "flex-end", height: 130, width: "100%" }}>
                  <div style={{
                    flex: 1,
                    background: B.lavender,
                    borderRadius: "3px 3px 0 0",
                    height: `${(d.ing / mx) * 100}%`,
                    minHeight: 2
                  }} />
                  <div style={{
                    flex: 1,
                    background: B.ink,
                    borderRadius: "3px 3px 0 0",
                    height: `${(d.gas / mx) * 100}%`,
                    minHeight: 2
                  }} />
                </div>
                <span style={{ fontSize: 11, color: B.ink, fontWeight: 600, fontFamily: B.font }}>
                  {d.mes}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
