import { FileText, Network, X } from 'lucide-react';
import { Tab } from '../types';

interface EditorProps {
  openTabs: Tab[];
  activeTabId: string;
  setActiveTabId: (id: string) => void;
  handleCloseTab: (e: React.MouseEvent, id: string) => void;
  handleNewNote: () => void;
  viewMode: 'editor' | 'graph';
  setViewMode: (mode: 'editor' | 'graph') => void;
  isLoadingContent: boolean;
  tabContents: Record<string, string>;
  handleContentChange: (content: string) => void;
  handleSaveNote: () => void;
  handleDeleteNote: () => void;
  handleTitleChange: (id: string, newTitle: string) => void;
  isSaving: boolean;
  isSyncing: boolean;
}

export default function Editor(props: EditorProps) {
  const {
    openTabs,
    activeTabId,
    setActiveTabId,
    handleCloseTab,
    handleNewNote,
    viewMode,
    setViewMode,
    isLoadingContent,
    tabContents,
    handleContentChange,
    handleSaveNote,
    handleDeleteNote,
    handleTitleChange,
    isSaving,
    isSyncing
  } = props;

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-gray-50/30">
      {/* Top Header of Main Area (Tabs Bar) */}
      <div className="h-10 border-b border-gray-200 flex bg-gray-100/50 shrink-0 overflow-x-auto overflow-y-hidden">
        {openTabs.map(tab => (
          <div 
            key={tab.id}
            onClick={() => setActiveTabId(tab.id)}
            className={`group flex items-center gap-1.5 px-3 min-w-32 max-w-xs border-r border-gray-200 cursor-pointer transition-colors
              ${activeTabId === tab.id ? 'bg-white border-t-2 border-t-blue-500 text-gray-800' : 'bg-transparent border-t-2 border-t-transparent text-gray-500 hover:bg-gray-100'}
            `}
          >
              <FileText size={14} className={activeTabId === tab.id ? 'text-blue-500' : 'text-gray-400'} />
              <span className="text-sm truncate select-none flex-1 font-medium">{tab.title}</span>
              <button 
                onClick={(e) => handleCloseTab(e, tab.id)}
                className={`p-0.5 rounded hover:bg-gray-200 ${activeTabId === tab.id ? 'text-gray-400' : 'text-transparent group-hover:text-gray-400'} transition-all`}
              >
                <X size={14} />
              </button>
          </div>
        ))}
      </div>

      {/* Action Toolbar */}
      <div className="h-12 border-b border-gray-200 flex items-center px-4 justify-between bg-white shrink-0 shadow-sm z-10">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-700">
            {openTabs.find(t => t.id === activeTabId)?.title || "No file selected"}
          </span>
        </div>
        
        {/* Tabs: Editor vs Graph */}
        {openTabs.length > 0 && (
          <div className="flex bg-gray-100 p-1 rounded-lg">
            <button 
              onClick={() => setViewMode('editor')}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${viewMode === 'editor' ? 'bg-white shadow-sm text-blue-600 font-medium' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Editor
            </button>
            <button 
              onClick={() => setViewMode('graph')}
              className={`px-3 py-1 flex items-center gap-1.5 text-sm rounded-md transition-colors ${viewMode === 'graph' ? 'bg-white shadow-sm text-blue-600 font-medium' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <Network size={14} /> Graph
            </button>
          </div>
        )}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-auto bg-white">
        {openTabs.length === 0 ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 gap-4 bg-gray-50">
            <FileText size={48} className="text-gray-300" />
            <p>No file is open.</p>
            <button onClick={handleNewNote} className="mt-2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition">Create New Note</button>
          </div>
        ) : viewMode === 'editor' ? (
          <div className="h-full flex flex-col mx-auto w-full max-w-4xl p-6 lg:p-10">
            <div className="flex items-center justify-between mb-6">
              <input
                className="flex-1 text-3xl font-bold text-gray-900 tracking-tight px-1 outline-none focus:ring-2 focus:ring-blue-100 rounded-md transition-all bg-transparent disabled:opacity-75"
                value={openTabs.find(t => t.id === activeTabId)?.title || ''}
                onChange={(e) => handleTitleChange(activeTabId, e.target.value)}
                placeholder="Note Title"
              />
              <div className="flex gap-2 shrink-0">
                <button 
                  onClick={handleDeleteNote}
                  className="px-3 py-1.5 text-sm text-red-600 bg-red-50 hover:bg-red-100 rounded-md transition"
                >
                  Delete
                </button>
                <button 
                  onClick={handleSaveNote}
                  disabled={isSaving || isSyncing}
                  className="px-4 py-1.5 text-sm text-white bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 disabled:cursor-not-allowed rounded-md transition flex items-center gap-1.5"
                >
                  {isSaving ? 'Saving...' : isSyncing ? 'Syncing...' : 'Save & Sync'}
                </button>
              </div>
            </div>
            {isLoadingContent ? (
              <div className="text-gray-400 flex items-center justify-center flex-1">Loading content...</div>
            ) : (
              <textarea
                className="flex-1 w-full h-full resize-none p-1 outline-none text-gray-700 leading-relaxed text-lg bg-transparent border-none"
                value={tabContents[activeTabId] ?? ''}
                onChange={(e) => handleContentChange(e.target.value)}
                placeholder="Start typing your note here..."
              />
            )}
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50 text-gray-400 gap-4 border-t border-gray-100">
             <Network size={48} className="text-gray-300" />
             <p>Interactive Knowledge Graph will be rendered here...</p>
          </div>
        )}
      </div>
    </div>
  );
}
