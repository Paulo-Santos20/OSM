import React, { useState, useEffect, useRef } from 'react';
import { collection, addDoc, query, orderBy, onSnapshot } from 'firebase/firestore';
import { Camera, Send, Loader2, Bot, X } from 'lucide-react';
import toast from 'react-hot-toast';
import ReactMarkdown from 'react-markdown'; // <--- IMPORTAÇÃO NOVA
import { db } from '../config/firebase';
import { ai } from '../config/gemini';
import { compressImageToBase64 } from '../utils/helpers';
import { buildSystemPrompt } from '../aiCoach';

export default function ChatPage({ activeTeamId, activeTeamName, teamData }) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [isChatLoading, setIsChatLoading] = useState(false);
  
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isChatLoading]);

  useEffect(() => {
    if (!db || !activeTeamId) return;
    setMessages([]);
    const q = query(collection(db, `chats_${activeTeamId}`), orderBy("timestamp", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMessages(msgs);
    });
    return () => unsubscribe();
  }, [activeTeamId]);

  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        setSelectedImage(file);
        e.preventDefault(); 
        break;
      }
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if ((!inputText.trim() && !selectedImage) || !db || !activeTeamId) return;

    setIsChatLoading(true);
    const userMessage = { text: inputText, sender: 'user', hasImage: !!selectedImage, timestamp: new Date() };
    await addDoc(collection(db, `chats_${activeTeamId}`), userMessage);

    try {
      const currentTeamContext = JSON.stringify(teamData);
      const systemPrompt = buildSystemPrompt(currentTeamContext);

      const contents = [];
      if (selectedImage) {
        contents.push({ inlineData: { data: await compressImageToBase64(selectedImage), mimeType: 'image/jpeg' } });
      }
      contents.push(inputText || "Qual a melhor tática contra esse adversário?");

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: contents,
        config: { systemInstruction: systemPrompt, temperature: 0.2 } 
      });

      await addDoc(collection(db, `chats_${activeTeamId}`), { text: response.text, sender: 'ai', timestamp: new Date() });
    } catch (error) {
      toast.error("Falha ao analisar a tática.");
      await addDoc(collection(db, `chats_${activeTeamId}`), { text: "Erro de conexão com o Treinador IA.", sender: 'ai', timestamp: new Date() });
    } finally {
      setInputText('');
      setSelectedImage(null);
      setIsChatLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full w-full relative min-h-0">
      <div className="flex-1 overflow-y-auto p-4 pb-40 space-y-6 scrollbar-thin scrollbar-thumb-slate-800">
        {messages.length === 0 && (
          <div className="text-center mt-20">
            <div className="bg-slate-800 border border-slate-700 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"><Bot size={32} className="text-blue-400" /></div>
            <h3 className="text-xl font-semibold text-slate-200">Pronto para treinar o {activeTeamName}</h3>
            <p className="text-slate-400 mt-2">Cole o print do adversário (Ctrl+V) ou pergunte algo.</p>
          </div>
        )}
        
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-4 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.sender === 'ai' && <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center flex-shrink-0 mt-1"><Bot size={18} className="text-blue-400" /></div>}
            
            <div className={`max-w-[85%] sm:max-w-[80%] rounded-2xl p-4 text-[15px] leading-relaxed shadow-sm ${msg.sender === 'user' ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-slate-800 border border-slate-700 text-slate-200 rounded-tl-sm'}`}>
              {msg.hasImage && <div className="mb-3 text-xs font-semibold text-blue-300 flex items-center gap-1"><Camera size={14}/> Imagem Analisada</div>}
              
              {/* RENDERIZADOR DE MARKDOWN CUSTOMIZADO PARA TEMA DARK */}
              <div className="markdown-body space-y-3">
                <ReactMarkdown
                  components={{
                    p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
                    strong: ({node, ...props}) => <strong className="font-bold text-blue-300" {...props} />, // Negritos ganham um azul destacando
                    ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-2 space-y-1 marker:text-slate-500" {...props} />,
                    ol: ({node, ...props}) => <ol className="list-decimal pl-5 mb-2 space-y-1 marker:text-slate-500" {...props} />,
                    li: ({node, ...props}) => <li className="pl-1" {...props} />,
                    h1: ({node, ...props}) => <h1 className="text-lg font-bold text-slate-100 mt-4 mb-2 border-b border-slate-700 pb-1" {...props} />,
                    h2: ({node, ...props}) => <h2 className="text-base font-bold text-slate-200 mt-4 mb-2" {...props} />,
                    h3: ({node, ...props}) => <h3 className="text-sm font-bold text-slate-300 mt-3 mb-1 uppercase tracking-wider" {...props} />
                  }}
                >
                  {msg.text}
                </ReactMarkdown>
              </div>

            </div>
          </div>
        ))}
        
        {isChatLoading && (
          <div className="flex gap-4 justify-start animate-pulse">
            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center flex-shrink-0"><Bot size={18} className="text-blue-400" /></div>
            <div className="flex items-center gap-2 text-slate-400 text-sm py-2"><Loader2 className="animate-spin" size={16} /> Analisando prancheta tática...</div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* INPUT INFERIOR (MANTIDO IGUAL) */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-slate-950 via-slate-950 to-transparent pt-10 pb-6 px-4 pointer-events-none">
        <div className="max-w-3xl mx-auto w-full pointer-events-auto flex flex-col items-start">
          
          {selectedImage && (
            <div className="mb-3 ml-2 relative group animate-fade-in">
              <div className="relative rounded-2xl overflow-hidden border-2 border-slate-700 shadow-lg bg-slate-800">
                <img src={URL.createObjectURL(selectedImage)} alt="Preview" className="h-28 w-auto object-cover opacity-90 transition-opacity group-hover:opacity-100" />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                  <button onClick={() => setSelectedImage(null)} className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-full shadow-md"><X size={20} /></button>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSendMessage} className="w-full bg-slate-900 focus-within:bg-slate-800 transition-colors rounded-3xl p-2 flex items-end gap-2 shadow-lg border border-slate-700">
            <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={(e) => { if(e.target.files[0]) setSelectedImage(e.target.files[0]); e.target.value = null; }} />
            <button type="button" onClick={() => fileInputRef.current.click()} className="p-3 text-slate-400 hover:text-white hover:bg-slate-700 rounded-full transition-colors flex-shrink-0"><Camera size={22} /></button>
            <textarea value={inputText} onChange={(e) => setInputText(e.target.value)} onPaste={handlePaste} onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(e); } }} placeholder="Cole uma imagem (Ctrl+V) ou digite..." className="flex-1 bg-transparent border-none px-2 py-3 text-[15px] max-h-32 resize-none outline-none text-slate-100 placeholder:text-slate-500" rows={1} />
            <button type="submit" disabled={(!inputText.trim() && !selectedImage) || isChatLoading || !activeTeamId} className="p-3 bg-blue-600 text-white rounded-full hover:bg-blue-500 transition-colors disabled:opacity-30 disabled:hover:bg-blue-600 flex-shrink-0 shadow-md"><Send size={20} className="ml-0.5" /></button>
          </form>

        </div>
      </div>
    </div>
  );
}