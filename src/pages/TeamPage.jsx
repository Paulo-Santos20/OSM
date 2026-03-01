// src/pages/TeamPage.jsx
import React, { useState, useRef, useEffect } from 'react';
import { doc, setDoc, getDoc } from 'firebase/firestore'; // Adicionado getDoc
import { Camera, Loader2, Save, AlertTriangle, UserPlus, Zap, Trash2, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { db } from '../config/firebase';
import { ai } from '../config/gemini';
import { compressImageToBase64, calculateTeamOvr } from '../utils/helpers';

const FORMATIONS_MAP = {
  // --- ATTACKING ---
  "4-3-3A": [
    { id: 0, label: 'GK', top: '88%', left: '50%' },
    { id: 1, label: 'LB', top: '70%', left: '15%' }, { id: 2, label: 'CB', top: '70%', left: '35%' }, { id: 3, label: 'CB', top: '70%', left: '65%' }, { id: 4, label: 'RB', top: '70%', left: '85%' },
    { id: 5, label: 'CM', top: '45%', left: '30%' }, { id: 6, label: 'CM', top: '45%', left: '50%' }, { id: 7, label: 'CM', top: '45%', left: '70%' },
    { id: 8, label: 'LW', top: '20%', left: '20%' }, { id: 9, label: 'ST', top: '12%', left: '50%' }, { id: 10, label: 'RW', top: '20%', left: '80%' }
  ],
  "4-3-3B": [
    { id: 0, label: 'GK', top: '88%', left: '50%' },
    { id: 1, label: 'LB', top: '70%', left: '15%' }, { id: 2, label: 'CB', top: '70%', left: '35%' }, { id: 3, label: 'CB', top: '70%', left: '65%' }, { id: 4, label: 'RB', top: '70%', left: '85%' },
    { id: 5, label: 'CM', top: '45%', left: '30%' }, { id: 6, label: 'CDM', top: '58%', left: '50%' }, { id: 7, label: 'CM', top: '45%', left: '70%' },
    { id: 8, label: 'LW', top: '20%', left: '20%' }, { id: 9, label: 'ST', top: '12%', left: '50%' }, { id: 10, label: 'RW', top: '20%', left: '80%' }
  ],
  "3-4-3A": [
    { id: 0, label: 'GK', top: '88%', left: '50%' },
    { id: 1, label: 'CB', top: '70%', left: '25%' }, { id: 2, label: 'CB', top: '70%', left: '50%' }, { id: 3, label: 'CB', top: '70%', left: '75%' },
    { id: 4, label: 'LM', top: '45%', left: '15%' }, { id: 5, label: 'CM', top: '45%', left: '35%' }, { id: 6, label: 'CM', top: '45%', left: '65%' }, { id: 7, label: 'RM', top: '45%', left: '85%' },
    { id: 8, label: 'LW', top: '20%', left: '20%' }, { id: 9, label: 'ST', top: '12%', left: '50%' }, { id: 10, label: 'RW', top: '20%', left: '80%' }
  ],
  "3-4-3B": [
    { id: 0, label: 'GK', top: '88%', left: '50%' },
    { id: 1, label: 'CB', top: '70%', left: '25%' }, { id: 2, label: 'CB', top: '70%', left: '50%' }, { id: 3, label: 'CB', top: '70%', left: '75%' },
    { id: 4, label: 'LM', top: '45%', left: '15%' }, { id: 5, label: 'CDM', top: '55%', left: '50%' }, { id: 6, label: 'CAM', top: '35%', left: '50%' }, { id: 7, label: 'RM', top: '45%', left: '85%' },
    { id: 8, label: 'LW', top: '20%', left: '20%' }, { id: 9, label: 'ST', top: '12%', left: '50%' }, { id: 10, label: 'RW', top: '20%', left: '80%' }
  ],
  "4-2-4A": [
    { id: 0, label: 'GK', top: '88%', left: '50%' },
    { id: 1, label: 'LB', top: '70%', left: '15%' }, { id: 2, label: 'CB', top: '70%', left: '35%' }, { id: 3, label: 'CB', top: '70%', left: '65%' }, { id: 4, label: 'RB', top: '70%', left: '85%' },
    { id: 5, label: 'CM', top: '45%', left: '35%' }, { id: 6, label: 'CM', top: '45%', left: '65%' },
    { id: 7, label: 'LW', top: '20%', left: '15%' }, { id: 8, label: 'ST', top: '15%', left: '35%' }, { id: 9, label: 'ST', top: '15%', left: '65%' }, { id: 10, label: 'RW', top: '20%', left: '85%' }
  ],
  "4-2-4B": [
    { id: 0, label: 'GK', top: '88%', left: '50%' },
    { id: 1, label: 'LB', top: '70%', left: '15%' }, { id: 2, label: 'CB', top: '70%', left: '35%' }, { id: 3, label: 'CB', top: '70%', left: '65%' }, { id: 4, label: 'RB', top: '70%', left: '85%' },
    { id: 5, label: 'CDM', top: '55%', left: '35%' }, { id: 6, label: 'CDM', top: '55%', left: '65%' },
    { id: 7, label: 'LW', top: '20%', left: '15%' }, { id: 8, label: 'ST', top: '15%', left: '35%' }, { id: 9, label: 'ST', top: '15%', left: '65%' }, { id: 10, label: 'RW', top: '20%', left: '85%' }
  ],

  // --- BALANCED ---
  "4-4-2A": [
    { id: 0, label: 'GK', top: '88%', left: '50%' },
    { id: 1, label: 'LB', top: '70%', left: '15%' }, { id: 2, label: 'CB', top: '70%', left: '35%' }, { id: 3, label: 'CB', top: '70%', left: '65%' }, { id: 4, label: 'RB', top: '70%', left: '85%' },
    { id: 5, label: 'LM', top: '45%', left: '15%' }, { id: 6, label: 'CM', top: '45%', left: '35%' }, { id: 7, label: 'CM', top: '45%', left: '65%' }, { id: 8, label: 'RM', top: '45%', left: '85%' },
    { id: 9, label: 'ST', top: '15%', left: '35%' }, { id: 10, label: 'ST', top: '15%', left: '65%' }
  ],
  "4-4-2B": [
    { id: 0, label: 'GK', top: '88%', left: '50%' },
    { id: 1, label: 'LB', top: '70%', left: '15%' }, { id: 2, label: 'CB', top: '70%', left: '35%' }, { id: 3, label: 'CB', top: '70%', left: '65%' }, { id: 4, label: 'RB', top: '70%', left: '85%' },
    { id: 5, label: 'CDM', top: '58%', left: '50%' }, { id: 6, label: 'LM', top: '45%', left: '20%' }, { id: 7, label: 'RM', top: '45%', left: '80%' }, { id: 8, label: 'CAM', top: '32%', left: '50%' },
    { id: 9, label: 'ST', top: '15%', left: '35%' }, { id: 10, label: 'ST', top: '15%', left: '65%' }
  ],
  "3-5-2": [
    { id: 0, label: 'GK', top: '88%', left: '50%' },
    { id: 1, label: 'CB', top: '70%', left: '25%' }, { id: 2, label: 'CB', top: '70%', left: '50%' }, { id: 3, label: 'CB', top: '70%', left: '75%' },
    { id: 4, label: 'CDM', top: '58%', left: '35%' }, { id: 5, label: 'CDM', top: '58%', left: '65%' },
    { id: 6, label: 'LM', top: '40%', left: '15%' }, { id: 7, label: 'CAM', top: '35%', left: '50%' }, { id: 8, label: 'RM', top: '40%', left: '85%' },
    { id: 9, label: 'ST', top: '15%', left: '35%' }, { id: 10, label: 'ST', top: '15%', left: '65%' }
  ],
  "4-2-3-1": [
    { id: 0, label: 'GK', top: '88%', left: '50%' },
    { id: 1, label: 'LB', top: '70%', left: '15%' }, { id: 2, label: 'CB', top: '70%', left: '35%' }, { id: 3, label: 'CB', top: '70%', left: '65%' }, { id: 4, label: 'RB', top: '70%', left: '85%' },
    { id: 5, label: 'CDM', top: '55%', left: '35%' }, { id: 6, label: 'CDM', top: '55%', left: '65%' },
    { id: 7, label: 'LM', top: '35%', left: '20%' }, { id: 8, label: 'CAM', top: '35%', left: '50%' }, { id: 9, label: 'RM', top: '35%', left: '80%' },
    { id: 10, label: 'ST', top: '12%', left: '50%' }
  ],
  "3-3-2-2": [ 
    { id: 0, label: 'GK', top: '88%', left: '50%' },
    { id: 1, label: 'CB', top: '70%', left: '25%' }, { id: 2, label: 'CB', top: '70%', left: '50%' }, { id: 3, label: 'CB', top: '70%', left: '75%' },
    { id: 4, label: 'CM', top: '50%', left: '25%' }, { id: 5, label: 'CM', top: '50%', left: '50%' }, { id: 6, label: 'CM', top: '50%', left: '75%' },
    { id: 7, label: 'CAM', top: '32%', left: '35%' }, { id: 8, label: 'CAM', top: '32%', left: '65%' },
    { id: 9, label: 'ST', top: '15%', left: '35%' }, { id: 10, label: 'ST', top: '15%', left: '65%' }
  ],

  // --- DEFENSIVE ---
  "6-3-1A": [
    { id: 0, label: 'GK', top: '88%', left: '50%' },
    { id: 1, label: 'LWB', top: '65%', left: '10%' }, { id: 2, label: 'CB', top: '72%', left: '25%' }, { id: 3, label: 'CB', top: '72%', left: '42%' }, { id: 4, label: 'CB', top: '72%', left: '58%' }, { id: 5, label: 'CB', top: '72%', left: '75%' }, { id: 6, label: 'RWB', top: '65%', left: '90%' },
    { id: 7, label: 'CM', top: '45%', left: '30%' }, { id: 8, label: 'CM', top: '45%', left: '50%' }, { id: 9, label: 'CM', top: '45%', left: '70%' },
    { id: 10, label: 'ST', top: '15%', left: '50%' }
  ],
  "6-3-1B": [ 
    { id: 0, label: 'GK', top: '88%', left: '50%' },
    { id: 1, label: 'LWB', top: '65%', left: '10%' }, { id: 2, label: 'CB', top: '72%', left: '25%' }, { id: 3, label: 'CB', top: '72%', left: '42%' }, { id: 4, label: 'CB', top: '72%', left: '58%' }, { id: 5, label: 'CB', top: '72%', left: '75%' }, { id: 6, label: 'RWB', top: '65%', left: '90%' },
    { id: 7, label: 'CDM', top: '55%', left: '50%' }, { id: 8, label: 'LM', top: '40%', left: '25%' }, { id: 9, label: 'RM', top: '40%', left: '75%' },
    { id: 10, label: 'ST', top: '15%', left: '50%' }
  ],
  "5-4-1A": [
    { id: 0, label: 'GK', top: '88%', left: '50%' },
    { id: 1, label: 'LWB', top: '65%', left: '15%' }, { id: 2, label: 'CB', top: '72%', left: '35%' }, { id: 3, label: 'CB', top: '72%', left: '50%' }, { id: 4, label: 'CB', top: '72%', left: '65%' }, { id: 5, label: 'RWB', top: '65%', left: '85%' },
    { id: 6, label: 'LM', top: '45%', left: '20%' }, { id: 7, label: 'CM', top: '45%', left: '40%' }, { id: 8, label: 'CM', top: '45%', left: '60%' }, { id: 9, label: 'RM', top: '45%', left: '80%' },
    { id: 10, label: 'ST', top: '15%', left: '50%' }
  ],
  "5-4-1B": [
    { id: 0, label: 'GK', top: '88%', left: '50%' },
    { id: 1, label: 'LWB', top: '65%', left: '15%' }, { id: 2, label: 'CB', top: '72%', left: '35%' }, { id: 3, label: 'CB', top: '72%', left: '50%' }, { id: 4, label: 'CB', top: '72%', left: '65%' }, { id: 5, label: 'RWB', top: '65%', left: '85%' },
    { id: 6, label: 'CDM', top: '55%', left: '40%' }, { id: 7, label: 'CDM', top: '55%', left: '60%' }, { id: 8, label: 'CAM', top: '35%', left: '40%' }, { id: 9, label: 'CAM', top: '35%', left: '60%' },
    { id: 10, label: 'ST', top: '15%', left: '50%' }
  ],
  "5-3-1-1": [
    { id: 0, label: 'GK', top: '88%', left: '50%' },
    { id: 1, label: 'LWB', top: '65%', left: '15%' }, { id: 2, label: 'CB', top: '72%', left: '35%' }, { id: 3, label: 'CB', top: '72%', left: '50%' }, { id: 4, label: 'CB', top: '72%', left: '65%' }, { id: 5, label: 'RWB', top: '65%', left: '85%' },
    { id: 6, label: 'CM', top: '50%', left: '30%' }, { id: 7, label: 'CM', top: '50%', left: '50%' }, { id: 8, label: 'CM', top: '50%', left: '70%' },
    { id: 9, label: 'CAM', top: '30%', left: '50%' },
    { id: 10, label: 'ST', top: '12%', left: '50%' }
  ],
  "5-3-2": [
    { id: 0, label: 'GK', top: '88%', left: '50%' },
    { id: 1, label: 'LWB', top: '65%', left: '15%' }, { id: 2, label: 'CB', top: '72%', left: '35%' }, { id: 3, label: 'CB', top: '72%', left: '50%' }, { id: 4, label: 'CB', top: '72%', left: '65%' }, { id: 5, label: 'RWB', top: '65%', left: '85%' },
    { id: 6, label: 'CM', top: '45%', left: '30%' }, { id: 7, label: 'CM', top: '45%', left: '50%' }, { id: 8, label: 'CM', top: '45%', left: '70%' },
    { id: 9, label: 'ST', top: '15%', left: '35%' }, { id: 10, label: 'ST', top: '15%', left: '65%' }
  ],
  "5-2-3A": [
    { id: 0, label: 'GK', top: '88%', left: '50%' },
    { id: 1, label: 'LWB', top: '65%', left: '15%' }, { id: 2, label: 'CB', top: '72%', left: '35%' }, { id: 3, label: 'CB', top: '72%', left: '50%' }, { id: 4, label: 'CB', top: '72%', left: '65%' }, { id: 5, label: 'RWB', top: '65%', left: '85%' },
    { id: 6, label: 'CM', top: '45%', left: '35%' }, { id: 7, label: 'CM', top: '45%', left: '65%' },
    { id: 8, label: 'LW', top: '20%', left: '20%' }, { id: 9, label: 'ST', top: '15%', left: '50%' }, { id: 10, label: 'RW', top: '20%', left: '80%' }
  ],
  "5-2-3B": [
    { id: 0, label: 'GK', top: '88%', left: '50%' },
    { id: 1, label: 'LWB', top: '65%', left: '15%' }, { id: 2, label: 'CB', top: '72%', left: '35%' }, { id: 3, label: 'CB', top: '72%', left: '50%' }, { id: 4, label: 'CB', top: '72%', left: '65%' }, { id: 5, label: 'RWB', top: '65%', left: '85%' },
    { id: 6, label: 'CDM', top: '55%', left: '35%' }, { id: 7, label: 'CDM', top: '55%', left: '65%' },
    { id: 8, label: 'LW', top: '20%', left: '20%' }, { id: 9, label: 'ST', top: '15%', left: '50%' }, { id: 10, label: 'RW', top: '20%', left: '80%' }
  ],
  "4-5-1": [
    { id: 0, label: 'GK', top: '88%', left: '50%' },
    { id: 1, label: 'LB', top: '70%', left: '15%' }, { id: 2, label: 'CB', top: '70%', left: '35%' }, { id: 3, label: 'CB', top: '70%', left: '65%' }, { id: 4, label: 'RB', top: '70%', left: '85%' },
    { id: 5, label: 'LM', top: '45%', left: '15%' }, { id: 6, label: 'CM', top: '45%', left: '32%' }, { id: 7, label: 'CM', top: '45%', left: '50%' }, { id: 8, label: 'CM', top: '45%', left: '68%' }, { id: 9, label: 'RM', top: '45%', left: '85%' },
    { id: 10, label: 'ST', top: '15%', left: '50%' }
  ]
};

export default function TeamPage({ activeTeamId, activeTeamName, teamData, setTeamData }) {
  const [isExtractionLoading, setIsExtractionLoading] = useState(false);
  const [isFetchingData, setIsFetchingData] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const teamImageInputRef = useRef(null);

  /**
   * 🔄 BUSCA INICIAL DE DADOS DA URL (FIREBASE)
   * Garante que toda vez que a URL/activeTeamId mudar, a tela carrega o time salvo do banco.
   */
  useEffect(() => {
    const fetchTeamFromFirebase = async () => {
      if (!activeTeamId || !db) return;
      
      setIsFetchingData(true);
      try {
        const docRef = doc(db, "teams", activeTeamId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          setTeamData({
            formation: data.formation || "4-3-3B",
            players: data.players || [],
            teamOvr: data.teamOvr || 0
          });
        } else {
          // Time novo, sem dados no banco ainda
          setTeamData({ formation: "4-3-3B", players: [], teamOvr: 0 });
        }
        setHasUnsavedChanges(false);
      } catch (error) {
        console.error("Erro ao buscar dados da equipe:", error);
        toast.error("Erro ao carregar a escalação salva.");
      } finally {
        setIsFetchingData(false);
      }
    };

    fetchTeamFromFirebase();
  }, [activeTeamId, db, setTeamData]);

  const getMacroSector = (pos) => {
    const p = pos.toUpperCase();
    if (['GK', 'GOL'].includes(p)) return 'GK';
    if (['CB', 'LB', 'RB', 'LWB', 'RWB', 'DEF', 'ZAG', 'LAT'].includes(p)) return 'DEF';
    if (['CM', 'CDM', 'CAM', 'LM', 'RM', 'MID', 'MEI', 'VOL'].includes(p)) return 'MID';
    if (['ST', 'LW', 'RW', 'CF', 'ATT', 'ATQ', 'ATA', 'PE', 'PD', 'SA'].includes(p)) return 'ATT';
    return 'ANY';
  };

  const autoAssignPositions = (roster, formationStr) => {
    const pitchConfig = FORMATIONS_MAP[formationStr] || FORMATIONS_MAP["4-3-3B"];
    let assignedRoster = [...roster];
    
    assignedRoster.forEach(p => { p.pitchPos = null; p.isBench = true; });
    const sortedPlayers = [...assignedRoster].sort((a, b) => b.ovr - a.ovr);

    sortedPlayers.forEach(player => {
      const pPos = player.pos?.toUpperCase() || '';
      const pSector = getMacroSector(pPos);

      let targetSlot = pitchConfig.find(slot => 
        slot.label === pPos && !assignedRoster.some(r => r.pitchPos === slot.id)
      );

      if (!targetSlot) {
        targetSlot = pitchConfig.find(slot => {
          const slotSector = getMacroSector(slot.label);
          return slotSector === pSector && !assignedRoster.some(r => r.pitchPos === slot.id);
        });
      }

      if (!targetSlot) {
        targetSlot = pitchConfig.find(slot => !assignedRoster.some(r => r.pitchPos === slot.id));
      }

      if (targetSlot !== undefined) {
        const playerIndex = assignedRoster.findIndex(r => r.id === player.id);
        assignedRoster[playerIndex].pitchPos = targetSlot.id;
        assignedRoster[playerIndex].isBench = false;
      }
    });

    return assignedRoster;
  };

  const handleMergePlayers = (scannedPlayers, currentPlayers = [], newFormation, oldFormation) => {
    let updatedRoster = [...currentPlayers];

    updatedRoster = updatedRoster.map(p => {
      const foundInScan = scannedPlayers.find(s => s.name.toUpperCase() === p.name.toUpperCase());
      if (!foundInScan) return { ...p }; 

      const maxOvr = Math.max(Number(foundInScan.att) || 0, Number(foundInScan.def) || 0, Number(foundInScan.ovr) || 0);
      return { 
        ...p, 
        att: foundInScan.att, 
        def: foundInScan.def, 
        ovr: maxOvr,
        pos: foundInScan.pos || p.pos 
      };
    });

    scannedPlayers.forEach((scannedPlayer, idx) => {
      const exists = updatedRoster.find(p => p.name.toUpperCase() === scannedPlayer.name.toUpperCase());
      if (!exists) {
        const maxOvr = Math.max(Number(scannedPlayer.att) || 0, Number(scannedPlayer.def) || 0, Number(scannedPlayer.ovr) || 0);
        updatedRoster.push({
          ...scannedPlayer,
          ovr: maxOvr,
          id: `player_${Date.now()}_${idx}`,
          isBench: true,
          pitchPos: null
        });
      }
    });

    const currentStarters = updatedRoster.filter(p => p.isBench === false);
    
    if (newFormation !== oldFormation || currentStarters.length === 0) {
      return autoAssignPositions(updatedRoster, newFormation);
    }

    return updatedRoster;
  };

  const extractWithBackupAI = async (base64Data, originalPrompt) => {
    const groqApiKey = import.meta.env.VITE_GROQ_API_KEY; 
    
    if (!groqApiKey) {
      throw new Error("Chave VITE_GROQ_API_KEY não configurada. Fallback falhou.");
    }

    const aggressivePrompt = `${originalPrompt}\n\nIMPORTANTE: A imagem contém uma tabela com VÁRIOS jogadores. Você DEVE extrair TODOS os jogadores visíveis na imagem, do primeiro ao último. Não pare após o primeiro jogador! Gere o JSON com a lista completa.`;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${groqApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "meta-llama/llama-4-scout-17b-16e-instruct", 
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: aggressivePrompt },
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Data}` } }
            ]
          }
        ],
        temperature: 0.1,
        max_tokens: 4096
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      const errorMessage = errorData?.error?.message || response.statusText || "Erro desconhecido no servidor";
      throw new Error(`Groq API falhou: ${errorMessage}`);
    }
    
    const data = await response.json();
    return data.choices[0].message.content;
  };

  const processImageFile = async (file) => {
    if (!file) return;
    setIsExtractionLoading(true);
    const loadingToast = toast.loading("Analisando imagem...");

    try {
      const base64Data = await compressImageToBase64(file);
      const prompt = `Você é um extrator de dados estrito. Retorne ABSOLUTAMENTE APENAS UM JSON VÁLIDO e NENHUMA palavra a mais.
Formato Exato: {"formation":"4-3-3B","players":[{"name":"GORDON","pos":"LW","att":95,"def":37,"ovr":95}]}
ATENÇÃO: A propriedade 'pos' deve usar as siglas específicas do OSM (GK, CB, LB, RB, CDM, CM, CAM, LM, RM, LW, RW, ST).`;

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
        console.warn("⚠️ Gemini indisponível. Acionando IA de Backup...", geminiError);
        toast.loading("IA principal ocupada. Usando IA de backup (Groq)...", { id: loadingToast });
        rawText = await extractWithBackupAI(base64Data, prompt);
      }

      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("Nenhum JSON válido retornado pela IA.");

      const extractedData = JSON.parse(jsonMatch[0]);
      
      const currentFormation = teamData.formation || "4-3-3B";
      const newFormation = extractedData.formation || currentFormation;
      
      const mergedPlayers = handleMergePlayers(extractedData.players, teamData?.players || [], newFormation, currentFormation);
      const newTeamOvr = calculateTeamOvr(mergedPlayers.filter(p => !p.isBench));

      setTeamData({ 
        ...teamData, 
        formation: newFormation,
        players: mergedPlayers, 
        teamOvr: newTeamOvr 
      });
      setHasUnsavedChanges(true);
      toast.success("Time atualizado com sucesso!", { id: loadingToast });

    } catch (error) {
      console.error("Erro na extração OCR:", error);
      toast.error("Falha na leitura. Verifique o console.", { id: loadingToast });
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

  const handleManualFormationChange = (e) => {
    const newFormationStr = e.target.value;
    const rearrangedRoster = autoAssignPositions(teamData.players || [], newFormationStr);
    
    setTeamData({
      ...teamData,
      formation: newFormationStr,
      players: rearrangedRoster,
      teamOvr: calculateTeamOvr(rearrangedRoster.filter(p => !p.isBench))
    });
    setHasUnsavedChanges(true);
  };

  const updatePlayerStat = (index, field, value) => {
    const updatedPlayers = [...teamData.players];
    updatedPlayers[index][field] = field === 'name' || field === 'pos' ? value.toUpperCase() : Number(value);
    
    if (field === 'att' || field === 'def') {
       updatedPlayers[index].ovr = Math.max(Number(updatedPlayers[index].att) || 0, Number(updatedPlayers[index].def) || 0);
    }

    const startersOvr = calculateTeamOvr(updatedPlayers.filter(p => !p.isBench));
    setTeamData({ ...teamData, players: updatedPlayers, teamOvr: startersOvr });
    setHasUnsavedChanges(true);
  };

  const handleAddPlayer = () => {
    const newPlayer = {
      id: `manual_${Date.now()}`,
      name: "NOVO JOGADOR",
      pos: "CM",
      att: 0,
      def: 0,
      ovr: 0,
      isBench: true,
      pitchPos: null
    };
    setTeamData(prev => ({ ...prev, players: [newPlayer, ...(prev.players || [])] }));
    setHasUnsavedChanges(true);
    toast.success("Jogador adicionado ao banco.");
  };

  const handleRemovePlayer = (playerId) => {
    const updatedPlayers = teamData.players.filter(p => p.id !== playerId);
    const startersOvr = calculateTeamOvr(updatedPlayers.filter(p => !p.isBench));
    setTeamData({ ...teamData, players: updatedPlayers, teamOvr: startersOvr });
    setHasUnsavedChanges(true);
    toast("Jogador removido do elenco.", { icon: '🗑️' });
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

  const handlePlayerClick = (clickedPlayer) => {
    if (!selectedPlayer) {
      setSelectedPlayer(clickedPlayer);
      return;
    }
    if (selectedPlayer.id === clickedPlayer.id) {
      setSelectedPlayer(null); 
      return;
    }

    const updatedPlayers = teamData.players.map(p => {
      if (p.id === selectedPlayer.id) return { ...p, isBench: clickedPlayer.isBench, pitchPos: clickedPlayer.pitchPos };
      if (p.id === clickedPlayer.id) return { ...p, isBench: selectedPlayer.isBench, pitchPos: selectedPlayer.pitchPos };
      return p;
    });
    
    setTeamData({ ...teamData, players: updatedPlayers, teamOvr: calculateTeamOvr(updatedPlayers.filter(p => !p.isBench)) });
    setHasUnsavedChanges(true);
    setSelectedPlayer(null);
  };

  const handleEmptySlotClick = (pitchPosIndex) => {
    if (selectedPlayer && selectedPlayer.isBench) {
      const updatedPlayers = teamData.players.map(p => {
        if (p.id === selectedPlayer.id) return { ...p, isBench: false, pitchPos: pitchPosIndex };
        return p;
      });
      setTeamData({ ...teamData, players: updatedPlayers, teamOvr: calculateTeamOvr(updatedPlayers.filter(p => !p.isBench)) });
      setHasUnsavedChanges(true);
      setSelectedPlayer(null);
    }
  };

  if (!activeTeamId) {
    return <div className="p-10 text-center text-slate-500">Crie ou selecione um time primeiro.</div>;
  }

  // Previne "piscar" a tela de vazio enquanto busca os dados
  if (isFetchingData && !teamData.players) {
    return <div className="p-20 flex justify-center"><Loader2 className="animate-spin text-blue-500" size={40} /></div>;
  }

  const safePlayers = teamData.players || [];
  const starters = safePlayers.filter(p => p.isBench === false && p.pitchPos !== null);
  const bench = safePlayers.filter(p => p.isBench !== false || p.pitchPos === null);

  const currentFormationStr = teamData.formation || "4-3-3B";
  const pitchSlots = FORMATIONS_MAP[currentFormationStr] || FORMATIONS_MAP["4-3-3B"];

  return (
    <div className="p-4 pb-10 max-w-7xl mx-auto w-full animate-fade-in outline-none" tabIndex={0} onPaste={handlePasteAnywhere}>
      
      {hasUnsavedChanges && (
        <div className="bg-yellow-900/30 border border-yellow-700/50 rounded-xl p-4 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm animate-pulse">
          <div className="flex items-center gap-3 text-yellow-400">
            <AlertTriangle size={24} />
            <div className="text-sm">
              <p className="font-bold">Alterações não salvas</p>
              <p className="text-yellow-500/80">O elenco foi modificado. Salve para não perder.</p>
            </div>
          </div>
          <button onClick={handleSaveToFirebase} className="w-full sm:w-auto bg-yellow-600 hover:bg-yellow-500 text-white px-6 py-2.5 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors shadow-md">
            <Save size={18} /> Salvar no Banco
          </button>
        </div>
      )}

      {/* ÁREA DE SCAN */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-8 text-center shadow-lg">
        <h3 className="text-lg font-bold mb-2 text-slate-200">Atualizar Atributos ou Adicionar Jogadores ({activeTeamName})</h3>
        <p className="text-sm text-slate-400 mb-6">As posições manuais serão mantidas. Dê <strong className="text-slate-200">Ctrl+V</strong> aqui no print do elenco.</p>
        <input type="file" accept="image/*" className="hidden" ref={teamImageInputRef} onChange={handleExtractTeamData} />
        <button onClick={() => teamImageInputRef.current.click()} disabled={isExtractionLoading} className="bg-blue-600 text-white border-none rounded-full py-3 px-8 flex items-center justify-center gap-2 font-bold hover:bg-blue-500 transition-colors mx-auto shadow-lg shadow-blue-900/50">
          {isExtractionLoading ? <Loader2 className="animate-spin" size={20} /> : <Camera size={20} />}
          {isExtractionLoading ? 'Lendo imagem...' : 'Fazer Upload do Print'}
        </button>
      </div>

      <div className="flex flex-col xl:flex-row gap-8">
        
        {/* COLUNA ESQUERDA: CAMPO E BANCO */}
        <div className="flex-1 flex flex-col gap-8">
          
          {/* MAPA 2D DINÂMICO */}
          <div className="bg-slate-800 p-4 md:p-6 rounded-2xl shadow-xl border border-slate-700">
            <h2 className="text-xl font-bold mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between text-slate-200 gap-4">
              <span className="flex items-center gap-2"><Zap className="text-yellow-400" size={20}/> Tática em Campo</span>
              
              <select 
                value={currentFormationStr} 
                onChange={handleManualFormationChange}
                className="bg-slate-900 px-4 py-2 border border-slate-700 rounded-lg text-sm font-bold text-blue-400 outline-none hover:border-blue-500 transition-colors cursor-pointer w-full sm:w-auto shadow-inner"
              >
                {Object.keys(FORMATIONS_MAP).map(fmt => (
                  <option key={fmt} value={fmt}>{fmt}</option>
                ))}
              </select>
            </h2>
            
            <div className="relative w-full max-w-3xl mx-auto aspect-[4/5] md:aspect-[3/2] bg-emerald-800 rounded-lg border-2 border-emerald-400 overflow-hidden shadow-inner">
              <div className="absolute top-0 w-full h-1/2 border-b-2 border-emerald-400/50"></div>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full border-2 border-emerald-400/50"></div>
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-1/5 border-x-2 border-b-2 border-emerald-400/50"></div>
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/2 h-1/5 border-x-2 border-t-2 border-emerald-400/50"></div>

              {pitchSlots.map(slot => {
                const playerInSlot = starters.find(p => p.pitchPos === slot.id);
                const isSelected = selectedPlayer?.id === playerInSlot?.id;

                return (
                  <div key={slot.id} onClick={() => playerInSlot ? handlePlayerClick(playerInSlot) : handleEmptySlotClick(slot.id)} className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center cursor-pointer transition-transform hover:scale-110" style={{ top: slot.top, left: slot.left }}>
                    {playerInSlot ? (
                      <div className={`w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center font-black text-sm md:text-base shadow-lg ${isSelected ? 'bg-yellow-400 text-slate-900 ring-4 ring-yellow-200' : 'bg-slate-900 text-white border-2 border-slate-600'}`}>
                        {playerInSlot.ovr}
                      </div>
                    ) : (
                      <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full border-2 border-dashed flex items-center justify-center text-xs font-bold transition-colors ${selectedPlayer ? 'border-yellow-400 bg-yellow-400/20 text-yellow-400 animate-pulse' : 'border-emerald-400/50 bg-emerald-900/50 text-emerald-400/50'}`}>
                        {slot.label}
                      </div>
                    )}
                    {playerInSlot && (
                      <span className="mt-1 bg-black/80 px-2 py-0.5 rounded text-[10px] md:text-xs font-semibold whitespace-nowrap text-slate-200 border border-slate-700">
                        {playerInSlot.name}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-slate-800 p-4 md:p-6 rounded-2xl shadow-xl border border-slate-700 max-h-[400px] flex flex-col">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-slate-200">
              <UserPlus className="text-blue-400" size={20}/> Banco ({bench.length})
            </h2>
            <div className="flex-1 overflow-y-auto pr-2 grid grid-cols-1 md:grid-cols-2 gap-3 custom-scrollbar">
              {bench.map(player => {
                const isSelected = selectedPlayer?.id === player.id;
                return (
                  <div key={player.id} onClick={() => handlePlayerClick(player)} className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all border ${isSelected ? 'bg-yellow-400 text-slate-900 border-yellow-500 shadow-md transform scale-[1.02]' : 'bg-slate-900 border-slate-700 hover:border-slate-500 text-white'}`}>
                    <div className="flex flex-col truncate pr-2">
                      <span className="font-bold text-sm truncate">{player.name}</span>
                      <span className={`text-xs ${isSelected ? 'text-slate-800' : 'text-slate-400'}`}>Pos: {player.pos || 'N/A'} | OVR: {player.ovr}</span>
                    </div>
                    <div className={`w-9 h-9 flex-shrink-0 rounded-full flex items-center justify-center font-bold text-sm shadow-sm border ${isSelected ? 'bg-slate-900 text-yellow-400 border-slate-800' : 'bg-green-900/30 text-green-400 border-green-800/50'}`}>
                      {player.ovr}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="xl:w-1/3 flex flex-col gap-4">
          <div className="flex justify-between items-center mb-2">
            <h4 className="font-bold text-slate-300">Gestão do Elenco</h4>
            <button onClick={handleAddPlayer} className="bg-emerald-600 hover:bg-emerald-500 text-white p-2 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors">
              <Plus size={14} /> Novo Jogador
            </button>
          </div>
          
          <div className="bg-slate-800 rounded-2xl shadow-xl border border-slate-700 p-4 overflow-hidden flex flex-col h-[800px]">
            <div className="flex justify-between items-center bg-slate-900 p-3 rounded-xl border border-slate-700 mb-4">
              <span className="text-slate-400 text-sm font-bold">OVR Titulares:</span>
              <span className="text-green-400 text-xl font-black">{teamData.teamOvr || 0}</span>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-2">
              <div className="grid grid-cols-12 gap-1 px-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider sticky top-0 bg-slate-800 py-2 z-10">
                <div className="col-span-4">Nome</div>
                <div className="col-span-2 text-center text-blue-400">Pos</div>
                <div className="col-span-4 text-center text-green-400">OVR Max</div>
                <div className="col-span-2 text-center text-red-400">Ação</div>
              </div>
              
              {safePlayers.map((player, idx) => (
                <div key={player.id || idx} className="bg-slate-900 border border-slate-700 rounded-xl p-2 grid grid-cols-12 gap-2 items-center shadow-sm">
                  <input type="text" value={player.name} onChange={(e) => updatePlayerStat(idx, 'name', e.target.value)} className="col-span-4 bg-transparent text-xs font-semibold text-slate-300 outline-none w-full truncate" />
                  <input type="text" value={player.pos || ''} onChange={(e) => updatePlayerStat(idx, 'pos', e.target.value)} className="col-span-2 bg-slate-950 border border-slate-800 rounded text-center text-xs py-1 font-medium text-blue-400 outline-none w-full" maxLength={3} />
                  <input type="number" value={player.ovr} onChange={(e) => updatePlayerStat(idx, 'ovr', e.target.value)} className="col-span-4 bg-slate-950 border border-slate-800 rounded text-center text-xs py-1 font-bold text-green-400 outline-none w-full" />
                  <button onClick={() => handleRemovePlayer(player.id)} className="col-span-2 flex justify-center text-slate-500 hover:text-red-400 transition-colors p-1" title="Vender/Remover">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}