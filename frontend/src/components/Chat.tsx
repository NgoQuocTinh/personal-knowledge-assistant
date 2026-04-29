import { MessageSquare, Send, CheckSquare, Loader2, RefreshCw } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { Tab, ChatMessage } from '../types';
import { aiApi } from '../services/aiApi';

interface ChatProps {
  activeTabId: string;
  openTabs: Tab[];
}

export default function Chat({ activeTabId, openTabs }: ChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([{
    id: '1',
    role: 'assistant',
    content: 'Hi! I\'m your local AI. I have access to your knowledge base. How can I help you today?'
  }]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [groundWithOpenFiles, setGroundWithOpenFiles] = useState(true);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    const activeTab = openTabs.find(t => t.id === activeTabId);
    let selectedFiles: string[] | undefined = undefined;
    
    // NotebookLLM style: pass currently viewing file as context
    if (groundWithOpenFiles && activeTab) {
      selectedFiles = [`${activeTab.title}.md`];
    }

    try {
      const tempId = (Date.now() + 1).toString();
      setMessages(prev => [...prev, { id: tempId, role: 'assistant', content: '', isLoading: true }]);

      const res = await aiApi.chatWithAI(userMessage.content, selectedFiles);

      setMessages(prev => prev.map(msg => 
        msg.id === tempId ? {
          ...msg,
          content: res.answer,
          sources: res.sources,
          isLoading: false
        } : msg
      ));
    } catch (err: unknown) {
      console.error(err);
      setMessages(prev => prev.map(msg => 
        msg.isLoading ? {
          ...msg,
          content: 'Sorry, I encountered an error answering your request. Please ensure the backend is running.',
          isLoading: false
        } : msg
      ));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClearChat = () => {
    setMessages([{
      id: Date.now().toString(),
      role: 'assistant',
      content: 'Conversation history cleared. How can I help you next?'
    }]);
  };

  return (
    <div className="w-80 lg:w-[400px] border-l border-gray-200 flex flex-col bg-gray-50/50 shrink-0">
      <div className="h-14 border-b border-gray-200 flex items-center justify-between px-4 gap-2 bg-white shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare size={18} className="text-blue-500" />
          <span className="font-semibold text-gray-700">AI Assistant</span>
        </div>
        <button 
          onClick={handleClearChat}
          className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-md"
          title="Clear Chat"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {openTabs.length > 0 && (
        <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 flex items-center justify-between shadow-sm shrink-0">
          <div className="flex items-center gap-2 cursor-pointer select-none" onClick={() => setGroundWithOpenFiles(!groundWithOpenFiles)}>
            <div className={`w-4 h-4 rounded-sm flex items-center justify-center border ${groundWithOpenFiles ? 'bg-blue-500 border-blue-500' : 'bg-white border-gray-300'}`}>
              {groundWithOpenFiles && <CheckSquare size={12} className="text-white" />}
            </div>
            <span className="text-xs text-slate-700 font-medium">Ground with current file</span>
          </div>
        </div>
      )}
      
      {/* Chat History */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {messages.map(msg => (
          <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div 
              className={`p-3.5 rounded-lg border text-sm leading-relaxed whitespace-pre-wrap max-w-[90%]
                ${msg.role === 'user' 
                  ? 'bg-blue-600 border-blue-700 text-white shadow-sm' 
                  : 'bg-white border-gray-200 shadow-sm text-gray-700'
                }`}
            >
              {msg.isLoading ? (
                <div className="flex items-center gap-2 text-gray-500">
                  <Loader2 size={14} className="animate-spin" /> Thinking...
                </div>
              ) : (
                msg.content
              )}
            </div>
            
            {msg.sources && msg.sources.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1 max-w-[90%]">
                <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mr-1 mt-0.5">Sources:</span>
                {msg.sources.map((src, idx) => (
                  <span key={idx} className="px-1.5 py-0.5 bg-gray-100 text-gray-500 text-[10px] rounded border border-gray-200">
                    {src}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Chat Input Box */}
      <div className="p-4 bg-white border-t border-gray-200 shrink-0">
        <div className="relative">
          <textarea 
            rows={3}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isLoading ? "AI is typing..." : "Ask about your notes... (Shift+Enter for newline)"}
            disabled={isLoading}
            className="w-full p-3 pr-10 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none disabled:bg-gray-50 disabled:text-gray-400"
          />
          <button 
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="absolute bottom-3 right-3 text-blue-500 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 p-1.5 rounded-md transition-colors disabled:opacity-50 disabled:hover:bg-blue-50 disabled:hover:text-blue-500"
          >
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
}
