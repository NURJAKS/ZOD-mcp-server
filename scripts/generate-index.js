const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');

async function fileExists(filePath) {
  try {
    await fsp.access(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function detectProjectType(projectRoot) {
  return fs.existsSync(path.join(projectRoot, 'package.json')) ? 'nodejs' : 'unknown';
}

function detectFrameworks(pkgJson) {
  const frameworks = [];
  const deps = {
    ...(pkgJson.dependencies || {}),
    ...(pkgJson.devDependencies || {}),
  };
  const candidates = [
    ['react', 'react'],
    ['next', 'nextjs'],
    ['nuxt', 'nuxt'],
    ['vite', 'vite'],
    ['express', 'express'],
    ['koa', 'koa'],
    ['fastify', 'fastify'],
    ['nestjs', 'nestjs'],
    ['svelte', 'svelte'],
    ['vue', 'vue'],
    ['angular', 'angular'],
    ['ts-node', 'ts-node'],
  ];
  for (const [pkg, name] of candidates) {
    if (deps[pkg]) frameworks.push(name);
  }
  return frameworks;
}

function extensionToLanguage(filePath) {
  const base = path.basename(filePath);
  if (base === 'Dockerfile' || base.startsWith('Dockerfile.')) return 'dockerfile';
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.ts': return 'typescript';
    case '.tsx': return 'typescript';
    case '.js': return 'javascript';
    case '.jsx': return 'javascript';
    case '.json': return 'json';
    case '.md': return 'markdown';
    case '.yml':
    case '.yaml': return 'yaml';
    case '.html': return 'html';
    case '.css': return 'css';
    case '.scss':
    case '.sass': return 'scss';
    case '.sh': return 'shell';
    case '.sql': return 'sql';
    case '.toml': return 'toml';
    case '.ini': return 'ini';
    case '.conf': return 'config';
    case '.lock': return 'lock';
    case '.txt': return 'text';
    default: return ext ? ext.slice(1) : 'unknown';
  }
}

const DEFAULT_EXCLUDES = new Set([
  'node_modules', '.git', '.cache', 'dist', 'build', 'coverage', '.zod', '.next', '.vercel', '.turbo'
]);

async function walk(dir, root, results) {
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(root, fullPath);
    if (!relPath) continue;

    // Skip excluded directories at the top-level of the current path
    if (entry.isDirectory()) {
      const top = entry.name;
      if (DEFAULT_EXCLUDES.has(top)) continue;
      results.directories.add(relPath);
      await walk(fullPath, root, results);
    } else if (entry.isFile()) {
      // Skip very large binary files by extension heuristics
      const skipExts = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.pdf', '.ico']);
      const ext = path.extname(entry.name).toLowerCase();
      if (skipExts.has(ext)) {
        results.files.push(relPath);
        continue;
      }
      const stat = await fsp.stat(fullPath);
      results.totalSize += stat.size;
      results.files.push(relPath);
      const lang = extensionToLanguage(entry.name);
      results.languages[lang] = (results.languages[lang] || 0) + 1;
    }
  }
}

async function main() {
  const projectRoot = process.cwd();
  // Parse args
  const args = process.argv.slice(2);
  let outPath = path.join(projectRoot, 'project-index.json');
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--out' && args[i + 1]) {
      outPath = path.isAbsolute(args[i + 1]) ? args[i + 1] : path.join(projectRoot, args[i + 1]);
      i++;
    }
  }

  const results = {
    files: [],
    directories: new Set(),
    totalSize: 0,
    languages: {},
  };

  await walk(projectRoot, projectRoot, results);

  // Read package.json if exists
  let pkgJson = {};
  const pkgPath = path.join(projectRoot, 'package.json');
  if (await fileExists(pkgPath)) {
    try {
      const txt = await fsp.readFile(pkgPath, 'utf8');
      pkgJson = JSON.parse(txt);
    } catch {}
  }

  const payload = {
    files: results.files.sort(),
    directories: Array.from(results.directories).sort(),
    metadata: {
      totalFiles: results.files.length,
      totalSize: results.totalSize,
      languages: results.languages,
      lastIndexed: Date.now(),
      projectType: detectProjectType(projectRoot),
      frameworks: detectFrameworks(pkgJson),
    },
    dependencies: Object.keys({ ...(pkgJson.dependencies || {}), ...(pkgJson.devDependencies || {}) }).sort(),
    qualityMetrics: {
      codeQuality: null,
      maintainability: null,
      testCoverage: null,
      documentation: null,
    },
  };

  await fsp.writeFile(outPath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  console.log(`Index written to: ${outPath}`);
}

main().catch((err) => {
  console.error('Indexing failed:', err && err.stack ? err.stack : err);
  process.exit(1);
});