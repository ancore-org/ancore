#![allow(dead_code)]

//! Metrics and reporting for the UpgradeGovernor contract.
//!
//! Provides:
//! - Proposal statistics
//! - Success/failure rates
//! - Time-to-execution analytics
//! - Historical rollup reports

use soroban_sdk::{Address, BytesN, Env, Symbol, Vec};

use crate::{Proposal, UpgradeHistory, UpgradeError, DataKey};

/// Compute aggregate statistics for all proposals.
pub fn proposal_stats(env: &Env) -> ProposalStats {
    let next_id: u32 = env
        .storage()
        .instance()
        .get(&DataKey::NextProposalId)
        .unwrap_or(1);

    let mut stats = ProposalStats::default();
    for id in 1..next_id {
        if let Some(proposal) = env.storage().instance().get(&DataKey::Proposal(id)) {
            stats.total += 1;
            if proposal.executed {
                stats.executed += 1;
            }
            if proposal.cancelled {
                stats.cancelled += 1;
            }
            if !proposal.executed && !proposal.cancelled {
                stats.pending += 1;
            }
        }
    }
    stats
}

/// Aggregate proposal statistics.
#[derive(Clone, Debug, Default)]
pub struct ProposalStats {
    pub total: u32,
    pub executed: u32,
    pub cancelled: u32,
    pub pending: u32,
}

impl ProposalStats {
    pub fn success_rate(&self) -> f64 {
        if self.total == 0 {
            return 0.0;
        }
        self.executed as f64 / self.total as f64
    }

    pub fn cancellation_rate(&self) -> f64 {
        if self.total == 0 {
            return 0.0;
        }
        self.cancelled as f64 / self.total as f64
    }
}

/// Compute statistics for upgrade history.
pub fn history_stats(env: &Env) -> HistoryStats {
    let next_id: u32 = env
        .storage()
        .instance()
        .get(&DataKey::NextHistoryId)
        .unwrap_or(1);

    let mut stats = HistoryStats::default();
    for id in 1..next_id {
        if let Some(entry) = env.storage().instance().get(&DataKey::UpgradeHistory(id)) {
            stats.total += 1;
            if entry.success {
                stats.successes += 1;
            } else {
                stats.failures += 1;
            }
        }
    }
    stats
}

/// Aggregate history statistics.
#[derive(Clone, Debug, Default)]
pub struct HistoryStats {
    pub total: u32,
    pub successes: u32,
    pub failures: u32,
}

impl HistoryStats {
    pub fn success_rate(&self) -> f64 {
        if self.total == 0 {
            return 0.0;
        }
        self.successes as f64 / self.total as f64
    }
}

/// Compute average time-to-execute for proposals.
pub fn average_time_to_execute(env: &Env) -> Option<u64> {
    let next_id: u32 = env
        .storage()
        .instance()
        .get(&DataKey::NextHistoryId)
        .unwrap_or(1);

    let mut total_delta: u64 = 0;
    let mut count: u32 = 0;

    for id in 1..next_id {
        if let Some(entry) = env.storage().instance().get(&DataKey::UpgradeHistory(id)) {
            if entry.success {
                let proposal = env.storage().instance().get(&DataKey::Proposal(entry.proposal_id));
                if let Some(p) = proposal {
                    if entry.executed_at >= p.proposed_at {
                        total_delta += entry.executed_at - p.proposed_at;
                        count += 1;
                    }
                }
            }
        }
    }

    if count == 0 {
        None
    } else {
        Some(total_delta / count as u64)
    }
}

/// Emit a historical rollup event summarizing proposal outcomes.
pub fn emit_historical_rollup(
    env: &Env,
    start_id: u32,
    end_id: u32,
) {
    let stats = proposal_stats(env);
    env.events().publish(
        (Symbol::new(env, "historical_rollup"),),
        (start_id, end_id, stats.total, stats.executed, stats.cancelled),
    );
}

/// Get recent failed upgrades for alerting.
pub fn recent_failures(env: &Env, since: u64) -> Vec<UpgradeHistory> {
    let next_id: u32 = env
        .storage()
        .instance()
        .get(&DataKey::NextHistoryId)
        .unwrap_or(1);

    let mut failures = Vec::new(env);
    for id in 1..next_id {
        if let Some(entry) = env.storage().instance().get(&DataKey::UpgradeHistory(id)) {
            if !entry.success && entry.executed_at >= since {
                failures.push_back(entry);
            }
        }
    }
    failures
}

/// Check if upgrade success rate has dropped below a threshold.
pub fn is_success_rate_critical(env: &Env, threshold: f64) -> bool {
    let stats = history_stats(env);
    stats.success_rate() < threshold
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{Address, BytesN, Env};

    #[test]
    fn test_proposal_stats_empty() {
        let env = Env::default();
        let stats = proposal_stats(&env);
        assert_eq!(stats.total, 0);
        assert_eq!(stats.success_rate(), 0.0);
    }

    #[test]
    fn test_average_time_to_execute_none() {
        let env = Env::default();
        assert!(average_time_to_execute(&env).is_none());
    }
}