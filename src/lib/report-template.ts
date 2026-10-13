// Base document handed to Claude (via get_report_guidelines) so every report it
// builds from Dashboard data looks like the team's reports. Self-contained,
// responsive, printable, and with NO script: charts are plain CSS bars or inline
// SVG, because reports created through the connector may not carry executable
// content (see active-content.ts).
export const REPORT_TEMPLATE_HTML = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{{TITULO}} · {{CLIENTE}}</title>
<style>
  :root { --violet:#6D28D9; --violet-2:#8B5CF6; --gold:#F0B94D; --ink:#1b1530; --muted:#6b6485;
          --bg:#f7f5fc; --card:#ffffff; --line:#e7e2f5; --good:#1a8f5a; --bad:#c0392b; }
  * { box-sizing: border-box; }
  body { margin:0; font-family: system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;
         background:var(--bg); color:var(--ink); line-height:1.55; }
  .wrap { max-width: 980px; margin: 0 auto; }
  header { background: linear-gradient(110deg,#3b1a8f,var(--violet)); color:#fff; padding:44px 24px; }
  header .eyebrow { font-size:.75rem; letter-spacing:.14em; text-transform:uppercase; opacity:.8; }
  header h1 { margin:6px 0; font-size:2rem; line-height:1.15; }
  header p { margin:0; opacity:.88; max-width:640px; }
  main { padding: 8px 24px 56px; }
  h2 { margin:36px 0 14px; font-size:1.25rem; }
  .kpis { display:grid; grid-template-columns:repeat(auto-fit,minmax(190px,1fr)); gap:14px; }
  .kpi { background:var(--card); border:1px solid var(--line); border-radius:14px; padding:18px; }
  .kpi .label { font-size:.72rem; letter-spacing:.08em; text-transform:uppercase; color:var(--muted); }
  .kpi .value { font-size:1.8rem; font-weight:700; margin-top:4px; }
  .kpi .delta { font-size:.85rem; color:var(--good); }
  .kpi .delta.down { color:var(--bad); }
  table { width:100%; border-collapse:collapse; background:var(--card); border:1px solid var(--line);
          border-radius:14px; overflow:hidden; }
  th, td { text-align:left; padding:11px 14px; border-bottom:1px solid var(--line); font-size:.92rem; }
  th { background:#efeaf9; font-size:.72rem; letter-spacing:.06em; text-transform:uppercase; color:var(--muted); }
  td.num, th.num { text-align:right; font-variant-numeric:tabular-nums; }
  tr:last-child td { border-bottom:none; }
  .bars { background:var(--card); border:1px solid var(--line); border-radius:14px; padding:18px; }
  .bar-row { display:flex; align-items:center; gap:12px; margin:9px 0; font-size:.9rem; }
  .bar-row .name { width:110px; color:var(--muted); flex:none; }
  .bar { height:14px; border-radius:7px; background:linear-gradient(90deg,var(--violet),var(--gold)); }
  .bar-row .val { flex:none; font-variant-numeric:tabular-nums; }
  .note { background:#fff8e6; border-left:4px solid var(--gold); padding:14px 18px; border-radius:8px; margin:0; }
  footer { text-align:center; color:var(--muted); font-size:.82rem; padding:22px; }
  @media (max-width:560px) { header h1 { font-size:1.6rem; } .bar-row .name { width:80px; } }
  @media print { header { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }
</style>
</head>
<body>
<header><div class="wrap">
  <div class="eyebrow">{{CLIENTE}} · {{PERIODO}}</div>
  <h1>{{TITULO}}</h1>
  <p>{{BAJADA: una frase con el resultado principal del período}}</p>
</div></header>

<main class="wrap">
  <h2>Resumen</h2>
  <section class="kpis">
    <div class="kpi"><div class="label">{{METRICA 1}}</div><div class="value">{{VALOR}}</div><div class="delta">▲ {{VARIACION}} vs. período anterior</div></div>
    <div class="kpi"><div class="label">{{METRICA 2}}</div><div class="value">{{VALOR}}</div><div class="delta down">▼ {{VARIACION}} vs. período anterior</div></div>
    <div class="kpi"><div class="label">{{METRICA 3}}</div><div class="value">{{VALOR}}</div><div class="delta">▲ {{VARIACION}} vs. período anterior</div></div>
  </section>

  <h2>Detalle</h2>
  <table>
    <thead><tr><th>{{COLUMNA}}</th><th class="num">{{COLUMNA}}</th><th class="num">{{COLUMNA}}</th></tr></thead>
    <tbody>
      <tr><td>{{FILA}}</td><td class="num">{{DATO}}</td><td class="num">{{DATO}}</td></tr>
    </tbody>
  </table>

  <h2>Evolución</h2>
  <div class="bars">
    <!-- width = valor / máximo * 100 (%). Una fila por semana, mes o campaña. -->
    <div class="bar-row"><span class="name">{{ETIQUETA}}</span><div class="bar" style="width:60%"></div><span class="val">{{VALOR}}</span></div>
  </div>

  <h2>Conclusiones y próximos pasos</h2>
  <p class="note">{{Qué pasó, por qué y qué se recomienda hacer. Solo con lo que muestran los datos.}}</p>
</main>

<footer>Datos del Dashboard · período {{RANGO DE FECHAS}} · extraídos el {{FECHA}}</footer>
</body>
</html>
`;
