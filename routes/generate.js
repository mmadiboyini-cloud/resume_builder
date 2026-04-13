const express = require('express');
const router = express.Router();
const puppeteer = require('puppeteer');
const htmlDocx = require('html-docx-js');
const ejs = require('ejs');
const path = require('path');

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

const ENHANCE_RESUME_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    skills: { type: 'string' },
    experience: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          company: { type: 'string' },
          role: { type: 'string' },
          duration: { type: 'string' },
          responsibilities: { type: 'string' }
        },
        required: ['company', 'role', 'duration', 'responsibilities']
      }
    },
    projects: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          tech: { type: 'string' },
          link: { type: 'string' },
          duration: { type: 'string' },
          description: { type: 'string' }
        },
        required: ['name', 'tech', 'link', 'duration', 'description']
      }
    },
    atsKeywords: {
      type: 'array',
      items: { type: 'string' }
    }
  },
  required: ['summary', 'skills', 'experience', 'projects', 'atsKeywords']
};

// Polyfill Blob for older Node versions (< 18)
if (typeof Blob === 'undefined') {
  try {
    global.Blob = require('buffer').Blob;
  } catch (_) {
    // no-op
  }
}

function isVercelRuntime() {
  return Boolean(process.env.VERCEL || process.env.VERCEL_ENV);
}

async function launchPdfBrowser() {
  if (!isVercelRuntime()) {
    return puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
  }

  let chromium;
  let puppeteerCore;
  try {
    chromium = require('@sparticuz/chromium');
    puppeteerCore = require('puppeteer-core');
  } catch (_) {
    throw new Error('Missing Vercel Chromium dependencies. Install @sparticuz/chromium and puppeteer-core.');
  }

  // Use the packaged Chromium bundle explicitly so serverless can unpack all required shared libs.
  const chromiumPackPath = path.join(process.cwd(), 'node_modules', '@sparticuz', 'chromium', 'bin');
  const executablePath = await chromium.executablePath(chromiumPackPath);
  const headlessMode = 'shell';

  return puppeteerCore.launch({
    args: puppeteerCore.defaultArgs({ args: chromium.args, headless: headlessMode }),
    defaultViewport: chromium.defaultViewport,
    executablePath,
    headless: headlessMode
  });
}

async function renderTemplate(data) {
  const tplPath = path.join(__dirname, '../views/resume.ejs');
  return ejs.renderFile(tplPath, { data });
}

function safeFilename(name, ext) {
  const base = (name || 'resume')
    .replace(/[^a-zA-Z0-9_\- ]/g, '')
    .trim()
    .replace(/\s+/g, '_') || 'resume';
  return `${base}_resume.${ext}`;
}

function pickString(value, fallback = '') {
  return (typeof value === 'string' && value.trim()) ? value.trim() : (fallback || '');
}

function toNormalizedMultiline(value, fallback = '') {
  const src = pickString(value, fallback);
  return src
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .join('\n');
}

function extractOutputText(responsePayload) {
  const candidates = Array.isArray(responsePayload?.candidates) ? responsePayload.candidates : [];
  for (const candidate of candidates) {
    const parts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [];
    for (const part of parts) {
      if (typeof part?.text === 'string' && part.text.trim()) {
        return part.text.trim();
      }
    }
  }

  throw new Error('Gemini returned no text output.');
}

function parseJsonFromText(text) {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i) || text.match(/```\s*([\s\S]*?)```/i);
  const raw = (fenced ? fenced[1] : text).trim();
  return JSON.parse(raw);
}

function toAtsKeywords(raw) {
  const list = Array.isArray(raw?.atsKeywords)
    ? raw.atsKeywords
    : (Array.isArray(raw?.ats_keywords) ? raw.ats_keywords : []);

  return list
    .map(item => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean)
    .slice(0, 15);
}

function buildResumePromptPayload(data) {
  return {
    name: data?.name || '',
    title: data?.title || '',
    summary: data?.summary || '',
    skills: data?.skills || '',
    experience: Array.isArray(data?.experience)
      ? data.experience.map(item => ({
          company: item?.company || '',
          role: item?.role || '',
          duration: item?.duration || '',
          responsibilities: item?.responsibilities || ''
        }))
      : [],
    projects: Array.isArray(data?.projects)
      ? data.projects.map(item => ({
          name: item?.name || '',
          tech: item?.tech || '',
          link: item?.link || '',
          duration: item?.duration || '',
          description: item?.description || ''
        }))
      : [],
    education: Array.isArray(data?.education)
      ? data.education.map(item => ({
          degree: item?.degree || '',
          field: item?.field || '',
          school: item?.school || '',
          year: item?.year || '',
          gpa: item?.gpa || ''
        }))
      : []
  };
}

function normalizeEnhancedData(raw, original) {
  const source = original || {};

  return {
    ...source,
    summary: pickString(raw?.summary, source.summary || ''),
    skills: pickString(raw?.skills, source.skills || ''),
    experience: Array.isArray(source.experience)
      ? source.experience.map((entry, idx) => {
          const aiEntry = Array.isArray(raw?.experience) ? (raw.experience[idx] || {}) : {};
          return {
            ...entry,
            company: pickString(aiEntry.company, entry.company || ''),
            role: pickString(aiEntry.role, entry.role || ''),
            duration: pickString(aiEntry.duration, entry.duration || ''),
            responsibilities: toNormalizedMultiline(aiEntry.responsibilities, entry.responsibilities || '')
          };
        })
      : [],
    projects: Array.isArray(source.projects)
      ? source.projects.map((entry, idx) => {
          const aiEntry = Array.isArray(raw?.projects) ? (raw.projects[idx] || {}) : {};
          return {
            ...entry,
            name: pickString(aiEntry.name, entry.name || ''),
            tech: pickString(aiEntry.tech, entry.tech || ''),
            link: pickString(aiEntry.link, entry.link || ''),
            duration: pickString(aiEntry.duration, entry.duration || ''),
            description: toNormalizedMultiline(aiEntry.description, entry.description || '')
          };
        })
      : []
  };
}

