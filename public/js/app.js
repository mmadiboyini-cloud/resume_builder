/* ═══════════════════════════════════════════════════════════
   RESUME BUILDER — Frontend Logic
   ═══════════════════════════════════════════════════════════ */

'use strict';

// ─── Global state ─────────────────────────────────────────────────────────────
let resumeData = {
  name:       '',
  title:      '',
  email:      '',
  phone:      '',
  location:   '',
  linkedin:   '',
  website:    '',
  summary:    '',
  skills:     '',      // raw textarea string; each line: "Category: item1, item2"
  experience: [],      // { id, company, role, duration, responsibilities }[]
  projects:   [],      // { id, name, tech, link, duration, description }[]
  education:  [],      // { id, degree, field, school, year, gpa }[]
  templateId: 'classic'
};

let expCounter  = 0;
let projCounter = 0;
let eduCounter  = 0;

// ─── DOM refs ─────────────────────────────────────────────────────────────────
const previewEl  = document.getElementById('resume-preview');
const expList    = document.getElementById('exp-list');
const projList   = document.getElementById('proj-list');
const eduList    = document.getElementById('edu-list');
const overlay    = document.getElementById('overlay');
const overlayMsg = document.getElementById('overlay-msg');
const aiKeywords = document.getElementById('ai-ats-keywords');

// ─── Boot ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  bindPersonalInfo();
  bindButtons();
  loadFromStorage();   // restore saved data before first render
  renderPreview();
});

// ═══════════════════════ PERSONAL INFO BINDING ════════════════════════════════
function bindPersonalInfo() {
  const fields = ['name','title','email','phone','location','linkedin','website','summary'];
  fields.forEach(f => {
    const el = document.getElementById(`inp-${f}`);
    if (!el) return;
    el.addEventListener('input', () => {
      resumeData[f] = el.value;
      renderPreview();
    });
  });

  // Skills — store raw textarea value; rendered as "Category: items" rows
  const skillsEl = document.getElementById('inp-skills');
  skillsEl.addEventListener('input', () => {
    resumeData.skills = skillsEl.value;
    renderPreview();
  });
}

// ═══════════════════════ BUTTONS ═════════════════════════════════════════════
function bindButtons() {
  document.getElementById('btn-add-exp') .addEventListener('click', addExperience);
  document.getElementById('btn-add-proj').addEventListener('click', addProject);
  document.getElementById('btn-add-edu') .addEventListener('click', addEducation);
  document.getElementById('btn-pdf')     .addEventListener('click', downloadPDF);
  document.getElementById('btn-docx')    .addEventListener('click', downloadDocx);
  const enhanceBtn = document.getElementById('btn-ai-enhance');
  if (enhanceBtn) enhanceBtn.addEventListener('click', enhanceResumeWithAI);

  // Template selector cards
  document.querySelectorAll('.tpl-opt').forEach(card => {
    card.addEventListener('click', () => {
      resumeData.templateId = card.dataset.tpl;
      document.querySelectorAll('.tpl-opt').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      renderPreview();
    });
  });
}

// ═══════════════════════ EXPERIENCE ══════════════════════════════════════════
function addExperience() {
  const id = ++expCounter;
  resumeData.experience.push({ id, company:'', role:'', duration:'', responsibilities:'' });
  renderExpBlock(id);
  updateEmptyHint('exp');
  renderPreview();
}

function renderExpBlock(id, entry = {}) {
  const block = document.createElement('div');
  block.className = 'dyn-block';
  block.id = `exp-block-${id}`;
  block.innerHTML = `
    <div class="block-top">
      <span class="block-label">Experience #${expList.children.length + 1}</span>
      <button class="btn-remove" onclick="removeExperience(${id})">Remove</button>
    </div>
    <div class="field-row">
      <div class="field">
        <label>Company / Organisation</label>
        <input type="text" data-field="company" placeholder="Google" oninput="updateExp(${id},'company',this.value)" />
      </div>
      <div class="field">
        <label>Role / Position</label>
        <input type="text" data-field="role" placeholder="Software Engineer" oninput="updateExp(${id},'role',this.value)" />
      </div>
    </div>
    <div class="field">
      <label>Duration</label>
      <input type="text" data-field="duration" placeholder="Jan 2022 – Present" oninput="updateExp(${id},'duration',this.value)" />
    </div>
    <div class="field">
      <label>Responsibilities <span class="hint" style="font-weight:400">(one per line → auto-bullets)</span></label>
      <textarea rows="4" data-field="responsibilities" placeholder="Designed and implemented REST APIs serving 2M+ requests/day&#10;Led cross-functional team of 5 engineers&#10;Reduced build time by 40% via CI/CD improvements"
        oninput="updateExp(${id},'responsibilities',this.value)"></textarea>
    </div>`;
  expList.appendChild(block);
  fillBlockValues(block, entry);
}

