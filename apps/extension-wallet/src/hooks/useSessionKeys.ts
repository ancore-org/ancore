import { useState, useEffect } from 'react';
import { AccountContract, SessionKey } from '@ancore/account-abstraction';

const accountContract = new AccountContract('your-account-contract-id');

export const useSessionKeys = () => {
  const [sessionKeys, setSessionKeys] = useState<SessionKey[]>([]);

  useEffect(() => {
    const fetchSessionKeys = async () => {
      const key = await accountContract.getSessionKey('your-public-key', {
        server: {
          getAccount: async () => ({ id: 'id', sequence: 'sequence' }),
          simulateTransaction: async () => ({}),
        },
        sourceAccount: 'source-account',
      });
      setSessionKeys(key ? [key] : []);
    };

    fetchSessionKeys();
  }, []);

  const addSessionKey = async (key: {
    publicKey: string;
    permissions: number[];
    expiresAt: number;
  }) => {
    const newKey: SessionKey = {
      publicKey: key.publicKey,
      permissions: key.permissions,
      expiresAt: key.expiresAt,
    };
    setSessionKeys((prevKeys) => [...prevKeys, newKey]);
  };

  const revokeSessionKey = async (publicKey: string) => {
    await accountContract.revokeSessionKey(publicKey);
    setSessionKeys((prevKeys) => prevKeys.filter((key) => key.publicKey !== publicKey));
  };

  return {
    sessionKeys,
    addSessionKey,
    revokeSessionKey,
  };
};
