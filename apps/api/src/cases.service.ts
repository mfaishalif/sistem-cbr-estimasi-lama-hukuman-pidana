import { Injectable, NotFoundException } from '@nestjs/common';
import type { CaseUnitDraft } from '@cbr/core';
import {
  countCaseUnitSummaries,
  createCaseUnit,
  deleteCaseUnit,
  getCaseBaseGeneration,
  getCaseUnit,
  listCaseUnitSources,
  listCaseUnitSummaries,
  updateCaseUnit,
  updateCaseUnitOutcome,
} from '@cbr/data';
import { DatabaseService } from './database.service';
import { CbrService } from './cbr.service';

export interface CaseListQuery {
  limit?: number;
  offset?: number;
  query?: string;
  category?: string;
}

@Injectable()
export class CasesService {
  constructor(
    private readonly database: DatabaseService,
    private readonly cbr: CbrService,
  ) {}

  list(query: CaseListQuery) {
    const limit = Math.min(Math.max(Math.trunc(query.limit ?? 25), 1), 200);
    const offset = Math.max(Math.trunc(query.offset ?? 0), 0);
    const category = query.category?.trim() || undefined;
    const items = listCaseUnitSummaries(this.database.database, {
      limit,
      offset,
      query: query.query,
      category,
    });
    const total = countCaseUnitSummaries(this.database.database, {
      query: query.query,
      category,
    });
    return {
      items,
      total,
      limit,
      offset,
      generation: getCaseBaseGeneration(this.database.database).generation,
    };
  }

  get(caseUnitId: string) {
    const unit = getCaseUnit(this.database.database, caseUnitId);
    if (unit === null) {
      throw new NotFoundException(`Kasus ${caseUnitId} tidak ditemukan`);
    }
    return {
      ...unit,
      sources: listCaseUnitSources(this.database.database, caseUnitId),
    };
  }

  create(draft: CaseUnitDraft) {
    const id = createCaseUnit(this.database.database, draft);
    this.cbr.invalidate();
    return this.get(id);
  }

  update(caseUnitId: string, draft: CaseUnitDraft) {
    updateCaseUnit(this.database.database, caseUnitId, draft);
    this.cbr.invalidate();
    return this.get(caseUnitId);
  }

  reviseOutcome(caseUnitId: string, actualSentenceDays: number | null) {
    updateCaseUnitOutcome(this.database.database, caseUnitId, actualSentenceDays);
    this.cbr.invalidate();
    return this.get(caseUnitId);
  }

  remove(caseUnitId: string) {
    const deleted = deleteCaseUnit(this.database.database, caseUnitId);
    if (!deleted) {
      throw new NotFoundException(`Kasus ${caseUnitId} tidak ditemukan`);
    }
    this.cbr.invalidate();
    return {
      deleted: true,
      caseUnitId,
      generation: getCaseBaseGeneration(this.database.database).generation,
    };
  }

}
