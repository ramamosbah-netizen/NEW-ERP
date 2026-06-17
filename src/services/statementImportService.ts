import { logger } from '@/lib/logger';
/**
 * Converts a file object to a base64 encoded string.
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // Extract the raw base64 string from data URL
      const base64Data = result.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = error => reject(error);
  });
}

export const statementImportService = {
  /**
   * Uploads an RTA/Police statement document (PDF, Excel, or Image), calls the Gemini API parser,
   * and returns the list of extracted traffic violations.
   */
  async extractFinesFromStatement(file: File): Promise<any[]> {
    try {
      const fileBase64 = await fileToBase64(file);
      const mimeType = file.type;

      const response = await fetch('/api/fleet/import-statement', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fileBase64,
          mimeType
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to extract fines from statement');
      }

      return data.fines || [];
    } catch (error: any) {
      logger.error('Error in statement fine extraction service:', error);
      throw error;
    }
  }
};

export default statementImportService;