function updateExp(id, field, value) {
  const entry = resumeData.experience.find(e => e.id === id);
  if (entry) { entry[field] = value; renderPreview(); }
}

function removeExperience(id) {
  resumeData.experience = resumeData.experience.filter(e => e.id !== id);
  const block = document.getElementById(`exp-block-${id}`);
  if (block) block.remove();
  updateEmptyHint('exp');
  renderPreview();
}

// ═══════════════════════ PROJECTS ════════════════════════════════════════════
function addProject() {
  const id = ++projCounter;
  resumeData.projects.push({ id, name:'', tech:'', link:'', duration:'', description:'' });
  renderProjBlock(id);
  updateEmptyHint('proj');
  renderPreview();
}

function renderProjBlock(id, entry = {}) {
  const block = document.createElement('div');
  block.className = 'dyn-block';
  block.id = `proj-block-${id}`;
  block.innerHTML = `
    <div class="block-top">
      <span class="block-label">Project #${projList.children.length + 1}</span>
      <button class="btn-remove" onclick="removeProject(${id})">Remove</button>
    </div>
    <div class="field-row">
      <div class="field">
        <label>Project Name</label>
        <input type="text" data-field="name" placeholder="E-Commerce Platform" oninput="updateProj(${id},'name',this.value)" />
      </div>
      <div class="field">
        <label>Tech Stack</label>
        <input type="text" data-field="tech" placeholder="React, Node.js, MongoDB" oninput="updateProj(${id},'tech',this.value)" />
      </div>
    </div>
    <div class="field-row">
      <div class="field">
        <label>Link / URL</label>
        <input type="text" data-field="link" placeholder="github.com/you/project" oninput="updateProj(${id},'link',this.value)" />
      </div>
      <div class="field">
        <label>Duration</label>
        <input type="text" data-field="duration" placeholder="Mar 2023 – Jun 2023" oninput="updateProj(${id},'duration',this.value)" />
      </div>
    </div>
    <div class="field">
      <label>Description <span class="hint" style="font-weight:400">(one per line → auto-bullets)</span></label>
      <textarea rows="3" data-field="description" placeholder="Built full-stack app with real-time features&#10;Integrated Stripe payments processing $50k/month&#10;Deployed on AWS with 99.9% uptime"
        oninput="updateProj(${id},'description',this.value)"></textarea>
    </div>`;
  projList.appendChild(block);
  fillBlockValues(block, entry);
}

function updateProj(id, field, value) {
  const entry = resumeData.projects.find(p => p.id === id);
  if (entry) { entry[field] = value; renderPreview(); }
}

function removeProject(id) {
  resumeData.projects = resumeData.projects.filter(p => p.id !== id);
  const block = document.getElementById(`proj-block-${id}`);
  if (block) block.remove();
  updateEmptyHint('proj');
  renderPreview();
}

// ═══════════════════════ EDUCATION ═══════════════════════════════════════════
function addEducation() {
  const id = ++eduCounter;
  resumeData.education.push({ id, degree:'', field:'', school:'', year:'', gpa:'' });
  renderEduBlock(id);
  updateEmptyHint('edu');
  renderPreview();
}

