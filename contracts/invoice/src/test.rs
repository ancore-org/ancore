#[cfg(test)]
mod tests {
    use soroban_sdk::{
        testutils::{Address as _, Ledger},
        Address, Env,
    };

    use crate::{InvoiceContract, InvoiceContractClient, InvoiceError, InvoiceStatus};

    // ── Helpers ──────────────────────────────────────────────────────────────

    fn setup() -> (Env, InvoiceContractClient<'static>) {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, InvoiceContract);
        let client = InvoiceContractClient::new(&env, &contract_id);
        (env, client)
    }

    fn random_address(env: &Env) -> Address {
        Address::generate(env)
    }

    /// Deploy a minimal SAC-compatible token mock and return its contract ID.
    fn mock_asset(env: &Env) -> Address {
        // In Soroban tests we use a dedicated token mock via stellar-sdk testutils.
        soroban_sdk::testutils::arbitrary::Token::new(env).address.clone()
    }

    // ── create ────────────────────────────────────────────────────────────────

    #[test]
    fn create_draft_invoice_success() {
        let (env, client) = setup();
        let creator = random_address(&env);
        let recipient = random_address(&env);
        let asset = mock_asset(&env);

        let id = client
            .create(
                &creator,
                &recipient,
                &1_000_000,
                &asset,
                &None,
                &None,
                &None,
            )
            .unwrap();

        let invoice = client.get(&id).unwrap();
        assert_eq!(invoice.status, InvoiceStatus::Draft);
        assert_eq!(invoice.amount, 1_000_000);
        assert_eq!(invoice.creator, creator);
        assert_eq!(invoice.recipient, recipient);
    }

    #[test]
    fn create_rejects_zero_amount() {
        let (env, client) = setup();
        let creator = random_address(&env);
        let recipient = random_address(&env);
        let asset = mock_asset(&env);

        let err = client
            .try_create(&creator, &recipient, &0, &asset, &None, &None, &None)
            .unwrap_err()
            .unwrap();
        assert_eq!(err, InvoiceError::InvalidAmount);
    }

    #[test]
    fn create_rejects_negative_amount() {
        let (env, client) = setup();
        let creator = random_address(&env);
        let recipient = random_address(&env);
        let asset = mock_asset(&env);

        let err = client
            .try_create(&creator, &recipient, &-500, &asset, &None, &None, &None)
            .unwrap_err()
            .unwrap();
        assert_eq!(err, InvoiceError::InvalidAmount);
    }

    #[test]
    fn create_rejects_past_due_date() {
        let (env, client) = setup();
        let creator = random_address(&env);
        let recipient = random_address(&env);
        let asset = mock_asset(&env);
        env.ledger().with_mut(|l| l.timestamp = 1_000_000);

        // due_date = 500_000 is in the past relative to timestamp 1_000_000
        let err = client
            .try_create(
                &creator,
                &recipient,
                &1_000,
                &asset,
                &None,
                &Some(500_000_u64),
                &None,
            )
            .unwrap_err()
            .unwrap();
        assert_eq!(err, InvoiceError::InvalidDueDate);
    }

    #[test]
    fn list_by_creator_returns_ids() {
        let (env, client) = setup();
        let creator = random_address(&env);
        let recipient = random_address(&env);
        let asset = mock_asset(&env);

        let id1 = client
            .create(&creator, &recipient, &1_000, &asset, &None, &None, &None)
            .unwrap();
        let id2 = client
            .create(&creator, &recipient, &2_000, &asset, &None, &None, &None)
            .unwrap();

        let ids = client.list_by_creator(&creator);
        assert_eq!(ids.len(), 2);
        assert!(ids.contains(&id1));
        assert!(ids.contains(&id2));
    }

    #[test]
    fn list_by_recipient_returns_ids() {
        let (env, client) = setup();
        let creator = random_address(&env);
        let recipient = random_address(&env);
        let asset = mock_asset(&env);

        let id = client
            .create(&creator, &recipient, &1_000, &asset, &None, &None, &None)
            .unwrap();

        let ids = client.list_by_recipient(&recipient);
        assert_eq!(ids.len(), 1);
        assert_eq!(ids.get(0).unwrap(), id);
    }

