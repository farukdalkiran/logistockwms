import type { Metadata } from "next";
import HamurlabsTransferPlanner from "./_components/HamurlabsTransferPlanner";

export const metadata: Metadata = {
  title: "HamurLabs Transfer Planlama | LogiStock WMS",
  description: "Merkez Depo - Online Depo Excel stok karşılaştırması ve onaylı transfer dosyaları.",
};

export default function HamurlabsTransferPage() {
  return <HamurlabsTransferPlanner />;
}
