/* =====================================================================
   QUALITY LAB PATCH  (Manager = QUANTITY, Lab = QUALITY, System = CALC)
   Paste order in your HTML <script>:
   1) Replace the Quality entry in systemModules with:
      { id:'Quality', label:'Quality', subMenus:['Quality Control Points','Milk Inward Lab Check','Cream Separation Lab','Ghee Lab','Curd Lab','Inspection Reports'] },
   2) Paste THIS WHOLE FILE just above  function renderApp()
   3) In renderWorkspace(), directly under  // 5. QUALITY  / if (currentModule === 'Quality') {  add:
        if (labMap[currentSubMenu]) { labStage = labMap[currentSubMenu]; renderLabScreen(viewport); return; }
        if (currentSubMenu === 'Inspection Reports') { renderLabRecords(viewport); return; }
   4) In 'Raw Milk Intake' rows replace currentSubMenu=\'Inward Lab Gatekeeper\' with \'Milk Inward Lab Check\'
   ===================================================================== */
const labMap = { 'Milk Inward Lab Check': 'milk', 'Cream Separation Lab': 'cream', 'Ghee Lab': 'ghee', 'Curd Lab': 'curd' };
const labTitle = { milk: 'Milk Inward Lab Check', cream: 'Cream Separation Lab', ghee: 'Ghee Lab Check', curd: 'Curd Lab Check' };
const labCode = { milk: 'M', cream: 'C', ghee: 'G', curd: 'D' };
const adulterants = ['Added water', 'Starch', 'Cane sugar', 'Glucose', 'Maltodextrin', 'Urea', 'Detergent', 'Neutraliser', 'Salt', 'Hydrogen peroxide', 'Formalin', 'Boric acid', 'Ammonium sulphate'];
let labStage = 'milk', labRaw = 'Cream', labPos = new Set(), labResult = null;
const labRecords = [
  { batch: 'GD-P1-061126-D-04', stage: 'Curd', qty: '1,000 L / 1,045 kg', variance: '-0.2 %', decision: 'Accept', lab: 'Demo Lab Chemist', mgr: 'Demo Manager', time: '06 Nov 2026 06:40' },
  { batch: 'GD-P1-061126-G-02', stage: 'Ghee', qty: '500 kg cream / 172 kg ghee', variance: '-4.4 %', decision: 'Hold', lab: 'Demo Lab Chemist', mgr: 'Demo Manager', time: '06 Nov 2026 09:10' }
];

const $l = id => document.getElementById(id);
const nv = id => parseFloat($l(id)?.value) || 0;
const has = id => ($l(id)?.value || '') !== '';
const fx = (v, d = 2) => isFinite(v) ? v.toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—';
const fld = (id, label, ph = '', type = 'number', ro = false) => `<div class="form-group"><label class="form-label">${label}</label><input id="${id}" type="${type}" step="any" placeholder="${ph}" class="form-control font-mono" ${ro ? 'readonly style="background:#E6F4FA"' : ''} oninput="labCalc()"></div>`;
const sel = (id, label, opts, oc = 'labCalc()') => `<div class="form-group"><label class="form-label">${label}</label><select id="${id}" class="form-control" onchange="${oc}">${opts.map(o => `<option>${o}</option>`).join('')}</select></div>`;
const pn = (id, label) => sel(id, label, ['Negative', 'Positive']);
const grid = (h, min = 150) => `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(${min}px,1fr));gap:12px;align-items:start">${h}</div>`;
const panel = (t, tag, cls, body) => `<div style="border:1px solid #E2E8F0;border-radius:12px;padding:16px;background:#F8FAFC"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><strong style="color:#004B6E;font-size:13px">${t}</strong><span class="badge ${cls}">${tag}</span></div>${body}</div>`;
const tile = (l, v) => `<div class="report-summary-card"><div class="report-summary-label">${l}</div><div class="report-summary-value">${v}</div></div>`;
const chk = (ok, t) => `<span class="badge ${ok ? 'badge-green' : 'badge-red'}" style="margin:2px">${ok ? 'OK' : 'FAIL'} · ${t}</span>`;
const setRO = (id, v) => { $l(id).readOnly = v; $l(id).style.background = v ? '#E6F4FA' : ''; };
function checker() {
  const o = { chks: [], fails: 0 };
  o.c = (ok, t) => { o.chks.push(chk(ok, t)); if (!ok) o.fails++; };
  o.r = (id, l, lo, hi) => { if (has(id)) o.c(nv(id) >= lo && nv(id) <= hi, `${l} ${fx(nv(id))} (${lo}–${hi})`); };
  return o;
}
const timeMin = id => { const [h, m] = $l(id).value.split(':'); return (+h) * 60 + (+m); };

