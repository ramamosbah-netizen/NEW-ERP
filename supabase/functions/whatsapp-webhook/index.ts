// @ts-nocheck
// ============================================================
// JEET ERP — Platform Layer: whatsapp-webhook Edge Function
// Receives inbound messages, performs Gemini intent analysis,
// auto-files attachments into DMS, manages chat sessions,
// and executes automated ticketing or agent handoffs.
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.10.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// GST offset (UTC+4)
const GST_OFFSET = 4 * 60 * 60 * 1000;

serve(async (req) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // 1. Handle Webhook Handshake Verification (GET)
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token) {
      const { data: settings } = await supabase
        .from("whatsapp_settings")
        .select("verify_token")
        .single();
      
      const expectedToken = settings?.verify_token || "jeet_erp_verify_token";

      if (token === expectedToken) {
        console.log("Meta webhook verification successful.");
        return new Response(challenge, {
          status: 200,
          headers: { "Content-Type": "text/plain" }
        });
      } else {
        console.warn("Meta webhook verification failed: Token mismatch.");
        return new Response("Forbidden", { status: 403 });
      }
    }
    return new Response("Bad Request", { status: 400 });
  }

  // 2. Handle Inbound Webhook Event Notifications (POST)
  if (req.method === "POST") {
    try {
      const payload = await req.json();

      // Verify the payload is a WhatsApp event
      if (payload.object !== "whatsapp_business_account") {
        return new Response(JSON.stringify({ error: "Unsupported object type" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // Fetch settings
      const { data: settings } = await supabase
        .from("whatsapp_settings")
        .select("*")
        .single();

      if (!settings || !settings.whatsapp_enabled) {
        console.log("WhatsApp integration is disabled in settings. Ignoring payload.");
        return new Response(JSON.stringify({ success: true, message: "Ignored (disabled)" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const entry = payload.entry?.[0];
      const change = entry?.changes?.[0];
      const val = change?.value;
      const message = val?.messages?.[0];
      const contact = val?.contacts?.[0];

      if (!message) {
        // Not a message event (could be a status callback like delivered/read)
        // Log it or skip
        return new Response(JSON.stringify({ success: true, message: "No message payload" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const messageId = message.id;
      const fromPhone = message.from; // International format: 971501234567
      const senderName = contact?.profile?.name || "WhatsApp User";
      const messageType = message.type; // text, image, document, video, location etc.

      // A. Idempotency Check: check if message has been processed
      const { data: duplicateMsg } = await supabase
        .from("whatsapp_messages")
        .select("id")
        .eq("message_id", messageId)
        .maybeSingle();

      if (duplicateMsg) {
        console.log(`Duplicate message ID: ${messageId}. Skipping processing.`);
        return new Response(JSON.stringify({ success: true, duplicate: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // B. Retrieve or Create WhatsApp Chat Session
      let chat = null;
      const { data: existingChat } = await supabase
        .from("whatsapp_chats")
        .select("*")
        .eq("phone_number", fromPhone)
        .maybeSingle();

      if (existingChat) {
        chat = existingChat;
      } else {
        // Attempt to auto-match the phone number with clients or contract contacts
        // Try exact match and partial match (e.g. without + prefix or country code)
        let matchedClientId = null;
        let matchedContractId = null;

        // Fetch client by contact_phone
        const { data: client } = await supabase
          .from("clients")
          .select("id")
          .ilike("contact_phone", `%${fromPhone.slice(-9)}%`) // match last 9 digits (handles 050..., +97150...)
          .limit(1)
          .maybeSingle();

        if (client) {
          matchedClientId = client.id;
          
          // Fetch their active AMC contract if any
          const { data: contract } = await supabase
            .from("amc_contracts")
            .select("id")
            .eq("client_id", client.id)
            .eq("status", "ACTIVE")
            .limit(1)
            .maybeSingle();
          
          if (contract) {
            matchedContractId = contract.id;
          }
        }

        // Create the chat session
        const { data: newChat, error: chatErr } = await supabase
          .from("whatsapp_chats")
          .insert({
            phone_number: fromPhone,
            client_id: matchedClientId,
            contract_id: matchedContractId,
            status: "AUTO_REPLY"
          })
          .select()
          .single();

        if (chatErr) throw chatErr;
        chat = newChat;
      }

      // C. Process Attachments / Media files
      let dmsDocumentId = null;
      let textContent = "";

      if (messageType === "text") {
        textContent = message.text?.body || "";
      } else if (messageType === "image" || messageType === "document") {
        const mediaObj = message[messageType];
        const mediaId = mediaObj.id;
        const mimeType = mediaObj.mime_type;
        const caption = mediaObj.caption || "";
        textContent = caption;

        // Download attachment from Meta API
        try {
          const downloadUrl = await getMetaMediaUrl(mediaId, settings.access_token);
          if (downloadUrl) {
            const fileBlob = await downloadMetaMedia(downloadUrl, settings.access_token);
            if (fileBlob) {
              const fileExt = mimeType.split("/")[1] || (messageType === "image" ? "jpg" : "pdf");
              const storagePath = `whatsapp/${chat.id}/${messageId}.${fileExt}`;
              const size = fileBlob.size;

              // Upload to Supabase Storage private 'documents' bucket
              const { error: uploadErr } = await supabase.storage
                .from("documents")
                .upload(storagePath, fileBlob, { contentType: mimeType });

              if (uploadErr) {
                console.error("Storage upload failed:", uploadErr);
              } else {
                // Determine uploaded_by user (use first admin in profiles as system actor)
                const { data: systemUser } = await supabase
                  .from("profiles")
                  .select("id")
                  .eq("role", "admin")
                  .limit(1)
                  .single();

                const uploadedBy = systemUser?.id;

                if (uploadedBy) {
                  // Register in public.documents
                  const originalFilename = mediaObj.filename || `${messageId}.${fileExt}`;
                  const { data: docRecord, error: docErr } = await supabase
                    .from("documents")
                    .insert({
                      entity_type: chat.client_id ? "CLIENT" : "COMPANY",
                      entity_id: chat.client_id || null,
                      title: caption || `WhatsApp ${messageType.toUpperCase()} attachment`,
                      original_filename: originalFilename,
                      file_ext: fileExt,
                      mime_type: mimeType,
                      file_size_bytes: size,
                      file_hash: messageId, // unique token identifier
                      storage_path: storagePath,
                      category: "SITE",
                      subcategory: messageType === "image" ? "SITE_PHOTO" : "DELIVERY_NOTE",
                      status: "PROCESSING",
                      uploaded_by: uploadedBy
                    })
                    .select()
                    .single();

                  if (docErr) {
                    console.error("Document registration failed:", docErr);
                  } else {
                    dmsDocumentId = docRecord.id;
                    // Trigger asynchronous document classification
                    supabase.functions.invoke("process-document", {
                      body: { document_id: dmsDocumentId }
                    }).catch(err => console.error("process-document trigger failed:", err));
                  }
                }
              }
            }
          }
        } catch (mediaErr) {
          console.error("Failed to download or file Meta media:", mediaErr);
        }
      }

      // D. Log message in whatsapp_messages table
      const { data: loggedMsg, error: msgErr } = await supabase
        .from("whatsapp_messages")
        .insert({
          chat_id: chat.id,
          direction: "INBOUND",
          sender_name: senderName,
          message_body: textContent || `[Media Attachment: ${messageType}]`,
          message_type: messageType,
          media_url: message[messageType]?.id || null,
          dms_document_id: dmsDocumentId,
          message_id: messageId,
          status: "delivered"
        })
        .select()
        .single();

      if (msgErr) throw msgErr;

      // Update chat last message timestamp
      await supabase
        .from("whatsapp_chats")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", chat.id);

      // E. Check chat status: If HUMAN_AGENT mode, ignore AI parsing and reply
      if (chat.status === "HUMAN_AGENT") {
        console.log(`Chat ${chat.id} is in HUMAN_AGENT mode. Skipping automated replies.`);
        return new Response(JSON.stringify({ success: true, mode: "human_agent" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // F. Run Gemini intent classifier and auto-replier
      // Transition CLOSED chats back to AUTO_REPLY
      if (chat.status === "CLOSED") {
        await supabase
          .from("whatsapp_chats")
          .update({ status: "AUTO_REPLY" })
          .eq("id", chat.id);
      }

      // Fetch context info: client info, active contracts, and recent open tickets
      let clientDetails = "No client matched.";
      let contractDetails = "No active AMC contracts found.";
      let openTicketsList = "No active open service tickets.";

      if (chat.client_id) {
        const { data: client } = await supabase
          .from("clients")
          .select("*")
          .eq("id", chat.client_id)
          .single();
        if (client) {
          clientDetails = `Client Name: "${client.name}". Contact Phone: ${client.contact_phone}.`;
        }

        // Active AMC contract
        const { data: contract } = await supabase
          .from("amc_contracts")
          .select("*")
          .eq("client_id", chat.client_id)
          .eq("status", "ACTIVE")
          .maybeSingle();

        if (contract) {
          contractDetails = `Contract Number: "${contract.contract_number}". Site Name: "${contract.site_name}". SLA Tier: "${contract.sla_tier}". Systems covered: ${contract.systems.join(", ")}.`;
        }

        // Open tickets
        const { data: openTickets } = await supabase
          .from("service_tickets")
          .select("ticket_number, title, status, created_at")
          .eq("client_id", chat.client_id)
          .in("status", ["NEW", "ASSIGNED", "IN_PROGRESS", "ON_HOLD_PARTS"]);

        if (openTickets && openTickets.length > 0) {
          openTicketsList = openTickets
            .map(t => `- Ticket #${t.ticket_number} (${t.title}): status is ${t.status}`)
            .join("\n");
        }
      }

      // Call Gemini Flash
      const geminiApiKey = settings.gemini_api_key;
      let replyMessageText = "";
      let analyzedIntent = "GENERAL_QUERY";
      
      if (geminiApiKey) {
        try {
          const prompt = `You are the AI WhatsApp Support Assistant for JEET ERP. Analyze the inbound user message and extract details to determine their intent.

          Context information:
          - Client Details: ${clientDetails}
          - Contract Details: ${contractDetails}
          - Open Service Tickets:
          ${openTicketsList}

          Allowed Systems: 'CCTV', 'ACS' (Access Control), 'FIRE_ALARM', 'GATE_BARRIER', 'INTERCOM', 'PUBLIC_ADDRESS', 'INTRUSION_ALARM', 'NETWORK_IT'.
          Allowed SLA priorities: 'LOW', 'MEDIUM', 'HIGH', 'EMERGENCY'.

          Determine which of these 4 intents matches the user request:
          1. "CREATE_TICKET": The user is reporting a fault, downtime, defect, or asking for technical service/maintenance support.
          2. "CHECK_STATUS": The user is inquiring about a ticket progress, ETA, or visit update.
          3. "HUMAN_HANDOFF": The user is requesting a human agent, expressing frustration, or asking something complex not covered by standard guides.
          4. "GENERAL_QUERY": Simple inquiries about billing, proposal, timings, contact info, or casual greetings.

          Return a strict JSON object (no markdown block, no backticks, no comments) matching this schema:
          {
            "intent": "CREATE_TICKET" | "CHECK_STATUS" | "HUMAN_HANDOFF" | "GENERAL_QUERY",
            "extracted_ticket_number": "String (e.g. JI-SRV-2026-004 if mentioned, otherwise null)",
            "ticket_title": "String (short descriptive summary of fault, or null)",
            "ticket_description": "String (full details of fault, or null)",
            "ticket_system": "String (must match one of the Allowed Systems, e.g. 'CCTV', or null)",
            "ticket_priority": "String (Allowed SLA priorities, default to 'MEDIUM', or null)",
            "reply_text": "String (polite, direct reply in the client's language: English/Arabic)"
          }

          Rules for AI Reply text:
          - For CREATE_TICKET: If the client HAS a contract, tell them you are auto-logging a ticket for them. If the client HAS NO contract, explain that you are handing them over to an agent to set up the ticket.
          - For CHECK_STATUS: Tell them you are looking up the ticket details.
          - For HUMAN_HANDOFF: Apologize and let them know a customer agent is taking over.
          - For GENERAL_QUERY: Answer the query directly and politely.

          User Message:
          "${textContent || `[Media: ${messageType}]`}"`;

          const geminiRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { responseMimeType: "application/json" }
              })
            }
          );

          if (geminiRes.ok) {
            const geminiData = await geminiRes.json();
            const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
            const parsed = JSON.parse(text.trim());

            analyzedIntent = parsed.intent;
            replyMessageText = parsed.reply_text;

            // G. Execute Action based on intent
            if (analyzedIntent === "CREATE_TICKET") {
              if (chat.client_id && chat.contract_id) {
                // Client has a contract, auto-log ticket!
                // Fetch contract info for SLA tier
                const { data: contract } = await supabase
                  .from("amc_contracts")
                  .select("*")
                  .eq("id", chat.contract_id)
                  .single();

                const slaTier = contract?.sla_tier || "STANDARD";
                const responseHours = contract?.response_hours || 24;
                const resolutionHours = contract?.resolution_hours || 48;

                // Calculate deadlines
                const now = new Date();
                const responseDue = calculateDueDate(now, responseHours);
                const resolutionDue = calculateDueDate(now, resolutionHours);

                // Auto-number generation: get year sequence
                const year = now.getFullYear();
                let lastNum = 0;
                
                const { data: seq, error: seqErr } = await supabase
                  .from("service_ticket_sequences")
                  .select("*")
                  .eq("year", year)
                  .maybeSingle();

                if (!seq) {
                  await supabase.from("service_ticket_sequences").insert({ year, last_number: 1 });
                  lastNum = 1;
                } else {
                  lastNum = seq.last_number + 1;
                  await supabase.from("service_ticket_sequences").update({ last_number: lastNum }).eq("year", year);
                }

                const ticketNo = `JI-SRV-${year}-${String(lastNum).padStart(3, "0")}`;

                // Insert Service Ticket
                const { data: ticket, error: ticketErr } = await supabase
                  .from("service_tickets")
                  .insert({
                    ticket_number: ticketNo,
                    intake_channel: "WHATSAPP",
                    client_id: chat.client_id,
                    contract_id: chat.contract_id,
                    site_address: contract?.site_address || "Default site address",
                    system: parsed.ticket_system || "CCTV",
                    title: parsed.ticket_title || "WhatsApp Logged Issue",
                    description: parsed.ticket_description || textContent || "Logged via WhatsApp",
                    reported_by_name: senderName,
                    reported_by_phone: fromPhone,
                    priority: parsed.ticket_priority || "MEDIUM",
                    coverage: "COVERED",
                    sla_response_due: responseDue.toISOString(),
                    sla_resolution_due: resolutionDue.toISOString(),
                    status: "NEW"
                  })
                  .select()
                  .single();

                if (ticketErr) {
                  console.error("Auto-ticket creation failed:", ticketErr);
                  // Handover to human on failure
                  analyzedIntent = "HUMAN_HANDOFF";
                  replyMessageText = "I attempted to log a service ticket for you, but encountered an system error. Handing you over to a customer agent to help you directly.";
                  await supabase.from("whatsapp_chats").update({ status: "HUMAN_AGENT" }).eq("id", chat.id);
                } else {
                  replyMessageText = `Thank you! Ticket registered successfully.
Ticket Number: *${ticketNo}*
System: ${ticket.system}
Priority: ${ticket.priority}
Status: NEW
Our engineers have been notified, and response/resolution is covered under your AMC contract.`;
                  
                  // Emit Event on event bus so that tasks/approvals trigger
                  await supabase
                    .from("system_events")
                    .insert({
                      event_type: "ticket.created",
                      entity_type: "SERVICE_TICKET",
                      entity_id: ticket.id,
                      payload: {
                        ticket_number: ticketNo,
                        title: ticket.title,
                        client_name: contract?.client_name || "Valued Client",
                        site_address: ticket.site_address,
                        sla_tier: slaTier
                      }
                    })
                    .select()
                    .single()
                    .then(({ data: eventData }) => {
                      if (eventData) {
                        supabase.functions.invoke("process-event", {
                          body: { event_id: eventData.id }
                        }).catch(e => console.error("Failed to invoke process-event:", e));
                      }
                    });
                }
              } else {
                // Client not matched to contract, hand off to human
                analyzedIntent = "HUMAN_HANDOFF";
                replyMessageText = "I see you want to log a technical ticket, but I could not find a matching active maintenance contract for your phone number. I am handing you over to a customer service agent to verify details and assist you.";
                await supabase.from("whatsapp_chats").update({ status: "HUMAN_AGENT" }).eq("id", chat.id);
              }
            } else if (analyzedIntent === "CHECK_STATUS") {
              const ticketNum = parsed.extracted_ticket_number;
              
              if (ticketNum) {
                // Inquire specific ticket status
                const { data: ticket } = await supabase
                  .from("service_tickets")
                  .select("ticket_number, title, status, technician_id, profiles(full_name)")
                  .eq("ticket_number", ticketNum)
                  .maybeSingle();

                if (ticket) {
                  const techName = ticket.profiles?.full_name || "Unassigned";
                  replyMessageText = `Status of Ticket *${ticket.ticket_number}* (${ticket.title}):
Current Status: *${ticket.status}*
Assigned Technician: *${techName}*`;
                } else {
                  replyMessageText = `I couldn't find a record for ticket number *${ticketNum}*. Please verify the number.`;
                }
              } else if (chat.client_id) {
                // Inquire general status, list open tickets
                const { data: openTickets } = await supabase
                  .from("service_tickets")
                  .select("ticket_number, title, status")
                  .eq("client_id", chat.client_id)
                  .in("status", ["NEW", "ASSIGNED", "IN_PROGRESS", "ON_HOLD_PARTS"])
                  .limit(3);

                if (openTickets && openTickets.length > 0) {
                  const list = openTickets
                    .map(t => `- *${t.ticket_number}* (${t.title}): status is *${t.status}*`)
                    .join("\n");
                  replyMessageText = `Here are your active tickets:\n${list}\n\nPlease let me know if you need more details on a specific ticket.`;
                } else {
                  replyMessageText = "We did not find any open service tickets linked to your account. Would you like to log a new ticket?";
                }
              } else {
                replyMessageText = "I couldn't identify your account or any active tickets. I'm handing you over to a human agent.";
                analyzedIntent = "HUMAN_HANDOFF";
                await supabase.from("whatsapp_chats").update({ status: "HUMAN_AGENT" }).eq("id", chat.id);
              }
            } else if (analyzedIntent === "HUMAN_HANDOFF") {
              await supabase.from("whatsapp_chats").update({ status: "HUMAN_AGENT" }).eq("id", chat.id);
            }
          }
        } catch (err) {
          console.error("Gemini AI classification failed:", err);
          analyzedIntent = "HUMAN_HANDOFF";
          replyMessageText = "Thank you for your message. I am passing your request directly to a customer support agent to help you further.";
          await supabase.from("whatsapp_chats").update({ status: "HUMAN_AGENT" }).eq("id", chat.id);
        }
      }

      if (!replyMessageText) {
        replyMessageText = "Thank you for contacting JEET ERP. Our office timings are Sun-Thu 8 AM to 6 PM. An agent will contact you shortly.";
      }

      // H. Send response back to Meta API
      const metaUrl = `https://graph.facebook.com/v19.0/${settings.phone_number_id}/messages`;
      const response = await fetch(metaUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${settings.access_token}`
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: fromPhone,
          type: "text",
          text: {
            body: replyMessageText
          }
        })
      });

      const metaSendRes = await response.json();
      const sendMsgId = metaSendRes.messages?.[0]?.id;

      // Log outbound auto-reply message
      await supabase
        .from("whatsapp_messages")
        .insert({
          chat_id: chat.id,
          direction: "OUTBOUND",
          sender_name: "JEET ERP AI Coordinator",
          message_body: replyMessageText,
          message_type: "text",
          message_id: sendMsgId || null,
          status: response.ok ? "sent" : "failed",
          metadata: {
            ai_analyzed_intent: analyzedIntent
          }
        });

      return new Response(JSON.stringify({ success: true, intent: analyzedIntent }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });

    } catch (err: any) {
      console.error("Inbound webhook failed:", err);
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
  }

  return new Response("Method not allowed", { status: 405 });
});

// ============================================================
// WEBHOOK ATTACHMENT DOWNLOAD HELPERS
// ============================================================

async function getMetaMediaUrl(mediaId: string, accessToken: string): Promise<string | null> {
  try {
    const res = await fetch(`https://graph.facebook.com/v19.0/${mediaId}`, {
      headers: { "Authorization": `Bearer ${accessToken}` }
    });
    if (!res.ok) throw new Error(`Fetch media URL failed: ${await res.text()}`);
    const data = await res.json();
    return data.url || null;
  } catch (err) {
    console.error("Error getting Meta media URL:", err);
    return null;
  }
}

async function downloadMetaMedia(downloadUrl: string, accessToken: string): Promise<Blob | null> {
  try {
    const res = await fetch(downloadUrl, {
      headers: { "Authorization": `Bearer ${accessToken}` }
    });
    if (!res.ok) throw new Error(`Download media failed: ${await res.text()}`);
    return await res.blob();
  } catch (err) {
    console.error("Error downloading Meta media:", err);
    return null;
  }
}

// ============================================================
// BUSINESS HOUR CALCULATION COPY (Asia/Dubai)
// ============================================================

function calculateDueDate(start: Date, hoursToAdd: number): Date {
  let current = new Date(start.getTime());

  const isWeekend = (d: Date) => {
    const gstTime = new Date(d.getTime() + GST_OFFSET);
    const day = gstTime.getUTCDay();
    return day === 5 || day === 6; // Fri, Sat
  };

  const shiftToStartOfNextDay = (d: Date) => {
    const gstTime = new Date(d.getTime() + GST_OFFSET);
    const nextDay = new Date(Date.UTC(
      gstTime.getUTCFullYear(),
      gstTime.getUTCMonth(),
      gstTime.getUTCDate() + 1,
      8,
      0
    ));
    return new Date(nextDay.getTime() - GST_OFFSET);
  };

  // Skip starting on weekend
  if (isWeekend(current)) {
    const gstTime = new Date(current.getTime() + GST_OFFSET);
    current = new Date(Date.UTC(gstTime.getUTCFullYear(), gstTime.getUTCMonth(), gstTime.getUTCDate(), 8, 0) - GST_OFFSET);
    while (isWeekend(current)) {
      current = shiftToStartOfNextDay(current);
    }
  } else {
    const gstTime = new Date(current.getTime() + GST_OFFSET);
    const hour = gstTime.getUTCHours();
    if (hour < 8) {
      current = new Date(Date.UTC(gstTime.getUTCFullYear(), gstTime.getUTCMonth(), gstTime.getUTCDate(), 8, 0) - GST_OFFSET);
    } else if (hour >= 18) {
      current = shiftToStartOfNextDay(current);
      while (isWeekend(current)) {
        current = shiftToStartOfNextDay(current);
      }
    }
  }

  let remaining = hoursToAdd;
  while (remaining > 0) {
    const gstTime = new Date(current.getTime() + GST_OFFSET);
    const hour = gstTime.getUTCHours();
    const minutes = gstTime.getUTCMinutes();
    const hoursLeftToday = 18 - (hour + minutes / 60);

    if (remaining <= hoursLeftToday) {
      current = new Date(current.getTime() + Math.round(remaining * 60) * 60 * 1000);
      remaining = 0;
    } else {
      remaining -= hoursLeftToday;
      current = shiftToStartOfNextDay(current);
      while (isWeekend(current)) {
        current = shiftToStartOfNextDay(current);
      }
    }
  }

  return current;
}
