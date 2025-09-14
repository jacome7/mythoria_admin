export interface CreditPackage {
  id: number;
  credits: number;
  price: number;
  popular?: boolean;
  bestValue?: boolean;
  icon: string;
  key: string;
  dbId: string;
}

export interface CartItem {
  packageId: number;
  quantity: number;
}
