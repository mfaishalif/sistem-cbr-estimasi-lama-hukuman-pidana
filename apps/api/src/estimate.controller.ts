import { Body, Controller, Get, Post } from '@nestjs/common';
import { CbrService } from './cbr.service';
import { RetrievalConfigService } from './retrieval-config.service';
import { parseEstimateRequest } from './dto';

@Controller()
export class EstimateController {
  constructor(
    private readonly cbr: CbrService,
    private readonly retrievalConfig: RetrievalConfigService,
  ) {}

  @Post('estimates')
  estimate(@Body() body: unknown) {
    const request = parseEstimateRequest(body);
    return this.cbr.estimate({
      facts: request.facts,
      excludeCaseUnitIds: request.excludeCaseUnitIds,
    });
  }

  @Get('index/status')
  indexStatus() {
    return this.cbr.status();
  }

  @Get('config')
  config() {
    return this.retrievalConfig.get();
  }
}
