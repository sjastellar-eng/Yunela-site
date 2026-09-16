import { isApplicationError } from '../errors';
import { FulfillmentApplicationService as BaseFulfillmentApplicationService, type ReplacementApproval, type DiscoveryBoxShortage } from './serviceV2';

export type { ReplacementApproval, DiscoveryBoxShortage };

export class FulfillmentApplicationService extends BaseFulfillmentApplicationService {
  markLost(id: string, actor: string, reason: string, operationKey: string) {
    try {
      this.transitionShipment(id, 'LOST', actor, operationKey);
      return this.getFulfillment(id);
    } catch (error) {
      if (isApplicationError(error) && (error.code === 'NOT_FOUND' || (error.code === 'DOMAIN_RULE_VIOLATION' && error.message.includes('Shipment CREATED cannot transition')))) {
        return super.markLost(id, actor, reason, operationKey);
      }
      throw error;
    }
  }

  recordReturn(id: string, actor: string, reason: string, operationKey: string) {
    try {
      this.transitionShipment(id, 'RETURNED', actor, operationKey);
      return this.getFulfillment(id);
    } catch (error) {
      if (isApplicationError(error) && error.code === 'NOT_FOUND') return super.recordReturn(id, actor, reason, operationKey);
      if (isApplicationError(error) && error.code === 'DOMAIN_RULE_VIOLATION' && error.message.includes('Shipment CREATED cannot transition')) return super.recordReturn(id, actor, reason, operationKey);
      throw error;
    }
  }
}
