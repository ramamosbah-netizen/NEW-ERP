const { createClient } = require('c:/Users/Jeet_intech/Desktop/NEW-ERP/node_modules/@supabase/supabase-js');

const supabaseUrl = 'https://renqeeaabnqoikhvczww.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJlbnFlZWFhYm5xb2lraHZjend3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDkzMjk4NywiZXhwIjoyMDk2NTA4OTg3fQ.LBNJhnpSjFhLf3UwajbiadTFzVXLy-asRbi8ayk1Z3Q';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  try {
    console.log('--- 1. Fetching all projects ---');
    const { data: projects, error: projErr } = await supabase
      .from('projects')
      .select('id, project_number, name, status, tender_id, boq_id, quotation_id');
    if (projErr) throw projErr;
    console.log(`Found ${projects.length} projects:`);
    console.log(JSON.stringify(projects, null, 2));

    console.log('--- 2. Fetching all quotations ---');
    const { data: sentQuotes, error: quoteErr } = await supabase
      .from('quotations')
      .select('id, quotation_number, status, revision, boq_id, project_id, client_id, client_name, subject');
    if (quoteErr) throw quoteErr;
    
    // Note: quotations table's project_id actually references tenders(id)
    console.log(`Found ${sentQuotes.length} total quotations.`);

    console.log('--- 3. Checking Gaps ---');
    const projectQuotIds = new Set(projects.map(p => p.quotation_id).filter(Boolean));
    const projectTenderIds = new Set(projects.map(p => p.tender_id).filter(Boolean));

    const eligibleStatuses = ['SENT_TO_CLIENT', 'ACCEPTED', 'REJECTED'];
    const candidates = [];
    
    for (const q of sentQuotes) {
      if (!eligibleStatuses.includes(q.status)) continue;

      // Resolve the tender_id from the quotation.project_id (since quotation.project_id references tenders)
      const tenderId = q.project_id; 
      
      // Check if this tender/opportunity chain already has a project
      const hasLinkedProject = projectTenderIds.has(tenderId) || projectQuotIds.has(q.id);
      
      if (!hasLinkedProject) {
        candidates.push({
          quotation_id: q.id,
          quotation_number: q.quotation_number,
          revision: q.revision,
          status: q.status,
          tender_id: tenderId,
          boq_id: q.boq_id,
          client_name: q.client_name,
          subject: q.subject
        });
      }
    }

    console.log(`Found ${candidates.length} quotations needing backfill (sent/accepted/rejected without projects):`);
    console.log(JSON.stringify(candidates, null, 2));

  } catch (err) {
    console.error('Error during inspection:', err);
  }
}

run();
