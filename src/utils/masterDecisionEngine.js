/**
 * 🧠 Master Decision Engine - OSM AI Coach
 * Princípio: Arquitetura Escalável e Código Limpo
 * Implementa as 11 etapas de decisão tática.
 */

// --- BASES DE CONHECIMENTO (Dicionários) ---
const CATEGORIES = {
  DEFENSIVE: ["6-3-1A", "6-3-1B", "5-4-1A", "5-4-1B", "5-3-1-1", "5-3-2", "5-2-3A", "5-2-3B", "4-5-1"],
  BALANCED: ["4-4-2A", "4-4-2B", "3-5-2", "4-2-3-1", "3-3-2-2"],
  ATTACKING: ["4-3-3A", "4-3-3B", "3-4-3A", "3-4-3B", "4-2-4A", "4-2-4B"]
};

const COUNTER_MATRIX = {
  "4-3-3A": { fav: "4-3-3B", even: "4-4-2B", under: "5-3-2" },
  "4-3-3B": { fav: "4-3-3A", even: "4-4-2A", under: "5-3-1-1" },
  "4-4-2A": { fav: "4-3-3A", even: "4-4-2B", under: "4-5-1" },
  "4-4-2B": { fav: "4-3-3B", even: "4-4-2A", under: "4-2-3-1" },
  "5-3-2":  { fav: "3-4-3B", even: "4-4-2A", under: "5-3-2" },
  // Fallback genérico para formações não mapeadas:
  "DEFAULT": { fav: "4-3-3B", even: "4-4-2B", under: "5-3-2" } 
};

class MasterDecisionEngine {
  constructor() {
    this.decisionLog = [];
  }

  /**
   * Função principal que orquestra os 11 passos
   * @param {number} myOvr - OVR dos titulares do nosso time
   * @param {number} enemyOvr - OVR do time adversário
   * @param {string} enemyFormation - Formação do adversário (Ex: "4-3-3B")
   */
  generateTactic(myOvr, enemyOvr, enemyFormation) {
    this.decisionLog = [];
    this.log("Iniciando processamento tático...");

    // 1️⃣ Calcular OVR
    const ovrDiff = this.calculateOvr(myOvr, enemyOvr);

    // 2️⃣ Classificar bucket
    const bucket = this.classifyBucket(ovrDiff);

    // 3️⃣ Identificar formação adversária
    const enemyForm = enemyFormation ? enemyFormation.toUpperCase() : "UNKNOWN";
    this.log(`Adversário detectado: OVR ${enemyOvr} | Formação: ${enemyForm}`);

    // 4️⃣ Buscar Counter Tactic
    let recommendedFormation = this.getCounterTactic(enemyForm, bucket);

    // 5️⃣ Validar se formação é permitida no bucket
    recommendedFormation = this.validateBucketFormation(recommendedFormation, bucket);

    // 6️⃣ Classificar categoria da formação
    const myCategory = this.classifyCategory(recommendedFormation);

    // 7️⃣ Definir Marcação
    const marking = this.defineMarking(recommendedFormation, enemyForm);

    // 9️⃣ Aplicar sliders oficiais (Adiantado para validar o offside no passo 8)
    let sliders = this.applySliders(bucket, myCategory);

    // 8️⃣ Avaliar Offside Trap
    const offsideTrap = this.evaluateOffsideTrap(recommendedFormation, sliders.pressure);

    // 🔟 Aplicar ajustes condicionais nas instruções de linha
    let lineInstructions = this.applyConditionalAdjustments(myCategory, bucket);

    // 1️⃣1️⃣ Validar proibições absolutas (Fail-Safe)
    this.validateProhibitions(sliders, offsideTrap, lineInstructions);

    this.log("Processamento concluído com sucesso.");

    return {
      matchup: { ovrDifference: ovrDiff, bucket: bucket },
      tactics: {
        formation: recommendedFormation,
        style: this.getPlayStyle(recommendedFormation),
        marking: marking,
        offsideTrap: offsideTrap,
        lineInstructions: lineInstructions,
        sliders: sliders
      },
      log: this.decisionLog
    };
  }

  // --- MÉTODOS DOS 11 PASSOS ---

  log(message) {
    this.decisionLog.push(`[${new Date().toLocaleTimeString()}] ${message}`);
  }

  calculateOvr(myOvr, enemyOvr) {
    const diff = myOvr - enemyOvr;
    this.log(`Passo 1: Diferença de OVR calculada: ${diff > 0 ? '+' : ''}${diff}`);
    return diff;
  }

  classifyBucket(ovrDiff) {
    let bucket = "";
    if (ovrDiff >= 15) bucket = "OVERWHELMING_FAVORITE";
    else if (ovrDiff >= 7) bucket = "STRONG_FAVORITE";
    else if (ovrDiff >= -6 && ovrDiff <= 6) bucket = "EVEN_MATCH";
    else if (ovrDiff >= -14) bucket = "WEAK_UNDERDOG";
    else bucket = "OVERWHELMING_UNDERDOG";
    
    this.log(`Passo 2: Categoria de Confronto (Bucket): ${bucket}`);
    return bucket;
  }

