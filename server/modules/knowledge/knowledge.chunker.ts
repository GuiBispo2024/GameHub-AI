import { sanitizeKnowledgeText } from './knowledge.security';

export interface ChunkingOptions {
  maxChunkChars?: number;
  minChunkChars?: number;
  overlapChars?: number;
}

export interface DocumentChunkOutput {
  chunkIndex: number;
  heading: string | null;
  content: string;
  charCount: number;
  tokenCount: number;
}

export const DEFAULT_MAX_CHUNK_CHARS = 900;
export const DEFAULT_MIN_CHUNK_CHARS = 120;
export const DEFAULT_OVERLAP_CHARS = 120;

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

function splitLongParagraph(
  paragraph: string,
  maxChars: number,
  overlapChars: number
): string[] {
  if (paragraph.length <= maxChars) {
    return [paragraph];
  }

  // Prefer sentence boundaries first so tips/explanations stay coherent
  const sentences = paragraph
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const pieces: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    if (sentence.length > maxChars) {
      if (current) {
        pieces.push(current.trim());
        current = '';
      }
      // Hard word-boundary split for unusually long unbroken text
      let start = 0;
      while (start < sentence.length) {
        let end = Math.min(start + maxChars, sentence.length);
        if (end < sentence.length) {
          const lastSpace = sentence.lastIndexOf(' ', end);
          if (lastSpace > start + Math.floor(maxChars * 0.5)) {
            end = lastSpace;
          }
        }
        const slice = sentence.slice(start, end).trim();
        if (slice) pieces.push(slice);
        if (end >= sentence.length) break;
        const nextStart = Math.max(start + 1, end - overlapChars);
        const alignedStart = sentence.indexOf(' ', nextStart);
        start = alignedStart !== -1 && alignedStart < end ? alignedStart + 1 : end;
      }
      continue;
    }

    const candidate = current ? `${current} ${sentence}` : sentence;
    if (candidate.length <= maxChars) {
      current = candidate;
    } else {
      if (current) pieces.push(current.trim());
      if (overlapChars > 0 && current.length > 0) {
        const tail = current.slice(-overlapChars);
        const spaceIdx = tail.indexOf(' ');
        const cleanTail = spaceIdx !== -1 ? tail.slice(spaceIdx + 1).trim() : tail.trim();
        const combined = cleanTail ? `${cleanTail} ${sentence}` : sentence;
        current = combined.length <= maxChars ? combined : sentence;
      } else {
        current = sentence;
      }
    }
  }

  if (current.trim()) {
    pieces.push(current.trim());
  }

  return pieces;
}

/**
 * Context-aware document chunker for gameplay guides.
 * Splits by Markdown headings first, groups coherent paragraphs within configurable bounds,
 * and avoids severing headings from their explanatory paragraphs.
 */
export function chunkKnowledgeDocument(
  rawContent: string,
  options: ChunkingOptions = {}
): DocumentChunkOutput[] {
  const maxChars = Math.min(Math.max(options.maxChunkChars ?? DEFAULT_MAX_CHUNK_CHARS, 250), 2500);
  const minChars = Math.min(Math.max(options.minChunkChars ?? DEFAULT_MIN_CHUNK_CHARS, 40), maxChars - 50);
  const overlapChars = Math.min(Math.max(options.overlapChars ?? DEFAULT_OVERLAP_CHARS, 0), Math.floor(maxChars / 3));

  const cleaned = sanitizeKnowledgeText(rawContent).replace(/\r\n/g, '\n').trim();
  if (!cleaned) {
    return [];
  }

  const lines = cleaned.split('\n');
  const sections: Array<{ heading: string | null; bodyLines: string[] }> = [];
  let currentHeading: string | null = null;
  let currentLines: string[] = [];

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,4})\s+(.+?)\s*$/);
    if (headingMatch) {
      if (currentLines.join('\n').trim().length > 0) {
        sections.push({ heading: currentHeading, bodyLines: currentLines });
      }
      currentHeading = headingMatch[2].trim().slice(0, 140);
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }

  if (currentLines.join('\n').trim().length > 0 || currentHeading) {
    sections.push({ heading: currentHeading, bodyLines: currentLines });
  }

  const draftChunks: Array<{ heading: string | null; content: string }> = [];

  for (const section of sections) {
    const sectionText = section.bodyLines.join('\n').trim();
    if (!sectionText && section.heading) {
      draftChunks.push({ heading: section.heading, content: section.heading });
      continue;
    }

    const paragraphs = sectionText
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean);

    let buffer = '';
    for (const para of paragraphs) {
      const subParts = splitLongParagraph(para, maxChars, overlapChars);
      for (const part of subParts) {
        const candidate = buffer ? `${buffer}\n\n${part}` : part;
        if (candidate.length <= maxChars) {
          buffer = candidate;
        } else {
          if (buffer) {
            draftChunks.push({ heading: section.heading, content: buffer });
          }
          buffer = part;
        }
      }
    }

    if (buffer.trim()) {
      draftChunks.push({ heading: section.heading, content: buffer.trim() });
    }
  }

  // Merge tiny trailing fragments within the same section heading so context stays whole
  const merged: Array<{ heading: string | null; content: string }> = [];
  for (const item of draftChunks) {
    const prev = merged[merged.length - 1];
    if (
      prev &&
      prev.heading === item.heading &&
      (item.content.length < minChars || prev.content.length < minChars) &&
      prev.content.length + item.content.length + 2 <= maxChars + 200
    ) {
      prev.content = `${prev.content}\n\n${item.content}`;
    } else {
      merged.push({ ...item });
    }
  }

  return merged.map((chunk, index) => ({
    chunkIndex: index,
    heading: chunk.heading,
    content: chunk.content,
    charCount: chunk.content.length,
    tokenCount: estimateTokens(chunk.content),
  }));
}
