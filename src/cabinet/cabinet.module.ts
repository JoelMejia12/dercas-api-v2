import { Module } from '@nestjs/common';
import { CabinetController } from './cabinet.controller';
import { CabinetRepository } from './cabinet.repository';
import { CabinetService } from './cabinet.service';

// Cabinet reads are available; hardware transport and confirmation remain unimplemented.
@Module({ controllers: [CabinetController], providers: [CabinetRepository, CabinetService], exports: [CabinetRepository, CabinetService] })
export class CabinetModule {}
