# Payroll Off-Ramp Flow with Dakota SDK

## Overview

This flow enables paying workers in USD by sending USDC from your crypto wallet (e.g., MetaMask). Each worker gets a dedicated USDC address - when you send USDC to it, they receive USD in their bank account.

## Prerequisites

- Dakota API key (sandbox or production)
- KYB-approved customer account
- `@dakota-xyz/ts-sdk` installed

```bash
# .npmrc
@dakota-xyz:registry=https://npm.pkg.github.com

# Install
npm install @dakota-xyz/ts-sdk
```

## Architecture

```
Your MetaMask Wallet (USDC)
         │
         ├── Send USDC to Worker A's off-ramp address → USD → Bank A
         ├── Send USDC to Worker B's off-ramp address → USD → Bank B
         └── Send USDC to Worker C's off-ramp address → USD → Bank C
```

## Complete Implementation

### Step 1: Initialize the Client

```typescript
import { DakotaClient, Environment } from '@dakota-xyz/ts-sdk';

const client = new DakotaClient({
  apiKey: process.env.DAKOTA_API_KEY!,
  environment: Environment.Sandbox, // Use Environment.Production for live
});
```

### Step 2: Create a Customer (Your Business)

This represents your business entity. Requires KYB approval before creating accounts.

```typescript
const customer = await client.customers.create({
  name: 'Your Business Name',
  customer_type: 'business',
  external_id: 'your-internal-id', // optional
});

const customerId = customer.id;
const applicationId = customer.application_id;

console.log('Customer ID:', customerId);
console.log('KYB Onboarding URL:', customer.application_url);
// Customer must complete KYB at this URL before proceeding
```

### Step 3: Simulate KYB Approval (Sandbox Only)

```typescript
// Wait for KYB or simulate approval in sandbox
await client.sandbox.simulateOnboarding({
  type: 'kyb_approve',
  applicant_id: applicationId,
  simulation_id: `sim_${Date.now()}`,
});

// Then activate the applicant
await client.sandbox.simulateOnboarding({
  type: 'applicant_activate',
  applicant_id: applicationId,
  simulation_id: `sim_${Date.now()}_activate`,
});
```

### Step 4: Add a Worker (Recipient + Bank Destination)

For each worker you want to pay:

```typescript
interface WorkerBankDetails {
  name: string;
  bankName: string;
  accountHolderName: string;
  accountNumber: string;
  routingNumber: string;
  accountType: 'checking' | 'savings';
}

async function addWorker(customerId: string, worker: WorkerBankDetails) {
  // Create recipient (the worker entity)
  const recipient = await client.recipients.create(customerId, {
    name: worker.name,
  });

  // Create bank destination (worker's bank account)
  const destination = await client.destinations.create(recipient.id, {
    destination_type: 'fiat_us',
    name: `${worker.name} Bank Account`,
    bank_name: worker.bankName,
    account_holder_name: worker.accountHolderName,
    account_number: worker.accountNumber,
    aba_routing_number: worker.routingNumber,
    account_type: worker.accountType,
  });

  // Create off-ramp account (USDC → USD)
  const offrampAccount = await client.accounts.create({
    account_type: 'offramp',
    customer_id: customerId,
    fiat_destination_id: destination.id,
    asset: 'USDC',
    network_id: 'ethereum-sepolia', // Use 'ethereum-mainnet' for production
    rail: 'ach',
    capabilities: ['ach'],
  });

  return {
    workerId: recipient.id,
    destinationId: destination.id,
    offrampAccountId: offrampAccount.id,
    usdcAddress: offrampAccount.crypto_address, // Send USDC here to pay this worker
  };
}
```

### Step 5: Add Multiple Workers

