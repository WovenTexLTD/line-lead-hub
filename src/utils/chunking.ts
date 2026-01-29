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
  const maxChunks = Math.ceil(text.length / (CHUNK_SIZE - CHUNK_OVERLAP)) + 10;

  while (start < text.length && index < maxChunks) {
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

    // If we've reached the end of the text, stop
    if (end >= text.length) break;

    // Advance start, ensuring we always move forward
    const newStart = end - CHUNK_OVERLAP;
    if (newStart <= start) {
      start = start + 1;
    } else {
      start = newStart;
    }
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
