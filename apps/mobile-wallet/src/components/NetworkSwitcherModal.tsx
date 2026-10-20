import { useState } from 'react';
import type { Network } from '@ancore/types';

type NetworkOption = Extract<Network, 'testnet' | 'futurenet'>;

type Props = {
  isOpen: boolean;
  currentNetwork: NetworkOption;
  onClose: () => void;
  onNetworkChange: (network: NetworkOption) => void | Promise<void>;
};

const NETWORK_OPTIONS: Array<{
  value: NetworkOption;
  label: string;
  description: string;
}> = [
  {
    value: 'testnet',
    label: 'Testnet',
    description: 'Stellar test network for development and testing',
  },
  {
    value: 'futurenet',
    label: 'Futurenet',
    description: 'Experimental network for testing upcoming Stellar features',
  },
];

export const NetworkSwitcherModal = ({
  isOpen,
  currentNetwork,
  onClose,
  onNetworkChange,
}: Props) => {
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkOption>(currentNetwork);
  const [isChanging, setIsChanging] = useState(false);

  if (!isOpen) {
    return null;
  }

  const handleNetworkSelect = (network: NetworkOption) => {
    setSelectedNetwork(network);
  };

  const handleConfirm = async () => {
    if (selectedNetwork === currentNetwork) {
      onClose();
      return;
    }

    setIsChanging(true);
    try {
      await onNetworkChange(selectedNetwork);
      onClose();
    } catch (error) {
      // Error handling should be done by parent component
      console.error('Failed to switch network:', error);
    } finally {
      setIsChanging(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="network-switcher-title"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderTopLeftRadius: '16px',
          borderTopRightRadius: '16px',
          width: '100%',
          maxWidth: '600px',
          padding: '24px',
          boxShadow: '0 -4px 6px -1px rgba(0, 0, 0, 0.1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
          <h2 id="network-switcher-title" style={{ fontSize: '20px', fontWeight: '600' }}>
            Switch Network
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#64748b',
            }}
          >
            ×
          </button>
        </div>

        <div role="radiogroup" aria-labelledby="network-switcher-title">
          {NETWORK_OPTIONS.map((option) => {
            const isSelected = selectedNetwork === option.value;
            const isCurrent = currentNetwork === option.value;

            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => handleNetworkSelect(option.value)}
                style={{
                  width: '100%',
                  padding: '16px',
                  marginBottom: '12px',
                  border: `2px solid ${isSelected ? '#3b82f6' : '#e2e8f0'}`,
                  borderRadius: '8px',
                  backgroundColor: isSelected ? '#eff6ff' : 'white',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '16px', fontWeight: '600' }}>{option.label}</span>
                      {isCurrent && (
                        <span
                          style={{
                            fontSize: '12px',
                            color: '#059669',
                            backgroundColor: '#d1fae5',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontWeight: '500',
                          }}
                        >
                          Current
                        </span>
                      )}
                    </div>
                    <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#64748b' }}>
                      {option.description}
                    </p>
                  </div>
                  <div
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      border: `2px solid ${isSelected ? '#3b82f6' : '#cbd5e1'}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: isSelected ? '#3b82f6' : 'white',
                    }}
                  >
                    {isSelected && (
                      <div
                        style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          backgroundColor: 'white',
                        }}
                      />
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div style={{ marginTop: '24px', display: 'flex', gap: '12px' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={isChanging}
            style={{
              flex: 1,
              padding: '12px',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              backgroundColor: 'white',
              fontSize: '16px',
              fontWeight: '500',
              cursor: isChanging ? 'not-allowed' : 'pointer',
              opacity: isChanging ? 0.5 : 1,
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isChanging || selectedNetwork === currentNetwork}
            style={{
              flex: 1,
              padding: '12px',
              border: 'none',
              borderRadius: '8px',
              backgroundColor: selectedNetwork === currentNetwork ? '#cbd5e1' : '#3b82f6',
              color: 'white',
              fontSize: '16px',
              fontWeight: '500',
              cursor: isChanging || selectedNetwork === currentNetwork ? 'not-allowed' : 'pointer',
              opacity: isChanging ? 0.7 : 1,
            }}
          >
            {isChanging ? 'Switching...' : 'Switch Network'}
          </button>
        </div>

        {selectedNetwork !== currentNetwork && (
          <div
            role="alert"
            style={{
              marginTop: '16px',
              padding: '12px',
              backgroundColor: '#fef3c7',
              borderRadius: '8px',
              fontSize: '14px',
              color: '#92400e',
            }}
          >
            <strong>Warning:</strong> Switching networks will reload your wallet data. Make sure you
            have saved any pending transactions.
          </div>
        )}
      </div>
    </div>
  );
};
