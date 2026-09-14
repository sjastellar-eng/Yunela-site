export type AnalyticsEvent =
  | 'landing_view'
  | 'finder_start'
  | 'finder_complete'
  | 'recommendation_view'
  | 'recommendation_click'
  | 'add_to_cart'
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

export interface AnalyticsPayload {
  [key: string]: string | number | boolean | undefined;
}

export interface AnalyticsProvider {
  track(event: AnalyticsEvent, payload?: AnalyticsPayload): void;
}

const consoleProvider: AnalyticsProvider = {
  track(event, payload = {}) {
    console.info('[YUNELA analytics]', event, payload);
  },
};

let provider: AnalyticsProvider = consoleProvider;

export function configureAnalytics(nextProvider: AnalyticsProvider): void {
  provider = nextProvider;
}

export function track(event: AnalyticsEvent, payload?: AnalyticsPayload): void {
  provider.track(event, payload);
}
