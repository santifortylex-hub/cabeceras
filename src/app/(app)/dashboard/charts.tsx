"use client";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Pt = { name: string; value: number };
export interface ChartData {
  porMarca: Pt[]; porSupervisor: Pt[]; porUsuario: Pt[]; porEstado: Pt[]; inversionLinea: Pt[];
  evolucion: { mes: string; activas: number; bajas: number }[]; ratios: Pt[];
}
const COLORS = ["#c0392b", "#2f4858", "#e0a21b", "#0e9f8e", "#8b5cf6", "#64748b", "#16a34a", "#f97316"];
const nf = new Intl.NumberFormat("es-UY", { maximumFractionDigits: 0 });

function Card({ title, children, empty }: { title: string; children: React.ReactNode; empty?: boolean }) {
  return (
    <section className="card">
      <h3 className="mb-3 text-sm font-semibold text-slate-700">{title}</h3>
      <div className="h-64">{empty ? <div className="flex h-full items-center justify-center text-sm text-slate-400">Sin datos</div> : children}</div>
    </section>
  );
}

function Barras({ data, horizontal, money }: { data: Pt[]; horizontal?: boolean; money?: boolean }) {
  const fmt = (v: unknown) => (money ? `$ ${nf.format(Number(v))}` : String(v));
  return (
    <ResponsiveContainer>
      <BarChart data={data} layout={horizontal ? "vertical" : "horizontal"} margin={{ left: horizontal ? 24 : 0, right: 12 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        {horizontal ? (<><XAxis type="number" allowDecimals={false} fontSize={11} /><YAxis type="category" dataKey="name" width={110} fontSize={11} /></>)
          : (<><XAxis dataKey="name" fontSize={11} interval={0} /><YAxis allowDecimals={false} fontSize={11} tickFormatter={money ? (v) => nf.format(v) : undefined} /></>)}
        <Tooltip formatter={(v) => fmt(v)} />
        <Bar dataKey="value" radius={[3, 3, 0, 0]}>{data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export default function Charts({ d }: { d: ChartData }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Cabeceras por marca" empty={!d.porMarca.length}><Barras data={d.porMarca} /></Card>
      <Card title="Cabeceras por estado" empty={!d.porEstado.length}>
        <ResponsiveContainer>
          <PieChart>
            <Pie data={d.porEstado} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={2}>
              {d.porEstado.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      </Card>
      <Card title="Cabeceras por supervisor" empty={!d.porSupervisor.length}><Barras data={d.porSupervisor} horizontal /></Card>
      <Card title="Cabeceras por usuario" empty={!d.porUsuario.length}><Barras data={d.porUsuario} horizontal /></Card>
      <Card title="Inversión por línea (UYU)" empty={!d.inversionLinea.length}><Barras data={d.inversionLinea} money /></Card>
      <Card title="Distribución de ratios de inversión" empty={!d.ratios.some((r) => r.value)}><Barras data={d.ratios} /></Card>
      <section className="card lg:col-span-2">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">Evolución: cabeceras activas y dadas de baja (acumuladas)</h3>
        <div className="h-72">
          <ResponsiveContainer>
            <LineChart data={d.evolucion} margin={{ right: 12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="mes" fontSize={11} /><YAxis allowDecimals={false} fontSize={11} />
              <Tooltip /><Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="activas" name="Activas" stroke="#c0392b" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="bajas" name="Dadas de baja" stroke="#2f4858" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
