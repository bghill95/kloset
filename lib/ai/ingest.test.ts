import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runIngestPipeline } from "./ingest";

describe("runIngestPipeline with MOCK_AI=1", () => {
  const previous = process.env.MOCK_AI;
  beforeEach(() => {
    process.env.MOCK_AI = "1";
  });
  afterEach(() => {
    process.env.MOCK_AI = previous;
  });

  it("returns fixture urls and a suggestion without touching OpenAI/Blob", async () => {
    const result = await runIngestPipeline(
      Buffer.from("not-a-real-image"),
      "image/jpeg",
      "shoes",
    );
    expect(result.originalUrl).toBe("/fixtures/original-top.svg");
    expect(result.cutoutUrl).toBe("/fixtures/cutout-top.svg");
    expect(result.suggestion?.name).toBe("Light blue oxford shirt");
    expect(result.suggestion?.detectedCategory).toBe("shoes");
    expect(result.warning).toBeNull();
  });
});
