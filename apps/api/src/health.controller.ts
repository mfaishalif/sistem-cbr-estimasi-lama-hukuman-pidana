import { Controller, Get } from '@nestjs/common';
import { DatabaseService } from './database.service';

@Controller('health')
export class HealthController {
  constructor(private readonly database: DatabaseService) {}

  @Get()
  health() {
    const database = this.database.status();

    return {
      status: 'ok',
      service: 'sistem-cbr-estimasi-lama-hukuman-pidana',
      time: new Date().toISOString(),
      database: {
        ok: true,
        schemaVersion: database.schemaVersion,
        caseUnits: database.caseUnits,
        caseGroups: database.caseGroups,
        generation: database.generation,
      },
    };
  }
}