/* ---------- Stage forms: manager (quantity) + lab (quality) ---------- */
const labBuild = {
  milk: () => ({
    mgr: sel('m-unit', 'Unit', ['Litres', 'kg']) + fld('m-qty', 'Quantity') + fld('m-tanker', 'Tanker / Can No.', '', 'text') + fld('m-challan', 'Challan No.', '', 'text'),
    lab: fld('l-st', 'Sample time', '', 'time') + fld('l-sn', 'Sample No.', 'S-118', 'text') + fld('l-temp', 'Temp at receipt (°C)') +
      sel('l-mode', 'Calculation option', ['A: CLR + Fat → SNF', 'B: SNF + Fat → CLR', 'C: CLR + SNF → Fat']) +
      fld('l-lr', 'Lactometer reading (LR)') + fld('l-lt', 'Lactometer temp (°C)', '27') + fld('l-clr', 'CLR @ 27 °C') +
      fld('l-fat', 'Fat % (0.1–9.0)') + fld('l-snf', 'SNF % (0.1–9.0)') + fld('l-acid', 'Acidity % lactic (0.12–0.18)') + fld('l-prot', 'Protein %') +
      pn('l-cob', 'COB (clot on boiling)') + pn('l-a60', 'Alcohol 60 %') + pn('l-a65', 'Alcohol 65 %') + pn('l-a68', 'Alcohol 68 %') + pn('l-a70', 'Alcohol 70 %') +
      fld('l-mb1', 'MBRT start (hh:mm)', '', 'time') + fld('l-mb2', 'MBRT out (hh:mm)', '', 'time') + fld('l-mbt', 'MBRT total (h) — auto', '', 'number', true),
    extra: `<div style="border:1px solid #E2E8F0;border-radius:12px;padding:16px"><div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:10px"><strong style="color:#004B6E;font-size:13px">Adulteration — Negative? <span id="l-neg"></span></strong><span style="font-size:11px;color:#64748B">Default Negative = Yes. Tap a test to mark it Positive (Negative? becomes No).</span></div><div id="l-adul" style="display:flex;flex-wrap:wrap;gap:8px"></div></div>`
  }),
  cream: () => ({
    mgr: fld('c-milk', 'Milk in (kg)') + fld('c-cream', 'Cream out — actual (kg)') + fld('c-skim', 'Skim out — actual (kg)'),
    lab: fld('c-fm', 'Fat % of milk (Fm)') + fld('c-fc', 'Fat % of cream (Fc)') + fld('c-fs', 'Fat % of skim (Fs, max 0.10)')
  }),
  ghee: () => ({
    mgr: sel('g-raw', 'Raw material', ['Cream', 'Butter / White makkhan', 'Malai'], 'labRaw=this.value;renderLabScreen()') + fld('g-in', labRaw + ' in (kg)') + fld('g-out', 'Ghee out — actual (kg)') + fld('g-res', 'Residue (kg)'),
    lab: sel('g-reg', 'Limit set', ['General', 'Cotton-tract']) +
      (labRaw === 'Butter / White makkhan' ? fld('g-mo', 'Butter moisture %') + fld('g-cu', 'Curd %') + fld('g-sa', 'Salt %') : fld('g-cf', (labRaw === 'Cream' ? 'Cream' : 'Malai') + ' fat %')) +
      fld('g-br', 'BR reading @ 40 °C') + fld('g-rm', 'RM value') + fld('g-pol', 'Polenske value') + sel('g-baud', 'Baudouin test', ['Negative', 'Positive']) +
      fld('g-moist', 'Ghee moisture %') + fld('g-ffa', 'FFA (% oleic)') + fld('g-mf', 'Milk fat % (min 99.5)') + sel('g-sens', 'Colour / flavour / grain', ['Typical', 'Burnt / rancid'])
  }),
  curd: () => ({
    mgr: fld('u-l', 'Milk (L)') + fld('u-smp', 'SMP (kg)') + fld('u-cul', 'Culture (kg)') + fld('u-out', 'Curd out — actual (kg)') + fld('u-loss', 'Process loss % (0.5–1.5; +2–5 if boiled open)'),
    lab: fld('u-clr', 'Milk CLR') + fld('u-mf', 'Milk Fat %') + fld('u-ms', 'Milk SNF %') + fld('u-macid', 'Milk acidity %') + pn('u-cob', 'COB') + pn('u-alc', 'Alcohol test') +
      fld('u-heat', 'Heat treatment (°C, 85–90)') + fld('u-hold', 'Hold time (min, 5–10)') + fld('u-inoc', 'Inoculation temp (°C, 37–42)') + fld('u-cpct', 'Culture % (1.5–2.5)') +
      fld('u-acid', 'Acidity at break (0.70–0.80)') + fld('u-ph', 'pH at break (4.5–4.7)') + fld('u-cf', 'Curd Fat %') + fld('u-cs', 'Curd SNF %') +
      sel('u-body', 'Body / whey', ['Firm, smooth, no free whey', 'Free whey / weak body']) + fld('u-store', 'Storage / dispatch temp (°C, ≤5)')
  })
};

