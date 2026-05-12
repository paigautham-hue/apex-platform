#!/usr/bin/env node
/**
 * check-map-drift.mjs — APEX
 *
 * Purpose: when a branch modifies source files referenced by a
 * subsystem map under docs/maps/ but the map itself isn't also
 * updated, fail the push. Subsystem maps are the codebase's source
 * of truth; if a code change ships without a map update, the map
 * has drifted and the next reader will be misled.
 *
 * Adapted from Meridian's same-named script. Default mode here is
 * STRICT (per the APEX bootstrap plan; Meridian defaults to warn-only).
 * Strict means: the script EXITS NON-ZERO on drift, blocking the push.
 *
 * Usage:
 *   node scripts/check-map-drift.mjs              # PR mode, STRICT default
 *   node scripts/check-map-drift.mjs --warn-only  # warn but don't fail
 *   node scripts/check-map-drift.mjs --audit      # one-shot survey of every map
 *   node scripts/check-map-drift.mjs --json       # machine-readable output
 *
 * Exit codes:
 *   0 — pass / warn-only / on main / audit mode
 *   1 — drift found in strict mode (default)
 *
 * Bypass (for genuine emergencies; document the reason in the PR body):
 *   - SKIP_MAPS_LINT=1 git push      (env var, this script only)
 *   - git push --no-verify           (skip ALL pre-push hooks)
 */

import { execSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const REPO = process.cwd();
const MAPS_DIR = join(REPO, "docs", "maps");

const HIGH_DRIFT_THRESHOLD = 5;

// ── Helpers ──────────────────────────────────────────────────────────────

function sh(cmd) {
  try {
    return execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

function isBranchMain() {
  return sh("git rev-parse --abbrev-ref HEAD") === "main";
}

/** Files changed (any status) on this branch vs origin/main. */
function getChangedFilesInBranch() {
  const candidates = [
    "git diff --name-only origin/main...HEAD",
    "git diff --name-only @{upstream}...HEAD",
  ];
  for (const cmd of candidates) {
    const out = sh(cmd);
    if (out) return out.split("\n").filter(Boolean);
  }
  return [];
}

function getLastCommitDate(filePath) {
  return sh(`git log -1 --format=%aI -- "${filePath}"`);
}

/** All file paths referenced in a map's text — backtick-wrapped paths only. */
function extractReferencedFiles(mapContent) {
  const refs = new Set();
  const re = /`([a-zA-Z0-9_\-./]+\.(?:ts|tsx|mjs|js))`/g;
  let m;
  while ((m = re.exec(mapContent)) !== null) {
    const path = m[1];
    if (
      path.startsWith("client/src/") ||
      path.startsWith("server/") ||
      path.startsWith("drizzle/") ||
      path.startsWith("shared/")
    ) {
      refs.add(path);
    }
  }
  return refs;
}

function loadAllMaps() {
  const map = new Map();
  let entries;
  try {
    entries = readdirSync(MAPS_DIR);
  } catch {
    return map;
  }
  for (const name of entries) {
    if (name.startsWith("_")) continue;
    if (!name.endsWith(".md")) continue;
    const fullPath = join(MAPS_DIR, name);
    let content;
    try {
      content = readFileSync(fullPath, "utf8");
    } catch {
      continue;
    }
    map.set(name, { content, fullPath, repoPath: `docs/maps/${name}` });
  }
  return map;
}

// ── Main ─────────────────────────────────────────────────────────────────

const args = new Set(process.argv.slice(2));
const isAudit = args.has("--audit");
const isJson = args.has("--json");
// Strict by default. Use --warn-only or WARN_ONLY_MAPS_LINT=1 to soften.
const isWarnOnly =
  args.has("--warn-only") || process.env.WARN_ONLY_MAPS_LINT === "1";
const isStrict = !isWarnOnly;

if (process.env.SKIP_MAPS_LINT === "1") {
  if (!isJson) process.stdout.write("[check-map-drift] SKIP_MAPS_LINT=1 — skipping\n");
  process.exit(0);
}

const maps = loadAllMaps();
if (maps.size === 0) {
  process.stderr.write("[check-map-drift] ⚠️  no maps found under docs/maps/ — bootstrap not yet complete\n");
  process.exit(0);
}

// ── Mode 1: --audit ─────────────────────────────────────────────────────
if (isAudit) {
  const driftReport = [];
  for (const [name, { content, repoPath }] of maps) {
    const lastCommit = getLastCommitDate(repoPath);
    if (!lastCommit) continue;
    const refs = extractReferencedFiles(content);
    if (refs.size === 0) continue;
    const mapSha = sh(`git log -1 --format=%H -- "${repoPath}"`);
    let modifiedSince = 0;
    const modifiedList = [];
    if (mapSha) {
      for (const ref of refs) {
        const log = sh(`git log ${mapSha}..HEAD --oneline -- "${ref}"`);
        if (log) {
          modifiedSince += 1;
          modifiedList.push(ref);
        }
      }
    }
    driftReport.push({
      map: name,
      lastCommit,
      filesInInventory: refs.size,
      modifiedSinceLastUpdate: modifiedSince,
      sampleModified: modifiedList.slice(0, 3),
      isHighDrift: modifiedSince >= HIGH_DRIFT_THRESHOLD,
    });
  }
  driftReport.sort(
    (a, b) =>
      Number(b.isHighDrift) - Number(a.isHighDrift) ||
      b.modifiedSinceLastUpdate - a.modifiedSinceLastUpdate,
  );
  if (isJson) {
    process.stdout.write(
      JSON.stringify({ threshold: HIGH_DRIFT_THRESHOLD, maps: driftReport }, null, 2) + "\n",
    );
    process.exit(0);
  }
  const high = driftReport.filter((r) => r.isHighDrift);
  process.stdout.write(
    `[check-map-drift] audit: ${maps.size} maps, ${high.length} high-drift (>= ${HIGH_DRIFT_THRESHOLD} files modified since last map update)\n\n`,
  );
  if (high.length > 0) {
    for (const r of high) {
      process.stdout.write(
        `  ⚠️  ${r.map} — ${r.modifiedSinceLastUpdate}/${r.filesInInventory} files modified since ${r.lastCommit.slice(0, 10)}\n`,
      );
      for (const sample of r.sampleModified) {
        process.stdout.write(`        ${sample}\n`);
      }
    }
  } else {
    process.stdout.write("  ✓ no high-drift maps\n");
  }
  process.exit(0);
}

// ── Mode 2: PR mode ─────────────────────────────────────────────────────
if (isBranchMain()) {
  if (!isJson) process.stdout.write("[check-map-drift] on main — skipping\n");
  process.exit(0);
}

const changed = getChangedFilesInBranch();
if (changed.length === 0) {
  if (!isJson) process.stdout.write("[check-map-drift] empty diff — skipping\n");
  process.exit(0);
}

const changedSet = new Set(changed);
const changedSourceFiles = changed.filter(
  (f) =>
    /\.(ts|tsx|mjs|js)$/.test(f) &&
    (f.startsWith("client/src/") ||
      f.startsWith("server/") ||
      f.startsWith("drizzle/") ||
      f.startsWith("shared/")) &&
    !/\.(test|spec)\.(ts|tsx|js|mjs)$/.test(f) &&
    !f.startsWith("scripts/"),
);

const driftFindings = [];
for (const file of changedSourceFiles) {
  const referencingMaps = [];
  for (const [, { content, repoPath }] of maps) {
    if (content.includes(`\`${file}\``) || content.includes(file)) {
      referencingMaps.push(repoPath);
    }
  }
  if (referencingMaps.length === 0) continue;
  const updated = referencingMaps.filter((m) => changedSet.has(m));
  if (updated.length === 0) {
    driftFindings.push({ file, referencingMaps });
  }
}

if (isJson) {
  process.stdout.write(
    JSON.stringify(
      {
        mode: "pr",
        strict: isStrict,
        findings: driftFindings,
        changedSourceFiles: changedSourceFiles.length,
      },
      null,
      2,
    ) + "\n",
  );
  process.exit(driftFindings.length > 0 && isStrict ? 1 : 0);
}

if (driftFindings.length === 0) {
  process.stdout.write(
    `[check-map-drift] ✓ ${changedSourceFiles.length} source file(s) changed; all referencing maps were updated\n`,
  );
  process.exit(0);
}

const byMap = new Map();
for (const { file, referencingMaps } of driftFindings) {
  for (const m of referencingMaps) {
    if (!byMap.has(m)) byMap.set(m, []);
    byMap.get(m).push(file);
  }
}

const lines = [];
const verb = isStrict ? "❌" : "⚠️";
lines.push("");
lines.push(
  `[check-map-drift] ${verb} ${driftFindings.length} source file(s) changed without their subsystem map(s) being updated:`,
);
lines.push("");
for (const [mapPath, files] of byMap) {
  lines.push(`  ${mapPath} should reflect changes to:`);
  for (const f of files) {
    lines.push(`    - ${f}`);
  }
  lines.push("");
}
lines.push(
  'Per CLAUDE.md "MAPS-first workflow": after any change in a mapped source',
);
lines.push(
  "file, update the subsystem map's Files, Functions, Data Touched, Forward &",
);
lines.push(
  "Backward Dependencies, AND Fragility Notes if you discovered new coupling.",
);
lines.push("");
if (isWarnOnly) {
  lines.push("Warn-only mode — push proceeds. Default is strict.");
} else {
  lines.push("Strict mode (default) — push rejected. To bypass for a genuine emergency:");
  lines.push("  SKIP_MAPS_LINT=1 git push   (this script only; document in PR)");
  lines.push("  git push --no-verify         (skip ALL pre-push hooks)");
  lines.push("  --warn-only flag             (soften this run only)");
}
lines.push("");

process.stderr.write(lines.join("\n"));
process.exit(isStrict && driftFindings.length > 0 ? 1 : 0);
