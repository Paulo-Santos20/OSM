// src/pages/ChatPage.jsx
import React, { useState, useEffect, useRef } from 'react';
import { collection, addDoc, query, orderBy, onSnapshot, getDocs, writeBatch, setDoc, doc, getDoc } from 'firebase/firestore';
import { Camera, Send, Loader2, Bot, X, AlertTriangle, Trash2, Target } from 'lucide-react';
import toast from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';
import { db } from '../config/firebase';
import { ai } from '../config/gemini';
import { compressImageToBase64 } from '../utils/helpers';
import { buildSystemPrompt } from '../aiCoach';

export default function ChatPage({ activeTeamId, activeTeamName, teamData, user }) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [selectedImages, setSelectedImages] = useState([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [dossiers, setDossiers] = useState([]);

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, isChatLoading]);

  useEffect(() => {
    if (!db || !activeTeamId || !user) return;
    setMessages([]);
    const q = query(collection(db, "users", user.uid, `chats_${activeTeamId}`), orderBy("timestamp", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [activeTeamId, user]);

  useEffect(() => {
    if (!db || !user || !activeTeamId) return;
    const q = query(collection(db, "users", user.uid, `rivals_${activeTeamId}`));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setDossiers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [user, activeTeamId]);

  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const pastedImages = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) pastedImages.push(items[i].getAsFile());
    }
    if (pastedImages.length > 0) { setSelectedImages(prev => [...prev, ...pastedImages]); e.preventDefault(); }
  };

  const clearChatHistory = async () => {
    if (!window.confirm(`Deseja apagar o histórico de conversas do ${activeTeamName}?`)) return;
    setIsCleaning(true);
    const cleaningToast = toast.loading("Limpando histórico...");
    try {
      const snapshot = await getDocs(collection(db, "users", user.uid, `chats_${activeTeamId}`));
      const batch = writeBatch(db);
      snapshot.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
      toast.success("Histórico limpo!", { id: cleaningToast });
    } catch (error) { toast.error("Erro ao limpar.", { id: cleaningToast }); } 
    finally { setIsCleaning(false); }
  };

  const chatWithBackupAI = async (chatHistory, currentPrompt, base64ImagesArray, systemPrompt) => {
    const groqApiKey = import.meta.env.VITE_GROQ_API_KEY;
    if (!groqApiKey) throw new Error("Chave do Groq não configurada.");

    const mappedMessages = [
      { role: "system", content: systemPrompt },
      ...chatHistory.map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.text || (msg.imageCount ? `[${msg.imageCount} Imagem(ns) enviada(s)]` : "")
      }))
    ];

    const currentContent = [];
    if (currentPrompt) currentContent.push({ type: "text", text: currentPrompt });
    
    if (base64ImagesArray && base64ImagesArray.length > 0) {
      base64ImagesArray.forEach(b64 => { currentContent.push({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${b64}` } }); });
    }
    mappedMessages.push({ role: "user", content: currentContent });

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST", headers: { "Authorization": `Bearer ${groqApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "llama-3.2-11b-vision-preview", messages: mappedMessages, temperature: 0.1, max_tokens: 4096 })
    });
    if (!response.ok) throw new Error(`Groq API falhou.`);
    const data = await response.json();
    return data.choices[0].message.content;
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if ((!inputText.trim() && selectedImages.length === 0) || !db || !activeTeamId || !user) return;
    setIsChatLoading(true);
    const userMessageText = inputText.trim();
    const userMessage = { text: userMessageText, sender: 'user', imageCount: selectedImages.length, timestamp: new Date() };
    
    try {
      await addDoc(collection(db, "users", user.uid, `chats_${activeTeamId}`), userMessage);

      const formattedDossiers = dossiers.map(d => `Rival: ${d.managerName} | Tática Preferida: ${d.formation} | Notas: ${d.notes || 'Sem notas'}`).join('\n');
      const currentTeamContext = JSON.stringify(teamData);
      const systemPrompt = buildSystemPrompt(currentTeamContext, formattedDossiers);

      let base64Images = []; let promptToSend = userMessageText;

      if (selectedImages.length > 0) {
        base64Images = await Promise.all(selectedImages.map(img => compressImageToBase64(img)));
        if (!promptToSend) promptToSend = `Analise estas imagens. Meu OVR é ${teamData.teamOvr}. Gere a tática e a extração de Scout Oculta.`;
      }

      const chatHistory = messages.map(msg => ({ role: msg.sender === 'user' ? 'user' : 'model', parts: [{ text: msg.text || (msg.imageCount ? `[${msg.imageCount} Imagens enviadas]` : "") }] }));
      const currentParts = base64Images.map(b64 => ({ inlineData: { data: b64, mimeType: 'image/jpeg' } }));
      currentParts.push({ text: promptToSend });
      const finalContents = [ ...chatHistory, { role: 'user', parts: currentParts } ];

      let aiResponseText = "";

      try {
        if (!ai) throw new Error("Gemini não configurado");
        const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: finalContents, config: { systemInstruction: systemPrompt, temperature: 0.1 } });
        aiResponseText = response.text;
      } catch (geminiError) {
        const loadingId = toast.loading("Acionando backup (Groq)...");
        aiResponseText = await chatWithBackupAI(messages.map(m=>({sender: m.sender, text: m.text, imageCount: m.imageCount})), promptToSend, base64Images, systemPrompt);
        toast.success("Análise concluída pelo Backup!", { id: loadingId });
      }

      const jsonRegex = /```json\n([\s\S]*?)\n```/;
      const match = aiResponseText.match(jsonRegex);
      
      if (match) {
        try {
          const extractedData = JSON.parse(match[1]);
          if (extractedData.isRivalData && extractedData.managerName !== 'Desconhecido') {
            const rivalId = extractedData.managerName.toLowerCase().replace(/[^a-z0-9]/g, '-');
            const rivalRef = doc(db, "users", user.uid, `rivals_${activeTeamId}`, rivalId);
            const existingRival = await getDoc(rivalRef);
            const existingNotes = existingRival.exists() ? existingRival.data().notes : "";

            await setDoc(rivalRef, { ...extractedData, notes: existingNotes, lastScouted: new Date().toISOString() }, { merge: true });
            toast.success(`Scout salvo! Rival: ${extractedData.managerName}`, { icon: '🕵️‍♂️' });
          }
        } catch (e) {}
        aiResponseText = aiResponseText.replace(match[0], '').trim();
      }

      await addDoc(collection(db, "users", user.uid, `chats_${activeTeamId}`), { text: aiResponseText, sender: 'ai', timestamp: new Date() });
    } catch (error) { toast.error("Falha ao analisar a tática."); } 
    finally { setInputText(''); setSelectedImages([]); setIsChatLoading(false); }
  };

  return (
    <div className="flex-1 flex flex-col h-full w-full relative min-h-0 bg-slate-950">
      <div className="flex items-center justify-between px-4 sm:px-6 py-2 border-b border-slate-800/50 bg-slate-950/50 backdrop-blur-sm z-30">
        <div className="flex items-center gap-4">
          <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-widest hidden sm:block">Preleção</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 ml-auto">
          <span className="text-[9px] sm:text-[10px] font-black text-red-500/80 bg-red-950/20 px-2 sm:px-3 py-1.5 rounded-lg border border-red-900/30 uppercase tracking-wider flex items-center gap-1 sm:gap-1.5">
            <Target size={12} /> Auto-Scout
          </span>
          {messages.length > 0 && (
            <button onClick={clearChatHistory} disabled={isCleaning} className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs font-semibold text-slate-500 hover:text-red-400 transition-colors p-1.5 sm:p-2 rounded-lg hover:bg-red-500/10">
              {isCleaning ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} <span className="hidden sm:block">Limpar</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 sm:p-4 pb-40 md:pb-56 space-y-4 sm:space-y-6 scrollbar-thin scrollbar-thumb-slate-800">
        {messages.length === 0 && (
          <div className="text-center mt-12 sm:mt-20 animate-fade-in px-4">
            <div className="bg-slate-800 border border-slate-700 w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Bot size={28} className="text-blue-400" />
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-slate-200">Pronto para treinar o {activeTeamName}</h3>
            <p className="text-slate-400 mt-2 text-xs sm:text-sm max-w-sm mx-auto">
              Cole os prints da formação do adversário. A IA criará a tática e salvará os dados dele no <strong>Dossiê de Rivais</strong>.
            </p>
          </div>
        )}
        
        {messages.map((msg) => {
          const count = msg.imageCount || (msg.hasImage ? 1 : 0);
          return (
            <div key={msg.id} className={`flex gap-2 sm:gap-4 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.sender === 'ai' && <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center flex-shrink-0 mt-1 shadow-sm"><Bot size={14} className="text-blue-400 sm:w-[18px] sm:h-[18px]" /></div>}
              <div className={`max-w-[90%] sm:max-w-[80%] rounded-2xl p-3 sm:p-4 text-sm sm:text-[15px] leading-relaxed shadow-md ${msg.sender === 'user' ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-sm'}`}>
                {count > 0 && <div className="mb-2 sm:mb-3 text-[10px] sm:text-xs font-semibold text-blue-300 flex items-center gap-1.5"><Camera size={12} className="sm:w-[14px] sm:h-[14px]"/> {count > 1 ? `${count} Imagens` : 'Imagem'}</div>}
                <div className="markdown-body space-y-2 sm:space-y-3">
                  <ReactMarkdown components={{
                      p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
                      strong: ({node, ...props}) => <strong className="font-bold text-blue-300" {...props} />,
                      ul: ({node, ...props}) => <ul className="list-disc pl-4 sm:pl-5 mb-2 space-y-1 marker:text-slate-500" {...props} />,
                      ol: ({node, ...props}) => <ol className="list-decimal pl-4 sm:pl-5 mb-2 space-y-1 marker:text-slate-500" {...props} />,
                      h1: ({node, ...props}) => <h1 className="text-base sm:text-lg font-bold text-slate-100 mt-4 sm:mt-5 mb-2 border-b border-slate-700 pb-2" {...props} />,
                      h2: ({node, ...props}) => <h2 className="text-sm sm:text-base font-bold text-slate-200 mt-3 sm:mt-4 mb-2" {...props} />,
                      h3: ({node, ...props}) => <h3 className="text-xs sm:text-sm font-bold text-slate-300 mt-2 sm:mt-3 mb-1 uppercase tracking-wider" {...props} />
                    }}>{msg.text}</ReactMarkdown>
                </div>
              </div>
            </div>
          );
        })}
        
        {isChatLoading && (
          <div className="flex gap-2 sm:gap-4 justify-start animate-pulse">
            <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center flex-shrink-0"><Bot size={14} className="text-blue-400 sm:w-[18px] sm:h-[18px]" /></div>
            <div className="flex items-center gap-2 text-slate-400 text-xs sm:text-sm py-1 sm:py-2"><Loader2 className="animate-spin" size={14} className="sm:w-4 sm:h-4" /> Espionando adversário...</div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-slate-950 via-slate-950 to-transparent pt-12 pb-safe px-3 sm:px-4 pointer-events-none z-20 pb-4 sm:pb-6">
        <div className="max-w-3xl mx-auto w-full pointer-events-auto flex flex-col items-start">
          {selectedImages.length > 0 && (
            <div className="mb-3 ml-1 sm:ml-2 flex flex-wrap gap-2 sm:gap-3 animate-fade-in">
              {selectedImages.map((img, idx) => (
                <div key={idx} className="relative group rounded-xl overflow-hidden border-2 border-slate-700 shadow-xl bg-slate-800 h-16 w-16 sm:h-24 sm:w-24 flex-shrink-0">
                  <img src={URL.createObjectURL(img)} alt={`Preview ${idx}`} className="h-full w-full object-cover opacity-90 transition-opacity group-hover:opacity-100" />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                    <button type="button" onClick={() => setSelectedImages(prev => prev.filter((_, i) => i !== idx))} className="bg-red-500 hover:bg-red-600 text-white p-1 sm:p-1.5 rounded-full shadow-md"><X size={14} className="sm:w-4 sm:h-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {(!teamData || teamData.teamOvr === 0) && (
            <div className="mb-2 sm:mb-3 w-full bg-yellow-900/30 border border-yellow-700/50 text-yellow-400 text-[11px] sm:text-[13px] px-3 sm:px-4 py-2 sm:py-3 rounded-xl flex items-center gap-2 sm:gap-3 animate-fade-in shadow-md"><AlertTriangle size={16} className="flex-shrink-0 sm:w-5 sm:h-5" /><span>Vá na aba <strong>Escalação</strong> e defina o seu time primeiro!</span></div>
          )}
          <form onSubmit={handleSendMessage} className="w-full bg-slate-900 focus-within:bg-slate-800 transition-all rounded-2xl sm:rounded-3xl p-1.5 sm:p-2 flex items-end gap-1.5 sm:gap-2 shadow-2xl border border-slate-700 focus-within:border-blue-500/50">
            <input type="file" accept="image/*" multiple className="hidden" ref={fileInputRef} onChange={(e) => { if(e.target.files) setSelectedImages(prev => [...prev, ...Array.from(e.target.files)]); e.target.value=null;}} />
            <button type="button" onClick={() => fileInputRef.current.click()} className="p-2 sm:p-3 text-slate-400 hover:text-white hover:bg-slate-700 rounded-full transition-colors flex-shrink-0"><Camera size={20} className="sm:w-[22px] sm:h-[22px]" /></button>
            <textarea value={inputText} onChange={(e) => setInputText(e.target.value)} onPaste={handlePaste} onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey) handleSendMessage(e); }} placeholder="Analisar imagens ou rival..." className="flex-1 bg-transparent border-none px-1 sm:px-2 py-2 sm:py-3 text-base md:text-[15px] max-h-24 sm:max-h-32 resize-none outline-none text-slate-100 placeholder:text-slate-500 custom-scrollbar" rows={1} />
            <button type="submit" disabled={(!inputText.trim() && selectedImages.length === 0) || isChatLoading || !activeTeamId || !teamData || teamData.teamOvr === 0} className="p-2 sm:p-3 bg-blue-600 text-white rounded-full hover:bg-blue-500 transition-colors disabled:opacity-30 disabled:hover:bg-blue-600 flex-shrink-0 shadow-md"><Send size={18} className="sm:w-5 sm:h-5 ml-0.5" /></button>
          </form>
        </div>
      </div>
    </div>
  );
}