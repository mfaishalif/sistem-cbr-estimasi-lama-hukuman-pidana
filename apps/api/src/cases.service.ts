import { Injectable, NotFoundException } from '@nestjs/common';
import type { CaseUnitDraft } from '@cbr/core';
import {
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
    const items = listCaseUnitSummaries(this.database.database, {
      limit,
      offset,
      query: query.query,
    });
    const total = this.count(query.query);
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

  private count(query?: string): number {
    const normalized = query?.trim();
    if (!normalized) {
      const row = this.database.database
        .prepare('SELECT COUNT(*) AS count FROM case_unit')
        .get() as { count: number };
      return row.count;
    }
    const pattern = `%${normalized.toLowerCase()}%`;
    const row = this.database.database
      .prepare(
        `SELECT COUNT(*) AS count
           FROM case_unit
          WHERE lower(court) LIKE ?
             OR lower(case_number) LIKE ?
             OR lower(COALESCE(defendant_name, '')) LIKE ?
             OR lower(COALESCE(category, '')) LIKE ?`,
      )
      .get(pattern, pattern, pattern, pattern) as { count: number };
    return row.count;
  }
}
