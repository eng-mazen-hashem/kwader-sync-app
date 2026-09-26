// -------------------------------------------------------------------------
// KWADER SaaS - Plan Usage Limits & Quotas Configuration
// -------------------------------------------------------------------------

export const DEFAULT_PLAN_LIMITS = {
  Starter: {
    max_employees: 25,
    max_devices: 1,
    max_branches: 1,
    ai_enabled: false,
    max_ai_queries: 0,
    whatsapp_enabled: false,
    whatsapp_monthly_limit: 0,
  },
  Pro: {
    max_employees: 60,
    max_devices: 3,
    max_branches: 3,
    ai_enabled: true,
    max_ai_queries: 250,
    whatsapp_enabled: true,
    whatsapp_monthly_limit: 500,
  },
  Enterprise: {
    max_employees: 150,
    max_devices: 999, // Practically unlimited
    max_branches: 999,
    ai_enabled: true,
    max_ai_queries: 2000,
    whatsapp_enabled: true,
    whatsapp_monthly_limit: 99999,
  },
};

/**
 * Normalizes plan name string to standard keys: 'Starter', 'Pro', 'Enterprise'
 */
export function normalizePlanName(plan) {
  const p = (plan || 'Starter').toString().trim().toLowerCase();
  if (p.includes('enterprise')) return 'Enterprise';
  if (p.includes('pro')) return 'Pro';
  return 'Starter';
}

/**
 * Resolves the full effective limits for a company, factoring in:
 * 1. Default limits based on plan tier
 * 2. Custom settings overrides defined by SuperAdmin in company.settings.limits
 * 3. Direct overrides (like company.settings.max_employees or company.max_employees)
 */
export function getCompanyLimits(company) {
  if (!company) return { ...DEFAULT_PLAN_LIMITS.Starter };

  const planKey = normalizePlanName(company.plan);
  const defaults = DEFAULT_PLAN_LIMITS[planKey] || DEFAULT_PLAN_LIMITS.Starter;
  const customLimits = company.settings?.limits || {};

  const max_employees = Number(
    customLimits.max_employees ?? 
    company.settings?.max_employees ?? 
    company.max_employees ?? 
    defaults.max_employees
  ) || defaults.max_employees;

  const max_devices = Number(
    customLimits.max_devices ?? 
    company.settings?.max_devices ?? 
    defaults.max_devices
  ) || defaults.max_devices;

  const max_branches = Number(
    customLimits.max_branches ?? 
    company.settings?.max_branches ?? 
    defaults.max_branches
  ) || defaults.max_branches;

  const ai_enabled = customLimits.ai_enabled !== undefined 
    ? Boolean(customLimits.ai_enabled) 
    : (company.settings?.ai_enabled !== undefined ? Boolean(company.settings.ai_enabled) : defaults.ai_enabled);

  const max_ai_queries = Number(
    customLimits.max_ai_queries ?? 
    company.settings?.max_ai_queries ?? 
    defaults.max_ai_queries
  ) || defaults.max_ai_queries;

  const whatsapp_enabled = customLimits.whatsapp_enabled !== undefined 
    ? Boolean(customLimits.whatsapp_enabled) 
    : (company.settings?.whatsapp_enabled !== undefined ? Boolean(company.settings.whatsapp_enabled) : defaults.whatsapp_enabled);

  const whatsapp_monthly_limit = Number(
    customLimits.whatsapp_monthly_limit ?? 
    company.settings?.whatsapp_monthly_limit ?? 
    defaults.whatsapp_monthly_limit
  ) || defaults.whatsapp_monthly_limit;

  return {
    planKey,
    max_employees,
    max_devices,
    max_branches,
    ai_enabled,
    max_ai_queries,
    whatsapp_enabled,
    whatsapp_monthly_limit,
  };
}

/**
 * Calculates a consolidated resource usage percentage (0-100)
 */
export function calculateUsagePercentage(actualCount, maxLimit) {
  if (!maxLimit || maxLimit <= 0) return 0;
  if (maxLimit >= 999) {
    // For unlimited, show percentage based on 100 soft capacity or 0
    return Math.min(100, Math.round((actualCount / 150) * 100));
  }
  return Math.min(100, Math.round((actualCount / maxLimit) * 100));
}
