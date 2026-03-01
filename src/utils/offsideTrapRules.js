/**
 * Offside Trap Rules - Validação do Passo 8
 * Princípio: Código de Alta Qualidade e Performance
 */

export const OFFSIDE_TRAP_RULES = {
  SAFE_FORMATIONS: [
    "4-3-3A", "4-3-3B", "3-4-3A", "3-4-3B", 
    "3-5-2", "3-3-2-2", "4-4-2A", "4-2-4A", "4-2-4B"
  ],

  HIGH_RISK_FORMATIONS: [
    "5-4-1A", "5-4-1B", "5-3-1-1", "5-3-2", 
    "5-2-3A", "5-2-3B", "6-3-1A", "6-3-1B"
  ],

  CONDITIONS_TO_ENABLE: {
    defensiveLine: "High",
    pressure: "Balanced or Higher",
    defendersCount: [3, 4]
  },

  CONDITIONS_TO_DISABLE: {
    defensiveLine: "Deep", // "Defesa Recuada" -> Proibição absoluta
    pressure: "Low",
    defendersCount: [5, 6]
  }
};

// Correção do erro de importação no aiCoach.js
export const OFFSIDE_RULES = OFFSIDE_TRAP_RULES;