import { NextRequest, NextResponse } from "next/server";
import { authorizedChatIds, parseCommand, report, sendTelegram } from "@/lib/telegram-bot";
export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function POST(req:NextRequest) {
  const secret=process.env.TELEGRAM_WEBHOOK_SECRET;
  if(!secret || req.headers.get("x-telegram-bot-api-secret-token")!==secret)
    return NextResponse.json({error:"Unauthorized"},{status:401});
  let update: {message?:{chat?:{id:number};text?:string}}={};
  try{ update=await req.json(); }catch{return NextResponse.json({error:"Invalid JSON"},{status:400});}
  const id=String(update.message?.chat?.id||"");
  if(!authorizedChatIds().includes(id) || !update.message?.text)
    return NextResponse.json({ok:true});
  const command=parseCommand(update.message.text);
  try {await sendTelegram(id,command?await report(command):"Bilinmeyen komut. /yardim yazın.");}
  catch(err){console.error("Telegram report reply failed",err);return NextResponse.json({error:"Retry"},{status:500});}
  return NextResponse.json({ok:true});
}
