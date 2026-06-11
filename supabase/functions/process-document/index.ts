// @ts-nocheck
// ============================================================
// JEET ERP — Document Processing Supabase Edge Function
// Multimodal Gemini 2.0 Flash AI classification & extraction pipeline
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.10.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { document_id } = await req.json();
    if (!document_id) {
      return new Response(JSON.stringify({ error: "Missing document_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Initialize Supabase client
    const supabaseUrl = (Deno.env.get("SUPABASE_URL") ?? "").trim();
    const supabaseServiceKey = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "").trim();
    const supabaseAnonKey = (Deno.env.get("SUPABASE_ANON_KEY") ?? "").trim();
    const geminiApiKey = (Deno.env.get("GEMINI_API_KEY") ?? "").trim();

    if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
      throw new Error("Missing Supabase configuration environment variables.");
    }
    if (!geminiApiKey) {
      throw new Error("Missing GEMINI_API_KEY configuration variable.");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 2. Fetch document record
    const { data: doc, error: docError } = await supabase
      .from("documents")
      .select("*")
      .eq("id", document_id)
      .single();

    if (docError || !doc) {
      throw new Error(`Document record not found: ${docError?.message || "Unknown error"}`);
    }

    // 3. Download file from private 'documents' bucket
    const { data: fileBlob, error: downloadError } = await supabase.storage
      .from("documents")
      .download(doc.storage_path);

    if (downloadError || !fileBlob) {
      throw new Error(`Failed to download file from storage: ${downloadError?.message || "Unknown error"}`);
    }

    // 4. Convert file to base64 for Gemini multimodal input
    const fileBytes = new Uint8Array(await fileBlob.arrayBuffer());
    let base64File = "";
    // Avoid call stack limits on large files using chunked encoding
    const chunkSize = 8192;
    for (let i = 0; i < fileBytes.length; i += chunkSize) {
      const chunk = fileBytes.subarray(i, i + chunkSize);
      base64File += String.fromCharCode.apply(null, chunk);
    }
    base64File = btoa(base64File);

    // 5. Fetch taxonomy categories from database to inject into AI prompt
    const { data: categories } = await supabase
      .from("document_categories")
      .select("category, subcategory, description_for_ai")
      .eq("is_active", true);

    const categoriesPromptList = (categories || []).map(
      (c) => `- Category: "${c.category}", Subcategory: "${c.subcategory}" (${c.description_for_ai})`
    ).join("\n");

    // 6. Build Gemini prompt specifying strict JSON schema
    const prompt = `You are the AI Document Classifier for JEET ERP. Analyze the attached file and extract metadata according to the following guidelines.
    
    Choose the best match category and subcategory from this taxonomy:
    ${categoriesPromptList}

    Extract details and return a strict JSON object matching this schema. Do not output markdown styling, code blocks, or preamble. Return ONLY raw JSON:
    {
      "category": "String (must match a Category from the taxonomy above)",
      "subcategory": "String (must match the corresponding Subcategory from the taxonomy above)",
      "confidence": Number (float between 0.0 and 1.0 representing classification confidence)",
      "title_suggestion": "String (suggested descriptive title for the document)",
      "references": ["String array of invoice numbers, LPO references, permit numbers, quote IDs, contract numbers, etc."],
      "issue_date": "String (YYYY-MM-DD format or null if not found)",
      "expiry_date": "String (YYYY-MM-DD format or null if not found)",
      "parties": ["String array of company names, contractors, client names mentioned in the document"],
      "amount_aed": Number (float amount in AED or null if no financial transaction is mentioned)",
      "revision": "String (e.g. 'Rev 1', 'Rev.2', 'Amendment 1' or null if not specified)",
      "summary": "String (a concise 1-2 sentence description summarizing what this document is)"
    }
    
    Important rules:
    - If the confidence of matching category/subcategory is below 0.65, set Category to "OTHER" and Subcategory to "UNCLASSIFIED".
    - Dates must be strictly parsed to YYYY-MM-DD.
    - Convert any foreign currencies mentioned to AED if exchange rates are clear, otherwise parse AED amount only.`;

    // 7. Call Gemini 2.0 Flash endpoint
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inlineData: {
                    mimeType: doc.mime_type,
                    data: base64File,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API request failed: ${errText}`);
    }

    const aiResponse = await response.json();
    const aiResultText = aiResponse.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!aiResultText) {
      throw new Error("Empty candidate result returned from Gemini API");
    }

    // 8. Parse and validate result
    const resultJson = JSON.parse(aiResultText.trim());

    // 9. Determine processing status
    // Gated by confidence threshold (0.75 for AUTO_FILED, otherwise NEEDS_REVIEW)
    const confidence = resultJson.confidence ?? 0.0;
    const finalStatus = (confidence >= 0.75 && resultJson.category !== "OTHER") 
      ? "AUTO_FILED" 
      : "NEEDS_REVIEW";

    // 10. Update document record in database
    const { error: updateError } = await supabase
      .from("documents")
      .update({
        category: resultJson.category || "OTHER",
        subcategory: resultJson.subcategory || "UNCLASSIFIED",
        ai_confidence: confidence,
        ai_metadata: resultJson,
        ai_summary: resultJson.summary || "",
        references: resultJson.references || [],
        issue_date: resultJson.issue_date || null,
        expiry_date: resultJson.expiry_date || null,
        amount_aed: resultJson.amount_aed || null,
        status: finalStatus,
        updated_at: new Date().toISOString()
      })
      .eq("id", document_id);

    if (updateError) {
      throw new Error(`Failed to save AI results to document: ${updateError.message}`);
    }

    // 11. Create Expiry alerts if expiry date is present
    if (resultJson.expiry_date) {
      // Refresh alerts
      // Since edge functions run as Service Role, we can query document_categories directly
      const { data: catRecord } = await supabase
        .from("document_categories")
        .select("default_expiry_alert_days")
        .eq("category", resultJson.category)
        .eq("subcategory", resultJson.subcategory)
        .single();

      const alertWindows = catRecord?.default_expiry_alert_days || [60, 30, 7];
      const alerts = alertWindows.map((days: number) => ({
        document_id,
        expiry_date: resultJson.expiry_date,
        alert_days_before: days,
        status: "PENDING"
      }));

      if (alerts.length > 0) {
        await supabase.from("document_expiry_alerts").insert(alerts);
      }
    }

    // 12. Log classification activity audit
    await supabase.from("document_activity").insert({
      document_id,
      action: "CLASSIFIED",
      user_id: doc.uploaded_by, // logged by uploader trigger
      detail: {
        ai_result: resultJson,
        confidence,
        status: finalStatus
      }
    });

    // 13. Emit event on system event bus if needs review
    if (finalStatus === "NEEDS_REVIEW") {
      try {
        const { data: eventData } = await supabase
          .from("system_events")
          .insert({
            event_type: "document.needs_review",
            entity_type: "DOCUMENT",
            entity_id: document_id,
            project_id: doc.entity_type === "PROJECT" ? doc.entity_id : null,
            payload: {
              title: doc.title,
              category: resultJson.category || "OTHER",
              subcategory: resultJson.subcategory || "UNCLASSIFIED",
              confidence
            },
            actor_user_id: doc.uploaded_by
          })
          .select()
          .single();

         if (eventData) {
          // Trigger process-event Edge Function via explicit fetch
          const invokeUrl = `${supabaseUrl}/functions/v1/process-event`;
          await fetch(invokeUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${supabaseAnonKey}`,
              "apikey": supabaseAnonKey
            },
            body: JSON.stringify({ event_id: eventData.id })
          })
          .then(async (res) => {
            if (!res.ok) {
              console.error(`Failed to invoke process-event from document pipeline (status ${res.status}): ${await res.text()}`);
            }
          })
          .catch((e: any) => console.error("Failed to invoke process-event fetch:", e));
        }
      } catch (err) {
        console.error("Failed to emit document.needs_review event:", err);
      }
    }

    return new Response(JSON.stringify({ success: true, status: finalStatus, data: resultJson }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("DMS Pipeline execution failed:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
