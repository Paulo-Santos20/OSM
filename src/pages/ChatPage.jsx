import React, { useState, useEffect, useRef } from 'react';
import { collection, addDoc, query, orderBy, onSnapshot } from 'firebase/firestore';
import { Camera, Send, Loader2, Bot, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { db } from '../config/firebase';
import { ai } from '../config/gemini';
import { fileToBase64 } from '../utils/helpers';
import { buildSystemPrompt } from '../aiCoach';

export default function ChatPage({ activeTeamId, activeTeamName, teamData }) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [isChatLoading, setIsChatLoading] = useState(false);
  
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // Scroll automático para a última mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isChatLoading]); // Adicionado isChatLoading para rolar quando o "Consultando..." aparecer

  // Carrega histórico do Firebase
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

  // ==========================================
  // FUNÇÃO: CAPTURAR COLAR (CTRL + V)
  // ==========================================
  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        setSelectedImage(file);
        // Previne que a imagem seja colada como texto/base64 gigante no textarea
        e.preventDefault(); 
        break;
      }
    }
  };

  // ==========================================
  // FUNÇÃO: ENVIAR MENSAGEM PARA A IA
  // ==========================================
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if ((!inputText.trim() && !selectedImage) || !db) return;

    setIsChatLoading(true);
    const userMessage = { text: inputText, sender: 'user', hasImage: !!selectedImage, timestamp: new Date() };
    await addDoc(collection(db, `chats_${activeTeamId}`), userMessage);

    try {
      const currentTeamContext = JSON.stringify(teamData);
      const systemPrompt = buildSystemPrompt(currentTeamContext);

      const contents = [];
      if (selectedImage) {
        contents.push({ inlineData: { data: await fileToBase64(selectedImage), mimeType: selectedImage.type } });
      }
      contents.push(inputText || "Qual a melhor tática contra esse adversário?");

      // Dispara a requisição para o modelo
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: contents,
        config: { systemInstruction: systemPrompt, temperature: 0.2 } 
      });

      await addDoc(collection(db, `chats_${activeTeamId}`), { text: response.text, sender: 'ai', timestamp: new Date() });
    } catch (error) {
      console.error(error);
      toast.error("Falha ao analisar a tática.");
      await addDoc(collection(db, `chats_${activeTeamId}`), { text: "Erro de conexão com o Treinador IA.", sender: 'ai', timestamp: new Date() });
    } finally {
      setInputText('');
      setSelectedImage(null);
      setIsChatLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full relative">
      
      {/* ÁREA DE MENSAGENS */}
      <div className="flex-1 overflow-y-auto p-4 pb-40 space-y-6">
        {messages.length === 0 && (
          <div className="text-center mt-20">
            <div className="bg-slate-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"><Bot size={32} className="text-blue-500" /></div>
            <h3 className="text-xl font-semibold text-slate-800">Pronto para treinar o {activeTeamName}</h3>
            <p className="text-slate-500 mt-2">Cole o print do adversário (Ctrl+V) ou pergunte algo.</p>
          </div>
        )}
        
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-4 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.sender === 'ai' && <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-1"><Bot size={18} className="text-blue-600" /></div>}
            <div className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-4 text-sm leading-relaxed shadow-sm ${msg.sender === 'user' ? 'bg-slate-100 text-slate-900 rounded-tr-sm' : 'bg-transparent text-slate-800 border border-slate-100'}`}>
              {msg.hasImage && <div className="mb-2 text-xs font-semibold text-blue-600 flex items-center gap-1"><Camera size={14}/> Imagem Analisada</div>}
              <div className="whitespace-pre-wrap">{msg.text}</div>
            </div>
          </div>
        ))}
        
        {isChatLoading && (
          <div className="flex gap-4 justify-start animate-pulse">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0"><Bot size={18} className="text-blue-600" /></div>
            <div className="flex items-center gap-2 text-slate-500 text-sm py-2"><Loader2 className="animate-spin" size={16} /> Consultando a prancheta tática...</div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ÁREA DE INPUT FLUTUANTE */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-white via-white to-transparent pt-10 pb-6 px-4 pointer-events-none">
        <div className="max-w-3xl mx-auto w-full pointer-events-auto flex flex-col items-start">
          
          {/* PREVIEW DA IMAGEM ANEXADA */}
          {selectedImage && (
            <div className="mb-3 ml-2 relative group animate-fade-in">
              <div className="relative rounded-2xl overflow-hidden border-4 border-white shadow-lg bg-slate-100">
                <img 
                  src={URL.createObjectURL(selectedImage)} 
                  alt="Preview do anexo" 
                  className="h-28 w-auto object-cover opacity-90 transition-opacity group-hover:opacity-100"
                />
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                  <button 
                    type="button"
                    onClick={() => setSelectedImage(null)} 
                    className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-full transform transition-transform hover:scale-110 shadow-md"
                    title="Remover imagem"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* FORMULÁRIO DE ENVIO */}
          <form onSubmit={handleSendMessage} className="w-full bg-slate-100 focus-within:bg-slate-200 transition-colors rounded-3xl p-2 flex items-end gap-2 shadow-sm border border-slate-200">
            <input 
              type="file" 
              accept="image/*" 
              className="hidden" 
              ref={fileInputRef} 
              onChange={(e) => {
                if(e.target.files[0]) setSelectedImage(e.target.files[0]);
                e.target.value = null; // Reseta o input para poder selecionar a mesma imagem de novo
              }} 
            />
            
            <button 
              type="button" 
              onClick={() => fileInputRef.current.click()} 
              className="p-3 text-slate-500 hover:text-slate-800 hover:bg-slate-300/50 rounded-full transition-colors flex-shrink-0"
            >
              <Camera size={22} />
            </button>
            
            <textarea 
              value={inputText} 
              onChange={(e) => setInputText(e.target.value)} 
              onPaste={handlePaste} // <--- EVENTO DE COLAR ADICIONADO AQUI
              onKeyDown={(e) => { 
                if(e.key === 'Enter' && !e.shiftKey) { 
                  e.preventDefault(); 
                  handleSendMessage(e); 
                } 
              }} 
              placeholder="Cole uma imagem (Ctrl+V) ou digite sua pergunta..." 
              className="flex-1 bg-transparent border-none px-2 py-3 text-[15px] max-h-32 resize-none outline-none text-slate-800 placeholder:text-slate-500" 
              rows={1} 
            />
            
            <button 
              type="submit" 
              disabled={(!inputText.trim() && !selectedImage) || isChatLoading} 
              className="p-3 bg-slate-800 text-white rounded-full hover:bg-slate-700 transition-colors disabled:opacity-30 flex-shrink-0 shadow-md"
            >
              <Send size={20} className="ml-0.5" />
            </button>
          </form>

        </div>
      </div>
    </div>
  );
}