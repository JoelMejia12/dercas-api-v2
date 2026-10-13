import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  CreateLoanRequestInput,
  LoanRequestIdempotencyConflictError,
  LoanRequestRecord,
  LoanRequestRepository,
  LoanRequestUnavailableError,
  LoanRequestVehicleNotFoundError,
} from './loan-request.repository';

@Injectable()
export class LoanRequestService {
  constructor(private readonly requests: LoanRequestRepository) {}

  async create(input: CreateLoanRequestInput): Promise<LoanRequestRecord> {
    try {
      return await this.requests.create(input);
    } catch (error) {
      if (error instanceof LoanRequestVehicleNotFoundError) throw new NotFoundException();
      if (error instanceof LoanRequestUnavailableError || error instanceof LoanRequestIdempotencyConflictError) {
        throw new ConflictException();
      }
      throw error;
    }
  }

  async findById(id: string, userId: string): Promise<LoanRequestRecord> {
    const request = await this.requests.findByIdForUser(id, userId);
    if (!request) throw new NotFoundException();
    return request;
  }
}
