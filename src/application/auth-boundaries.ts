export interface CurrentCustomerContext {
  customerId: string;
}

export interface AuthenticationBoundary {
  getCurrentCustomer(): Promise<CurrentCustomerContext | undefined>;
}

export interface AuthorizationBoundary {
  assertCustomerAccess(customerId: string, context: CurrentCustomerContext): Promise<void>;
}

/** C1 boundary only: authentication and authorization implementations are deferred. */
export type UntrustedCustomerId = string;
