import { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
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
    <Modal
      visible={isOpen}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title} accessibilityRole="header">
              Switch Network
            </Text>
            <TouchableOpacity
              onPress={onClose}
              accessibilityLabel="Close"
              accessibilityRole="button"
              style={styles.closeButton}
            >
              <Text style={styles.closeButtonText}>×</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content}>
            <View accessibilityRole="radiogroup">
              {NETWORK_OPTIONS.map((option) => {
                const isSelected = selectedNetwork === option.value;
                const isCurrent = currentNetwork === option.value;

                return (
                  <TouchableOpacity
                    key={option.value}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: isSelected }}
                    onPress={() => handleNetworkSelect(option.value)}
                    style={[
                      styles.networkOption,
                      isSelected && styles.networkOptionSelected,
                    ]}
                  >
                    <View style={styles.networkOptionContent}>
                      <View style={{ flex: 1 }}>
                        <View style={styles.networkLabelContainer}>
                          <Text style={styles.networkLabel}>{option.label}</Text>
                          {isCurrent && (
                            <View style={styles.currentBadge}>
                              <Text style={styles.currentBadgeText}>Current</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.networkDescription}>
                          {option.description}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.radioButton,
                          isSelected && styles.radioButtonSelected,
                        ]}
                      >
                        {isSelected && <View style={styles.radioButtonInner} />}
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {selectedNetwork !== currentNetwork && (
              <View
                style={styles.warningContainer}
                accessibilityRole="alert"
              >
                <Text style={styles.warningText}>
                  <Text style={{ fontWeight: '600' }}>Warning:</Text> Switching networks
                  will reload your wallet data. Make sure you have saved any pending
                  transactions.
                </Text>
              </View>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              onPress={onClose}
              disabled={isChanging}
              accessibilityRole="button"
              style={[
                styles.button,
                styles.cancelButton,
                isChanging && styles.buttonDisabled,
              ]}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleConfirm}
              disabled={isChanging || selectedNetwork === currentNetwork}
              accessibilityRole="button"
              style={[
                styles.button,
                styles.confirmButton,
                (isChanging || selectedNetwork === currentNetwork) &&
                  styles.confirmButtonDisabled,
              ]}
            >
              {isChanging ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text style={styles.confirmButtonText}>Switch Network</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  container: {
    backgroundColor: 'white',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1e293b',
  },
  closeButton: {
    padding: 4,
  },
  closeButtonText: {
    fontSize: 32,
    color: '#64748b',
    lineHeight: 32,
  },
  content: {
    padding: 24,
  },
  networkOption: {
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    backgroundColor: 'white',
  },
  networkOptionSelected: {
    borderColor: '#3b82f6',
    backgroundColor: '#eff6ff',
  },
  networkOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  networkLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  networkLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  currentBadge: {
    backgroundColor: '#d1fae5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  currentBadgeText: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '500',
  },
  networkDescription: {
    fontSize: 14,
    color: '#64748b',
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioButtonSelected: {
    borderColor: '#3b82f6',
    backgroundColor: '#3b82f6',
  },
  radioButtonInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'white',
  },
  warningContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#fef3c7',
    borderRadius: 8,
  },
  warningText: {
    fontSize: 14,
    color: '#92400e',
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  button: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  cancelButton: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1e293b',
  },
  confirmButton: {
    backgroundColor: '#3b82f6',
  },
  confirmButtonDisabled: {
    backgroundColor: '#cbd5e1',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: 'white',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
