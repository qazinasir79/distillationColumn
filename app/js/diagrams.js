/* =========================================================
   Distillation Lab — animated SVG process diagrams
   Pure string builders; each returns an <svg>...</svg>.
   Parts are wrapped in <g class="part" data-step data-tip>
   so the step player can highlight them.
   ========================================================= */

const D = {};

const C = {
  pipe: '#7d8b99',
  blue: '#2563eb',
  red: '#d9480f',
  green: '#1a7f4e',
  cyan: '#1098ad',
  slate: '#5b6675',
  purple: '#7048e8',
  amber: '#f08c00',
  steel: '#4a5568',
  liquid: '#cfe3f7',
  liquidDark: '#9cc3ea',
};

D._defs = `
<defs>
  ${['pipe','blue','red','green','cyan','slate','purple','amber','steel'].map(k =>
    `<marker id="m-${k}" viewBox="0 0 10 10" refX="7.5" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse">
       <path d="M0,0 L10,5 L0,10 z" fill="${C[k]}"/>
     </marker>`).join('')}
</defs>`;

D.svg = (w, h, inner) =>
  `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" class="proc-svg" preserveAspectRatio="xMidYMid meet">${D._defs}${inner}</svg>`;

D.esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

D.label = (x, y, t, o = {}) => {
  const { size = 13, fill = '#39434f', anchor = 'middle', weight = 600, italic = false } = o;
  return `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" text-anchor="${anchor}" font-weight="${weight}"${italic ? ' font-style="italic"' : ''} style="paint-order:stroke;stroke:#fff;stroke-width:3.5px;stroke-linejoin:round;font-family:Inter,Arial,sans-serif">${D.esc(t)}</text>`;
};

D.pipe = (d, color = C.pipe, w = 3.5) =>
  `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;

D.flow = (d, color = C.pipe, w = 3.5, head = true) => {
  const k = Object.keys(C).find(kk => C[kk] === color) || 'pipe';
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${head ? ` marker-end="url(#m-${k})"` : ''}/>`;
};

D.valve = (x, y, rot = 0, color = C.steel) =>
  `<g transform="translate(${x},${y}) rotate(${rot})"><path d="M-10,-8 L-10,8 L0,0 Z M10,-8 L10,8 L0,0 Z" fill="#fff" stroke="${color}" stroke-width="2.4" stroke-linejoin="round"/></g>`;

D.pump = (x, y, color = C.steel) =>
  `<g transform="translate(${x},${y})"><circle r="12" fill="#fff" stroke="${color}" stroke-width="2.4"/><path d="M-5,-4 L5,0 L-5,4 Z" fill="${color}"/></g>`;

D.particle = (path, color, dur, begin = 0, r = 4.5, opacity = 0.85) =>
  `<circle r="${r}" fill="${color}" opacity="${opacity}"><animateMotion dur="${dur}s" repeatCount="indefinite" begin="${begin}s" path="${path}"/></circle>`;

D.bubble = (x, y, w, h, lines, o = {}) => {
  const ly = y + h / 2 - (lines.length - 1) * 9;
  return `<g><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14" fill="${o.fill || '#fffdf4'}" stroke="${o.stroke || '#d8cfa8'}" stroke-width="1.5" stroke-dasharray="6 4"/>
    ${lines.map((t, i) => D.label(x + w / 2, ly + i * 18, t, { size: 12, fill: o.text || '#6a6142', weight: 500 })).join('')}</g>`;
};

D.part = (step, tip, inner) =>
  `<g class="part" data-step="${step}" data-tip="${D.esc(tip)}">${inner}</g>`;

D.capsule = (x, y, w, h, o = {}) => {
  const { fill = '#fff', stroke = C.steel, sw = 3 } = o;
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
};

D.tank = (x, y, w, h, levelFrac, fill = C.liquid) => {
  const lvl = y + h - h * levelFrac;
  return `<g><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="#fff" stroke="${C.steel}" stroke-width="3"/>
    <rect x="${x + 2}" y="${lvl}" width="${w - 4}" height="${h - lvl - y - 2}" rx="6" fill="${fill}" opacity="0.9"/></g>`;
};

D.trays = (x1, x2, ys, color = C.slate) =>
  ys.map(y => `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${color}" stroke-width="3" stroke-linecap="round"/>
    <circle cx="${x1 + (x2 - x1) * 0.35}" cy="${y}" r="2.6" fill="#fff" stroke="${color}" stroke-width="1.6"/>
    <circle cx="${x1 + (x2 - x1) * 0.65}" cy="${y}" r="2.6" fill="#fff" stroke="${color}" stroke-width="1.6"/>`).join('');

D.columnShell = (x, y, w, h, o = {}) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${o.rx ?? 34}" fill="#fff" stroke="${o.stroke || C.steel}" stroke-width="3.5"/>`;

D.flowArrows = (xUp, xDown, yTop, yBot, step) => {
  let s = '';
  const n = 4, gap = (yBot - yTop) / (n + 1);
  for (let i = 1; i <= n; i++) {
    const y = yBot - i * gap;
    s += D.part(step, 'Vapour rises up (red) / liquid flows down (blue)',
      `<path d="M${xUp},${y + 7} L${xUp},${y - 7} L${xUp - 5},${y - 1} M${xUp},${y - 7} L${xUp + 5},${y - 1}" stroke="${C.red}" stroke-width="2.6" fill="none" stroke-linecap="round"/>
       <path d="M${xDown},${y - 7} L${xDown},${y + 7} L${xDown - 5},${y + 1} M${xDown},${y + 7} L${xDown + 5},${y + 1}" stroke="${C.blue}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`);
  }
  return s;
};

