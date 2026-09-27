import test from "node:test";
import assert from "node:assert/strict";
import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  buildRemoteArguments,
  createAskPass,
  findRepositoryRoot,
  isCodexWindowsSandbox,
  parseArguments,
  parseGitHubRemote,
  retryCountFor,
  shouldRetry,
  runProcess,
  sanitizeEnvironment,
  validateRef,
  validateRefspec,
  validateRemoteName
} from "../scripts/git-remote-safe.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("detects Codex on Windows even when USERNAME reflects the desktop user", () => {
  assert.equal(isCodexWindowsSandbox({ USERNAME: "frees", USERDOMAIN: "FDR", CODEX_SHELL: "1" }), process.platform === "win32");
});

test("accepts and normalizes the canonical GitHub HTTPS remote", () => {
  assert.deepEqual(parseGitHubRemote("https://github.com/cheaply-fr/example.git"), {
    url: "https://github.com/cheaply-fr/example.git", owner: "cheaply-fr", repository: "example"
  });
});

test("rejects the legacy GitHub organization", () => {
  assert.throws(() => parseGitHubRemote("https://github.com/faresd/example.git"), /canonical cheaply-fr organization/);
});

for (const remote of [
  "http://github.com/cheaply-fr/example.git",
  "https://github.example/cheaply-fr/example.git",
  "https://github.com.evil.test/cheaply-fr/example.git",
  "https://token@github.com/cheaply-fr/example.git",
  "https://github.com/cheaply-fr/example/extra.git",
  "https://github.com/cheaply-fr%2Fexample.git",
  "https://github.com/cheaply-fr/example.git?token=secret",
  "git@github.com:cheaply-fr/example.git"
]) test(`rejects unsafe remote ${remote}`, () => assert.throws(() => parseGitHubRemote(remote)));

test("removes only Codex blackhole proxies and disables prompts", () => {
  const source = { PATH: "x", HTTPS_PROXY: "http://127.0.0.1:9", HTTP_PROXY: "https://proxy.example:8443" };
  const result = sanitizeEnvironment(source);
  assert.equal(result.environment.HTTPS_PROXY, undefined);
  assert.equal(result.environment.HTTP_PROXY, "https://proxy.example:8443");
  assert.equal(result.environment.GIT_TERMINAL_PROMPT, "0");
  assert.equal(result.environment.GCM_INTERACTIVE, "Never");
  assert.deepEqual(result.removedProxies, ["HTTPS_PROXY"]);
  assert.equal(source.HTTPS_PROXY, "http://127.0.0.1:9", "the caller environment must not be mutated");
});

for (const ref of ["-force", "refs/heads/main..evil", "refs/heads/main@{1}", "refs//heads/main", "refs/heads/a.lock", "refs/heads/a b", "refs/heads/a:evil"])
  test(`rejects unsafe ref ${ref}`, () => assert.throws(() => validateRef(ref)));

test("validates remote names and complete refspecs", () => {
  assert.equal(validateRemoteName("origin"), "origin");
  assert.equal(validateRefspec("HEAD:refs/heads/main"), "HEAD:refs/heads/main");
  assert.throws(() => validateRemoteName("--upload-pack=evil"));
  assert.throws(() => validateRefspec(":refs/heads/main"));
  assert.throws(() => validateRefspec("HEAD:refs/heads/main:extra"));
});

test("places credentials in askpass, never in Git arguments", () => {
  const args = buildRemoteArguments("push", { remote: "origin", refspec: "HEAD:refs/heads/main", safeDirectory: ROOT }, "C:/Temp/askpass.cmd");
  assert.deepEqual(args.slice(-4), ["push", "--porcelain", "origin", "HEAD:refs/heads/main"]);
  assert(args.includes("http.sslBackend=openssl"));
  assert(args.includes("credential.helper="));
  assert(args.includes("credential.https://github.com.helper="));
  assert(args.includes(`safe.directory=${ROOT}`));
  assert.equal(args.some((value) => /token|gh[opsu]_/i.test(value)), false);
});

