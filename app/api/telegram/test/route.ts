import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { authorizedChatIds, sendTelegram } from "@/lib/telegram-bot";
export const runtime="nodejs";
export const dynamic="force-dynamic";
function same(a:string,b:string) {
  const x=Buffer.from(a),y=Buffer.from(b);
  return x.length===y.length && timingSafeEqual(x,y);
}
export async function GET(req:NextRequest) {
  // One-shot diagnostic, strictly limited to the Telegram preview branch.
  if(process.env.VERCEL_ENV!=="preview" || process.env.VERCEL_GIT_COMMIT_REF!=="feature/telegram-report-bot")
    return NextResponse.json({error:"Not available"},{status:404});
  const secret=process.env.CRON_SECRET;
  if(!secret || !same(req.nextUrl.searchParams.get("key")||"",secret))
    return NextResponse.json({error:"Unauthorized"},{status:401});
  const ids=authorizedChatIds();
  if(ids.length!==1 || ids[0]!=="909182985")
    return NextResponse.json({error:"Unexpected recipients"},{status:409});
  try {
    await sendTelegram(ids[0],"✅ Logistock Telegram Bot test bağlantısı başarılı. /mesai ve anlık bildirimler etkinleştirildikten sonra bu sohbetten rapor alacaksınız.");
    return NextResponse.json({ok:true,sent:1});
  }catch(e) {
    console.error("Telegram test send failure",e);
    return NextResponse.json({ok:false,error:"Send failed"},{status:502});
  }
}