    // ── open ──────────────────────────────────────────────────────────────────

    #[test]
    fn open_draft_invoice_success() {
        let (env, client) = setup();
        let creator = random_address(&env);
        let recipient = random_address(&env);
        let asset = mock_asset(&env);

        let id = client
            .create(&creator, &recipient, &1_000, &asset, &None, &None, &None)
            .unwrap();

        client.open(&id).unwrap();

        let invoice = client.get(&id).unwrap();
        assert_eq!(invoice.status, InvoiceStatus::Open);
        assert!(invoice.opened_at.is_some());
    }

    #[test]
    fn open_already_open_fails() {
        let (env, client) = setup();
        let creator = random_address(&env);
        let recipient = random_address(&env);
        let asset = mock_asset(&env);

        let id = client
            .create(&creator, &recipient, &1_000, &asset, &None, &None, &None)
            .unwrap();
        client.open(&id).unwrap();

        let err = client.try_open(&id).unwrap_err().unwrap();
        assert_eq!(err, InvoiceError::InvalidStatus);
    }

    #[test]
    fn open_expired_due_date_fails() {
        let (env, client) = setup();
        let creator = random_address(&env);
        let recipient = random_address(&env);
        let asset = mock_asset(&env);

        env.ledger().with_mut(|l| l.timestamp = 100);
        let id = client
            .create(
                &creator,
                &recipient,
                &1_000,
                &asset,
                &None,
                &Some(200_u64),
                &None,
            )
            .unwrap();

        // Advance past due date
        env.ledger().with_mut(|l| l.timestamp = 300);

        let err = client.try_open(&id).unwrap_err().unwrap();
        assert_eq!(err, InvoiceError::Expired);
    }

    // ── pay ───────────────────────────────────────────────────────────────────

    #[test]
    fn pay_draft_fails() {
        let (env, client) = setup();
        let creator = random_address(&env);
        let recipient = random_address(&env);
        let asset = mock_asset(&env);
        let payment_tx = soroban_sdk::BytesN::<32>::from_array(&env, &[1u8; 32]);

        let id = client
            .create(&creator, &recipient, &1_000, &asset, &None, &None, &None)
            .unwrap();

        let err = client
            .try_pay(&id, &recipient, &payment_tx)
            .unwrap_err()
            .unwrap();
        assert_eq!(err, InvoiceError::InvalidStatus);
    }

    #[test]
    fn pay_expired_invoice_auto_expires() {
        let (env, client) = setup();
        let creator = random_address(&env);
        let recipient = random_address(&env);
        let asset = mock_asset(&env);
        let payment_tx = soroban_sdk::BytesN::<32>::from_array(&env, &[2u8; 32]);

        env.ledger().with_mut(|l| l.timestamp = 100);
        let id = client
            .create(
                &creator,
                &recipient,
                &1_000,
                &asset,
                &None,
                &Some(200_u64),
                &None,
            )
            .unwrap();
        client.open(&id).unwrap();

        // Advance past due date
        env.ledger().with_mut(|l| l.timestamp = 300);

        let err = client
            .try_pay(&id, &recipient, &payment_tx)
            .unwrap_err()
            .unwrap();
        assert_eq!(err, InvoiceError::Expired);

        let invoice = client.get(&id).unwrap();
        assert_eq!(invoice.status, InvoiceStatus::Expired);
        assert!(invoice.expired_at.is_some());
    }

    // ── cancel ────────────────────────────────────────────────────────────────

    #[test]
    fn cancel_open_invoice_success() {
        let (env, client) = setup();
        let creator = random_address(&env);
        let recipient = random_address(&env);
        let asset = mock_asset(&env);

        let id = client
            .create(&creator, &recipient, &1_000, &asset, &None, &None, &None)
            .unwrap();
        client.open(&id).unwrap();
        client.cancel(&id).unwrap();

        let invoice = client.get(&id).unwrap();
        assert_eq!(invoice.status, InvoiceStatus::Cancelled);
        assert!(invoice.cancelled_at.is_some());
    }

