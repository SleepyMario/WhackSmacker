#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { dirname, isAbsolute, join, posix, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const animalsPreviewInputs = Object.freeze([
  Object.freeze({
    name: "unified",
    archivePath: "/home/ashwin/Downloads/animals-001-100-unified-language-agnostic-v1.0.0.tar.gz",
    sha256: "509897b663567c73c5257bb3f8976306d32fcbcdb82c1812d7c3244e138a6a73"
  }),
  Object.freeze({
    name: "wsm",
    archivePath: "/home/ashwin/Downloads/wsm-animals-en-nl-001-100-draft-v1.0.0.tar.gz",
    sha256: "ee6b4645dc88afa8b396d9364ec04b8eb1cff9f0aa9013e9aeec7b1993fcb09d"
  })
]);

export function inspectSafeTarGzip(archiveBytes, label = "archive") {
  const tar = gunzipSync(archiveBytes);
  const entries = [];
  const normalizedPaths = new Set();
  let offset = 0;
  let zeroBlocks = 0;
  let nextPax = {};

  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512);
    offset += 512;
    if (header.every((byte) => byte === 0)) {
      zeroBlocks += 1;
      if (zeroBlocks === 2) break;
      continue;
    }
    if (zeroBlocks !== 0) throw new Error(`${label}: non-zero tar header follows an end marker.`);
    assertTarHeaderChecksum(header, label);

    const typeFlag = String.fromCharCode(header[156] || 48);
    const headerSize = parseTarOctal(header.subarray(124, 136), `${label}: invalid tar member size`);
    if (offset + headerSize > tar.length) throw new Error(`${label}: truncated archive member.`);
    const headerData = tar.subarray(offset, offset + headerSize);
    offset += Math.ceil(headerSize / 512) * 512;
    if (typeFlag === "x") {
      nextPax = parsePaxRecords(headerData, label, false);
      continue;
    }
    if (typeFlag === "g") {
      parsePaxRecords(headerData, label, true);
      continue;
    }

    const name = tarString(header.subarray(0, 100));
    const prefix = tarString(header.subarray(345, 500));
    const headerPath = prefix.length === 0 ? name : `${prefix}/${name}`;
    const rawPath = typeof nextPax.path === "string" ? nextPax.path : headerPath;
    const normalizedPath = safeArchivePath(rawPath, label);
    if (normalizedPaths.has(normalizedPath)) throw new Error(`${label}: duplicate normalized archive path: ${normalizedPath}`);
    normalizedPaths.add(normalizedPath);

    const kind = typeFlag === "0" ? "file" : typeFlag === "5" ? "directory" : undefined;
    if (kind === undefined) {
      const namedType = ({ "1": "hard link", "2": "symbolic link", "3": "character device", "4": "block device", "6": "FIFO" })[typeFlag] ?? `unsupported type ${JSON.stringify(typeFlag)}`;
      throw new Error(`${label}: ${namedType} archive member is forbidden: ${normalizedPath}`);
    }
    const size = nextPax.size === undefined ? headerSize : parsePaxSize(nextPax.size, label, normalizedPath);
    nextPax = {};
    if (size !== headerSize) throw new Error(`${label}: PAX size does not match the tar header for ${normalizedPath}`);
    if (kind === "directory" && size !== 0) throw new Error(`${label}: directory member has non-zero size: ${normalizedPath}`);
    entries.push({ path: normalizedPath, kind, data: Buffer.from(headerData) });
  }

  if (zeroBlocks < 2) throw new Error(`${label}: tar archive has no complete end marker.`);
  return entries;
}

export async function validateAndExtractAnimalsPreviewInputs(options) {
  const outputDirectory = resolve(options.outputDirectory);
  await mkdir(outputDirectory, { recursive: true });
  if ((await readdir(outputDirectory)).length !== 0) throw new Error(`Extraction output must be empty: ${outputDirectory}`);

  const summaries = [];
  for (const input of options.inputs ?? animalsPreviewInputs) {
    const archiveBytes = await readFile(input.archivePath);
    const actualSha256 = sha256(archiveBytes);
    if (actualSha256 !== input.sha256) {
      throw new Error(`${input.name} archive SHA-256 mismatch: expected ${input.sha256}, received ${actualSha256}`);
    }
    const entries = inspectSafeTarGzip(archiveBytes, input.archivePath);
    for (const entry of entries) {
      const destination = resolve(outputDirectory, entry.path);
      const prefix = `${outputDirectory}/`;
      if (!destination.startsWith(prefix)) throw new Error(`${input.name}: archive path escapes extraction output: ${entry.path}`);
      if (entry.kind === "directory") {
        await mkdir(destination, { recursive: true });
      } else {
        await mkdir(dirname(destination), { recursive: true });
        await writeFile(destination, entry.data, { flag: "wx" });
        const materialized = await readFile(destination);
        if (!materialized.equals(entry.data)) throw new Error(`${input.name}: extracted bytes differ: ${entry.path}`);
      }
    }
    summaries.push({
      name: input.name,
      archivePath: input.archivePath,
      sha256: actualSha256,
      members: entries.length,
      files: entries.filter((entry) => entry.kind === "file").length,
      directories: entries.filter((entry) => entry.kind === "directory").length
    });
  }
  return { outputDirectory, inputs: summaries };
}

