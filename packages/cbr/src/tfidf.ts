/**
 * Sparse TF-IDF and cosine similarity.
 *
 * Documents are never stored as dense vectors. The index keeps an inverted
 * posting list per term and one norm per document, so query time touches only
 * the query's terms and memory grows with the number of non-zero terms.
 */

import type { PreprocessingConfig } from './config';
import { countTerms, tokenizeNarrative } from './text';

export interface TermModel {
  /** Smoothed IDF for every term seen in the reference (training) documents. */
  idf: ReadonlyMap<string, number>;
  documentCount: number;
  sublinearTermFrequency: boolean;
  smoothInverseDocumentFrequency: boolean;
}

export interface SparseTermVector {
  weights: Map<string, number>;
  norm: number;
  tokenCount: number;
  /** Terms present in the query that are also present in the fitted vocabulary. */
  recognizedTermCount: number;
}

export interface PostingList {
  caseIndices: Int32Array;
  weights: Float64Array;
}

export type TermPostings = ReadonlyMap<string, PostingList>;

export interface PostingsBuildResult {
  postings: TermPostings;
  documentNorms: Float64Array;
  termCount: number;
}

function termWeight(
  count: number,
  idf: number,
  sublinearTermFrequency: boolean,
): number {
  const tf = sublinearTermFrequency ? 1 + Math.log(count) : count;
  return tf * idf;
}

/** Fit vocabulary and IDF from reference documents only. */
export function fitTermModel(
  documents: readonly string[],
  preprocessing: PreprocessingConfig,
): TermModel {
  const documentFrequency = new Map<string, number>();

  for (const document of documents) {
    const tokens = tokenizeNarrative(document, preprocessing);
    for (const term of new Set(tokens)) {
      documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
    }
  }

  const documentCount = documents.length;
  const idf = new Map<string, number>();
  for (const [term, frequency] of documentFrequency) {
    if (frequency < preprocessing.minDocumentFrequency) {
      continue;
    }
    idf.set(
      term,
      preprocessing.smoothInverseDocumentFrequency
        ? Math.log((documentCount + 1) / (frequency + 1)) + 1
        : frequency > 0 && documentCount > 0
          ? Math.log(documentCount / frequency)
          : 0,
    );
  }

  return {
    idf,
    documentCount,
    sublinearTermFrequency: preprocessing.sublinearTermFrequency,
    smoothInverseDocumentFrequency: preprocessing.smoothInverseDocumentFrequency,
  };
}

/** Transform a query with the frozen vocabulary/IDF from training. */
export function transformNarrative(
  model: TermModel,
  text: string,
  preprocessing: PreprocessingConfig,
): SparseTermVector {
  const tokens = tokenizeNarrative(text, preprocessing);
  const { counts, tokenCount } = countTerms(tokens);
  const weights = new Map<string, number>();
  let recognizedTermCount = 0;
  let squaredNorm = 0;

  for (const [term, count] of counts) {
    const idf = model.idf.get(term);
    if (idf === undefined) {
      continue;
    }
    recognizedTermCount += 1;
    const weight = termWeight(count, idf, model.sublinearTermFrequency);
    weights.set(term, weight);
    squaredNorm += weight * weight;
  }

  return {
    weights,
    norm: Math.sqrt(squaredNorm),
    tokenCount,
    recognizedTermCount,
  };
}

/**
 * Build the inverted index and document norms in one pass. The input order does
 * not matter for scores; the caller supplies cases sorted by stable ID so ties
 * are deterministic.
 */
export function buildPostings(
  documents: readonly string[],
  model: TermModel,
  preprocessing: PreprocessingConfig,
): PostingsBuildResult {
  const temporary = new Map<string, { caseIndices: number[]; weights: number[] }>();
  const documentNorms = new Float64Array(documents.length);

  for (let caseIndex = 0; caseIndex < documents.length; caseIndex += 1) {
    const document = documents[caseIndex] as string;
    const { counts } = countTerms(tokenizeNarrative(document, preprocessing));
    let squaredNorm = 0;

    for (const [term, count] of counts) {
      const idf = model.idf.get(term);
      if (idf === undefined) {
        continue;
      }
      const weight = termWeight(count, idf, model.sublinearTermFrequency);
      squaredNorm += weight * weight;

      let posting = temporary.get(term);
      if (posting === undefined) {
        posting = { caseIndices: [], weights: [] };
        temporary.set(term, posting);
      }
      posting.caseIndices.push(caseIndex);
      posting.weights.push(weight);
    }

    documentNorms[caseIndex] = Math.sqrt(squaredNorm);
  }

  const postings = new Map<string, PostingList>();
  for (const [term, posting] of temporary) {
    postings.set(term, {
      caseIndices: Int32Array.from(posting.caseIndices),
      weights: Float64Array.from(posting.weights),
    });
  }

  return { postings, documentNorms, termCount: postings.size };
}

/**
 * Score all documents in one pass. This is the retrieval hot path: only the
 * query's terms are visited, and results are a sparse `caseIndex -> score` map.
 */
export function cosineScores(
  query: SparseTermVector,
  documentNorms: Float64Array,
  postings: TermPostings,
): Map<number, number> {
  const dotProducts = new Map<number, number>();
  if (query.norm === 0) {
    return new Map();
  }

  for (const [term, queryWeight] of query.weights) {
    const posting = postings.get(term);
    if (posting === undefined) {
      continue;
    }
    for (let index = 0; index < posting.caseIndices.length; index += 1) {
      const caseIndex = posting.caseIndices[index] as number;
      dotProducts.set(
        caseIndex,
        (dotProducts.get(caseIndex) ?? 0) + queryWeight * (posting.weights[index] as number),
      );
    }
  }

  const scores = new Map<number, number>();
  for (const [caseIndex, dotProduct] of dotProducts) {
    const norm = documentNorms[caseIndex] as number;
    if (norm > 0) {
      scores.set(caseIndex, dotProduct / (query.norm * norm));
    }
  }
  return scores;
}
