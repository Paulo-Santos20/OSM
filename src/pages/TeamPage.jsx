import React, { useState, useRef } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { Camera, Loader2, Save, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { db } from '../config/firebase';
import { ai } from '../config/gemini';
import { fileToBase64, calculateTeamOvr } from '../utils/helpers';

export default function TeamPage({ activeTeamId, activeTeamName, teamData, setTeamData }) {
  const [isExtractionLoading, setIsExtractionLoading] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const teamImageInputRef = useRef(null);

  const handleExtractTeamData = async (e) => {
    const file = e.target.files[0];
    if (!file || !ai) return;

    setIsExtractionLoading(true);
    const loadingToast = toast.loading("Lendo atributos da imagem...");

    try {
      const base64Data = await fileToBase64(file);
      const prompt = `Extraia dados desta imagem. Retorne APENAS UM JSON VÁLIDO e nada mais. 
Formato Exato: {"formation":"4-3-3 B","players":[{"name":"GORDON","att":95,"def":37,"ovr":66}]}`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ inlineData: { data: base64Data, mimeType: file.type } }, prompt],
        config: { temperature: 0.1 } 
      });

      let rawText = response.text.replace(/```json/gi, '').replace(/```/g, '').trim();
      const extractedData = JSON.parse(rawText);
      
      // Calcula a média com base nos melhores status
      extractedData.teamOvr = calculateTeamOvr(extractedData.players);

      setTeamData(extractedData);
      setHasUnsavedChanges(true);
      toast.success("Foto analisada com sucesso!", { id: loadingToast });

    } catch (error) {
      console.error(error);
      toast.error("Falha na leitura. Tente um print mais nítido.", { id: loadingToast });
    } finally {
      setIsExtractionLoading(false);
      if (teamImageInputRef.current) teamImageInputRef.current.value = '';
    }
  };

  const updatePlayerStat = (index, field, value) => {
    const updatedPlayers = [...teamData.players];
    updatedPlayers[index][field] = Number(value);
    
    // Recalcula o Overall sempre que um atributo for alterado manualmente
    const newTeamOvr = calculateTeamOvr(updatedPlayers);
    
    setTeamData({ ...teamData, players: updatedPlayers, teamOvr: newTeamOvr });
    setHasUnsavedChanges(true);
  };

  const handleManualOvrChange = (e) => {
    // Permite que você substitua manualmente o cálculo automático
    setTeamData({ ...teamData, teamOvr: Number(e.target.value) });
    setHasUnsavedChanges(true);
  };

  const handleSaveToFirebase = async () => {
    if (!db) return;
    const savingToast = toast.loading("Salvando escalação...");
    try {
      await setDoc(doc(db, "teams", activeTeamId), teamData, { merge: true });
      setHasUnsavedChanges(false);
      toast.success("Elenco atualizado na nuvem!", { id: savingToast });
    } catch (error) {
      console.error(error);
      toast.error("Erro ao salvar no Firebase.", { id: savingToast });
    }
  };

  return (
    <div className="p-4 pb-10 max-w-3xl mx-auto w-full animate-fade-in">
      {hasUnsavedChanges && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm animate-pulse">
          <div className="flex items-center gap-3 text-amber-800">
            <AlertTriangle size={24} />
            <div className="text-sm">
              <p className="font-bold">Alterações não salvas</p>
              <p>Revise os números e confirme para salvar.</p>
            </div>
          </div>
          <button onClick={handleSaveToFirebase} className="w-full sm:w-auto bg-amber-500 hover:bg-amber-600 text-white px-6 py-2.5 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors shadow-md">
            <Save size={18} /> Salvar no Banco
          </button>
        </div>
      )}

      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 mb-6 text-center">
        <h3 className="text-lg font-bold mb-2">Escalação do {activeTeamName}</h3>
        <input type="file" accept="image/*" className="hidden" ref={teamImageInputRef} onChange={handleExtractTeamData} />
        <button onClick={() => teamImageInputRef.current.click()} disabled={isExtractionLoading} className="bg-white text-slate-700 border border-slate-300 rounded-full py-3 px-6 flex items-center justify-center gap-2 font-semibold hover:bg-slate-100 transition-colors mx-auto shadow-sm">
          {isExtractionLoading ? <Loader2 className="animate-spin" size={20} /> : <Camera size={20} />}
          {isExtractionLoading ? 'Processando imagem...' : 'Passo 1: Upload da Formação'}
        </button>
      </div>

      {teamData.players.length > 0 ? (
        <div>
          <h4 className="font-bold text-slate-700 mb-4 flex items-center justify-between">
            Revisão dos Jogadores 
            <div className="flex gap-2 items-center">
              
              {/* OVR Editável */}
              <div className="flex items-center gap-1 bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-bold shadow-sm focus-within:ring-2 focus-within:ring-green-400 transition-all">
                OVR
                <input 
                  type="number" 
                  value={teamData.teamOvr || 0} 
                  onChange={handleManualOvrChange} 
                  className="bg-transparent w-8 text-center outline-none font-bold text-green-900 placeholder:text-green-600/50" 
                />
              </div>

              <span className={`${hasUnsavedChanges ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'} px-3 py-1 rounded-full text-xs font-bold transition-colors shadow-sm`}>
                {teamData.formation}
              </span>
            </div>
          </h4>
          
          <div className="space-y-2">
            {/* Cabeçalho da Tabela - Ajustado para 12 colunas incluindo a Nota */}
            <div className="grid grid-cols-12 gap-1 px-2 sm:px-4 text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">
              <div className="col-span-4">Nome</div>
              <div className="col-span-2 text-center text-red-400">Atq</div>
              <div className="col-span-2 text-center text-blue-400">Def</div>
              <div className="col-span-2 text-center text-green-500">Ovr</div>
              <div className="col-span-2 text-center text-purple-500">Nota</div>
            </div>
            
            {teamData.players.map((player, idx) => {
              // Calcula a maior nota do jogador em tempo real
              const notaMaxima = Math.max(Number(player.att) || 0, Number(player.def) || 0, Number(player.ovr) || 0);

              return (
                <div key={idx} className={`bg-white border rounded-xl p-2 sm:p-3 grid grid-cols-12 gap-1 sm:gap-2 items-center shadow-sm transition-colors ${hasUnsavedChanges ? 'border-amber-200 hover:border-amber-400' : 'border-slate-200 hover:border-blue-300'}`}>
                  <div className="col-span-4 font-semibold text-xs sm:text-sm text-slate-700 truncate" title={player.name}>
                    {player.name}
                  </div>
                  <input type="number" value={player.att} onChange={(e) => updatePlayerStat(idx, 'att', e.target.value)} className="col-span-2 bg-slate-50 border-none rounded text-center text-xs sm:text-sm py-1 font-medium text-slate-600 outline-none focus:ring-1 focus:ring-blue-300 px-0" />
                  <input type="number" value={player.def} onChange={(e) => updatePlayerStat(idx, 'def', e.target.value)} className="col-span-2 bg-slate-50 border-none rounded text-center text-xs sm:text-sm py-1 font-medium text-slate-600 outline-none focus:ring-1 focus:ring-blue-300 px-0" />
                  <input type="number" value={player.ovr} onChange={(e) => updatePlayerStat(idx, 'ovr', e.target.value)} className="col-span-2 bg-green-50 text-green-700 border-none rounded text-center text-xs sm:text-sm py-1 font-bold outline-none focus:ring-1 focus:ring-green-300 px-0" />
                  
                  {/* Campo de Nota Máxima (Visual) */}
                  <div className="col-span-2 bg-purple-50 text-purple-700 rounded text-center text-xs sm:text-sm py-1 font-bold flex items-center justify-center border border-purple-100">
                    {notaMaxima}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="text-center text-slate-400">{teamData.formation === 'Buscando dados...' ? 'Conectando...' : 'Nenhum jogador carregado.'}</p>
      )}
    </div>
  );
}