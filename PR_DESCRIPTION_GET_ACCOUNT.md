# Secure Storage Get Account Implementation

## Summary
Implements enhanced `SecureStorageManager.getAccount()` functionality with robust error handling, security improvements, and comprehensive test coverage for decrypting and returning encrypted account data.

## Changes Made

### Enhanced `getAccount()` Method
- **File**: `packages/core-sdk/src/storage/secure-storage-manager.ts`
- **Improvements**:
  - Added explicit lock state validation with clear error messaging
  - Enhanced payload structure validation (salt, iv, data fields)
  - Added AccountData structure validation (must contain privateKey)
  - Improved error handling to prevent information leakage
  - All decryption/parsing errors return generic "Invalid password or corrupted data" message

### Comprehensive Test Suite
- **File**: `packages/core-sdk/src/storage/__tests__/get-account.test.ts`
- **Coverage**:
  - **Happy Path**: Successful decryption, null handling, complex data structures
  - **Locked State**: Proper error throwing when locked, unlock/lock cycles
  - **Wrong Password**: Secure error handling without data leakage
  - **Malformed Payload**: Missing fields, invalid base64, invalid JSON, wrong structure
  - **Auto-lock Behavior**: Timer reset functionality
  - **Type Safety**: Proper TypeScript typing

## Security Features

### Error Handling
- All decryption failures return generic error message
- No sensitive data leaked in error messages
- Payload structure validation prevents malformed data processing
- AccountData validation ensures expected structure

### Lock State Management
- Explicit lock checking before decryption attempts
- Clear error messages for locked state
- Auto-lock timer reset on account access

## Test Coverage

### Happy Path Tests
- ✅ Successful decryption and return of account data
- ✅ Returns null when no account exists
- ✅ Handles complex account data structures

### Security Tests
- ✅ Throws when locked
- ✅ Handles wrong password securely
- ✅ No information leakage in errors

### Robustness Tests
- ✅ Malformed payload handling (missing fields, invalid base64)
- ✅ Invalid JSON handling
- ✅ Wrong data structure validation
- ✅ Empty/null payload handling
- ✅ Auto-lock timer behavior

## Definition of Done ✅

- [x] **Decrypted account matches original saved input**
- [x] **Wrong/malformed payload is handled safely**
- [x] **Returns null/empty when no account exists**
- [x] **Throws/returns failure on wrong password without leaking plaintext**
- [x] **Comprehensive unit test coverage**
- [x] **Type-safe implementation**

## Technical Details

### Enhanced Error Handling
```typescript
// Before: Basic error propagation
const json = await this.decryptData(payload);
return JSON.parse(json);

// After: Comprehensive validation and secure error handling
if (!this.baseKey) {
  throw new Error('Storage manager is locked');
}

if (!payload.salt || !payload.iv || !payload.data) {
  throw new Error('Invalid password or corrupted data');
}

try {
  const json = await this.decryptData(payload);
  const parsed = JSON.parse(json);
  
  if (!parsed || typeof parsed !== 'object' || !('privateKey' in parsed)) {
    throw new Error('Invalid password or corrupted data');
  }
  
  return parsed as AccountData;
} catch (error) {
  // Prevent information leakage
  throw new Error('Invalid password or corrupted data');
}
```

### Test Statistics
- **Total Test Cases**: 15 comprehensive tests
- **Coverage Areas**: Happy path, security, robustness, type safety
- **Mock Implementation**: Full storage adapter with inspection capabilities

## Breaking Changes
None - this is an enhancement to existing functionality with backward compatibility maintained.

## Files Changed
- `packages/core-sdk/src/storage/secure-storage-manager.ts` - Enhanced getAccount() method
- `packages/core-sdk/src/storage/__tests__/get-account.test.ts` - New comprehensive test suite

## Files Added
- `packages/core-sdk/src/storage/__tests__/get-account.test.ts` - New test file

## Labels
`storage`, `security`, `crypto`, `critical`
