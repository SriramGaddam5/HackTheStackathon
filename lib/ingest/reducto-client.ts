/**
 * Reducto Client
 * 
 * Wrapper for Reducto API to parse PDF and document uploads.
 * Converts documents into text chunks that can be treated as feedback/specs.
 */

import type { FeedbackSource, FeedbackMeta } from '@/lib/db/models/feedback-item';

// ===========================================================================
// TYPES
// ===========================================================================

export interface ParsedDocument {
  source: FeedbackSource;
  content: string;
  meta: FeedbackMeta;
}

export interface ParseResult {
  success: boolean;
  items: ParsedDocument[];
  error?: string;
  documentInfo?: {
    pageCount: number;
    wordCount: number;
    fileName: string;
  };
}

export interface ReductoChunk {
  text: string;
  page?: number;
  bbox?: { x: number; y: number; width: number; height: number };
  confidence?: number;
}

// ===========================================================================
// REDUCTO CLIENT
// ===========================================================================

export class ReductoClient {
  private apiKey: string;
  private baseUrl: string = 'https://api.reducto.ai/v1';

  constructor(apiKey?: string) {
    const key = apiKey || process.env.REDUCTO_API_KEY;
    if (!key) {
      throw new Error('REDUCTO_API_KEY is required');
    }
    this.apiKey = key;
  }

  /**
   * Parse a document from a file upload
   */
  async parseFile(
    file: File | Buffer,
    options: {
      fileName?: string;
      chunkSize?: number;  // Target chunk size in words
      overlap?: number;    // Overlap between chunks
    } = {}
  ): Promise<ParseResult> {
    const { fileName = 'document.pdf', chunkSize = 500, overlap = 50 } = options;

    try {
      // Convert file to base64 if needed
      let base64Content: string;
      
      if (Buffer.isBuffer(file)) {
        base64Content = file.toString('base64');
      } else {
        const arrayBuffer = await file.arrayBuffer();
        base64Content = Buffer.from(arrayBuffer).toString('base64');
      }

      // Call Reducto API
      const response = await fetch(`${this.baseUrl}/parse`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          document_base64: base64Content,
          file_name: fileName,
          output_format: 'chunks',
          chunk_config: {
            target_size: chunkSize,
            overlap: overlap,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          items: [],
          error: `Reducto API error: ${response.status} - ${errorText}`,
        };
      }

      const data = await response.json();
      
      // Convert Reducto chunks to our format
      const items = this.processChunks(data.chunks || [], fileName);

      return {
        success: true,
        items,
        documentInfo: {
          pageCount: data.page_count || 0,
          wordCount: data.word_count || 0,
          fileName,
        },
      };
    } catch (error) {
      console.error('Reducto parse error:', error);
      return {
        success: false,
        items: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Parse a document from a URL
   */
  async parseUrl(
    documentUrl: string,
    options: {
      chunkSize?: number;
      overlap?: number;
    } = {}
  ): Promise<ParseResult> {
    const { chunkSize = 500, overlap = 50 } = options;

    try {
      const response = await fetch(`${this.baseUrl}/parse`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          document_url: documentUrl,
          output_format: 'chunks',
          chunk_config: {
            target_size: chunkSize,
            overlap: overlap,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          items: [],
          error: `Reducto API error: ${response.status} - ${errorText}`,
        };
      }

      const data = await response.json();
      const fileName = documentUrl.split('/').pop() || 'document';
      const items = this.processChunks(data.chunks || [], fileName);

      return {
        success: true,
        items,
        documentInfo: {
          pageCount: data.page_count || 0,
          wordCount: data.word_count || 0,
          fileName,
        },
      };
    } catch (error) {
      console.error('Reducto parse URL error:', error);
      return {
        success: false,
        items: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Parse plain text or markdown content
   * Useful for direct text input or markdown specs
   */
  parseText(
    text: string,
    options: {
      fileName?: string;
      chunkSize?: number;
    } = {}
  ): ParseResult {
    const { fileName = 'text-input', chunkSize = 500 } = options;

    try {
      // Simple chunking by paragraphs or word count
      const chunks = this.chunkText(text, chunkSize);
      
      const items: ParsedDocument[] = chunks.map((chunk, index) => ({
        source: 'manual_upload' as FeedbackSource,
        content: chunk,
        meta: {
          author: fileName,
          page: index + 1,
          chunk_index: index,
          total_chunks: chunks.length,
        },
      }));

      return {
        success: true,
        items,
        documentInfo: {
          pageCount: 1,
          wordCount: text.split(/\s+/).length,
          fileName,
        },
      };
    } catch (error) {
      return {
        success: false,
        items: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // ---------------------------------------------------------------------------
  // PRIVATE HELPERS
  // ---------------------------------------------------------------------------

  /**
   * Process Reducto chunks into our feedback format
   */
  private processChunks(chunks: ReductoChunk[], fileName: string): ParsedDocument[] {
    return chunks
      .filter(chunk => chunk.text && chunk.text.trim().length > 20)
      .map((chunk, index) => ({
        source: 'manual_upload' as FeedbackSource,
        content: chunk.text.trim(),
        meta: {
          author: fileName,
          page: chunk.page,
          chunk_index: index,
          confidence: chunk.confidence,
          bbox: chunk.bbox,
        },
      }));
  }

  /**
   * Simple text chunking by word count
   */
  private chunkText(text: string, targetSize: number): string[] {
    const chunks: string[] = [];
    
    // First, split by paragraphs
    const paragraphs = text.split(/\n\n+/);
    let currentChunk = '';
    let currentWordCount = 0;

    for (const para of paragraphs) {
      const paraWords = para.trim().split(/\s+/).length;
      
      // If paragraph alone exceeds target, split it
      if (paraWords > targetSize) {
        // Save current chunk if exists
        if (currentChunk) {
          chunks.push(currentChunk.trim());
          currentChunk = '';
          currentWordCount = 0;
        }
        
        // Split large paragraph
        const words = para.split(/\s+/);
        for (let i = 0; i < words.length; i += targetSize) {
          chunks.push(words.slice(i, i + targetSize).join(' '));
        }
      } 
      // If adding this para exceeds target, start new chunk
      else if (currentWordCount + paraWords > targetSize) {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
        }
        currentChunk = para;
        currentWordCount = paraWords;
      }
      // Otherwise, add to current chunk
      else {
        currentChunk += (currentChunk ? '\n\n' : '') + para;
        currentWordCount += paraWords;
      }
    }

    // Don't forget the last chunk
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }
}

// ===========================================================================
// SINGLETON EXPORT
// ===========================================================================

let reductoInstance: ReductoClient | null = null;

export function getReductoClient(): ReductoClient {
  if (!reductoInstance) {
    reductoInstance = new ReductoClient();
  }
  return reductoInstance;
}