function renderEduBlock(id, entry = {}) {
  const block = document.createElement('div');
  block.className = 'dyn-block';
  block.id = `edu-block-${id}`;
  block.innerHTML = `
    <div class="block-top">
      <span class="block-label">Education #${eduList.children.length + 1}</span>
      <button class="btn-remove" onclick="removeEducation(${id})">Remove</button>
    </div>
    <div class="field-row">
      <div class="field">
        <label>Degree</label>
        <input type="text" data-field="degree" placeholder="B.Sc. / M.Sc. / B.Tech" oninput="updateEdu(${id},'degree',this.value)" />
      </div>
      <div class="field">
        <label>Field of Study</label>
        <input type="text" data-field="field" placeholder="Computer Science" oninput="updateEdu(${id},'field',this.value)" />
      </div>
    </div>
    <div class="field-row">
      <div class="field">
        <label>Institution</label>
        <input type="text" data-field="school" placeholder="MIT" oninput="updateEdu(${id},'school',this.value)" />
      </div>
      <div class="field">
        <label>Year / Duration</label>
        <input type="text" data-field="year" placeholder="2018 – 2022" oninput="updateEdu(${id},'year',this.value)" />
      </div>
    </div>
    <div class="field" style="max-width:160px">
      <label>GPA (optional)</label>
      <input type="text" data-field="gpa" placeholder="3.8 / 4.0" oninput="updateEdu(${id},'gpa',this.value)" />
    </div>`;
  eduList.appendChild(block);
  fillBlockValues(block, entry);
}

function updateEdu(id, field, value) {
  const entry = resumeData.education.find(e => e.id === id);
  if (entry) { entry[field] = value; renderPreview(); }
}

function removeEducation(id) {
  resumeData.education = resumeData.education.filter(e => e.id !== id);
  const block = document.getElementById(`edu-block-${id}`);
  if (block) block.remove();
  updateEmptyHint('edu');
  renderPreview();
}

// ─── Empty hint helper ────────────────────────────────────────────────────────
function updateEmptyHint(type) {
  const map = {
    exp:  { list: expList,  hint: document.getElementById('exp-empty')  },
    proj: { list: projList, hint: document.getElementById('proj-empty') },
    edu:  { list: eduList,  hint: document.getElementById('edu-empty')  }
  };
  const { list, hint } = map[type];
  hint.classList.toggle('hidden', list.children.length > 0);
}

// ═══════════════════════ LIVE PREVIEW RENDER ══════════════════════════════════
function renderPreview() {
  // Always keep the template class in sync on the a4-page wrapper
  previewEl.className = `a4-page tpl-${resumeData.templateId || 'classic'}`;

  const hasContent = resumeData.name || resumeData.title || resumeData.summary
    || resumeData.skills.trim().length
    || resumeData.experience.some(e => e.company || e.role)
    || resumeData.projects.some(p => p.name)
    || resumeData.education.some(e => e.degree || e.school);

  if (!hasContent) {
    previewEl.innerHTML = `
      <div class="placeholder-msg">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#cbd5e0" stroke-width="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <line x1="8" y1="8" x2="16" y2="8"/>
          <line x1="8" y1="12" x2="16" y2="12"/>
          <line x1="8" y1="16" x2="12" y2="16"/>
        </svg>
        <p>Start filling in the form<br/>to see your resume here</p>
      </div>`;
    saveToStorage();
    return;
  }

  previewEl.innerHTML = buildResumeHTML(resumeData);
  saveToStorage();
}

