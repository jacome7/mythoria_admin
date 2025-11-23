import { v4 as uuidv4 } from 'uuid';

interface PurchaseItem {
  item_id: string;
  item_name: string;
  price: number;
  quantity: number;
}

interface PurchaseEventParams {
  client_id?: string;
  user_id?: string;
  transaction_id: string;
  value: number;
  currency: string;
  items: PurchaseItem[];
  engagement_time_msec?: number;
  session_id?: string;
}

export const ga4Service = {
  /**
   * Send a purchase event to Google Analytics 4 via Measurement Protocol
   */
  async sendPurchaseEvent(params: PurchaseEventParams): Promise<boolean> {
    const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
    const apiSecret = process.env.GOOGLE_ANALYTICS_API_SECRET;

    if (!measurementId || !apiSecret) {
      console.warn('GA4 credentials missing, skipping server-side event');
      return false;
    }

    // We need at least client_id or user_id
    if (!params.client_id && !params.user_id) {
      console.warn('GA4 event missing both client_id and user_id');
      return false;
    }

    const payload = {
      client_id: params.client_id || params.user_id || uuidv4(), // Fallback if needed
      user_id: params.user_id,
      events: [
        {
          name: 'purchase',
          params: {
            currency: params.currency,
            transaction_id: params.transaction_id,
            value: params.value,
            items: params.items,
            ...(params.session_id ? { session_id: params.session_id } : {}),
            ...(params.engagement_time_msec
              ? { engagement_time_msec: params.engagement_time_msec }
              : { engagement_time_msec: 100 }),
          },
        },
      ],
    };

    try {
      const url = `https://www.google-analytics.com/mp/collect?measurement_id=${measurementId}&api_secret=${apiSecret}`;

      const response = await fetch(url, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        console.error(`GA4 event failed: ${response.status} ${response.statusText}`);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error sending GA4 event:', error);
      return false;
    }
  },
};
