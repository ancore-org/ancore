# Event Decoder Usage Examples

This document provides concrete examples of using the `@ancore/account-abstraction` event decoders across different surfaces (dashboard, mobile, services).

## Table of Contents

- [Basic Event Decoding](#basic-event-decoding)
- [Dashboard Integration](#dashboard-integration)
- [Mobile Wallet Integration](#mobile-wallet-integration)
- [Indexer Service Integration](#indexer-service-integration)
- [Relayer Service Integration](#relayer-service-integration)
- [Real-time Event Streaming](#real-time-event-streaming)
- [Error Handling](#error-handling)

## Basic Event Decoding

### Decoding a Single Event

```typescript
import { 
  decodeAccountContractEvent,
  ACCOUNT_CONTRACT_EVENT_TOPICS 
} from '@ancore/account-abstraction';
import { SorobanRpc, xdr } from '@stellar/stellar-sdk';

// Get transaction result from Stellar
const server = new SorobanRpc.Server('https://soroban-testnet.stellar.org');
const txResult = await server.getTransaction(txHash);

// Extract and decode events
if (txResult.status === 'SUCCESS' && txResult.resultMetaXdr) {
  const meta = xdr.TransactionMeta.fromXDR(txResult.resultMetaXdr, 'base64');
  const events = meta.v3()?.sorobanMeta()?.events() || [];
  
  for (const event of events) {
    const decoded = decodeAccountContractEvent(event);
    
    if (decoded) {
      console.log(`Event from ${decoded.contractId}:`, decoded.event);
    }
  }
}
```

### Filtering by Event Type

```typescript
import { 
  decodeAccountContractEvent,
  ACCOUNT_CONTRACT_EVENT_TOPICS,
  type AccountContractExecutedEvent 
} from '@ancore/account-abstraction';

function getExecutedEvents(events: xdr.ContractEvent[]): AccountContractExecutedEvent[] {
  return events
    .map(decodeAccountContractEvent)
    .filter((decoded): decoded is NonNullable<typeof decoded> => 
      decoded !== null && decoded.event.type === ACCOUNT_CONTRACT_EVENT_TOPICS.executed
    )
    .map(decoded => decoded.event as AccountContractExecutedEvent);
}
```

## Dashboard Integration

### Transaction History Component

```typescript
// apps/web-dashboard/src/hooks/useAccountEvents.ts
import { useEffect, useState } from 'react';
import { 
  decodeAccountContractEvent,
  type AccountContractEvent 
} from '@ancore/account-abstraction';
import { SorobanRpc } from '@stellar/stellar-sdk';

interface AccountEvent {
  contractId: string;
  event: AccountContractEvent;
  ledger: number;
  timestamp: Date;
}

export function useAccountEvents(contractId: string) {
  const [events, setEvents] = useState<AccountEvent[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    async function fetchEvents() {
      const server = new SorobanRpc.Server(
        process.env.REACT_APP_SOROBAN_RPC_URL!
      );
      
      const response = await server.getEvents({
        filters: [
          {
            type: 'contract',
            contractIds: [contractId],
          },
        ],
        startLedger: 0,
      });
      
      const decoded = response.events
        .map(e => {
          const decoded = decodeAccountContractEvent(e.contractEvent);
          if (!decoded) return null;
          
          return {
            contractId: decoded.contractId,
            event: decoded.event,
            ledger: e.ledger,
            timestamp: new Date(e.ledgerClosedAt),
          };
        })
        .filter((e): e is AccountEvent => e !== null);
      
      setEvents(decoded);
      setLoading(false);
    }
    
    fetchEvents();
  }, [contractId]);
  
  return { events, loading };
}
```

### Event Display Component

```typescript
// apps/web-dashboard/src/components/EventList.tsx
import React from 'react';
import { type AccountContractEvent } from '@ancore/account-abstraction';

interface EventListProps {
  events: Array<{
    event: AccountContractEvent;
    timestamp: Date;
  }>;
}

export function EventList({ events }: EventListProps) {
  return (
    <div className="event-list">
      {events.map((item, index) => (
        <EventItem key={index} event={item.event} timestamp={item.timestamp} />
      ))}
    </div>
  );
}

function EventItem({ event, timestamp }: { event: AccountContractEvent; timestamp: Date }) {
  switch (event.type) {
    case 'initialized':
      return (
        <div className="event-item">
          <span className="event-type">Account Initialized</span>
          <span className="event-detail">Owner: {event.owner}</span>
          <span className="event-time">{timestamp.toLocaleString()}</span>
        </div>
      );
      
    case 'executed':
      return (
        <div className="event-item">
          <span className="event-type">Transaction Executed</span>
          <span className="event-detail">
            {event.functionName} on {event.to.slice(0, 8)}...
          </span>
          <span className="event-detail">Nonce: {event.nonce}</span>
          <span className="event-time">{timestamp.toLocaleString()}</span>
        </div>
      );
      
    case 'session_key_added':
      return (
        <div className="event-item">
          <span className="event-type">Session Key Added</span>
          <span className="event-detail">
            Key: {event.publicKey.slice(0, 8)}...
          </span>
          <span className="event-detail">
            Expires: {new Date(event.expiresAt).toLocaleString()}
          </span>
          <span className="event-time">{timestamp.toLocaleString()}</span>
        </div>
      );
      
    case 'session_key_revoked':
      return (
        <div className="event-item">
          <span className="event-type">Session Key Revoked</span>
          <span className="event-detail">
            Key: {event.publicKey.slice(0, 8)}...
          </span>
          <span className="event-time">{timestamp.toLocaleString()}</span>
        </div>
      );
      
    case 'upgraded':
      return (
        <div className="event-item">
          <span className="event-type">Contract Upgraded</span>
          <span className="event-detail">WASM Hash: {event.wasmHash.slice(0, 16)}...</span>
          <span className="event-time">{timestamp.toLocaleString()}</span>
        </div>
      );
      
    case 'migrated':
      return (
        <div className="event-item">
          <span className="event-type">Contract Migrated</span>
          <span className="event-detail">
            Version: {event.oldVersion} → {event.newVersion}
          </span>
          <span className="event-time">{timestamp.toLocaleString()}</span>
        </div>
      );
      
    case 'session_key_ttl_refreshed':
      return (
        <div className="event-item">
          <span className="event-type">Session Key TTL Refreshed</span>
          <span className="event-detail">
            Key: {event.publicKey.slice(0, 8)}...
          </span>
          <span className="event-detail">
            New Expiry: {new Date(event.expiresAt).toLocaleString()}
          </span>
          <span className="event-time">{timestamp.toLocaleString()}</span>
        </div>
      );
  }
}
```

## Mobile Wallet Integration

### Event Notification Service

```typescript
// apps/mobile-wallet/src/services/eventNotifications.ts
import { 
  decodeAccountContractEvent,
  type AccountContractEvent 
} from '@ancore/account-abstraction';
import { showNotification } from '../utils/notifications';

export function handleAccountEvent(event: xdr.ContractEvent) {
  const decoded = decodeAccountContractEvent(event);
  
  if (!decoded) return;
  
  switch (decoded.event.type) {
    case 'executed':
      showNotification({
        title: 'Transaction Executed',
        body: `${decoded.event.functionName} called on ${decoded.event.to.slice(0, 8)}...`,
        category: 'transaction',
      });
      break;
      
    case 'session_key_added':
      showNotification({
        title: 'Session Key Added',
        body: `New session key expires ${formatRelativeTime(decoded.event.expiresAt)}`,
        category: 'security',
      });
      break;
      
    case 'session_key_revoked':
      showNotification({
        title: 'Session Key Revoked',
        body: 'A session key has been revoked',
        category: 'security',
      });
      break;
      
    case 'upgraded':
      showNotification({
        title: 'Account Upgraded',
        body: 'Your account contract has been upgraded',
        category: 'system',
      });
      break;
  }
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = timestamp - now;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  
  if (hours < 24) {
    return `in ${hours} hours`;
  }
  
  const days = Math.floor(hours / 24);
  return `in ${days} days`;
}
```

### Session Key Management

```typescript
// apps/mobile-wallet/src/screens/SessionKeys.tsx
import { useEffect, useState } from 'react';
import { 
  decodeAccountContractEvent,
  type AccountContractSessionKeyAddedEvent,
  type AccountContractSessionKeyRevokedEvent 
} from '@ancore/account-abstraction';

interface SessionKeyInfo {
  publicKey: string;
  expiresAt: number;
  isActive: boolean;
}

export function useSessionKeys(contractId: string) {
  const [sessionKeys, setSessionKeys] = useState<Map<string, SessionKeyInfo>>(new Map());
  
  useEffect(() => {
    async function loadSessionKeys() {
      const events = await fetchAccountEvents(contractId);
      const keys = new Map<string, SessionKeyInfo>();
      
      for (const event of events) {
        const decoded = decodeAccountContractEvent(event);
        if (!decoded) continue;
        
        if (decoded.event.type === 'session_key_added') {
          keys.set(decoded.event.publicKey, {
            publicKey: decoded.event.publicKey,
            expiresAt: decoded.event.expiresAt,
            isActive: true,
          });
        } else if (decoded.event.type === 'session_key_revoked') {
          const existing = keys.get(decoded.event.publicKey);
          if (existing) {
            keys.set(decoded.event.publicKey, {
              ...existing,
              isActive: false,
            });
          }
        }
      }
      
      setSessionKeys(keys);
    }
    
    loadSessionKeys();
  }, [contractId]);
  
  return Array.from(sessionKeys.values()).filter(k => k.isActive);
}
```

## Indexer Service Integration

### Event Indexer

```typescript
// services/indexer/src/eventIndexer.ts
import { 
  decodeAccountContractEvent,
  type AccountContractEvent 
} from '@ancore/account-abstraction';
import { SorobanRpc } from '@stellar/stellar-sdk';
import { db } from './database';

interface IndexedEvent {
  id: string;
  contractId: string;
  eventType: string;
  eventData: AccountContractEvent;
  ledger: number;
  ledgerClosedAt: Date;
  txHash: string;
}

export class EventIndexer {
  private server: SorobanRpc.Server;
  private lastProcessedLedger: number = 0;
  
  constructor(rpcUrl: string) {
    this.server = new SorobanRpc.Server(rpcUrl);
  }
  
  async indexEvents(startLedger?: number): Promise<void> {
    const start = startLedger ?? this.lastProcessedLedger + 1;
    
    const response = await this.server.getEvents({
      filters: [
        {
          type: 'contract',
          // Index all Ancore account contracts
        },
      ],
      startLedger: start,
    });
    
    const events: IndexedEvent[] = [];
    
    for (const event of response.events) {
      const decoded = decodeAccountContractEvent(event.contractEvent);
      
      if (decoded) {
        events.push({
          id: `${event.txHash}-${event.id}`,
          contractId: decoded.contractId,
          eventType: decoded.event.type,
          eventData: decoded.event,
          ledger: event.ledger,
          ledgerClosedAt: new Date(event.ledgerClosedAt),
          txHash: event.txHash,
        });
      }
    }
    
    // Batch insert into database
    await db.events.insertMany(events);
    
    this.lastProcessedLedger = Math.max(...events.map(e => e.ledger), start);
  }
  
  async getAccountHistory(contractId: string): Promise<IndexedEvent[]> {
    return db.events.find({ contractId }).sort({ ledger: -1 }).toArray();
  }
  
  async getExecutedTransactions(contractId: string): Promise<IndexedEvent[]> {
    return db.events
      .find({ 
        contractId, 
        eventType: 'executed' 
      })
      .sort({ ledger: -1 })
      .toArray();
  }
  
  async getActiveSessionKeys(contractId: string): Promise<string[]> {
    const events = await db.events
      .find({ 
        contractId,
        eventType: { $in: ['session_key_added', 'session_key_revoked'] }
      })
      .sort({ ledger: 1 })
      .toArray();
    
    const keys = new Set<string>();
    
    for (const event of events) {
      if (event.eventType === 'session_key_added') {
        keys.add((event.eventData as any).publicKey);
      } else if (event.eventType === 'session_key_revoked') {
        keys.delete((event.eventData as any).publicKey);
      }
    }
    
    return Array.from(keys);
  }
}
```

## Relayer Service Integration

### Transaction Monitoring

```typescript
// services/relayer/src/monitoring.ts
import { 
  decodeAccountContractEvent,
  ACCOUNT_CONTRACT_EVENT_TOPICS 
} from '@ancore/account-abstraction';
import { SorobanRpc } from '@stellar/stellar-sdk';

export class TransactionMonitor {
  private server: SorobanRpc.Server;
  
  constructor(rpcUrl: string) {
    this.server = new SorobanRpc.Server(rpcUrl);
  }
  
  async monitorTransaction(txHash: string): Promise<void> {
    const result = await this.server.getTransaction(txHash);
    
    if (result.status !== 'SUCCESS') {
      console.error('Transaction failed:', result);
      return;
    }
    
    const events = this.extractEvents(result);
    
    for (const event of events) {
      const decoded = decodeAccountContractEvent(event);
      
      if (decoded?.event.type === ACCOUNT_CONTRACT_EVENT_TOPICS.executed) {
        await this.recordExecution({
          contractId: decoded.contractId,
          to: decoded.event.to,
          functionName: decoded.event.functionName,
          nonce: decoded.event.nonce,
          txHash,
        });
      }
    }
  }
  
  private extractEvents(result: SorobanRpc.GetTransactionResponse): xdr.ContractEvent[] {
    if (result.status !== 'SUCCESS' || !result.resultMetaXdr) {
      return [];
    }
    
    const meta = xdr.TransactionMeta.fromXDR(result.resultMetaXdr, 'base64');
    return meta.v3()?.sorobanMeta()?.events() || [];
  }
  
  private async recordExecution(data: {
    contractId: string;
    to: string;
    functionName: string;
    nonce: number;
    txHash: string;
  }): Promise<void> {
    // Record execution for analytics/monitoring
    console.log('Execution recorded:', data);
  }
}
```

## Real-time Event Streaming

### WebSocket Event Stream

```typescript
// apps/web-dashboard/src/services/eventStream.ts
import { 
  decodeAccountContractEvent,
  type AccountContractEvent 
} from '@ancore/account-abstraction';
import { SorobanRpc } from '@stellar/stellar-sdk';

export class EventStream {
  private server: SorobanRpc.Server;
  private listeners: Map<string, Set<(event: AccountContractEvent) => void>> = new Map();
  private polling: boolean = false;
  private lastLedger: number = 0;
  
  constructor(rpcUrl: string) {
    this.server = new SorobanRpc.Server(rpcUrl);
  }
  
  subscribe(contractId: string, callback: (event: AccountContractEvent) => void): () => void {
    if (!this.listeners.has(contractId)) {
      this.listeners.set(contractId, new Set());
    }
    
    this.listeners.get(contractId)!.add(callback);
    
    if (!this.polling) {
      this.startPolling();
    }
    
    return () => {
      this.listeners.get(contractId)?.delete(callback);
      if (this.listeners.get(contractId)?.size === 0) {
        this.listeners.delete(contractId);
      }
      if (this.listeners.size === 0) {
        this.stopPolling();
      }
    };
  }
  
  private async startPolling(): Promise<void> {
    this.polling = true;
    
    while (this.polling) {
      try {
        await this.pollEvents();
      } catch (error) {
        console.error('Error polling events:', error);
      }
      
      await new Promise(resolve => setTimeout(resolve, 5000)); // Poll every 5 seconds
    }
  }
  
  private stopPolling(): void {
    this.polling = false;
  }
  
  private async pollEvents(): Promise<void> {
    const contractIds = Array.from(this.listeners.keys());
    
    if (contractIds.length === 0) return;
    
    const response = await this.server.getEvents({
      filters: [
        {
          type: 'contract',
          contractIds,
        },
      ],
      startLedger: this.lastLedger + 1,
    });
    
    for (const event of response.events) {
      const decoded = decodeAccountContractEvent(event.contractEvent);
      
      if (decoded) {
        const listeners = this.listeners.get(decoded.contractId);
        if (listeners) {
          for (const callback of listeners) {
            callback(decoded.event);
          }
        }
      }
      
      this.lastLedger = Math.max(this.lastLedger, event.ledger);
    }
  }
}

// Usage in React component
export function useEventStream(contractId: string) {
  const [events, setEvents] = useState<AccountContractEvent[]>([]);
  
  useEffect(() => {
    const stream = new EventStream(process.env.REACT_APP_SOROBAN_RPC_URL!);
    
    const unsubscribe = stream.subscribe(contractId, (event) => {
      setEvents(prev => [...prev, event]);
    });
    
    return unsubscribe;
  }, [contractId]);
  
  return events;
}
```

## Error Handling

### Robust Event Processing

```typescript
import { 
  decodeAccountContractEvent,
  type DecodedAccountContractEventEnvelope 
} from '@ancore/account-abstraction';
import { xdr } from '@stellar/stellar-sdk';

function safeDecodeEvent(
  event: xdr.ContractEvent
): DecodedAccountContractEventEnvelope | null {
  try {
    return decodeAccountContractEvent(event);
  } catch (error) {
    console.error('Failed to decode event:', error);
    return null;
  }
}

function processEvents(events: xdr.ContractEvent[]): void {
  const decoded = events
    .map(safeDecodeEvent)
    .filter((e): e is DecodedAccountContractEventEnvelope => e !== null);
  
  for (const event of decoded) {
    try {
      handleEvent(event);
    } catch (error) {
      console.error(`Failed to handle event ${event.event.type}:`, error);
      // Continue processing other events
    }
  }
}

function handleEvent(envelope: DecodedAccountContractEventEnvelope): void {
  // Type-safe event handling with exhaustive checking
  const { event } = envelope;
  
  switch (event.type) {
    case 'initialized':
    case 'executed':
    case 'session_key_added':
    case 'session_key_revoked':
    case 'upgraded':
    case 'migrated':
    case 'session_key_ttl_refreshed':
      // Handle each event type
      break;
    default:
      // TypeScript ensures this is unreachable if all cases are handled
      const _exhaustive: never = event;
      throw new Error(`Unhandled event type: ${(_exhaustive as any).type}`);
  }
}
```

## Best Practices

1. **Always use the canonical decoders** - Don't parse events manually
2. **Handle null returns** - `decodeAccountContractEvent` returns `null` for non-contract events
3. **Use discriminated unions** - TypeScript will narrow types based on `event.type`
4. **Validate timestamps** - Event timestamps may be in seconds or milliseconds
5. **Batch process events** - Process multiple events in a single pass for efficiency
6. **Log decode failures** - Track events that fail to decode for debugging
7. **Use type guards** - Filter and narrow types safely with TypeScript

## Schema Evolution

When the contract adds new event types:

1. Update `event-decoders.ts` with new event interfaces
2. Add new cases to `decodeAccountContractEventData`
3. Update `ACCOUNT_CONTRACT_EVENT_TOPICS`
4. Add tests in `event-decoders.test.ts`
5. Update this documentation

The discriminated union pattern ensures TypeScript will catch any missing cases in switch statements.