```typescript
const workers: WorkerBankDetails[] = [
  {
    name: 'Alice Johnson',
    bankName: 'Chase Bank',
    accountHolderName: 'Alice Johnson',
    accountNumber: '123456789',
    routingNumber: '021000021',
    accountType: 'checking',
  },
  {
    name: 'Bob Smith',
    bankName: 'Bank of America',
    accountHolderName: 'Bob Smith',
    accountNumber: '987654321',
    routingNumber: '026009593',
    accountType: 'checking',
  },
];

const workerAccounts = [];

for (const worker of workers) {
  const account = await addWorker(customerId, worker);
  workerAccounts.push({
    name: worker.name,
    ...account,
  });
  console.log(`${worker.name}: Send USDC to ${account.usdcAddress}`);
}
```

### Step 6: Pay a Worker

To pay a worker, simply send USDC from your wallet (MetaMask, etc.) to their `usdcAddress`.

```
1. Open MetaMask
2. Send USDC to the worker's usdcAddress
3. Dakota automatically converts USDC → USD
4. Worker receives USD in their bank (1-2 business days for ACH)
```

### Step 7: Track Transactions

After sending USDC, Dakota detects the deposit (2-10 minutes) and creates a transaction.

#### Option A: Polling (Simple)

```typescript
// Poll for transactions on a specific worker's account
async function getWorkerTransactions(accountId: string) {
  const txs = await client.transactions.list({ account_id: accountId }).toArray();
  return txs;
}

// Poll every 30 seconds
setInterval(async () => {
  for (const worker of workerAccounts) {
    const txs = await getWorkerTransactions(worker.offrampAccountId);
    // Update your database/UI
    for (const tx of txs) {
      console.log(`${worker.name}: ${tx.status} - $${tx.amount}`);
    }
  }
}, 30000);
```

#### Option B: Webhooks (Recommended for Production)

```typescript
import { WebhookHandler } from '@dakota-xyz/ts-sdk/webhook';

const handler = new WebhookHandler({
  publicKey: process.env.DAKOTA_WEBHOOK_PUBLIC_KEY!,
});

// New transaction detected (USDC received)
handler.on('auto_transaction.created', async (event) => {
  const tx = event.data;
  await db.transactions.create({
    dakota_tx_id: tx.id,
    account_id: tx.account_id,
    amount: tx.source_amount,
    status: tx.status,
  });
});

// Transaction status changed
handler.on('auto_transaction.updated', async (event) => {
  const tx = event.data;
  await db.transactions.update({
    where: { dakota_tx_id: tx.id },
    data: { status: tx.status },
  });
});

// Register endpoint
app.post('/webhooks/dakota', express.raw({ type: 'application/json' }), handler.expressMiddleware());
```

Register your webhook URL:

```typescript
await client.webhooks.createTarget({
  url: 'https://your-app.com/webhooks/dakota',
  events: ['auto_transaction.*'],
});
```

#### Transaction Status Flow

```
You send USDC ──▶ Dakota detects ──▶ pending ──▶ processing ──▶ completed
                  (2-10 min)                                    (ACH sent)
```

| Status | Meaning |
|--------|---------|
| `pending` | Deposit detected, awaiting confirmation |
| `processing` | USDC → USD conversion, ACH initiated |
| `completed` | USD sent to worker's bank |
| `failed` | Transaction failed |

## Complete Example Script