router.post('/enhance-resume', async (req, res) => {
  try {
    const body = req.body || {};
    const sourceData = body.resumeData && typeof body.resumeData === 'object' ? body.resumeData : null;
    const apiKey = pickString(body.apiKey, process.env.GEMINI_API_KEY || '');
    const jobDescription = pickString(body.jobDescription, '');

    if (!sourceData) {
      return res.status(400).json({ error: 'Missing resume data.' });
    }

    if (!apiKey) {
      return res.status(400).json({
        error: 'Missing Gemini API key.',
        details: 'Provide apiKey in the request or set GEMINI_API_KEY on the server.'
      });
    }

    if (typeof fetch !== 'function') {
      return res.status(500).json({
        error: 'Server runtime does not support fetch.',
        details: 'Use Node.js 18+ to enable AI enhancement.'
      });
    }

    const resumeForPrompt = buildResumePromptPayload(sourceData);

    const systemPrompt = [
      'You are an expert resume writer and ATS optimization specialist.',
      'Rewrite content to be concise, professional, and ATS-friendly.',
      'Never invent facts, metrics, employers, roles, dates, or technologies that are not present in the input.'
    ].join(' ');

    const userPrompt = [
      'Improve the resume content for better ATS performance.',
      '',
      'Rules:',
      '1) Preserve factual accuracy. Do not fabricate achievements or numbers.',
      '2) Keep the same number of experience items and project items as input.',
      '3) Strengthen wording with action verbs and measurable impact when already present.',
      '4) Keep responsibilities and project descriptions as newline-separated bullet lines.',
      '5) Keep skills in this format: "Category: item1, item2" (one category per line).',
      '6) Use keywords from the target job description naturally when relevant.',
      '7) Return valid JSON only (no markdown, no explanation).',
      '',
      'Output JSON schema:',
      '{',
      '  "summary": "string",',
      '  "skills": "string",',
      '  "experience": [',
      '    { "company": "string", "role": "string", "duration": "string", "responsibilities": "line1\\nline2" }',
      '  ],',
      '  "projects": [',
      '    { "name": "string", "tech": "string", "link": "string", "duration": "string", "description": "line1\\nline2" }',
      '  ],',
      '  "atsKeywords": ["keyword1", "keyword2"]',
      '}',
      '',
      'Target job description (optional):',
      jobDescription || '[Not provided]',
      '',
      'Resume data:',
      JSON.stringify(resumeForPrompt)
    ].join('\n');

    const geminiUrl = `${GEMINI_API_BASE}/${encodeURIComponent(DEFAULT_GEMINI_MODEL)}:generateContent`;

    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'x-goog-api-key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }]
          }
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          responseJsonSchema: ENHANCE_RESUME_SCHEMA
        }
      })
    });

    if (!geminiResponse.ok) {
      const errorPayload = await geminiResponse.json().catch(() => null);
      const details = errorPayload?.error?.message || `Gemini request failed with status ${geminiResponse.status}.`;
      return res.status(geminiResponse.status === 401 || geminiResponse.status === 403 ? 401 : 500).json({
        error: 'AI enhancement failed',
        details
      });
    }

    const rawResponse = await geminiResponse.json();
    const outputText = extractOutputText(rawResponse);
    const parsed = parseJsonFromText(outputText);
    const enhancedData = normalizeEnhancedData(parsed, sourceData);

    return res.json({
      enhancedData,
      atsKeywords: toAtsKeywords(parsed),
      model: rawResponse?.modelVersion || DEFAULT_GEMINI_MODEL
    });
  } catch (err) {
    console.error('AI enhancement error:', err);
    return res.status(500).json({ error: 'AI enhancement failed', details: err.message });
  }
});

router.post('/generate-pdf', async (req, res) => {
  let browser;
  try {
    const data = req.body;
    const html = await renderTemplate(data);

    browser = await launchPdfBrowser();

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'domcontentloaded' });

    const pdfBytes = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' }
    });
    const pdfBuffer = Buffer.from(pdfBytes);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename(data.name, 'pdf')}"`);
    res.setHeader('Content-Length', String(pdfBuffer.length));
    res.send(pdfBuffer);
  } catch (err) {
    console.error('PDF generation error:', err);
    res.status(500).json({ error: 'PDF generation failed', details: err.message });
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
});

router.post('/generate-docx', async (req, res) => {
  try {
    const data = req.body;
    const html = await renderTemplate(data);

    // html-docx-js returns Blob (browser / Node 18+) or ArrayBuffer (older Node)
    const result = htmlDocx.asBlob(html);

    let buffer;
    if (Buffer.isBuffer(result)) {
      buffer = result;
    } else if (result instanceof ArrayBuffer) {
      buffer = Buffer.from(result);
    } else if (result && typeof result.arrayBuffer === 'function') {
      // Native Blob (Node 18+)
      buffer = Buffer.from(await result.arrayBuffer());
    } else {
      throw new Error('Unexpected return type from html-docx-js');
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename(data.name, 'docx')}"`);
    res.send(buffer);
  } catch (err) {
    console.error('DOCX generation error:', err);
    res.status(500).json({ error: 'DOCX generation failed', details: err.message });
  }
});

module.exports = router;
