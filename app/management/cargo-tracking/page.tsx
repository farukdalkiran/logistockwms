import TrackingManager from "./_components/TrackingManager";

export const metadata = {
  title: "Kargo Takip Merkezi | LogiStock WMS",
};

export default function CargoTrackingPage() {
  return (
    <div className="w-full min-h-screen">
      <TrackingManager />
    </div>
  );
}