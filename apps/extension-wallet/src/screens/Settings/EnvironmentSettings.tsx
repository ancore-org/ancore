import { FlaskConical, Server } from 'lucide-react';
import { SettingsGroup, SettingItem } from '../../components/SettingsGroup';
import { ScreenHeader } from './NetworkSettings';
import type { DashboardEnvironment } from '../../state/dashboard-settings';

interface EnvironmentSettingsProps {
  value: DashboardEnvironment;
  onChange: (environment: DashboardEnvironment) => void;
  onBack: () => void;
}

export function EnvironmentSettings({ value, onChange, onBack }: EnvironmentSettingsProps) {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <ScreenHeader title="Environment" onBack={onBack} />
      <div className="p-4">
        <SettingsGroup title="Runtime target">
          <SettingItem
            label="Production"
            description="Stable environment for daily usage"
            icon={<Server className="h-4 w-4" />}
            value={value === 'production' ? 'Selected' : undefined}
            onClick={() => onChange('production')}
          />
          <SettingItem
            label="Staging"
            description="Pre-release environment for testing"
            icon={<FlaskConical className="h-4 w-4" />}
            value={value === 'staging' ? 'Selected' : undefined}
            onClick={() => onChange('staging')}
          />
        </SettingsGroup>
      </div>
    </div>
  );
}