/* =========================================================
   1. SIMPLE DISTILLATION
   ========================================================= */
D.drawSimple = () => D.svg(900, 400, `
  ${D.part(1, 'Feed — the mixture to be separated, charged into the still',
    D.flow('M215,28 L215,184', C.blue, 4) + D.label(215, 20, 'Feed', { size: 14, fill: C.blue }))}

  ${D.part(1, 'Jacketed still (kettle) — steam circulates through the jacket to heat the mixture',
    D.pipe('M150,300 L150,215 Q150,190 175,190 L255,190 Q280,190 280,215 L280,300 Q280,322 258,322 L172,322 Q150,322 150,300 Z', C.slate, 3) +
    D.pipe('M140,310 L140,232 Q140,204 168,204 L262,204 Q290,204 290,232 L290,310', C.slate, 2.4) +
    D.label(310, 250, 'Still (kettle)', { size: 13, anchor: 'start' }))}

  ${D.part(2, 'Steam heats the still through the jacket; the more volatile component vaporizes',
    D.flow('M96,282 L136,282', C.red, 3.5) + D.label(88, 286, 'Steam', { size: 12.5, fill: C.red, anchor: 'end' }) +
    D.flow('M215,322 L215,368 L150,368', C.slate, 3) + D.label(142, 384, 'Condensate', { size: 12, fill: C.slate, anchor: 'end' }) +
    `<path d="M165,258 Q180,250 195,258 T225,258 T255,258 T285,258" fill="none" stroke="${C.liquidDark}" stroke-width="3"/>
     <rect x="153" y="258" width="134" height="60" fill="${C.liquid}"/>
     ${D.particle('M190,305 L190,262', C.liquidDark, 2.2, 0, 3.5)}
     ${D.particle('M230,308 L230,262', C.liquidDark, 2.6, -1, 3.5)}`)}

  ${D.part(3, 'Vapours pass from the still to the condenser',
    D.pipe('M250,190 L250,120 L530,120 L530,156', C.pipe, 4) +
    D.particle('M250,180 L250,120 L530,120 L570,140', '#f6b26b', 5, 0, 5) +
    D.particle('M250,180 L250,120 L530,120 L610,145', '#f6b26b', 5, -1.7, 5) +
    D.particle('M250,180 L250,120 L530,120 L650,150', '#f6b26b', 5, -3.3, 5) +
    D.label(400, 108, 'Vapour', { size: 13, fill: C.slate }))}

  ${D.part(3, 'Condenser — vapours are cooled and condensed',
    D.capsule(530, 130, 240, 52) +
    D.pipe('M550,156 L750,156', C.liquidDark, 4) +
    D.label(650, 122, 'Condenser', { size: 14, weight: 700 }))}

  ${D.part(4, 'Cooling water enters at the BOTTOM and leaves at the TOP of the condenser (counter-current)',
    D.flow('M770,140 L800,130', C.cyan, 3.5) + D.label(898, 126, 'Coolant out', { size: 12, fill: C.cyan, anchor: 'end' }) +
    D.flow('M800,170 L770,160', C.cyan, 3.5) + D.label(898, 176, 'Coolant in', { size: 12, fill: C.cyan, anchor: 'end' }))}

  ${D.part(5, 'Condensed liquid (distillate) drips into receivers R1 / R2',
    D.pipe('M650,182 L650,240', C.pipe, 3.5) +
    D.pipe('M650,240 L600,240 L600,268', C.pipe, 3.5) +
    D.pipe('M650,240 L760,240 L760,268', C.pipe, 3.5) +
    D.tank(572, 268, 56, 66, 0.55, '#d8f0e2') + D.label(600, 352, 'R1', { size: 12.5 }) +
    D.tank(732, 268, 56, 66, 0.4, '#d8f0e2') + D.label(760, 352, 'R2', { size: 12.5 }) +
    D.particle('M650,190 L650,240 L600,240 L600,272', C.green, 4, 0, 4) +
    D.particle('M650,190 L650,240 L760,240 L760,272', C.green, 4.6, -2, 4) +
    D.label(670, 374, 'R1, R2 = distillate receivers', { size: 12, fill: C.green }))}

  ${D.part(6, 'Residue — the less volatile component remains in the still',
    D.pipe('M215,322 L215,352', C.pipe, 3.5) + D.valve(215, 358) +
    D.flow('M215,372 L215,392', C.slate, 3.5) + D.label(270, 390, 'Residue (less volatile)', { size: 12.5, fill: C.slate, anchor: 'start' }))}
`);

/* =========================================================
   2. FRACTIONAL DISTILLATION
   ========================================================= */
