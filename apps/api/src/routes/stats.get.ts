import type { StatsResponse } from '@turborepo-remote-cache/dashboard/contract';

import { STATS_RANGES } from '@turborepo-remote-cache/dashboard/contract';
import { defineHandler } from 'nitro';
import * as v from 'valibot';

import { readExpirationHours } from '../utils/config';
import { eventEnv } from '../utils/env';
import { parseInput } from '../utils/http';
import { useStatsDatabase } from '../utils/stats';
import { buildStats } from '../utils/stats-report';

const StatsQuery = v.object({
  range: v.optional(v.picklist(STATS_RANGES), '30d'),
});

export default defineHandler(async (event): Promise<StatsResponse> => {
  const { range } = parseInput(StatsQuery, Object.fromEntries(event.url.searchParams));
  const db = await useStatsDatabase();
  if (!db) {
    return { enabled: false };
  }
  return buildStats(db, { range, expirationHours: readExpirationHours(eventEnv(event)) });
});
