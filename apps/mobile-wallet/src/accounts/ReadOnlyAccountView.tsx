import type { ReadOnlyAccount } from './read-only-account';

interface Props {
  account: ReadOnlyAccount;
  accountContractId: string;
}

export const ReadOnlyAccountView = ({ account, accountContractId }: Props) => {
  return (
    <section aria-label="Read-only account">
      <h2>Account</h2>
      <dl>
        <div>
          <dt>Status</dt>
          <dd>{account.status === 'ready' ? 'Ready' : 'Configure an account address'}</dd>
        </div>
        <div>
          <dt>Address</dt>
          <dd>{account.address.value}</dd>
        </div>
        <div>
          <dt>Network</dt>
          <dd>{account.network.network}</dd>
        </div>
        <div>
          <dt>Account contract</dt>
          <dd>{accountContractId}</dd>
        </div>
      </dl>
    </section>
  );
};
