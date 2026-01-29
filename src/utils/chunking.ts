// Client-side text chunking for knowledge base ingestion

const CHUNK_SIZE = 1000; // Characters per chunk
const CHUNK_OVERLAP = 200; // Overlap between chunks

export interface TextChunk {
  content: string;
  index: number;
  sectionHeading: string | null;
}

/**
 * Split text into overlapping chunks with intelligent break points
 */
export function chunkText(text: string): TextChunk[] {
  const chunks: TextChunk[] = [];
  let start = 0;
  let index = 0;

  while (start < text.length) {
    let end = Math.min(start + CHUNK_SIZE, text.length);

    if (end < text.length) {
      // Try to break at paragraph
      const paragraphBreak = text.lastIndexOf("\n\n", end);
      if (paragraphBreak > start + CHUNK_SIZE / 2) {
        end = paragraphBreak + 2;
      } else {
        // Try to break at sentence
        const sentenceBreak = text.lastIndexOf(". ", end);
        if (sentenceBreak > start + CHUNK_SIZE / 2) {
          end = sentenceBreak + 2;
        }
      }
    }

    const content = text.slice(start, end).trim();
    if (content.length > 0) {
      chunks.push({
        content,
        index,
        sectionHeading: extractSectionHeading(content),
      });
      index++;
    }

    // If we've reached the end of the text, stop — no more chunks needed
    if (end >= text.length) break;

    start = end - CHUNK_OVERLAP;
  }

  return chunks;
}

function extractSectionHeading(text: string): string | null {
  const lines = text.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (
      trimmed.length > 0 &&
      trimmed.length < 100 &&
      (trimmed.startsWith("#") ||
        trimmed.toUpperCase() === trimmed ||
        /^[A-Z][^.!?]*$/.test(trimmed))
    ) {
      return trimmed.replace(/^#+\s*/, "");
    }
  }
  return null;
}
