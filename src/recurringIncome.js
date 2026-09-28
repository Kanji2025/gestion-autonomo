// Cálculos puros de ingresos recurrentes. Estas previsiones nunca se mezclan
// con la tabla Ingresos, que contiene únicamente facturas reales.

function monthNumber(value) {
  if (!value) return null;
  const match = String(value).match(/^(\d{4})-(\d{2})/);
  if (!match) return null;
  return Number(match[1]) * 12 + Number(match[2]) - 1;
}

function targetMonthNumber(year, month) {
  return Number(year) * 12 + Number(month);
}

export function isActiveInMonth(record, year, month) {
  const fields = record?.fields || {};
  const start = monthNumber(fields["Fecha primera factura"]);
  const end = monthNumber(fields["Fecha última factura"]);
  const target = targetMonthNumber(year, month);

  if (start == null || start > target) return false;
  if (end != null && end < target) return false;
  return true;
}

export function isDueInMonth(record, year, month) {
  if (!isActiveInMonth(record, year, month)) return false;

  const fields = record?.fields || {};
  if ((fields["Periodicidad"] || "Mensual") === "Mensual") return true;

  const start = monthNumber(fields["Fecha primera factura"]);
  const target = targetMonthNumber(year, month);
  return start != null && (target - start) % 3 === 0;
}

export function monthlyEquivalent(records, date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth();

  return (records || []).reduce((total, record) => {
    if (!isActiveInMonth(record, year, month)) return total;
    const fields = record.fields || {};
    const amount = Number(fields["Importe base"]) || 0;
    return total + (fields["Periodicidad"] === "Trimestral" ? amount / 3 : amount);
  }, 0);
}

export function forecastForYear(records, year) {
  return Array.from({ length: 12 }, (_, month) =>
    (records || []).reduce((total, record) => {
      if (!isDueInMonth(record, year, month)) return total;
      return total + (Number(record?.fields?.["Importe base"]) || 0);
    }, 0)
  );
}

export function forecastTotal(records, year) {
  return forecastForYear(records, year).reduce((sum, amount) => sum + amount, 0);
}
