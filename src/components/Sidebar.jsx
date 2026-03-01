import React, { useState, useEffect, useRef } from 'react';
import { Plus, X, MessageSquare, Users, MoreVertical, Edit2, Trash2, Download, MessageSquareX } from 'lucide-react';
import { collection, getDocs, writeBatch } from 'firebase/firestore'; // Importações para limpar o chat
import toast from 'react-hot-toast';

export default function Sidebar({ 
  user, db, teams, setTeams, activeTeamId, setActiveTeamId, 
  activeTab, setActiveTab, isSidebarOpen, setIsSidebarOpen 
}) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);
  const menuRef = useRef(null);

  const [modalConfig, setModalConfig] = useState({ isOpen: false, type: '', teamId: null });
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallPWA = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') setDeferredPrompt(null);
    }
  };

  const openCreateModal = () => {
    setInputValue('');
    setModalConfig({ isOpen: true, type: 'create', teamId: null });
  };

  const openRenameModal = (id, currentName) => {
    setInputValue(currentName);
    setModalConfig({ isOpen: true, type: 'rename', teamId: id });
    setOpenMenuId(null);
  };

  const handleModalSubmit = (e) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    if (modalConfig.type === 'create') {
      const newId = inputValue.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Date.now();
      setTeams([...teams, { id: newId, name: inputValue.trim() }]);
      setActiveTeamId(newId);
      toast.success(`Time ${inputValue.trim()} criado!`);
      if (window.innerWidth < 768) setIsSidebarOpen(false);
    } else if (modalConfig.type === 'rename') {
      setTeams(teams.map(t => t.id === modalConfig.teamId ? { ...t, name: inputValue.trim() } : t));
      toast.success("Time renomeado!");
    }
    setModalConfig({ isOpen: false, type: '', teamId: null });
  };

  // ==========================================
  // NOVA FUNÇÃO: LIMPAR CHAT (Puxada do ChatPage)
  // ==========================================
  const handleClearChat = async (teamId, teamName) => {
    if (!user || !db) return;
    const confirmClear = window.confirm(`Deseja apagar todo o histórico de mensagens do time "${teamName}"?`);
    
    if (confirmClear) {
      const loadingToast = toast.loading("Limpando histórico...");
      try {
        const chatRef = collection(db, "users", user.uid, `chats_${teamId}`);
        const snapshot = await getDocs(chatRef);
        const batch = writeBatch(db);
        
        snapshot.docs.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
        
        toast.success("Histórico limpo!", { id: loadingToast });
      } catch (error) {
        toast.error("Erro ao limpar chat.", { id: loadingToast });
      }
    }
    setOpenMenuId(null);
  };

  const handleDeleteTeam = (id, name) => {
    const confirmDelete = window.confirm(`Excluir o time "${name}"? Isso não apaga os dados do Firebase, apenas o acesso local.`);
    if (confirmDelete) {
      const updatedTeams = teams.filter(t => t.id !== id);
      setTeams(updatedTeams);
      if (activeTeamId === id) setActiveTeamId(updatedTeams.length > 0 ? updatedTeams[0].id : null);
      toast.success("Time removido da lista!");
    }
    setOpenMenuId(null);
  };

  const changeTab = (tab) => {
    setActiveTab(tab);
    if (window.innerWidth < 768) setIsSidebarOpen(false);
  };

  return (
    <>
      {/* MODAL DESIGN PREMIUM */}
      {modalConfig.isOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-3xl shadow-2xl w-full max-w-sm">
            <h3 className="text-xl font-bold text-slate-100 mb-4">
              {modalConfig.type === 'create' ? 'Novo Time' : 'Renomear Time'}
            </h3>
            <form onSubmit={handleModalSubmit}>
              <input
                type="text" autoFocus value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Nome do time..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all mb-6"
              />
              <div className="flex items-center justify-end gap-3">
                <button type="button" onClick={() => setModalConfig({ isOpen: false, type: '', teamId: null })} className="px-4 py-2.5 text-sm font-medium text-slate-400 hover:text-white transition-colors">Cancelar</button>
                <button type="submit" disabled={!inputValue.trim()} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-colors shadow-md">
                  {modalConfig.type === 'create' ? 'Criar Time' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SIDEBAR DARK */}
      <aside className={`fixed md:relative z-50 w-72 flex-shrink-0 h-full bg-slate-900 border-r border-slate-800 flex flex-col transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 text-slate-200 shadow-xl`}>
        <div className="p-4 flex items-center justify-between">
          <button onClick={openCreateModal} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-100 px-4 py-3 rounded-2xl font-semibold transition-colors w-full justify-center shadow-md border border-slate-700 focus:ring-2 focus:ring-blue-500 outline-none">
            <Plus size={18} className="text-blue-400" /> Novo Time
          </button>
          <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-slate-400 hover:text-white p-2"><X size={24} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1 scrollbar-thin scrollbar-thumb-slate-700">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-3 mb-3 mt-2">Times</p>
          
          {teams.map((team) => (
            <div key={team.id} className="relative group flex items-center">
              <button
                onClick={() => { setActiveTeamId(team.id); if(window.innerWidth < 768) setIsSidebarOpen(false); }}
                className={`flex-1 text-left px-4 py-3 rounded-l-xl text-sm transition-colors truncate ${activeTeamId === team.id ? 'bg-blue-600/20 text-blue-400 font-bold border-l-2 border-blue-500' : 'hover:bg-slate-800 text-slate-300 font-medium border-l-2 border-transparent'}`}
              >
                {team.name}
              </button>
              
              <button 
                onClick={() => setOpenMenuId(openMenuId === team.id ? null : team.id)}
                className={`px-3 py-3 rounded-r-xl transition-colors ${activeTeamId === team.id ? 'bg-blue-600/20 text-blue-400' : 'hover:bg-slate-800 text-slate-400 md:opacity-0 md:group-hover:opacity-100 focus:opacity-100'}`}
              >
                <MoreVertical size={16} />
              </button>

              {openMenuId === team.id && (
                <div ref={menuRef} className="absolute right-10 top-10 w-44 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden animate-fade-in">
                  <button onClick={() => openRenameModal(team.id, team.name)} className="w-full text-left px-4 py-3 text-sm font-medium text-slate-200 hover:bg-slate-700 hover:text-white flex items-center gap-3 transition-colors">
                    <Edit2 size={16} className="text-blue-400" /> Renomear
                  </button>
                  <button onClick={() => handleClearChat(team.id, team.name)} className="w-full text-left px-4 py-3 text-sm font-medium text-slate-200 hover:bg-slate-700 hover:text-white flex items-center gap-3 transition-colors">
                    <MessageSquareX size={16} className="text-amber-400" /> Limpar Chat
                  </button>
                  <div className="h-px bg-slate-700/50 w-full" />
                  <button onClick={() => handleDeleteTeam(team.id, team.name)} className="w-full text-left px-4 py-3 text-sm font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 flex items-center gap-3 transition-colors">
                    <Trash2 size={16} /> Excluir
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="p-3 border-t border-slate-800 space-y-2">
          {deferredPrompt && (
            <button onClick={handleInstallPWA} className="w-full flex items-center justify-center gap-2 px-3 py-3 rounded-xl text-sm transition-colors bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold shadow-lg mb-4">
              <Download size={18} /> Instalar Aplicativo
            </button>
          )}
          
          <button onClick={() => changeTab('chat')} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm transition-colors ${activeTab === 'chat' ? 'bg-slate-800 text-white font-semibold' : 'hover:bg-slate-800/50 text-slate-400'}`}>
            <MessageSquare size={18} className={activeTab === 'chat' ? 'text-blue-400' : ''} /> Chat Tático
          </button>
          <button onClick={() => changeTab('team')} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm transition-colors ${activeTab === 'team' ? 'bg-slate-800 text-white font-semibold' : 'hover:bg-slate-800/50 text-slate-400'}`}>
            <Users size={18} className={activeTab === 'team' ? 'text-blue-400' : ''} /> Escalação do Time
          </button>
        </div>
      </aside>
    </>
  );
}