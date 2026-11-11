import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { broadcastTelegram, eventText } from "@/lib/telegram-bot";
export const runtime="nodejs";
export const dynamic="force-dynamic";
type Attendance = {id?:string;employee_id?:string|null;check_in_time?:string|null;check_out_time?:string|null;status?:string|null};
type Payload = {type?:string;table?:string;schema?:string;record?:Attendance;old_record?:Attendance|null};

export async function POST(req:NextRequest) {
  const secret=process.env.TELEGRAM_ATTENDANCE_WEBHOOK_SECRET;
  if(!secret || req.headers.get("x-logistock-event-secret")!==secret)
    return NextResponse.json({error:"Unauthorized"},{status:401});
  let data:Payload;
  try{data=await req.json() as Payload;}catch{return NextResponse.json({error:"Invalid payload"},{status:400});}
  if(data.schema!=="public"||data.table!=="attendance"||!["INSERT","UPDATE"].includes(data.type||""))
    return NextResponse.json({ok:true,skipped:true});
  const row=data.record||{},previous=data.old_record;
  if(!row.id||!row.employee_id || String(row.status||"").startsWith("LEAVE_"))
    return NextResponse.json({ok:true,skipped:true});
  // Only real new punches, never retroactive edits, automatic closures or leave rows.
  const event = data.type==="INSERT" && row.check_in_time && !row.check_out_time ? "IN"
    : data.type==="UPDATE" && previous?.check_in_time && previous.check_out_time==null && row.check_out_time && row.check_in_time===previous.check_in_time && row.status!=="AUTO_CLOSED_MISSING_OUT" ? "OUT" : null;
  if(!event) return NextResponse.json({ok:true,skipped:true});
  const stamp=event==="IN"?row.check_in_time!:row.check_out_time!;
  // Historical/synthetic rows created through an editor are not instant entry/exit events.
  if(Math.abs(Date.now()-Date.parse(stamp))>120000) return NextResponse.json({ok:true,skipped:true});
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key) return NextResponse.json({error:"Database not configured"},{status:503});
  const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  // A database-level unique key prevents repeated notifications on retries.
  const {error:lockError}=await db.from("telegram_notification_events").insert({event_key:`${row.id}:${event}:${stamp}`});
  if(lockError?.code==="23505") return NextResponse.json({ok:true,duplicate:true});
  if(lockError) {console.error("Telegram event lock error",lockError.code);return NextResponse.json({error:"Event store not configured"},{status:503});}
  const {data:employee,error}=await db.from("employees").select("full_name").eq("id",row.employee_id).maybeSingle();
  if(error) return NextResponse.json({error:"Employee lookup failed"},{status:500});
  const outcome=await broadcastTelegram(eventText(event,employee?.full_name||"Bilinmeyen personel",stamp));
  // Partial failures are logged; same event will not be rebroadcast to successful recipients.
  if(outcome.failed) console.error("Telegram attendance delivery failure count",outcome.failed);
  return NextResponse.json({ok:outcome.failed===0,...outcome},{status:outcome.failed===0?200:207});
}
