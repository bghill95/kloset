import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runRenderPipeline } from "./render";

describe("runRenderPipeline with MOCK_AI=1", () => {
  const previous = process.env.MOCK_AI;
  beforeEach(() => {
    process.env.MOCK_AI = "1";
  });
  afterEach(() => {
    if (previous === undefined) delete process.env.MOCK_AI;
    else process.env.MOCK_AI = previous;
  });

  it("returns the fixture render without touching OpenAI/Blob", async () => {
    const url = await runRenderPipeline("https://mock/base.jpg", [
      { name: "Light blue oxford shirt", category: "top", imageUrl: "https://mock/cutout.png" },
    ]);
    expect(url).toBe("/fixtures/render.svg");
  });
});
