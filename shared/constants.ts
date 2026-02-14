/**
 * APEX Platform - Shared Constants
 * Values, templates, and configuration constants used across the application
 */

// ============================================================================
// CORE VALUES FRAMEWORK
// ============================================================================

export const CORE_VALUES = {
  INTEGRITY: {
    name: "Integrity",
    description: "Acts with honesty, transparency, and ethical judgment",
    behaviors: [
      "Admits mistakes openly",
      "Keeps commitments",
      "Transparent in communication",
      "Challenges unethical practices",
      "Takes accountability"
    ],
    antiBehaviors: [
      "Hides information",
      "Blames others",
      "Makes excuses",
      "Manipulates data",
      "Avoids responsibility"
    ]
  },
  EXCELLENCE: {
    name: "Excellence",
    description: "Pursues high standards and continuous improvement",
    behaviors: [
      "Delivers quality work",
      "Seeks feedback actively",
      "Learns from failures",
      "Raises the bar for team",
      "Takes pride in output"
    ],
    antiBehaviors: [
      "Accepts mediocrity",
      "Defensive about feedback",
      "Repeats same mistakes",
      "Cuts corners",
      "Delivers minimum viable"
    ]
  },
  COLLABORATION: {
    name: "Collaboration",
    description: "Works effectively across boundaries to achieve shared goals",
    behaviors: [
      "Shares credit generously",
      "Helps others succeed",
      "Seeks diverse perspectives",
      "Resolves conflicts constructively",
      "Builds bridges across teams"
    ],
    antiBehaviors: [
      "Hoards information",
      "Takes sole credit",
      "Creates silos",
      "Avoids difficult conversations",
      "Undermines colleagues"
    ]
  },
  INNOVATION: {
    name: "Innovation",
    description: "Challenges status quo and drives creative solutions",
    behaviors: [
      "Experiments with new approaches",
      "Questions assumptions",
      "Learns from adjacent industries",
      "Encourages calculated risks",
      "Simplifies complexity"
    ],
    antiBehaviors: [
      "Resists change",
      "Says 'we've always done it this way'",
      "Punishes failure",
      "Adds unnecessary complexity",
      "Ignores market shifts"
    ]
  },
  CUSTOMER_FOCUS: {
    name: "Customer Focus",
    description: "Deeply understands and serves customer needs",
    behaviors: [
      "Listens to customer feedback",
      "Anticipates customer needs",
      "Resolves issues quickly",
      "Measures customer impact",
      "Makes customer-centric decisions"
    ],
    antiBehaviors: [
      "Ignores customer complaints",
      "Prioritizes internal convenience",
      "Defensive about product flaws",
      "Lacks empathy for users",
      "Ships without user testing"
    ]
  }
} as const;

export type ValueKey = keyof typeof CORE_VALUES;

// ============================================================================
// OBSERVATION TEMPLATES
// ============================================================================

export const OBSERVATION_TEMPLATES = [
  {
    id: "strong_delivery",
    label: "Strong delivery",
    text: "Delivered [project/milestone] ahead of schedule with high quality",
    direction: "POSITIVE" as const,
    suggestedTags: ["EXCELLENCE", "CUSTOMER_FOCUS"]
  },
  {
    id: "creative_solution",
    label: "Creative solution",
    text: "Found an innovative approach to [problem] that [impact]",
    direction: "POSITIVE" as const,
    suggestedTags: ["INNOVATION", "EXCELLENCE"]
  },
  {
    id: "helped_colleague",
    label: "Helped colleague",
    text: "Went out of their way to help [colleague] with [situation]",
    direction: "POSITIVE" as const,
    suggestedTags: ["COLLABORATION"]
  },
  {
    id: "owned_mistake",
    label: "Owned mistake",
    text: "Took accountability for [issue] and quickly implemented [solution]",
    direction: "POSITIVE" as const,
    suggestedTags: ["INTEGRITY", "EXCELLENCE"]
  },
  {
    id: "customer_advocacy",
    label: "Customer advocacy",
    text: "Championed customer needs in [situation] leading to [outcome]",
    direction: "POSITIVE" as const,
    suggestedTags: ["CUSTOMER_FOCUS", "INTEGRITY"]
  },
  {
    id: "missed_deadline",
    label: "Missed deadline",
    text: "Missed deadline for [deliverable] due to [reason]. Need to improve [area]",
    direction: "NEEDS_IMPROVEMENT" as const,
    suggestedTags: ["EXCELLENCE"]
  },
  {
    id: "communication_gap",
    label: "Communication gap",
    text: "Failed to communicate [information] to [stakeholders], causing [impact]",
    direction: "NEEDS_IMPROVEMENT" as const,
    suggestedTags: ["COLLABORATION", "INTEGRITY"]
  },
  {
    id: "resisted_feedback",
    label: "Resisted feedback",
    text: "Became defensive when receiving feedback about [topic]",
    direction: "NEEDS_IMPROVEMENT" as const,
    suggestedTags: ["EXCELLENCE", "COLLABORATION"]
  }
] as const;

