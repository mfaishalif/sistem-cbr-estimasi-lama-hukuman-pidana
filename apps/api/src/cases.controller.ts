import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { CasesService } from './cases.service';
import { parseCaseDraft, parseOutcomeUpdate } from './dto';

@Controller('cases')
export class CasesController {
  constructor(private readonly cases: CasesService) {}

  @Get()
  list(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('q') query?: string,
  ) {
    return this.cases.list({
      limit: limit === undefined ? undefined : Number(limit),
      offset: offset === undefined ? undefined : Number(offset),
      query,
    });
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.cases.get(id);
  }

  @Post()
  create(@Body() body: unknown) {
    return this.cases.create(parseCaseDraft(body));
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: unknown) {
    return this.cases.update(id, parseCaseDraft(body));
  }

  @Patch(':id/outcome')
  reviseOutcome(@Param('id') id: string, @Body() body: unknown) {
    return this.cases.reviseOutcome(id, parseOutcomeUpdate(body));
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.cases.remove(id);
  }
}
