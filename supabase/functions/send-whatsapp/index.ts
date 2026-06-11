// @ts-nocheck
// ============================================================
// JEET ERP — Platform Layer: send-whatsapp Edge Function
// Sends template notifications via Meta WhatsApp Business Cloud API
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.10.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase configuration env variables.");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body = await req.json();
    const { notification_id, chat_id, message_body } = body;

    if (!notification_id && (!chat_id || !message_body)) {
      return new Response(JSON.stringify({ error: "Missing notification_id or chat_id/message_body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 1. Fetch WhatsApp settings
    const { data: settings, error: settingsErr } = await supabase
      .from("whatsapp_settings")
      .select("*")
      .single();

    if (settingsErr || !settings) {
      throw new Error(`WhatsApp settings not found: ${settingsErr?.message || "Unknown error"}`);
    }

    // Handle Manual Free-form Message Action
    if (chat_id && message_body) {
      const { data: chat, error: chatErr } = await supabase
        .from("whatsapp_chats")
        .select("*")
        .eq("id", chat_id)
        .single();
      
      if (chatErr || !chat) {
        throw new Error(`Chat session not found: ${chatErr?.message || "Unknown error"}`);
      }

      if (!settings.whatsapp_enabled) {
        console.warn("WhatsApp is disabled in settings. Logging manual reply locally (mock).");
        const { data: newMsg, error: insertErr } = await supabase
          .from("whatsapp_messages")
          .insert({
            chat_id: chat.id,
            direction: "OUTBOUND",
            sender_name: "Human Agent (Mock)",
            message_body: message_body,
            message_type: "text",
            status: "sent"
          })
          .select()
          .single();

        if (insertErr) throw insertErr;

        await supabase
          .from("whatsapp_chats")
          .update({
            status: "HUMAN_AGENT",
            last_message_at: new Date().toISOString()
          })
          .eq("id", chat.id);

        return new Response(JSON.stringify({ success: true, message: newMsg }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const recipientPhone = chat.phone_number.replace(/[\s\-\+\(\)]/g, "");
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
          to: recipientPhone,
          type: "text",
          text: {
            body: message_body
          }
        })
      });

      const metaResData = await response.json();
      if (!response.ok) {
        throw new Error(`Meta API error: ${JSON.stringify(metaResData)}`);
      }

      const metaMessageId = metaResData.messages?.[0]?.id;

      const { data: newMsg, error: insertErr } = await supabase
        .from("whatsapp_messages")
        .insert({
          chat_id: chat.id,
          direction: "OUTBOUND",
          sender_name: "Human Agent",
          message_body: message_body,
          message_type: "text",
          message_id: metaMessageId || null,
          status: "sent"
        })
        .select()
        .single();

      if (insertErr) throw insertErr;

      await supabase
        .from("whatsapp_chats")
        .update({
          status: "HUMAN_AGENT",
          last_message_at: new Date().toISOString()
        })
        .eq("id", chat.id);

      return new Response(JSON.stringify({ success: true, message: newMsg }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Graceful degradation: if whatsapp is disabled or credentials missing, skip sending
    if (!settings.whatsapp_enabled) {
      console.warn("WhatsApp integration is disabled in settings. Skipping dispatch.");
      await supabase
        .from("notifications")
        .update({ status: "SKIPPED_CHANNEL_INACTIVE" })
        .eq("id", notification_id);
      return new Response(JSON.stringify({ success: true, skipped: "whatsapp_disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const { phone_number_id, access_token } = settings;
    if (!phone_number_id || !access_token) {
      console.warn("Meta credentials (phone_number_id / access_token) not configured. Skipping.");
      await supabase
        .from("notifications")
        .update({ status: "FAILED", metadata: { error: "Missing Meta API credentials" } })
        .eq("id", notification_id);
      return new Response(JSON.stringify({ success: false, error: "Missing credentials" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 2. Fetch notification, event and user profile details
    const { data: notif, error: notifErr } = await supabase
      .from("notifications")
      .select(`
        *,
        profile:profiles!user_id (phone, email, full_name),
        event:system_events!event_id (*)
      `)
      .eq("id", notification_id)
      .single();

    if (notifErr || !notif) {
      throw new Error(`Notification not found: ${notifErr?.message || "Unknown error"}`);
    }

    // 3. Resolve recipient phone number
    let recipientPhone = notif.profile?.phone || "";

    // If no direct profile phone, check if there's a phone number in the event payload
    if (!recipientPhone && notif.event?.payload) {
      recipientPhone = notif.event.payload.client_contact_phone || 
                       notif.event.payload.reported_by_phone || 
                       notif.event.payload.phone || 
                       "";
    }

    // Format phone number to clean digit-only format (Meta API requirement)
    recipientPhone = recipientPhone.replace(/[\s\-\+\(\)]/g, "");

    if (!recipientPhone) {
      console.warn("No phone number resolved for recipient. Failing notification.");
      await supabase
        .from("notifications")
        .update({ status: "FAILED", metadata: { error: "No recipient phone number resolved" } })
        .eq("id", notification_id);
      return new Response(JSON.stringify({ success: false, error: "No recipient phone number" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 4. Resolve Template Mapping
    const eventType = notif.event?.event_type || "";
    const { data: template } = await supabase
      .from("whatsapp_templates")
      .select("*")
      .eq("event_type", eventType)
      .eq("is_active", true)
      .single();

    let payloadBody: any;
    let textBody = notif.body;

    if (template) {
      // Build parameters array in the order of variables specified
      const parameters = [];
      let templatePreview = template.body_template;

      for (const variable of template.variables) {
        const val = notif.event?.payload?.[variable] !== undefined 
          ? String(notif.event.payload[variable]) 
          : "";
        parameters.push({
          type: "text",
          text: val
        });
        // Replace in local body preview
        templatePreview = templatePreview.replace(`{{${variable}}}`, val);
      }

      textBody = templatePreview;

      payloadBody = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: recipientPhone,
        type: "template",
        template: {
          name: template.template_name,
          language: {
            code: template.language_code
          },
          components: [
            {
              type: "body",
              parameters
            }
          ]
        }
      };
    } else {
      // Fallback: If no template mapped, send as free-form text message 
      // (This will fail if outside Meta's 24h window, but provides graceful fallback)
      console.warn(`No active WhatsApp template found for event type: ${eventType}. Sending as free-form text.`);
      payloadBody = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: recipientPhone,
        type: "text",
        text: {
          body: notif.body
        }
      };
    }

    // 5. Call Meta API to send
    const metaUrl = `https://graph.facebook.com/v19.0/${phone_number_id}/messages`;
    const response = await fetch(metaUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${access_token}`
      },
      body: JSON.stringify(payloadBody)
    });

    const metaResData = await response.json();

    if (!response.ok) {
      console.error("Meta API error:", metaResData);
      throw new Error(`Meta API error (status ${response.status}): ${JSON.stringify(metaResData)}`);
    }

    const metaMessageId = metaResData.messages?.[0]?.id;

    // 6. Log outbound message to whatsapp_messages table
    // Resolve or create chat session for this number
    let chat = null;
    const { data: existingChat } = await supabase
      .from("whatsapp_chats")
      .select("*")
      .eq("phone_number", recipientPhone)
      .maybeSingle();

    if (existingChat) {
      chat = existingChat;
      // Try to link contract/client if missing but payload has them
      let updateFields: any = {};
      if (!chat.client_id && notif.event?.payload?.client_id) {
        updateFields.client_id = notif.event.payload.client_id;
      }
      if (!chat.contract_id && notif.event?.payload?.contract_id) {
        updateFields.contract_id = notif.event.payload.contract_id;
      }
      if (Object.keys(updateFields).length > 0) {
        await supabase.from("whatsapp_chats").update(updateFields).eq("id", chat.id);
      }
    } else {
      // Create new chat
      const { data: newChat, error: chatErr } = await supabase
        .from("whatsapp_chats")
        .insert({
          phone_number: recipientPhone,
          client_id: notif.event?.payload?.client_id || null,
          contract_id: notif.event?.payload?.contract_id || null,
          status: "CLOSED" // Default to closed for purely outbound logs
        })
        .select()
        .single();
      
      if (!chatErr && newChat) {
        chat = newChat;
      }
    }

    if (chat) {
      await supabase
        .from("whatsapp_messages")
        .insert({
          chat_id: chat.id,
          direction: "OUTBOUND",
          sender_name: "JEET ERP System",
          message_body: textBody,
          message_type: "text",
          message_id: metaMessageId || null,
          status: "sent",
          metadata: {
            event_type: eventType,
            template_name: template?.template_name || null
          }
        });

      // Update chat last message timestamp
      await supabase
        .from("whatsapp_chats")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", chat.id);
    }

    // 7. Update notification record status to SENT
    await supabase
      .from("notifications")
      .update({ status: "SENT", read_at: null })
      .eq("id", notification_id);

    return new Response(JSON.stringify({ success: true, message_id: metaMessageId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error: any) {
    console.error("WhatsApp delivery failed:", error);
    
    // Update status to FAILED in notifications
    try {
      const body = await req.json();
      const { notification_id } = body;
      if (notification_id) {
        const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        await supabase
          .from("notifications")
          .update({ status: "FAILED", metadata: { error: error.message } })
          .eq("id", notification_id);
      }
    } catch (e) {
      console.error("Failed to mark notification as failed:", e);
    }

    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
