import { useMemo } from 'react';
import { SheetsService } from '@/services/SheetsService';
import { ConfigService } from '@/services/ConfigService';
import { ManageCategories } from '@/application/use-cases/ManageCategories';
import { SheetsCategoryRepo } from '@/infrastructure/google-api/SheetsCategoryRepo';
import { SheetsRuleRepo } from '@/infrastructure/google-api/SheetsRuleRepo';

interface ServiceInstances {
  sheets: SheetsService;
  config: ConfigService;
  manageCategories: ManageCategories;
}

/**
 * Centralizes the creation of service instances with the current token.
 * Replaces per-component `useMemo(() => new SheetsService(token), [token])` patterns.
 *
 * All instances are memoized on token, so they're recreated only when the token changes.
 */
export function useServiceFactory(token: string): ServiceInstances {
  const sheets = useMemo(() => new SheetsService(token), [token]);
  const config = useMemo(() => new ConfigService(token), [token]);
  const manageCategories = useMemo(
    () => new ManageCategories(new SheetsCategoryRepo(token), new SheetsRuleRepo(token)),
    [token],
  );

  return { sheets, config, manageCategories };
}
