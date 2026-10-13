import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LoansController } from './loans.controller';
import { LoanRequestsController } from './loan-requests.controller';
import { LoanRequestRepository } from './loan-request.repository';
import { LoanRequestService } from './loan-request.service';
import { LoanReadRepository } from './loan-read.repository';
import { LoanReadService } from './loan-read.service';

@Module({
  imports: [AuthModule],
  controllers: [LoansController, LoanRequestsController],
  providers: [LoanReadRepository, LoanReadService, LoanRequestRepository, LoanRequestService],
  exports: [LoanReadRepository, LoanReadService, LoanRequestRepository, LoanRequestService],
})
export class LoansModule {}