D.drawFractional = () => {
  const trays = [120, 168, 216, 264, 312, 360, 408];
  return D.svg(900, 560, `
  ${D.part(1, 'Feed — introduced into the column at the feed inlet',
    D.flow('M170,246 L298,246', C.blue, 4) + D.label(120, 250, 'Feed', { size: 14, fill: C.blue, anchor: 'end' }))}

  ${D.columnShell(300, 60, 100, 380)}
  ${D.part(5, 'Trays / packing — each one gives a fresh vapour–liquid contact (stage)',
    D.trays(312, 388, trays) + D.label(290, 95, 'Fractionating column', { size: 13.5, weight: 700, anchor: 'end' }))}

  ${D.part(3, 'Vapour rises up through the column (more volatile component goes to the top)',
    D.flowArrows(334, 366, 90, 425, 3) +
    D.particle('M340,430 L340,95', C.red, 7, 0, 4.5) +
    D.particle('M344,430 L344,95', C.red, 7, -2.4, 4.5) +
    D.particle('M338,430 L338,95', C.red, 7, -4.8, 4.5))}

  ${D.part(4, 'Liquid from upper trays flows downward (less volatile component goes to the bottom)',
    D.particle('M358,95 L358,430', C.blue, 8, 0, 4.5) +
    D.particle('M362,95 L362,430', C.blue, 8, -2.6, 4.5) +
    D.particle('M356,95 L356,430', C.blue, 8, -5.2, 4.5))}

  ${D.part(2, 'Reboiler — heats the bottom liquid and generates vapour (steam in, condensate out)',
    D.pipe('M400,392 L455,392 L455,470 L500,470', C.pipe, 3.5) +
    D.pipe('M400,412 L435,412 L435,490 L500,490', C.pipe, 3.5) +
    D.capsule(500, 445, 190, 50, { stroke: C.steel }) +
    D.pipe('M520,470 L670,470', C.liquidDark, 4) +
    D.flow('M712,470 L676,470', C.red, 3.5) + D.label(718, 474, 'Steam in', { size: 12.5, fill: C.red, anchor: 'start' }) +
    D.flow('M595,495 L595,530', C.slate, 3) + D.label(595, 550, 'Condensate out', { size: 11.5, fill: C.slate }) +
    D.label(595, 438, 'Reboiler', { size: 13, weight: 700 }))}

  ${D.part(10, 'Bottoms (residue) — the less volatile product withdrawn from the column',
    D.pipe('M300,398 L238,398', C.pipe, 3.5) + D.valve(232, 398) +
    D.flow('M216,398 L168,398', C.slate, 3.5) + D.label(120, 392, 'Bottoms', { size: 13, fill: C.slate, anchor: 'end' }) +
    D.label(120, 408, '(residue)', { size: 11.5, fill: C.slate, anchor: 'end' }))}

  ${D.part(7, 'Overhead vapour is condensed in the condenser',
    D.pipe('M350,60 L350,30 L560,30 L560,76', C.pipe, 3.5) +
    D.capsule(560, 52, 220, 48) + D.pipe('M580,76 L760,76', C.liquidDark, 4) +
    D.flow('M772,66 L800,56', C.cyan, 3) + D.label(898, 52, 'Cooling water out', { size: 11.5, fill: C.cyan, anchor: 'end' }) +
    D.flow('M800,96 L772,86', C.cyan, 3) + D.label(898, 100, 'Cooling water in', { size: 11.5, fill: C.cyan, anchor: 'end' }) +
    D.particle('M350,55 L350,30 L560,30 L640,55', '#f6b26b', 5, 0, 4.5) +
    D.label(430, 22, 'Overhead vapour', { size: 12, fill: C.slate, anchor: 'start' }) + D.label(670, 44, 'Condenser', { size: 13, weight: 700 }))}

  ${D.part(8, 'Condensed liquid is collected in the reflux drum',
    D.pipe('M660,100 L660,128', C.pipe, 3.5) +
    D.capsule(630, 128, 200, 48) + D.pipe('M645,152 L815,152', C.liquid, 6) +
    D.label(730, 122, 'Reflux drum', { size: 12.5, weight: 700 }))}

  ${D.part(9, 'Part of the condensate returns to the column as REFLUX (pump); the rest is withdrawn as distillate',
    D.pump(610, 152, C.purple) +
    D.pipe('M598,152 L398,152', C.purple, 3.5) +
    D.flow('M410,152 L384,152', C.purple, 3.5) +
    D.label(480, 142, 'Reflux', { size: 12.5, fill: C.purple }) +
    D.valve(838, 152) + D.flow('M852,152 L884,152', C.green, 3.5) +
    D.label(898, 192, 'Distillate (top product)', { size: 12.5, fill: C.green, anchor: 'end' }))}

  ${D.part(6, 'On each tray vapour and liquid contact each other — light goes up, heavy goes down',
    `<g><rect x="620" y="230" width="260" height="180" rx="12" fill="#faf8f2" stroke="#d8cfa8" stroke-width="1.5" stroke-dasharray="6 4"/>
      ${D.label(750, 254, 'Inside column (tray contact)', { size: 12.5, fill: '#8a7d4f', weight: 700 })}
      <line x1="640" y1="295" x2="860" y2="295" stroke="${C.slate}" stroke-width="3"/>
      <line x1="640" y1="350" x2="860" y2="350" stroke="${C.slate}" stroke-width="3"/>
      ${[680, 735, 790].map(x => `<path d="M${x - 6},338 L${x - 6},306 L${x - 11},312 M${x - 6},306 L${x - 1},312" stroke="${C.red}" stroke-width="2.4" fill="none" stroke-linecap="round"/>
        <path d="M${x + 6},306 L${x + 6},338 L${x + 1},332 M${x + 6},338 L${x + 11},332" stroke="${C.blue}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`).join('')}
      ${D.label(875, 320, 'Vapour rises up', { size: 11.5, fill: C.red, anchor: 'end' })}
      ${D.label(875, 375, 'Liquid flows down', { size: 11.5, fill: C.blue, anchor: 'end' })}
      ${D.label(700, 398, 'Tray', { size: 11.5, fill: C.slate, anchor: 'start' })}
    </g>`)}
`);
};

