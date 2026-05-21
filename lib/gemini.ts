// Gemini API client — structured-JSON generation over the REST API.
//
// Requires GEMINI_API_KEY. The model is overridable with GEMINI_MODEL and
// defaults to gemini-2.5-flash. Every failure resolves to null so callers can
// degrade gracefully — the app never depends on Gemini being reachable.

const DEFAULT_MODEL = "gemini-2.5-flash";
const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

type JsonSchema = Record<string, unknown>;

/** True when a Gemini API key is configured. */
export function geminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

type GenerateArgs = {
  /** System instruction — role, domain knowledge, output rules. */
  system: string;
  /** The user turn — task data. */
  prompt: string;
  /** Response schema constraining the JSON Gemini returns. */
  schema: JsonSchema;
  temperature?: number;
};

type GeminiResponse = {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
};

/** Run a structured-JSON generation. Returns parsed JSON, or null on any failure. */
export async function geminiJson<T>(args: GenerateArgs): Promise<T | null> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) return null;
  const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;

  try {
    const res = await fetch(`${API_BASE}/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: args.system }] },
        contents: [{ role: "user", parts: [{ text: args.prompt }] }],
        generationConfig: {
          temperature: args.temperature ?? 0.4,
          responseMimeType: "application/json",
          responseSchema: args.schema,
        },
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      console.error(`Gemini request failed: ${res.status} ${res.statusText}`);
      return null;
    }

    const data = (await res.json()) as GeminiResponse;
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;
    return JSON.parse(text) as T;
  } catch (err) {
    console.error("Gemini request error:", err);
    return null;
  }
}
