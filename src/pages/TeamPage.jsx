// src/pages/TeamPage.jsx
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { 
  Camera, Loader2, Save, AlertTriangle, UserPlus, Zap, Trash2, Plus, 
  Battery, Ban, Award, Target, Flag, CornerUpLeft, DollarSign, Copy, CheckCircle2, Search, TrendingUp, Dumbbell, Flame
} from 'lucide-react';
import toast from 'react-hot-toast';
import { db } from '../config/firebase';
import { ai } from '../config/gemini';
import { compressImageToBase64, calculateTeamOvr } from '../utils/helpers';

const FORMATIONS_MAP = {
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

export default function TeamPage({ activeTeamId, activeTeamName, teamData, setTeamData, user }) {
  const [isExtractionLoading, setIsExtractionLoading] = useState(false);
  const [isFetchingData, setIsFetchingData] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  
  const teamImageInputRef = useRef(null);
  const [marketModal, setMarketModal] = useState({ isOpen: false, player: null, baseValue: '' });
  const [scoutModalOpen, setScoutModalOpen] = useState(false);
  const [copiedValue, setCopiedValue] = useState('');

  useEffect(() => {
    const fetchTeamFromFirebase = async () => {
      if (!activeTeamId || !db || !user) return;
      setIsFetchingData(true);
      try {
        const docRef = doc(db, "users", user.uid, "teams", activeTeamId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setTeamData({
            formation: data.formation || "4-3-3B",
            players: data.players || [],
            teamOvr: data.teamOvr || 0
          });
        } else {
          setTeamData({ formation: "4-3-3B", players: [], teamOvr: 0 });
        }
        setHasUnsavedChanges(false);
      } catch (error) {
        toast.error("Erro ao carregar a escalação salva.");
      } finally {
        setIsFetchingData(false);
      }
    };
    fetchTeamFromFirebase();
  }, [activeTeamId, db, user, setTeamData]);

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
      if (player.unavailable || player.energy < 75) return;
      const pPos = player.pos?.toUpperCase() || '';
      const pSector = getMacroSector(pPos);

      let targetSlot = pitchConfig.find(slot => slot.label === pPos && !assignedRoster.some(r => r.pitchPos === slot.id));
      if (!targetSlot) targetSlot = pitchConfig.find(slot => getMacroSector(slot.label) === pSector && !assignedRoster.some(r => r.pitchPos === slot.id));
      if (!targetSlot) targetSlot = pitchConfig.find(slot => !assignedRoster.some(r => r.pitchPos === slot.id));

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
        ...p, att: foundInScan.att, def: foundInScan.def, ovr: maxOvr, pos: foundInScan.pos || p.pos,
        age: foundInScan.age || p.age || 25, energy: p.energy !== undefined ? p.energy : 100, unavailable: p.unavailable || false
      };
    });

    scannedPlayers.forEach((scannedPlayer, idx) => {
      const exists = updatedRoster.find(p => p.name.toUpperCase() === scannedPlayer.name.toUpperCase());
      if (!exists) {
        const maxOvr = Math.max(Number(scannedPlayer.att) || 0, Number(scannedPlayer.def) || 0, Number(scannedPlayer.ovr) || 0);
        updatedRoster.push({
          ...scannedPlayer, ovr: maxOvr, age: scannedPlayer.age || 25,
          id: `player_${Date.now()}_${idx}`, isBench: true, pitchPos: null, energy: 100, unavailable: false
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
    if (!groqApiKey) throw new Error("Chave VITE_GROQ_API_KEY não configurada.");
    const aggressivePrompt = `${originalPrompt}\n\nIMPORTANTE: Extraia TODOS os jogadores. Inclua a idade ("age").`;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${groqApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama-3.2-11b-vision-preview", 
        messages: [{ role: "user", content: [{ type: "text", text: aggressivePrompt }, { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Data}` } }] }],
        temperature: 0.1, max_tokens: 4096
      })
    });

    if (!response.ok) throw new Error("Groq API falhou.");
    const data = await response.json();
    return data.choices[0].message.content;
  };

  const processImageFile = async (file) => {
    if (!file) return;
    setIsExtractionLoading(true);
    const loadingToast = toast.loading("Analisando imagem...");

    try {
      const base64Data = await compressImageToBase64(file);
      const prompt = `Você é um extrator de dados estrito. Retorne ABSOLUTAMENTE APENAS UM JSON VÁLIDO.
Formato: {"formation":"4-3-3B","players":[{"name":"GORDON","pos":"LW","age":22,"att":95,"def":37,"ovr":95}]}`;

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
        rawText = await extractWithBackupAI(base64Data, prompt);
      }

      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("Nenhum JSON válido.");

      const extractedData = JSON.parse(jsonMatch[0]);
      const currentFormation = teamData.formation || "4-3-3B";
      const newFormation = extractedData.formation || currentFormation;
      
      const mergedPlayers = handleMergePlayers(extractedData.players, teamData?.players || [], newFormation, currentFormation);
      const newTeamOvr = calculateTeamOvr(mergedPlayers.filter(p => !p.isBench));

      setTeamData({ ...teamData, formation: newFormation, players: mergedPlayers, teamOvr: newTeamOvr });
      setHasUnsavedChanges(true);
      toast.success("Time atualizado com sucesso!", { id: loadingToast });

    } catch (error) {
      toast.error("Falha na leitura. Tente enviar de novo.", { id: loadingToast });
    } finally {
      setIsExtractionLoading(false);
      if (teamImageInputRef.current) teamImageInputRef.current.value = '';
    }
  };

  const handleExtractTeamData = (e) => { if (e.target.files[0]) processImageFile(e.target.files[0]); };
  const handlePasteAnywhere = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        processImageFile(items[i].getAsFile()); e.preventDefault(); break;
      }
    }
  };

  const handleManualFormationChange = (e) => {
    const newFormationStr = e.target.value;
    const rearrangedRoster = autoAssignPositions(teamData.players || [], newFormationStr);
    setTeamData({ ...teamData, formation: newFormationStr, players: rearrangedRoster, teamOvr: calculateTeamOvr(rearrangedRoster.filter(p => !p.isBench)) });
    setHasUnsavedChanges(true);
  };

  const updatePlayerStat = (index, field, value) => {
    const updatedPlayers = [...teamData.players];
    if (field === 'unavailable') {
      updatedPlayers[index][field] = value; 
    } else if (field === 'energy' || field === 'age') {
      let val = Number(value);
      if (field === 'energy' && val > 100) val = 100;
      if (val < 0) val = 0;
      updatedPlayers[index][field] = val;
    } else {
      updatedPlayers[index][field] = field === 'name' || field === 'pos' ? value.toUpperCase() : Number(value);
    }
    
    if (field === 'att' || field === 'def') {
       updatedPlayers[index].ovr = Math.max(Number(updatedPlayers[index].att) || 0, Number(updatedPlayers[index].def) || 0);
    }

    const startersOvr = calculateTeamOvr(updatedPlayers.filter(p => !p.isBench));
    setTeamData({ ...teamData, players: updatedPlayers, teamOvr: startersOvr });
    setHasUnsavedChanges(true);
  };

  const handleAddPlayer = () => {
    const newPlayer = {
      id: `manual_${Date.now()}`, name: "NOVO JOGADOR", pos: "CM", age: 25, att: 0, def: 0, ovr: 0, isBench: true, pitchPos: null, energy: 100, unavailable: false
    };
    setTeamData(prev => ({ ...prev, players: [newPlayer, ...(prev.players || [])] }));
    setHasUnsavedChanges(true);
  };

  const handleRemovePlayer = (playerId) => {
    const updatedPlayers = teamData.players.filter(p => p.id !== playerId);
    setTeamData({ ...teamData, players: updatedPlayers, teamOvr: calculateTeamOvr(updatedPlayers.filter(p => !p.isBench)) });
    setHasUnsavedChanges(true);
  };

  const handleSaveToFirebase = async () => {
    if (!db || !activeTeamId || !user) return;
    const savingToast = toast.loading("Salvando escalação...");
    try {
      await setDoc(doc(db, "users", user.uid, "teams", activeTeamId), teamData, { merge: true });
      setHasUnsavedChanges(false);
      toast.success("Elenco atualizado na nuvem!", { id: savingToast });
    } catch (error) { toast.error("Erro ao salvar."); }
  };

  const handlePlayerClick = (clickedPlayer) => {
    if (!selectedPlayer) { setSelectedPlayer(clickedPlayer); return; }
    if (selectedPlayer.id === clickedPlayer.id) { setSelectedPlayer(null); return; }
    const updatedPlayers = teamData.players.map(p => {
      if (p.id === selectedPlayer.id) return { ...p, isBench: clickedPlayer.isBench, pitchPos: clickedPlayer.pitchPos };
      if (p.id === clickedPlayer.id) return { ...p, isBench: selectedPlayer.isBench, pitchPos: selectedPlayer.pitchPos };
      return p;
    });
    setTeamData({ ...teamData, players: updatedPlayers, teamOvr: calculateTeamOvr(updatedPlayers.filter(p => !p.isBench)) });
    setHasUnsavedChanges(true); setSelectedPlayer(null);
  };

  const handleEmptySlotClick = (pitchPosIndex) => {
    if (selectedPlayer && selectedPlayer.isBench) {
      const updatedPlayers = teamData.players.map(p => {
        if (p.id === selectedPlayer.id) return { ...p, isBench: false, pitchPos: pitchPosIndex };
        return p;
      });
      setTeamData({ ...teamData, players: updatedPlayers, teamOvr: calculateTeamOvr(updatedPlayers.filter(p => !p.isBench)) });
      setHasUnsavedChanges(true); setSelectedPlayer(null);
    }
  };

  const handleOpenMarket = (player) => setMarketModal({ isOpen: true, player, baseValue: '' });
  const handleCopyValue = (valueStr) => {
    navigator.clipboard.writeText(valueStr);
    setCopiedValue(valueStr);
    toast.success(`Valor ${valueStr} copiado!`);
    setTimeout(() => setCopiedValue(''), 2000);
  };

  if (!activeTeamId) return <div className="p-10 text-center text-slate-500">Crie ou selecione um time.</div>;
  if (isFetchingData && !teamData.players) return <div className="p-20 flex justify-center"><Loader2 className="animate-spin text-blue-500" size={40} /></div>;

  const safePlayers = teamData.players || [];
  const starters = safePlayers.filter(p => p.isBench === false && p.pitchPos !== null);
  const bench = safePlayers.filter(p => p.isBench !== false || p.pitchPos === null);
  const currentFormationStr = teamData.formation || "4-3-3B";
  const pitchSlots = FORMATIONS_MAP[currentFormationStr] || FORMATIONS_MAP["4-3-3B"];

  // ==========================================
  // ALGORITMOS NATIVOS (ESPECIALISTAS, SCOUT E TREINO)
  // ==========================================
  const getSpecialists = useMemo(() => {
    if (starters.length === 0) return { captain: null, penalties: null, freeKicks: null, corners: null };
    const attackers = starters.filter(p => getMacroSector(p.pos) === 'ATT');
    const midfielders = starters.filter(p => getMacroSector(p.pos) === 'MID');

    const captain = [...starters].sort((a, b) => (b.age || 0) - (a.age || 0) || b.ovr - a.ovr)[0];
    const penalties = [...attackers].sort((a, b) => b.att - a.att || b.ovr - a.ovr)[0] || starters[0];
    let freeKicks = [...midfielders].sort((a, b) => b.att - a.att || b.ovr - a.ovr)[0];
    if (!freeKicks) freeKicks = [...attackers].sort((a, b) => b.att - a.att || b.ovr - a.ovr)[0] || starters[0];
    let cornersPool = midfielders.filter(p => p.id !== freeKicks?.id);
    if (cornersPool.length === 0) cornersPool = midfielders;
    const corners = [...cornersPool].sort((a, b) => b.ovr - a.ovr)[0] || starters[0];

    return { captain, penalties, freeKicks, corners };
  }, [starters]);

  const getScoutRecommendation = useMemo(() => {
    if (starters.length === 0) return null;
    const weakestLink = [...starters].sort((a, b) => {
      if (a.ovr !== b.ovr) return a.ovr - b.ovr;
      return (b.age || 25) - (a.age || 25);
    })[0];

    let scoutPos = ""; let scoutStyle = "";
    const pPos = weakestLink.pos.toUpperCase();
    const macro = getMacroSector(pPos);

    if (macro === 'GK') { scoutPos = "Goleiro"; scoutStyle = "Geral"; } 
    else if (macro === 'DEF') { scoutPos = "Defensor"; scoutStyle = ['LB', 'RB', 'LWB', 'RWB', 'LAT'].includes(pPos) ? "Ofensivo (Laterais)" : "Defensivo (Zagueiros)"; } 
    else if (macro === 'MID') { scoutPos = "Meio-campista"; if (['CAM', 'MEI'].includes(pPos)) scoutStyle = "Ofensivo (Attacking)"; else if (['CDM', 'VOL'].includes(pPos)) scoutStyle = "Defensivo (Defensive)"; else scoutStyle = "Armador (Box-to-box / Balanced)"; } 
    else { scoutPos = "Atacante"; scoutStyle = ['LW', 'RW', 'PE', 'PD'].includes(pPos) ? "Atacante Pelas Alas (Winger)" : "Ponta de Lança (Poacher)"; }

    const tOvr = teamData.teamOvr || 80;
    const targetOvr = tOvr + 2;
    let qualityStr = "85+";
    if (targetOvr < 60) qualityStr = "50-59"; else if (targetOvr < 70) qualityStr = "60-69"; else if (targetOvr < 80) qualityStr = "70-79"; else if (targetOvr < 85) qualityStr = "80-84";

    return { weakest: weakestLink, scoutPos, scoutStyle, quality: qualityStr, age: "Jovem (< 25 anos)" };
  }, [starters, teamData.teamOvr]);

  // NOVO: ASSISTENTE DE TREINO DIÁRIO
  const getTrainingFocus = useMemo(() => {
    const allPlayers = safePlayers;
    if (allPlayers.length === 0) return { GK: [], DEF: [], MID: [], ATT: [] };

    // Pontuação: Mais Jovem = Mais pontos. Titular = Bônus gigante.
    const scorePlayer = (p) => {
      let score = (35 - (p.age || 25)) * 10; // 18 anos = 170 pts | 30 anos = 50 pts
      if (!p.isBench) score += 100; // Prioriza quem joga titular
      if (p.age >= 29) score -= 200; // Penalidade pesada para velhos (evoluem muito pouco no OSM)
      return score + (p.ovr * 0.01); // Desempate mínimo pelo OVR
    };

    const sorted = [...allPlayers].sort((a, b) => scorePlayer(b) - scorePlayer(a));

    return {
      ATT: sorted.filter(p => getMacroSector(p.pos) === 'ATT').slice(0, 2),
      MID: sorted.filter(p => getMacroSector(p.pos) === 'MID').slice(0, 2),
      DEF: sorted.filter(p => getMacroSector(p.pos) === 'DEF').slice(0, 2),
      GK: sorted.filter(p => getMacroSector(p.pos) === 'GK').slice(0, 2),
    };
  }, [safePlayers]);

  return (
    <div className="p-4 pb-10 max-w-[1400px] mx-auto w-full animate-fade-in outline-none relative" tabIndex={0} onPaste={handlePasteAnywhere}>
      
      {/* MODAL DE MERCADO */}
      {marketModal.isOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-3xl shadow-2xl w-full max-w-sm relative">
            <button onClick={() => setMarketModal({ isOpen: false, player: null, baseValue: '' })} className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors">✕</button>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-emerald-900/30 text-emerald-400 border border-emerald-800/50 rounded-full flex items-center justify-center font-bold text-lg shadow-inner">{marketModal.player?.ovr}</div>
              <div><h3 className="text-xl font-bold text-slate-100">{marketModal.player?.name}</h3><span className="text-xs text-emerald-400 font-semibold uppercase tracking-wider">Calculadora de Revenda</span></div>
            </div>
            <label className="block text-sm font-medium text-slate-400 mb-2">Valor Base no OSM (Ex: 10.5)</label>
            <div className="relative mb-6">
              <DollarSign className="absolute left-3 top-3.5 text-slate-500" size={20} />
              <input type="number" step="0.1" autoFocus value={marketModal.baseValue} onChange={(e) => setMarketModal({ ...marketModal, baseValue: e.target.value })} placeholder="0.0" className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-slate-200 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all text-lg font-bold" />
            </div>
            {marketModal.baseValue && parseFloat(marketModal.baseValue) > 0 && (
              <div className="space-y-3 animate-fade-in">
                <div className="bg-slate-800 border border-slate-700 p-4 rounded-xl flex items-center justify-between group">
                  <div className="flex flex-col"><span className="text-xs text-blue-400 font-bold uppercase tracking-wider mb-1">Venda Rápida (1.6x)</span><span className="text-2xl font-black text-slate-200">{(parseFloat(marketModal.baseValue) * 1.6).toFixed(1)} <span className="text-sm font-medium text-slate-500">M</span></span></div>
                  <button onClick={() => handleCopyValue((parseFloat(marketModal.baseValue) * 1.6).toFixed(1))} className="p-2.5 bg-slate-900 hover:bg-blue-600 hover:text-white text-slate-400 rounded-lg transition-colors border border-slate-700">{copiedValue === (parseFloat(marketModal.baseValue) * 1.6).toFixed(1) ? <CheckCircle2 size={20} className="text-emerald-400" /> : <Copy size={20} />}</button>
                </div>
                <div className="bg-slate-800 border border-emerald-900/50 p-4 rounded-xl flex items-center justify-between group">
                  <div className="flex flex-col"><span className="text-xs text-emerald-400 font-bold uppercase tracking-wider mb-1 flex items-center gap-1"><Zap size={12}/> Lucro Máximo (2.5x)</span><span className="text-2xl font-black text-white">{(parseFloat(marketModal.baseValue) * 2.5).toFixed(1)} <span className="text-sm font-medium text-emerald-500/50">M</span></span></div>
                  <button onClick={() => handleCopyValue((parseFloat(marketModal.baseValue) * 2.5).toFixed(1))} className="p-2.5 bg-slate-900 hover:bg-emerald-600 hover:text-white text-slate-400 rounded-lg transition-colors border border-emerald-900/50">{copiedValue === (parseFloat(marketModal.baseValue) * 2.5).toFixed(1) ? <CheckCircle2 size={20} className="text-emerald-400" /> : <Copy size={20} />}</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL DO DIRETOR DE SCOUT */}
      {scoutModalOpen && scoutRecommendation && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-3xl shadow-2xl w-full max-w-md relative">
            <button onClick={() => setScoutModalOpen(false)} className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors">✕</button>
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-blue-600 p-3 rounded-xl shadow-lg shadow-blue-900/30"><Search size={24} className="text-white" /></div>
              <div><h3 className="text-xl font-bold text-slate-100">Diretor de Olheiros</h3><span className="text-xs text-blue-400 font-semibold uppercase tracking-wider">Análise Automática do Elenco</span></div>
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 mb-4">
              <p className="text-xs text-slate-400 uppercase tracking-wider font-bold mb-2 flex items-center gap-1"><AlertTriangle size={14} className="text-yellow-500"/> Elo mais fraco identificado</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-800 border border-slate-700 rounded-full flex items-center justify-center font-bold text-slate-300">{scoutRecommendation.weakest.ovr}</div>
                <div><p className="font-bold text-slate-200">{scoutRecommendation.weakest.name}</p><p className="text-xs text-slate-500">Idade: {scoutRecommendation.weakest.age} anos • Pos: {scoutRecommendation.weakest.pos}</p></div>
              </div>
            </div>
            <div className="bg-blue-950/20 border border-blue-900/50 rounded-xl p-4">
              <p className="text-xs text-blue-400 uppercase tracking-wider font-bold mb-3 flex items-center gap-1"><TrendingUp size={14}/> Parâmetros Sugeridos para o Jogo</p>
              <ul className="space-y-2 text-sm text-slate-300">
                <li className="flex justify-between border-b border-blue-900/30 pb-1"><span className="text-slate-500">Posição:</span> <strong className="text-slate-100">{scoutRecommendation.scoutPos}</strong></li>
                <li className="flex justify-between border-b border-blue-900/30 pb-1"><span className="text-slate-500">Estilo:</span> <strong className="text-slate-100">{scoutRecommendation.scoutStyle}</strong></li>
                <li className="flex justify-between border-b border-blue-900/30 pb-1"><span className="text-slate-500">Qualidade:</span> <strong className="text-slate-100">{scoutRecommendation.quality}</strong></li>
                <li className="flex justify-between border-b border-blue-900/30 pb-1"><span className="text-slate-500">Idade:</span> <strong className="text-slate-100">{scoutRecommendation.age}</strong></li>
                <li className="flex justify-between"><span className="text-slate-500">Nacionalidade:</span> <strong className="text-slate-100">Qualquer</strong></li>
              </ul>
            </div>
            <button onClick={() => setScoutModalOpen(false)} className="w-full mt-6 bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-xl transition-colors">Entendido</button>
          </div>
        </div>
      )}

      {hasUnsavedChanges && (
        <div className="bg-yellow-900/30 border border-yellow-700/50 rounded-xl p-4 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm animate-pulse z-40 sticky top-0">
          <div className="flex items-center gap-3 text-yellow-400">
            <AlertTriangle size={24} />
            <div className="text-sm"><p className="font-bold">Alterações não salvas</p><p className="text-yellow-500/80">Você alterou a escalação. Salve para não perder.</p></div>
          </div>
          <button onClick={handleSaveToFirebase} className="w-full sm:w-auto bg-yellow-600 hover:bg-yellow-500 text-white px-6 py-2.5 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors shadow-md"><Save size={18} /> Salvar no Banco</button>
        </div>
      )}

      {/* ÁREA DE SCAN */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-8 text-center shadow-lg flex flex-col items-center justify-center">
        <h3 className="text-lg font-bold mb-2 text-slate-200">Atualizar Elenco ({activeTeamName})</h3>
        <p className="text-sm text-slate-400 mb-4 max-w-lg">Dê <strong className="text-slate-200">Ctrl+V</strong> no print do elenco para cadastrar jogadores.</p>
        <input type="file" accept="image/*" className="hidden" ref={teamImageInputRef} onChange={handleExtractTeamData} />
        <button onClick={() => teamImageInputRef.current.click()} disabled={isExtractionLoading} className="bg-blue-600 text-white border-none rounded-full py-3 px-8 flex items-center justify-center gap-2 font-bold hover:bg-blue-500 transition-colors shadow-lg shadow-blue-900/50">
          {isExtractionLoading ? <Loader2 className="animate-spin" size={20} /> : <Camera size={20} />}
          {isExtractionLoading ? 'Lendo imagem...' : 'Fazer Upload do Print'}
        </button>
      </div>

      <div className="flex flex-col xl:flex-row gap-6">
        
        {/* COLUNA ESQUERDA: CAMPO E BANCO */}
        <div className="flex-1 flex flex-col gap-6">
          <div className="bg-slate-800 p-4 md:p-6 rounded-2xl shadow-xl border border-slate-700">
            <h2 className="text-xl font-bold mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between text-slate-200 gap-4">
              <span className="flex items-center gap-2"><Zap className="text-yellow-400" size={20}/> Tática em Campo</span>
              <select value={currentFormationStr} onChange={handleManualFormationChange} className="bg-slate-900 px-4 py-2 border border-slate-700 rounded-lg text-sm font-bold text-blue-400 outline-none hover:border-blue-500 transition-colors cursor-pointer w-full sm:w-auto shadow-inner">
                {Object.keys(FORMATIONS_MAP).map(fmt => (<option key={fmt} value={fmt}>{fmt}</option>))}
              </select>
            </h2>
            
            <div className="relative w-full max-w-2xl mx-auto aspect-[4/5] md:aspect-[3/2] bg-emerald-800 rounded-lg border-2 border-emerald-400 overflow-hidden shadow-inner">
              <div className="absolute top-0 w-full h-1/2 border-b-2 border-emerald-400/50"></div>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full border-2 border-emerald-400/50"></div>
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-1/5 border-x-2 border-b-2 border-emerald-400/50"></div>
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/2 h-1/5 border-x-2 border-t-2 border-emerald-400/50"></div>

              {pitchSlots.map(slot => {
                const playerInSlot = starters.find(p => p.pitchPos === slot.id);
                const isSelected = selectedPlayer?.id === playerInSlot?.id;
                const hasProblem = playerInSlot && (playerInSlot.unavailable || (playerInSlot.energy !== undefined && playerInSlot.energy < 75));

                return (
                  <div key={slot.id} onClick={() => playerInSlot ? handlePlayerClick(playerInSlot) : handleEmptySlotClick(slot.id)} className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center cursor-pointer transition-transform hover:scale-110 z-10" style={{ top: slot.top, left: slot.left }}>
                    {playerInSlot ? (
                      <div className={`w-11 h-11 md:w-14 md:h-14 rounded-full flex items-center justify-center font-black text-sm md:text-base shadow-lg ${isSelected ? 'bg-yellow-400 text-slate-900 ring-4 ring-yellow-200' : (hasProblem ? 'bg-red-600 text-white border-2 border-red-300 animate-pulse' : 'bg-slate-900 text-white border-2 border-slate-600')}`}>
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

          <div className="bg-slate-800 p-4 md:p-6 rounded-2xl shadow-xl border border-slate-700 min-h-[300px] flex flex-col">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-slate-200">
              <UserPlus className="text-blue-400" size={20}/> Banco de Reservas ({bench.length})
            </h2>
            <div className="flex-1 overflow-y-auto pr-2 grid grid-cols-1 md:grid-cols-2 gap-3 custom-scrollbar">
              {bench.map(player => {
                const isSelected = selectedPlayer?.id === player.id;
                const hasProblem = player.unavailable || (player.energy !== undefined && player.energy < 75);

                return (
                  <div key={player.id} onClick={() => handlePlayerClick(player)} className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all border ${isSelected ? 'bg-yellow-400 text-slate-900 border-yellow-500 shadow-md transform scale-[1.02]' : 'bg-slate-900 border-slate-700 hover:border-slate-500 text-white'}`}>
                    <div className="flex flex-col truncate pr-2 w-full">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm truncate">{player.name}</span>
                        {hasProblem && <AlertTriangle size={14} className={player.unavailable ? "text-red-500" : "text-yellow-500"} />}
                      </div>
                      <span className={`text-[11px] ${isSelected ? 'text-slate-800' : 'text-slate-400'}`}>
                        Pos: {player.pos || 'N/A'} | Idade: {player.age || 25} | En: {player.energy ?? 100}%
                      </span>
                    </div>
                    <div className={`w-9 h-9 flex-shrink-0 rounded-full flex items-center justify-center font-bold text-sm shadow-sm border ${isSelected ? 'bg-slate-900 text-yellow-400 border-slate-800' : (hasProblem ? 'bg-red-900/30 text-red-400 border-red-800/50' : 'bg-green-900/30 text-green-400 border-green-800/50')}`}>
                      {player.ovr}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* COLUNA DIREITA: GESTÃO (ESPECIALISTAS, TREINO, SCOUT) */}
        <div className="xl:w-[50%] flex flex-col gap-6">
          
          {/* BLOCO SUPERIOR: TREINO E SCOUT */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* CARD 1: ASSISTENTE DE TREINO DIÁRIO */}
            <div className="bg-slate-800 rounded-2xl shadow-xl border border-slate-700 p-4">
              <h4 className="font-bold text-orange-400 mb-3 flex items-center gap-2 text-sm">
                <Dumbbell size={18}/> Foco de Treino Diário
              </h4>
              <div className="space-y-2">
                {[
                  { title: "Atacantes", data: getTrainingFocus.ATT },
                  { title: "Meias", data: getTrainingFocus.MID },
                  { title: "Defensores", data: getTrainingFocus.DEF },
                  { title: "Goleiros", data: getTrainingFocus.GK }
                ].map((posGroup, idx) => (
                  <div key={idx} className="bg-slate-900 p-2.5 rounded-lg border border-slate-700 flex flex-col">
                    <span className="text-[10px] text-slate-500 font-bold uppercase mb-1">{posGroup.title}</span>
                    <div className="flex flex-col gap-1">
                      {posGroup.data[0] ? (
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-slate-200 truncate flex items-center gap-1.5"><Flame size={12} className="text-orange-500"/> {posGroup.data[0].name}</span>
                          <span className="text-[10px] text-orange-400 font-bold">{posGroup.data[0].age} anos</span>
                        </div>
                      ) : <span className="text-xs text-slate-600 italic">Sem jogadores</span>}
                      
                      {posGroup.data[1] && (
                        <div className="flex justify-between items-center opacity-60">
                          <span className="text-[10px] font-medium text-slate-300 truncate">2ª Opção: {posGroup.data[1].name}</span>
                          <span className="text-[10px] text-slate-400">{posGroup.data[1].age} anos</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* CARD 2: SCOUT E ESPECIALISTAS */}
            <div className="flex flex-col gap-4">
              <div className="bg-gradient-to-br from-blue-900/40 to-slate-800 rounded-2xl shadow-xl border border-blue-800/50 p-4 flex flex-col items-center text-center justify-center flex-1">
                <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center mb-2 shadow-lg shadow-blue-900/50">
                  <Search className="text-white" size={18} />
                </div>
                <h4 className="font-bold text-slate-100 text-sm mb-1">Diretor de Scout</h4>
                <p className="text-[11px] text-blue-200/70 mb-3 px-2">Descubra matematicamente o elo mais fraco titular.</p>
                <button onClick={() => setScoutModalOpen(true)} disabled={starters.length === 0} className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-colors disabled:opacity-50">
                  Ver Relatório
                </button>
              </div>

              <div className="bg-slate-800 rounded-2xl shadow-xl border border-slate-700 p-4 flex-1">
                <h4 className="font-bold text-slate-200 mb-2 flex items-center gap-2 text-sm">
                  <Target className="text-purple-400" size={16}/> Bolas Paradas
                </h4>
                <div className="space-y-1.5">
                    <div className="flex justify-between items-center bg-slate-900 px-2 py-1.5 rounded text-xs border border-slate-700"><span className="text-slate-500 font-bold uppercase">Capitão</span><span className="font-bold text-slate-200 truncate max-w-[80px]">{getSpecialists.captain?.name || "N/A"}</span></div>
                    <div className="flex justify-between items-center bg-slate-900 px-2 py-1.5 rounded text-xs border border-slate-700"><span className="text-slate-500 font-bold uppercase">Pênalti</span><span className="font-bold text-slate-200 truncate max-w-[80px]">{getSpecialists.penalties?.name || "N/A"}</span></div>
                    <div className="flex justify-between items-center bg-slate-900 px-2 py-1.5 rounded text-xs border border-slate-700"><span className="text-slate-500 font-bold uppercase">Faltas</span><span className="font-bold text-slate-200 truncate max-w-[80px]">{getSpecialists.freeKicks?.name || "N/A"}</span></div>
                    <div className="flex justify-between items-center bg-slate-900 px-2 py-1.5 rounded text-xs border border-slate-700"><span className="text-slate-500 font-bold uppercase">Canto</span><span className="font-bold text-slate-200 truncate max-w-[80px]">{getSpecialists.corners?.name || "N/A"}</span></div>
                </div>
              </div>
            </div>

          </div>

          <div className="flex justify-between items-center mt-2">
            <h4 className="font-bold text-slate-300">Banco de Dados do Elenco</h4>
            <button onClick={handleAddPlayer} className="bg-emerald-600 hover:bg-emerald-500 text-white p-2 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors shadow-md">
              <Plus size={14} /> Novo Jogador
            </button>
          </div>
          
          {/* TABELA DE JOGADORES */}
          <div className="bg-slate-800 rounded-2xl shadow-xl border border-slate-700 p-4 overflow-hidden flex flex-col h-[500px]">
            <div className="flex justify-between items-center bg-slate-900 p-3 rounded-xl border border-slate-700 mb-4">
              <span className="text-slate-400 text-sm font-bold">OVR Titulares:</span>
              <span className="text-green-400 text-2xl font-black">{teamData.teamOvr || 0}</span>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-2">
              <div className="grid grid-cols-12 gap-1 px-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider sticky top-0 bg-slate-800 py-2 z-10 text-center">
                <div className="col-span-3 text-left pl-1">Nome</div>
                <div className="col-span-1">Pos</div>
                <div className="col-span-2 text-green-400">OVR</div>
                <div className="col-span-1 text-purple-400" title="Idade">Id</div>
                <div className="col-span-2 text-yellow-400 flex items-center justify-center gap-1"><Battery size={12}/></div>
                <div className="col-span-1 text-red-400 flex items-center justify-center"><Ban size={12}/></div>
                <div className="col-span-1 text-emerald-400 flex items-center justify-center" title="Mercado"><DollarSign size={14}/></div>
                <div className="col-span-1 text-slate-400 flex items-center justify-center"><Trash2 size={12}/></div>
              </div>
              
              {safePlayers.map((player, idx) => (
                <div key={player.id || idx} className={`border rounded-xl p-1.5 grid grid-cols-12 gap-1 items-center shadow-sm transition-colors ${player.unavailable ? 'bg-red-950/20 border-red-900/50' : (player.energy < 75 ? 'bg-yellow-950/20 border-yellow-900/50' : 'bg-slate-900 border-slate-700')}`}>
                  <input type="text" value={player.name} onChange={(e) => updatePlayerStat(idx, 'name', e.target.value)} className="col-span-3 bg-transparent text-xs font-semibold text-slate-200 outline-none w-full truncate px-1" />
                  
                  <input type="text" value={player.pos || ''} onChange={(e) => updatePlayerStat(idx, 'pos', e.target.value)} className="col-span-1 bg-slate-950 border border-slate-800 rounded text-center text-xs py-1.5 font-medium text-blue-400 outline-none w-full uppercase" maxLength={3} />
                  
                  <input type="number" value={player.ovr} onChange={(e) => updatePlayerStat(idx, 'ovr', e.target.value)} className="col-span-2 bg-slate-950 border border-slate-800 rounded text-center text-xs py-1.5 font-bold text-green-400 outline-none w-full" />
                  
                  <input type="number" value={player.age || 25} onChange={(e) => updatePlayerStat(idx, 'age', e.target.value)} className="col-span-1 bg-slate-950 border border-slate-800 rounded text-center text-xs py-1.5 font-medium text-purple-300 outline-none w-full px-0" title="Idade" />

                  <input type="number" value={player.energy ?? 100} onChange={(e) => updatePlayerStat(idx, 'energy', e.target.value)} className={`col-span-2 bg-slate-950 border rounded text-center text-[11px] py-1.5 font-bold outline-none w-full ${player.energy < 75 ? 'text-yellow-500 border-yellow-700/50' : 'text-slate-300 border-slate-800'}`} min="0" max="100" />
                  
                  <button onClick={() => updatePlayerStat(idx, 'unavailable', !player.unavailable)} className={`col-span-1 flex justify-center py-1.5 rounded transition-colors border ${player.unavailable ? 'bg-red-600 border-red-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-red-400'}`}>
                    <Ban size={12} />
                  </button>

                  <button onClick={() => handleOpenMarket(player)} className="col-span-1 flex justify-center py-1.5 rounded transition-colors border bg-slate-950 border-slate-800 text-emerald-500 hover:bg-emerald-900/30 hover:border-emerald-500/50" title="Revenda no Mercado">
                    <DollarSign size={14} />
                  </button>

                  <button onClick={() => handleRemovePlayer(player.id)} className="col-span-1 flex justify-center text-slate-500 hover:text-red-400 transition-colors">
                    <Trash2 size={14} />
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