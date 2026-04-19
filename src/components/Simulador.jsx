// src/components/Simulador.jsx
// Calculadora rápida: dado una base imponible, ¿cuánto te queda limpio?

import { useState } from "react";
import { B, fmt, calcIVA, calcIRPF } from "../utils.js";
import { useResponsive } from "../hooks/useResponsive.js";
import { Card, Lbl, SectionHeader } from "./UI.jsx";

export default function Simulador() {
  const { isMobile } = useResponsive();
  const [base, setBase] = useState(500);

  const iva = calcIVA(base);
  const irpf = calcIRPF(base);
  const tot = base + iva - irpf;
  const limpio = base - irpf;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <SectionHeader title="Simulador de Precios" />

      <Card>
        <Lbl>Base Imponible</Lbl>

        <input
          type="range"
          min="50"
          max="5000"
          step="10"
          value={base}
          onChange={e => setBase(Number(e.target.value))}
          style={{ width: "100%", accentColor: B.text, marginTop: 12 }}
        />

        <div style={{
          textAlign: "center",
          fontSize: isMobile ? 32 : 44,
          fontWeight: 700,
          margin: "8px 0",
          fontFamily: B.tM
        }}>
          {fmt(base)}
        </div>

        {/* Permitir escribir un valor exacto */}
        <input
          type="number"
          value={base}
          onChange={e => setBase(Number(e.target.value) || 0)}
          min="0"
          style={{
            ...B.inp,
            textAlign: "center",
            maxWidth: 200,
            margin: "0 auto",
            display: "block",
            fontFamily: B.tM,
            fontWeight: 600
          }}
        />

        <div style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr",
          gap: 14,
          marginTop: 20
        }}>
          <div style={{
            background: "rgba(0,0,0,0.03)",
            borderRadius: 8,
            padding: 18,
            textAlign: "center"
          }}>
            <div style={{
              fontSize: 11,
              color: B.muted,
              fontFamily: B.tM,
              textTransform: "uppercase"
            }}>
              + IVA 21%
            </div>
            <div style={{
              fontSize: isMobile ? 18 : 22,
              fontWeight: 700,
              color: B.green,
              fontFamily: B.tM
            }}>
              {fmt(iva)}
            </div>
          </div>

          <div style={{
            background: "rgba(0,0,0,0.03)",
            borderRadius: 8,
            padding: 18,
            textAlign: "center"
          }}>
            <div style={{
              fontSize: 11,
              color: B.muted,
              fontFamily: B.tM,
              textTransform: "uppercase"
            }}>
              − IRPF 15%
            </div>
            <div style={{
              fontSize: isMobile ? 18 : 22,
              fontWeight: 700,
              color: B.red,
              fontFamily: B.tM
            }}>
              {fmt(irpf)}
            </div>
          </div>

          <div style={{
            background: "rgba(0,0,0,0.03)",
            borderRadius: 8,
            padding: 18,
            textAlign: "center"
          }}>
            <div style={{
              fontSize: 11,
              color: B.muted,
              fontFamily: B.tM,
              textTransform: "uppercase"
            }}>
              Total Factura
            </div>
            <div style={{
              fontSize: isMobile ? 18 : 22,
              fontWeight: 700,
              color: B.purple,
              fontFamily: B.tM
            }}>
              {fmt(tot)}
            </div>
          </div>

          <div style={{
            background: B.text,
            borderRadius: 8,
            padding: 18,
            textAlign: "center",
            color: "#fff"
          }}>
            <div style={{
              fontSize: 11,
              opacity: 0.8,
              fontFamily: B.tM,
              textTransform: "uppercase"
            }}>
              Te queda limpio
            </div>
            <div style={{
              fontSize: isMobile ? 18 : 22,
              fontWeight: 700,
              fontFamily: B.tM
            }}>
              {fmt(limpio)}
            </div>
          </div>
        </div>

        {/* Mini explicación */}
        <div style={{
          marginTop: 20,
          padding: 14,
          background: B.yellow + "30",
          borderRadius: 8,
          fontSize: 12,
          color: B.text,
          fontFamily: B.tS,
          lineHeight: 1.5
        }}>
          <strong>Recuerda:</strong> el cliente te paga {fmt(tot)} (Base + IVA − IRPF retenido). El IVA ({fmt(iva)}) NO es tuyo, va a la Hucha de Hacienda. Lo que realmente te queda como ingreso bruto es {fmt(limpio)}, antes de descontar tus gastos.
        </div>
      </Card>
    </div>
  );
}
