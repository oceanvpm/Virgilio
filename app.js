const SVGNS = "http://www.w3.org/2000/svg";

const REGISTER_COLORS = {
  formal: "#3b5b7a",
  neutral: "#6b6256",
  coloquial: "#c2703d",
  literario: "#7a567f",
  técnico: "#2f7d6e",
  tecnico: "#2f7d6e",
  vulgar: "#a33a3a",
  arcaico: "#8a7338",
};
const colorFor = (reg) => REGISTER_COLORS[(reg || "").toLowerCase()] || "#6b6256";

const els = {
  form: document.getElementById("lookup"),
  palabra: document.getElementById("palabra"),
  contexto: document.getElementById("contexto"),
  go: document.getElementById("go"),
  hint: document.getElementById("hint"),
  status: document.getElementById("status"),
  web: document.getElementById("web"),
  panel: document.getElementById("panel"),
  history: document.getElementById("history"),
};

let history = [];

els.form.addEventListener("submit", (e) => {
  e.preventDefault();
  lookup(els.palabra.value.trim(), els.contexto.value.trim(), true);
});

async function lookup(palabra, contexto, pushHistory) {
  if (!palabra) return;
  els.palabra.value = palabra;
  els.contexto.value = contexto || "";

  setStatus(`Trazando el mapa de «${palabra}»…`);
  els.web.hidden = true;
  els.panel.hidden = true;
  els.go.disabled = true;
  els.hint.hidden = true;

  try {
    const res = await fetch("/api/thesaurus", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ palabra, contexto }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error en la consulta.");

    if (pushHistory) {
      history.push({ palabra, contexto });
      if (history.length > 12) history.shift();
    }
    renderHistory();
    clearStatus();
    buildWeb(data);
  } catch (err) {
    setStatus(err.message, true);
  } finally {
    els.go.disabled = false;
  }
}

function setStatus(msg, isError = false) {
  els.status.textContent = msg;
  els.status.className = "status" + (isError ? " error" : "");
  els.status.hidden = false;
}
function clearStatus() {
  els.status.hidden = true;
}

function renderHistory() {
  els.history.innerHTML = "";
  history.forEach((h, i) => {
    const b = document.createElement("button");
    b.textContent = h.palabra;
    if (i === history.length - 1) b.classList.add("current");
    b.addEventListener("click", () => lookup(h.palabra, h.contexto, false));
    els.history.appendChild(b);
  });
}

