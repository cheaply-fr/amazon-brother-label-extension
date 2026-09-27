#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, realpath, rm, stat, writeFile, chmod } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const MAX_CAPTURE_BYTES = 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 120_000;
export const CANONICAL_GITHUB_OWNER = "cheaply-fr";
const BLACKHOLE_PROXY = /^https?:\/\/(?:127\.0\.0\.1|localhost|\[::1\]):9\/?$/i;
const PROXY_KEYS = ["HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "GIT_HTTP_PROXY", "GIT_HTTPS_PROXY"];

export function isCodexWindowsSandbox(environment = process.env) {
  const identity = `${environment.USERDOMAIN || ""}\\${environment.USERNAME || environment.USER || ""}`.toLowerCase();
  return process.platform === "win32" && (
    identity.includes("codexsandbox") ||
    environment.CODEX_SHELL === "1" ||
    Boolean(environment.CODEX_PERMISSION_PROFILE) ||
    Object.keys(environment).some((key) => key.toUpperCase().startsWith("CODEX_SANDBOX"))
  );
}

export function sanitizeEnvironment(environment = process.env) {
  const clean = { ...environment };
  const removedProxies = [];
  for (const key of PROXY_KEYS) {
    const matchingKey = Object.keys(clean).find((candidate) => candidate.toUpperCase() === key);
    if (matchingKey && BLACKHOLE_PROXY.test(String(clean[matchingKey]).trim())) {
      delete clean[matchingKey];
      removedProxies.push(matchingKey);
    }
  }
  clean.GIT_TERMINAL_PROMPT = "0";
  clean.GCM_INTERACTIVE = "Never";
  return { environment: clean, removedProxies };
}

export function parseGitHubRemote(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("The remote must be a valid HTTPS GitHub URL.");
  }
  if (url.protocol !== "https:" || url.hostname.toLowerCase() !== "github.com" || url.port) {
    throw new Error("Only an https://github.com remote is accepted by the safe publisher.");
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error("The Git remote must not contain credentials, a query, or a fragment.");
  }
  if (/%2f|%5c|\\/i.test(url.pathname)) throw new Error("Encoded or Windows path separators are not accepted in a Git remote.");
  const match = url.pathname.match(/^\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/);
  if (!match || match[1] === "." || match[1] === ".." || match[2] === "." || match[2] === "..") {
    throw new Error("The GitHub remote must contain exactly one owner and repository name.");
  }
  if (match[1].toLowerCase() !== CANONICAL_GITHUB_OWNER) {
    throw new Error(`The GitHub remote must belong to the canonical ${CANONICAL_GITHUB_OWNER} organization.`);
  }
  return { url: `https://github.com/${match[1]}/${match[2]}.git`, owner: match[1], repository: match[2] };
}

export function validateRemoteName(value) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(value)) throw new Error("Unsafe Git remote name.");
  return value;
}

