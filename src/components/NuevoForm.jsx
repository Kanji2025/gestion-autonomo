// Detectar CIF/NIF español con estrategias seguras para no confundirlo con otros códigos:
  // 1) Primero: buscamos cerca de las palabras clave CIF/NIF/DNI (lo más fiable)
  // 2) Si no: buscamos NIF persona (8 dígitos + letra), que es un patrón inequívoco
  // 3) Si no: buscamos CIF empresa con letra inicial válida (A/B/C/D/E/F/G/H/J/N/P/Q/R/S/U/V/W)
  //    pero excluyendo el número de factura si lo conocemos ya
  let cif = "";
  // Estrategia 1: cerca de palabras clave
  const cifEtiquetado = t.match(/(?:C\.?I\.?F\.?|N\.?I\.?F\.?|DNI)[\s:.\-]*([A-HJNP-SUVW]\d{7,8}[A-Z]?|\d{8}[A-Z])/i);
  if (cifEtiquetado) {
    cif = cifEtiquetado[1].toUpperCase();
  } else {
    // Estrategia 2: NIF persona (patrón inequívoco)
    const nifMatch = t.match(/(?<![A-Z0-9])(\d{8}[A-Z])(?![A-Z0-9])/);
    if (nifMatch) {
      cif = nifMatch[1];
    } else {
      // Estrategia 3: CIF empresa con primera letra válida, excluyendo el número de factura
      const cifEmpresaMatches = [...t.matchAll(/(?<![A-Z0-9])([A-HJNP-SUVW]\d{7,8})(?![A-Z0-9])/g)];
      for (const m of cifEmpresaMatches) {
        // Si ya tenemos el nº de factura detectado y coincide, descartarlo
        if (num && m[1] === num) continue;
        cif = m[1];
        break;
      }
    }
  }
