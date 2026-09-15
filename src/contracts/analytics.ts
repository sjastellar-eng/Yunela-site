export type AnalyticsEventName =
  | 'landing_view'
  | 'finder_start'
  | 'finder_complete'
  | 'recommendation_view'
  | 'recommendation_click'
  | 'add_to_cart'
  | 'order_created'
  | 'purchase'
  | 'box_purchase'
  | 'tea_feedback'
  | 'profile_created'
  | 'profile_updated'
  | 'second_purchase'
  | 'referral_sent'
  | 'referral_purchase'
  | 'finder_question_complete'
  | 'finder_abandonment'
  | 'recommendation_generated'
  | 'product_view'
  | 'recommendation_block_interaction'
  | 'next_tea_click'
  | 'discovery_box_view'
  | 'discovery_box_feedback'
  | 'full_size_conversion';

export type AnalyticsPayload = Record<string, string | number | boolean | null | string[]>;

export interface AnalyticsTracker {
  track(event: AnalyticsEventName, payload?: AnalyticsPayload): void;
}

/** Application code depends on this interface, never directly on an analytics provider. */
export function createAnalyticsTracker(
  sink: (event: AnalyticsEventName, payload: AnalyticsPayload) => void,
): AnalyticsTracker {
  return {
    track(event, payload = {}) {
      sink(event, payload);
    },
  };
}