function buildWeb(data) {
  const svg = els.web;
  svg.innerHTML = "";
  svg.hidden = false;
  els.panel.hidden = true;

  const W = 1000,
    H = 820,
    cx = 480,
    cy = 400;
  const R0 = 140,
    STEP = 60;

  const groups = data.grupos || [];
  const n = groups.length || 1;

  // edges first (under nodes)
  const edgeLayer = make("g");
  const nodeLayer = make("g");
  const labelLayer = make("g");

  const allNodes = [];

  groups.forEach((g, gi) => {
    const baseAngle = (-90 + (360 / n) * gi) * (Math.PI / 180);
    const color = colorFor(g.registro);

    // group label, near the center along the spoke
    const lx = cx + Math.cos(baseAngle) * 78;
    const ly = cy + Math.sin(baseAngle) * 78;
    const glabel = make("text", { x: lx, y: ly, class: "group-label", fill: color });
    glabel.textContent = (g.etiqueta || g.registro || "").toUpperCase();
    labelLayer.appendChild(glabel);

    const syns = g.sinonimos || [];
    syns.forEach((s, si) => {
      const fan = (si - (syns.length - 1) / 2) * (9 * Math.PI / 180);
      const a = baseAngle + fan;
      const r = R0 + si * STEP;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;

      // edge
      const edge = make("path", {
        d: `M ${cx} ${cy} L ${x} ${y}`,
        class: "edge",
      });
      edgeLayer.appendChild(edge);

      // node
      const node = make("g", { class: "node" });
      const w = Math.max(64, (s.palabra || "").length * 10.5 + 26);
      const rect = make("rect", {
        x: x - w / 2,
        y: y - 16,
        width: w,
        height: 32,
        rx: 16,
        class: "node-pill",
        fill: color,
      });
      const label = make("text", { x, y: y + 1, class: "node-label" });
      label.textContent = s.palabra;
      node.appendChild(rect);
      node.appendChild(label);
      node.addEventListener("click", () =>
        selectNode({ syn: s, group: g, color, node, edge, data })
      );
      nodeLayer.appendChild(node);
      allNodes.push({ node, edge });
    });
  });

  // center node
  const centerW = Math.max(120, (data.palabra || "").length * 16 + 50);
  const center = make("g");
  center.appendChild(
    make("rect", {
      x: cx - centerW / 2,
      y: cy - 26,
      width: centerW,
      height: 52,
      rx: 26,
      class: "node-pill center-pill",
    })
  );
  const cLabel = make("text", { x: cx, y: cy + 1, class: "node-label center-label" });
  cLabel.textContent = data.palabra;
  center.appendChild(cLabel);

  svg.appendChild(edgeLayer);
  svg.appendChild(labelLayer);
  svg.appendChild(nodeLayer);
  svg.appendChild(center);

  // click background → reset highlight + show overview panel
  // (assign, don't addEventListener, so handlers don't stack across lookups)
  svg.onclick = (e) => {
    if (e.target === svg) showOverview(data);
  };
  svg._allNodes = allNodes;

  showOverview(data);
}

function selectNode({ syn, group, color, node, edge, data }) {
  // highlight
  (els.web._allNodes || []).forEach((x) => {
    x.node.classList.toggle("dim", x.node !== node);
    x.edge.classList.toggle("dim", x.edge !== edge);
  });

  const p = els.panel;
  p.hidden = false;
  p.innerHTML = "";
  add(p, "h3", {}, syn.palabra);
  add(p, "span", { class: "reg", style: `background:${color}` }, `${group.registro} · ${group.region}`);
  add(p, "p", { class: "matiz" }, syn.matiz);
  add(p, "div", { class: "ej-label" }, "En contexto");
  add(p, "p", { class: "ej" }, "“" + syn.ejemplo + "”");
  const btn = add(p, "button", { class: "explore" }, `Explorar «${syn.palabra}» →`);
  btn.addEventListener("click", () => lookup(syn.palabra, "", true));
}

function showOverview(data) {
  (els.web._allNodes || []).forEach((x) => {
    x.node.classList.remove("dim");
    x.edge.classList.remove("dim");
  });

  const p = els.panel;
  p.hidden = false;
  p.innerHTML = "";
  add(p, "h3", {}, data.palabra);
  add(p, "p", { class: "sentido" }, `${data.categoria} · ${data.sentido}`);

  // legend of registers present
  const regs = [...new Set((data.grupos || []).map((g) => g.registro))];
  const legend = add(p, "div", { class: "legend" });
  regs.forEach((r) => {
    const span = add(legend, "span");
    add(span, "i", { style: `background:${colorFor(r)}` });
    span.appendChild(document.createTextNode(r));
  });

  if ((data.advertencias || []).length) {
    const warn = add(p, "div", { class: "warn" });
    add(warn, "h4", {}, "Cautelas");
    data.advertencias.forEach((a) => {
      const pp = add(warn, "p");
      const b = document.createElement("b");
      b.textContent = a.palabra + ": ";
      pp.appendChild(b);
      pp.appendChild(document.createTextNode(a.nota));
    });
  }
}

// --- tiny DOM/SVG helpers ---
function make(tag, attrs = {}) {
  const el = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}
function add(parent, tag, attrs = {}, text) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (text != null) el.textContent = text;
  parent.appendChild(el);
  return el;
}