export function validateRef(value, { allowHead = true } = {}) {
  if (allowHead && value === "HEAD") return value;
  if (!value || value.length > 255 || value.startsWith("-") || value.startsWith("/") || value.endsWith("/") ||
      value.endsWith(".") || value.endsWith(".lock") || value.includes("..") || value.includes("@{") ||
      value.includes("//") || /[\x00-\x20~^:?*\[\\]/.test(value)) {
    throw new Error(`Unsafe Git ref: ${JSON.stringify(value)}`);
  }
  return value;
}

export function validateRefspec(value) {
  const pieces = value.split(":");
  if (pieces.length !== 2 || !pieces[0] || !pieces[1]) throw new Error("Push refspec must have a source and destination.");
  validateRef(pieces[0]);
  validateRef(pieces[1], { allowHead: false });
  return value;
}

export async function findRepositoryRoot(startDirectory) {
  let current = await realpath(startDirectory);
  while (true) {
    try {
      await stat(path.join(current, ".git"));
      return current;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    const parent = path.dirname(current);
    if (parent === current) throw new Error("Not inside a Git repository.");
    current = parent;
  }
}

export function buildRemoteArguments(operation, options, askPassPath) {
  if (!options.safeDirectory) throw new Error("An exact safe repository directory is required.");
  const prefix = [
    "-c", `safe.directory=${options.safeDirectory}`,
    "-c", "http.sslBackend=openssl",
    "-c", "credential.helper=",
    "-c", "credential.https://github.com.helper=",
    "-c", `core.askPass=${askPassPath}`
  ];
  switch (operation) {
    case "ls-remote": return [...prefix, "ls-remote", "--exit-code", options.remote, options.ref];
    case "fetch": return [...prefix, "fetch", "--prune", "--no-tags", options.remote, options.ref];
    case "pull": return [...prefix, "pull", "--ff-only", options.remote, options.branch];
    case "push": return [...prefix, "push", "--porcelain", options.remote, options.refspec];
    default: throw new Error(`Unsupported remote operation: ${operation}`);
  }
}

export function retryCountFor(operation, requested) {
  if (operation === "push" || operation === "pull") return 0;
  return Math.max(0, Math.min(2, requested));
}

export function shouldRetry(operation, attempt, requested, result) {
  return !result.timedOut && result.code !== 0 && attempt < retryCountFor(operation, requested);
}

function appendLimited(current, chunk) {
  if (current.length >= MAX_CAPTURE_BYTES) return current;
  return current + chunk.toString("utf8", 0, MAX_CAPTURE_BYTES - current.length);
}

export function runProcess(command, args, { cwd, env, timeoutMs, capture = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env,
      shell: false,
      windowsHide: true,
      stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit"
    });
    let stdout = "";
    let stderr = "";
    if (capture) {
      child.stdout.on("data", (chunk) => { stdout = appendLimited(stdout, chunk); });
      child.stderr.on("data", (chunk) => { stderr = appendLimited(stderr, chunk); });
    }
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      if (process.platform === "win32" && child.pid) {
        spawnSync("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true, shell: false });
        if (child.exitCode === null) child.kill();
      } else {
        child.kill("SIGTERM");
        setTimeout(() => child.kill("SIGKILL"), 1000).unref();
      }
    }, timeoutMs || DEFAULT_TIMEOUT_MS);
    child.once("error", (error) => { clearTimeout(timer); reject(error); });
    child.once("close", (code, signal) => {
      clearTimeout(timer);
      resolve({ code: code ?? 1, signal, stdout, stderr, timedOut });
    });
  });
}

async function captured(command, args, options) {
  const result = await runProcess(command, args, { ...options, capture: true });
  if (result.timedOut) throw new Error(`${path.basename(command)} timed out.`);
  if (result.code !== 0) throw new Error(result.stderr.trim() || `${path.basename(command)} exited with code ${result.code}.`);
  return result.stdout.trim();
}

export async function createAskPass(token) {
  if (!token || /[\r\n]/.test(token)) throw new Error("GitHub CLI returned an invalid token.");
  const directory = await mkdtemp(path.join(os.tmpdir(), "safe-git-"));
  const windows = process.platform === "win32";
  const file = path.join(directory, windows ? "askpass.cmd" : "askpass.sh");
  const source = windows
    ? "@echo off\r\nset \"p=%~1\"\r\necho %p%|%SystemRoot%\\System32\\findstr.exe /I \"username\" >nul\r\nif errorlevel 1 (echo %SAFE_GIT_GITHUB_TOKEN%) else (echo x-access-token)\r\n"
    : "#!/bin/sh\ncase \"$1\" in *sername*) printf '%s\\n' x-access-token;; *) printf '%s\\n' \"$SAFE_GIT_GITHUB_TOKEN\";; esac\n";
  await writeFile(file, source, { encoding: "utf8", mode: 0o700 });
  if (!windows) await chmod(file, 0o700);
  return { directory, file };
}

