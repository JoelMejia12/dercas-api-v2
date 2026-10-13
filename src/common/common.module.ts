import { Global, Module } from '@nestjs/common';
import { SecureLogger } from './logging/secure-logger.service';

@Global()
@Module({ providers: [SecureLogger], exports: [SecureLogger] })
export class CommonModule {}
