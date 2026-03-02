// src/pages/SimulatorPage.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Dices, AlertTriangle, Home, Plane, Loader2, BarChart3, Activity, ShieldAlert } from 'lucide-react';

export default function SimulatorPage({ activeTeamId, activeTeamName, teamData, user }) {
  const [rivals, setRivals] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Controles do Simulador
  const [selectedRivalId, setSelectedRivalId] = useState('');
  const [isHome, setIsHome] = useState(true);
  const [myStadiumLevel, setMyStadiumLevel] = useState(0);

  // Busca os Rivais do Firebase
  useEffect(() => {
    if (!user || !activeTeamId || !db) return;
    const q = query(collection(db, "users", user.uid, `rivals_${activeTeamId}`));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRivals(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user, activeTeamId]);

  // Cálculos Automáticos de Probabilidade
  const simulation = useMemo(() => {
    if (!selectedRivalId) return null;
    const rival = rivals.find(r => r.id === selectedRivalId);
    if (!rival) return null;

    // 1. OVR Base
    const myBaseOvr = teamData.teamOvr || 0;
    const rivalBaseOvr = rival.teamOvr || 0;

    // 2. Penalidade de Fadiga/Suspensão (Olha pros 11 titulares)
    const starters = (teamData.players || []).filter(p => !p.isBench);
    let fatiguePenalty = 0;
    let missingPenalty = 0;

    starters.forEach(p => {
      if (p.unavailable) missingPenalty += 3; // Jogador suspenso escalado destrói o time
      else if (p.energy < 75) fatiguePenalty += 1.5; // Cansaço pesa muito no OSM
    });

    const myTrueOvr = myBaseOvr - fatiguePenalty - missingPenalty;

    // 3. Fator Casa/Estádio (Cada nível de estádio = +2 OVR invisível no motor do jogo)
    let myFinalOvr = myTrueOvr;
    let rivalFinalOvr = rivalBaseOvr;

    if (isHome) {
      myFinalOvr += (myStadiumLevel * 2);
    } else {
      rivalFinalOvr += ((rival.stadiumLevel || 0) * 2);
    }

    // 4. Algoritmo de Probabilidade
    const diff = myFinalOvr - rivalFinalOvr;
    
    let winProb = 45 + (diff * 3); // 1 de OVR de vantagem = +3% de chance de vitória
    let drawProb = 25 - (Math.abs(diff) * 0.8); // Quanto maior a diferença, menor a chance de empate
    
    // Limits
    if (winProb > 95) winProb = 95;
    if (winProb < 5) winProb = 5;
    if (drawProb < 5) drawProb = 5;
    if (drawProb > 35) drawProb = 35;
    
    let lossProb = 100 - winProb - drawProb;
    if (lossProb < 0) { lossProb = 0; winProb = 100 - drawProb; }

    return {
      rival,
      myBaseOvr,
      myTrueOvr,
      myFinalOvr,
      rivalFinalOvr,
      fatiguePenalty,
      missingPenalty,
      stadiumBonus: isHome ? (myStadiumLevel * 2) : 0,
      rivalStadiumBonus: !isHome ? ((rival.stadiumLevel || 0) * 2) : 0,
      win: Math.round(winProb),
      draw: Math.round(drawProb),
      loss: Math.round(lossProb)
    };
  }, [selectedRivalId, rivals, isHome, myStadiumLevel, teamData]);

  if (loading) return <div className="p-20 flex justify-center"><Loader2 className="animate-spin text-blue-500" size={40} /></div>;

  return (
    <div className="p-4 pb-10 max-w-5xl mx-auto w-full animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-8 shadow-lg flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-100 flex items-center gap-3">
            <Dices className="text-purple-400" size={28}/> Simulador Pré-Match
          </h2>
          <p className="text-slate-400 text-sm mt-1">Calcule suas chances reais de vitória cruzando sua fadiga com o Dossiê do adversário.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* COLUNA ESQUERDA: CONTROLES */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-slate-800 border border-slate-700 p-5 rounded-2xl shadow-xl">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Próximo Adversário</label>
            <select 
              value={selectedRivalId} 
              onChange={(e) => setSelectedRivalId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-slate-200 outline-none focus:border-purple-500 transition-all font-semibold appearance-none"
            >
              <option value="">Selecione no Dossiê...</option>
              {rivals.map(r => (
                <option key={r.id} value={r.id}>{r.managerName} (OVR {r.teamOvr})</option>
              ))}
            </select>
            {rivals.length === 0 && (
              <p className="text-[11px] text-red-400 mt-2">Você precisa extrair os dados de um rival no Chat primeiro.</p>
            )}

            <div className="mt-6">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Mando de Campo</label>
              <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-700">
                <button onClick={() => setIsHome(true)} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-all ${isHome ? 'bg-purple-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}>
                  <Home size={16}/> Em Casa
                </button>
                <button onClick={() => setIsHome(false)} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-all ${!isHome ? 'bg-slate-700 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}>
                  <Plane size={16}/> Fora
                </button>
              </div>
            </div>

            {isHome && (
              <div className="mt-6 animate-fade-in">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Seu Estádio (Nível)</label>
                <div className="flex gap-2">
                  {[0, 1, 2, 3].map(lvl => (
                    <button 
                      key={lvl} 
                      onClick={() => setMyStadiumLevel(lvl)}
                      className={`flex-1 py-2 rounded-lg font-black transition-all border ${myStadiumLevel === lvl ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-950 border-slate-700 text-slate-500 hover:bg-slate-800'}`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-slate-500 mt-1 text-center">Nível do Gramado (+2 OVR por nv)</p>
              </div>
            )}
          </div>

          <div className="bg-blue-900/20 border border-blue-900/50 p-5 rounded-2xl">
            <h4 className="text-sm font-bold text-blue-400 mb-3 flex items-center gap-2"><Activity size={18}/> Análise Física do Seu Time</h4>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Força Base (Titulares)</span>
                <span className="font-bold text-slate-200">{teamData.teamOvr || 0} OVR</span>
              </div>
              {simulation && simulation.fatiguePenalty > 0 && (
                <div className="flex justify-between text-sm text-yellow-400">
                  <span>Queda por Fadiga (&lt;75%)</span>
                  <span className="font-bold">-{simulation.fatiguePenalty.toFixed(1)} OVR</span>
                </div>
              )}
              {simulation && simulation.missingPenalty > 0 && (
                <div className="flex justify-between text-sm text-red-400">
                  <span>Suspensos em Campo</span>
                  <span className="font-bold">-{simulation.missingPenalty.toFixed(1)} OVR</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* COLUNA DIREITA: RESULTADO DA SIMULAÇÃO */}
        <div className="lg:col-span-2">
          {!simulation ? (
            <div className="h-full bg-slate-900/50 border border-slate-800 border-dashed rounded-2xl flex flex-col items-center justify-center p-10 text-center min-h-[300px]">
              <BarChart3 size={48} className="text-slate-700 mb-4" />
              <p className="text-slate-400 font-bold">Aguardando Parâmetros</p>
              <p className="text-sm text-slate-500 mt-1">Selecione um adversário ao lado para rodar o motor de probabilidade.</p>
            </div>
          ) : (
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-2xl animate-fade-in relative overflow-hidden">
              
              <div className="flex justify-between items-end mb-8 relative z-10">
                <div className="flex flex-col items-center">
                  <span className="text-xs font-bold text-blue-400 uppercase mb-2">Você</span>
                  <div className="w-20 h-20 bg-slate-900 border-4 border-blue-500 rounded-full flex flex-col items-center justify-center shadow-[0_0_15px_rgba(59,130,246,0.3)]">
                    <span className="text-2xl font-black text-white">{simulation.myFinalOvr.toFixed(1)}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-2 font-bold">{isHome ? 'Em Casa' : 'Fora'}</span>
                </div>
                
                <div className="pb-6 px-4 text-center flex-1">
                  <span className="text-2xl font-black italic text-slate-700">VS</span>
                </div>

                <div className="flex flex-col items-center">
                  <span className="text-xs font-bold text-red-400 uppercase mb-2 truncate max-w-[100px]">{simulation.rival.managerName}</span>
                  <div className="w-20 h-20 bg-slate-900 border-4 border-red-500 rounded-full flex flex-col items-center justify-center shadow-[0_0_15px_rgba(239,68,68,0.3)]">
                    <span className="text-2xl font-black text-white">{simulation.rivalFinalOvr.toFixed(1)}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-2 font-bold">{!isHome ? `Estádio Nv ${simulation.rival.stadiumLevel || 0}` : 'Visitante'}</span>
                </div>
              </div>

              {/* GRÁFICO DE BARRAS (PROBABILIDADE) */}
              <h3 className="text-center font-bold text-slate-300 uppercase tracking-widest mb-6">Probabilidade do Motor</h3>
              
              <div className="space-y-5 relative z-10">
                {/* BARRA DE VITÓRIA */}
                <div>
                  <div className="flex justify-between text-sm mb-1 font-bold">
                    <span className="text-emerald-400">Vitória</span>
                    <span className="text-emerald-400">{simulation.win}%</span>
                  </div>
                  <div className="h-4 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-700">
                    <div className="h-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)] transition-all duration-1000 ease-out" style={{ width: `${simulation.win}%` }}></div>
                  </div>
                </div>

                {/* BARRA DE EMPATE */}
                <div>
                  <div className="flex justify-between text-sm mb-1 font-bold">
                    <span className="text-yellow-400">Empate</span>
                    <span className="text-yellow-400">{simulation.draw}%</span>
                  </div>
                  <div className="h-4 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-700">
                    <div className="h-full bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.8)] transition-all duration-1000 ease-out" style={{ width: `${simulation.draw}%` }}></div>
                  </div>
                </div>

                {/* BARRA DE DERROTA */}
                <div>
                  <div className="flex justify-between text-sm mb-1 font-bold">
                    <span className="text-red-400">Derrota</span>
                    <span className="text-red-400">{simulation.loss}%</span>
                  </div>
                  <div className="h-4 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-700">
                    <div className="h-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)] transition-all duration-1000 ease-out" style={{ width: `${simulation.loss}%` }}></div>
                  </div>
                </div>
              </div>

              {simulation.loss > 40 && (
                <div className="mt-8 bg-red-950/40 border border-red-900 rounded-xl p-4 flex gap-3 text-red-200">
                  <ShieldAlert className="flex-shrink-0 text-red-400" />
                  <div className="text-sm">
                    <p className="font-bold mb-1">Risco Crítico de Derrota!</p>
                    <p className="opacity-80">Suas chances são baixas. Vá no Chat Tático e peça para a IA usar a tática "Contra-Ataque" ou "Estacionar o Ônibus".</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}