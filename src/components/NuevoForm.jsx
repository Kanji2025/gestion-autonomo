// src/components/NuevoForm.jsx
// Formulario universal para añadir Factura (ingreso) o Ticket/Gasto.
// Para gastos: detección automática de Gasto Fijo por proveedor (mismo flujo que alta manual).

import { useState, useEffect } from "react";
import { B, hoy, convD } from "../utils.js";
import { useResponsive } from "../hooks/useResponsive.js";
import {
  createRecord,
  findOrCreateClient,
  runOCR,
  parseExpense,
  findGastoFijoByProveedor,
  createGastoFijo,
  linkGastoToGastoFijo
} from "../api.js";
import { Card, Lbl, Inp, Sel, SectionHeader, ErrorBox } from "./UI.jsx";

// ============================================================
// CARGAR PDF.JS DINÁMICAMENTE
// ============================================================
let pdfLib = null;
async function loadPdf() {
  if (pdfLib) return pdfLib;
  const s = document.createElement("script");
  s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
  document.head.appendChild(s);
  await new Promise((r, j) => { s.onload = r; s.onerror = j; });
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  pdfLib = window.pdfjsLib;
  return pdfLib;
}

async function pdf2img(buf) {
  const lib = await loadPdf();
  const pdf = await lib.getDocument({ data: buf }).promise;
  const pg = await pdf.getPage(1);
  const vp = pg.getViewport({ scale: 2.5 });
  const c = document.createElement("canvas");
  c.width = vp.width;
  c.height = vp.height;
  await pg.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
  return c.toDataURL("image/png").split(",")[1];
}

// ============================================================
// DETECTAR CIF/NIF ESPAÑOL
// ============================================================
function detectarCIF(texto, numeroFactura) {
  let cif = "";

  const reEtiqueta = /(?:C\.?\s*I\.?\s*F\.?|N\.?\s*I\.?\s*F\.?|DNI)[\s:.\-]*\n?\s*([A-HJNP-SUVW][\-\s]?\d{7,8}[A-Z]?|\d{8}[\-\s]?[A-Z])/i;
  const matchEtiqueta = texto.match(reEtiqueta);
  if (matchEtiqueta) {
    cif = matchEtiqueta[1].replace(/[\-\s]/g, "").toUpperCase();
    return cif;
  }

  const reEmpresa = /(?<![A-Z0-9])([A-HJNP-SUVW]\d{7}[0-9A-Z])(?![A-Z0-9])/g;
  const matchesEmpresa = [...texto.matchAll(reEmpresa)];
  for (const m of matchesEmpresa) {
    if (numeroFactura && m[1].toUpperCase() === numeroFactura.toUpperCase()) continue;
    cif = m[1].toUpperCase();
    return cif;
  }

  const reNif = /(?<![A-Z0-9])(\d{8}[A-Z])(?![A-Z0-9])/;
  const matchNif = texto.match(reNif);
  if (matchNif) {
    cif = matchNif[1].toUpperCase();
    return cif;
  }

  return "";
}

