#![no_std]

//! # Ancore Invoice Contract
//!
//! Invoice and request-to-pay contract for business finance workflows.
//!
//! ## Features
//! - Create invoices with due dates and references
//! - Invoice status lifecycle (draft/open/paid/expired/cancelled)
//! - On-chain receipt hash anchoring for auditability
//!
//! ## Events
//! - `invoice_created`: Emitted when an invoice is created
//! - `invoice_paid`: Emitted when an invoice is paid
//! - `invoice_cancelled`: Emitted when an invoice is cancelled
//! - `invoice_expired`: Emitted when an invoice expires

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, Address, BytesN, Env, Symbol, Vec,
};

/// Contract error types
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum ContractError {
    AlreadyExists = 1,
    NotFound = 2,
    Unauthorized = 3,
    InvalidStatus = 4,
    AlreadyPaid = 5,
    Expired = 6,
    InvalidAmount = 7,
}

/// Invoice status
#[contracttype]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum InvoiceStatus {
    Draft = 0,
    Open = 1,
    Paid = 2,
    Expired = 3,
    Cancelled = 4,
}

/// Invoice data structure
#[contracttype]
#[derive(Clone)]
pub struct Invoice {
    pub id: BytesN<32>,
    pub account: Address,
    pub recipient: Address,
    pub amount: i128,
    pub asset: Symbol,
    pub status: InvoiceStatus,
    pub description: Option<BytesN<32>>,
    pub due_date: Option<u64>,
    pub reference: Option<BytesN<32>>,
    pub created_at: u64,
    pub updated_at: u64,
    pub paid_at: Option<u64>,
    pub payment_tx: Option<BytesN<32>>,
}

/// Event topic naming convention
mod events {
    use soroban_sdk::{Env, Symbol};

    pub fn invoice_created(env: &Env) -> Symbol {
        Symbol::new(env, "invoice_created")
    }

    pub fn invoice_paid(env: &Env) -> Symbol {
        Symbol::new(env, "invoice_paid")
    }

    pub fn invoice_cancelled(env: &Env) -> Symbol {
        Symbol::new(env, "invoice_cancelled")
    }

    pub fn invoice_expired(env: &Env) -> Symbol {
        Symbol::new(env, "invoice_expired")
    }
}

/// Storage keys
mod storage {
    use soroban_sdk::{BytesN, Symbol};

    pub const INVOICE_COUNTER: Symbol = Symbol::short("CNT");
    pub const INVOICE: Symbol = Symbol::short("INV");
}

const DAY_IN_LEDGERS: u32 = 17280; // 24 hours * 60 min * 60 sec / 5 sec per ledger
const INSTANCE_BUMP_AMOUNT: u32 = 30 * DAY_IN_LEDGERS; // 30 days
const INSTANCE_BUMP_THRESHOLD: u32 = 15 * DAY_IN_LEDGERS; // 15 days

pub struct InvoiceContract;

impl InvoiceContract {
    /// Extend the contract instance's storage TTL after a write.
    ///
    /// Mirrors the account contract's TTL-bump pattern: a fixed 30-day bump by
    /// default, extended further when an invoice has a `due_date` further out
    /// than that, so long-lived invoices don't become inaccessible once their
    /// entry TTL lapses.
    fn extend_ttl(env: &Env, due_date: Option<u64>) {
        let (threshold, amount) = match due_date {
            Some(due) => {
                let current_timestamp = env.ledger().timestamp();
                if due > current_timestamp {
                    // 5 seconds per ledger (see DAY_IN_LEDGERS), plus the default
                    // 30-day buffer so the entry outlives the invoice's due date.
                    let diff_seconds = due.saturating_sub(current_timestamp);
                    let calculated_ledgers = (diff_seconds / 5).try_into().unwrap_or(u32::MAX);
                    let ledgers_to_live = calculated_ledgers.saturating_add(INSTANCE_BUMP_AMOUNT);
                    let threshold = ledgers_to_live.saturating_sub(INSTANCE_BUMP_AMOUNT / 2);
                    (threshold, ledgers_to_live)
                } else {
                    (INSTANCE_BUMP_THRESHOLD, INSTANCE_BUMP_AMOUNT)
                }
            }
            None => (INSTANCE_BUMP_THRESHOLD, INSTANCE_BUMP_AMOUNT),
        };

        env.storage().instance().extend_ttl(threshold, amount);
    }
}

