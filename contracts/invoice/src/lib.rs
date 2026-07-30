#![no_std]

//! # Ancore Invoice Contract
//!
//! Production Soroban invoice lifecycle: create → open → pay / cancel / expire.
//! Every transition emits an indexable event with a stable payload schema
//! compatible with the #974 event-indexer decoder patterns.

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, token, Address, BytesN,
    Env, String, Symbol, Vec,
};

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum InvoiceError {
    AlreadyExists = 1,
    NotFound = 2,
    Unauthorized = 3,
    InvalidStatus = 4,
    AlreadyPaid = 5,
    Expired = 6,
    InvalidAmount = 7,
    InvalidDueDate = 8,
    AssetMismatch = 9,
    AmountMismatch = 10,
}

// ---------------------------------------------------------------------------
// Data types
// ---------------------------------------------------------------------------

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

#[contracttype]
#[derive(Clone)]
pub struct Invoice {
    /// Content-addressed ID: sha256(creator || recipient || amount || asset || nonce || timestamp)
    pub id: BytesN<32>,
    /// The account that created and owns this invoice.
    pub creator: Address,
    /// The party expected to pay.
    pub recipient: Address,
    /// Amount in asset's smallest unit (stroops for XLM).
    pub amount: i128,
    /// SAC (Stellar Asset Contract) address for the payment asset.
    pub asset: Address,
    pub status: InvoiceStatus,
    pub description: Option<String>,
    /// Optional Unix timestamp deadline (ledger timestamp).
    pub due_date: Option<u64>,
    /// Optional external reference string (e.g. "INV-2025-001").
    pub reference: Option<String>,
    pub created_at: u64,
    pub updated_at: u64,
    pub opened_at: Option<u64>,
    pub paid_at: Option<u64>,
    /// The Stellar transaction hash that completed payment.
    pub payment_tx: Option<BytesN<32>>,
    pub cancelled_at: Option<u64>,
    pub expired_at: Option<u64>,
    /// Nonce for unique ID derivation when multiple invoices share same params.
    pub nonce: u64,
}

// ---------------------------------------------------------------------------
// Storage keys
// ---------------------------------------------------------------------------

const KEY_COUNTER: Symbol = symbol_short!("CNT");
const KEY_INV: Symbol = symbol_short!("INV");
const KEY_CREATOR_IDX: Symbol = symbol_short!("CRIDX");
const KEY_RECIPIENT_IDX: Symbol = symbol_short!("RCIDX");

// ---------------------------------------------------------------------------
// TTL constants
// ---------------------------------------------------------------------------

const DAY_IN_LEDGERS: u32 = 17280; // 24 h × 60 min × 60 sec / 5 sec per ledger
const INSTANCE_BUMP_AMOUNT: u32 = 30 * DAY_IN_LEDGERS; // 30 days
const INSTANCE_BUMP_THRESHOLD: u32 = 15 * DAY_IN_LEDGERS; // 15 days

// ---------------------------------------------------------------------------
// Events (stable schema for #974 indexer)
// ---------------------------------------------------------------------------

mod events {
    use soroban_sdk::{symbol_short, Address, BytesN, Env, Symbol};

    pub fn invoice_created(env: &Env, id: BytesN<32>, creator: Address, recipient: Address, amount: i128, asset: Address, due_date: u64) {
        env.events().publish(
            (symbol_short!("inv"), symbol_short!("created")),
            (id, creator, recipient, amount, asset, due_date),
        );
    }

    pub fn invoice_opened(env: &Env, id: BytesN<32>, creator: Address) {
        env.events().publish(
            (symbol_short!("inv"), symbol_short!("opened")),
            (id, creator),
        );
    }

    pub fn invoice_paid(env: &Env, id: BytesN<32>, payer: Address, amount: i128, asset: Address, tx: BytesN<32>) {
        env.events().publish(
            (symbol_short!("inv"), symbol_short!("paid")),
            (id, payer, amount, asset, tx),
        );
    }

    pub fn invoice_cancelled(env: &Env, id: BytesN<32>, cancelled_by: Address) {
        env.events().publish(
            (symbol_short!("inv"), symbol_short!("cancelled")),
            (id, cancelled_by),
        );
    }

    pub fn invoice_expired(env: &Env, id: BytesN<32>, creator: Address) {
        env.events().publish(
            (symbol_short!("inv"), symbol_short!("expired")),
            (id, creator),
        );
    }
}

// ---------------------------------------------------------------------------
// Index helpers
// ---------------------------------------------------------------------------

fn creator_index_key(creator: &Address) -> (Symbol, Address) {
    (KEY_CREATOR_IDX, creator.clone())
}

fn recipient_index_key(recipient: &Address) -> (Symbol, Address) {
    (KEY_RECIPIENT_IDX, recipient.clone())
}

fn push_to_index(env: &Env, key: (Symbol, Address), id: BytesN<32>) {
    let mut ids: Vec<BytesN<32>> = env
        .storage()
        .instance()
        .get(&key)
        .unwrap_or_else(|| Vec::new(env));
    ids.push_back(id);
    env.storage().instance().set(&key, &ids);
}