test("never retries state-changing or ambiguous operations", () => {
  assert.equal(retryCountFor("push", 2), 0);
  assert.equal(retryCountFor("pull", 2), 0);
  assert.equal(retryCountFor("fetch", 2), 2);
  assert.equal(retryCountFor("ls-remote", 99), 2);
  assert.equal(shouldRetry("fetch", 0, 2, { code: 1, timedOut: false }), true);
  assert.equal(shouldRetry("fetch", 0, 2, { code: 1, timedOut: true }), false);
  assert.equal(shouldRetry("push", 0, 2, { code: 1, timedOut: false }), false);
});

test("accepts valid branch and tag refs", () => {
  for (const ref of ["main", "release/v2.0.18", "refs/heads/feature_safe", "refs/tags/v2.0.18", "HEAD"])
    assert.equal(validateRef(ref), ref);
});

test("builds fixed argument shapes for every operation", () => {
  const options = { remote: "origin", ref: "main", branch: "main", refspec: "HEAD:refs/heads/main", safeDirectory: ROOT };
  assert.deepEqual(buildRemoteArguments("ls-remote", options, "askpass").slice(-4), ["ls-remote", "--exit-code", "origin", "main"]);
  assert.deepEqual(buildRemoteArguments("fetch", options, "askpass").slice(-5), ["fetch", "--prune", "--no-tags", "origin", "main"]);
  assert.deepEqual(buildRemoteArguments("pull", options, "askpass").slice(-4), ["pull", "--ff-only", "origin", "main"]);
  assert.throws(() => buildRemoteArguments("delete", options, "askpass"));
});

test("discovers the exact repository root without changing global Git trust", async () => {
  assert.equal((await findRepositoryRoot(path.join(ROOT, "tests"))).toLowerCase(), ROOT.toLowerCase());
  assert.throws(() => buildRemoteArguments("fetch", { remote: "origin", ref: "main" }, "askpass"), /safe repository directory/);
});

test("argument parsing rejects unknown flags and unsafe numeric bounds", () => {
  assert.throws(() => parseArguments(["push", "--force", "true"]));
  assert.throws(() => parseArguments(["fetch", "--retries", "3"]));
  assert.throws(() => parseArguments(["fetch", "--timeout-seconds", "9"]));
  assert.throws(() => parseArguments(["fetch", "--timeout-seconds", "601"]));
  assert.equal(parseArguments(["diagnose", "--json"]).options.json, true);
});

test("temporary askpass never contains the token and can be removed", async () => {
  const secret = "ghp_NOT_A_REAL_TOKEN_123456";
  const askPass = await createAskPass(secret);
  try {
    const source = await readFile(askPass.file, "utf8");
    assert.equal(source.includes(secret), false);
    assert.match(source, /SAFE_GIT_GITHUB_TOKEN/);
  } finally {
    await rm(askPass.directory, { recursive: true, force: true });
  }
});

test("process runner bounds hung child processes", async () => {
  const result = await runProcess(process.execPath, ["-e", "setTimeout(() => {}, 10000)"], {
    cwd: ROOT, env: process.env, timeoutMs: 150, capture: true
  });
  assert.equal(result.timedOut, true);
  assert.notEqual(result.code, 0);
});

test("network-free diagnosis succeeds inside the repository", () => {
  const result = spawnSync(process.execPath, ["scripts/git-remote-safe.mjs", "diagnose", "--json"], {
    cwd: ROOT, encoding: "utf8", timeout: 10_000, shell: false, windowsHide: true
  });
  assert.equal(result.status, 0, result.stderr);
  const diagnosis = JSON.parse(result.stdout);
  assert.equal(diagnosis.safe, true);
  assert.equal(diagnosis.repository, "cheaply-fr/amazon-brother-label-extension");
  assert.equal(diagnosis.interactivePrompts, false);
  assert.equal(diagnosis.tlsBackend, "openssl");
});