/* =========================================================
   3. FLASH DISTILLATION
   ========================================================= */
D.drawFlash = () => D.svg(900, 420, `
  ${D.part(1, 'Pressurised liquid feed at (P₁, T₁, zᵢ)',
    D.tank(40, 150, 80, 110, 0.62) +
    D.label(80, 142, 'Feed (liquid)', { size: 13, weight: 700 }) + D.label(80, 282, 'P₁, T₁, zᵢ', { size: 11.5, fill: C.slate }) +
    D.pipe('M120,205 L176,205', C.pipe, 3.5) +
    D.particle('M122,205 L176,205', C.blue, 2, 0, 3.5))}

  ${D.part(2, 'Throttling valve — the sudden pressure reduction across the valve causes partial vaporization',
    D.pipe('M176,205 L216,205', C.pipe, 3.5) + D.valve(196, 205, 0, C.red) +
    D.pipe('M216,205 L326,205', C.pipe, 3.5) +
    D.label(196, 182, 'Throttling valve', { size: 12.5, fill: C.red, weight: 700 }) +
    D.bubble(120, 252, 210, 64, ['Sudden pressure reduction', 'across the valve causes', 'partial vaporization.']))}

  ${D.part(3, 'Flash drum (separator) — vapour and liquid reach equilibrium at drum pressure',
    D.columnShell(330, 80, 200, 250, { rx: 44 }) +
    D.pipe('M345,215 L515,215', C.liquidDark, 2.5) +
    [375, 410, 445, 480].map(x => `<path d="M${x},196 L${x},150 L${x - 5},157 M${x},150 L${x + 5},157" stroke="${C.amber}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`).join('') +
    `<rect x="343" y="218" width="174" height="103" fill="${C.liquid}" opacity="0.9"/>` +
    D.particle('M390,205 L390,130', '#f6b26b', 2.4, 0, 4) +
    D.particle('M430,205 L430,130', '#f6b26b', 2.8, -0.9, 4) +
    D.particle('M470,205 L470,130', '#f6b26b', 2.2, -1.6, 4) +
    `<circle cx="410" cy="260" r="4" fill="${C.blue}" opacity="0.5"><animate attributeName="cy" values="255;285;255" dur="4s" repeatCount="indefinite"/></circle>
     <circle cx="455" cy="280" r="3.4" fill="${C.blue}" opacity="0.5"><animate attributeName="cy" values="275;298;275" dur="5s" repeatCount="indefinite"/></circle>` +
    D.label(430, 135, 'VAPOUR', { size: 13, weight: 800, fill: '#8a5a17' }) +
    D.label(430, 250, 'LIQUID', { size: 13, weight: 800, fill: '#27548a' }) +
    D.label(418, 352, 'FLASH DRUM (SEPARATOR)', { size: 13, weight: 700, fill: C.slate, anchor: 'end' }))}

  ${D.part(4, 'Vapour outlet — the pressure control valve (PV) maintains drum operating pressure',
    D.pipe('M430,80 L430,44 L640,44', C.pipe, 3.5) +
    `<circle cx="668" cy="44" r="15" fill="#fff" stroke="${C.red}" stroke-width="2.6"/><text x="668" y="48" text-anchor="middle" font-size="11" font-weight="800" fill="${C.red}">PV</text>` +
    D.flow('M684,44 L830,44', C.pipe, 3.5) +
    D.label(898, 30, 'Vapour outlet → to condenser or further processing', { size: 12, fill: C.slate, anchor: 'end' }) +
    D.bubble(700, 76, 190, 58, ['Operating pressure of flash', 'drum is maintained by the', 'pressure control valve.']))}

  ${D.part(5, 'Liquid outlet — the level control valve (LC) maintains liquid level in the drum',
    D.pipe('M430,330 L430,372 L640,372', C.pipe, 3.5) +
    `<circle cx="668" cy="372" r="15" fill="#fff" stroke="${C.green}" stroke-width="2.6"/><text x="668" y="376" text-anchor="middle" font-size="11" font-weight="800" fill="${C.green}">LC</text>` +
    D.flow('M684,372 L830,372', C.pipe, 3.5) +
    D.label(756, 398, 'Liquid outlet → to further processing', { size: 12, fill: C.slate }) +
    D.bubble(700, 300, 190, 54, ['Level control valve maintains', 'liquid level in the drum.']))}

  ${D.part(6, 'Adiabatic single stage — no heat added; the flash uses the sensible heat of the feed, and both streams leave in equilibrium',
    D.bubble(30, 60, 265, 58, ['Adiabatic: no heat is added — the flash uses', 'the sensible heat of the feed. Both streams', 'leave in equilibrium at drum pressure.'], { fill: '#f0f7ff', stroke: '#b7d3f2', text: '#33608f' }))}
