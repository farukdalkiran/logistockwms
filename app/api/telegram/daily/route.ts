import { NextRequest,NextResponse } from "next/server";
import { authorizedChatIds,broadcastTelegram,report,todayTR } from "@/lib/telegram-bot";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(req:NextRequest) {
  if(!process.env.CRON_SECRET || req.headers.get("authorization")!==`Bearer ${process.env.CRON_SECRET}`)
    return NextResponse.json({error:"Unauthorized"},{status:401});
  if(!authorizedChatIds().length) return NextResponse.json({error:"Recipients missing"},{status:503});
  try {
    const text=await report("RAPOR"),outcome=await broadcastTelegram(text);
    return NextResponse.json({date:todayTR(),...outcome},{status:outcome.failed?207:200});
  }catch(e){console.error("Telegram daily report failed",e);return NextResponse.json({error:"Report failed"},{status:500});}
}
