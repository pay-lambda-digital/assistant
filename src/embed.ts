import { pipeline } from '@huggingface/transformers';

// Loaded once, reused for both ingestion and query-time embedding — see
// "Knowledge base & retrieval" in ASSISTANT_PLAN.md for why this runs locally
// instead of calling an external embedding API.
type Extractor = Awaited<ReturnType<typeof pipeline>>;

let extractor: Extractor | null = null;

async function getExtractor(): Promise<Extractor> {
  if (!extractor) {
    extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }
  return extractor;
}

export async function embed(text: string): Promise<number[]> {
  const model = await getExtractor();
  const output = (await model(text, { pooling: 'mean', normalize: true })) as {
    data: Float32Array;
  };
  return Array.from(output.data);
}