// ---------------------------------------------------------------------------
// TTL helper
// ---------------------------------------------------------------------------

/// Extends the contract instance TTL after every write.
///
/// When a `due_date` is provided and lies in the future, the bump is sized to
/// keep the entry alive until after that date (plus the default 30-day buffer),
/// so long-lived invoices don't silently expire from ledger state before they
/// are due. Falls back to the standard 30-day bump otherwise.
fn extend_ttl(env: &Env, due_date: Option<u64>) {
    let (threshold, amount) = match due_date {
        Some(due) => {
            let current = env.ledger().timestamp();
            if due > current {
                let diff_secs = due.saturating_sub(current);
                let diff_ledgers: u32 = (diff_secs / 5).try_into().unwrap_or(u32::MAX);
                let ledgers_to_live = diff_ledgers.saturating_add(INSTANCE_BUMP_AMOUNT);
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

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

#[contract]
pub struct InvoiceContract;

#[contractimpl]
impl InvoiceContract {
    // ── Create (Draft) ───────────────────────────────────────────────────────

    /// Creates a new invoice in Draft status. The creator must call `open` to
    /// make it payable. Returns the invoice ID.
    pub fn create(
        env: Env,
        creator: Address,
        recipient: Address,
        amount: i128,
        asset: Address,
        description: Option<String>,
        due_date: Option<u64>,
        reference: Option<String>,
    ) -> Result<BytesN<32>, InvoiceError> {
        creator.require_auth();

        if amount <= 0 {
            return Err(InvoiceError::InvalidAmount);
        }

        if let Some(due) = due_date {
            if due <= env.ledger().timestamp() {
                return Err(InvoiceError::InvalidDueDate);
            }
        }

        let nonce: u64 = env.storage().instance().get(&KEY_COUNTER).unwrap_or(0) + 1;
        env.storage().instance().set(&KEY_COUNTER, &nonce);

        // Content-addressed ID
        let id = env.crypto().sha256(
            &(
                creator.clone(),
                recipient.clone(),
                amount,
                asset.clone(),
                nonce,
                env.ledger().timestamp(),
            )
            .into_val(&env),
        );

        let now = env.ledger().timestamp();
        let invoice = Invoice {
            id: id.clone(),
            creator: creator.clone(),
            recipient: recipient.clone(),
            amount,
            asset: asset.clone(),
            status: InvoiceStatus::Draft,
            description,
            due_date,
            reference,
            created_at: now,
            updated_at: now,
            opened_at: None,
            paid_at: None,
            payment_tx: None,
            cancelled_at: None,
            expired_at: None,
            nonce,
        };

        env.storage()
            .instance()
            .set(&(KEY_INV, id.clone()), &invoice);

        push_to_index(&env, creator_index_key(&creator), id.clone());
        push_to_index(&env, recipient_index_key(&recipient), id.clone());

        extend_ttl(&env, due_date);

        events::invoice_created(
            &env,
            id.clone(),
            creator,
            recipient,
            amount,
            asset,
            due_date.unwrap_or(0),
        );

        Ok(id)
    }

    // ── Open ─────────────────────────────────────────────────────────────────

    /// Transitions a Draft invoice to Open, making it payable by the recipient.
    pub fn open(env: Env, id: BytesN<32>) -> Result<(), InvoiceError> {
        let mut invoice = Self::get_invoice(&env, &id)?;
        invoice.creator.require_auth();

        if invoice.status != InvoiceStatus::Draft {
            return Err(InvoiceError::InvalidStatus);
        }

        let now = env.ledger().timestamp();
        if let Some(due) = invoice.due_date {
            if now >= due {
                return Err(InvoiceError::Expired);
            }
        }

        invoice.status = InvoiceStatus::Open;
        invoice.opened_at = Some(now);
        invoice.updated_at = now;

        env.storage()
            .instance()
            .set(&(KEY_INV, id.clone()), &invoice);

        extend_ttl(&env, invoice.due_date);
        events::invoice_opened(&env, id, invoice.creator);
        Ok(())
    }

    // ── Pay ──────────────────────────────────────────────────────────────────

    /// Pays an open invoice. The payer transfers `amount` of `asset` to the
    /// creator via the SAC token interface, then the invoice is marked Paid.
    pub fn pay(
        env: Env,
        id: BytesN<32>,
        payer: Address,
        payment_tx: BytesN<32>,
    ) -> Result<(), InvoiceError> {
        payer.require_auth();

        let mut invoice = Self::get_invoice(&env, &id)?;

        if invoice.status == InvoiceStatus::Paid {
            return Err(InvoiceError::AlreadyPaid);
        }

        if invoice.status != InvoiceStatus::Open {
            return Err(InvoiceError::InvalidStatus);
        }

        let now = env.ledger().timestamp();

        // Expire the invoice if past due date before accepting payment.
        if let Some(due) = invoice.due_date {
            if now > due {
                invoice.status = InvoiceStatus::Expired;
                invoice.expired_at = Some(now);
                invoice.updated_at = now;
                env.storage()
                    .instance()
                    .set(&(KEY_INV, id.clone()), &invoice);
                extend_ttl(&env, None);
                events::invoice_expired(&env, id, invoice.creator);
                return Err(InvoiceError::Expired);
            }
        }

        // Transfer via SAC token interface.
        let token_client = token::Client::new(&env, &invoice.asset);
        token_client.transfer(&payer, &invoice.creator, &invoice.amount);

        invoice.status = InvoiceStatus::Paid;
        invoice.paid_at = Some(now);
        invoice.payment_tx = Some(payment_tx.clone());
        invoice.updated_at = now;

        env.storage()
            .instance()
            .set(&(KEY_INV, id.clone()), &invoice);

        extend_ttl(&env, None);
        events::invoice_paid(
            &env,
            id,
            payer,
            invoice.amount,
            invoice.asset,
            payment_tx,
        );
        Ok(())
    }

    // ── Cancel ───────────────────────────────────────────────────────────────

    /// Cancels a Draft or Open invoice. Only the creator may cancel.
    pub fn cancel(env: Env, id: BytesN<32>) -> Result<(), InvoiceError> {
        let mut invoice = Self::get_invoice(&env, &id)?;
        invoice.creator.require_auth();

        if invoice.status != InvoiceStatus::Open && invoice.status != InvoiceStatus::Draft {
            return Err(InvoiceError::InvalidStatus);
        }

        let now = env.ledger().timestamp();
        let creator = invoice.creator.clone();
        invoice.status = InvoiceStatus::Cancelled;
        invoice.cancelled_at = Some(now);
        invoice.updated_at = now;

        env.storage()
            .instance()
            .set(&(KEY_INV, id.clone()), &invoice);

        extend_ttl(&env, None);
        events::invoice_cancelled(&env, id, creator);
        Ok(())
    }

    // ── Expire ───────────────────────────────────────────────────────────────

    /// Cron-friendly expiry sweep: expires any Open invoice whose due_date has
    /// passed. Anyone may call this; no auth required.
    pub fn expire(env: Env, id: BytesN<32>) -> Result<(), InvoiceError> {
        let mut invoice = Self::get_invoice(&env, &id)?;

        if invoice.status != InvoiceStatus::Open {
            return Err(InvoiceError::InvalidStatus);
        }

        let now = env.ledger().timestamp();
        let due = invoice.due_date.ok_or(InvoiceError::InvalidStatus)?;

        if now <= due {
            return Err(InvoiceError::InvalidStatus);
        }

        invoice.status = InvoiceStatus::Expired;
        invoice.expired_at = Some(now);
        invoice.updated_at = now;
        let creator = invoice.creator.clone();

        env.storage()
            .instance()
            .set(&(KEY_INV, id.clone()), &invoice);

        extend_ttl(&env, None);
        events::invoice_expired(&env, id, creator);
        Ok(())
    }

    // ── Queries ──────────────────────────────────────────────────────────────

    /// Returns an invoice by ID.
    pub fn get(env: Env, id: BytesN<32>) -> Result<Invoice, InvoiceError> {
        Self::get_invoice(&env, &id)
    }

    /// Returns all invoice IDs created by this account.
    pub fn list_by_creator(env: Env, creator: Address) -> Vec<BytesN<32>> {
        env.storage()
            .instance()
            .get(&creator_index_key(&creator))
            .unwrap_or_else(|| Vec::new(&env))
    }

    /// Returns all invoice IDs where this address is the recipient.
    pub fn list_by_recipient(env: Env, recipient: Address) -> Vec<BytesN<32>> {
        env.storage()
            .instance()
            .get(&recipient_index_key(&recipient))
            .unwrap_or_else(|| Vec::new(&env))
    }

    // ── Internal ─────────────────────────────────────────────────────────────

    fn get_invoice(env: &Env, id: &BytesN<32>) -> Result<Invoice, InvoiceError> {
        env.storage()
            .instance()
            .get(&(KEY_INV, id.clone()))
            .ok_or(InvoiceError::NotFound)
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

        let creator = Address::generate(&env);
        let recipient = Address::generate(&env);
        // Use a dummy token address — create() stores but doesn't transfer in Draft.
        let asset = Address::generate(&env);

        // Due 90 days out — the TTL bump should be sized to cover it.
        let due_date = env.ledger().timestamp() + 90 * 24 * 60 * 60;

        let id = client
            .create(
                &creator,
                &recipient,
                &1000i128,
                &asset,
                &None,
                &Some(due_date),
                &None,
            )
            .unwrap();

        // Advance the ledger well past the default 30-day bump (INSTANCE_BUMP_AMOUNT)
        // that would apply without a due-date-aware extension.
        env.ledger().with_mut(|li| {
            li.sequence_number = li.sequence_number.saturating_add(40 * DAY_IN_LEDGERS);
        });

        let invoice = client.get(&id).unwrap();
        assert_eq!(invoice.id, id);
        // Invoice starts in Draft; it was never opened, so status stays Draft.
        assert_eq!(invoice.status, InvoiceStatus::Draft);
    }
}
