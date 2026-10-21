import {createAnalyticsTracker,type AnalyticsEventName,type AnalyticsPayload} from '../contracts/analytics';
// In-memory diagnostic events only. No chat text, answers, contact details or network collector.
export const yunaEvents:{event:AnalyticsEventName;payload:AnalyticsPayload}[]=[];
export const yunaAnalytics=createAnalyticsTracker((event,payload)=>{yunaEvents.push({event,payload});if(yunaEvents.length>100)yunaEvents.shift();});
