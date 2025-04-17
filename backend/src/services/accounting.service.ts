import { PrismaClient, TransactionType } from '@prisma/client';
import { Decimal } from 'decimal.js';

export class AccountingService {
  constructor(private prisma: PrismaClient) {}

  async createJournalEntry(data: {
    date: Date;
    description: string;
    entries: Array<{
      accountId: string;
      debit?: number;
      credit?: number;
      reference?: string;
    }>;
    reference: string;
    branchId: string;
  }) {
    // Validate debits equal credits
    const totalDebits = data.entries
      .reduce((sum, entry) => sum.plus(entry.debit || 0), new Decimal(0));
    const totalCredits = data.entries
      .reduce((sum, entry) => sum.plus(entry.credit || 0), new Decimal(0));

    if (!totalDebits.equals(totalCredits)) {
      throw new Error('Debits must equal credits');
    }

    return this.prisma.journalEntry.create({
      data: {
        date: data.date,
        description: data.description,
        reference: data.reference,
        branchId: data.branchId,
        entries: {
          create: data.entries
        }
      },
      include: {
        entries: {
          include: {
            account: true
          }
        }
      }
    });
  }

  async generateFinancialStatements(params: {
    startDate: Date;
    endDate: Date;
    branchId?: string;
  }) {
    const { startDate, endDate, branchId } = params;

    // Get all transactions for the period
    const transactions = await this.prisma.journalEntry.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate
        },
        branchId: branchId
      },
      include: {
        entries: {
          include: {
            account: true
          }
        }
      }
    });

    // Calculate balances for each account
    const accountBalances = new Map<string, Decimal>();
    for (const transaction of transactions) {
      for (const entry of transaction.entries) {
        const currentBalance = accountBalances.get(entry.accountId) || new Decimal(0);
        const debit = new Decimal(entry.debit || 0);
        const credit = new Decimal(entry.credit || 0);
        accountBalances.set(
          entry.accountId,
          currentBalance.plus(debit).minus(credit)
        );
      }
    }

    // Generate income statement
    const revenue = await this.getAccountTypeBalance('REVENUE', accountBalances);
    const expenses = await this.getAccountTypeBalance('EXPENSE', accountBalances);
    const netIncome = revenue.minus(expenses);

    // Generate balance sheet
    const assets = await this.getAccountTypeBalance('ASSET', accountBalances);
    const liabilities = await this.getAccountTypeBalance('LIABILITY', accountBalances);
    const equity = await this.getAccountTypeBalance('EQUITY', accountBalances);

    return {
      incomeStatement: {
        revenue: revenue.toNumber(),
        expenses: expenses.toNumber(),
        netIncome: netIncome.toNumber()
      },
      balanceSheet: {
        assets: assets.toNumber(),
        liabilities: liabilities.toNumber(),
        equity: equity.toNumber()
      }
    };
  }

  private async getAccountTypeBalance(
    type: string,
    balances: Map<string, Decimal>
  ) {
    const accounts = await this.prisma.account.findMany({
      where: { type }
    });

    return accounts.reduce((sum, account) => {
      const balance = balances.get(account.id) || new Decimal(0);
      return sum.plus(balance);
    }, new Decimal(0));
  }

  async reconcileAccount(data: {
    accountId: string;
    statementDate: Date;
    statementBalance: number;
    transactions: Array<{
      id: string;
      cleared: boolean;
    }>;
  }) {
    const { accountId, statementDate, statementBalance, transactions } = data;

    // Mark transactions as cleared
    await Promise.all(
      transactions.map(tx =>
        this.prisma.journalEntryLine.update({
          where: { id: tx.id },
          data: { cleared: tx.cleared }
        })
      )
    );

    // Calculate reconciled balance
    const reconciledBalance = await this.prisma.journalEntryLine.aggregate({
      where: {
        accountId,
        cleared: true,
        journalEntry: {
          date: { lte: statementDate }
        }
      },
      _sum: {
        debit: true,
        credit: true
      }
    });

    const calculatedBalance = new Decimal(reconciledBalance._sum.debit || 0)
      .minus(new Decimal(reconciledBalance._sum.credit || 0));

    if (!calculatedBalance.equals(new Decimal(statementBalance))) {
      throw new Error('Reconciliation difference detected');
    }

    // Create reconciliation record
    return this.prisma.accountReconciliation.create({
      data: {
        accountId,
        statementDate,
        statementBalance,
        reconciledBalance: calculatedBalance.toNumber()
      }
    });
  }
} 