// src/utils/helpers.js

/**
 * Redimensiona e comprime a imagem usando HTML5 Canvas para máxima performance.
 * @param {File} file - O arquivo de imagem original
 * @param {number} maxWidth - Largura máxima permitida (padrão 1280px)
 * @param {number} quality - Qualidade do JPEG (0.0 a 1.0)
 * @returns {Promise<string>} - A imagem comprimida em Base64 (sem o prefixo)
 */
export const compressImageToBase64 = (file, maxWidth = 1280, quality = 0.7) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Calcula a nova proporção se a imagem for maior que o limite
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        // Desenha a imagem redimensionada no canvas
        ctx.drawImage(img, 0, 0, width, height);

        // Exporta como JPEG com compressão (Remove transparências pesadas de PNGs)
        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        
        // Retorna apenas a string Base64 limpa para o Gemini
        resolve(compressedDataUrl.split(',')[1]);
      };
      
      img.onerror = (error) => reject(error);
    };
    
    reader.onerror = (error) => reject(error);
  });
};

/**
 * Calcula a média do time baseada no maior status (Nota Máxima) de cada jogador.
 */
export const calculateTeamOvr = (players) => {
  if (!players || players.length === 0) return 0;
  
  const total = players.reduce((sum, p) => {
    const bestStat = Math.max(Number(p.att) || 0, Number(p.def) || 0, Number(p.ovr) || 0);
    return sum + bestStat;
  }, 0);
  
  return Math.round(total / players.length);
};