function safeArchivePath(rawPath, label) {
  if (rawPath.length === 0 || rawPath.includes("\\") || rawPath.includes("\0") || isAbsolute(rawPath) || posix.isAbsolute(rawPath) || /^[A-Za-z]:\//u.test(rawPath)) {
    throw new Error(`${label}: unsafe absolute or malformed archive path: ${JSON.stringify(rawPath)}`);
  }
  const parts = rawPath.split("/");
  if (parts.includes("..")) throw new Error(`${label}: parent traversal archive path is forbidden: ${rawPath}`);
  const normalized = posix.normalize(rawPath).replace(/^\.\//u, "").replace(/\/$/u, "");
  if (normalized.length === 0 || normalized === "." || normalized.startsWith("../") || normalized.includes("//")) {
    throw new Error(`${label}: unsafe normalized archive path: ${rawPath}`);
  }
  return normalized;
}

function parsePaxRecords(bytes, label, global) {
  const records = {};
  let offset = 0;
  while (offset < bytes.length) {
    const space = bytes.indexOf(32, offset);
    if (space < 0) throw new Error(`${label}: malformed PAX record length.`);
    const lengthText = bytes.subarray(offset, space).toString("ascii");
    if (!/^[1-9][0-9]*$/u.test(lengthText)) throw new Error(`${label}: malformed PAX record length.`);
    const length = Number.parseInt(lengthText, 10);
    if (!Number.isSafeInteger(length) || length <= space - offset + 2 || offset + length > bytes.length) throw new Error(`${label}: invalid PAX record boundary.`);
    const record = bytes.subarray(space + 1, offset + length);
    if (record.at(-1) !== 10) throw new Error(`${label}: PAX record is not newline terminated.`);
    const payload = record.subarray(0, -1).toString("utf8");
    const equals = payload.indexOf("=");
    if (equals <= 0) throw new Error(`${label}: malformed PAX key/value record.`);
    const key = payload.slice(0, equals);
    const value = payload.slice(equals + 1);
    if (key === "linkpath") throw new Error(`${label}: PAX link path metadata is forbidden.`);
    if (global && (key === "path" || key === "size")) throw new Error(`${label}: global PAX ${key} override is forbidden.`);
    if (!["path", "size", "mtime", "atime", "ctime", "uid", "gid", "uname", "gname", "SCHILY.devmajor", "SCHILY.devminor"].includes(key)) {
      throw new Error(`${label}: unsupported PAX metadata key: ${key}`);
    }
    records[key] = value;
    offset += length;
  }
  return records;
}

function parsePaxSize(value, label, path) {
  if (!/^(?:0|[1-9][0-9]*)$/u.test(value)) throw new Error(`${label}: invalid PAX size for ${path}`);
  const size = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(size)) throw new Error(`${label}: invalid PAX size for ${path}`);
  return size;
}

function assertTarHeaderChecksum(header, label) {
  const declared = parseTarOctal(header.subarray(148, 156), `${label}: invalid tar header checksum`);
  let calculated = 0;
  for (let index = 0; index < header.length; index += 1) calculated += index >= 148 && index < 156 ? 32 : header[index];
  if (declared !== calculated) throw new Error(`${label}: tar header checksum mismatch.`);
}

function parseTarOctal(bytes, message) {
  const text = tarString(bytes).trim().replace(/^0+/u, "") || "0";
  if (!/^[0-7]+$/u.test(text)) throw new Error(message);
  const value = Number.parseInt(text, 8);
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(message);
  return value;
}

function tarString(bytes) {
  const end = bytes.indexOf(0);
  return bytes.subarray(0, end < 0 ? bytes.length : end).toString("utf8");
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function parseArgs(argv) {
  let outputDirectory;
  const inputs = animalsPreviewInputs.map((input) => ({ ...input }));
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = argv[index + 1];
    if (arg === "--output" && value) {
      outputDirectory = value;
      index += 1;
    } else if (arg === "--unified-archive" && value) {
      inputs[0].archivePath = value;
      index += 1;
    } else if (arg === "--wsm-archive" && value) {
      inputs[1].archivePath = value;
      index += 1;
    } else {
      throw new Error(`Unknown or incomplete option: ${arg}`);
    }
  }
  if (!outputDirectory) throw new Error("--output <empty-directory> is required.");
  return { outputDirectory, inputs };
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  validateAndExtractAnimalsPreviewInputs(parseArgs(process.argv.slice(2)))
    .then((summary) => console.log(JSON.stringify(summary, null, 2)))
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
