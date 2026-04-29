
'use client';
import { useState, useEffect, useRef } from 'react';
import Sidebar from '../components/Sidebar';
import Editor from '../components/Editor';
import Chat from '../components/Chat';
import { Note, Tab } from '../types';
import { noteApi } from '../services/noteApi';
import { aiApi } from '../services/aiApi';

export default function Home() {
  const [viewMode, setViewMode] = useState<'editor' | 'graph'>('editor');
  const [openTabs, setOpenTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>('');
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoadingNotes, setIsLoadingNotes] = useState(false);

  // UX Error state
  const [error, setError] = useState<string | null>(null);

  // Rename state tabContents -> noteContentsById for clarity
  const [noteContentsById, setNoteContentsById] = useState<Record<string, string>>({});
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Keep track of loaded files (prevent reload if activeTabId switches back and forth)
  const loadedNotesRef = useRef<Set<string>>(new Set());

  // Fetch file list
  useEffect(() => {
    const controller = new AbortController();

    const fetchAllNotes = async () => {
      setIsLoadingNotes(true);
      setError(null);
      try {
        const data = await noteApi.fetchNotes(controller.signal);
        setNotes(data || []);
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== 'AbortError') {
          console.error("Error fetching notes:", err);
          setError("Failed to load notes. Please check connection.");
        }
      } finally {
        setIsLoadingNotes(false);
      }
    };

    fetchAllNotes();
    return () => controller.abort(); // Cleanup/Abort if tab switches very rapidly (though rare for notes list)
  }, []);

  // Listen to activeTabId changes to fetch content from Backend
  useEffect(() => {
    if (!activeTabId || activeTabId.startsWith('draft-') || loadedNotesRef.current.has(activeTabId)) {
      return; 
    }

    const controller = new AbortController();

    const fetchContent = async () => {
      setIsLoadingContent(true);
      setError(null);
      try {
        const content = await noteApi.fetchNoteContent(activeTabId, controller.signal);
        setNoteContentsById(prev => ({ ...prev, [activeTabId]: content }));
        loadedNotesRef.current.add(activeTabId);
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== 'AbortError') {
          console.error("Error fetching note content:", err);
          setError(`Failed to load content for note.`);
        }
      } finally {
        setIsLoadingContent(false);
      }
    };

    fetchContent();

    return () => {
      controller.abort(); // Cancel pending request if activeTabId changes before this one finishes
    };
  }, [activeTabId]); // Dependency is only activeTabId

  // Function to open file using functional state update to avoid stale state
  const handleOpenFile = (note: Note) => {
    setOpenTabs(prevTabs => {
      if (!prevTabs.find(tab => tab.id === note.id)) {
        return [...prevTabs, { id: note.id, title: note.title }];
      }
      return prevTabs;
    });
    setActiveTabId(note.id);
  };

  // Function to open a new draft note
  const handleNewNote = () => {
    const newId = `draft-${Date.now()}`;
    setOpenTabs(prevTabs => [...prevTabs, { id: newId, title: 'Untitled Note' }]);
    setNoteContentsById(prev => ({ ...prev, [newId]: "" }));
    loadedNotesRef.current.add(newId);
    setActiveTabId(newId);
  };

  // Function to handle typing text into note
  const handleContentChange = (newContent: string) => {
    setNoteContentsById(prev => ({ ...prev, [activeTabId]: newContent }));
  };

  const handleTitleChange = (id: string, newTitle: string) => {
    setOpenTabs(prevTabs => Object.assign([], prevTabs).map((tab: Tab) => 
      tab.id === id ? { ...tab, title: newTitle } : tab
    ));
    // Optimistically update the left sidebar notes if it exists
    setNotes(prev => prev.map(n => n.id === id ? { ...n, title: newTitle } : n));
  };

  const handleSaveNote = async () => {
    const isDraft = activeTabId.startsWith('draft-');
    const content = noteContentsById[activeTabId] || "";
    const tabObj = openTabs.find(t => t.id === activeTabId);
    
    if (!tabObj || !tabObj.title.trim()) {
       setError("Note title cannot be empty");
       return;
    }

    setIsSaving(true);
    setError(null);
    try {
      if (isDraft) {
        // Create new note
        const newNote = await noteApi.createNote({
          title: tabObj.title,
          content: content
        });

        // Add to sidebar
        setNotes(prev => [...prev, newNote]);
        
        // Update tab ID from draft-X to actual UUID
        setOpenTabs(prev => prev.map(t => t.id === activeTabId ? { id: newNote.id, title: newNote.title } : t));
        setActiveTabId(newNote.id);
        
        // Move content map
        setNoteContentsById((prev: Record<string, string>) => {
          const newMap: Record<string, string> = { ...prev, [newNote.id]: content };
          delete newMap[activeTabId];
          return newMap;
        });

        // update cache
        loadedNotesRef.current.delete(activeTabId);
        loadedNotesRef.current.add(newNote.id);

      } else {
        // Update existing note
        await noteApi.updateNote(activeTabId, { content });
        // NOTE: The backend may not support title update yet. We will only send content.
      }
      
      // Auto-trigger sync
      setIsSyncing(true);
      await aiApi.syncVectorDB();
      
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to save or sync note');
    } finally {
      setIsSaving(false);
      setIsSyncing(false);
    }
  };

  const handleDeleteNote = async () => {
    if (activeTabId.startsWith('draft-')) {
      // It's a draft, just close the tab
      handleCloseTab({ stopPropagation: () => {} } as React.MouseEvent, activeTabId);
      return;
    }

    if (!window.confirm("Are you sure you want to delete this note?")) return;

    setIsSaving(true);
    try {
      await noteApi.deleteNote(activeTabId);
      setNotes(prev => prev.filter(n => n.id !== activeTabId));
      handleCloseTab({ stopPropagation: () => {} } as React.MouseEvent, activeTabId);
      
      // Sync VectorDB after deletion
      setIsSyncing(true);
      await aiApi.syncVectorDB();
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to delete note');
    } finally {
      setIsSaving(false);
      setIsSyncing(false);
    }
  };

  // Function to close tab
  const handleCloseTab = (e: React.MouseEvent, idToClose: string) => {
    e.stopPropagation();
    setOpenTabs(prevTabs => {
      const newTabs = prevTabs.filter(tab => tab.id !== idToClose);
      if (activeTabId === idToClose) {
        setActiveTabId(newTabs.length > 0 ? newTabs[newTabs.length - 1].id : '');
      }
      return newTabs;
    });
  };

  return (
    <div className="relative h-screen w-full flex bg-white text-gray-800 font-sans overflow-hidden">
      {error && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-red-50 text-red-600 px-4 py-2 rounded-md shadow-sm border border-red-200 flex items-center gap-3">
          <span className="text-sm font-medium">{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-700">&times;</button>
        </div>
      )}

      <Sidebar 
        notes={notes}
        isLoadingNotes={isLoadingNotes}
        activeTabId={activeTabId}
        handleOpenFile={handleOpenFile}
        handleNewNote={handleNewNote}
      />
      
      <Editor 
        openTabs={openTabs}
        activeTabId={activeTabId}
        setActiveTabId={setActiveTabId}
        handleCloseTab={handleCloseTab}
        handleNewNote={handleNewNote}
        viewMode={viewMode}
        setViewMode={setViewMode}
        isLoadingContent={isLoadingContent}
        tabContents={noteContentsById}  // Component prop remains unchanged
        handleContentChange={handleContentChange}
        handleSaveNote={handleSaveNote}
        handleDeleteNote={handleDeleteNote}
        handleTitleChange={handleTitleChange}
        isSaving={isSaving}
        isSyncing={isSyncing}
      />

      <Chat activeTabId={activeTabId} openTabs={openTabs} />
    </div>
  );
}

