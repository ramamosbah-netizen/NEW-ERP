import pg from 'pg';
const { Client } = pg;

const rawUrl = 'postgresql://postgres.renqeeaabnqoikhvczww@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres';
const password = 'AzadSali4347';
const connectionString = rawUrl.replace('postgres.renqeeaabnqoikhvczww@', `postgres.renqeeaabnqoikhvczww:${password}@`);

async function runBackfill() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    console.log('✅ Connected to database!');

    // 1. Fetch the target quotation
    console.log('Fetching quotation af78c4a2-782f-41b5-9219-39e4ff5e9c45...');
    const { rows: quotes } = await client.query(
      `SELECT * FROM public.quotations WHERE id = $1`,
      ['af78c4a2-782f-41b5-9219-39e4ff5e9c45']
    );

    if (quotes.length === 0) {
      console.log('❌ Target quotation not found.');
      return;
    }

    const quote = quotes[0];
    console.log(`Found quotation: ${quote.quotation_number}, Status: ${quote.status}`);

    // Check if a project already exists for this tender
    const { rows: existingProj } = await client.query(
      `SELECT id, project_number FROM public.projects WHERE tender_id = $1 AND is_active = true`,
      [quote.project_id]
    );

    if (existingProj.length > 0) {
      console.log(`⚠️ Project already exists for this tender: ${existingProj[0].project_number} (ID: ${existingProj[0].id}). Linking quotation...`);
      await client.query(
        `UPDATE public.quotations SET actual_project_id = $1 WHERE quotation_number = $2`,
        [existingProj[0].id, quote.quotation_number]
      );
      console.log('✅ Linked quotations to existing project!');
      return;
    }

    // 2. Generate project number
    console.log('Generating unique project number...');
    const { rows: rpcRes } = await client.query(`SELECT public.generate_project_number() as num`);
    const projectNumber = rpcRes[0].num;
    console.log(`Generated project number: ${projectNumber}`);

    // 3. Fetch systems
    const { rows: qLines } = await client.query(
      `SELECT DISTINCT system FROM public.quotation_lines WHERE quotation_id = $1`,
      [quote.id]
    );
    const systemsArray = qLines.map(l => l.system).filter(Boolean);
    console.log(`Systems to associate: ${JSON.stringify(systemsArray)}`);

    // 4. Fetch Client City (as Emirate)
    const { rows: clientData } = await client.query(
      `SELECT city FROM public.clients WHERE id = $1`,
      [quote.client_id]
    );
    let emirate = 'DUBAI';
    if (clientData.length > 0 && clientData[0].city) {
      const cityUpper = clientData[0].city.toUpperCase().replace(/\s+/g, '_');
      const validEmirates = ['DUBAI', 'ABU_DHABI', 'SHARJAH', 'AJMAN', 'UMM_AL_QUWAIN', 'RAS_AL_KHAIMAH', 'FUJAIRAH'];
      if (validEmirates.includes(cityUpper)) {
        emirate = cityUpper;
      }
    }

    // 5. Create project row in MOBILIZATION (since quotation is accepted)
    console.log('Creating project row...');
    const nowStr = new Date().toISOString();
    const todayDate = nowStr.split('T')[0];

    const { rows: insertedProjs } = await client.query(
      `INSERT INTO public.projects (
        project_number, name, client_id, client_name, site_address, emirate, 
        project_type, systems, tender_id, boq_id, quotation_id, 
        contract_value, original_contract_value, budget_cost, 
        client_lpo_number, client_lpo_date, payment_terms, start_date, 
        status, sira_applicable, created_by, is_active, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 0, $14, $15, $16, $17, $18, $19, $20, true, $21, $21
      ) RETURNING id`,
      [
        projectNumber,
        quote.subject || `Project for ${quote.client_name}`,
        quote.client_id,
        quote.client_name,
        quote.client_address_line1 || '',
        emirate,
        'SUPPLY_INSTALL',
        systemsArray,
        quote.project_id, // Tender ID
        quote.boq_id,
        quote.id,
        quote.subtotal_after_discount || 0,
        quote.subtotal_after_discount || 0,
        quote.client_po_number || '',
        todayDate,
        quote.payment_terms || '',
        todayDate,
        'MOBILIZATION',
        systemsArray.includes('CCTV') || systemsArray.includes('ACCESS_CONTROL'),
        quote.prepared_by, // Creator
        nowStr
      ]
    );

    const projectId = insertedProjs[0].id;
    console.log(`✅ Project created with ID: ${projectId}`);

    // 6. Write status history logs (NONE -> SUBMITTED and SUBMITTED -> MOBILIZATION)
    console.log('Writing status history...');
    await client.query(
      `INSERT INTO public.project_status_history (project_id, from_status, to_status, comment, changed_by, changed_at) 
       VALUES ($1, 'NONE', 'SUBMITTED', 'Project auto-created on backfill (Quotation sent)', $2, $3)`,
      [projectId, quote.prepared_by, nowStr]
    );

    await client.query(
      `INSERT INTO public.project_status_history (project_id, from_status, to_status, comment, changed_by, changed_at) 
       VALUES ($1, 'SUBMITTED', 'MOBILIZATION', 'Project advanced to MOBILIZATION on backfill (Quotation accepted)', $2, $3)`,
      [projectId, quote.prepared_by, nowStr]
    );

    // 7. Insert Milestones
    console.log('Inserting default milestones...');
    const defaultMilestones = [
      { title: 'Mobilization & Material Submittal', sort_order: 1, payment_linked: false, pct: null },
      { title: 'First Fix Installation & Conduit Piping', sort_order: 2, payment_linked: true, pct: 30 },
      { title: 'Second Fix Cable Pulling & Device Fitting', sort_order: 3, payment_linked: true, pct: 40 },
      { title: 'Testing, Commissioning & SIRA Inspection', sort_order: 4, payment_linked: true, pct: 20 },
      { title: 'Handover & Training', sort_order: 5, payment_linked: true, pct: 10 }
    ];

    for (const m of defaultMilestones) {
      await client.query(
        `INSERT INTO public.project_milestones (project_id, title, sort_order, status, payment_linked, payment_pct, created_at)
         VALUES ($1, $2, $3, 'PENDING', $4, $5, $6)`,
        [projectId, m.title, m.sort_order, m.payment_linked, m.pct, nowStr]
      );
    }

    // 8. Insert Contact if available
    if (quote.client_contact_person) {
      console.log('Inserting primary contact...');
      await client.query(
        `INSERT INTO public.project_contacts (project_id, name, role, email, phone, is_primary)
         VALUES ($1, $2, 'CLIENT_REP', $3, $4, true)`,
        [projectId, quote.client_contact_person, quote.client_contact_email || '', quote.client_contact_phone || '']
      );
    }

    // 9. Back-link existing records
    console.log('Back-linking pre-existing records...');
    
    // Update Tenders
    await client.query(`UPDATE public.tenders SET project_id = $1 WHERE id = $2`, [projectId, quote.project_id]);
    
    // Update BOQs
    await client.query(`UPDATE public.boqs SET project_id = $1 WHERE id = $2`, [projectId, quote.boq_id]);
    
    // Update Tender Documents
    await client.query(`UPDATE public.tender_documents SET project_id = $1 WHERE tender_id = $2`, [projectId, quote.project_id]);
    
    // Update Quotations revisions
    await client.query(`UPDATE public.quotations SET actual_project_id = $1 WHERE quotation_number = $2`, [projectId, quote.quotation_number]);
    
    // Update Comparisons
    await client.query(`UPDATE public.supplier_comparisons SET actual_project_id = $1 WHERE project_id = $2`, [projectId, quote.project_id]);

    // Update DMS documents
    await client.query(
      `UPDATE public.documents SET entity_type = 'PROJECT', entity_id = $1 
       WHERE entity_type = 'PROJECT' AND entity_id IN ($2, $3, $4)`,
      [projectId, quote.project_id, quote.boq_id, quote.id]
    );

    console.log('🎉 Backfill migration completed successfully for quotation JI-Q-068235!');

  } catch (err) {
    console.error('❌ Error during backfill migration:', err);
  } finally {
    await client.end();
    console.log('Disconnected from database.');
  }
}

runBackfill();
