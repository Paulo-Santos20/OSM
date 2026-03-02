// src/pages/RivalsPage.jsx
import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Target, Trash2, Edit3, ShieldAlert, Zap, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function RivalsPage({ activeTeamId, activeTeamName, user }) {
  const [rivals, setRivals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedRival, setExpandedRival] = useState(null);

  useEffect(() => {
    if (!user || !activeTeamId || !db) return;
    const q = query(collection(db, "users", user.uid, `rivals_${activeTeamId}`));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRivals(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user, activeTeamId]);

  const updateNotes = async (rivalId, newNotes) => {
    try {
      await setDoc(doc(db, "users", user.uid, `rivals_${activeTeamId}`, rivalId), { notes: newNotes }, { merge: true });
      toast.success("Anotação tática atualizada.");
    } catch (e) {
      toast.error("Erro ao salvar anotação.");
    }
  };

  const deleteRival = async (rivalId, name) => {
    if(window.confirm(`Excluir a ficha criminal de ${name}?`)) {
      await deleteDoc(doc(db, "users", user.uid, `rivals_${activeTeamId}`, rivalId));
      toast.success("Dossiê apagado.");
    }
  };

  if (loading) return <div className="p-20 flex justify-center"><Loader2 className="animate-spin text-blue-500" size={40} /></div>;

  return (
    <div className="p-4 pb-10 max-w-6xl mx-auto w-full animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-8 shadow-lg flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-100 flex items-center gap-3">
            <Target className="text-red-500" size={28}/> Dossiê de Rivais
          </h2>
          <p className="text-slate-400 text-sm mt-1">Ao enviar prints no Chat, a IA preenche o scout automaticamente aqui.</p>
        </div>
        <div className="bg-slate-800 px-4 py-2 rounded-xl border border-slate-700 hidden sm:block">
          <span className="text-xs font-bold text-slate-500 uppercase">Liga Atual</span>
          <p className="text-sm font-bold text-blue-400">{activeTeamName}</p>
        </div>
      </div>

      {rivals.length === 0 ? (
        <div className="text-center py-20 bg-slate-900/50 rounded-2xl border border-slate-800/50">
          <ShieldAlert size={48} className="mx-auto text-slate-700 mb-4" />
          <h3 className="text-lg font-bold text-slate-400">Nenhum rival scouteado ainda</h3>
          <p className="text-sm text-slate-500 mt-2">Vá para o chat e envie o print da escalação de um adversário.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {rivals.map(rival => {
            const isExpanded = expandedRival === rival.id;
            return (
              <div key={rival.id} className={`bg-slate-900 border transition-colors rounded-2xl overflow-hidden shadow-xl ${isExpanded ? 'border-red-500/50 shadow-red-900/10' : 'border-slate-800 hover:border-slate-700'}`}>
                {/* Header do Card */}
                <div 
                  className="p-5 cursor-pointer flex items-center justify-between bg-slate-800/50 hover:bg-slate-800 transition-colors"
                  onClick={() => setExpandedRival(isExpanded ? null : rival.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-slate-950 border border-slate-700 rounded-full flex items-center justify-center text-red-400 font-black text-lg shadow-inner">
                      {rival.teamOvr || '?'}
                    </div>
                    <div>
                      <h4 className="font-bold text-lg text-slate-200">{rival.managerName || 'Adversário'}</h4>
                      <p className="text-xs text-slate-400 font-medium tracking-wider flex items-center gap-2">
                        {rival.formation || 'Formação Oculta'} • Estádio LvL {rival.stadiumLevel || 0}
                      </p>
                    </div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); deleteRival(rival.id, rival.managerName); }} className="p-2 text-slate-500 hover:text-red-400 transition-colors bg-slate-900 rounded-lg">
                    <Trash2 size={18} />
                  </button>
                </div>

                {/* Corpo Expandido */}
                {isExpanded && (
                  <div className="p-5 border-t border-slate-800 animate-fade-in bg-slate-900">
                    <div className="mb-5">
                      <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider mb-2"><Edit3 size={14}/> Anotações de Comportamento</label>
                      <textarea 
                        defaultValue={rival.notes || ''}
                        onBlur={(e) => updateNotes(rival.id, e.target.value)}
                        placeholder="Ex: Usa 451 contra times mais fortes. Adora fazer linha de impedimento."
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-slate-300 outline-none focus:border-red-500/50 resize-none h-20 placeholder:text-slate-600"
                      />
                      <p className="text-[10px] text-slate-500 mt-1 text-right">A IA lê essas notas antes de montar táticas contra ele.</p>
                    </div>

                    <div>
                      <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider mb-2"><Zap size={14}/> Elenco Identificado (Último Scout)</label>
                      <div className="max-h-48 overflow-y-auto custom-scrollbar pr-2 space-y-1.5">
                        {rival.players && rival.players.length > 0 ? rival.players.map((p, i) => (
                          <div key={i} className="flex justify-between items-center bg-slate-950 p-2.5 rounded-lg border border-slate-800/50">
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-slate-300">{p.name || 'Desconhecido'}</span>
                              <span className="text-[10px] font-bold text-blue-400">{p.pos || 'N/A'}</span>
                            </div>
                            <span className="text-sm font-black text-red-400 bg-red-950/30 px-2 py-1 rounded">{p.ovr || 0}</span>
                          </div>
                        )) : (
                          <p className="text-xs text-slate-500 italic p-2">Nenhum jogador lido na última imagem.</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}