`);

/* =========================================================
   4. STEAM DISTILLATION
   ========================================================= */
D.drawSteam = () => D.svg(900, 470, `
  ${D.part(1, 'Steam is generated in a boiler and introduced into the distillation vessel',
    D.pipe('M250,52 L250,150', C.pipe, 4) + D.valve(250, 90) +
    D.flow('M250,30 L250,44', C.red, 4) + D.label(250, 22, 'Steam inlet', { size: 13, fill: C.red, weight: 700 }))}

  ${D.part(2, 'Mixture of water and organic compound — steam passes through the material',
    `<circle cx="250" cy="290" r="105" fill="#fff" stroke="${C.steel}" stroke-width="3.5"/>
     <path d="M152,318 A105,105 0 0 0 348,318 L348,290 L152,290 Z" fill="${C.liquid}"/>
     ${[185, 220, 260, 295, 320, 240, 300, 205].map((x, i) => `<circle cx="${x}" cy="${330 + (i % 3) * 16}" r="4" fill="${C.amber}" opacity="0.85"/>`).join('')}
     <rect x="232" y="150" width="36" height="52" fill="#fff" stroke="${C.steel}" stroke-width="3"/>
     ${D.particle('M245,370 L247,180', '#fff', 3, 0, 5, 0.9)}
     ${D.particle('M255,375 L253,180', '#ffd8a8', 3.4, -1.2, 4.5, 0.9)}
     ${D.particle('M249,378 L251,180', '#fff', 2.7, -2.2, 4, 0.85)}
     ${D.label(250, 300, 'Mixture of water and', { size: 12.5, fill: '#27548a' })}${D.label(250, 316, 'organic compound', { size: 12.5, fill: '#27548a' })}
     ${D.flow('M140,340 L96,340', C.slate, 3.5)}${D.label(90, 336, 'Steam out', { size: 12, fill: C.slate, anchor: 'end' })}
     ${D.flow('M250,440 L250,404', C.red, 4.5)}${D.label(250, 456, 'Heat', { size: 13, fill: C.red, weight: 700 })}`)}

  ${D.part(3, 'Volatile, water-immiscible compounds vaporize along with steam',
    `<path d="M268,180 L300,140 L560,140" fill="none" stroke="${C.pipe}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
     ${D.particle('M300,140 L600,140', '#f6b26b', 4.5, 0, 4.5)}
     ${D.particle('M300,140 L600,140', '#f6b26b', 4.5, -1.5, 4.5)}
     ${D.particle('M300,140 L600,140', '#f6b26b', 4.5, -3, 4.5)}
     ${D.label(430, 126, 'Vapour (steam + organic vapour)', { size: 12.5, fill: C.slate })}`)}

  ${D.part(4, 'In the condenser, vapour is cooled and condensed to liquid (cooling water in at bottom, out at top)',
    D.capsule(560, 114, 210, 52) + D.pipe('M580,140 L750,140', C.liquidDark, 4) +
    D.flow('M770,124 L800,114', C.cyan, 3) + D.label(898, 110, 'Cooling water out', { size: 12, fill: C.cyan, anchor: 'end' }) +
    D.flow('M800,158 L770,148', C.cyan, 3) + D.label(898, 164, 'Cooling water in', { size: 12, fill: C.cyan, anchor: 'end' }) +
    D.label(665, 104, 'Condenser', { size: 13, weight: 700 }))}

  ${D.part(5, 'Distillate is collected in the receiver (separating funnel)',
    D.pipe('M665,166 L665,205', C.pipe, 3.5) +
    D.particle('M665,170 L665,205', C.green, 2.2, 0, 4) +
    D.columnShell(635, 205, 90, 175, { rx: 34 }) +
    D.label(745, 240, 'Receiver', { size: 12.5, weight: 700, anchor: 'start' }) + D.label(745, 256, '(separating funnel)', { size: 11, fill: C.slate, anchor: 'start' }))}

  ${D.part(6, 'Since organic compound and water are immiscible, two separate layers form',
    `<path d="M638,262 L722,262 L722,305 L638,305 Z" fill="#fbe4a2"/>
     <path d="M638,305 L722,305 L722,352 Q722,376 700,378 L660,378 Q638,376 638,352 Z" fill="${C.liquid}"/>
     <line x1="638" y1="262" x2="722" y2="262" stroke="${C.steel}" stroke-width="2"/>
     <line x1="638" y1="305" x2="722" y2="305" stroke="${C.steel}" stroke-width="2" stroke-dasharray="4 3"/>`)}

  ${D.part(7, 'Organic layer (oil) is lighter or heavier than water depending on the compound, and is separated',
    D.label(740, 284, 'Organic layer (oil)', { size: 11.5, fill: '#9a6b00', anchor: 'start' }) +
    D.label(740, 342, 'Aqueous layer (water)', { size: 11.5, fill: '#27548a', anchor: 'start' }) +
    D.pipe('M680,380 L680,412', C.pipe, 3.5) + D.valve(680, 418) +
    D.flow('M680,432 L680,452', C.slate, 3.5))}
