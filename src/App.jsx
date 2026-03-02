// src/App.jsx
import React, { useState, useEffect } from "react";
import { Toaster, toast } from "react-hot-toast";
import { Menu, AlertTriangle, LogOut, Loader2 } from "lucide-react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";

import { db, auth, isFirebaseConfigured } from "./config/firebase";
import { ai } from "./config/gemini";

import Sidebar from "./components/Sidebar";
import ChatPage from "./pages/ChatPage";
import TeamPage from "./pages/TeamPage";
import LoginPage from "./pages/LoginPage";
import RivalsPage from "./pages/RivalsPage";
import SimulatorPage from "./pages/SimulatorPage"; // IMPORTAÇÃO DA NOVA PÁGINA

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("chat"); // Pode ser "chat", "team", "rivals" ou "simulator"

  // A lista de times agora começa vazia e será preenchida pelo Firebase
  const [teams, setTeams] = useState([]);
  const [activeTeamId, setActiveTeamId] = useState(null);
  
  const [teamData, setTeamData] = useState({ 
    formation: "Carregando...", 
    teamOvr: 0, 
    players: [] 
  });

  const isConfigured = isFirebaseConfigured && Boolean(ai);

  // ==========================================
  // 1. MONITORAMENTO DE LOGIN
  // ==========================================
  useEffect(() => {
    if (!auth) {
      setAuthLoading(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // ==========================================
  // 2. SINCRONIZAÇÃO DA SIDEBAR COM O FIREBASE
  // ==========================================
  // Busca a lista de times do usuário quando ele faz login
  useEffect(() => {
    if (!user || !db) {
      setTeams([]);
      return;
    }

    const fetchUserTeams = async () => {
      try {
        const docRef = doc(db, "users", user.uid, "settings", "teamList");
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists() && docSnap.data().teams?.length > 0) {
          const loadedTeams = docSnap.data().teams;
          setTeams(loadedTeams);
          setActiveTeamId(loadedTeams[0].id); // Seleciona o primeiro time por padrão
        } else {
          // Conta nova: Cria o time padrão de boas-vindas direto na nuvem
          const defaultTeam = [{ id: `time-inicial-${Date.now()}`, name: "Meu Primeiro Time" }];
          setTeams(defaultTeam);
          setActiveTeamId(defaultTeam[0].id);
          await setDoc(docRef, { teams: defaultTeam });
        }
      } catch (error) {
        console.error("Erro ao carregar lista de times:", error);
        toast.error("Erro ao sincronizar seus times.");
      }
    };

    fetchUserTeams();
  }, [user]);

  // Salva automaticamente a lista de times na nuvem sempre que você criar/excluir/renomear um time
  useEffect(() => {
    if (!user || !db || teams.length === 0) return;
    
    const saveTeamsToCloud = async () => {
      try {
        await setDoc(doc(db, "users", user.uid, "settings", "teamList"), { teams });
      } catch (error) {
        console.error("Erro ao salvar lista de times:", error);
      }
    };
    
    saveTeamsToCloud();
  }, [teams, user]);

  // ==========================================
  // 3. BUSCA DOS DADOS DO TIME ATIVO
  // ==========================================
  useEffect(() => {
    if (!db || !activeTeamId || !user) return;

    const fetchTeamData = async () => {
      setTeamData({ formation: "Buscando dados...", teamOvr: 0, players: [] });
      try {
        const docSnap = await getDoc(doc(db, "users", user.uid, "teams", activeTeamId));
        if (docSnap.exists()) {
          setTeamData(docSnap.data());
        } else {
          setTeamData({ 
            formation: "4-3-3B", 
            teamOvr: 0, 
            players: [] 
          });
        }
      } catch (error) {
        console.error("Erro ao buscar dados do time:", error);
      }
    };

    fetchTeamData();
  }, [activeTeamId, user]);

  const activeTeamName = teams.find((t) => t.id === activeTeamId)?.name || "Carregando...";

  const handleLogout = async () => {
    // Limpa os dados visuais antes de deslogar para evitar vazamento visual
    setTeams([]);
    setActiveTeamId(null);
    await signOut(auth);
  };

  // ==========================================
  // RENDERIZAÇÃO CONDICIONAL
  // ==========================================
  if (!isConfigured) return (
    <div className="flex flex-col items-center justify-center h-screen bg-slate-950 p-6 text-center text-slate-100">
      <AlertTriangle size={48} className="text-yellow-500 mb-4" />
      <h2 className="text-2xl font-bold">Variáveis não configuradas</h2>
      <p className="text-slate-400 mt-2">Verifique o seu arquivo .env</p>
    </div>
  );

  if (authLoading) return (
    <div className="h-screen bg-slate-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="animate-spin text-blue-500" size={40} />
        <p className="text-slate-400 animate-pulse font-medium">Autenticando prancheta...</p>
      </div>
    </div>
  );

  if (!user) return <LoginPage />;

  // Impede a renderização principal enquanto o Firebase não carrega os times da conta
  if (teams.length === 0 || !activeTeamId) return (
    <div className="h-screen bg-slate-950 flex items-center justify-center">
      <Loader2 className="animate-spin text-blue-500" size={40} />
    </div>
  );

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 font-sans overflow-hidden selection:bg-blue-600/30">
      <Toaster position="top-center" 
        toastOptions={{ 
          style: { background: "#1e293b", color: "#f8fafc", border: "1px solid #334155" } 
        }} 
      />

      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/70 z-40 md:hidden backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)} />
      )}

      <Sidebar
        user={user}
        db={db}
        teams={teams}
        setTeams={setTeams}
        activeTeamId={activeTeamId}
        setActiveTeamId={setActiveTeamId}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
      />

      <main className="flex-1 flex flex-col h-full relative w-full bg-slate-950">
        <header className="flex items-center justify-between p-4 z-10 sticky top-0 bg-slate-950/80 backdrop-blur-md border-b border-slate-800">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 text-slate-300 hover:bg-slate-800 rounded-full transition-colors">
              <Menu size={24} />
            </button>
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              {activeTeamName} 
              <span className="bg-slate-800 text-blue-400 text-[10px] px-2 py-1 rounded-md uppercase tracking-wider hidden sm:inline-block">
                {activeTab === "chat" ? "Táticas" : activeTab === "team" ? "Elenco" : activeTab === "rivals" ? "Dossiê" : "Simulador"}
              </span>
            </h2>
          </div>
          
          <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-400 transition-colors flex items-center gap-2 rounded-lg hover:bg-slate-800" title="Sair do App">
            <span className="hidden sm:inline text-xs font-bold uppercase tracking-wider">Sair</span>
            <LogOut size={18} />
          </button>
        </header>

        {/* LÓGICA DE ROTEAMENTO DAS ABAS */}
        {activeTab === "chat" && (
          <ChatPage
            activeTeamId={activeTeamId}
            activeTeamName={activeTeamName}
            teamData={teamData}
            user={user}
          />
        )}
        
        {activeTab === "team" && (
          <div className="flex-1 overflow-y-auto">
            <TeamPage
              activeTeamId={activeTeamId}
              activeTeamName={activeTeamName}
              teamData={teamData}
              setTeamData={setTeamData}
              user={user}
            />
          </div>
        )}

        {activeTab === "rivals" && (
          <div className="flex-1 overflow-y-auto">
            <RivalsPage
              activeTeamId={activeTeamId}
              activeTeamName={activeTeamName}
              user={user}
            />
          </div>
        )}

        {activeTab === "simulator" && (
          <div className="flex-1 overflow-y-auto">
            <SimulatorPage
              activeTeamId={activeTeamId}
              activeTeamName={activeTeamName}
              teamData={teamData}
              user={user}
            />
          </div>
        )}

      </main>
    </div>
  );
}