export const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = (error) => reject(error);
  });
};

export const calculateTeamOvr = (players) => {
  if (!players || players.length === 0) return 0;
  
  // A média agora é calculada baseada no STATUS MAIS ALTO de cada jogador
  const total = players.reduce((sum, p) => {
    const bestStat = Math.max(Number(p.att) || 0, Number(p.def) || 0, Number(p.ovr) || 0);
    return sum + bestStat;
  }, 0);
  
  return Math.round(total / players.length);
};