// ═══════════════════════ RESUME HTML BUILDER ══════════════════════════════════
// Mirrors the EJS template — keeps preview and export visually identical.
function buildResumeHTML(d) {
  const esc = str => String(str || '')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');

  let html = '';

  // ── Header ──────────────────────────────────────────────────────────────────
  const isMinimalTpl = (d.templateId || 'classic') === 'minimal';
  const sepChar      = isMinimalTpl ? '·' : '|';

  const liHref = d.linkedin
    ? (d.linkedin.startsWith('http') ? d.linkedin : 'https://' + d.linkedin)
    : '';

  const contactParts = [
    d.email    ? esc(d.email)    : null,
    d.phone    ? esc(d.phone)    : null,
    d.location ? esc(d.location) : null,
    d.linkedin ? `<a href="${esc(liHref)}" target="_blank" rel="noopener"
                     style="color:inherit;text-decoration:none;">LinkedIn</a>` : null,
    d.website  ? esc(d.website)  : null,
  ].filter(Boolean);

  html += `<div class="rv-header">`;
  if (d.name)  html += `<div class="rv-name">${esc(d.name)}</div>`;
  if (d.title) html += `<div class="rv-title">${esc(d.title)}</div>`;
  if (contactParts.length) {
    html += `<div class="rv-contact">`;
    html += contactParts.map((p, i) =>
      p + (i < contactParts.length - 1 ? `<span class="rv-contact-sep">${sepChar}</span>` : '')
    ).join('');
    html += `</div>`;
  }
  html += `</div>`;

  // ── Summary ─────────────────────────────────────────────────────────────────
  if (d.summary && d.summary.trim()) {
    html += `
    <div class="rv-section">
      <div class="rv-section-title">Professional Summary</div>
      <p class="rv-summary">${esc(d.summary.trim())}</p>
    </div>`;
  }

  // ── Skills ──────────────────────────────────────────────────────────────────
  // Each non-empty line rendered as: "Bold Label:  items" or plain text
  const skillLines = (d.skills || '').split('\n').map(l => l.trim()).filter(Boolean);
  if (skillLines.length) {
    const rowsHtml = skillLines.map(line => {
      const colon = line.indexOf(':');
      if (colon > 0) {
        const cat   = esc(line.substring(0, colon).trim());
        const items = esc(line.substring(colon + 1).trim());
        return `<div class="rv-skill-row"><span class="rv-skill-label">${cat}:</span>  ${items}</div>`;
      }
      return `<div class="rv-skill-row">${esc(line)}</div>`;
    }).join('');
    html += `
    <div class="rv-section">
      <div class="rv-section-title">Technical Skills</div>
      <div class="rv-skills-cat">${rowsHtml}</div>
    </div>`;
  }

  // ── Experience ──────────────────────────────────────────────────────────────
  const exps = d.experience.filter(e => e.company || e.role);
  if (exps.length) {
    html += `<div class="rv-section"><div class="rv-section-title">Experience</div>`;
    exps.forEach(exp => {
      html += `<div class="rv-entry">`;
      html += `<div class="rv-entry-top">`;
      html += `<div>`;
      if (exp.role)    html += `<div class="rv-entry-role">${esc(exp.role)}</div>`;
      if (exp.company) html += `<div class="rv-entry-company">${esc(exp.company)}</div>`;
      html += `</div>`;
      if (exp.duration) html += `<div class="rv-entry-duration">${esc(exp.duration)}</div>`;
      html += `</div>`;
      if (exp.responsibilities && exp.responsibilities.trim()) {
        html += `<ul class="rv-bullets">`;
        exp.responsibilities.split('\n').forEach(line => {
          const t = line.trim().replace(/^[•▪\-\*]+\s*/, '');
          if (t) html += `<li>${esc(t)}</li>`;
        });
        html += `</ul>`;
      }
      html += `</div>`;
    });
    html += `</div>`;
  }

  // ── Projects ────────────────────────────────────────────────────────────────
  const projs = d.projects.filter(p => p.name || p.description);
  if (projs.length) {
    html += `<div class="rv-section"><div class="rv-section-title">Projects</div>`;
    projs.forEach(proj => {
      html += `<div class="rv-entry">`;
      html += `<div class="rv-entry-top">`;
      html += `<div>`;
      let roleLine = esc(proj.name || '');
      if (proj.tech) roleLine += ` <span style="font-weight:400;font-size:10pt;color:#718096;">— ${esc(proj.tech)}</span>`;
      html += `<div class="rv-entry-role">${roleLine}</div>`;
      if (proj.link) html += `<div class="rv-entry-company">${esc(proj.link)}</div>`;
      html += `</div>`;
      if (proj.duration) html += `<div class="rv-entry-duration">${esc(proj.duration)}</div>`;
      html += `</div>`;
      if (proj.description && proj.description.trim()) {
        html += `<ul class="rv-bullets">`;
        proj.description.split('\n').forEach(line => {
          const t = line.trim().replace(/^[•▪\-\*]+\s*/, '');
          if (t) html += `<li>${esc(t)}</li>`;
        });
        html += `</ul>`;
      }
      html += `</div>`;
    });
    html += `</div>`;
  }

  // ── Education ───────────────────────────────────────────────────────────────
  const edus = d.education.filter(e => e.degree || e.school);
  if (edus.length) {
    html += `<div class="rv-section"><div class="rv-section-title">Education</div>`;
    edus.forEach(edu => {
      html += `<div class="rv-edu">`;
      html += `<div class="rv-edu-top">`;
      html += `<div>`;
      let degreeText = esc(edu.degree || '');
      if (edu.field) degreeText += ` in ${esc(edu.field)}`;
      html += `<div class="rv-edu-degree">${degreeText}</div>`;
      if (edu.school) html += `<div class="rv-edu-school">${esc(edu.school)}</div>`;
      if (edu.gpa)    html += `<div class="rv-edu-meta">GPA: ${esc(edu.gpa)}</div>`;
      html += `</div>`;
      if (edu.year) html += `<div class="rv-edu-year">${esc(edu.year)}</div>`;
      html += `</div>`;
      html += `</div>`;
    });
    html += `</div>`;
  }

  return html;
}