#[contractimpl]
impl InvoiceContract {
    /// Create a new invoice
    pub fn create(
        env: &Env,
        account: Address,
        recipient: Address,
        amount: i128,
        asset: Symbol,
        description: Option<BytesN<32>>,
        due_date: Option<u64>,
        reference: Option<BytesN<32>>,
    ) -> BytesN<32> {
        // Validate amount
        if amount <= 0 {
            panic!("Invalid amount");
        }

        // Generate invoice ID
        let mut counter: u64 = env.storage().instance().get(&storage::INVOICE_COUNTER).unwrap_or(0);
        counter += 1;
        env.storage().instance().set(&storage::INVOICE_COUNTER, &counter);

        let id = env.crypto().sha256(&(
            &account,
            &recipient,
            &amount,
            &asset,
            &counter,
            &env.ledger().timestamp(),
        )
            .into_val(env));

        let invoice = Invoice {
            id: id.clone(),
            account: account.clone(),
            recipient,
            amount,
            asset,
            status: InvoiceStatus::Open,
            description,
            due_date,
            reference,
            created_at: env.ledger().timestamp(),
            updated_at: env.ledger().timestamp(),
            paid_at: None,
            payment_tx: None,
        };

        // Store invoice
        let key = (storage::INVOICE, id.clone());
        env.storage().instance().set(&key, &invoice);

        // Extend instance TTL, sized to the invoice's due date when present
        Self::extend_ttl(env, invoice.due_date);

        // Emit event
        env.events().publish(
            events::invoice_created(env),
            (
                id,
                account,
                invoice.amount,
                invoice.asset,
                invoice.status,
            ),
        );

        id
    }

    /// Get an invoice by ID
    pub fn get(env: &Env, id: BytesN<32>) -> Invoice {
        let key = (storage::INVOICE, id);
        env.storage()
            .instance()
            .get(&key)
            .unwrap_or(Err(ContractError::NotFound))
    }

    /// Mark an invoice as paid
    pub fn pay(env: &Env, id: BytesN<32>, payment_tx: BytesN<32>) {
        let mut invoice = Self::get(env, id.clone());

        // Check authorization
        invoice.account.require_auth();

        // Validate status
        if invoice.status != InvoiceStatus::Open {
            panic!("Invalid status");
        }

        // Check if expired
        if let Some(due_date) = invoice.due_date {
            if env.ledger().timestamp() > due_date {
                invoice.status = InvoiceStatus::Expired;
                env.storage().instance().set(&(storage::INVOICE, id), &invoice);
                env.events().publish(events::invoice_expired(env), id);
                panic!("Invoice expired");
            }
        }

        // Update invoice
        invoice.status = InvoiceStatus::Paid;
        invoice.paid_at = Some(env.ledger().timestamp());
        invoice.payment_tx = Some(payment_tx);
        invoice.updated_at = env.ledger().timestamp();

        env.storage().instance().set(&(storage::INVOICE, id), &invoice);

        // Extend instance TTL, sized to the invoice's due date when present
        Self::extend_ttl(env, invoice.due_date);

        // Emit event
        env.events().publish(events::invoice_paid(env), (id, invoice.payment_tx));
    }

    /// Cancel an invoice
    pub fn cancel(env: &Env, id: BytesN<32>) {
        let mut invoice = Self::get(env, id.clone());

        // Check authorization
        invoice.account.require_auth();

        // Validate status
        if invoice.status != InvoiceStatus::Open && invoice.status != InvoiceStatus::Draft {
            panic!("Invalid status");
        }

        // Update invoice
        invoice.status = InvoiceStatus::Cancelled;
        invoice.updated_at = env.ledger().timestamp();

        env.storage().instance().set(&(storage::INVOICE, id), &invoice);

        // Extend instance TTL, sized to the invoice's due date when present
        Self::extend_ttl(env, invoice.due_date);

        // Emit event
        env.events().publish(events::invoice_cancelled(env), id);
    }

    /// Get all invoices for an account
    pub fn get_by_account(env: &Env, account: Address) -> Vec<Invoice> {
        // This is a simplified implementation
        // In production, you'd want to use an index for efficient querying
        Vec::new(env)
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::testutils::{Address as _, Ledger};
    use soroban_sdk::Address;

    /// Issue #1129: writes must extend the instance TTL so long-lived invoices
    /// (with a future `due_date`) remain readable after the ledger advances well
    /// past the default (non-extended) instance TTL.
    #[test]
    fn test_invoice_readable_after_ledger_advance_past_default_ttl() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, InvoiceContract);
        let client = InvoiceContractClient::new(&env, &contract_id);

        let account = Address::generate(&env);
        let recipient = Address::generate(&env);
        let asset = Symbol::new(&env, "USDC");

        // Due 90 days out — the TTL bump should be sized to cover it.
        let due_date = env.ledger().timestamp() + 90 * 24 * 60 * 60;

        let id = client.create(
            &account,
            &recipient,
            &1000i128,
            &asset,
            &None,
            &Some(due_date),
            &None,
        );

        // Advance the ledger well past the default 30-day bump (INSTANCE_BUMP_AMOUNT)
        // that would apply without a due-date-aware extension.
        env.ledger().with_mut(|li| {
            li.sequence_number = li.sequence_number.saturating_add(40 * DAY_IN_LEDGERS);
        });

        let invoice = client.get(&id);
        assert_eq!(invoice.id, id);
        assert_eq!(invoice.status, InvoiceStatus::Open);
    }
}
