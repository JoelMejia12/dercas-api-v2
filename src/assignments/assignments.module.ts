import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AssignmentRepository } from './assignment.repository';
import { AssignmentService } from './assignment.service';
import { AssignmentsController } from './assignments.controller';

@Module({
  imports: [AuthModule],
  controllers: [AssignmentsController],
  providers: [AssignmentRepository, AssignmentService],
  exports: [AssignmentRepository, AssignmentService],
})
export class AssignmentsModule {}
