import { Eye, Monitor, Rows2 } from 'lucide-react';
import { SettingsGroup, SettingItem } from '../../components/SettingsGroup';
import { ScreenHeader } from './NetworkSettings';
import type { DisplayPreference } from '../../state/dashboard-settings';

interface DisplaySettingsProps {
  value: DisplayPreference;
  onChange: (preference: DisplayPreference) => void;
  onBack: () => void;
}

export function DisplaySettings({ value, onChange, onBack }: DisplaySettingsProps) {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <ScreenHeader title="Display" onBack={onBack} />
      <div className="flex flex-col gap-4 p-4">
        <SettingsGroup title="Layout density">
          <SettingItem
            label="Comfortable"
            description="Larger spacing and cards"
            icon={<Rows2 className="h-4 w-4" />}
            value={value === 'comfortable' ? 'Selected' : undefined}
            onClick={() => onChange('comfortable')}
          />
          <SettingItem
            label="Compact"
            description="Denser spacing for more content"
            icon={<Monitor className="h-4 w-4" />}
            value={value === 'compact' ? 'Selected' : undefined}
            onClick={() => onChange('compact')}
          />
        </SettingsGroup>
        <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
          <p className="font-medium text-foreground inline-flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Preview
          </p>
          <p className="mt-2">
            {value === 'compact'
              ? 'Compact mode is active across all dashboard pages.'
              : 'Comfortable mode is active across all dashboard pages.'}
          </p>
        </div>
      </div>
    </div>
  );
}