// ============================================================================
// ROLE TYPES & PERMISSIONS
// ============================================================================

export const ROLE_TYPES = {
  CHAIRMAN: "CHAIRMAN",
  GROUP_CEO: "GROUP_CEO",
  GROUP_CHRO: "GROUP_CHRO",
  CEO: "CEO",
  CXO: "CXO",
  CXO_PLUS_ONE: "CXO_PLUS_ONE",
  CHRO: "CHRO",
  BOARD_MEMBER: "BOARD_MEMBER"
} as const;

export type RoleType = typeof ROLE_TYPES[keyof typeof ROLE_TYPES];

export const ROLE_PERMISSIONS = {
  [ROLE_TYPES.CHAIRMAN]: {
    canViewPriorityZero: true,
    canViewAllCompanies: true,
    canViewCEOReviews: true,
    canApproveCEOReviews: true,
    canAccessBoardReports: true
  },
  [ROLE_TYPES.GROUP_CEO]: {
    canViewPriorityZero: true,
    canViewAllCompanies: true,
    canViewCEOReviews: true,
    canApproveCEOReviews: false,
    canAccessBoardReports: true
  },
  [ROLE_TYPES.GROUP_CHRO]: {
    canViewPriorityZero: false,
    canViewAllCompanies: true,
    canViewCEOReviews: true,
    canApproveCEOReviews: false,
    canAccessBoardReports: true,
    canConfigureIncentives: true,
    canManageCalibration: true
  },
  [ROLE_TYPES.CEO]: {
    canViewPriorityZero: false,
    canViewAllCompanies: false,
    canViewCEOReviews: false,
    canApproveCEOReviews: false,
    canAccessBoardReports: false,
    canViewIncentiveSimulator: true
  },
  [ROLE_TYPES.CXO]: {
    canViewTeamData: true,
    canWriteReviews: true,
    canConductCalibration: true
  },
  [ROLE_TYPES.CXO_PLUS_ONE]: {
    canViewTeamData: true,
    canWriteReviews: true
  }
} as const;

// ============================================================================
// DATA SUFFICIENCY LEVELS
// ============================================================================

export const DATA_SUFFICIENCY_LEVELS = {
  LEVEL_0: {
    level: 0,
    label: "Cold Start",
    description: "No data yet",
    minEvidence: 0,
    minSources: 0,
    capabilities: []
  },
  LEVEL_1: {
    level: 1,
    label: "Initial Signal",
    description: "1-4 observations from 1-2 sources",
    minEvidence: 1,
    minSources: 1,
    capabilities: ["basic_profile", "recent_observations"]
  },
  LEVEL_2: {
    level: 2,
    label: "Emerging Pattern",
    description: "5-14 observations from 2-3 sources",
    minEvidence: 5,
    minSources: 2,
    capabilities: ["values_profile", "performance_trends", "1:1_prep"]
  },
  LEVEL_3: {
    level: 3,
    label: "Reliable Intelligence",
    description: "15-29 observations from 3+ sources",
    minEvidence: 15,
    minSources: 3,
    capabilities: ["ai_review_draft", "capability_discovery", "pattern_alerts"]
  },
  LEVEL_4: {
    level: 4,
    label: "High Confidence",
    description: "30+ observations from 4+ sources",
    minEvidence: 30,
    minSources: 4,
    capabilities: ["full_ai_features", "predictive_insights", "benchmarking"]
  }
} as const;

// ============================================================================
// NOTIFICATION TYPES & BUDGET
// ============================================================================

