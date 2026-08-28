import React from 'react';
import { useNavigate } from 'react-router-dom';
import { EmptyState, Button } from '@ancore/ui-kit';
import { Send } from 'lucide-react';

export const OnboardingHints: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="grid gap-4 md:grid-cols-2 mt-4">
      <EmptyState
        icon={<Send className="h-6 w-6" />}
        title="Make Your First Transaction"
        description="Send XLM to another Stellar address to activate your account."
        action={
          <Button size="sm" variant="outline" onClick={() => navigate('/dashboard/send')}>
            Send XLM
          </Button>
        }
      />
    </div>
  );
};

export default OnboardingHints;