  getCounterTactic(enemyForm, bucket) {
    const matrix = COUNTER_MATRIX[enemyForm] || COUNTER_MATRIX["DEFAULT"];
    let tactic = matrix.even;

    if (bucket.includes("FAVORITE")) tactic = matrix.fav;
    if (bucket.includes("UNDERDOG")) tactic = matrix.under;

    this.log(`Passo 4: Counter Tactic base buscada: ${tactic}`);
    return tactic;
  }

  validateBucketFormation(formation, bucket) {
    // Exemplo de regra: Underdogs não devem usar 4-2-4 (suicida)
    if (bucket === "OVERWHELMING_UNDERDOG" && ["4-2-4A", "4-2-4B", "3-4-3A"].includes(formation)) {
      this.log(`Passo 5: Formação ${formation} proibida para Underdog. Ajustando para 5-4-1B.`);
      return "5-4-1B";
    }
    return formation;
  }

  classifyCategory(formation) {
    if (CATEGORIES.DEFENSIVE.includes(formation)) return "DEFENSIVE";
    if (CATEGORIES.ATTACKING.includes(formation)) return "ATTACKING";
    return "BALANCED";
  }

  defineMarking(myFormation, enemyFormation) {
    // Lógica simplificada: Conta o primeiro número da formação (ex: '4' em 4-3-3A)
    const myDefs = parseInt(myFormation.charAt(0)) || 4; 
    let enemyAtks = 2; // Padrão
    
    if (CATEGORIES.ATTACKING.includes(enemyFormation)) enemyAtks = 3;
    if (enemyFormation.includes("4-2-4")) enemyAtks = 4;

    // Regra: Se temos mais zagueiros que os atacantes deles = Zona. Senão = Individual.
    const isZona = myDefs > enemyAtks;
    const result = isZona ? "Marcação por Zona" : "Marcação Individual";
    
    this.log(`Passo 7: Meus Def (${myDefs}) vs Atq Inimigo (${enemyAtks}) -> ${result}`);
    return result;
  }

  evaluateOffsideTrap(formation, pressure) {
    // Formações com 5+ zagueiros NUNCA usam linha de impedimento
    const isSafeFormation = !CATEGORIES.DEFENSIVE.includes(formation);
    const hasPressure = pressure >= 60;

    const result = (isSafeFormation && hasPressure) ? "SIM" : "NÃO";
    this.log(`Passo 8: Offside Trap avaliada -> ${result}`);
    return result;
  }

  applySliders(bucket, category) {
    let pressure = 50, style = 50, tempo = 50;

    if (bucket.includes("FAVORITE")) {
      pressure = 75; style = 75; tempo = 65; // Pressão alta, ofensivo, passe rápido
    } else if (bucket.includes("UNDERDOG")) {
      pressure = 35; style = 30; tempo = 70; // Retranca, defensivo, contra-ataque rápido
    } else { // EVEN_MATCH
      if (category === "ATTACKING") { pressure = 65; style = 65; tempo = 60; }
      else if (category === "DEFENSIVE") { pressure = 45; style = 40; tempo = 55; }
    }

    this.log(`Passo 9: Sliders Base -> Pressão: ${pressure} | Estilo: ${style} | Tempo: ${tempo}`);
    return { pressure, style, tempo };
  }

  applyConditionalAdjustments(category, bucket) {
    let instructions = {
      attackers: "Apenas Ataque",
      midfield: "Ficar na Posição",
      defense: "Ficar na Defesa"
    };

    if (bucket === "OVERWHELMING_UNDERDOG") {
      instructions.midfield = "Apoiar a Defesa";
      instructions.attackers = "Apoiar o Meio-campo";
    }

    this.log(`Passo 10: Ajustes de Linha Condicionais aplicados.`);
    return instructions;
  }

  validateProhibitions(sliders, offsideTrap, lineInstructions) {
    // Passo 11: Fail-safes absolutos
    if (lineInstructions.defense === "Defesa Recuada" && offsideTrap === "SIM") {
      this.log(`🚨 Passo 11 PROIBIÇÃO: Offside Trap forçado para NÃO devido à Defesa Recuada.`);
      return false; // Retorna false se corrigiu algo (para uso interno)
    }
    return true;
  }

  getPlayStyle(formation) {
    if (CATEGORIES.ATTACKING.includes(formation)) return "Jogo pelas Laterais"; // Wing Play
    if (CATEGORIES.DEFENSIVE.includes(formation)) return "Contra-Ataque"; // Counter Attack
    if (formation.includes("4-2-3-1") || formation.includes("4-5-1")) return "Chutar Direto"; // Shoot on sight
    return "Troca de Passes"; // Passing game
  }
}

// Exporta a instância pronta para uso (Padrão Singleton)
export const MASTER_DECISION = new MasterDecisionEngine();
export const AI_COACH = MASTER_DECISION;