// ============================================================
// JEET ERP — Device Clipboard Import Service
// ============================================================

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabase';
import { TCDevice } from '@/types/tc.types';

export const deviceImportService = {
  /**
   * Parses tab-separated values (TSV) from Excel/CSV copy-paste actions.
   * Expected columns:
   * Col 0: Device Type (mandatory)
   * Col 1: Label / Tag (mandatory, e.g., CAM-GF-001)
   * Col 2: Location (mandatory, e.g., Ground Floor Lobby)
   * Col 3: Brand & Model (optional)
   * Col 4: Serial Number (optional)
   * Col 5: IP Address (optional)
   */
  parsePasteData(pasteText: string): Partial<TCDevice>[] {
    if (!pasteText || !pasteText.trim()) return [];

    const lines = pasteText.split(/\r?\n/);
    const parsedDevices: Partial<TCDevice>[] = [];

    for (const line of lines) {
      if (!line.trim()) continue;

      const cells = line.split('\t').map(c => c.trim());
      
      // Skip header row if matches common terms
      if (
        cells[0]?.toLowerCase() === 'device type' ||
        cells[0]?.toLowerCase() === 'type' ||
        cells[1]?.toLowerCase() === 'label' ||
        cells[1]?.toLowerCase() === 'tag'
      ) {
        continue;
      }

      const deviceType = cells[0];
      const label = cells[1];
      const location = cells[2];
      const brandModel = cells[3] || undefined;
      const serial = cells[4] || undefined;
      const ipAddress = cells[5] || undefined;

      // Validate required fields
      if (!deviceType || !label || !location) {
        continue; // skip invalid or incomplete rows
      }

      parsedDevices.push({
        device_type: deviceType,
        label: label,
        location: location,
        brand_model: brandModel,
        serial: serial,
        ip_address: ipAddress,
        status: 'PENDING'
      });
    }

    return parsedDevices;
  },

  /**
   * Bulk inserts parsed devices into a T&C package.
   */
  async importDevices(packageId: string, pasteText: string): Promise<TCDevice[]> {
    const devicesToInsert = this.parsePasteData(pasteText);
    
    if (devicesToInsert.length === 0) {
      throw new Error('No valid device records found in the pasted data. Columns must be: Type, Label, Location, Brand/Model (opt), Serial (opt), IP (opt) separated by tabs.');
    }

    // Attach package ID to all inserts
    const finalInserts = devicesToInsert.map(d => ({
      ...d,
      package_id: packageId
    }));

    // Chunk size of 100 to execute safely
    const chunkSize = 100;
    const insertedDevices: TCDevice[] = [];

    for (let i = 0; i < finalInserts.length; i += chunkSize) {
      const chunk = finalInserts.slice(i, i + chunkSize);
      const { data, error } = await supabase
        .from('tc_devices')
        .insert(chunk)
        .select();

      if (error) {
        logger.error('Failed to import device chunk:', error);
        throw new Error(`Import failed during insertion: ${error.message}`);
      }

      if (data) {
        insertedDevices.push(...(data as TCDevice[]));
      }
    }

    // Recalculate package progress since new devices were added
    // This updates the completion percentage appropriately
    const { tcService } = await import('./tcService');
    await tcService.recalculatePackageProgress(packageId);

    return insertedDevices;
  }
};

export default deviceImportService;
