export const LINE_BEHAVIOUR_RULES = {
  DEFEND_DEEP: {
    goodWith: ["Counter Attack", "Shoot On Sight"],
    risk: "Low line height. No offside trap."
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
  },
  DROP_DEEP: {
    goodWhen: ["Weak"],
    reduces: "Counter risk"
  }
};