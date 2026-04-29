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

export const aiApi = {
  chatWithAI: async (query: string, selectedFiles?: string[], signal?: AbortSignal): Promise<ChatResponse> => {
    const res = await fetch(`${API_BASE_URL}/api/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: query,
        selected_files: selectedFiles && selectedFiles.length > 0 ? selectedFiles : null,
      }),
      signal,
    });
    
    if (!res.ok) {
      throw new Error('Failed to generate chat response');
    }
    
    const data = await res.json();
    return data;
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