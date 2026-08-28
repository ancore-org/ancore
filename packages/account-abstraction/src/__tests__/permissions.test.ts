import { SessionPermission } from '@ancore/types';

import {
  PERM_BITS,
  PERMISSION_EXECUTE,
  bitmaskToContractVec,
  bitmaskToPermissions,
  contractVecToPermissions,
  permissionsToBitmask,
  permissionsToContractVec,
} from '../permissions';

/** Contract-aligned permission vectors used for round-trip tests. */
export const CONTRACT_PERMISSION_VECTORS = [
  {
    name: 'empty',
    permissions: [] as SessionPermission[],
    bitmask: 0,
    contractVec: [] as number[],
  },
  {
    name: 'send payment only',
    permissions: [SessionPermission.SEND_PAYMENT],
    bitmask: PERM_BITS[SessionPermission.SEND_PAYMENT],
    contractVec: [0],
  },
  {
    name: 'manage data only',
    permissions: [SessionPermission.MANAGE_DATA],
    bitmask: PERM_BITS[SessionPermission.MANAGE_DATA],
    contractVec: [1],
  },
  {
    name: 'invoke contract only',
    permissions: [SessionPermission.INVOKE_CONTRACT],
    bitmask: PERM_BITS[SessionPermission.INVOKE_CONTRACT],
    contractVec: [2],
  },
  {
    name: 'send payment and invoke contract',
    permissions: [SessionPermission.SEND_PAYMENT, SessionPermission.INVOKE_CONTRACT],
    bitmask:
      PERM_BITS[SessionPermission.SEND_PAYMENT] | PERM_BITS[SessionPermission.INVOKE_CONTRACT],
    contractVec: [0, 2],
  },
  {
    name: 'all permissions',
    permissions: [
      SessionPermission.SEND_PAYMENT,
      SessionPermission.MANAGE_DATA,
      SessionPermission.INVOKE_CONTRACT,
    ],
    bitmask:
      PERM_BITS[SessionPermission.SEND_PAYMENT] |
      PERM_BITS[SessionPermission.MANAGE_DATA] |
      PERM_BITS[SessionPermission.INVOKE_CONTRACT],
    contractVec: [0, 1, 2],
  },
] as const;