// ═══════════════════════ LOCAL STORAGE ═══════════════════════════════════════

const STORAGE_KEY = 'resumeBuilderData';

function saveToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(resumeData));
  } catch (e) {
    console.warn('localStorage save failed:', e);
  }
}

function loadFromStorage() {
  let saved;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    saved = JSON.parse(raw);
  } catch (e) {
    console.warn('localStorage load failed:', e);
    return;
  }

  // ── Template ───────────────────────────────────────────────────────────────
  if (saved.templateId) {
    resumeData.templateId = saved.templateId;
    document.querySelectorAll('.tpl-opt').forEach(c => {
      c.classList.toggle('active', c.dataset.tpl === saved.templateId);
    });
  }

  // ── Scalar fields ──────────────────────────────────────────────────────────
  const scalars = ['name','title','email','phone','location','linkedin','website','summary','skills'];
  scalars.forEach(f => {
    if (saved[f] == null) return;
    resumeData[f] = saved[f];
    const el = document.getElementById(`inp-${f}`);
    if (el) el.value = saved[f];
  });

  // ── Dynamic sections ───────────────────────────────────────────────────────
  (saved.experience || []).forEach(entry => {
    expCounter = Math.max(expCounter, entry.id);
    resumeData.experience.push(entry);
    renderExpBlock(entry.id, entry);
  });

  (saved.projects || []).forEach(entry => {
    projCounter = Math.max(projCounter, entry.id);
    resumeData.projects.push(entry);
    renderProjBlock(entry.id, entry);
  });

  (saved.education || []).forEach(entry => {
    eduCounter = Math.max(eduCounter, entry.id);
    resumeData.education.push(entry);
    renderEduBlock(entry.id, entry);
  });

  // Sync empty-hint visibility for restored sections
  updateEmptyHint('exp');
  updateEmptyHint('proj');
  updateEmptyHint('edu');
}

// Fills [data-field] inputs/textareas inside a dynamic block with saved values
function fillBlockValues(blockEl, entry) {
  blockEl.querySelectorAll('[data-field]').forEach(el => {
    const val = entry[el.dataset.field];
    if (val != null) el.value = val;
  });
}

function setAtsKeywords(list) {
  if (!aiKeywords) return;
  if (!Array.isArray(list) || !list.length) {
    aiKeywords.textContent = '';
    return;
  }
  aiKeywords.textContent = `ATS keywords detected: ${list.join(', ')}`;
}

function syncScalarFieldsFromState() {
  const fields = ['name','title','email','phone','location','linkedin','website','summary','skills'];
  fields.forEach(f => {
    const el = document.getElementById(`inp-${f}`);
    if (el) el.value = resumeData[f] || '';
  });
}

function syncDynamicBlocksFromState(entries, blockPrefix) {
  entries.forEach(entry => {
    const block = document.getElementById(`${blockPrefix}-${entry.id}`);
    if (!block) return;
    fillBlockValues(block, entry);
  });
}

