import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { DatabaseService } from './database.service';
import { HealthController } from './health.controller';
import { RetrievalConfigService } from './retrieval-config.service';
import { CbrService } from './cbr.service';
import { CasesService } from './cases.service';
import { CasesController } from './cases.controller';
import { EstimateController } from './estimate.controller';
import { ValidationErrorFilter } from './validation.filter';

@Module({
  controllers: [HealthController, CasesController, EstimateController],
  providers: [
    DatabaseService,
    RetrievalConfigService,
    CbrService,
    CasesService,
    {
      provide: APP_FILTER,
      useClass: ValidationErrorFilter,
    },
  ],
})
export class AppModule {}
