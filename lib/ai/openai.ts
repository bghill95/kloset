import OpenAI from "openai";

let _client: OpenAI | undefined;

export function getOpenAI(): OpenAI {
  // Lazy: constructed at call time, not import time (learned rule — module-scope
  // clients crash `next build` when the env var is missing).
  if (!_client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is not set");
    _client = new OpenAI({ apiKey });
  }
  return _client;
}
