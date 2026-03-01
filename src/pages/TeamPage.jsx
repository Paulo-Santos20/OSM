// src/pages/TeamPage.jsx

import React, { useState, useRef } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { Camera, Loader2, Save, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { db } from '../config/firebase';
import { ai } from '../config/gemini';
import { compressImageToBase64, calculateTeamOvr } from '../utils/helpers';

export default function TeamPage({ activeTeamId, activeTeamName, teamData, setTeamData }) {
  const [isExtractionLoading, setIsExtractionLoading] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const teamImageInputRef = useRef(null);

  const processImageFile = async (file) => {
    if (!ai || !file) return;
    setIsExtractionLoading(true);
    const loadingToast = toast.loading("Comprimindo e lendo atributos da imagem...");

    try {
      // Usa a nova função de compressão (JPEG otimizado para a IA)
      const base64Data = await compressImageToBase64(file);
      const prompt = `Extraia dados desta imagem. Retorne APENAS UM JSON VÁLIDO e nada mais. 
Formato Exato: {"formation":"4-3-3 B","players":[{"name":"GORDON","att":95,"def":37,"ovr":66}]}`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ inlineData: { data: base64Data, mimeType: 'image/jpeg' } }, prompt],
        config: { temperature: 0.1 } 
      });

      let rawText = response.text.replace(/```json/gi, '').replace(/```/g, '').trim();
      const extractedData = JSON.parse(rawText);
      extractedData.teamOvr = calculateTeamOvr(extractedData.players);

      setTeamData(extractedData);
      setHasUnsavedChanges(true);
      toast.success("Foto analisada com sucesso!", { id: loadingToast });

    } catch (error) {
      toast.error("Falha na leitura. Tente um print mais nítido.", { id: loadingToast });
    } finally {
      setIsExtractionLoading(false);
      if (teamImageInputRef.current) teamImageInputRef.current.value = '';
    }
  };

  const handleExtractTeamData = (e) => {
    if (e.target.files[0]) processImageFile(e.target.files[0]);
  };

  const handlePasteAnywhere = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        processImageFile(items[i].getAsFile());
        e.preventDefault(); 
        break;
      }
    }
  };

  const updatePlayerStat = (index, field, value) => {
    const updatedPlayers = [...teamData.players];
    updatedPlayers[index][field] = Number(value);
    const newTeamOvr = calculateTeamOvr(updatedPlayers);
    setTeamData({ ...teamData, players: updatedPlayers, teamOvr: newTeamOvr });
    setHasUnsavedChanges(true);
  };

  const handleManualOvrChange = (e) => {
    setTeamData({ ...teamData, teamOvr: Number(e.target.value) });
    setHasUnsavedChanges(true);
  };

  const handleSaveToFirebase = async () => {
    if (!db || !activeTeamId) return;
    const savingToast = toast.loading("Salvando escalação...");
    try {
      await setDoc(doc(db, "teams", activeTeamId), teamData, { merge: true });
      setHasUnsavedChanges(false);
      toast.success("Elenco atualizado na nuvem!", { id: savingToast });
    } catch (error) {
      toast.error("Erro ao salvar no Firebase.", { id: savingToast });
    }
  };

  if (!activeTeamId) {
    return <div className="p-10 text-center text-slate-500">Crie ou selecione um time primeiro.</div>;
  }

  return (
    <div 
      className="p-4 pb-10 max-w-3xl mx-auto w-full animate-fade-in outline-none"
      tabIndex={0} 
      onPaste={handlePasteAnywhere} 
    >
      {hasUnsavedChanges && (
        <div className="bg-yellow-900/30 border border-yellow-700/50 rounded-xl p-4 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm animate-pulse">
          <div className="flex items-center gap-3 text-yellow-400">
            <AlertTriangle size={24} />
            <div className="text-sm">
              <p className="font-bold">Alterações não salvas</p>
              <p className="text-yellow-500/80">Revise os números e confirme para salvar.</p>
            </div>
          </div>
          <button onClick={handleSaveToFirebase} className="w-full sm:w-auto bg-yellow-600 hover:bg-yellow-500 text-white px-6 py-2.5 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors shadow-md">
            <Save size={18} /> Salvar no Banco
          </button>
        </div>
      )}

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-6 text-center">
        <h3 className="text-lg font-bold mb-2 text-slate-200">Escalação do {activeTeamName}</h3>
        <p className="text-sm text-slate-400 mb-6">Você pode clicar no botão abaixo ou simplesmente <strong className="text-slate-200">dar Ctrl+V</strong> na imagem em qualquer lugar desta tela.</p>
        <input type="file" accept="image/*" className="hidden" ref={teamImageInputRef} onChange={handleExtractTeamData} />
        <button onClick={() => teamImageInputRef.current.click()} disabled={isExtractionLoading} className="bg-slate-800 text-slate-200 border border-slate-700 rounded-full py-3 px-6 flex items-center justify-center gap-2 font-semibold hover:bg-slate-700 transition-colors mx-auto shadow-sm">
          {isExtractionLoading ? <Loader2 className="animate-spin text-blue-400" size={20} /> : <Camera className="text-blue-400" size={20} />}
          {isExtractionLoading ? 'Processando imagem...' : 'Fazer Upload da Formação'}
        </button>
      </div>

      {teamData.players.length > 0 ? (
        <div>
          <h4 className="font-bold text-slate-300 mb-4 flex items-center justify-between">
            Revisão dos Jogadores 
            <div className="flex gap-2 items-center">
              <div className="flex items-center gap-1 bg-green-900/40 text-green-400 px-3 py-1 rounded-full text-xs font-bold border border-green-800/50 focus-within:border-green-400 transition-all">
                OVR
                <input type="number" value={teamData.teamOvr || 0} onChange={handleManualOvrChange} className="bg-transparent w-8 text-center outline-none font-bold text-green-300 placeholder:text-green-700" />
              </div>
              <span className={`${hasUnsavedChanges ? 'bg-yellow-900/40 text-yellow-400 border-yellow-800/50' : 'bg-blue-900/40 text-blue-400 border-blue-800/50'} border px-3 py-1 rounded-full text-xs font-bold transition-colors`}>
                {teamData.formation}
              </span>
            </div>
          </h4>
          
          <div className="space-y-2">
            <div className="grid grid-cols-12 gap-1 px-2 sm:px-4 text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">
              <div className="col-span-4">Nome</div>
              <div className="col-span-2 text-center text-red-400">Atq</div>
              <div className="col-span-2 text-center text-blue-400">Def</div>
              <div className="col-span-2 text-center text-green-400">Ovr</div>
              <div className="col-span-2 text-center text-purple-400">Nota</div>
            </div>
            
            {teamData.players.map((player, idx) => {
              const notaMaxima = Math.max(Number(player.att) || 0, Number(player.def) || 0, Number(player.ovr) || 0);

              return (
                <div key={idx} className={`bg-slate-900 border rounded-xl p-2 sm:p-3 grid grid-cols-12 gap-1 sm:gap-2 items-center shadow-sm transition-colors ${hasUnsavedChanges ? 'border-yellow-700/50 hover:border-yellow-500/50' : 'border-slate-800 hover:border-blue-500/50'}`}>
                  <div className="col-span-4 font-semibold text-xs sm:text-sm text-slate-300 truncate" title={player.name}>{player.name}</div>
                  <input type="number" value={player.att} onChange={(e) => updatePlayerStat(idx, 'att', e.target.value)} className="col-span-2 bg-slate-950 border border-slate-800 rounded text-center text-xs sm:text-sm py-1 font-medium text-slate-300 outline-none focus:border-blue-500 px-0" />
                  <input type="number" value={player.def} onChange={(e) => updatePlayerStat(idx, 'def', e.target.value)} className="col-span-2 bg-slate-950 border border-slate-800 rounded text-center text-xs sm:text-sm py-1 font-medium text-slate-300 outline-none focus:border-blue-500 px-0" />
                  <input type="number" value={player.ovr} onChange={(e) => updatePlayerStat(idx, 'ovr', e.target.value)} className="col-span-2 bg-slate-950 border border-slate-800 rounded text-center text-xs sm:text-sm py-1 font-bold text-green-400 outline-none focus:border-green-500 px-0" />
                  <div className="col-span-2 bg-purple-900/30 text-purple-400 rounded text-center text-xs sm:text-sm py-1 font-bold flex items-center justify-center border border-purple-800/50">
                    {notaMaxima}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="text-center text-slate-600">{teamData.formation === 'Buscando dados...' ? 'Conectando...' : 'Nenhum jogador carregado. Dê Ctrl+V aqui.'}</p>
      )}
    </div>
  );
}