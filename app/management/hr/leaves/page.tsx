import LeaveRequestPanel from "./_components/LeaveRequestPanel";

export const metadata = {
  title: "İzin Yönetimi | LogiStock WMS",
};

export default function HrLeavesPage() {
  return (
    <div className="w-full min-h-screen bg-slate-50 p-4 lg:p-8">
      <LeaveRequestPanel />
    </div>
  );
}