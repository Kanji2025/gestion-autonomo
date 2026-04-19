// src/components/Dashboard.jsx
// Panel principal: KPIs, Hucha de Hacienda, gráfica, flujo de caja.

import { useState } from "react";
import { B, fmt, MESES, applyF } from "../utils.js";
import { useResponsive } from "../hooks/useResponsive.js";
import { Card, Lbl, Big, Sub, PBar, FilterBar, SectionHeader } from "./UI.jsx";

export default function Dashboard({ ingresos, gastos, salObj, setSalObj, filtro, setFiltro }) {
  const { columnsForGrid, isMobile, isPhoneOrSmallTablet } = useResponsive();

  const fi = applyF(ingresos, filtro);
  const fg = applyF(gastos, filtro);

  const tFact = fi.reduce((s, r) => s + (r.fields["Base Imponible"] || 0), 0);
  const tCob = fi.filter(r => r.fields["Estado"] === "Cobrada").reduce((s, r) => s + (r.fields["Base Imponible"] || 0), 0);
  const ivaR = fi.reduce((s, r) => s + (r.fields["IVA (€)"] || 0), 0);
  const ivaS = fg.reduce((s, r) => s + (r.fields["IVA Soportado (€)"] || 0), 0);
  // IRPF retenido = lo que retienes a proveedores (en gastos), NO el de tus facturas
  const irpfRet = fg.reduce((s, r) => s + (r.fields["IRPF Retenido (€)"] || 0), 0);
  const tGast = fg.reduce((s, r) => s + (r.fields["Base Imponible"] || 0), 0);
  // IRPF que te retienen tus clientes (reduce tu beneficio real)
  const irpfClientes = fi.reduce((s, r) => s + (r.fields["IRPF (€)"] || 0), 0);
  // Beneficio neto REAL = Facturado - IRPF retenido por clientes - Gastos
  const benef = tFact - irpfClientes - tGast;
  // HUCHA: IVA Rep - IVA Sop + IRPF retenido a proveedores
  const hucha = ivaR - ivaS + irpfRet;
  const venc = fi.filter(r => r.fields["Estado"] === "Vencida").length;

  const mT = Math.max(
    new Set(fi.map(r => r.fields["Fecha"] ? new Date(r.fields["Fecha"]).getMonth() : -1).filter(m => m >= 0)).size,
    1
  );
  const bMes = benef / mT;

  const [editS, setEditS] = useState(false);
  const [tmpS, setTmpS] = useState(salObj);

  // Rango de meses a mostrar en la gráfica
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

      {/* KPIs principales: grid responsive */}
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
          <Lbl>Cobrado Real</Lbl>
          <Big color={B.green}>{fmt(tCob)}</Big>
          <Sub>En tu cuenta</Sub>
        </Card>
        <Card>
          <Lbl>Beneficio Neto</Lbl>
          <Big color={benef > 0 ? B.green : B.red}>{fmt(benef)}</Big>
          <Sub>{fmt(bMes)}/mes (IRPF descontado)</Sub>
        </Card>
        <Card>
          <Lbl>Facturas Vencidas</Lbl>
          <Big color={B.red}>{venc}</Big>
          <Sub>Sin cobrar</Sub>
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

      {/* Objetivo salario + IVA trimestral: 2 cols en escritorio, 1 en móvil */}
      <div style={{
        display: "grid",
        gridTemplateColumns: isPhoneOrSmallTablet ? "1fr" : "1fr 1fr",
        gap: 14
      }}>
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
          <PBar value={bMes} max={salObj} label="Media mensual" color={bMes >= salObj ? B.green : B.amber} />
        </Card>

        <Card>
          <Lbl>IVA Trimestral</Lbl>
          <Big color={B.purple}>{fmt(ivaR - ivaS)}</Big>
          <Sub>Modelo 303</Sub>
        </Card>
      </div>

      {/* Gráfica Ingresos vs Gastos */}
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

      {/* Flujo de Caja */}
      <Card>
        <Lbl>Flujo de Caja</Lbl>
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 14,
          marginTop: 14
        }}>
          <div style={{ textAlign: "center", padding: 18, background: "rgba(0,0,0,0.03)", borderRadius: 8 }}>
            <div style={{ fontSize: 11, color: B.muted, fontFamily: B.tM, textTransform: "uppercase" }}>Facturado</div>
            <div style={{ fontSize: isMobile ? 20 : 26, fontWeight: 700, color: B.purple, fontFamily: B.tM, marginTop: 4 }}>
              {fmt(tFact)}
            </div>
          </div>
          <div style={{ textAlign: "center", padding: 18, background: "rgba(0,0,0,0.03)", borderRadius: 8 }}>
            <div style={{ fontSize: 11, color: B.muted, fontFamily: B.tM, textTransform: "uppercase" }}>Cobrado</div>
            <div style={{ fontSize: isMobile ? 20 : 26, fontWeight: 700, color: B.green, fontFamily: B.tM, marginTop: 4 }}>
              {fmt(tCob)}
            </div>
          </div>
        </div>
        <div style={{ marginTop: 12, textAlign: "center", fontSize: 13, color: B.muted }}>
          Pendiente: <strong style={{ color: B.amber }}>{fmt(tFact - tCob)}</strong>
        </div>
      </Card>
    </div>
  );
}