export const NOTIFICATION_TYPES = {
  PRIORITY_ZERO: {
    type: "PRIORITY_ZERO",
    priority: 1,
    countsTowardBudget: true
  },
  INSIGHT: {
    type: "INSIGHT",
    priority: 2,
    countsTowardBudget: true
  },
  MILESTONE: {
    type: "MILESTONE",
    priority: 3,
    countsTowardBudget: true
  },
  PULSE_CHECK: {
    type: "PULSE_CHECK",
    priority: 4,
    countsTowardBudget: false
  },
  ACHIEVEMENT_SUGGESTION: {
    type: "ACHIEVEMENT_SUGGESTION",
    priority: 5,
    countsTowardBudget: false
  },
  REMINDER: {
    type: "REMINDER",
    priority: 6,
    countsTowardBudget: false
  }
} as const;

export const NOTIFICATION_BUDGET = {
  DAILY_LIMIT: 3,
  PRIORITY_ZERO_ALWAYS_SEND: true
};

// ============================================================================
// INCENTIVE CONFIGURATION
// ============================================================================

export const DEFAULT_SLAB_STRUCTURE = [
  { minPct: 0, maxPct: 80, payoutPct: 0 },
  { minPct: 80, maxPct: 90, payoutPct: 50 },
  { minPct: 90, maxPct: 100, payoutPct: 100 },
  { minPct: 100, maxPct: 110, payoutPct: 150 },
  { minPct: 110, maxPct: 120, payoutPct: 200 },
  { minPct: 120, maxPct: 999, payoutPct: 250 }
];

export const BUSINESS_TYPES = {
  GROWTH: "GROWTH",
  HARVEST: "HARVEST",
  INCUBATE: "INCUBATE"
} as const;

export const DEFAULT_FINANCIAL_WEIGHTS = {
  GROWTH: {
    REVENUE: 0.35,
    EBITDA: 0.35,
    OFCF: 0.30
  },
  HARVEST: {
    REVENUE: 0.20,
    EBITDA: 0.40,
    OFCF: 0.40
  },
  INCUBATE: {
    REVENUE: 0.50,
    EBITDA: 0.30,
    OFCF: 0.20
  }
};

// ============================================================================
// MILESTONE ASSESSMENT TRIGGERS
// ============================================================================

export const MILESTONE_DAYS = [30, 60, 90, 180, 365] as const;

export const MILESTONE_QUESTIONS = {
  30: [
    "Is the person settling into the role and team?",
    "Are they demonstrating the predicted strengths from hiring thesis?",
    "Any early concerns about fit or performance?"
  ],
  60: [
    "Is the person delivering on initial projects?",
    "How are they collaborating with the team?",
    "Are the predicted risks from hiring thesis materializing?"
  ],
  90: [
    "Has the person achieved their 90-day goals?",
    "Are they demonstrating our core values?",
    "What development areas have emerged?"
  ],
  180: [
    "Is the person performing at expected level?",
    "Are they ready for increased scope?",
    "Any concerns about long-term fit?"
  ],
  365: [
    "Has the person met their annual objectives?",
    "Are they a strong cultural fit?",
    "What's the development plan for year 2?"
  ]
};

// ============================================================================
// PERFORMANCE QUADRANTS
// ============================================================================

export const PERFORMANCE_QUADRANTS = {
  STAR: {
    label: "Star",
    description: "High Performance + High Values",
    color: "success-green"
  },
  HIGH_POTENTIAL: {
    label: "High Potential",
    description: "High Performance + Developing Values",
    color: "accent-blue"
  },
  BRILLIANT_JERK: {
    label: "Values Risk",
    description: "High Performance + Low Values",
    color: "warning-amber"
  },
  NEEDS_DEVELOPMENT: {
    label: "Needs Development",
    description: "Low Performance + Any Values",
    color: "alert-red"
  }
} as const;

// ============================================================================
// GOAL CATEGORIES (AVP Framework)
// ============================================================================

export const GOAL_CATEGORIES = {
  FINANCIAL: {
    name: "Financial",
    weight: 0.35,
    description: "Revenue, profitability, cash flow targets"
  },
  STRATEGIC: {
    name: "Strategic",
    weight: 0.25,
    description: "Market position, competitive advantage, innovation"
  },
  OPERATIONAL: {
    name: "Operational",
    weight: 0.20,
    description: "Efficiency, quality, process improvement"
  },
  SUSTAINABILITY: {
    name: "Sustainability",
    weight: 0.05,
    description: "Environmental, social, governance initiatives"
  },
  LEADERSHIP: {
    name: "Leadership",
    weight: 0.10,
    description: "Team development, culture, talent pipeline"
  },
  GOVERNANCE: {
    name: "Governance",
    weight: 0.05,
    description: "Compliance, risk management, controls"
  }
} as const;