`);

/* =========================================================
   5. VACUUM DISTILLATION
   ========================================================= */
D.drawVacuum = () => D.svg(900, 470, `
  ${D.part(1, 'Feed is taken from the feed tank',
    D.tank(45, 190, 80, 105, 0.6) + D.label(85, 182, 'Feed tank', { size: 12.5, weight: 700 }) +
    D.pipe('M125,242 L168,242', C.pipe, 3.5))}

  ${D.part(2, 'Feed may be preheated in a preheater (if required)',
    D.capsule(168, 224, 70, 36) + D.label(203, 218, 'Preheater', { size: 11.5, fill: C.slate }) +
    D.pipe('M238,242 L262,242 L262,352', C.pipe, 3.5))}

  ${D.part(3, 'Heater / reboiler — heat is supplied (steam in, condensate out)',
    D.capsule(240, 352, 130, 46) + D.pipe('M255,375 L355,375', C.liquidDark, 4) +
    D.flow('M232,375 L248,375', C.red, 3.5) + D.label(226, 368, 'Steam in', { size: 11.5, fill: C.red, anchor: 'end' }) +
    D.flow('M305,398 L305,432', C.slate, 3) + D.label(305, 448, 'Condensate', { size: 11, fill: C.slate }) +
    D.label(310, 342, 'Heater / Reboiler', { size: 12.5, weight: 700, anchor: 'start' }))}

  ${D.part(4, 'Vacuum pump / ejector removes non-condensable gases and reduces the pressure; vacuum gauge shows the level',
    D.pipe('M470,90 L470,36 L800,36', C.pipe, 3.5) +
    D.valve(540, 36) + D.label(540, 22, 'Vacuum control valve', { size: 11, fill: C.slate }) +
    `<circle cx="615" cy="36" r="14" fill="#fff" stroke="${C.purple}" stroke-width="2.6"/><path d="M615,36 L621,28" stroke="${C.purple}" stroke-width="2.4"/>
     <g transform="translate(700,36)"><path d="M-14,-10 L14,0 L-14,10 Z" fill="#fff" stroke="${C.purple}" stroke-width="2.6"/></g>` +
    D.label(615, 74, 'gauge', { size: 10.5, fill: C.purple, weight: 700 }) +
    D.label(732, 60, 'Vacuum pump / ejector', { size: 11, fill: C.purple }) +
    D.flow('M816,36 L856,36', C.slate, 3.5) + D.label(898, 20, 'Discharge to atmosphere', { size: 11, fill: C.slate, anchor: 'end' }) +
    D.particle('M480,32 L700,36', C.purple, 3, 0, 3.5, 0.6) +
    D.particle('M480,32 L700,36', C.purple, 3, -1.5, 3.5, 0.6))}

  ${D.columnShell(440, 90, 110, 300, { rx: 36 })}
  ${D.part(7, 'In the column, vapour and liquid contact on trays or packing → separation takes place',
    D.trays(452, 538, [150, 205, 260, 315], '#9aa7b5') +
    D.label(458, 80, 'Vacuum distillation column', { size: 12.5, weight: 700, anchor: 'end' }))}

  ${D.part(5, 'Due to low pressure, the liquid boils at LOWER temperature and vapours are generated',
    `<rect x="452" y="340" width="86" height="44" fill="${C.liquid}"/>
     ${D.particle('M470,378 L470,346', C.liquidDark, 1.8, 0, 3.4)}
     ${D.particle('M495,380 L495,346', C.liquidDark, 2.1, -0.8, 3.4)}
     ${D.particle('M520,378 L520,346', C.liquidDark, 1.6, -1.2, 3.4)}`)}

  ${D.part(6, 'Vapours rise through the column (large vapour volume at low pressure → wider column)',
    D.pipe('M370,375 L436,375', C.pipe, 3.5) +
    D.particle('M490,385 L490,96', C.red, 6, 0, 4.5) +
    D.particle('M482,385 L482,96', C.red, 6, -2, 4.5) +
    D.particle('M498,385 L498,96', C.red, 6, -4, 4.5))}

  ${D.part(8, 'Overhead vapours go to the condenser and get condensed',
    D.pipe('M550,120 L600,120', C.pipe, 3.5) +
    D.capsule(600, 94, 210, 52) + D.pipe('M620,120 L790,120', C.liquidDark, 4) +
    D.flow('M810,106 L840,96', C.cyan, 3) + D.label(898, 94, 'Cooling water out', { size: 11, fill: C.cyan, anchor: 'end' }) +
    D.flow('M840,144 L810,134', C.cyan, 3) + D.label(898, 150, 'Cooling water in', { size: 11, fill: C.cyan, anchor: 'end' }) +
    D.label(705, 88, 'Condenser', { size: 13, weight: 700 }))}

  ${D.part(9, 'Condensed liquid is collected in the distillate receiver (overhead product)',
    D.pipe('M705,146 L705,172', C.pipe, 3.5) +
    D.tank(672, 172, 66, 92, 0.5, '#d8f0e2') + D.label(705, 286, 'Distillate (overhead product)', { size: 11.5, fill: C.green }))}

  ${D.part(10, 'Heavier / less volatile liquid leaves from the bottom as bottom product',
    D.pipe('M495,390 L495,432', C.pipe, 3.5) +
    D.flow('M495,432 L600,432', C.slate, 3.5) + D.label(610, 436, 'Bottom product', { size: 12.5, fill: C.slate, anchor: 'start' }))}
