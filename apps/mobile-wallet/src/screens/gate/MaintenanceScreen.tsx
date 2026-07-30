type Props = {
  message?: string;
};

export const MaintenanceScreen = ({ message }: Props) => (
  <section role="alert">
    <h1>Down for maintenance</h1>
    <p>{message || 'The wallet is temporarily unavailable. Please try again shortly.'}</p>
    <p>Your funds are safe — maintenance only affects app connectivity.</p>
  </section>
);
