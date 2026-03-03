// src/pages/CalendarPage.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Calendar, Loader2, Save, AlertTriangle, Battery, BatteryCharging, Zap, ShieldAlert, CheckCircle2, Camera, Trophy, Swords, CalendarDays } from 'lucide-react';
import toast from 'react-hot-toast';
import { db } from '../config/firebase';
import { ai } from '../config/gemini';
import { compressImageToBase64 } from '../utils/helpers';

export default function CalendarPage({ activeTeamId, activeTeamName, teamData, user }) {
  const [schedule, setSchedule] = useState({});
  const [upcomingMatches, setUpcomingMatches] = useState([
    { id: 0, title: 'Rodada 1', opponent: 'Adversário TBD', isCup: false, date: 'Hoje' },
    { id: 1, title: 'Rodada 2', opponent: 'Adversário TBD', isCup: false, date: 'Amanhã' },
    { id: 2, title: 'Rodada 3', opponent: 'Adversário TBD', isCup: false, date: 'Depois' }
  ]);
  const [isFetching, setIsFetching] = useState(true);
  const [isExtractionLoading, setIsExtractionLoading] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const calendarImageInputRef = useRef(null);

  // Busca o calendário e os oponentes salvos no Firebase
  useEffect(() => {
    const fetchSchedule = async () => {
      if (!activeTeamId || !db || !user) return;
      setIsFetching(true);
      try {
        const docRef = doc(db, "users", user.uid, `calendar_${activeTeamId}`, "matches");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setSchedule(data.schedule || {});
          if (data.upcomingMatches && data.upcomingMatches.length === 3) {
            setUpcomingMatches(data.upcomingMatches);
          }
        } else {
          setSchedule({});
        }
        setHasUnsavedChanges(false);
      } catch (error) {
        toast.error("Erro ao carregar o calendário.");
      } finally {
        setIsFetching(false);
      }
    };
    fetchSchedule();
  }, [activeTeamId, db, user]);

  const safePlayers = useMemo(() => {
    return [...(teamData.players || [])].sort((a, b) => b.ovr - a.ovr);
  }, [teamData.players]);

  const handleSaveSchedule = async () => {
    if (!db || !activeTeamId || !user) return;
    const savingToast = toast.loading("Salvando calendário...");
    try {
      await setDoc(doc(db, "users", user.uid, `calendar_${activeTeamId}`, "matches"), { 
        schedule, 
        upcomingMatches 
      }, { merge: true });
      setHasUnsavedChanges(false);
      toast.success("Rotação salva com sucesso!", { id: savingToast });
    } catch (error) {
      toast.error("Erro ao salvar.", { id: savingToast });
    }
  };

  const toggleMatch = (playerId, matchIndex) => {
    setSchedule(prev => {
      const playerSchedule = prev[playerId] || [false, false, false];
      const newSchedule = [...playerSchedule];
      newSchedule[matchIndex] = !newSchedule[matchIndex];
      return { ...prev, [playerId]: newSchedule };
    });
    setHasUnsavedChanges(true);
  };

  // ==========================================
  // EXTRAÇÃO DE CALENDÁRIO COM IA
  // ==========================================
  const extractCalendarWithBackupAI = async (base64Data, originalPrompt) => {
    const groqApiKey = import.meta.env.VITE_GROQ_API_KEY; 
    if (!groqApiKey) throw new Error("Chave VITE_GROQ_API_KEY não configurada.");
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${groqApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama-3.2-11b-vision-preview", 
        messages: [{ role: "user", content: [{ type: "text", text: originalPrompt }, { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Data}` } }] }],
        temperature: 0.1, max_tokens: 2048
      })
    });
    if (!response.ok) throw new Error("Groq API falhou.");
    const data = await response.json();
    return data.choices[0].message.content;
  };

  const processCalendarImage = async (file) => {
    if (!file) return;
    setIsExtractionLoading(true);
    const loadingToast = toast.loading("Lendo seu calendário oficial...");

    try {
      const base64Data = await compressImageToBase64(file);
      const prompt = `Você é um extrator de dados estrito. Analise a imagem do calendário de jogos do OSM.
Encontre exatamente os PRÓXIMOS 3 JOGOS que ainda VÃO acontecer (os que NÃO têm placar final como '0-2', e sim exibem um horário como '20:35', uma data como '04-03-26' ou 'TBD').
Para os 3 próximos jogos, extraia:
- "title": O nome do dia/rodada (ex: "Matchday 4", "Matchday 5").
- "opponent": O nome do adversário (ex: "Trabzonspor", "Quartos de final").
- "isCup": booleano, coloque true SE HOUVER um ícone de troféu no quadrado do jogo, false se não houver.
- "date": A data ou horário escrito no bloco. Se for um horário (ex: "20:35"), escreva "Hoje (20:35)". Se for data, escreva a data (ex: "04-03-26"). Se for TBD, escreva "A definir".
Retorne ABSOLUTAMENTE APENAS UM JSON VÁLIDO no formato:
{"upcomingMatches": [{"id": 0, "title": "Matchday 4", "opponent": "Trabzonspor", "isCup": false, "date": "Hoje (20:35)"}, {"id": 1, "title": "Matchday 5", "opponent": "Quartos de final", "isCup": true, "date": "04-03-26"}, {"id": 2, "title": "Matchday 6", "opponent": "Meias finais", "isCup": true, "date": "05-03-26"}]}`;

      let rawText = "";
      try {
        if (!ai) throw new Error("Gemini não configurado");
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [{ inlineData: { data: base64Data, mimeType: 'image/jpeg' } }, prompt],
          config: { temperature: 0.1 } 
        });
        rawText = response.text;
      } catch (geminiError) {
        toast.loading("Usando IA de backup...", { id: loadingToast });
        rawText = await extractCalendarWithBackupAI(base64Data, prompt);
      }

      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("Nenhum JSON válido.");

      const extractedData = JSON.parse(jsonMatch[0]);
      if (extractedData.upcomingMatches && extractedData.upcomingMatches.length > 0) {
        const formattedMatches = [0, 1, 2].map(i => {
          if (extractedData.upcomingMatches[i]) return extractedData.upcomingMatches[i];
          return { id: i, title: `Jogo ${i+1}`, opponent: 'TBD', isCup: false, date: 'Data TBD' };
        });
        setUpcomingMatches(formattedMatches);
        setHasUnsavedChanges(true);
        toast.success("Calendário sincronizado!", { id: loadingToast });
      } else {
        throw new Error("Formato inválido.");
      }
    } catch (error) {
      toast.error("Falha ao ler o calendário. Tente novamente.", { id: loadingToast });
    } finally {
      setIsExtractionLoading(false);
      if (calendarImageInputRef.current) calendarImageInputRef.current.value = '';
    }
  };

  const handlePasteAnywhere = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        processCalendarImage(items[i].getAsFile()); e.preventDefault(); break;
      }
    }
  };

  // Motor de Previsão de Energia (-15% se joga, +15% se descansa)
  const calculateEnergyProjections = (player) => {
    const baseEnergy = player.energy ?? 100;
    const plays = schedule[player.id] || [false, false, false];
    
    let current = baseEnergy;
    const projections = [];

    for (let i = 0; i < 3; i++) {
      projections.push(current); 
      if (plays[i]) current = current - 15; 
      else current = Math.min(100, current + 15); 
    }
    return projections;
  };

  const matchCounts = useMemo(() => {
    const counts = [0, 0, 0];
    safePlayers.forEach(p => {
      if (p.unavailable) return;
      const plays = schedule[p.id] || [false, false, false];
      if (plays[0]) counts[0]++;
      if (plays[1]) counts[1]++;
      if (plays[2]) counts[2]++;
    });
    return counts;
  }, [safePlayers, schedule]);

  const getEnergyColor = (energy) => {
    if (energy >= 85) return 'text-emerald-400 bg-emerald-950/30 border-emerald-800/50';
    if (energy >= 75) return 'text-yellow-400 bg-yellow-950/30 border-yellow-800/50';
    return 'text-red-400 bg-red-950/30 border-red-800/50';
  };

  if (isFetching) return <div className="p-20 flex justify-center"><Loader2 className="animate-spin text-blue-500" size={40} /></div>;

  if (safePlayers.length === 0) {
    return (
      <div className="p-10 flex flex-col items-center justify-center text-center animate-fade-in">
        <ShieldAlert size={48} className="text-slate-600 mb-4" />
        <h3 className="text-xl font-bold text-slate-400">Elenco Vazio</h3>
        <p className="text-slate-500 mt-2">Vá na aba Escalação e atualize o seu time primeiro para planejar o calendário.</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 pb-24 md:pb-10 max-w-6xl mx-auto w-full animate-fade-in outline-none" tabIndex={0} onPaste={handlePasteAnywhere}>
      
      {/* HEADER DA PÁGINA */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 mb-6 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-100 flex items-center gap-2 sm:gap-3">
            <CalendarDays className="text-emerald-400" size={28} /> Planejador de Rotação
          </h2>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">
            Simule o desgaste físico da sua equipe para Liga e Copas ao longo dos dias.
          </p>
        </div>
        {hasUnsavedChanges && (
          <button onClick={handleSaveSchedule} className="w-full md:w-auto bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors shadow-lg shadow-emerald-900/20">
            <Save size={18} /> Salvar Calendário
          </button>
        )}
      </div>

      {/* ÁREA DE SCAN DO CALENDÁRIO */}
      <div className="bg-slate-800 border border-blue-900/50 rounded-2xl p-5 sm:p-6 mb-6 text-center shadow-lg flex flex-col items-center justify-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 to-indigo-600"></div>
        <h3 className="text-base sm:text-lg font-bold mb-2 text-slate-200">Sincronizar Próximos Jogos</h3>
        <p className="text-xs sm:text-sm text-slate-400 mb-4 max-w-lg">
          Dê <strong className="text-slate-200">Ctrl+V</strong> no print da tela de Calendário (Fixtures) do OSM para extrair os dias e adversários.
        </p>
        <input type="file" accept="image/*" className="hidden" ref={calendarImageInputRef} onChange={(e) => processCalendarImage(e.target.files[0])} />
        <button onClick={() => calendarImageInputRef.current.click()} disabled={isExtractionLoading} className="bg-blue-600 text-white border-none rounded-xl py-2.5 px-6 flex items-center justify-center gap-2 text-sm font-bold hover:bg-blue-500 transition-colors shadow-lg shadow-blue-900/50">
          {isExtractionLoading ? <Loader2 className="animate-spin" size={18} /> : <Camera size={18} />}
          {isExtractionLoading ? 'Lendo Calendário...' : 'Colar Print do Calendário'}
        </button>
      </div>

      {/* DASHBOARD DE STATUS DAS RODADAS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {upcomingMatches.map((match, idx) => {
          const count = matchCounts[idx];
          const isOk = count === 11;
          const isOver = count > 11;
          return (
            <div key={idx} className={`p-4 rounded-2xl border flex items-center justify-between ${isOk ? 'bg-emerald-950/20 border-emerald-900/50' : isOver ? 'bg-red-950/20 border-red-900/50' : 'bg-slate-900 border-slate-800'}`}>
              <div className="flex flex-col min-w-0 pr-2 w-full">
                
                {/* NOVO: Badge da Data Embutido */}
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    {match.isCup ? <Trophy size={12} className="text-yellow-500"/> : <Swords size={12} className="text-blue-400"/>}
                    {match.title}
                  </span>
                  <span className="text-[9px] font-bold bg-blue-900/40 text-blue-300 border border-blue-800/50 px-2 py-0.5 rounded-full truncate max-w-[80px]">
                    {match.date || 'TBD'}
                  </span>
                </div>

                <span className="text-sm font-black text-slate-200 truncate" title={match.opponent}>
                  {match.opponent}
                </span>
                <span className={`text-xs font-bold mt-1 ${isOk ? 'text-emerald-400' : isOver ? 'text-red-400' : 'text-yellow-400'}`}>
                  {count} / 11 Escalados
                </span>
              </div>
              {isOk ? <CheckCircle2 className="text-emerald-500 flex-shrink-0 ml-2" size={24}/> : <AlertTriangle className={`${isOver ? "text-red-500" : "text-yellow-500"} flex-shrink-0 ml-2`} size={24}/>}
            </div>
          );
        })}
      </div>

      {/* MATRIZ DE JOGADORES */}
      <div className="space-y-4">
        {safePlayers.map(player => {
          const isUnavailable = player.unavailable;
          const projections = calculateEnergyProjections(player);
          const plays = schedule[player.id] || [false, false, false];

          return (
            <div key={player.id} className={`bg-slate-900 border rounded-2xl p-4 sm:p-5 flex flex-col xl:flex-row gap-4 shadow-md transition-all ${isUnavailable ? 'border-red-900/50 opacity-60' : 'border-slate-800 hover:border-slate-700'}`}>
              
              {/* Info do Jogador */}
              <div className="flex items-center gap-4 xl:w-1/4">
                <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center font-black text-base sm:text-lg border-2 flex-shrink-0 ${isUnavailable ? 'bg-red-950 text-red-500 border-red-900' : 'bg-slate-950 text-slate-200 border-slate-700'}`}>
                  {player.ovr}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="font-bold text-slate-200 text-sm sm:text-base truncate flex items-center gap-2">
                    {player.name} {isUnavailable && <Ban size={14} className="text-red-500"/>}
                  </span>
                  <span className="text-[10px] sm:text-[11px] font-bold text-blue-400">{player.pos} • Idade: {player.age || 25}</span>
                  <span className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                    <Battery size={12} className={player.energy < 75 ? 'text-yellow-500' : 'text-emerald-500'} /> Atual: {player.energy ?? 100}%
                  </span>
                </div>
              </div>

              {/* Botões de Rodada */}
              <div className="flex-1 grid grid-cols-3 gap-2 sm:gap-4">
                {[0, 1, 2].map(idx => {
                  const isPlaying = plays[idx];
                  const projectedEnergy = projections[idx];
                  const energyClass = getEnergyColor(projectedEnergy);
                  const willBeExhausted = isPlaying && projectedEnergy < 75;

                  return (
                    <button 
                      key={idx}
                      disabled={isUnavailable}
                      onClick={() => toggleMatch(player.id, idx)}
                      className={`relative flex flex-col items-center justify-center p-2 sm:p-3 rounded-xl border transition-all ${isUnavailable ? 'bg-slate-950 border-slate-800 cursor-not-allowed' : isPlaying ? (willBeExhausted ? 'bg-red-900/30 border-red-500/50' : 'bg-blue-600/20 border-blue-500/50') : 'bg-slate-950 border-slate-800 hover:bg-slate-800'}`}
                    >
                      {/* NOVO: Exibe a Data (Ex: Hoje) acima do status Titular/Poupar nos botões */}
                      <span className={`text-[8px] sm:text-[9px] font-bold uppercase tracking-wider mb-0.5 truncate w-full text-center px-1 text-slate-500`}>
                        {upcomingMatches[idx]?.date || `Jogo ${idx+1}`}
                      </span>

                      <span className={`text-[10px] sm:text-[11px] font-bold uppercase tracking-wider mb-1 truncate w-full text-center px-1 ${isPlaying ? (willBeExhausted ? 'text-red-400' : 'text-blue-400') : 'text-slate-400'}`}>
                        {isPlaying ? 'Titular' : 'Poupar'}
                      </span>
                      
                      <div className={`flex items-center gap-1 text-[11px] sm:text-sm font-black px-1.5 sm:px-2 py-1 rounded-md border ${energyClass}`}>
                        {isPlaying ? <Zap size={12} className="sm:w-[14px] sm:h-[14px]" /> : <BatteryCharging size={12} className="sm:w-[14px] sm:h-[14px]" />} {projectedEnergy}%
                      </div>
                      
                      {willBeExhausted && (
                        <div className="absolute -top-1.5 -right-1.5 sm:-top-2 sm:-right-2 bg-red-600 text-white rounded-full p-1 shadow-lg animate-pulse">
                          <AlertTriangle size={10} className="sm:w-3 sm:h-3" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

            </div>
          );
        })}
      </div>

    </div>
  );
}