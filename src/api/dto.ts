import type { Customer, Feedback, TeaProfile } from '../contracts/account';
import type { RecommendationRequest, RecommendationResult } from '../contracts/recommendation';
import type { Tea } from '../contracts/tea';
import type { CreateTeaInput, UpdateTeaInput } from '../application/tea/service';

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    requestId: string;
  };
}

export interface TeaListQuery {
  page: number;
  pageSize: number;
}

export interface CreateTeaDto extends CreateTeaInput {
  taxonomy: {
    familyId: string;
    subfamilyId?: string;
    styleId?: string;
  };
}

export interface UpdateTeaDto extends UpdateTeaInput {
  taxonomy: {
    familyId: string;
    subfamilyId?: string;
    styleId?: string;
  };
}

export type TeaResponseDto = Tea;
export type CustomerResponseDto = Customer;
export type TeaProfileResponseDto = TeaProfile;
export type FeedbackRequestDto = Feedback;
export type FeedbackResponseDto = Feedback;
export type RecommendationRequestDto = RecommendationRequest;
export type RecommendationResponseDto = RecommendationResult[];

export interface PaginatedTeaResponseDto {
  items: TeaResponseDto[];
  page: number;
  pageSize: number;
  total: number;
  hasNextPage: boolean;
}
