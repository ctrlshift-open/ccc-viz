#!/usr/bin/env node
import { homedir } from 'node:os';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

const base = path.resolve(homedir(), '.claude', 'projects');

function parseTimestamp(ts) {
  if (!ts) return null;
  const d = new Date(ts);
  const t = d.getTime();
  return Number.isFinite(t) ? t : null;
}

function formatDuration(ms) {
  if (ms == null) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m < 60) return r ? `${m}m ${r}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm ? `${h}h ${rm}m` : `${h}h`;
}

async function* readLines(file) {
  const stream = fs.createReadStream(file, { encoding: 'utf8' });
  let leftover = '';
  for await (const chunk of stream) {
    const text = leftover + chunk;
    const parts = text.split(/\r?\n/);
    leftover = parts.pop() || '';
    for (const line of parts) yield line;
  }
  if (leftover) yield leftover;
}

async function scanFile(file) {
  let prevTs = null;
  let maxInterGap = 0;
  let maxAssistantGap = 0;
  let maxToolLatency = 0;
  const toolStart = new Map(); // tool_use_id -> ts

  for await (const line of readLines(file)) {
    if (!line) continue;
    let v;
    try { v = JSON.parse(line); } catch { continue; }
    const ts = parseTimestamp(v?.timestamp);
    // Inter-message gap
    if (prevTs != null && ts != null) {
      const gap = ts - prevTs;
      if (gap > maxInterGap) maxInterGap = gap;
    }
    // Assistant gap (time since previous event)
    const role = v?.message?.role;
    if (role === 'assistant' && ts != null && prevTs != null) {
      const gap = ts - prevTs;
      if (gap > maxAssistantGap) maxAssistantGap = gap;
    }
    // Tool latencies: record tool_use, resolve tool_result
    const content = v?.message?.content;
    const segs = Array.isArray(content) ? content : content ? [content] : [];
    for (const seg of segs) {
      if (!seg || typeof seg !== 'object') continue;
      const t = seg.type;
      if (t === 'tool_use') {
        const id = seg.id || seg.tool_use_id || null; // prefer seg.id, fallback if present
        if (id && ts != null) toolStart.set(id, ts);
      } else if (t === 'tool_result') {
        const ref = seg.tool_use_id || seg.id || null; // prefer tool_use_id
        const start = ref ? toolStart.get(ref) : null;
        if (start != null && ts != null) {
          const gap = ts - start;
          if (gap > maxToolLatency) maxToolLatency = gap;
          toolStart.delete(ref);
        }
      }
    }
    if (ts != null) prevTs = ts;
  }
  return { maxInterGap, maxAssistantGap, maxToolLatency };
}

async function main() {
  try {
    const baseStat = await fsp.stat(base).catch(() => null);
    if (!baseStat || !baseStat.isDirectory()) {
      console.error(`No projects directory found at ${base}`);
      process.exit(1);
    }
    const projects = (await fsp.readdir(base, { withFileTypes: true })).filter(d => d.isDirectory()).map(d => d.name);
    let global = { maxInterGap: 0, maxAssistantGap: 0, maxToolLatency: 0 };
    const perProject = {};

    for (const p of projects) {
      const dir = path.join(base, p);
      const files = await fsp.readdir(dir).catch(() => []);
      const jsonl = files.filter(f => f.endsWith('.jsonl'));
      let proj = { maxInterGap: 0, maxAssistantGap: 0, maxToolLatency: 0 };
      for (const f of jsonl) {
        const fp = path.join(dir, f);
        try {
          const stats = await scanFile(fp);
          proj.maxInterGap = Math.max(proj.maxInterGap, stats.maxInterGap);
          proj.maxAssistantGap = Math.max(proj.maxAssistantGap, stats.maxAssistantGap);
          proj.maxToolLatency = Math.max(proj.maxToolLatency, stats.maxToolLatency);
        } catch (e) {
          // ignore file errors
        }
      }
      perProject[p] = proj;
      global.maxInterGap = Math.max(global.maxInterGap, proj.maxInterGap);
      global.maxAssistantGap = Math.max(global.maxAssistantGap, proj.maxAssistantGap);
      global.maxToolLatency = Math.max(global.maxToolLatency, proj.maxToolLatency);
    }

    const longest = Math.max(global.maxAssistantGap, global.maxToolLatency, global.maxInterGap);
    const recommended = Math.min(Math.max(longest * 1.5, 60_000), 30 * 60_000); // 1.5x headroom, clamp to 30m max

    console.log('Scan path:', base);
    console.log('');
    for (const [p, s] of Object.entries(perProject)) {
      console.log(`Project: ${p}`);
      console.log(`  Max assistant gap: ${formatDuration(s.maxAssistantGap)} (${s.maxAssistantGap} ms)`);
      console.log(`  Max tool latency:  ${formatDuration(s.maxToolLatency)} (${s.maxToolLatency} ms)`);
      console.log(`  Max inter gap:     ${formatDuration(s.maxInterGap)} (${s.maxInterGap} ms)`);
      console.log('');
    }
    console.log('Global maxima:');
    console.log(`  Max assistant gap: ${formatDuration(global.maxAssistantGap)} (${global.maxAssistantGap} ms)`);
    console.log(`  Max tool latency:  ${formatDuration(global.maxToolLatency)} (${global.maxToolLatency} ms)`);
    console.log(`  Max inter gap:     ${formatDuration(global.maxInterGap)} (${global.maxInterGap} ms)`);
    console.log('');
    console.log(`Longest observed:    ${formatDuration(longest)} (${longest} ms)`);
    console.log(`Recommended active threshold: ${formatDuration(recommended)} (${recommended} ms)`);
  } catch (err) {
    console.error('Error:', err?.message || err);
    process.exit(1);
  }
}

main();