```typescript
import { DakotaClient, Environment } from '@dakota-xyz/ts-sdk';

async function setupPayroll() {
  const client = new DakotaClient({
    apiKey: process.env.DAKOTA_API_KEY!,
    environment: Environment.Sandbox,
  });

  // 1. Create customer (your business)
  const customer = await client.customers.create({
    name: 'Acme Payroll Inc',
    customer_type: 'business',
  });

  console.log('Customer created:', customer.id);
  console.log('Complete KYB at:', customer.application_url);

  // 2. Simulate KYB approval (sandbox only)
  await client.sandbox.simulateOnboarding({
    type: 'kyb_approve',
    applicant_id: customer.application_id!,
    simulation_id: `sim_${Date.now()}`,
  });

  await client.sandbox.simulateOnboarding({
    type: 'applicant_activate',
    applicant_id: customer.application_id!,
    simulation_id: `sim_${Date.now()}_activate`,
  });

  console.log('KYB approved');

  // 3. Add workers
  const workerData = [
    {
      name: 'Alice Johnson',
      bankName: 'Chase Bank',
      accountHolderName: 'Alice Johnson',
      accountNumber: '123456789',
      routingNumber: '021000021',
      accountType: 'checking' as const,
    },
    {
      name: 'Bob Smith',
      bankName: 'Bank of America',
      accountHolderName: 'Bob Smith',
      accountNumber: '987654321',
      routingNumber: '026009593',
      accountType: 'checking' as const,
    },
  ];

  console.log('\n=== Worker Payment Addresses ===\n');

  for (const worker of workerData) {
    // Create recipient
    const recipient = await client.recipients.create(customer.id, {
      name: worker.name,
    });

    // Create bank destination
    const destination = await client.destinations.create(recipient.id, {
      destination_type: 'fiat_us',
      name: `${worker.name} Bank`,
      bank_name: worker.bankName,
      account_holder_name: worker.accountHolderName,
      account_number: worker.accountNumber,
      aba_routing_number: worker.routingNumber,
      account_type: worker.accountType,
    });

    // Create off-ramp account
    const offramp = await client.accounts.create({
      account_type: 'offramp',
      customer_id: customer.id,
      fiat_destination_id: destination.id,
      asset: 'USDC',
      network_id: 'ethereum-sepolia',
      rail: 'ach',
      capabilities: ['ach'],
    });

    console.log(`${worker.name}:`);
    console.log(`  USDC Address: ${offramp.crypto_address}`);
    console.log(`  Bank: ${worker.bankName} ****${worker.accountNumber.slice(-4)}`);
    console.log('');
  }

  console.log('Setup complete! Send USDC to any address above to pay that worker.');
}

setupPayroll().catch(console.error);
```

## Output Example

```
Customer created: cust_abc123
Complete KYB at: https://onboarding.dakota.xyz/...
KYB approved

=== Worker Payment Addresses ===

Alice Johnson:
  USDC Address: 0x1234567890abcdef1234567890abcdef12345678
  Bank: Chase Bank ****6789

Bob Smith:
  USDC Address: 0xabcdef1234567890abcdef1234567890abcdef12
  Bank: Bank of America ****4321

Setup complete! Send USDC to any address above to pay that worker.
```

## Networks

| Environment | Network ID | Description |
|-------------|------------|-------------|
| Sandbox | `ethereum-sepolia` | Ethereum testnet |
| Sandbox | `polygon-amoy` | Polygon testnet |
| Production | `ethereum-mainnet` | Ethereum mainnet |
| Production | `polygon-mainnet` | Polygon mainnet |

## Sandbox Testing

To test the off-ramp flow in sandbox, you need to send real testnet USDC:

### 1. Get Sepolia Testnet ETH (for gas)

- Faucet: https://sepoliafaucet.com or https://www.alchemy.com/faucets/ethereum-sepolia

### 2. Get Sepolia Testnet USDC

- Circle Faucet: https://faucet.circle.com
- Select "Ethereum Sepolia" and "USDC"

### 3. Add USDC to MetaMask

```
Network: Sepolia Test Network (Chain ID: 11155111)
USDC Contract: 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238
Decimals: 6
```

### 4. Send USDC to Worker's Address

Send testnet USDC from MetaMask to the worker's `crypto_address`. Dakota will detect the deposit within 2-10 minutes.

## Notes

- Each worker gets a **permanent** USDC address - reuse it for multiple payments
- ACH transfers typically take 1-2 business days
- Wire transfers are faster but have higher fees
- You can check transaction status via `client.transactions.list()` or webhooks
- In sandbox, Dakota detects deposits within 2-10 minutes
