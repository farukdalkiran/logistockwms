import { NextRequest, NextResponse } from "next/server";
import { isAllowed, parseCommand, report, sendWhatsApp, verifySignature } from "@/lib/whatsapp-bot";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const p=req.nextUrl.searchParams;
  if(p.get("hub.mode")!=="subscribe" || !process.env.WHATSAPP_VERIFY_TOKEN || p.get("hub.verify_token")!==process.env.WHATSAPP_VERIFY_TOKEN)
    return new NextResponse("Forbidden",{status:403});
  return new NextResponse(p.get("hub.challenge") || "",{status:200,headers:{"Content-Type":"text/plain"}});
}
export async function POST(req:NextRequest) {
  const body=await req.text();
  if(!verifySignature(body,req.headers.get("x-hub-signature-256")))
    return NextResponse.json({error:"Unauthorized"},{status:401});
  let event:unknown;
  try {event=JSON.parse(body);} catch {return NextResponse.json({error:"Invalid JSON"},{status:400});}
  const envelope=event as {entry?:Array<{changes?:Array<{value?:{messages?:Array<{from?:string;id?:string;type?:string;text?:{body?:string}}>} }>}>};
  for(const entry of envelope.entry||[]) for(const change of entry.changes||[]) for(const msg of change.value?.messages||[]) {
    if(msg.type!=="text" || !msg.from || !isAllowed(msg.from)) continue;
    const command=parseCommand(msg.text?.body||"");
    try {await sendWhatsApp(msg.from,command ? await report(command) : "Komut tanınmadı. YARDIM yazın.");}
    catch(e){console.error("WhatsApp bot failed",e);return NextResponse.json({error:"Processing failed"},{status:500});}
  }
  return NextResponse.json({ok:true});
}
