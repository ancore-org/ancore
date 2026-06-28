import { renderHook, act } from '@testing-library/react';
import { useTransferPolicy } from '../useTransferPolicy';
import { useSettingsStore } from '../../stores/settings';

describe('useTransferPolicy', () => {
  beforeEach(() => {
    useSettingsStore.setState({
      dailyTransferLimit: 1000,
      transferStepUpThreshold: 250,
    });
  });

  it('returns current policy limits from settings', () => {
    const { result } = renderHook(() => useTransferPolicy());
    expect(result.current.policy.dailyLimit).toBe(1000);
    expect(result.current.policy.stepUpThreshold).toBe(250);
  });

  it('validates transfer amounts against policy', () => {
    const { result } = renderHook(() => useTransferPolicy());

    const allowResult = result.current.validateTransfer(100, 200);
    expect(allowResult.action).toBe('allow');

    const stepUpResult = result.current.validateTransfer(300, 100);
    expect(stepUpResult.action).toBe('step_up');

    const blockResult = result.current.validateTransfer(500, 600);
    expect(blockResult.action).toBe('block');
  });

  it('updates policy settings', () => {
    const { result } = renderHook(() => useTransferPolicy());

    act(() => {
      result.current.updateSettings({ dailyLimit: 5000, stepUpThreshold: 1000 });
    });

    expect(result.current.policy.dailyLimit).toBe(5000);
    expect(result.current.policy.stepUpThreshold).toBe(1000);
  });

  it('handles partial updates to settings', () => {
    const { result } = renderHook(() => useTransferPolicy());

    act(() => {
      result.current.updateSettings({ dailyLimit: 2000 });
    });

    expect(result.current.policy.dailyLimit).toBe(2000);
    expect(result.current.policy.stepUpThreshold).toBe(250); // unchanged
  });
});
