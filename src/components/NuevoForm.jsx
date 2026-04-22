// src/components/NuevoForm.jsx
// Formulario universal para añadir Factura (ingreso) o Ticket/Gasto.
// Para gastos: permite marcar "es gasto fijo recurrente" y gestiona alta/duplicados.

import { useState } from "react";
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
  const [tipoG, sTipoG] = useState("");
  const [period, sPeriod] = useState("Puntual");
  const [irpfG, sIrpfG] = useState("");
  const [proveedor, sProveedor] = useState("");

  // Campos para Gasto Fijo
  const [esFijo, setEsFijo] = useState(false);
  const [periodFijo, setPeriodFijo] = useState("Mensual");
  const [monedaFijo, setMonedaFijo] = useState("EUR");

  // Modal de duplicado
  const [duplicadoModal, setDuplicadoModal] = useState(null);

  const reset = () => {
    sNumero(""); sFecha(hoy()); sCliente(""); sCif(""); sBase(""); sIva("");
    sIrpf(""); sTotal(""); sDesc(""); sEstado("Pendiente"); sFechaV(""); sFechaC("");
    sConcepto(""); sTipoG(""); sPeriod("Puntual"); sIrpfG(""); sProveedor("");
    setEsFijo(false); setPeriodFijo("Mensual"); setMonedaFijo("EUR");
    setDuplicadoModal(null);
    setSaved(false); setErr(""); setRes(null);
  };

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
        if (data.tipo_sugerido) sTipoG(data.tipo_sugerido);
        if (data.periodicidad_sugerida) {
          sPeriod(data.periodicidad_sugerida);
          if (["Mensual", "Trimestral", "Anual"].includes(data.periodicidad_sugerida)) {
            setPeriodFijo(data.periodicidad_sugerida);
          }
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
  // GUARDAR GASTO (con lógica de gasto fijo)
  // ============================================================
  const guardarGasto = async () => {
    // Paso 1: crear el gasto individual en tabla Gastos
    const f = {
      "Concepto": concepto || desc || proveedor || "Gasto",
      "Base Imponible": Number(base) || 0,
      "IVA Soportado (€)": iva && iva !== "" ? Number(iva) : 0
    };
    if (irpfG) f["IRPF Retenido (€)"] = Number(irpfG);
    if (fecha) f["Fecha"] = fecha;
    if (tipoG) f["Tipo de Gasto"] = tipoG;
    if (period) f["Periodicidad"] = period;

    const created = await createRecord("Gastos", f);
    const nuevoGastoId = created.records?.[0]?.id;

    // Paso 2: si es gasto fijo, gestionar alta/duplicado
    if (esFijo && proveedor && proveedor.trim()) {
      const existente = await findGastoFijoByProveedor(proveedor.trim());

      if (existente) {
        // Ya existe → mostrar modal al usuario
        setDuplicadoModal({
          existente,
          nuevoGastoId,
          proveedor: proveedor.trim()
        });
        // Importante: NO terminar el save aquí. El modal gestiona el siguiente paso.
        return false; // indica que no hemos terminado, falta decisión del usuario
      }

      // No existe → crear nuevo Gasto Fijo y enlazar
      try {
        const nuevoFijoId = await createGastoFijo({
          nombre: proveedor.trim(),
          proveedor: proveedor.trim(),
          cifProveedor: cif,
          periodicidad: periodFijo,
          importe: Number(base) + (Number(iva) || 0),
          moneda: monedaFijo,
          fechaAlta: fecha || hoy()
        });
        if (nuevoFijoId && nuevoGastoId) {
          await linkGastoToGastoFijo(nuevoGastoId, nuevoFijoId);
        }
      } catch (e) {
        console.warn("Gasto guardado pero no se pudo crear el Gasto Fijo:", e);
        // No bloqueamos: el gasto ya está guardado
      }
    }

    return true; // guardado completo
  };

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
        // Gasto
        const completo = await guardarGasto();
        if (completo) {
          setSaved(true);
          onSaved();
        }
        // si completo es false, hay modal de duplicado abierto → no marcamos saved aún
      }
    } catch (e) {
      console.error(e);
      setErr("Error al guardar: " + e.message);
    }
    setSav(false);
  };

  // ============================================================
  // ACCIONES DEL MODAL DE DUPLICADO
  // ============================================================
  const enlazarAExistente = async () => {
    const { existente, nuevoGastoId } = duplicadoModal;
    try {
      if (nuevoGastoId && existente?.id) {
        await linkGastoToGastoFijo(nuevoGastoId, existente.id);
      }
      setDuplicadoModal(null);
      setSaved(true);
      onSaved();
    } catch (e) {
      alert("Error al enlazar: " + e.message);
    }
  };

  const crearDuplicado = async () => {
    const { nuevoGastoId } = duplicadoModal;
    try {
      const nuevoFijoId = await createGastoFijo({
        nombre: proveedor.trim() + " (2)",
        proveedor: proveedor.trim(),
        cifProveedor: cif,
        periodicidad: periodFijo,
        importe: Number(base) + (Number(iva) || 0),
        moneda: monedaFijo,
        fechaAlta: fecha || hoy()
      });
      if (nuevoFijoId && nuevoGastoId) {
        await linkGastoToGastoFijo(nuevoGastoId, nuevoFijoId);
      }
      setDuplicadoModal(null);
      setSaved(true);
      onSaved();
    } catch (e) {
      alert("Error al crear: " + e.message);
    }
  };

  const cancelarGastoFijo = () => {
    // El gasto ya se creó, solo no enlazamos a ningún gasto fijo
    setDuplicadoModal(null);
    setSaved(true);
    onSaved();
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
                <Inp label="Concepto" value={concepto} onChange={sConcepto} ph="Ej: Material oficina" />
                <Inp label="Proveedor" value={proveedor} onChange={sProveedor} ph="Empresa" />
                <Inp label="Fecha" value={fecha} onChange={sFecha} type="date" />
                <Inp label="CIF Proveedor" value={cif} onChange={sCif} ph="B12345678" />
                <Inp label="Base Imponible (€)" value={base} onChange={sBase} type="number" ph="0" />
                <Inp label="IVA Soportado (€)" value={iva} onChange={sIva} type="number" ph="0 si no lleva IVA" />
                <Inp label="IRPF Retenido (€)" value={irpfG} onChange={sIrpfG} type="number" ph="Si proveedor autónomo" />
                <Sel label="Tipo de Gasto" value={tipoG} onChange={sTipoG} options={["Fijo", "Variable", "Impuesto"]} />
                <Sel label="Periodicidad" value={period} onChange={sPeriod} options={["Mensual", "Trimestral", "Anual", "Puntual"]} />
              </div>

              {/* TOGGLE "¿Es un gasto fijo recurrente?" */}
              <div style={{
                marginTop: 18,
                padding: 14,
                background: esFijo ? B.purple + "10" : "rgba(0,0,0,0.03)",
                border: `2px solid ${esFijo ? B.purple : B.border}`,
                borderRadius: 10,
                transition: "all 0.2s ease"
              }}>
                <label style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  cursor: "pointer",
                  userSelect: "none"
                }}>
                  <input
                    type="checkbox"
                    checked={esFijo}
                    onChange={e => setEsFijo(e.target.checked)}
                    style={{
                      width: 20,
                      height: 20,
                      accentColor: B.purple,
                      cursor: "pointer"
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, fontFamily: B.tS }}>
                      🔄 ¿Es un gasto fijo recurrente?
                    </div>
                    <div style={{ fontSize: 12, color: B.muted, marginTop: 2 }}>
                      Marca esta opción si se trata de una suscripción o pago periódico (ChatGPT, Canva, seguro, etc.)
                    </div>
                  </div>
                </label>

                {esFijo && (
                  <div style={{
                    marginTop: 14,
                    display: "grid",
                    gridTemplateColumns: `repeat(${Math.min(formColumns, 2)}, 1fr)`,
                    gap: 12,
                    paddingTop: 14,
                    borderTop: `1px solid ${B.border}`
                  }}>
                    <Sel
                      label="Periodicidad del Fijo"
                      value={periodFijo}
                      onChange={setPeriodFijo}
                      options={["Mensual", "Trimestral", "Anual"]}
                    />
                    <Sel
                      label="Moneda del cargo"
                      value={monedaFijo}
                      onChange={setMonedaFijo}
                      options={["EUR", "USD", "GBP"]}
                    />
                    {!proveedor && (
                      <div style={{
                        gridColumn: "1 / -1",
                        padding: "8px 12px",
                        background: B.amber + "15",
                        color: B.amber,
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 600,
                        fontFamily: B.tS
                      }}>
                        ⚠️ Rellena el campo "Proveedor" arriba para identificar este gasto fijo
                      </div>
                    )}
                  </div>
                )}
              </div>
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
            disabled={sav || (esFijo && tipo === "gasto" && !proveedor.trim())}
            style={{
              ...B.btn,
              width: "100%",
              marginTop: 16,
              opacity: (sav || (esFijo && tipo === "gasto" && !proveedor.trim())) ? 0.5 : 1
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

      {/* MODAL DE DUPLICADO */}
      {duplicadoModal && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(3px)",
          zIndex: 300,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 16
        }}>
          <div style={{
            background: "#fff",
            borderRadius: 12,
            padding: 24,
            maxWidth: 480,
            width: "100%",
            boxShadow: "0 20px 60px rgba(0,0,0,0.3)"
          }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>⚠️</div>
            <div style={{
              fontSize: 16,
              fontWeight: 700,
              fontFamily: B.tS,
              marginBottom: 10
            }}>
              Ya existe un gasto fijo para «{duplicadoModal.proveedor}»
            </div>
            <div style={{
              fontSize: 13,
              color: B.muted,
              marginBottom: 20,
              lineHeight: 1.5
            }}>
              Tienes registrado un Gasto Fijo con este proveedor
              ({duplicadoModal.existente.fields["Activa"] === "Sí" ? "activo" : "dado de baja"}).
              El gasto ya se ha guardado correctamente. ¿Qué quieres hacer con la parte del Gasto Fijo?
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button
                onClick={enlazarAExistente}
                style={{
                  ...B.btn,
                  background: B.green,
                  width: "100%"
                }}
              >
                ✅ ENLAZAR AL GASTO FIJO EXISTENTE
              </button>
              <button
                onClick={crearDuplicado}
                style={{
                  ...B.btn,
                  background: "transparent",
                  color: B.purple,
                  border: `2px solid ${B.purple}`,
                  width: "100%"
                }}
              >
                ➕ CREAR UNO NUEVO (duplicado)
              </button>
              <button
                onClick={cancelarGastoFijo}
                style={{
                  ...B.btn,
                  background: "transparent",
                  color: B.muted,
                  border: `1px solid ${B.border}`,
                  width: "100%"
                }}
              >
                NO ENLAZAR A NINGUNO
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
