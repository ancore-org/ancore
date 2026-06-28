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
});