/* ---------- Stage calculations (formulas from client PDF) ---------- */
const labCalcs = {
  milk: () => {
    const mode = $l('l-mode').value[0], K = checker();
    if (mode !== 'B' && has('l-lr')) $l('l-clr').value = (nv('l-lr') + 0.2 * ((has('l-lt') ? nv('l-lt') : 27) - 27)).toFixed(2);
    setRO('l-clr', mode === 'B' || has('l-lr')); setRO('l-snf', mode === 'A'); setRO('l-fat', mode === 'C');
    if (mode === 'A' && has('l-clr') && has('l-fat')) $l('l-snf').value = (nv('l-clr') / 4 + 0.22 * nv('l-fat') + 0.72).toFixed(2);
    if (mode === 'B' && has('l-snf') && has('l-fat')) $l('l-clr').value = (4 * (nv('l-snf') - 0.22 * nv('l-fat') - 0.72)).toFixed(2);
    if (mode === 'C' && has('l-clr') && has('l-snf')) $l('l-fat').value = ((nv('l-snf') - nv('l-clr') / 4 - 0.72) / 0.22).toFixed(2);
    if (has('l-mb1') && has('l-mb2')) $l('l-mbt').value = ((((timeMin('l-mb2') - timeMin('l-mb1')) % 1440 + 1440) % 1440) / 60).toFixed(2);
    const clr = nv('l-clr'), fat = nv('l-fat'), snf = nv('l-snf'), q = nv('m-qty'), inL = $l('m-unit').value === 'Litres';
    const kg = inL ? q * (1 + clr / 1000) : q, lit = inL ? q : q / (1 + clr / 1000);
    K.r('l-fat', 'Fat %', 0.1, 9); K.r('l-snf', 'SNF %', 0.1, 9); K.r('l-acid', 'Acidity', 0.12, 0.18);
    K.c($l('l-cob').value === 'Negative', 'COB');
    [['l-a60', '60'], ['l-a65', '65'], ['l-a68', '68'], ['l-a70', '70']].forEach(([id, p]) => K.c($l(id).value === 'Negative', `Alcohol ${p} %`));
    const pos = [...labPos].map(i => adulterants[i]);
    K.c(!pos.length, 'Adulteration: ' + (pos.length ? pos.join(', ') : 'none'));
    $l('l-neg').innerHTML = `<span class="badge ${pos.length ? 'badge-red' : 'badge-green'}">${pos.length ? 'No' : 'Yes'}</span>`;
    $l('l-adul').innerHTML = adulterants.map((a, i) => `<button type="button" class="badge ${labPos.has(i) ? 'badge-red' : 'badge-green'}" style="cursor:pointer" onclick="labPos.has(${i})?labPos.delete(${i}):labPos.add(${i});labCalc()">${a}: ${labPos.has(i) ? 'POSITIVE' : 'Negative'}</button>`).join('');
    return {
      tiles: [tile('Milk (kg)', fx(kg)), tile('Milk (L)', fx(lit)), tile('kg Fat', fx(kg * fat / 100)), tile('kg SNF', fx(kg * snf / 100)), tile('Total Solids %', fx(fat + snf)), tile('MBRT total', has('l-mbt') ? $l('l-mbt').value + ' h' : '—')],
      chks: K.chks, fails: K.fails, outside: false, suggest: pos.length ? 'Reject' : K.fails ? 'Hold' : 'Accept',
      qty: q ? `${fx(lit, 0)} L / ${fx(kg, 0)} kg` : '', variance: '—'
    };
  },
  cream: () => {
    const K = checker(), M = nv('c-milk'), Fm = nv('c-fm'), Fc = nv('c-fc'), Fs = nv('c-fs'), act = nv('c-cream');
    const exp = Fc > Fs ? M * (Fm - Fs) / (Fc - Fs) : 0, skim = M - exp, v = exp && act ? (act - exp) / exp * 100 : 0;
    const outside = !!(exp && act && Math.abs(v) > 2);
    if (exp && act) K.c(!outside, `Cream ${fx(act, 1)} kg vs ${fx(exp * .98, 1)}–${fx(exp * 1.02, 1)} (±2 %)`);
    if (has('c-fs')) K.c(Fs <= 0.10, `Skim fat ${fx(Fs)} % (≤ 0.10)`);
    return {
      tiles: [tile('Expected cream (kg)', fx(exp, 1)), tile('Expected skim (kg)', fx(skim, 1)), tile('Cream variance', exp && act ? fx(v, 1) + ' %' : '—'), tile('Actual skim (kg)', fx(nv('c-skim'), 1))],
      chks: K.chks, fails: K.fails, outside, suggest: K.fails ? 'Hold' : 'Accept', qty: M ? `${fx(M, 0)} kg milk → ${fx(act, 1)} kg cream` : '', variance: exp && act ? fx(v, 1) + ' %' : '—'
    };
  },
  ghee: () => {
    const K = checker(), raw = labRaw, inK = nv('g-in'), act = nv('g-out'), cot = $l('g-reg').value === 'Cotton-tract';
    let fatp, R, lo, hi;
    if (raw === 'Cream') { fatp = nv('g-cf'); R = .90; lo = .88; hi = .92; }
    else if (raw === 'Butter / White makkhan') { fatp = 100 - nv('g-mo') - nv('g-cu') - nv('g-sa'); R = .96; lo = .95; hi = .97; }
    else { fatp = nv('g-cf'); R = .88; lo = .86; hi = .90; }
    const f = r => inK * fatp / 100 * r, exp = f(R), v = exp && act ? (act - exp) / exp * 100 : 0;
    const below = act && exp && act < f(lo), above = act && exp && act > f(hi);
    if (exp && act) K.c(!below && !above, `Ghee ${fx(act, 1)} kg vs band ${fx(f(lo), 1)}–${fx(f(hi), 1)}`);
    K.r('g-br', 'BR', cot ? 41.5 : 40, cot ? 45 : 43); K.r('g-rm', 'RM', cot ? 21 : 28, 99); K.r('g-pol', 'Polenske', cot ? .5 : 1, cot ? 1.2 : 2);
    K.c($l('g-baud').value === 'Negative', 'Baudouin (pink = vanaspati)');
    K.r('g-moist', 'Moisture', 0, .5); K.r('g-ffa', 'FFA', 0, 3); K.r('g-mf', 'Milk fat', 99.5, 100);
    K.c($l('g-sens').value === 'Typical', 'Colour / flavour / grain');
    const hint = below ? 'Below band: fat lost in residue / spillage / over-declared. Lab tests residue fat; Manager gives reason.' : above ? 'Above band: RM kg under-declared / wrong fat test. Lab re-tests moisture, BR, RM — HOLD until cleared.' : '';
    return {
      tiles: [tile(raw === 'Butter / White makkhan' ? 'Butter fat %' : 'Raw fat %', fx(fatp)), tile('Expected ghee (kg)', fx(exp, 1)), tile('Variance', exp && act ? fx(v, 1) + ' %' : '—'), tile('Ghee litres (÷0.91)', fx(act / 0.91, 1)), tile('Recovery R', R + ` (${lo}–${hi})`)],
      chks: K.chks.concat(hint ? [`<div style="font-size:11px;color:#B45309;margin-top:6px;width:100%">${hint}</div>`] : []),
      fails: K.fails, outside: !!(below || above), suggest: above ? 'Hold' : K.fails ? 'Hold' : 'Accept', qty: inK ? `${fx(inK, 0)} kg ${raw.split(' ')[0].toLowerCase()} → ${fx(act, 1)} kg ghee` : '', variance: exp && act ? fx(v, 1) + ' %' : '—'
    };
  },
  curd: () => {
    const K = checker(), milkKg = nv('u-l') * (1 + nv('u-clr') / 1000), smp = nv('u-smp'), cul = nv('u-cul'), tot = milkKg + smp + cul, act = nv('u-out');
    const loss = has('u-loss') ? nv('u-loss') : 1, exp = tot * (1 - loss / 100), lo = tot * .985, hi = tot * .995;
    const ef = tot ? ((milkKg + cul) * nv('u-mf') + smp * 1) / tot : 0, es = tot ? ((milkKg + cul) * nv('u-ms') + smp * 95) / tot : 0;
    const v = exp && act ? (act - exp) / exp * 100 : 0, outside = !!(act && tot && (act < lo || act > hi));
    if (act && tot) K.c(!outside, `Curd ${fx(act, 1)} kg vs band ${fx(lo, 1)}–${fx(hi, 1)}`);
    K.c($l('u-cob').value === 'Negative', 'Milk COB'); K.c($l('u-alc').value === 'Negative', 'Milk alcohol test');
    K.r('u-heat', 'Heat °C', 85, 90); K.r('u-hold', 'Hold min', 5, 10); K.r('u-inoc', 'Inoculation °C', 37, 42); K.r('u-cpct', 'Culture %', 1.5, 2.5);
    K.r('u-acid', 'Acidity at break', .70, .80); K.r('u-ph', 'pH', 4.5, 4.7); K.r('u-store', 'Storage °C', 0, 5);
    if (has('u-cf') && ef) K.c(Math.abs(nv('u-cf') - ef) <= .1, `Curd Fat ${fx(nv('u-cf'))} vs ${fx(ef)} (±0.1)`);
    if (has('u-cs') && es) K.c(Math.abs(nv('u-cs') - es) <= .2, `Curd SNF ${fx(nv('u-cs'))} vs ${fx(es)} (±0.2)`);
    K.c($l('u-body').value.startsWith('Firm'), 'Body / whey');
    const dil = act > hi && has('u-cf') && ef && nv('u-cf') < ef - .1;
    return {
      tiles: [tile('Milk (kg)', fx(milkKg, 1)), tile('Total in (kg)', fx(tot, 1)), tile('Expected curd (kg)', fx(exp, 1)), tile('Expected Fat %', fx(ef)), tile('Expected SNF %', fx(es)), tile('Variance', exp && act ? fx(v, 1) + ' %' : '—')],
      chks: K.chks.concat(dil ? ['<div style="font-size:11px;color:#B91C1C;margin-top:6px;width:100%">Kg high with Fat/SNF low → water / diluted milk added.</div>'] : []),
      fails: K.fails, outside, suggest: dil || (has('u-acid') && nv('u-acid') > .85) ? (dil ? 'Reject' : 'Hold') : K.fails ? 'Hold' : 'Accept', qty: tot ? `${fx(nv('u-l'), 0)} L / ${fx(act, 0)} kg curd` : '', variance: exp && act ? fx(v, 1) + ' %' : '—'
    };
  }
};

