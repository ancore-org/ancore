type Props = {
  minimumAppVersion: string;
  currentVersion?: string;
  updateUrl?: string;
};

export const ForceUpdateScreen = ({ minimumAppVersion, currentVersion, updateUrl }: Props) => (
  <section role="alert">
    <h1>Update required</h1>
    <p>
      This version of the app is no longer supported. Please update to version {minimumAppVersion}{' '}
      or later to keep using your wallet.
    </p>
    {currentVersion ? <p>Installed version: {currentVersion}</p> : null}
    {updateUrl ? <a href={updateUrl}>Update now</a> : null}
  </section>
);