`);

/* =========================================================
   6. AZEOTROPIC DISTILLATION
   ========================================================= */
D.drawAzeotropic = () => {
  const trays = [140, 190, 240, 290, 340, 390];
  return D.svg(900, 555, `
  ${D.part(1, 'Feed (azeotropic mixture) and entrainer are fed to the distillation column',
    D.flow('M160,255 L278,255', C.blue, 4) +
    D.label(6, 248, 'Feed (azeotropic mixture)', { size: 12.5, fill: C.blue, anchor: 'start' }) +
    D.flow('M160,150 L278,150', C.amber, 4) +
    D.label(6, 143, 'Entrainer (small quantity)', { size: 12.5, fill: C.amber, anchor: 'start' }))}

  ${D.columnShell(280, 80, 100, 350)}
  ${D.part(3, 'The entrainer changes the relative volatility of the key components — each tray now gives a better split',
    D.trays(292, 368, trays, '#9aa7b5') +
    D.bubble(38, 448, 232, 62, ['With entrainer present, the relative', 'volatility α of the key components', 'changes on every tray.']) +
    `<line x1="270" y1="466" x2="298" y2="430" stroke="#9a7b2d" stroke-width="1.5" stroke-dasharray="4 3"/>`)}
  ${D.part(4, 'Vapour rises, liquid flows down — on each tray they contact each other',
    D.flowArrows(312, 348, 100, 415, 4) +
    D.particle('M318,420 L318,100', C.red, 7, 0, 4) +
    D.particle('M340,100 L340,420', C.blue, 8, 0, 4))}

  ${D.part(2, 'In the reboiler, the mixture is partially vaporized (steam in, condensate out)',
    D.pipe('M380,392 L440,392 L440,462 L490,462', C.pipe, 3.5) +
    D.pipe('M380,412 L425,412 L425,482 L490,482', C.pipe, 3.5) +
    D.capsule(490, 445, 190, 50) + D.pipe('M510,470 L660,470', C.liquidDark, 4) +
    D.flow('M706,470 L670,470', C.red, 3.5) + D.label(712, 474, 'Steam in', { size: 12, fill: C.red, anchor: 'start' }) +
    D.flow('M585,495 L585,530', C.slate, 3) + D.label(585, 548, 'Condensate out', { size: 11, fill: C.slate }) +
    D.label(585, 438, 'Reboiler', { size: 13, weight: 700 }))}

  ${D.part(5, 'Overhead vapour is condensed in the condenser',
    D.pipe('M330,80 L330,40 L560,40 L560,62', C.pipe, 3.5) +
    D.capsule(560, 38, 210, 48) + D.pipe('M580,62 L750,62', C.liquidDark, 4) +
    D.flow('M770,48 L800,38', C.cyan, 3) + D.label(898, 34, 'Cooling water out', { size: 11, fill: C.cyan, anchor: 'end' }) +
    D.flow('M800,78 L770,68', C.cyan, 3) + D.label(898, 84, 'Cooling water in', { size: 11, fill: C.cyan, anchor: 'end' }) +
    D.particle('M330,75 L330,40 L560,40 L640,55', '#f6b26b', 5, 0, 4.5) +
    D.label(665, 30, 'Condenser', { size: 13, weight: 700 }) +
    D.label(445, 32, 'Overhead vapour', { size: 11.5, fill: C.slate }))}

  ${D.part(6, 'Condensed liquid goes to the decanter where TWO liquid phases form (entrainer & water are immiscible)',
    D.pipe('M665,86 L665,110 L700,110 L700,140', C.pipe, 3.5) +
    D.columnShell(660, 140, 80, 185, { rx: 34 }) +
    `<path d="M663,180 L737,180 L737,230 L663,230 Z" fill="#fbe4a2"/>
     <path d="M663,230 L737,230 L737,296 Q737,320 713,322 L687,322 Q663,320 663,296 Z" fill="${C.liquid}"/>
     <line x1="663" y1="230" x2="737" y2="230" stroke="${C.steel}" stroke-width="2" stroke-dasharray="4 3"/>` +
    D.label(700, 132, 'Decanter (separator)', { size: 12, weight: 700 }) +
    D.bubble(430, 255, 235, 66, ['Note: Two liquid phases form in', 'decanter because entrainer and', 'water are immiscible.']))}

  ${D.part(7, 'Organic / entrainer-rich phase (top) is returned to the column as reflux',
    D.pipe('M660,195 L400,195', C.amber, 3.5) +
    D.flow('M412,195 L384,195', C.amber, 3.5) +
    D.label(540, 186, 'Reflux', { size: 12.5, fill: C.amber }) +
    D.label(752, 200, 'Organic layer', { size: 11, fill: '#9a6b00', anchor: 'start' }) +
    D.label(752, 214, '(entrainer-rich)', { size: 10.5, fill: '#9a6b00', anchor: 'start' }))}

  ${D.part(8, 'Water-rich phase (bottom) is withdrawn as product (distillate)',
    D.pipe('M700,325 L700,392', C.pipe, 3.5) +
    D.flow('M700,392 L700,428', C.green, 3.5) +
    D.label(712, 446, 'Product (distillate)', { size: 12.5, fill: C.green, anchor: 'start' }) +
    D.label(752, 270, 'Water-rich phase', { size: 11, fill: '#27548a', anchor: 'start' }))}

  ${D.part(9, 'Bottoms may be water-rich or the heavy component, depending on the system',
    D.pipe('M280,400 L210,400', C.pipe, 3.5) + D.valve(204, 400) +
    D.flow('M188,400 L130,400', C.slate, 3.5) +
    D.label(6, 394, 'Bottoms (residue)', { size: 12.5, fill: C.slate, anchor: 'start' }))}