// ============================================================
// PARSER DE FACTURAS (INGRESOS) - regex posicional
// ============================================================
function parseFactura(text) {
  const t = text.replace(/\r/g, "");
  const lines = t.split("\n").map(l => l.trim()).filter(l => l);

  const num = (t.match(/(?:factura|fra)[:\s]*\n?\s*([A-Z0-9][\w\-\/]*\d+)/i) ||
               t.match(/(?:nº|n°)[:\s]*\s*([A-Z0-9][\w\-\/]+)/i) || [])[1] || "";

  const fM = t.match(/(?:fecha(?:\s+de\s+factura)?)[:\s]*\n?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i) ||
             t.match(/(\d{2}[\/-]\d{2}[\/-]\d{4})/);
  const fecha = fM ? fM[1] : "";

  const cif = detectarCIF(t, num);

  let base = 0, iva = 0, irpf = 0, total = 0;

  const amounts = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^-?([0-9]+[.,]\d{2})\s*€$/);
    if (m) {
      const v = m[1].replace(/\./g, "").replace(",", ".");
      amounts.push({ idx: i, val: parseFloat(v), line: lines[i] });
    }
  }

  const findLine = (kw) => {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes(kw.toLowerCase())) return i;
    }
    return -1;
  };

  const subIdx = findLine("Subtotal");

  if (subIdx >= 0) {
    const subAmounts = amounts.filter(a => a.idx > subIdx);
    if (subAmounts.length >= 1) base = subAmounts[0].val;
    if (subAmounts.length >= 2) iva = subAmounts[1].val;
    if (subAmounts.length >= 3) irpf = subAmounts[2].val;
    if (subAmounts.length >= 4) total = subAmounts[3].val;
  } else {
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (/subtotal|base\s*imponible/i.test(l)) {
        const m = l.match(/([0-9.,]+)\s*€/);
        if (m) base = parseFloat(m[1].replace(/\./g, "").replace(",", "."));
      }
      if (/^iva/i.test(l)) {
        const m = l.match(/([0-9.,]+)\s*€/);
        if (m) iva = parseFloat(m[1].replace(/\./g, "").replace(",", "."));
      }
      if (/irpf/i.test(l)) {
        const m = l.match(/([0-9.,]+)\s*€/);
        if (m) irpf = parseFloat(m[1].replace(/\./g, "").replace(",", "."));
      }
      if (/^total$/i.test(l.replace(/\s/g, ""))) {
        if (i + 1 < lines.length) {
          const m = lines[i + 1].match(/([0-9.,]+)\s*€/);
          if (m) total = parseFloat(m[1].replace(/\./g, "").replace(",", "."));
        }
      }
    }
  }

  const clM = t.match(/Para\s*\n\s*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑa-záéíóúñ\s]+)/);
  let cliente = clM ? clM[1].trim().split("\n")[0].trim() : "";
  if (cliente.length > 60) cliente = cliente.substring(0, 60);

  const dsM = t.match(/(?:ESTRATEGIA|CONTENIDO|Descripci[oó]n)[:\s+]*([^\n]*)/i);
  let desc = dsM ? dsM[1].trim() : "";
  if (!desc) {
    const di = findLine("ESTRATEGIA");
    if (di >= 0) desc = lines[di];
  }

  return { numero: num, fecha, cliente, cif, base, iva, irpf, total, desc };
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================
export default function NuevoForm({ onClose, onSaved, defaultTipo = "ingreso", lockTipo = false }) {
  const { isMobile, formColumns } = useResponsive();

  const [drag, setDrag] = useState(false);
  const [proc, setProc] = useState(false);
  const [procStep, setProcStep] = useState("");
  const [mode, setMode] = useState("choose");
  const [res, setRes] = useState(null);
  const [tipo, setTipo] = useState(defaultTipo);
  const [sav, setSav] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState("");

  // Campos comunes
  const [numero, sNumero] = useState("");
  const [fecha, sFecha] = useState(hoy());
  const [cliente, sCliente] = useState("");
  const [cif, sCif] = useState("");
  const [base, sBase] = useState("");
  const [iva, sIva] = useState("");
  const [irpf, sIrpf] = useState("");
  const [total, sTotal] = useState("");
  const [desc, sDesc] = useState("");
  const [estado, sEstado] = useState("Pendiente");
  const [fechaV, sFechaV] = useState("");
  const [fechaC, sFechaC] = useState("");
  const [concepto, sConcepto] = useState("");
  const [irpfG, sIrpfG] = useState("");
  const [proveedor, sProveedor] = useState("");

  // Estado de detección automática (solo para gastos)
  const [detectado, setDetectado] = useState(null);
  const [buscandoProv, setBuscandoProv] = useState(false);

  // Casos de Gasto Fijo
  const [altaComoFijo, setAltaComoFijo] = useState(false);
  const [esPuntual, setEsPuntual] = useState(false);
  const [periodFijo, setPeriodFijo] = useState("Mensual");
  const [monedaFijo, setMonedaFijo] = useState("EUR");

  const reset = () => {
    sNumero(""); sFecha(hoy()); sCliente(""); sCif(""); sBase(""); sIva("");
    sIrpf(""); sTotal(""); sDesc(""); sEstado("Pendiente"); sFechaV(""); sFechaC("");
    sConcepto(""); sIrpfG(""); sProveedor("");
    setDetectado(null); setBuscandoProv(false);
    setAltaComoFijo(false); setEsPuntual(false);
    setPeriodFijo("Mensual"); setMonedaFijo("EUR");
    setSaved(false); setErr(""); setRes(null);
  };

  // ============================================================
  // DETECCIÓN AUTOMÁTICA DEL PROVEEDOR (solo para gastos)
  // ============================================================
  useEffect(() => {
    if (tipo !== "gasto") return;
    const prov = proveedor.trim();
    if (!prov) {
      setDetectado(null);
      return;
    }
    setBuscandoProv(true);
    const timer = setTimeout(async () => {
      try {
        const found = await findGastoFijoByProveedor(prov);
        if (found) {
          setDetectado({ existe: true, gastoFijo: found });
        } else {
          setDetectado({ existe: false });
        }
      } catch (e) {
        console.warn("Error buscando proveedor:", e);
        setDetectado(null);
      }
      setBuscandoProv(false);
    }, 600);
    return () => clearTimeout(timer);
  }, [proveedor, tipo]);

  const handleFile = async (file) => {
    reset();
    setProc(true);
    setMode("ocr");
    setProcStep("Leyendo el documento...");

    try {
      let b64;
      if (file.type === "application/pdf") {
        b64 = await pdf2img(await file.arrayBuffer());
      } else {
        const du = await new Promise((r, j) => {
          const rd = new FileReader();
          rd.onload = () => r(rd.result);
          rd.onerror = j;
          rd.readAsDataURL(file);
        });
        b64 = du.split(",")[1];
      }

      setProcStep("Extrayendo texto con OCR...");
      const text = await runOCR(b64);
      console.log("OCR text:", text);

      if (!text || text.trim().length < 5) {
        setErr("No se pudo leer el documento. Prueba con una imagen más clara.");
        setProc(false);
        return;
      }

      if (tipo === "ingreso") {
        const p = parseFactura(text);
        setRes(p);
        sNumero(p.numero);
        sFecha(convD(p.fecha));
        sCliente(p.cliente);
        sCif(p.cif);
        sBase(String(p.base || ""));
        sIva(String(p.iva || ""));
        sIrpf(String(p.irpf || ""));
        sTotal(String(p.total || ""));
        sDesc(p.desc);
        sConcepto(p.desc);
      } else {
        setProcStep("Interpretando con IA...");
        const data = await parseExpense(text);
        console.log("Datos extraídos por IA:", data);

        setRes(data);
        if (data.fecha) sFecha(data.fecha);
        if (data.proveedor) sProveedor(data.proveedor);
        if (data.cif) sCif(data.cif);
        if (data.base != null) sBase(String(data.base));
        if (data.iva != null) sIva(String(data.iva));
        if (data.irpf != null) sIrpfG(String(data.irpf));
        if (data.total != null) sTotal(String(data.total));
        if (data.concepto) sConcepto(data.concepto);
        // Si la IA sugiere periodicidad recurrente, la guardamos para el alta como fijo
        if (data.periodicidad_sugerida && ["Mensual", "Trimestral", "Anual"].includes(data.periodicidad_sugerida)) {
          setPeriodFijo(data.periodicidad_sugerida);
        }
      }
    } catch (e) {
      console.error(e);
      setErr("Error: " + (e.message || "no se pudo procesar"));
    }
    setProc(false);
    setProcStep("");
  };

  // ============================================================
  // GUARDAR (mismo flujo que alta manual de Gastos.jsx)
  // ============================================================
  const handleSave = async () => {
    setSav(true);
    setErr("");

    try {
      if (tipo === "ingreso") {
        const f = {
          "Nº Factura": numero || "",
          "Base Imponible": Number(base) || 0,
          "Estado": estado || "Pendiente"
        };
        if (fecha) f["Fecha"] = fecha;
        if (fechaV) f["Fecha Vencimiento"] = fechaV;
        if (fechaC) f["Fecha Cobro"] = fechaC;

        if (cliente && cliente.trim()) {
          const cifLimpio = cif && cif.trim() ? cif.trim() : null;
          const cId = await findOrCreateClient(cliente.trim(), cifLimpio);
          if (cId) f["Cliente"] = [cId];
        }

        await createRecord("Ingresos", f);
        setSaved(true);
        onSaved();
      } else {
        // GASTO con detección automática
        if (altaComoFijo && !proveedor.trim()) {
          setErr("Para dar de alta un Gasto Fijo necesitas rellenar el Proveedor");
          setSav(false);
          return;
        }

        const f = {
          "Concepto": concepto || desc || proveedor || "Gasto",
          "Base Imponible": Number(base) || 0,
          "IVA Soportado (€)": iva && iva !== "" ? Number(iva) : 0
        };
        if (irpfG) f["IRPF Retenido (€)"] = Number(irpfG);
        if (fecha) f["Fecha"] = fecha;

        // Heredar Periodicidad para que aparezca en lista de Fijos
        if (detectado?.existe && !esPuntual && detectado.gastoFijo.fields["Periodicidad"]) {
          f["Periodicidad"] = detectado.gastoFijo.fields["Periodicidad"];
        } else if (detectado?.existe === false && altaComoFijo) {
          f["Periodicidad"] = periodFijo;
        }

        const created = await createRecord("Gastos", f);
        const nuevoGastoId = created.records?.[0]?.id;

        const provLimpio = proveedor.trim();

        if (provLimpio && nuevoGastoId) {
          if (detectado?.existe && !esPuntual) {
            // CASO A: ya existe → enlazar automáticamente
            await linkGastoToGastoFijo(nuevoGastoId, detectado.gastoFijo.id);
          } else if (detectado?.existe === false && altaComoFijo) {
            // CASO B: no existe y se da de alta → crear y enlazar
            try {
              const nuevoFijoId = await createGastoFijo({
                nombre: provLimpio,
                proveedor: provLimpio,
                cifProveedor: cif,
                periodicidad: periodFijo,
                importe: Number(base) + (Number(iva) || 0),
                moneda: monedaFijo,
                fechaAlta: fecha || hoy()
              });
              if (nuevoFijoId) {
                await linkGastoToGastoFijo(nuevoGastoId, nuevoFijoId);
              }
            } catch (e) {
              console.warn("Gasto guardado pero no se pudo crear el Gasto Fijo:", e);
            }
          }
          // CASO C (existe + esPuntual): no enlazar → queda como puntual
          // CASO D (no existe + no altaComoFijo): gasto suelto puntual
        }

        setSaved(true);
        onSaved();
      }
    } catch (e) {
      console.error(e);
      setErr("Error al guardar: " + e.message);
    }
    setSav(false);
  };

  const ready = (mode === "ocr" && res && !proc) || mode === "manual";

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <SectionHeader
        title={tipo === "ingreso" ? "Nueva Factura" : "Nuevo Ticket / Gasto"}
        action={
          <button onClick={onClose} style={{
            ...B.btnSm,
            background: "transparent",
            color: B.muted,
            border: `1px solid ${B.border}`
          }}>
            ← VOLVER
          </button>
        }
      />

      {!lockTipo && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            onClick={() => { setTipo("ingreso"); reset(); setMode("choose"); }}
            style={{
              ...B.btn,
              flex: 1,
              minWidth: 140,
              background: tipo === "ingreso" ? B.text : "transparent",
              color: tipo === "ingreso" ? "#fff" : B.text,
              border: `2px solid ${B.text}`
            }}
          >
            📄 FACTURA (INGRESO)
          </button>
          <button
            onClick={() => { setTipo("gasto"); reset(); setMode("choose"); }}
            style={{
              ...B.btn,
              flex: 1,
              minWidth: 140,
              background: tipo === "gasto" ? B.text : "transparent",
              color: tipo === "gasto" ? "#fff" : B.text,
              border: `2px solid ${B.text}`
            }}
          >
            🧾 TICKET / GASTO
          </button>
        </div>
      )}

      {!saved && (
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => { setMode("choose"); reset(); }}
            style={{
              ...B.btnSm,
              flex: 1,
              background: mode !== "manual" ? B.purple + "18" : "transparent",
              border: `1px solid ${mode !== "manual" ? B.purple : B.border}`,
              color: mode !== "manual" ? B.purple : B.text
            }}
          >
            📷 ESCANEAR OCR
          </button>
          <button
            onClick={() => { setMode("manual"); reset(); }}
            style={{
              ...B.btnSm,
              flex: 1,
              background: mode === "manual" ? B.purple + "18" : "transparent",
              border: `1px solid ${mode === "manual" ? B.purple : B.border}`,
              color: mode === "manual" ? B.purple : B.text
            }}
          >
            ✏️ MANUAL
          </button>
        </div>
      )}

      {(mode === "choose" || mode === "ocr") && !res && !saved && (
        <div
          onDragOver={e => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={e => {
            e.preventDefault();
            setDrag(false);
            const f = e.dataTransfer.files[0];
            if (f) handleFile(f);
          }}
          onClick={() => {
            const i = document.createElement("input");
            i.type = "file";
            i.accept = "image/*,.pdf";
            i.onchange = e => { const f = e.target.files[0]; if (f) handleFile(f); };
            i.click();
          }}
          style={{
            background: drag ? B.yellow + "44" : B.card,
            border: `3px dashed ${drag ? B.text : B.border}`,
            borderRadius: 12,
            padding: proc ? 40 : 60,
            textAlign: "center",
            cursor: "pointer",
            backdropFilter: "blur(14px)"
          }}
        >
          {proc ? (
            <>
              <div style={{ fontSize: 32, marginBottom: 8 }}>⏳</div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{procStep || "Procesando..."}</div>
              {tipo === "gasto" && (
                <div style={{ fontSize: 12, color: B.muted, marginTop: 8 }}>
                  Esto puede tardar unos segundos
                </div>
              )}
            </>
          ) : (
            <>
              <div style={{ fontSize: 48, marginBottom: 12 }}>{tipo === "ingreso" ? "📄" : "🧾"}</div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>
                {tipo === "ingreso" ? "Arrastra tu factura" : "Arrastra tu ticket/gasto"}
              </div>
              <div style={{ fontSize: 13, color: B.muted, marginTop: 4 }}>PDF o imagen</div>
              {tipo === "gasto" && (
                <div style={{ fontSize: 11, color: B.purple, marginTop: 8, fontWeight: 600 }}>
                  ✨ Lectura inteligente con IA
                </div>
              )}
            </>
          )}
        </div>
      )}

      <ErrorBox>{err}</ErrorBox>

      {ready && !saved && (
        <Card style={{ border: `2px solid ${mode === "ocr" ? B.green : B.purple}` }}>
          <Lbl>
            <span style={{ color: mode === "ocr" ? B.green : B.purple }}>
              {mode === "ocr" ? "REVISA Y CORRIGE" : "INTRODUCIR DATOS"}
            </span>
          </Lbl>

          {tipo === "ingreso" ? (
            <div style={{
              display: "grid",
              gridTemplateColumns: `repeat(${formColumns}, 1fr)`,
              gap: 14,
              marginTop: 14
            }}>
              <Inp label="Nº Factura" value={numero} onChange={sNumero} ph="F00012026" />
              <Inp label="Fecha" value={fecha} onChange={sFecha} type="date" />
              <Inp label="Cliente" value={cliente} onChange={sCliente} ph="Nombre del cliente" />
              <Inp label="CIF/NIF" value={cif} onChange={sCif} ph="B12345678" />
              <Inp label="Base Imponible (€)" value={base} onChange={sBase} type="number" ph="0" />
              <Inp label="IVA (€)" value={iva} onChange={sIva} type="number" ph="Auto" />
              <Inp label="IRPF (€)" value={irpf} onChange={sIrpf} type="number" ph="Auto" />
              <Inp label="Total (€)" value={total} onChange={sTotal} type="number" />
              <Sel label="Estado" value={estado} onChange={sEstado} options={["Cobrada", "Pendiente", "Vencida"]} />
              <Inp label="Fecha Vencimiento" value={fechaV} onChange={sFechaV} type="date" />
              <Inp label="Fecha Cobro" value={fechaC} onChange={sFechaC} type="date" />
            </div>
          ) : (
            <>
              <div style={{
                display: "grid",
                gridTemplateColumns: `repeat(${formColumns}, 1fr)`,
                gap: 14,
                marginTop: 14
              }}>
                <Inp label="Concepto" value={concepto} onChange={sConcepto} ph="Ej: Suscripción Canva" />
                <Inp
                  label="Proveedor"
                  value={proveedor}
                  onChange={v => { sProveedor(v); setAltaComoFijo(false); setEsPuntual(false); }}
                  ph="Empresa"
                />
                <Inp label="Fecha" value={fecha} onChange={sFecha} type="date" />
                <Inp label="CIF Proveedor" value={cif} onChange={sCif} ph="B12345678" />
                <Inp label="Base Imponible (€)" value={base} onChange={sBase} type="number" ph="0" />
                <Inp label="IVA Soportado (€)" value={iva} onChange={sIva} type="number" ph="0 si no lleva IVA" />
                <Inp label="IRPF Retenido (€)" value={irpfG} onChange={sIrpfG} type="number" ph="Si proveedor autónomo" />
              </div>

              {/* DETECCIÓN AUTOMÁTICA DE GASTO FIJO */}
              {proveedor.trim() && (
                <div style={{ marginTop: 18 }}>
                  {/* CASO: buscando */}
                  {buscandoProv && (
                    <div style={{
                      padding: "10px 14px",
                      background: "rgba(0,0,0,0.04)",
                      borderRadius: 8,
                      fontSize: 12,
                      color: B.muted,
                      fontFamily: B.tS
                    }}>
                      🔍 Comprobando si «{proveedor.trim()}» ya está registrado como Gasto Fijo...
                    </div>
                  )}

                  {/* CASO A: ya existe */}
                  {!buscandoProv && detectado?.existe && (
                    <div style={{
                      padding: 14,
                      background: esPuntual ? "rgba(0,0,0,0.03)" : B.green + "12",
                      border: `2px solid ${esPuntual ? B.border : B.green}`,
                      borderRadius: 10,
                      transition: "all 0.2s ease"
                    }}>
                      <div style={{
                        fontSize: 13,
                        fontWeight: 700,
                        fontFamily: B.tS,
                        color: esPuntual ? B.muted : "#0d6b3a",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        flexWrap: "wrap"
                      }}>
                        {esPuntual ? "❌" : "🔗"} {esPuntual
                          ? `Este pago se guardará como puntual (no enlazado a «${detectado.gastoFijo.fields["Nombre"] || detectado.gastoFijo.fields["Proveedor"]}»)`
                          : `Se enlazará automáticamente al Gasto Fijo «${detectado.gastoFijo.fields["Nombre"] || detectado.gastoFijo.fields["Proveedor"]}»`}
                      </div>
                      <label style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        marginTop: 12,
                        cursor: "pointer",
                        userSelect: "none"
                      }}>
                        <input
                          type="checkbox"
                          checked={esPuntual}
                          onChange={e => setEsPuntual(e.target.checked)}
                          style={{ width: 18, height: 18, accentColor: B.amber, cursor: "pointer" }}
                        />
                        <span style={{ fontSize: 13, fontWeight: 600, fontFamily: B.tS, color: B.text }}>
                          Este pago es puntual (no contar como Gasto Fijo)
                        </span>
                      </label>
                      <div style={{ fontSize: 11, color: B.muted, marginTop: 4, paddingLeft: 28 }}>
                        Marca esto si el proveedor coincide pero este gasto NO es del recurrente
                        (ej: compra adicional fuera de la cuota habitual).
                      </div>
                    </div>
                  )}

                  {/* CASO B: no existe → ofrecer dar de alta */}
                  {!buscandoProv && detectado?.existe === false && (
                    <div style={{
                      padding: 14,
                      background: altaComoFijo ? B.purple + "10" : "rgba(0,0,0,0.03)",
                      border: `2px solid ${altaComoFijo ? B.purple : B.border}`,
                      borderRadius: 10,
                      transition: "all 0.2s ease"
                    }}>
                      <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer", userSelect: "none" }}>
                        <input
                          type="checkbox"
                          checked={altaComoFijo}
                          onChange={e => setAltaComoFijo(e.target.checked)}
                          style={{ width: 20, height: 20, accentColor: B.purple, cursor: "pointer" }}
                        />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: 14, fontFamily: B.tS }}>
                            ➕ Dar de alta «{proveedor.trim()}» como Gasto Fijo
                          </div>
                          <div style={{ fontSize: 12, color: B.muted, marginTop: 2 }}>
                            A partir de ahora, los pagos de este proveedor se enlazarán automáticamente.
                          </div>
                        </div>
                      </label>

                      {altaComoFijo && (
                        <div style={{
                          marginTop: 14,
                          display: "grid",
                          gridTemplateColumns: `repeat(${Math.min(formColumns, 2)}, 1fr)`,
                          gap: 12,
                          paddingTop: 14,
                          borderTop: `1px solid ${B.border}`
                        }}>
                          <Sel label="Periodicidad" value={periodFijo} onChange={setPeriodFijo} options={["Mensual", "Trimestral", "Anual"]} />
                          <Sel label="Moneda" value={monedaFijo} onChange={setMonedaFijo} options={["EUR", "USD", "GBP"]} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {tipo === "ingreso" && cif && cliente && (
            <div style={{
              marginTop: 10,
              padding: "8px 12px",
              background: B.purple + "10",
              borderRadius: 6,
              fontSize: 11,
              color: B.purple,
              fontFamily: B.tS
            }}>
              ℹ️ El CIF se guardará también en la ficha del cliente «{cliente}»
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={sav}
            style={{
              ...B.btn,
              width: "100%",
              marginTop: 16,
              opacity: sav ? 0.5 : 1
            }}
          >
            {sav ? "GUARDANDO..." : tipo === "ingreso" ? "GUARDAR FACTURA" : "GUARDAR GASTO"}
          </button>
        </Card>
      )}

      {saved && (
        <Card style={{ border: `2px solid ${B.green}` }}>
          <div style={{ textAlign: "center", padding: 20 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: B.green }}>
              {tipo === "ingreso" ? "Factura guardada" : "Gasto guardado"}
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 16, flexWrap: "wrap" }}>
              <button onClick={() => { reset(); setMode("choose"); }} style={B.btn}>
                AÑADIR OTRO
              </button>
              <button onClick={onClose} style={{
                ...B.btn,
                background: "transparent",
                color: B.text,
                border: `2px solid ${B.text}`
              }}>
                VOLVER
              </button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
