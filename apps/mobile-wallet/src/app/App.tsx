import { ReadOnlyAccountView } from '../accounts';
import { MobileWalletShell } from '../navigation';
import { bootstrapMobileWallet } from './bootstrap';

interface Props {
  env: Record<string, string | undefined>;
}

export const MobileWalletApp = ({ env }: Props) => {
  const bootstrap = bootstrapMobileWallet(env);

  return (
    <MobileWalletShell appName={bootstrap.environment.appName} activeRoute="account">
      <ReadOnlyAccountView
        account={bootstrap.account}
        accountContractId={bootstrap.sdk.accountContractId}
      />
    </MobileWalletShell>
  );
};
