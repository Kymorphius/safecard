/** 按 SOL / 代币选择对应指令，并补齐需要的关联代币账户 */
import type { Address, Instruction, TransactionSigner } from '@solana/kit';
import { findAssociatedTokenPda } from '@solana-program/token';
import {
  type Merchant,
  getBuyCardInstructionAsync,
  getBuyTokenCardInstructionAsync,
  getCheckInInstructionAsync,
  getCheckInTokenInstructionAsync,
  getCreatePlanInstruction,
  getCreateTokenPlanInstructionAsync,
  getRefundInstruction,
  getRefundTokenInstructionAsync,
} from '@/generated';
import type { Currency } from './currency';
import { loyaltyAddress, membershipAddress } from './loyalty';
import type { UiCard, UiPlan } from './model';
import { type WithAddress, findPlanPda } from './solana';

async function ata(owner: Address, c: Currency): Promise<Address> {
  const [address] = await findAssociatedTokenPda({ owner, mint: c.mint!, tokenProgram: c.tokenProgram! });
  return address;
}

export async function createPlanIx(
  authority: TransactionSigner,
  merchant: WithAddress<Merchant>,
  currency: Currency,
  name: string,
  price: bigint,
  sessions: number,
): Promise<Instruction> {
  if (!currency.mint) {
    const plan = await findPlanPda(merchant.address, merchant.planCount, 'sol');
    return getCreatePlanInstruction({ authority, merchant: merchant.address, plan, name, price, sessions });
  }
  const plan = await findPlanPda(merchant.address, merchant.planCount, 'token');
  return getCreateTokenPlanInstructionAsync({
    authority,
    merchant: merchant.address,
    mint: currency.mint,
    plan,
    tokenProgram: currency.tokenProgram!,
    name,
    price,
    sessions,
  });
}

/**
 * applyMember 为 true 时附上会员优惠配置和会员记录，由合约判断是否打折。
 * 两个账户都必须已存在，否则交易会失败，所以只在页面确认符合条件时才传。
 */
export async function buyIx(buyer: TransactionSigner, plan: UiPlan, applyMember = false): Promise<Instruction> {
  const member = applyMember
    ? {
        loyalty: await loyaltyAddress(plan.merchant),
        membership: await membershipAddress(plan.merchant, buyer.address),
      }
    : {};
  if (plan.kind === 'sol') {
    return getBuyCardInstructionAsync({ buyer, merchant: plan.merchant, plan: plan.address, ...member });
  }
  return getBuyTokenCardInstructionAsync({
    buyer,
    merchant: plan.merchant,
    plan: plan.address,
    mint: plan.currency.mint!,
    buyerTokenAccount: await ata(buyer.address, plan.currency),
    tokenProgram: plan.currency.tokenProgram!,
    ...member,
  });
}

export async function checkInIx(
  owner: TransactionSigner,
  card: UiCard,
  merchant: WithAddress<Merchant>,
): Promise<Instruction> {
  if (card.kind === 'sol') {
    return getCheckInInstructionAsync({
      owner,
      card: card.address,
      merchant: merchant.address,
      authority: merchant.authority,
    });
  }
  return getCheckInTokenInstructionAsync({
    owner,
    card: card.address,
    merchant: merchant.address,
    authority: merchant.authority,
    mint: card.currency.mint!,
    tokenProgram: card.currency.tokenProgram!,
  });
}

export async function refundIx(owner: TransactionSigner, card: UiCard): Promise<Instruction> {
  if (card.kind === 'sol') {
    return getRefundInstruction({ owner, card: card.address, merchant: card.merchant });
  }
  return getRefundTokenInstructionAsync({
    owner,
    card: card.address,
    merchant: card.merchant,
    mint: card.currency.mint!,
    ownerTokenAccount: await ata(owner.address, card.currency),
    tokenProgram: card.currency.tokenProgram!,
  });
}
