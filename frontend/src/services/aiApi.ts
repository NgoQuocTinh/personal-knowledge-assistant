import { API_BASE_URL } from './config';

export interface ChatResponse {
  answer: string;
  sources: string[];
}

export interface SyncResponse {
  status: string;
  message: string;
  documents_processed: number;
  chunks_created: number;
}

export interface ApiMessage {
  role: string;
  content: string;
}

export const aiApi = {
  chatWithAI: async (
    query: string, 
    selectedFiles?: string[], 
    messages?: ApiMessage[],
    callbacks?: {
      onSources?: (sources: string[]) => void;
      onChunk?: (chunk: string) => void;
    },
    signal?: AbortSignal
  ): Promise<void> => {
    const res = await fetch(`${API_BASE_URL}/api/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: query,
        selected_files: selectedFiles && selectedFiles.length > 0 ? selectedFiles : null,
        messages: messages || []
      }),
      signal,
    });
    
    if (!res.ok) {
      throw new Error('Failed to generate chat response');
    }
    
    if (!res.body) {
      throw new Error('No response body');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const dataStr = line.substring(6);
          if (dataStr === '[DONE]') {
            return;
          }
          
          try {
            const data = JSON.parse(dataStr);
            if (data.sources && callbacks?.onSources) {
              callbacks.onSources(data.sources);
            }
            if (data.answer_chunk && callbacks?.onChunk) {
              callbacks.onChunk(data.answer_chunk);
            }
          } catch (e) {
            console.error('Error parsing SSE data:', e, dataStr);
          }
        }
      }
    }
  },
  
  syncVectorDB: async (): Promise<SyncResponse> => {
    const res = await fetch(`${API_BASE_URL}/api/ai/sync`, {
      method: 'POST',
    });
    
    if (!res.ok) {
      throw new Error('Failed to sync VectorDB');
    }
    
    return await res.json();
  }
};