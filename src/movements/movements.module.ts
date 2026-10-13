import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MovementsController } from './movements.controller';
import { MovementsRepository } from './movements.repository';
import { MovementsService } from './movements.service';

@Module({ imports: [AuthModule], controllers: [MovementsController], providers: [MovementsRepository, MovementsService] })
export class MovementsModule {}