export function parseArguments(argv) {
  const operation = argv[0] || "diagnose";
  const options = { remote: "origin", ref: "HEAD", branch: "main", refspec: "HEAD:refs/heads/main", retries: 2, timeoutMs: DEFAULT_TIMEOUT_MS, json: false };
  const allowed = new Map([
    ["--remote", "remote"], ["--ref", "ref"], ["--branch", "branch"], ["--refspec", "refspec"],
    ["--retries", "retries"], ["--timeout-seconds", "timeoutSeconds"]
  ]);
  for (let index = 1; index < argv.length; index += 1) {
    if (argv[index] === "--json") { options.json = true; continue; }
    const key = allowed.get(argv[index]);
    if (!key || index + 1 >= argv.length) throw new Error(`Unknown or incomplete argument: ${argv[index]}`);
    options[key] = argv[++index];
  }
  if (!["diagnose", "ls-remote", "fetch", "pull", "push"].includes(operation)) throw new Error(`Unsupported operation: ${operation}`);
  options.remote = validateRemoteName(options.remote);
  options.ref = validateRef(options.ref);
  options.branch = validateRef(options.branch, { allowHead: false });
  options.refspec = validateRefspec(options.refspec);
  options.retries = Number.parseInt(options.retries, 10);
  const timeoutSeconds = options.timeoutSeconds === undefined ? DEFAULT_TIMEOUT_MS / 1000 : Number(options.timeoutSeconds);
  if (!Number.isInteger(options.retries) || options.retries < 0 || options.retries > 2) throw new Error("Retries must be an integer from 0 to 2.");
  if (!Number.isFinite(timeoutSeconds) || timeoutSeconds < 10 || timeoutSeconds > 600) throw new Error("Timeout must be between 10 and 600 seconds.");
  options.timeoutMs = timeoutSeconds * 1000;
  return { operation, options };
}

async function repositoryContext(git, cwd, remote, env, timeoutMs) {
  const root = await findRepositoryRoot(cwd);
  const reportedRoot = await captured(git, ["-c", `safe.directory=${root}`, "rev-parse", "--show-toplevel"], { cwd: root, env, timeoutMs: 10_000 });
  if ((await realpath(reportedRoot)).toLowerCase() !== root.toLowerCase()) throw new Error("Git repository root did not match the discovered workspace root.");
  const remoteUrl = await captured(git, ["-c", `safe.directory=${root}`, "remote", "get-url", "--push", remote], { cwd: root, env, timeoutMs: 10_000 });
  return { root, remote: parseGitHubRemote(remoteUrl) };
}

async function main() {
  const { operation, options } = parseArguments(process.argv.slice(2));
  const git = process.env.GIT_EXE || "git";
  const gh = process.env.GH_EXE || "gh";
  const sanitized = sanitizeEnvironment(process.env);
  const context = await repositoryContext(git, process.cwd(), options.remote, sanitized.environment, options.timeoutMs);
  options.safeDirectory = context.root;
  const diagnosis = {
    safe: true,
    operation,
    repository: `${context.remote.owner}/${context.remote.repository}`,
    remote: options.remote,
    codexWindowsSandbox: isCodexWindowsSandbox(process.env),
    removedBlackholeProxyVariables: sanitized.removedProxies,
    authentication: "ephemeral GitHub CLI token through askpass",
    tlsBackend: "openssl",
    interactivePrompts: false,
    timeoutSeconds: options.timeoutMs / 1000,
    retries: retryCountFor(operation, options.retries)
  };
  if (operation === "diagnose") {
    console.log(options.json ? JSON.stringify(diagnosis, null, 2) : Object.entries(diagnosis).map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(", ") || "none" : value}`).join("\n"));
    return;
  }

  const token = await captured(gh, ["auth", "token", "--hostname", "github.com"], { cwd: context.root, env: sanitized.environment, timeoutMs: 15_000 });
  const askPass = await createAskPass(token);
  try {
    const env = { ...sanitized.environment, SAFE_GIT_GITHUB_TOKEN: token, GIT_ASKPASS: askPass.file };
    delete env.GH_TOKEN;
    delete env.GITHUB_TOKEN;
    const args = buildRemoteArguments(operation, options, askPass.file);
    const retries = retryCountFor(operation, options.retries);
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      const result = await runProcess(git, args, { cwd: context.root, env, timeoutMs: options.timeoutMs });
      if (result.code === 0 && !result.timedOut) return;
      if (!shouldRetry(operation, attempt, options.retries, result)) {
        const ambiguity = operation === "push" ? " The remote may have accepted the push; verify it with GitHub CLI before retrying." : "";
        throw new Error(result.timedOut ? `Git ${operation} timed out.${ambiguity}` : `Git ${operation} failed with exit code ${result.code}.${ambiguity}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 300 * (2 ** attempt)));
    }
  } finally {
    await rm(askPass.directory, { recursive: true, force: true }).catch((error) => {
      console.warn(`Safe Git remote: could not remove token-free temporary askpass directory: ${error.message}`);
    });
  }
}

const executedDirectly = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (executedDirectly) main().catch((error) => { console.error(`Safe Git remote: ${error.message}`); process.exitCode = 1; });
