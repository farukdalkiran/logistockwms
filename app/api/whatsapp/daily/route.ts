import { NextRequest, NextResponse } from "next/server";
import { allowedNumbers, report, sendWhatsApp, todayTR } from "@/lib/whatsapp-bot";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(req:NextRequest) {
  if(!process.env.CRON_SECRET || req.headers.get("authorization")!==`Bearer ${process.env.CRON_SECRET}`)
    return NextResponse.json({error:"Unauthorized"},{status:401});
  const numbers=allowedNumbers();
  if(!numbers.length) return NextResponse.json({error:"Recipient allowlist is empty"},{status:503});
  try {
    const date=todayTR(),body=await report("RAPOR",date);
    const results=await Promise.allSettled(numbers.map(to=>sendWhatsApp(to,body,true)));
    const sent=results.filter(x=>x.status==="fulfilled").length;
    results.forEach((r,i)=>{if(r.status==="rejected")console.error("Daily WhatsApp send failed to recipient index",i,r.reason);});
    return NextResponse.json({date,sent,failed:numbers.length-sent},{status:sent===numbers.length?200:500});
  } catch(e) {
    console.error("Daily WhatsApp report failed",e);
    return NextResponse.json({error:"Report failed"},{status:500});
  }
}
