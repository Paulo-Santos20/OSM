import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, query, orderBy, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { GoogleGenAI } from '@google/genai';
import { Camera, Send, Loader2, AlertTriangle, Users, MessageSquare, Plus, Menu, X, Bot, User } from 'lucide-react';

// ==========================================
// 1. CONFIGURAÇÕES: FIREBASE & GEMINI
// ==========================================
const firebaseApiKey = import.meta.env.VITE_FIREBASE_API_KEY;
const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY;

const firebaseConfig = {
  apiKey: firebaseApiKey,
  authDomain: "SEU_DOMINIO.firebaseapp.com",
  projectId: "SEU_PROJECT_ID",
  storageBucket: "SEU_BUCKET.appspot.com",
  messagingSenderId: "SEU_SENDER_ID",
  appId: "SEU_APP_ID"
};

const app = firebaseApiKey ? initializeApp(firebaseConfig) : null;
const db = app ? getFirestore(app) : null;

let ai = null;
if (geminiApiKey) {
  ai = new GoogleGenAI({ apiKey: geminiApiKey });
}

const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = (error) => reject(error);
  });
};

// ==========================================
// 2. COMPONENTE PRINCIPAL
// ==========================================
export default function App() {
  const isConfigured = Boolean(firebaseApiKey && geminiApiKey && ai);
  
  // Estados de Layout (Sidebar e Abas)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' | 'team'
  
  // Estados de Times
  const [teams, setTeams] = useState([{ id: 'vitoria', name: 'Vitória (Principal)' }]);
  const [activeTeamId, setActiveTeamId] = useState('vitoria');

  // Estados do Chat
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // Estados do Gerenciador de Time
  const [teamData, setTeamData] = useState({ formation: 'Não definida', players: [] });
  const [isExtractionLoading, setIsExtractionLoading] = useState(false);
  const teamImageInputRef = useRef(null);

  // Auto-scroll do chat
  useEffect(() => {
    if (activeTab === 'chat') {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, activeTab]);

  // Carrega histórico de chat DO TIME SELECIONADO
  useEffect(() => {
    if (!db || !activeTeamId) return;
    const q = query(collection(db, `chats_${activeTeamId}`), orderBy("timestamp", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMessages(msgs);
    });
    return () => unsubscribe();
  }, [activeTeamId]);

  // Carrega os dados da Escalação do time selecionado
  useEffect(() => {
    if (!db || !activeTeamId) return;
    const unsub = onSnapshot(doc(db, "teams", activeTeamId), (docSnap) => {
      if (docSnap.exists()) {
        setTeamData(docSnap.data());
      } else {
        setTeamData({ formation: 'Não definida', players: [] });
      }
    });
    return () => unsub();
  }, [activeTeamId]);

  // ==========================================
  // AÇÕES
  // ==========================================
  const handleCreateTeam = () => {
    const teamName = prompt("Digite o nome do novo time:");
    if (teamName && teamName.trim() !== "") {
      const newId = teamName.toLowerCase().replace(/[^a-z0-9]/g, '-');
      setTeams([...teams, { id: newId, name: teamName }]);
      setActiveTeamId(newId);
      if (window.innerWidth < 768) setIsSidebarOpen(false); // Fecha sidebar no mobile
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if ((!inputText.trim() && !selectedImage) || !isConfigured || !db) return;

    setIsChatLoading(true);
    const userMessage = { text: inputText, sender: 'user', hasImage: !!selectedImage, timestamp: new Date() };
    await addDoc(collection(db, `chats_${activeTeamId}`), userMessage);

    try {
      const currentTeamContext = JSON.stringify(teamData);
      const systemPrompt = `Você é um Analista Tático do OSM. 
O usuário está gerenciando o time com os seguintes dados e jogadores atuais:
${currentTeamContext}

Analise a situação enviada (texto ou imagem) cruzando com a força dos jogadores acima e recomende a melhor tática de forma direta e em português. Formate a resposta com tópicos claros.`;

      const contents = [];
      if (selectedImage) {
        contents.push({ inlineData: { data: await fileToBase64(selectedImage), mimeType: selectedImage.type } });
      }
      contents.push(inputText || "Qual a melhor tática considerando meu time atual e a imagem enviada?");

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: contents,
        config: { systemInstruction: systemPrompt, temperature: 0.2 }
      });

      await addDoc(collection(db, `chats_${activeTeamId}`), { text: response.text, sender: 'ai', timestamp: new Date() });
    } catch (error) {
      console.error(error);
      await addDoc(collection(db, `chats_${activeTeamId}`), { text: "Erro ao processar análise tática.", sender: 'ai', timestamp: new Date() });
    } finally {
      setInputText('');
      setSelectedImage(null);
      setIsChatLoading(false);
    }
  };

  const handleExtractTeamData = async (e) => {
    const file = e.target.files[0];
    if (!file || !isConfigured) return;

    setIsExtractionLoading(true);
    try {
      const base64Data = await fileToBase64(file);
      const prompt = `Analise esta captura de tela do jogo OSM mostrando uma formação e jogadores.
Extraia os dados e retorne ESTRITAMENTE um objeto JSON válido neste formato:
{ "formation": "4-3-3 B", "players": [ { "name": "NOME", "att": 90, "def": 10, "ovr": 50 } ] }`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ inlineData: { data: base64Data, mimeType: file.type } }, prompt],
      });

      let rawText = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
      const extractedData = JSON.parse(rawText);

      setTeamData(extractedData);
      if (db) await setDoc(doc(db, "teams", activeTeamId), extractedData, { merge: true });

    } catch (error) {
      console.error("Erro:", error);
      alert("Não foi possível ler a imagem. Tente tirar um print mais claro.");
    } finally {
      setIsExtractionLoading(false);
    }
  };

  const updatePlayerStat = async (index, field, value) => {
    const updatedPlayers = [...teamData.players];
    updatedPlayers[index][field] = Number(value);
    const newData = { ...teamData, players: updatedPlayers };
    setTeamData(newData);
    if (db) await setDoc(doc(db, "teams", activeTeamId), newData, { merge: true });
  };

  const activeTeamName = teams.find(t => t.id === activeTeamId)?.name || 'Time Desconhecido';

  if (!isConfigured) return (
    <div className="flex flex-col items-center justify-center h-screen bg-slate-50 p-6 text-center">
      <AlertTriangle size={48} className="text-yellow-500 mb-4" />
      <h2 className="text-2xl font-bold">Faltam as Chaves de API</h2>
      <p className="text-slate-600">Configure o arquivo .env conforme instruções anteriores.</p>
    </div>
  );

  return (
    <div className="flex h-screen bg-white text-slate-800 font-sans overflow-hidden">
      
      {/* OVERLAY MOBILE PARA SIDEBAR */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* =========================================
          SIDEBAR (Estilo Gemini)
      ========================================= */}
      <aside className={`fixed md:relative z-50 w-72 h-full bg-slate-50 border-r border-slate-200 flex flex-col transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
        
        {/* Topo Sidebar */}
        <div className="p-4 flex items-center justify-between md:justify-center">
          <button 
            onClick={handleCreateTeam}
            className="flex items-center gap-2 bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-full font-medium transition-colors w-full justify-center"
          >
            <Plus size={18} /> Novo Time
          </button>
          <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-slate-500 p-2">
            <X size={24} />
          </button>
        </div>

        {/* Lista de Times */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-3 mb-2 mt-2">Seus Times</p>
          {teams.map((team) => (
            <button
              key={team.id}
              onClick={() => { setActiveTeamId(team.id); if(window.innerWidth < 768) setIsSidebarOpen(false); }}
              className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-colors ${activeTeamId === team.id ? 'bg-blue-100 text-blue-800 font-semibold' : 'hover:bg-slate-200 text-slate-700'}`}
            >
              {team.name}
            </button>
          ))}
        </div>

        {/* Navegação Inferior (Menu de Ferramentas) */}
        <div className="p-3 border-t border-slate-200 space-y-1">
          <button
            onClick={() => { setActiveTab('chat'); if(window.innerWidth < 768) setIsSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm transition-colors ${activeTab === 'chat' ? 'bg-slate-200 text-slate-900 font-semibold' : 'hover:bg-slate-200 text-slate-700'}`}
          >
            <MessageSquare size={18} /> Chat Tático
          </button>
          <button
            onClick={() => { setActiveTab('team'); if(window.innerWidth < 768) setIsSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm transition-colors ${activeTab === 'team' ? 'bg-slate-200 text-slate-900 font-semibold' : 'hover:bg-slate-200 text-slate-700'}`}
          >
            <Users size={18} /> Escalação Atual
          </button>
        </div>
      </aside>

      {/* =========================================
          ÁREA PRINCIPAL (Main Content)
      ========================================= */}
      <main className="flex-1 flex flex-col h-full relative w-full bg-white">
        
        {/* Header Mobile / Info do Time */}
        <header className="flex items-center justify-between p-4 z-10 sticky top-0 bg-white/80 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-full">
              <Menu size={24} />
            </button>
            <h2 className="text-lg font-semibold text-slate-800">
              {activeTeamName} <span className="text-slate-400 text-sm font-normal">• {activeTab === 'chat' ? 'Chat Tático' : 'Escalação'}</span>
            </h2>
          </div>
        </header>

        {/* Conteúdo Dinâmico Centralizado */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto w-full p-4 pb-32">
            
            {/* VIEW: CHAT */}
            {activeTab === 'chat' && (
              <div className="space-y-6">
                {messages.length === 0 && (
                  <div className="text-center mt-20">
                    <div className="bg-slate-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Bot size={32} className="text-blue-500" />
                    </div>
                    <h3 className="text-xl font-semibold text-slate-800">Como posso ajudar seu time hoje?</h3>
                    <p className="text-slate-500 mt-2">Envie as informações do adversário ou um print para análise tática.</p>
                  </div>
                )}
                
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex gap-4 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.sender === 'ai' && (
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-1">
                        <Bot size={18} className="text-blue-600" />
                      </div>
                    )}
                    <div className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-4 text-sm leading-relaxed ${
                      msg.sender === 'user' 
                        ? 'bg-slate-100 text-slate-900 rounded-tr-sm' 
                        : 'bg-transparent text-slate-800'
                    }`}>
                      {msg.hasImage && <div className="mb-2 text-xs font-semibold text-blue-600 flex items-center gap-1"><Camera size={14}/> Imagem Analisada</div>}
                      <div className="whitespace-pre-wrap">{msg.text}</div>
                    </div>
                  </div>
                ))}
                {isChatLoading && (
                  <div className="flex gap-4 justify-start">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <Bot size={18} className="text-blue-600" />
                    </div>
                    <div className="flex items-center gap-2 text-slate-500 text-sm py-2">
                      <Loader2 className="animate-spin" size={16} /> Processando tática...
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}

            {/* VIEW: ESCALAÇÃO (Meu Time) */}
            {activeTab === 'team' && (
              <div className="animate-fade-in">
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 mb-6 text-center">
                  <h3 className="text-lg font-bold mb-2 text-slate-800">Atualizar Elenco</h3>
                  <p className="text-sm text-slate-500 mb-6">Mantenha os níveis dos seus jogadores atualizados para que a IA sugira táticas precisas.</p>
                  
                  <input type="file" accept="image/*" className="hidden" ref={teamImageInputRef} onChange={handleExtractTeamData} />
                  <button 
                    onClick={() => teamImageInputRef.current.click()}
                    disabled={isExtractionLoading}
                    className="bg-white text-slate-700 border border-slate-300 rounded-full py-3 px-6 flex items-center justify-center gap-2 font-semibold hover:bg-slate-100 transition-colors mx-auto shadow-sm"
                  >
                    {isExtractionLoading ? <Loader2 className="animate-spin" size={20} /> : <Camera size={20} />}
                    {isExtractionLoading ? 'Extraindo dados...' : 'Fazer Upload da Formação (Print)'}
                  </button>
                </div>

                {teamData.players.length > 0 && (
                  <div>
                    <h4 className="font-bold text-slate-700 mb-4 flex items-center justify-between">
                      Jogadores Salvos <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs">{teamData.formation}</span>
                    </h4>
                    <div className="space-y-2">
                      <div className="grid grid-cols-12 gap-2 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider">
                        <div className="col-span-6">Nome</div>
                        <div className="col-span-2 text-center text-red-400">Atq</div>
                        <div className="col-span-2 text-center text-blue-400">Def</div>
                        <div className="col-span-2 text-center text-green-500">Ovr</div>
                      </div>
                      
                      {teamData.players.map((player, idx) => (
                        <div key={idx} className="bg-white border border-slate-200 hover:border-blue-300 transition-colors rounded-xl p-3 grid grid-cols-12 gap-2 items-center shadow-sm">
                          <div className="col-span-6 font-semibold text-sm text-slate-700 truncate">{player.name}</div>
                          <input type="number" value={player.att} onChange={(e) => updatePlayerStat(idx, 'att', e.target.value)} className="col-span-2 bg-slate-50 border-none rounded text-center text-sm py-1 focus:ring-2 focus:ring-blue-100 outline-none font-medium text-slate-600" />
                          <input type="number" value={player.def} onChange={(e) => updatePlayerStat(idx, 'def', e.target.value)} className="col-span-2 bg-slate-50 border-none rounded text-center text-sm py-1 focus:ring-2 focus:ring-blue-100 outline-none font-medium text-slate-600" />
                          <input type="number" value={player.ovr} onChange={(e) => updatePlayerStat(idx, 'ovr', e.target.value)} className="col-span-2 bg-green-50 text-green-700 border-none rounded text-center text-sm py-1 focus:ring-2 focus:ring-green-200 outline-none font-bold" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* =========================================
            INPUT FLUTUANTE (Estilo Gemini)
        ========================================= */}
        {activeTab === 'chat' && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-white via-white to-transparent pt-10 pb-6 px-4 pointer-events-none">
            <div className="max-w-3xl mx-auto w-full pointer-events-auto">
              {selectedImage && (
                <div className="mb-2 ml-4 flex items-center gap-2">
                  <div className="bg-blue-50 text-blue-700 text-xs px-3 py-1.5 rounded-full flex items-center gap-2 border border-blue-100 shadow-sm">
                    <span className="truncate max-w-[150px]">📸 {selectedImage.name}</span>
                    <button onClick={() => setSelectedImage(null)} className="hover:text-blue-900 ml-1"><X size={14} /></button>
                  </div>
                </div>
              )}
              
              <form onSubmit={handleSendMessage} className="bg-slate-100 focus-within:bg-slate-200 transition-colors rounded-3xl p-2 flex items-end gap-2 shadow-sm border border-slate-200">
                <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={(e) => setSelectedImage(e.target.files[0])} />
                
                <button 
                  type="button" 
                  onClick={() => fileInputRef.current.click()}
                  className="p-3 text-slate-500 hover:text-slate-800 hover:bg-slate-300/50 rounded-full transition-colors flex-shrink-0"
                  aria-label="Anexar print do jogo"
                >
                  <Camera size={22} />
                </button>
                
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(e); } }}
                  placeholder="Pergunte sobre táticas ou envie um print..."
                  className="flex-1 bg-transparent border-none px-2 py-3 text-[15px] max-h-32 resize-none outline-none text-slate-800 placeholder:text-slate-500"
                  rows={1}
                />
                
                <button 
                  type="submit" 
                  disabled={(!inputText.trim() && !selectedImage) || isChatLoading}
                  className="p-3 bg-slate-800 text-white rounded-full hover:bg-slate-700 transition-colors disabled:opacity-30 disabled:hover:bg-slate-800 flex-shrink-0 shadow-md"
                  aria-label="Enviar"
                >
                  <Send size={20} className="ml-0.5" />
                </button>
              </form>
              <p className="text-center text-[10px] text-slate-400 mt-2">A IA pode cometer erros na extração. Verifique os overalls.</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}