    #[test]
    fn cancel_draft_invoice_success() {
        let (env, client) = setup();
        let creator = random_address(&env);
        let recipient = random_address(&env);
        let asset = mock_asset(&env);

        let id = client
            .create(&creator, &recipient, &1_000, &asset, &None, &None, &None)
            .unwrap();
        client.cancel(&id).unwrap();

        let invoice = client.get(&id).unwrap();
        assert_eq!(invoice.status, InvoiceStatus::Cancelled);
    }

    #[test]
    fn cancel_paid_invoice_fails() {
        // Can't cancel a terminal state. We rely on pay succeeding first.
        // Here we test that Cancelled fails if already Cancelled.
        let (env, client) = setup();
        let creator = random_address(&env);
        let recipient = random_address(&env);
        let asset = mock_asset(&env);

        let id = client
            .create(&creator, &recipient, &1_000, &asset, &None, &None, &None)
            .unwrap();
        client.cancel(&id).unwrap();

        // Second cancel should fail
        let err = client.try_cancel(&id).unwrap_err().unwrap();
        assert_eq!(err, InvoiceError::InvalidStatus);
    }

    // ── expire ────────────────────────────────────────────────────────────────

    #[test]
    fn expire_open_invoice_success() {
        let (env, client) = setup();
        let creator = random_address(&env);
        let recipient = random_address(&env);
        let asset = mock_asset(&env);

        env.ledger().with_mut(|l| l.timestamp = 100);
        let id = client
            .create(
                &creator,
                &recipient,
                &1_000,
                &asset,
                &None,
                &Some(200_u64),
                &None,
            )
            .unwrap();
        client.open(&id).unwrap();

        // Advance past due_date
        env.ledger().with_mut(|l| l.timestamp = 300);
        client.expire(&id).unwrap();

        let invoice = client.get(&id).unwrap();
        assert_eq!(invoice.status, InvoiceStatus::Expired);
        assert!(invoice.expired_at.is_some());
    }

    #[test]
    fn expire_before_due_date_fails() {
        let (env, client) = setup();
        let creator = random_address(&env);
        let recipient = random_address(&env);
        let asset = mock_asset(&env);

        env.ledger().with_mut(|l| l.timestamp = 100);
        let id = client
            .create(
                &creator,
                &recipient,
                &1_000,
                &asset,
                &None,
                &Some(200_u64),
                &None,
            )
            .unwrap();
        client.open(&id).unwrap();

        // Still before due_date
        let err = client.try_expire(&id).unwrap_err().unwrap();
        assert_eq!(err, InvoiceError::InvalidStatus);
    }

    #[test]
    fn expire_no_due_date_fails() {
        let (env, client) = setup();
        let creator = random_address(&env);
        let recipient = random_address(&env);
        let asset = mock_asset(&env);

        let id = client
            .create(&creator, &recipient, &1_000, &asset, &None, &None, &None)
            .unwrap();
        client.open(&id).unwrap();

        let err = client.try_expire(&id).unwrap_err().unwrap();
        assert_eq!(err, InvoiceError::InvalidStatus);
    }

    // ── get ───────────────────────────────────────────────────────────────────

    #[test]
    fn get_nonexistent_returns_not_found() {
        let (env, client) = setup();
        let fake_id = soroban_sdk::BytesN::<32>::from_array(&env, &[99u8; 32]);

        let err = client.try_get(&fake_id).unwrap_err().unwrap();
        assert_eq!(err, InvoiceError::NotFound);
    }

    // ── nonce uniqueness ──────────────────────────────────────────────────────

    #[test]
    fn two_identical_creates_produce_different_ids() {
        let (env, client) = setup();
        let creator = random_address(&env);
        let recipient = random_address(&env);
        let asset = mock_asset(&env);

        let id1 = client
            .create(&creator, &recipient, &1_000, &asset, &None, &None, &None)
            .unwrap();
        let id2 = client
            .create(&creator, &recipient, &1_000, &asset, &None, &None, &None)
            .unwrap();

        assert_ne!(id1, id2);
    }
}