`);
};

/* =========================================================
   7. EXTRACTIVE DISTILLATION
   ========================================================= */
D.drawExtractive = () => D.svg(900, 555, `
  ${D.part(1, 'Feed (A + B mixture) enters the distillation column near the top',
    D.flow('M130,130 L248,130', C.blue, 4) + D.label(122, 124, 'FEED', { size: 13, fill: C.blue, anchor: 'end' }) +
    D.label(122, 140, '(A + B mixture)', { size: 11, fill: C.slate, anchor: 'end' }))}

  ${D.part(2, 'Entrainer (high-boiling solvent) is added — it changes the relative volatility α of the mixture',
    D.flow('M130,215 L248,215', C.amber, 4) + D.label(122, 209, 'ENTRAINER', { size: 12.5, fill: C.amber, anchor: 'end' }) +
    D.label(122, 225, '(solvent)', { size: 11, fill: C.slate, anchor: 'end' }))}

  ${D.columnShell(250, 80, 100, 340)}
  ${D.part(4, 'Component A (more volatile) rises; component B + solvent flow down — separation takes place',
    D.trays(262, 338, [150, 205, 260, 315, 370], '#9aa7b5') +
    D.flowArrows(282, 318, 100, 405, 4) +
    D.label(246, 64, 'DISTILLATION COLUMN', { size: 12.5, weight: 700, anchor: 'end' }))}

  ${D.part(3, 'Reboiler generates vapour (steam in, condensate out)',
    D.pipe('M250,392 L190,392 L190,462 L150,462', C.pipe, 3.5) +
    D.pipe('M250,412 L205,412 L205,482 L150,482', C.pipe, 3.5) +
    D.capsule(60, 445, 130, 46) + D.pipe('M75,468 L175,468', C.liquidDark, 4) +
    D.flow('M125,491 L125,524', C.slate, 3) + D.label(125, 546, 'Condensate out', { size: 11, fill: C.slate }) +
    D.flow('M52,468 L66,468', C.red, 3.5) + D.label(12, 452, 'Steam in', { size: 11.5, fill: C.red, anchor: 'start' }) +
    D.label(125, 438, 'REBOILER', { size: 12.5, weight: 700 }))}

  ${D.part(5, 'Top vapour is condensed — distillate is usually the more volatile component A',
    D.pipe('M330,80 L330,40 L520,40 L520,62', C.pipe, 3.5) +
    D.capsule(520, 38, 190, 48) + D.pipe('M540,62 L690,62', C.liquidDark, 4) +
    D.flow('M710,48 L740,38', C.cyan, 3) + D.label(898, 34, 'Cooling water out', { size: 11, fill: C.cyan, anchor: 'end' }) +
    D.flow('M740,78 L710,68', C.cyan, 3) + D.label(898, 84, 'Cooling water in', { size: 11, fill: C.cyan, anchor: 'end' }) +
    D.particle('M330,75 L330,40 L520,40 L600,55', '#f6b26b', 5, 0, 4.5) +
    D.label(615, 30, 'CONDENSER', { size: 12.5, weight: 700 }) +
    D.pipe('M640,86 L640,140', C.pipe, 3.5) + D.valve(640, 146) +
    D.flow('M640,160 L640,196', C.green, 3.5) +
    D.label(652, 214, 'DISTILLATE', { size: 12, fill: C.green, anchor: 'start' }) +
    D.label(652, 228, '(usually more volatile component A)', { size: 10.5, fill: C.slate, anchor: 'start' }))}

  ${D.part(6, 'Bottoms (rich in entrainer + less volatile component B) go to the solvent recovery column',
    D.pipe('M300,420 L300,470 L480,470 L480,260 L505,260', C.pipe, 3.5) +
    D.label(390, 492, 'BOTTOMS (entrainer + less volatile component B)', { size: 10.5, fill: C.slate }))}

  ${D.part(7, 'Solvent is recovered and recycled; product B is withdrawn from the recovery column',
    D.columnShell(500, 180, 70, 240, { rx: 28 }) +
    D.trays(508, 562, [230, 285, 340, 395], '#9aa7b5') +
    D.label(535, 172, 'SOLVENT RECOVERY COLUMN', { size: 11.5, weight: 700 }) +
    D.pipe('M535,180 L535,140 L352,140', C.amber, 3.5) +
    D.flow('M364,140 L352,140', C.amber, 3.5) +
    D.label(460, 132, 'Solvent recycle (overhead solvent vapour)', { size: 11, fill: C.amber }) +
    D.particle('M535,175 L535,140 L360,140', C.amber, 4, 0, 3.6) +
    D.pipe('M535,420 L535,470', C.pipe, 3.5) +
    D.flow('M535,470 L690,470', C.slate, 3.5) +
    D.label(700, 474, 'Bottom (product B)', { size: 12.5, fill: C.slate, anchor: 'start' }))}
`);

D.draw = {
  simple: D.drawSimple,
  fractional: D.drawFractional,
  flash: D.drawFlash,
  steam: D.drawSteam,
  vacuum: D.drawVacuum,
  azeotropic: D.drawAzeotropic,
  extractive: D.drawExtractive,
};