function applyEnhancedData(data) {
  if (!data || typeof data !== 'object') return;

  if (typeof data.summary === 'string') resumeData.summary = data.summary;
  if (typeof data.skills === 'string') resumeData.skills = data.skills;

  if (Array.isArray(data.experience)) {
    resumeData.experience = resumeData.experience.map((entry, idx) => {
      const next = data.experience[idx];
      if (!next) return entry;
      return {
        ...entry,
        company: typeof next.company === 'string' ? next.company : entry.company,
        role: typeof next.role === 'string' ? next.role : entry.role,
        duration: typeof next.duration === 'string' ? next.duration : entry.duration,
        responsibilities: typeof next.responsibilities === 'string' ? next.responsibilities : entry.responsibilities
      };
    });
  }

  if (Array.isArray(data.projects)) {
    resumeData.projects = resumeData.projects.map((entry, idx) => {
      const next = data.projects[idx];
      if (!next) return entry;
      return {
        ...entry,
        name: typeof next.name === 'string' ? next.name : entry.name,
        tech: typeof next.tech === 'string' ? next.tech : entry.tech,
        link: typeof next.link === 'string' ? next.link : entry.link,
        duration: typeof next.duration === 'string' ? next.duration : entry.duration,
        description: typeof next.description === 'string' ? next.description : entry.description
      };
    });
  }

  syncScalarFieldsFromState();
  syncDynamicBlocksFromState(resumeData.experience, 'exp-block');
  syncDynamicBlocksFromState(resumeData.projects, 'proj-block');
  syncDynamicBlocksFromState(resumeData.education, 'edu-block');
}

async function enhanceResumeWithAI() {
  const apiKeyInput = document.getElementById('inp-gemini-key') || document.getElementById('inp-openai-key');
  const jobDescriptionInput = document.getElementById('inp-job-description');
  const apiKey = (apiKeyInput?.value || '').trim();
  const jobDescription = (jobDescriptionInput?.value || '').trim();

  if (!apiKey) {
    alert('Please add your Gemini API key to run AI enhancement.');
    return;
  }

  showOverlay('Enhancing resume with AI...');
  try {
    const res = await fetch('/enhance-resume', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey,
        jobDescription,
        resumeData
      })
    });

    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(payload.details || payload.error || `Server error ${res.status}`);
    }

    applyEnhancedData(payload.enhancedData);
    setAtsKeywords(payload.atsKeywords);
    renderPreview();
    alert('Resume content enhanced successfully for a more ATS-friendly profile.');
  } catch (err) {
    alert(`AI enhancement failed: ${err.message}`);
    console.error(err);
  } finally {
    hideOverlay();
  }
}

// ═══════════════════════ EXPORT FUNCTIONS ════════════════════════════════════

// ── Shared fetch helper ───────────────────────────────────────────────────────
async function exportResume(endpoint, filename, loadingMsg) {
  showOverlay(loadingMsg);
  try {
    const res = await fetch(endpoint, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(resumeData)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(err.error || `Server error ${res.status}`);
    }

    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

  } catch (err) {
    alert(`Export failed: ${err.message}`);
    console.error(err);
  } finally {
    hideOverlay();
  }
}

async function downloadPDF() {
  const name = (resumeData.name || 'resume').replace(/\s+/g, '_');
  const role = resumeData.title ? `_${resumeData.title.replace(/\s+/g, '_')}` : '';
  await exportResume('/generate-pdf', `${name}_${role}_resume.pdf`, 'Generating PDF…');
}

async function downloadDocx() {
  const name = (resumeData.name || 'resume').replace(/\s+/g, '_');
  const role = resumeData.title ? `_${resumeData.title.replace(/\s+/g, '_')}` : '';
  await exportResume('/generate-docx', `${name}_${role}_resume.docx`, 'Generating Word document…');
}

// ─── Overlay helpers ──────────────────────────────────────────────────────────
function showOverlay(msg) {
  overlayMsg.textContent = msg || 'Processing…';
  overlay.classList.add('active');
}
function hideOverlay() {
  overlay.classList.remove('active');
}


