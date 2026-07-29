import { db } from './db';
import { embed } from './embed';

export interface SearchResult {
  sourceFile: string;
  heading: string | null;
  content: string;
  distance: number;
}

interface DocChunkRow {
  sourceFile: string;
  heading: string | null;
  content: string;
  distance: string;
}

export async function searchDocs(
  query: string,
  topK = 5,
): Promise<SearchResult[]> {
  const queryEmbedding = await embed(query);
  const vectorLiteral = `[${queryEmbedding.join(',')}]`;

  const rows: DocChunkRow[] = await db.query(
    `SELECT "sourceFile", heading, content, embedding <=> $1 AS distance
     FROM doc_chunks
     ORDER BY embedding <=> $1
     LIMIT $2`,
    [vectorLiteral, topK],
  );

  return rows.map((row) => ({
    sourceFile: row.sourceFile,
    heading: row.heading,
    content: row.content,
    distance: Number(row.distance),
  }));
}
