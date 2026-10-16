import { Module } from '@nestjs/common';
import { CabinetController } from './cabinet.controller';
import { CabinetRepository } from './cabinet.repository';
import { CabinetService } from './cabinet.service';
import { AuthModule } from '../auth/auth.module';

// Cabinet reads are available; hardware transport and confirmation remain unimplemented.
@Module({ imports: [AuthModule], controllers: [CabinetController], providers: [CabinetRepository, CabinetService], exports: [CabinetRepository, CabinetService] })
export class CabinetModule {}
