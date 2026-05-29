import { StatementExportModal } from './StatementExportModal';
import { StatementExportService } from './statement-export';

class MockStatementExportService extends StatementExportService {
  async fetchRows() {
    return {
      rows: [
        {
          id: 'row-1',
          timestamp: '2026-04-24T10:00:00.000Z',
          counterparty: 'Acme Treasury',
          amount: '142.50',
          asset: 'USDC',
          status: 'completed' as const,
          memoOrReference: 'Invoice 1042',
        },
      ],
    };
  }
}

const meta = {
  title: 'Statements/StatementExportModal',
  component: StatementExportModal,
  args: {
    accountId: 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890',
    isOpen: true,
    onClose: () => undefined,
    service: new MockStatementExportService(),
    pdfEnabled: true,
  },
};

export default meta;

export const Default = {};

export const PdfDisabled = {
  args: {
    pdfEnabled: false,
  },
};