describe('permissions', () => {
  describe('permissionsToBitmask', () => {
    it.each(CONTRACT_PERMISSION_VECTORS)(
      'encodes $name permissions',
      ({ permissions, bitmask }) => {
        expect(permissionsToBitmask([...permissions])).toBe(bitmask);
      }
    );
  });

  describe('bitmaskToPermissions', () => {
    it.each(CONTRACT_PERMISSION_VECTORS)(
      'decodes $name permissions',
      ({ permissions, bitmask }) => {
        expect(bitmaskToPermissions(bitmask)).toEqual([...permissions]);
      }
    );
  });

  describe('contract round-trip', () => {
    it.each(CONTRACT_PERMISSION_VECTORS)(
      'maps $name to contract Vec<u32>',
      ({ permissions, contractVec }) => {
        expect(permissionsToContractVec([...permissions])).toEqual(contractVec);
      }
    );

    it.each(CONTRACT_PERMISSION_VECTORS)(
      'maps $name bitmask to contract Vec<u32>',
      ({ bitmask, contractVec }) => {
        expect(bitmaskToContractVec(bitmask)).toEqual(contractVec);
      }
    );

    it.each(CONTRACT_PERMISSION_VECTORS)(
      'round-trips $name contract Vec<u32> through bitmask helpers',
      ({ permissions, bitmask, contractVec }) => {
        expect(contractVecToPermissions(contractVec)).toEqual([...permissions]);
        expect(permissionsToBitmask(contractVecToPermissions(contractVec))).toBe(bitmask);
      }
    );
  });

  it('documents PERMISSION_EXECUTE for session-key execute authorization', () => {
    expect(PERMISSION_EXECUTE).toBe(1);
  });

  describe('edge cases', () => {
    describe('permissionsToBitmask', () => {
      it('returns 0 for empty array', () => {
        expect(permissionsToBitmask([])).toBe(0);
      });

      it('deduplicates repeated permissions', () => {
        const duped = [
          SessionPermission.SEND_PAYMENT,
          SessionPermission.SEND_PAYMENT,
          SessionPermission.MANAGE_DATA,
          SessionPermission.MANAGE_DATA,
        ];
        const single = [SessionPermission.SEND_PAYMENT, SessionPermission.MANAGE_DATA];
        expect(permissionsToBitmask(duped)).toBe(permissionsToBitmask(single));
      });
    });

    describe('bitmaskToPermissions', () => {
      it('returns empty array for bitmask 0', () => {
        expect(bitmaskToPermissions(0)).toEqual([]);
      });

      it('ignores unknown high bits', () => {
        const known = bitmaskToPermissions(0b111);
        const withExtra = bitmaskToPermissions(0b1111_0000_0000 | 0b111);
        expect(withExtra).toEqual(known);
      });

      it('returns empty for bitmask with only unknown bits', () => {
        expect(bitmaskToPermissions(0b1111_0000_0000)).toEqual([]);
      });
    });

    describe('permissionsToContractVec', () => {
      it('returns empty array for empty input', () => {
        expect(permissionsToContractVec([])).toEqual([]);
      });

      it('deduplicates repeated permissions', () => {
        const duped = [
          SessionPermission.INVOKE_CONTRACT,
          SessionPermission.INVOKE_CONTRACT,
          SessionPermission.SEND_PAYMENT,
        ];
        expect(permissionsToContractVec(duped)).toEqual([0, 2]);
      });

      it('sorts values ascending regardless of input order', () => {
        const unsorted = [
          SessionPermission.INVOKE_CONTRACT,
          SessionPermission.SEND_PAYMENT,
          SessionPermission.MANAGE_DATA,
        ];
        expect(permissionsToContractVec(unsorted)).toEqual([0, 1, 2]);
      });
    });

    describe('contractVecToPermissions', () => {
      it('returns empty array for empty input', () => {
        expect(contractVecToPermissions([])).toEqual([]);
      });

      it('drops unknown out-of-range values', () => {
        expect(contractVecToPermissions([0, 2, 99, 255])).toEqual([
          SessionPermission.SEND_PAYMENT,
          SessionPermission.INVOKE_CONTRACT,
        ]);
      });

      it('returns empty when all values are unknown', () => {
        expect(contractVecToPermissions([99, 100, 255])).toEqual([]);
      });

      it('preserves duplicates (no dedup)', () => {
        expect(contractVecToPermissions([0, 0, 1])).toEqual([
          SessionPermission.SEND_PAYMENT,
          SessionPermission.SEND_PAYMENT,
          SessionPermission.MANAGE_DATA,
        ]);
      });
    });

    describe('round-trip stability', () => {
      it('permissions → bitmask → permissions is stable', () => {
        const original = [SessionPermission.MANAGE_DATA, SessionPermission.INVOKE_CONTRACT];
        const bitmask = permissionsToBitmask(original);
        const recovered = bitmaskToPermissions(bitmask);
        expect(recovered).toEqual(original);
      });

      it('permissions → contractVec → permissions is stable', () => {
        const original = [SessionPermission.SEND_PAYMENT, SessionPermission.INVOKE_CONTRACT];
        const vec = permissionsToContractVec(original);
        const recovered = contractVecToPermissions(vec);
        expect(recovered).toEqual(original);
      });

      it('empty round-trips are stable', () => {
        expect(bitmaskToPermissions(permissionsToBitmask([]))).toEqual([]);
        expect(contractVecToPermissions(permissionsToContractVec([]))).toEqual([]);
      });
    });
  });
});
