export interface TicketAuthorMetadata {
  id?: string;
  name?: string;
  email?: string;
  phone?: string;
}

export interface TicketPaymentPackage {
  packageId: number;
  quantity: number;
  credits: number;
  unitPrice: number;
  totalPrice: number;
}

export type MbwayPaymentStatus = 'pending' | 'confirmed' | 'not_received';

export interface TicketMetadata {
  paymentMethod?: string;
  workflowType?: string;
  requestedAt?: string;
  amount?: number;
  credits?: number;
  phone?: string;
  email?: string;
  name?: string;
  author?: TicketAuthorMetadata;
  creditPackages?: TicketPaymentPackage[];
  storyId?: string;
  shippingAddress?: Record<string, unknown>;
  printFormat?: string;
  numberOfCopies?: number;
  enrichedUser?: {
    userId: string;
    email: string;
    displayName: string;
  } | null;
  enrichedStory?: {
    storyId: string;
    title: string;
  } | null;
  enrichedAddress?: {
    addressId: string;
    line1: string;
    line2?: string;
    city: string;
    stateRegion?: string;
    postalCode?: string;
    country: string;
    phone?: string;
  } | null;
  mbwayPayment?: {
    status: MbwayPaymentStatus;
    requestedAt?: string;
    updatedAt?: string;
    updatedBy?: string;
    paymentOrderId?: string;
  };
  [key: string]: unknown;
}
