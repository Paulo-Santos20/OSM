/**
 * Knowledge Base: Regras de Comportamento de Linha
 * Princípio: Código Limpo e Manutenibilidade
 */

export const LINE_TACTICS = {
  // Regras de Posicionamento de Atacantes
  ATTACKERS: {
    STAY_FORWARD: { label: "Apenas Ataque", code: "STAY_FWD" },
    SUPPORT_MIDFIELD: { label: "Apoiar Meio-campo", code: "SUPP_MID" },
    HELP_DEFENSE: { label: "Apoiar Defesa", code: "HELP_DEF" }
  },

  // Regras de Posicionamento de Meio-campistas
  MIDFIELDERS: {
    STAY_IN_POSITION: { label: "Ficar na Posição", code: "STAY_POS" },
    PUSH_FORWARD: { label: "Avançar", code: "PUSH_FWD" },
    PROTECT_DEFENSE: { label: "Proteger a Defesa", code: "PROT_DEF" }
  },

  // Regras de Posicionamento de Defensores
  DEFENDERS: {
    DEFEND_DEEP: { label: "Defesa Recuada", code: "DEF_DEEP" },
    ATTACKING_FULLBACKS: { label: "Laterais Ofensivos", code: "ATT_FB" },
    MAN_MARKING: { label: "Marcação Individual", code: "MAN_MARK" }
  }
};

// Mantemos o objeto original para compatibilidade ou lógica de validação
export const LINE_BEHAVIOUR_RULES = {
  DEFEND_DEEP: {
    goodWith: ["Counter Attack", "Shoot On Sight"],
    risk: "Low line height. No offside trap.",
    incompatibleWith: ["Offside Trap: YES"]
  },
  ATTACKING_FULLBACKS: {
    goodWith: ["Wing Play"],
    requires: "Midfield Stability"
  },
  PROTECT_DEFENSE: {
    goodWhen: ["Weak", "Much Weaker"]
  },
  PUSH_FORWARD: {
    goodWhen: ["Strong", "Overwhelming"],
    risk: "Counter vulnerability"
  }
};