import React, { useState, useEffect } from "react";
import { Toaster, toast } from "react-hot-toast";
import { Menu, AlertTriangle, LogOut, Loader2 } from "lucide-react";
import { doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";

import { db, auth, isFirebaseConfigured } from "./config/firebase";
import { ai } from "./config/gemini";

import Sidebar from "./components/Sidebar";
import ChatPage from "./pages/ChatPage";
import TeamPage from "./pages/TeamPage";
import LoginPage from "./pages/LoginPage";

export default function App() {
  // 1. DECLARAÇÃO DOS ESTADOS (Essencial para evitar o ReferenceError)
  const [user, setUser] = useState(null); 
  const [authLoading, setAuthLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("chat");

  const [teams, setTeams] = useState(() => {
    const saved = localStorage.getItem("osm_teams_list");
    return saved ? JSON.parse(saved) : [{ id: "vitoria", name: "Vitória (Principal)" }];
  });
  
  const [activeTeamId, setActiveTeamId] = useState("vitoria");
  const [teamData, setTeamData] = useState({ 
    formation: "Carregando...", 
    teamOvr: 0, 
    players: [] 
  });

  const isConfigured = isFirebaseConfigured && Boolean(ai);

  // 2. MONITORAMENTO DE AUTH
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

  // 3. SINCRONIZAÇÃO LOCAL
  useEffect(() => {
    localStorage.setItem("osm_teams_list", JSON.stringify(teams));
  }, [teams]);

  // 4. BUSCA DE DADOS NO FIREBASE (COFRE SEGURO)
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
            formation: "Nenhuma escalação", 
            teamOvr: 0, 
            players: [] 
          });
        }
      } catch (error) {
        console.error("Erro ao buscar dados:", error);
        toast.error("Erro ao sincronizar dados.");
      }
    };

    fetchTeamData();
  }, [activeTeamId, user]);

  const activeTeamName = teams.find((t) => t.id === activeTeamId)?.name || "Nenhum Time";

  const handleLogout = () => signOut(auth);

  // ==========================================
  // RENDERIZAÇÃO CONDICIONAL
  // ==========================================

  // Caso as chaves do .env não existam
  if (!isConfigured) return (
    <div className="flex flex-col items-center justify-center h-screen bg-slate-950 p-6 text-center text-slate-100">
      <AlertTriangle size={48} className="text-yellow-500 mb-4" />
      <h2 className="text-2xl font-bold">Variáveis não configuradas</h2>
      <p className="text-slate-400 mt-2">Verifique o seu arquivo .env</p>
    </div>
  );

  // Enquanto verifica o login
  if (authLoading) return (
    <div className="h-screen bg-slate-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="animate-spin text-blue-500" size={40} />
        <p className="text-slate-400 animate-pulse">Autenticando...</p>
      </div>
    </div>
  );

  // Se não estiver logado, exibe a página de Login
  if (!user) return <LoginPage />;

  // App Principal (Usuário Logado)
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
            <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 text-slate-300 hover:bg-slate-800 rounded-full">
              <Menu size={24} />
            </button>
            <h2 className="text-lg font-semibold text-slate-100">
              {activeTeamName} 
              <span className="text-slate-500 text-sm font-normal ml-2">
                • {activeTab === "chat" ? "Táticas" : "Elenco"}
              </span>
            </h2>
          </div>
          
          <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-400 transition-colors flex items-center gap-2" title="Sair">
            <span className="hidden sm:inline text-xs font-bold uppercase tracking-wider">Sair</span>
            <LogOut size={18} />
          </button>
        </header>

        {activeTab === "chat" ? (
          <ChatPage
            activeTeamId={activeTeamId}
            activeTeamName={activeTeamName}
            teamData={teamData}
            user={user}
          />
        ) : (
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
      </main>
    </div>
  );
}