/**
 * Google Postmaster Tools API Type Definitions
 * Based on the official API documentation:
 * https://developers.google.com/gmail/postmaster/reference/rest/v1/domains.trafficStats
 */

/**
 * Domain and IP reputation categories
 */
export type ReputationCategory =
  | 'REPUTATION_CATEGORY_UNSPECIFIED' // Default/unknown
  | 'HIGH' // Good track record, low spam, complies with guidelines
  | 'MEDIUM' // Sends good mail but intermittent low-volume spam
  | 'LOW' // Considerable spam volume, likely marked as spam
  | 'BAD'; // Extremely high spam volume, almost always rejected

/**
 * Delivery error class
 */
export type DeliveryErrorClass =
  | 'DELIVERY_ERROR_CLASS_UNSPECIFIED'
  | 'PERMANENT_ERROR' // Message rejected permanently
  | 'TEMPORARY_ERROR'; // Temporary failure, may retry

/**
 * Delivery error types
 */
export type DeliveryErrorType =
  | 'DELIVERY_ERROR_TYPE_UNSPECIFIED'
  | 'RATE_LIMIT_EXCEEDED' // Suspiciously high rate
  | 'SUSPECTED_SPAM' // Suspected spam by various reasons
  | 'CONTENT_SPAMMY' // Spammy content
  | 'BAD_ATTACHMENT' // Unsupported attachments
  | 'BAD_DMARC_POLICY' // DMARC rejection policy
  | 'LOW_IP_REPUTATION' // Very low IP reputation
  | 'LOW_DOMAIN_REPUTATION' // Very low domain reputation
  | 'IP_IN_RBL' // IP in Real-time Blackhole List
  | 'DOMAIN_IN_RBL' // Domain in Real-time Blackhole List
  | 'BAD_PTR_RECORD'; // Missing PTR record

/**
 * IP Reputation for a set of IPs in a reputation category
 */
export interface IpReputation {
  reputation: ReputationCategory;
  ipCount?: string; // int64 as string
  sampleIps?: string[];
}

/**
 * Feedback loop identifier with spam ratio
 */
export interface FeedbackLoop {
  id: string;
  spamRatio: number;
}

/**
 * Delivery error metric
 */
export interface DeliveryError {
  errorClass: DeliveryErrorClass;
  errorType: DeliveryErrorType;
  errorRatio: number; // Ratio of errors vs all authenticated traffic
}

/**
 * Email traffic statistics for a specific date
 * Resource name: domains/{domain}/trafficStats/{date}
 * where date is in yyyymmdd format (e.g., 20250131)
 */
export interface TrafficStats {
  name: string; // Resource name (e.g., domains/mythoria.pt/trafficStats/20250131)

  // User spam reports
  userReportedSpamRatio?: number; // Ratio of user-reported spam vs inbox
  userReportedSpamRatioLowerBound?: number; // 95% confidence interval lower bound
  userReportedSpamRatioUpperBound?: number; // 95% confidence interval upper bound

  // Reputation
  ipReputations?: IpReputation[]; // IP reputation by category
  domainReputation?: ReputationCategory; // Overall domain reputation
  spammyFeedbackLoops?: FeedbackLoop[]; // Feedback loop spam rates

  // Authentication success rates
  spfSuccessRatio?: number; // SPF authentication success
  dkimSuccessRatio?: number; // DKIM authentication success
  dmarcSuccessRatio?: number; // DMARC alignment success

  // Encryption
  outboundEncryptionRatio?: number; // Outgoing TLS ratio (from Gmail)
  inboundEncryptionRatio?: number; // Incoming TLS ratio (to Gmail)

  // Delivery errors
  deliveryErrors?: DeliveryError[]; // Errors by type
}

/**
 * List of traffic stats response
 */
export interface TrafficStatsListResponse {
  trafficStats: TrafficStats[];
  nextPageToken?: string;
}

/**
 * Formatted traffic stats for display
 */
export interface FormattedTrafficStats {
  date: string; // YYYY-MM-DD format
  domainReputation: ReputationCategory;
  userSpamRate: number | null; // Percentage (0-100)
  userSpamRateRange: { lower: number; upper: number } | null;
  authenticationRates: {
    spf: number | null;
    dkim: number | null;
    dmarc: number | null;
  };
  encryptionRates: {
    inbound: number | null;
    outbound: number | null;
  };
  deliveryErrors: {
    permanent: DeliveryError[];
    temporary: DeliveryError[];
    totalErrorRate: number;
  };
  ipReputation: {
    high: number;
    medium: number;
    low: number;
    bad: number;
  };
}

/**
 * Error response from Postmaster API
 */
export interface PostmasterError {
  code: number;
  message: string;
  status: string;
}
