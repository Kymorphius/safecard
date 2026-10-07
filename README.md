# SafeCard

**Prepaid cards that can’t run away with your money.**

Gym memberships, class passes and salon bundles are paid up front. When the shop closes, customers are left holding an empty promise. SafeCard keeps prepaid funds in an on-chain escrow on Solana: each visit the customer signs a check-in and exactly one session’s worth is released to the merchant. If the merchant closes or stops serving, the customer takes the remaining balance back in one click, with no one’s permission.

- **Program (devnet):** [`5NpKPE9MWxrgDB4NgvTEp2MgQ84uYhENy3M7Tc9UTSW9`](https://explorer.solana.com/address/5NpKPE9MWxrgDB4NgvTEp2MgQ84uYhENy3M7Tc9UTSW9?cluster=devnet)
- **Stack:** Anchor 1.1 · LiteSVM · Next.js 16 · Solana Kit 8 · Codama

## How it works

| Step | Instruction | What happens |
|---|---|---|
| Open a shop | `register_merchant(name, inactivity_timeout)` | Creates the merchant account and its public track record |
| List a plan | `create_plan(name, price, sessions)` | e.g. 10 classes for 0.1 SOL |
| Buy | `buy_card` | The full price moves into a per-card PDA, not to the merchant |
| Check in | `check_in` | Signed by the cardholder; releases one session to the merchant and resets the merchant’s inactivity timer |
| Refund | `refund` | Returns the remaining escrow and closes the card. Allowed when the card is used up, the shop is closed, or nobody has checked in within the merchant’s timeout |
| Close shop | `close_merchant` | Stops sales and check-ins; every cardholder can refund immediately |

Every merchant account publicly tracks cards sold, funds in escrow, released, refunded, and refund count, so customers can check a shop before they buy.

### Guarantees enforced by the program

- Prepaid funds sit in a program-owned PDA per card and can’t be withdrawn early.
- Only the cardholder can release a session (`check_in` requires their signature).
- `has_one` constraints bind card → merchant → payout address, so funds can’t be redirected.
- Refunds open without anyone’s approval once the merchant defaults.
- The last check-in releases the rounding remainder, so no dust is stranded.

### Known limitations (roadmap)

- A customer could use the service without signing; a dispute window would let merchants claim unsigned visits.
- The inactivity timer is per merchant, so a merchant could keep itself “alive” with a sock-puppet card; per-card timers fix this.
- No rename or reopen for merchants yet; SOL only (USDC planned); upgrade authority is a single dev key.

## Repository layout

```
programs/safecard/        Anchor program
  src/instructions/       one file per instruction
  tests/test_safecard.rs  LiteSVM tests (happy path, runaway refund, close, attacks)
app/                      Next.js web app (EN / 中文)
  src/generated/          Codama client generated from the IDL
  scripts/codama.mjs      regenerate the client
  scripts/e2e-local.ts    end-to-end run against a local validator
```

## Run it locally

Prerequisites: Rust, Solana CLI 3.x, Anchor 1.1, Node 20+.

```bash
# program: build and test
anchor build
anchor test            # runs the LiteSVM tests

# web app (talks to devnet by default)
cd app
npm install
npm run dev            # http://localhost:3000
```

Use a Wallet Standard wallet (Phantom, Solflare, Backpack) switched to **Devnet**.

Optional checks:

```bash
# end-to-end with the same client code the app uses
solana-test-validator --reset --bpf-program 5NpKPE9MWxrgDB4NgvTEp2MgQ84uYhENy3M7Tc9UTSW9 target/deploy/safecard.so
cd app && npx tsx scripts/e2e-local.ts

# after changing the program, regenerate the client
cp target/idl/safecard.json app/src/idl/ && (cd app && node scripts/codama.mjs)
```

Set `NEXT_PUBLIC_SOLANA_RPC_URL` to use an RPC other than the public devnet endpoint.

## Demo flow

1. Merchant connects, registers a shop with a 60-second timeout, and lists a plan.
2. Customer opens the shop page (or scans its QR code), buys a card, and checks in a couple of times.
3. Nobody checks in for 60 seconds: the status turns to “No service · refunds open”.
4. Customer clicks **Refund** and the remaining balance returns to their wallet.