// ============================================================================
// EVIDENCE CREDIBILITY TIERS
// ============================================================================

export const CREDIBILITY_TIERS = {
  TIER_1: {
    tier: 1,
    weight: 2.0,
    sources: ["FINANCIAL_REPORT", "BOARD_PRESENTATION", "CUSTOMER_CONTRACT"]
  },
  TIER_2: {
    tier: 2,
    weight: 1.5,
    sources: ["CUSTOMER_EMAIL", "PEER_FEEDBACK", "MEETING_NOTE"]
  },
  TIER_3: {
    tier: 3,
    weight: 1.0,
    sources: ["MANAGER_OBSERVATION", "ARTICLE_SHARE"]
  },
  TIER_4: {
    tier: 4,
    weight: 0.7,
    sources: ["SELF_OBSERVATION"]
  },
  TIER_5: {
    tier: 5,
    weight: 0.5,
    sources: ["SELF_REFLECTION"]
  }
} as const;

// ============================================================================
// COOL-DOWN PERIODS (Anti-Gaming)
// ============================================================================

export const COOL_DOWN_RULES = {
  SAME_PERSON_SAME_VALUE: {
    hours: 48,
    description: "Same observer writing about same person + same value"
  },
  BURST_DETECTION: {
    threshold: 5,
    windowHours: 24,
    description: "More than 5 observations in 24 hours triggers review"
  }
};

// ============================================================================
// TRUST RAMP (Self-Reflection)
// ============================================================================

export const TRUST_RAMP_STAGES = {
  MONTH_1: {
    month: 1,
    visibility: "PRIVATE_ONLY",
    prompt: "Journal is 100% private. Write freely.",
    sharing: false
  },
  MONTH_2: {
    month: 2,
    visibility: "GENTLE_PROMPT",
    prompt: "Would you like to share any achievements with your manager?",
    sharing: "OPTIONAL"
  },
  MONTH_3: {
    month: 3,
    visibility: "FULL_SHARING",
    prompt: "Achievements can be corroborated with manager observations",
    sharing: "ENCOURAGED"
  }
} as const;

// ============================================================================
// FISCAL YEAR CONFIGURATION
// ============================================================================

export const DEFAULT_FISCAL_YEAR_START = 4; // April (Indian fiscal year)

// ============================================================================
// CURRENCY DISPLAY
// ============================================================================

export const CURRENCY_UNITS = {
  INR: {
    symbol: "₹",
    displayUnit: "Cr",
    divisor: 10000000 // 1 Crore = 10 million
  },
  USD: {
    symbol: "$",
    displayUnit: "M",
    divisor: 1000000 // 1 Million
  },
  EUR: {
    symbol: "€",
    displayUnit: "M",
    divisor: 1000000
  }
} as const;

// ============================================================================
// CACHE TTL
// ============================================================================

export const CACHE_TTL = {
  ASK_QUERY: 4 * 60 * 60 * 1000, // 4 hours
  ONE_ON_ONE_PREP: 24 * 60 * 60 * 1000, // 24 hours
  INSIGHT: 24 * 60 * 60 * 1000, // 24 hours
  MEMORY: 7 * 24 * 60 * 60 * 1000 // 7 days
} as const;

// ============================================================================
// EXPORT HELPERS
// ============================================================================

export function getValueLabel(key: string): string {
  return CORE_VALUES[key as ValueKey]?.name || key;
}

export function getDataSufficiencyLevel(evidenceCount: number, sourceCount: number): number {
  if (evidenceCount >= 30 && sourceCount >= 4) return 4;
  if (evidenceCount >= 15 && sourceCount >= 3) return 3;
  if (evidenceCount >= 5 && sourceCount >= 2) return 2;
  if (evidenceCount >= 1 && sourceCount >= 1) return 1;
  return 0;
}

export function formatCurrency(value: number, currency: keyof typeof CURRENCY_UNITS = "INR"): string {
  const config = CURRENCY_UNITS[currency];
  const displayValue = value / config.divisor;
  return `${config.symbol}${displayValue.toFixed(2)} ${config.displayUnit}`;
}
