export interface Note {
  id: string;
  title: string;
  updated_at?: number;
}

export interface Tab {
  id: string;
  title: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: string[];
  isLoading?: boolean;
}
