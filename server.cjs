'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID, createHash } = require('node:crypto');

const ROOT = __dirname;
const PORT = Number.parseInt(process.env.ROOT_PORT || '18473', 10);
const DATA_DIR = path.resolve(process.env.ROOT_DATA_DIR || path.join(ROOT, 'data'));
const API_VERSION = 8;
const RELEASE = require('./package.json').version;
const MAX_BODY = 16 * 1024 * 1024;
const { createStaticFiles } = require('./server/static-files.cjs');
const { createOriginPolicy } = require('./server/request-origin.cjs');
const { installShutdown } = require('./server/shutdown.cjs');
const FILES = createStaticFiles(ROOT);

let writeQueue = Promise.resolve();
let cachedEngine;

function getEngine() {
  if (cachedEngine !== undefined) return cachedEngine;
  const enginePath = path.join(ROOT, 'engine.js');
  if (!fs.existsSync(enginePath)) return (cachedEngine = null);
  cachedEngine = require(enginePath);
  if (!cachedEngine || typeof cachedEngine.normalizeState !== 'function') {
    throw new Error('engine.js does not export normalizeState');
  }
  return cachedEngine;
}

function send(res, status, value, headers = {}) {
  const body = Buffer.from(typeof value === 'string' ? value : JSON.stringify(value));
  res.writeHead(status, {
    'Content-Type':
      typeof value === 'string' ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8',
    'Content-Length': body.length,
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'X-Content-Type-Options': 'nosniff',
    ...headers,
  });
  res.end(body);
}

function jsonError(res, status, message) {
  send(res, status, { ok: false, error: message });
}

