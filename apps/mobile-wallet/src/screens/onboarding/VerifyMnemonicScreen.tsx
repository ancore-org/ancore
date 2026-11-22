import { useCallback, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

type Props = {
  mnemonic: string;
  onBack?: () => void;
  onCancel?: () => void;
  onComplete?: () => void;
};

const noop = () => {};

function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function pickRandomPositions(count: number, total: number): number[] {
  const indices = Array.from({ length: total }, (_, i) => i);
  return shuffle(indices)
    .slice(0, count)
    .sort((a, b) => a - b);
}

function generateWordBank(mnemonic: string, position: number): string[] {
  const words = mnemonic.split(' ');
  const correctWord = words[position];
  const otherWords = words.filter((_, i) => i !== position);
  const uniqueOthers = [...new Set(otherWords)];
  const distractors = shuffle(uniqueOthers).slice(0, 3);
  return shuffle([correctWord, ...distractors]);
}

export function VerifyMnemonicScreen({
  mnemonic,
  onBack = noop,
  onCancel = noop,
  onComplete = noop,
}: Props) {
  const words = useMemo(() => mnemonic.split(' '), [mnemonic]);

  const positions = useMemo(() => pickRandomPositions(3, 12), []);

  const [currentStep, setCurrentStep] = useState(0);
  const [error, setError] = useState(false);

  const position = positions[currentStep];
  const correctWord = words[position];

  const wordBank = useMemo(() => generateWordBank(mnemonic, position), [mnemonic, position]);

  const handleWordSelect = useCallback(
    (word: string) => {
      if (word === correctWord) {
        if (currentStep === positions.length - 1) {
          onComplete();
        } else {
          setCurrentStep((step) => step + 1);
          setError(false);
        }
      } else {
        setError(true);
      }
    },
    [correctWord, currentStep, positions.length, onComplete]
  );

  return (
    <View accessibilityLabel="Verify recovery phrase" style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.subtitle}>Create</Text>
        <Text accessibilityRole="header" style={styles.title}>
          Verify your recovery phrase
        </Text>
        <Text style={styles.description}>
          Select word #{position + 1} to confirm you wrote it down correctly.
        </Text>
      </View>

      {error ? (
        <Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={styles.error}>
          Incorrect word. Please try again.
        </Text>
      ) : null}

      <View accessibilityLabel="Word options" style={styles.wordGrid}>
        {wordBank.map((word) => (
          <Pressable
            key={word}
            accessibilityRole="button"
            onPress={() => handleWordSelect(word)}
            style={styles.wordButton}
          >
            {({ pressed }) => (
              <Text style={[styles.buttonText, pressed && styles.buttonPressed]}>{word}</Text>
            )}
          </Pressable>
        ))}
      </View>

      <View style={styles.actions}>
        <Pressable accessibilityRole="button" onPress={onBack} style={styles.actionButton}>
          {({ pressed }) => (
            <Text style={[styles.buttonText, pressed && styles.buttonPressed]}>Back</Text>
          )}
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onCancel} style={styles.actionButton}>
          {({ pressed }) => (
            <Text style={[styles.buttonText, pressed && styles.buttonPressed]}>Cancel</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 16,
  },
  header: {
    gap: 8,
  },
  subtitle: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: '#64748b',
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#0f172a',
  },
  description: {
    fontSize: 14,
    color: '#475569',
  },
  error: {
    fontSize: 14,
    color: '#dc2626',
  },
  wordGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  wordButton: {
    width: '48%',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    alignItems: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#334155',
  },
  buttonPressed: {
    opacity: 0.7,
  },
});
