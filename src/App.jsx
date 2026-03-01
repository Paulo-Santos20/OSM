import React, { useState, useEffect } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { Menu, AlertTriangle } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';

import { db, isFirebaseConfigured } from './config/firebase';
import { ai } from './config/gemini';

import Sidebar from './components/Sidebar';
import ChatPage from './pages/ChatPage';
import TeamPage from './pages/TeamPage';

export default function App() {
  const isConfigured = isFirebaseConfigured && Boolean(ai);
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('chat');
  
  const [teams, setTeams] = useState(() => {
    const saved = localStorage.getItem('osm_teams_list');
    return saved ? JSON.parse(saved) : [{ id: 'vitoria', name: 'Vitória (Principal)' }];
  });
  const [activeTeamId, setActiveTeamId] = useState('vitoria');
  
  // O Estado do Time atual precisa ficar aqui no App.jsx porque 
  // tanto o TeamPage (para editar) quanto o ChatPage (para o Contexto da IA) precisam ler.
  const [teamData, setTeamData] = useState({ formation: 'Carregando...', teamOvr: 0, players: [] });

  useEffect(() => {
    localStorage.setItem('osm_teams_list', JSON.stringify(teams));
  }, [teams]);

  // Carrega a Escalação sempre que mudar de time
  useEffect(() => {
    if (!db || !activeTeamId) return;
    
    const fetchTeamData = async () => {
      setTeamData({ formation: 'Buscando dados...', teamOvr: 0, players: [] });
      try {
        const docSnap = await getDoc(doc(db, "teams", activeTeamId));
        if (docSnap.exists()) {
          setTeamData(docSnap.data());
        } else {
          setTeamData({ formation: 'Nenhuma escalação', teamOvr: 0, players: [] });
        }
      } catch (error) {
        console.error("Erro ao buscar dados:", error);
        toast.error("Erro ao sincronizar com o Firebase.");
      }
    };
    
    fetchTeamData();
  }, [activeTeamId]);

  const activeTeamName = teams.find(t => t.id === activeTeamId)?.name || 'Time Desconhecido';

  if (!isConfigured) return (
    <div className="flex flex-col items-center justify-center h-screen bg-slate-50 p-6 text-center">
      <AlertTriangle size={48} className="text-yellow-500 mb-4" />
      <h2 className="text-2xl font-bold">Variáveis não configuradas</h2>
    </div>
  );

  return (
    <div className="flex h-screen bg-white text-slate-800 font-sans overflow-hidden">
      <Toaster position="top-center" toastOptions={{ className: 'text-sm font-medium' }} />

      {isSidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setIsSidebarOpen(false)} />}

      <Sidebar 
        teams={teams} setTeams={setTeams}
        activeTeamId={activeTeamId} setActiveTeamId={setActiveTeamId}
        activeTab={activeTab} setActiveTab={setActiveTab}
        isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen}
      />

      <main className="flex-1 flex flex-col h-full relative w-full bg-white">
        <header className="flex items-center justify-between p-4 z-10 sticky top-0 bg-white/80 backdrop-blur-sm border-b border-slate-100">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-full"><Menu size={24} /></button>
            <h2 className="text-lg font-semibold text-slate-800">
              {activeTeamName} <span className="text-slate-400 text-sm font-normal">• {activeTab === 'chat' ? 'Táticas' : 'Elenco'}</span>
            </h2>
          </div>
        </header>

        {activeTab === 'chat' ? (
          <ChatPage activeTeamId={activeTeamId} activeTeamName={activeTeamName} teamData={teamData} />
        ) : (
          <div className="flex-1 overflow-y-auto">
            <TeamPage activeTeamId={activeTeamId} activeTeamName={activeTeamName} teamData={teamData} setTeamData={setTeamData} />
          </div>
        )}
      </main>
    </div>
  );
}