async function readBody(req) {
  const statedLength = Number(req.headers['content-length']);
  if (Number.isFinite(statedLength) && statedLength > MAX_BODY) {
    req.resume();
    const error = new Error('Der Netzwerkstand ist größer als 16 MiB.');
    error.status = 413;
    throw error;
  }
  const chunks = [];
  let length = 0;
  for await (const chunk of req) {
    length += chunk.length;
    if (length > MAX_BODY) {
      const error = new Error('Der Netzwerkstand ist größer als 16 MiB.');
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function atomicWrite(file, contents) {
  const temp = `${file}.${process.pid}.${randomUUID()}.tmp`;
  const handle = await fs.promises.open(temp, 'wx');
  try {
    await handle.writeFile(contents, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    await fs.promises.rename(temp, file);
  } catch (error) {
    await fs.promises.rm(temp, { force: true });
    throw error;
  }
}

async function persist(state, dataDir = DATA_DIR) {
  await fs.promises.mkdir(dataDir, { recursive: true });
  const saveFile = path.join(dataDir, 'save.json');
  const backupFile = path.join(dataDir, 'save.backup.json');
  const serialized = `${JSON.stringify(state)}\n`;
  let previous;
  try {
    previous = await fs.promises.readFile(saveFile);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (previous && isValidStoredSave(previous.toString('utf8'))) {
    await atomicWrite(backupFile, previous);
  }
  await atomicWrite(saveFile, serialized);
}

function revisionForSave(save) {
  if (!save) return 'empty';
  return createHash('sha256').update(JSON.stringify(save), 'utf8').digest('hex');
}

function isValidStoredSave(text) {
  try {
    const parsed = JSON.parse(text);
    const engine = getEngine();
    if (!engine) return false;
    const save = engine.normalizeState(parsed);
    return Boolean(
      save && save.version === API_VERSION && typeof save === 'object' && !Array.isArray(save),
    );
  } catch {
    return false;
  }
}

async function readSave(dataDir = DATA_DIR) {
  await fs.promises.mkdir(dataDir, { recursive: true });
  const primary = path.join(dataDir, 'save.json');
  const backup = path.join(dataDir, 'save.backup.json');
  let foundDamagedCopy = false;
  for (const file of [primary, backup]) {
    try {
      const text = await fs.promises.readFile(file, 'utf8');
      const parsed = JSON.parse(text);
      const engine = getEngine();
      if (!engine) throw new Error('Die Datenstruktur kann ohne engine.js nicht geprüft werden.');
      const save = engine.normalizeState(parsed);
      if (!save || save.version !== API_VERSION)
        throw new Error('Nicht unterstützte Netzwerkstand-Version.');
      return { save, revision: revisionForSave(save) };
    } catch (error) {
      if (error.code === 'ENOENT') continue;
      foundDamagedCopy = true;
    }
  }
  if (foundDamagedCopy)
    throw new Error(
      'Netzwerkstand und Sicherungskopie sind beschädigt. Bitte prüfe data/save.json und data/save.backup.json.',
    );
  return { save: null, revision: 'empty' };
}

function createServer(options = {}) {
  const port = options.port ?? PORT;
  const dataDir = options.dataDir ? path.resolve(options.dataDir) : DATA_DIR;
  const sameOrigin = createOriginPolicy(options.publicOrigin);
  const server = http.createServer(async (req, res) => {
    let pathname;
    try {
      pathname = new URL(req.url, `http://127.0.0.1:${port}`).pathname;
    } catch {
      return jsonError(res, 400, 'Ungültige Anfrage.');
    }

    if (pathname === '/api/health') {
      if (req.method !== 'GET') return jsonError(res, 405, 'Methode nicht erlaubt.');
      return send(
        res,
        200,
        { app: 'ROOT', version: API_VERSION, release: RELEASE },
        { 'Cache-Control': 'no-store' },
      );
    }

    if (pathname === '/api/save' && req.method === 'GET') {
      try {
        const result = await readSave(dataDir);
        return send(res, 200, { save: result.save }, { 'X-Root-Revision': result.revision });
      } catch (error) {
        return jsonError(res, 500, error.message || 'Netzwerkstand konnte nicht gelesen werden.');
      }
    }

    if (pathname === '/api/save' && req.method === 'POST') {
      if (!sameOrigin(req)) {
        req.resume();
        return jsonError(res, 403, 'Speichern von einer fremden Website ist gesperrt.');
      }
      if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) {
        req.resume();
        return jsonError(res, 415, 'Erwartet wird application/json.');
      }
      try {
        const text = await readBody(req);
        const parsed = JSON.parse(text);
        if (
          parsed &&
          typeof parsed === 'object' &&
          !Array.isArray(parsed) &&
          (parsed.version === 1 ||
            parsed.version === 2 ||
            parsed.version === 3 ||
            parsed.version === 4 ||
            parsed.version === 5 ||
            parsed.version === 6 ||
            parsed.version === 7)
        ) {
          return send(res, 409, {
            ok: false,
            updateRequired: true,
            error:
              'Diese Oberfläche stammt aus einer älteren Version. Lade sie neu, bevor du fortfährst.',
          });
        }
        // Import/GET migrate legacy saves. Writes require schema 8 so cached
        // clients cannot silently erase commercial contracts or staff state.
        if (
          parsed?.version === 8 &&
          (!parsed.customerGrowth ||
            !parsed.preventiveMaintenance ||
            !parsed.servicePriorities ||
            !parsed.lab ||
            !parsed.customers ||
            !parsed.personnel ||
            !parsed.facility?.central ||
            !Object.hasOwn(parsed.facility, 'centralOperation') ||
            !parsed.facility.building)
        ) {
          return send(res, 409, {
            ok: false,
            updateRequired: true,
            error:
              'Diese Oberfläche stammt aus einer älteren Version. Lade sie neu, bevor du fortfährst.',
          });
        }
        const engine = getEngine();
        if (!engine) throw new Error('Die Datenstruktur kann ohne engine.js nicht geprüft werden.');
        // Import/read may migrate old milestones, but stale browser writers must not erase claims.
        if (
          parsed?.version === API_VERSION &&
          engine.catalog.achievements.some(
            (a) => !a.legacy && !Object.hasOwn(parsed.achievementUnlocks || {}, a.id),
          )
        )
          return send(res, 409, {
            ok: false,
            updateRequired: true,
            error:
              'Diese Oberfläche stammt aus einer älteren Version. Lade sie neu, bevor du fortfährst.',
          });
        const normalized = engine.normalizeState(parsed);
        if (!normalized || typeof normalized !== 'object' || Array.isArray(normalized)) {
          throw new Error('Ungültiger Netzwerkstand.');
        }
        if (normalized.version !== API_VERSION)
          throw new Error('Nicht unterstützte Netzwerkstand-Version.');
        const expectedRevision = req.headers['x-root-revision'];
        const previousQueue = writeQueue;
        let release;
        writeQueue = new Promise((resolve) => {
          release = resolve;
        });
        await previousQueue;
        try {
          // Compare and write under the same queue lock. Checking before the lock
          // would let parallel sessions both pass with one stale revision.
          if (expectedRevision !== undefined) {
            const current = await readSave(dataDir);
            if (current.revision !== expectedRevision) {
              return send(res, 409, {
                conflict: true,
                message:
                  'Der Netzwerkstand wurde seit dem letzten Laden verändert. Lade ihn neu, bevor du erneut speicherst.',
              });
            }
          }
          await persist(normalized, dataDir);
          const revision = revisionForSave(normalized);
          return send(
            res,
            200,
            expectedRevision === undefined ? { ok: true } : { ok: true, revision },
            { 'X-Root-Revision': revision },
          );
        } finally {
          release();
        }
      } catch (error) {
        return jsonError(
          res,
          error.status || 400,
          error.message || 'Netzwerkstand konnte nicht gespeichert werden.',
        );
      }
    }

    if (pathname === '/api/save') return jsonError(res, 405, 'Methode nicht erlaubt.');
    if (req.method !== 'GET') return jsonError(res, 405, 'Methode nicht erlaubt.');

    const entry = FILES.get(pathname);
    if (!entry) return jsonError(res, 404, 'Datei nicht gefunden.');
    try {
      const content = await fs.promises.readFile(path.join(ROOT, entry[0]));
      res.writeHead(200, {
        'Content-Type': entry[1],
        'Content-Length': content.length,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy':
          "default-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; object-src 'none'; base-uri 'none'",
      });
      return res.end(content);
    } catch {
      return jsonError(res, 404, 'Datei noch nicht vorhanden.');
    }
  });
  server.requestTimeout = 15_000;
  server.headersTimeout = 10_000;
  server.maxHeadersCount = 100;
  return server;
}

function start() {
  const host = process.env.ROOT_HOST || '127.0.0.1';
  const server = createServer({ publicOrigin: process.env.ROOT_PUBLIC_ORIGIN });
  // Fail at startup rather than running a seemingly healthy, unwritable volume.
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.accessSync(DATA_DIR, fs.constants.W_OK);
  server.on('error', (error) => {
    console.error(
      error.code === 'EADDRINUSE'
        ? `ROOT: Port ${PORT} wird bereits verwendet. Prüfe, ob ROOT schon läuft oder eine andere Anwendung diesen Port belegt.`
        : `ROOT Serverfehler: ${error.message}`,
    );
    process.exitCode = 1;
  });
  server.listen(PORT, host, () => {
    installShutdown(server, () => writeQueue);
    console.log(`ROOT: http://${host}:${server.address().port}`);
  });
  return server;
}

if (require.main === module) start();
module.exports = {
  createServer,
  start,
  port: PORT,
  dataDir: DATA_DIR,
  maxBody: MAX_BODY,
  apiVersion: API_VERSION,
  release: RELEASE,
};
