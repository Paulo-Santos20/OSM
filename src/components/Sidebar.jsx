import React from 'react';
import { Plus, X, MessageSquare, Users } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Sidebar({ teams, setTeams, activeTeamId, setActiveTeamId, activeTab, setActiveTab, isSidebarOpen, setIsSidebarOpen }) {
  
  const handleCreateTeam = () => {
    const teamName = prompt("Digite o nome do novo time:");
    if (teamName && teamName.trim() !== "") {
      const newId = teamName.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Date.now();
      setTeams([...teams, { id: newId, name: teamName }]);
      setActiveTeamId(newId);
      toast.success(`Time ${teamName} criado!`);
      if (window.innerWidth < 768) setIsSidebarOpen(false);
    }
  };

  const changeTab = (tab) => {
    setActiveTab(tab);
    if (window.innerWidth < 768) setIsSidebarOpen(false);
  };

  return (
    <aside className={`fixed md:relative z-50 w-72 h-full bg-slate-50 border-r border-slate-200 flex flex-col transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
      <div className="p-4 flex items-center justify-between">
        <button onClick={handleCreateTeam} className="flex items-center gap-2 bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-full font-medium transition-colors w-full justify-center shadow-sm">
          <Plus size={18} /> Novo Time
        </button>
        <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-slate-500 p-2"><X size={24} /></button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-3 mb-2 mt-2">Times Cadastrados</p>
        {teams.map((team) => (
          <button
            key={team.id}
            onClick={() => { setActiveTeamId(team.id); if(window.innerWidth < 768) setIsSidebarOpen(false); }}
            className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-colors ${activeTeamId === team.id ? 'bg-blue-100 text-blue-800 font-semibold shadow-sm' : 'hover:bg-slate-200 text-slate-700'}`}
          >
            {team.name}
          </button>
        ))}
      </div>

      <div className="p-3 border-t border-slate-200 space-y-1">
        <button onClick={() => changeTab('chat')} className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm transition-colors ${activeTab === 'chat' ? 'bg-slate-200 text-slate-900 font-semibold' : 'hover:bg-slate-200 text-slate-700'}`}>
          <MessageSquare size={18} /> Chat Tático
        </button>
        <button onClick={() => changeTab('team')} className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm transition-colors ${activeTab === 'team' ? 'bg-slate-200 text-slate-900 font-semibold' : 'hover:bg-slate-200 text-slate-700'}`}>
          <Users size={18} /> Escalação do Time
        </button>
      </div>
    </aside>
  );
}