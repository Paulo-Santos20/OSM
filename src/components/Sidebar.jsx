// src/components/Sidebar.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Plus, X, MessageSquare, Users, MoreVertical, Edit2, Trash2, Download, MessageSquareX, Target, Dices } from 'lucide-react'; // Import do ícone Dices e Target
import { collection, getDocs, writeBatch, doc, deleteDoc } from 'firebase/firestore'; 
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

  // Fecha o menu de 3 pontinhos ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ==========================================
  // LÓGICA DE INSTALAÇÃO PWA
  // ==========================================
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
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        toast.success("Instalação iniciada!");
      }
    } else {
      toast.error("O aplicativo já está instalado ou o navegador não suporta.");
    }
  };

  // ==========================================
  // CONTROLES DE TIMES (Criar, Renomear, Excluir)
  // ==========================================
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

  const handleClearChat = async (teamId, teamName) => {
    if (!user || !db) return;
    const confirmClear = window.confirm(`Deseja apagar todo o histórico de mensagens da sala de preleção do "${teamName}"?`);
    
    if (confirmClear) {
      const loadingToast = toast.loading("Limpando preleção...");
      try {
        const chatRef = collection(db, "users", user.uid, `chats_${teamId}`);
        const snapshot = await getDocs(chatRef);
        const batch = writeBatch(db);
        
        snapshot.docs.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
        
        toast.success("Sala de preleção limpa!", { id: loadingToast });
      } catch (error) {
        toast.error("Erro ao limpar chat.", { id: loadingToast });
      }
    }
    setOpenMenuId(null);
  };

  const handleDeleteTeam = async (id, name) => {
    const confirmDelete = window.confirm(`Tem certeza que deseja apagar a prancheta do time "${name}" permanentemente?`);
    if (confirmDelete) {
      const updatedTeams = teams.filter(t => t.id !== id);
      setTeams(updatedTeams);
      
      if (activeTeamId === id) {
        setActiveTeamId(updatedTeams.length > 0 ? updatedTeams[0].id : null);
      }

      if (user && db) {
        try {
          await deleteDoc(doc(db, "users", user.uid, "teams", id));
        } catch (error) {
          console.error("Erro ao deletar dados do time no firebase:", error);
        }
      }
      toast.success("Time removido com sucesso!");
    }
    setOpenMenuId(null);
  };

  const changeTab = (tab) => {
    setActiveTab(tab);
    if (window.innerWidth < 768) setIsSidebarOpen(false);
  };

  return (
    <>
      {/* MODAL DE CRIAÇÃO/EDIÇÃO */}
      {modalConfig.isOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-3xl shadow-2xl w-full max-w-sm">
            <h3 className="text-xl font-bold text-slate-100 mb-4">
              {modalConfig.type === 'create' ? 'Nova Prancheta (Time)' : 'Renomear Time'}
            </h3>
            <form onSubmit={handleModalSubmit}>
              <input
                type="text" autoFocus value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ex: Al-Hilal (OSM)"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all mb-6 placeholder:text-slate-600"
              />
              <div className="flex items-center justify-end gap-3">
                <button type="button" onClick={() => setModalConfig({ isOpen: false, type: '', teamId: null })} className="px-4 py-2.5 text-sm font-medium text-slate-400 hover:text-white transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={!inputValue.trim()} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-colors shadow-md">
                  {modalConfig.type === 'create' ? 'Criar Prancheta' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SIDEBAR PRINCIPAL */}
      <aside className={`fixed md:relative z-50 w-72 flex-shrink-0 h-full bg-slate-900 border-r border-slate-800 flex flex-col transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 text-slate-200 shadow-xl`}>
        <div className="p-4 flex items-center justify-between">
          <button onClick={openCreateModal} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-3 rounded-2xl font-bold transition-colors w-full justify-center shadow-lg shadow-blue-900/30 border border-blue-500 focus:ring-2 focus:ring-blue-400 outline-none">
            <Plus size={18} /> Novo Time
          </button>
          <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-slate-400 hover:text-white p-2 transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1 scrollbar-thin scrollbar-thumb-slate-700">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-3 mb-3 mt-2">Suas Pranchetas</p>
          
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

              {/* MENU SUSPENSO (Dropdown) */}
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
                    <Trash2 size={16} /> Excluir Time
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* NAVEGAÇÃO E INSTALAÇÃO */}
        <div className="p-3 border-t border-slate-800 space-y-2 bg-slate-900/90 backdrop-blur-sm">
          
          {deferredPrompt && (
            <button onClick={handleInstallPWA} className="w-full flex items-center justify-center gap-2 px-3 py-3.5 rounded-xl text-sm transition-colors bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold shadow-lg mb-4">
              <Download size={18} /> Instalar no Celular
            </button>
          )}
          
          <button onClick={() => changeTab('chat')} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm transition-colors ${activeTab === 'chat' ? 'bg-slate-800 text-white font-bold shadow-sm' : 'hover:bg-slate-800/50 text-slate-400 font-medium'}`}>
            <MessageSquare size={18} className={activeTab === 'chat' ? 'text-blue-400' : ''} /> Preleção (IA)
          </button>
          <button onClick={() => changeTab('team')} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm transition-colors ${activeTab === 'team' ? 'bg-slate-800 text-white font-bold shadow-sm' : 'hover:bg-slate-800/50 text-slate-400 font-medium'}`}>
            <Users size={18} className={activeTab === 'team' ? 'text-blue-400' : ''} /> Gestão do Elenco
          </button>
          <button onClick={() => changeTab('rivals')} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm transition-colors ${activeTab === 'rivals' ? 'bg-slate-800 text-white font-bold shadow-sm' : 'hover:bg-slate-800/50 text-slate-400 font-medium'}`}>
            <Target size={18} className={activeTab === 'rivals' ? 'text-red-400' : ''} /> Dossiê de Rivais
          </button>
          <button onClick={() => changeTab('simulator')} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm transition-colors ${activeTab === 'simulator' ? 'bg-slate-800 text-white font-bold shadow-sm' : 'hover:bg-slate-800/50 text-slate-400 font-medium'}`}>
            <Dices size={18} className={activeTab === 'simulator' ? 'text-purple-400' : ''} /> Simulador Pré-Match
          </button>
        </div>
      </aside>
    </>
  );
}