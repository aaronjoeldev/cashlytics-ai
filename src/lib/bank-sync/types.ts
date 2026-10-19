/**
 * Provider-neutral shapes of bank data. SimpleFIN is the first provider; another one (e.g. a
 * direct PSD2 aggregator) only has to produce these.
 */

export type BankTransaction = {
  /** The provider's id, unique within its account */
  externalId: string;
  /** Booking day; null while pending */
  postedAt: Date | null;
  /** Decimal string, positive for money in */
  amount: string;
  description: string;
  pending: boolean;
};

export type BankAccountSnapshot = {
  externalId: string;
  name: string;
  institution: string | null;
  /** ISO 4217 code */
  currency: string;
  /** Decimal string as reported by the bank */
  balance: string;
  availableBalance: string | null;
  balanceDate: Date;
  transactions: BankTransaction[];
};

export type BankFetchResult = {
  accounts: BankAccountSnapshot[];
  /** Messages from the provider, already sanitized for display */
  messages: string[];
};
