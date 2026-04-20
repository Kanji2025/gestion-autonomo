// src/components/NuevoForm.jsx
// Formulario universal para añadir Factura (ingreso) o Ticket/Gasto.
// Soporta OCR (con IA para gastos) y entrada manual.
// Al guardar factura, el CIF detectado se guarda también en el cliente.

import { useState } from "react";
import { B, hoy, convD } from "../utils.js";
import { useResponsive } from "../hooks/useResponsive.js";
import { createRecord, findOrCreateClient, runOCR, parseExpense } from "../api.js";
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
  // CIF español: letra+8 dígitos, 8 dígitos+letra (NIF), o B/A+8 dígitos (CIF empresa)
  const cifM = t.match(/([A-Z]\d{8}|\d{8}[A-Z])/);
  const cif = cifM ? cifM[0] : "";

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

  const reset = () => {
    sNumero(""); sFecha(hoy()); sCliente(""); sCif(""); sBase(""); sIva("");
    sIrpf(""); sTotal(""); sDesc(""); sEstado("Pendiente"); sFechaV(""); sFechaC("");
    sConcepto(""); sTipoG(""); sPeriod("Puntual"); sIrpfG(""); sProveedor("");
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
        if (data.periodicidad_sugerida) sPeriod(data.periodicidad_sugerida);
      }
    } catch (e) {
      console.error(e);
      setErr("Error: " + (e.message || "no se pudo procesar"));
    }
    setProc(false);
    setProcStep("");
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

        // Buscar/crear cliente pasando también el CIF si lo tenemos
        if (cliente && cliente.trim()) {
          const cifLimpio = cif && cif.trim() ? cif.trim() : null;
          const cId = await findOrCreateClient(cliente.trim(), cifLimpio);
          if (cId) f["Cliente"] = [cId];
        }

        await createRecord("Ingresos", f);
      } else {
        // Gasto
        const f = {
          "Concepto": concepto || desc || proveedor || "Gasto",
          "Base Imponible": Number(base) || 0,
          "IVA Soportado (€)": Number(iva) || (Number(base) * 0.21) || 0
        };
        if (irpfG) f["IRPF Retenido (€)"] = Number(irpfG);
        if (fecha) f["Fecha"] = fecha;
        if (tipoG) f["Tipo de Gasto"] = tipoG;
        if (period) f["Periodicidad"] = period;
        await createRecord("Gastos", f);
      }

      setSaved(true);
      onSaved();
    } catch (e) {
      console.error(e);
      setErr("Error al guardar: " + e.message);
    }
    setSav(false);
  };

  const ready = (mode === "ocr" && res && !proc) || mode === "manual";

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
              <Inp label="IVA Soportado (€)" value={iva} onChange={sIva} type="number" ph="Auto: 21%" />
              <Inp label="IRPF Retenido (€)" value={irpfG} onChange={sIrpfG} type="number" ph="Si proveedor autónomo" />
              <Sel label="Tipo de Gasto" value={tipoG} onChange={sTipoG} options={["Fijo", "Variable", "Impuesto"]} />
              <Sel label="Periodicidad" value={period} onChange={sPeriod} options={["Mensual", "Trimestral", "Anual", "Puntual"]} />
            </div>
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
            style={{ ...B.btn, width: "100%", marginTop: 16, opacity: sav ? 0.5 : 1 }}
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
