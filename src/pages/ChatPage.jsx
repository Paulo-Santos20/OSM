import React, { useState, useEffect, useRef } from 'react';
import { collection, addDoc, query, orderBy, onSnapshot, getDocs, writeBatch } from 'firebase/firestore';
import { Camera, Send, Loader2, Bot, X, AlertTriangle, Trash2 } from 'lucide-react';
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
  
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isChatLoading]);

  // Carrega as mensagens com Memória (Cofre Seguro)
  useEffect(() => {
    if (!db || !activeTeamId || !user) return;
    setMessages([]);
    
    const q = query(collection(db, "users", user.uid, `chats_${activeTeamId}`), orderBy("timestamp", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMessages(msgs);
    });
    
    return () => unsubscribe();
  }, [activeTeamId, user]);

  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const pastedImages = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        pastedImages.push(items[i].getAsFile());
      }
    }
    if (pastedImages.length > 0) {
      setSelectedImages(prev => [...prev, ...pastedImages]);
      e.preventDefault(); 
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedImages(prev => [...prev, ...Array.from(e.target.files)]);
    }
    e.target.value = null; 
  };

  const removeImage = (indexToRemove) => {
    setSelectedImages(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  const clearChatHistory = async () => {
    if (!window.confirm(`Deseja apagar todo o histórico de conversas do ${activeTeamName}?`)) return;
    setIsCleaning(true);
    const cleaningToast = toast.loading("Limpando histórico...");
    try {
      const chatRef = collection(db, "users", user.uid, `chats_${activeTeamId}`);
      const snapshot = await getDocs(chatRef);
      const batch = writeBatch(db);
      snapshot.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
      toast.success("Histórico limpo com sucesso!", { id: cleaningToast });
    } catch (error) {
      toast.error("Erro ao limpar o chat.", { id: cleaningToast });
    } finally {
      setIsCleaning(false);
    }
  };

  // ==========================================
  // FUNÇÃO DE BACKUP: GROQ / LLAMA 3.2 VISION
  // ==========================================
  const chatWithBackupAI = async (chatHistory, currentPrompt, base64ImagesArray, systemPrompt) => {
    const groqApiKey = import.meta.env.VITE_GROQ_API_KEY;
    if (!groqApiKey) throw new Error("Chave do Groq não configurada.");

    const mappedMessages = [
      { role: "system", content: systemPrompt },
      ...chatHistory.map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.text || (msg.imageCount ? `[${msg.imageCount} Imagem(ns) enviada(s) anteriormente]` : "")
      }))
    ];

    const currentContent = [];
    if (currentPrompt) currentContent.push({ type: "text", text: currentPrompt });
    
    if (base64ImagesArray && base64ImagesArray.length > 0) {
      base64ImagesArray.forEach(b64 => {
        // Groq/Llama Vision aceita base64 via URL scheme
        currentContent.push({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${b64}` } });
      });
    }

    mappedMessages.push({ role: "user", content: currentContent });

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${groqApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.2-11b-vision-preview", // Modelo suportado para Visão no Groq
        messages: mappedMessages,
        temperature: 0.1,
        max_tokens: 4096
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(`Groq API falhou: ${errorData?.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  };

  // ==========================================
  // HANDLER PRINCIPAL DE MENSAGENS
  // ==========================================
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if ((!inputText.trim() && selectedImages.length === 0) || !db || !activeTeamId || !user) return;

    setIsChatLoading(true);
    const userMessageText = inputText.trim();
    const userMessage = { text: userMessageText, sender: 'user', imageCount: selectedImages.length, timestamp: new Date() };
    
    try {
      await addDoc(collection(db, "users", user.uid, `chats_${activeTeamId}`), userMessage);

      const currentTeamContext = JSON.stringify(teamData);
      const systemPrompt = buildSystemPrompt(currentTeamContext);

      let base64Images = [];
      let promptToSend = userMessageText;

      // Auto-Prompt Inteligente se houver imagens
      if (selectedImages.length > 0) {
        base64Images = await Promise.all(selectedImages.map(img => compressImageToBase64(img)));
        
        if (!promptToSend) {
          promptToSend = `Analise estas imagens do meu próximo jogo. O OVR do meu time é exato ${teamData.teamOvr || 0}.
Cruze a diferença do meu OVR com o do adversário, detecte a tática dele e me forneça a estratégia completa seguindo rigorosamente a estrutura do seu manual.`;
        }
      }

      // Preparando a Memória
      const chatHistory = messages.map(msg => ({
        text: msg.text,
        sender: msg.sender,
        imageCount: msg.imageCount || (msg.hasImage ? 1 : 0) 
      }));

      let aiResponseText = "";

      try {
        if (!ai) throw new Error("Gemini não configurado");

        // Formatando histórico para o Gemini
        const geminiHistory = chatHistory.map(msg => ({
          role: msg.sender === 'user' ? 'user' : 'model',
          parts: [{ text: msg.text || (msg.imageCount ? `[${msg.imageCount} Imagem(ns) do adversário analisada(s)]` : "") }]
        }));

        const currentParts = [];
        base64Images.forEach(b64 => {
          currentParts.push({ inlineData: { data: b64, mimeType: 'image/jpeg' } });
        });
        currentParts.push({ text: promptToSend });

        const finalContents = [ ...geminiHistory, { role: 'user', parts: currentParts } ];

        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: finalContents,
          config: { systemInstruction: systemPrompt, temperature: 0.1 } 
        });

        aiResponseText = response.text;
      } catch (geminiError) {
        console.warn("⚠️ Gemini ocupado. Acionando auxiliar Groq...", geminiError);
        const loadingId = toast.loading("Acionando assistente de backup (Groq)...");
        
        // Chamada para o Groq Fallback
        aiResponseText = await chatWithBackupAI(chatHistory, promptToSend, base64Images, systemPrompt);
        
        toast.success("Análise concluída pelo Backup!", { id: loadingId });
      }

      // Salvando a resposta
      await addDoc(collection(db, "users", user.uid, `chats_${activeTeamId}`), { 
        text: aiResponseText, 
        sender: 'ai', 
        timestamp: new Date() 
      });

    } catch (error) {
      console.error(error);
      toast.error("Falha ao analisar a tática.");
      await addDoc(collection(db, "users", user.uid, `chats_${activeTeamId}`), { 
        text: "Desculpe, professor. Ocorreu um erro ao processar os dados táticos. Pode enviar novamente?", 
        sender: 'ai', 
        timestamp: new Date() 
      });
    } finally {
      setInputText('');
      setSelectedImages([]); 
      setIsChatLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full w-full relative min-h-0 bg-slate-950">
      
      <div className="flex items-center justify-between px-6 py-2 border-b border-slate-800/50 bg-slate-950/50 backdrop-blur-sm z-10">
        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Sala de Preleção</span>
        {messages.length > 0 && (
          <button onClick={clearChatHistory} disabled={isCleaning} className="flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-red-400 transition-colors p-2 rounded-lg hover:bg-red-500/10">
            {isCleaning ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Limpar
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-56 space-y-6 scrollbar-thin scrollbar-thumb-slate-800">
        {messages.length === 0 && (
          <div className="text-center mt-20 animate-fade-in">
            <div className="bg-slate-800 border border-slate-700 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Bot size={32} className="text-blue-400" />
            </div>
            <h3 className="text-xl font-bold text-slate-200">Pronto para treinar o {activeTeamName}</h3>
            <p className="text-slate-400 mt-2 text-sm max-w-sm mx-auto">
              Cole os prints (Ctrl+V) do confronto (com OVR e árbitro) e da formação do adversário aqui. Cruzarei a força dele com a do nosso time para desenhar a tática perfeita.
            </p>
          </div>
        )}
        
        {messages.map((msg) => {
          const count = msg.imageCount || (msg.hasImage ? 1 : 0);
          return (
            <div key={msg.id} className={`flex gap-4 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.sender === 'ai' && (
                <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center flex-shrink-0 mt-1 shadow-sm">
                  <Bot size={18} className="text-blue-400" />
                </div>
              )}
              
              <div className={`max-w-[85%] sm:max-w-[80%] rounded-2xl p-4 text-[15px] leading-relaxed shadow-md ${msg.sender === 'user' ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-sm'}`}>
                {count > 0 && (
                  <div className="mb-3 text-xs font-semibold text-blue-300 flex items-center gap-1.5">
                    <Camera size={14}/> {count > 1 ? `${count} Imagens Analisadas` : 'Imagem Analisada'}
                  </div>
                )}
                
                <div className="markdown-body space-y-3">
                  <ReactMarkdown
                    components={{
                      p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
                      strong: ({node, ...props}) => <strong className="font-bold text-blue-300" {...props} />,
                      ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-2 space-y-1 marker:text-slate-500" {...props} />,
                      ol: ({node, ...props}) => <ol className="list-decimal pl-5 mb-2 space-y-1 marker:text-slate-500" {...props} />,
                      li: ({node, ...props}) => <li className="pl-1" {...props} />,
                      h1: ({node, ...props}) => <h1 className="text-lg font-bold text-slate-100 mt-5 mb-2 border-b border-slate-700 pb-2" {...props} />,
                      h2: ({node, ...props}) => <h2 className="text-base font-bold text-slate-200 mt-4 mb-2" {...props} />,
                      h3: ({node, ...props}) => <h3 className="text-sm font-bold text-slate-300 mt-3 mb-1 uppercase tracking-wider" {...props} />
                    }}
                  >
                    {msg.text}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          );
        })}
        
        {isChatLoading && (
          <div className="flex gap-4 justify-start animate-pulse">
            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center flex-shrink-0">
              <Bot size={18} className="text-blue-400" />
            </div>
            <div className="flex items-center gap-2 text-slate-400 text-sm py-2">
              <Loader2 className="animate-spin" size={16} /> Analisando prancheta e definindo tática...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-slate-950 via-slate-950 to-transparent pt-12 pb-6 px-4 pointer-events-none z-20">
        <div className="max-w-3xl mx-auto w-full pointer-events-auto flex flex-col items-start">
          
          {selectedImages.length > 0 && (
            <div className="mb-3 ml-2 flex flex-wrap gap-3 animate-fade-in">
              {selectedImages.map((img, idx) => (
                <div key={idx} className="relative group rounded-xl overflow-hidden border-2 border-slate-700 shadow-xl bg-slate-800 h-24 w-24 flex-shrink-0">
                  <img src={URL.createObjectURL(img)} alt={`Preview ${idx + 1}`} className="h-full w-full object-cover opacity-90 transition-opacity group-hover:opacity-100" />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                    <button type="button" onClick={() => removeImage(idx)} className="bg-red-500 hover:bg-red-600 text-white p-1.5 rounded-full shadow-md transition-transform hover:scale-110">
                      <X size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {(!teamData || teamData.teamOvr === 0) && (
            <div className="mb-3 w-full bg-yellow-900/30 border border-yellow-700/50 text-yellow-400 text-[13px] px-4 py-3 rounded-xl flex items-center gap-3 animate-fade-in shadow-md">
              <AlertTriangle size={20} className="flex-shrink-0" />
              <span>Para eu gerar a tática perfeita, vá primeiro na aba <strong>Escalação</strong> e defina o seu time!</span>
            </div>
          )}

          <form onSubmit={handleSendMessage} className="w-full bg-slate-900 focus-within:bg-slate-800 transition-all rounded-3xl p-2 flex items-end gap-2 shadow-2xl border border-slate-700 focus-within:border-blue-500/50">
            <input type="file" accept="image/*" multiple className="hidden" ref={fileInputRef} onChange={handleFileChange} />
            <button type="button" onClick={() => fileInputRef.current.click()} className="p-3 text-slate-400 hover:text-white hover:bg-slate-700 rounded-full transition-colors flex-shrink-0">
              <Camera size={22} />
            </button>
            <textarea 
              value={inputText} 
              onChange={(e) => setInputText(e.target.value)} 
              onPaste={handlePaste} 
              onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(e); } }} 
              placeholder={selectedImages.length > 0 ? "Pressione Enter para analisar as imagens..." : "Cole as fotos (Ctrl+V) ou digite sua dúvida..."} 
              className="flex-1 bg-transparent border-none px-2 py-3 text-[15px] max-h-32 resize-none outline-none text-slate-100 placeholder:text-slate-500 custom-scrollbar" 
              rows={1} 
            />
            <button 
              type="submit" 
              disabled={(!inputText.trim() && selectedImages.length === 0) || isChatLoading || !activeTeamId || !teamData || teamData.teamOvr === 0} 
              className="p-3 bg-blue-600 text-white rounded-full hover:bg-blue-500 transition-colors disabled:opacity-30 disabled:hover:bg-blue-600 flex-shrink-0 shadow-md"
            >
              <Send size={20} className="ml-0.5" />
            </button>
          </form>

        </div>
      </div>
    </div>
  );
}