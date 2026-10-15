import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { generateContent } = vi.hoisted(() => ({ generateContent: vi.fn() }));
vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContent };
  },
  Type: { ARRAY: "ARRAY", OBJECT: "OBJECT", STRING: "STRING" },
}));

import { CALL_TIMEOUT_MS, classifyBatch } from "@/lib/gemini";
import type { ReleaseRecord } from "@/lib/types";

const rel = (id: number): ReleaseRecord => ({
  releaseId: id, repo: "o/r", tag: "dependency", tagName: "v1.0.0", name: "v1.0.0", htmlUrl: "https://github.com/o/r",
  publishedAt: "2025-01-01T00:00:00Z", prerelease: false, body: "Fixes a thing.", bodyLineCount: 1, notesExcerpt: "Fixes a thing.", ruleFlags: [],
});
const good = (id: number) => ({ text: JSON.stringify([{ id: String(id), summary: "Fixes a thing.", category: "routine", reason: "", action: "" }]) });
const withStatus = (status: number) => Object.assign(new Error(`HTTP ${status}`), { status });

async function run(releases: ReleaseRecord[]) {
  const p = classifyBatch(releases);
  await vi.advanceTimersByTimeAsync(20_000); // past the retry backoff
  return p;
}

describe("classifyBatch: bounded, single-retry calls", () => {
  beforeEach(() => {
    process.env.GEMINI_API_KEY = "test-key";
    process.env.GEMINI_MODEL = "test-model";
    generateContent.mockReset();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it("gives every call a hard timeout and turns the SDK's own retries off", async () => {
    generateContent.mockResolvedValueOnce(good(1));
    await run([rel(1)]);
    const config = generateContent.mock.calls[0][0].config;
    expect(config.httpOptions.timeout).toBe(CALL_TIMEOUT_MS);
    expect(config.httpOptions.retryOptions).toEqual({ attempts: 1 });
  });

  it("retries once on a 429 and succeeds", async () => {
    generateContent.mockRejectedValueOnce(withStatus(429)).mockResolvedValueOnce(good(1));
    const report = await run([rel(1)]);
    expect(report.calls).toBe(2);
    expect(report.outcomes.get(1)).toMatchObject({ ok: true });
  });

  it("retries once on a network failure (no status), then marks the batch failed, never throws", async () => {
    generateContent.mockRejectedValue(new Error("fetch failed"));
    const report = await run([rel(1), rel(2)]);
    expect(report.calls).toBe(2);
    expect([...report.outcomes.values()].every((o) => !o.ok)).toBe(true);
    expect(report.outcomes.size).toBe(2);
  });

  it("retries a 5xx once and reports the status in the failure", async () => {
    generateContent.mockRejectedValue(withStatus(503));
    const report = await run([rel(1)]);
    expect(report.calls).toBe(2);
    const o = report.outcomes.get(1);
    expect(o && !o.ok && o.error).toContain("503");
  });

  it("does not retry a client error such as 400", async () => {
    generateContent.mockRejectedValue(withStatus(400));
    const report = await run([rel(1)]);
    expect(report.calls).toBe(1);
    expect(report.outcomes.get(1)).toMatchObject({ ok: false });
  });

  it("marks the batch failed (no retry) when the model returns invalid JSON", async () => {
    generateContent.mockResolvedValueOnce({ text: "not json" });
    const report = await run([rel(1)]);
    expect(report.calls).toBe(1);
    expect(report.outcomes.get(1)).toMatchObject({ ok: false, error: "AI returned invalid JSON" });
  });
});
