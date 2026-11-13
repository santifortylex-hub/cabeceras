const nf0 = new Intl.NumberFormat("es-UY", { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat("es-UY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const money = (n: number | null | undefined, mon: "UYU" | "USD" = "UYU") =>
  n == null ? "—" : `${mon === "USD" ? "US$" : "$"} ${nf0.format(n)}`;
export const pct = (n: number | null | undefined) => (n == null ? "—" : `${nf2.format(n)} %`);
export const fecha = (d: string | null | undefined) => {
  if (!d) return "—";
  const [y, m, day] = d.slice(0, 10).split("-");
  return `${day}/${m}/${y}`;
};
export const fechaHora = (d: string) =>
  new Date(d).toLocaleString("es-UY", { dateStyle: "short", timeStyle: "short", timeZone: "America/Montevideo" });
export const periodo = (d: string | null) => (d ? `${d.slice(5, 7)}/${d.slice(0, 4)}` : "—");