/* ---------- Screen ---------- */
function labBatchNo() {
  const d = new Date(), p = n => String(n).padStart(2, '0');
  return `GD-P1-${p(d.getDate())}${p(d.getMonth() + 1)}${String(d.getFullYear()).slice(2)}-${labCode[labStage]}-${String(labRecords.length + 1).padStart(2, '0')}`;
}
function renderLabScreen(vp) {
  vp = vp || $l('view-viewport'); labPos = new Set(); const b = labBuild[labStage]();
  vp.innerHTML = `<div class="card">
    <div class="card-header-row"><div><h2 class="card-title">${labTitle[labStage]}</h2>
      <p class="card-subtitle">Manager enters quantity only · Lab enters quality only · System calculates · Stock stays locked until Lab Accept</p></div>
      <span class="badge badge-blue font-mono">Batch ${labBatchNo()}</span></div>
    ${grid(panel('Manager Entry', 'QUANTITY ONLY', 'badge-amber', grid(b.mgr)) + panel('Lab Entry', 'QUALITY ONLY', 'badge-green', grid(b.lab)), 340)}
    ${b.extra || ''}
    <div style="border:1px solid #BCE1F1;background:#F0F9FF;border-radius:12px;padding:16px">
      <strong style="color:#004B6E;font-size:13px">System Calculated</strong><div id="lab-out" style="margin-top:10px"></div></div>
    <div style="border:1px solid #E2E8F0;border-radius:12px;padding:16px;background:#F8FAFC">
      <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:12px"><strong style="color:#004B6E;font-size:13px">Decision &amp; Sign-off</strong>
        <span><span class="badge badge-blue" id="lab-suggest"></span> <span class="badge badge-amber" id="lab-lock"></span></span></div>
      ${grid(sel('s-dec', 'Lab decision', ['Hold', 'Accept', 'Reject']) + fld('s-lab', 'Lab user (name)', '', 'text') + fld('s-mgr', 'Manager user (name)', '', 'text'), 200)}
      <div class="form-group" style="margin-top:12px"><label class="form-label" id="s-rlbl">Variance reason (Manager)</label><textarea id="s-reason" class="form-control" rows="2" placeholder="Mandatory if variance is outside the band"></textarea></div>
      <div class="modal-actions" style="margin-top:12px;border:0;padding:0"><button type="button" class="btn-primary" onclick="labSubmit()">Sign &amp; Submit</button></div>
    </div></div>`;
  labCalc();
}
function labCalc() {
  const r = labResult = labCalcs[labStage]();
  $l('lab-out').innerHTML = `<div class="report-summary-grid">${r.tiles.join('')}</div><div style="margin-top:10px;display:flex;flex-wrap:wrap">${r.chks.join('') || '<span style="font-size:11px;color:#64748B">Enter lab results to see limit checks.</span>'}</div>`;
  $l('lab-suggest').textContent = 'System suggests: ' + r.suggest;
  const acc = $l('s-dec').value === 'Accept';
  $l('lab-lock').textContent = acc ? 'STOCK RELEASED' : 'STOCK LOCKED';
  $l('lab-lock').className = 'badge ' + (acc ? 'badge-green' : 'badge-amber');
  $l('s-rlbl').innerHTML = 'Variance reason (Manager)' + (r.outside ? ' <span style="color:#B91C1C">* required — outside band</span>' : '');
}
function labSubmit() {
  const r = labResult, dec = $l('s-dec').value;
  if (!r || !r.qty) { showToast('Manager must enter quantity first.'); return; }
  if (r.outside && !$l('s-reason').value.trim()) { showToast('Variance reason is mandatory — outside band.'); $l('s-reason').focus(); return; }
  if (!$l('s-lab').value.trim() || !$l('s-mgr').value.trim()) { showToast('Lab user and Manager user signatures are required.'); return; }
  if (dec === 'Accept' && r.fails) { showToast(`Cannot Accept: ${r.fails} check(s) failed. Choose Hold or Reject.`); return; }
  const d = new Date();
  labRecords.unshift({ batch: labBatchNo(), stage: labTitle[labStage].replace(' Check', '').replace(' Lab', ''), qty: r.qty, variance: r.variance, decision: dec, lab: $l('s-lab').value.trim(), mgr: $l('s-mgr').value.trim(), time: d.toLocaleString('en-IN') });
  showToast(`Lab record signed — ${dec}.`);
  currentSubMenu = 'Inspection Reports'; renderApp();
}
function renderLabRecords(vp) {
  const cls = { Accept: 'badge-green', Hold: 'badge-amber', Reject: 'badge-red' };
  renderTableScreen(vp, 'Lab Records & Sign-off', 'Batch-wise lab results, variance, decision and dual signatures (Lab + Manager)', 'New Lab Entry', () => { currentSubMenu = 'Milk Inward Lab Check'; renderApp(); }, [
    { label: 'Batch No.' }, { label: 'Stage' }, { label: 'Quantity In / Out' }, { label: 'Variance', align: 'right' }, { label: 'Decision', align: 'center' }, { label: 'Lab User' }, { label: 'Manager User' }, { label: 'Signed At' }
  ], labRecords.map(x => [x.batch, x.stage, x.qty, x.variance, `<span class="badge ${cls[x.decision]}">${x.decision}</span>`, x.lab, x.mgr, x.time]));
}
