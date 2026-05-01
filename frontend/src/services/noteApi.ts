import { API_BASE_URL } from './config';

export const noteApi = {
  fetchNotes: async (signal?: AbortSignal) => {
    const res = await fetch(`${API_BASE_URL}/api/notes/`, { signal });
    if (!res.ok) throw new Error('Failed to fetch notes');
    const data = await res.json();
    return data.notes || [];
  },

  fetchNoteContent: async (id: string, signal?: AbortSignal) => {
    const res = await fetch(`${API_BASE_URL}/api/notes/${id}`, { signal });
    if (!res.ok) throw new Error('Failed to fetch note content');
    const data = await res.json();
    return data.content || '';
  },

  createNote: async (data: { title: string; content: string }) => {
    const res = await fetch(`${API_BASE_URL}/api/notes/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || 'Failed to create note');
    }
    return res.json();
  },

  updateNote: async (id: string, data: { content: string }) => {
    const res = await fetch(`${API_BASE_URL}/api/notes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update note');
    return res.json();
  },

  deleteNote: async (id: string) => {
    const res = await fetch(`${API_BASE_URL}/api/notes/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete note');
    return res.json();
  }
};
