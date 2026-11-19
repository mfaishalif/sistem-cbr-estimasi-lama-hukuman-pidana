import { Controller, Get } from '@nestjs/common';
import { getCaseBaseVocabulary } from '@cbr/data';
import { DatabaseService } from './database.service';

@Controller('vocabulary')
export class VocabularyController {
  constructor(private readonly database: DatabaseService) {}

  @Get()
  vocabulary() {
    return getCaseBaseVocabulary(this.database.database, 20);
  }
}
